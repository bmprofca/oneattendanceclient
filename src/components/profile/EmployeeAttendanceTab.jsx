import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaCalendarAlt, FaCheckCircle, FaChevronLeft, FaChevronRight, FaCoffee, FaInfoCircle, FaSave, FaSpinner, FaTimesCircle } from "react-icons/fa";
import { toast } from "react-toastify";
import apiCall from "../../utils/api";
import AdvancedDateFilter from "../AdvancedDateFilter";
import Modal from "../Modal";
import SelectField from "../SelectField";
import TimePickerField from "../TimePicker";

const STATUS_STYLES = {
  present: { cell: "bg-emerald-50/60 border-emerald-100", pill: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Present", dot: "bg-emerald-500" },
  absent: { cell: "bg-rose-50/60 border-rose-100", pill: "bg-rose-100 text-rose-700 border-rose-200", label: "Absent", dot: "bg-rose-500" },
  holiday: { cell: "bg-amber-50/60 border-amber-100", pill: "bg-amber-100 text-amber-700 border-amber-200", label: "Holiday", dot: "bg-amber-500" },
  weekend: { cell: "bg-slate-50/60 border-slate-100", pill: "bg-slate-100 text-slate-600 border-slate-200", label: "Weekend", dot: "bg-slate-400" },
  leave: { cell: "bg-violet-50/60 border-violet-100", pill: "bg-violet-100 text-violet-700 border-violet-200", label: "Leave", dot: "bg-violet-500" },
  half_day: { cell: "bg-orange-50/60 border-orange-100", pill: "bg-orange-100 text-orange-700 border-orange-200", label: "Half Day", dot: "bg-orange-500" },
  upcoming: { cell: "bg-white border-gray-100", pill: "bg-gray-100 text-gray-500 border-gray-200", label: "Upcoming", dot: "bg-gray-300" },
};

const getCompanyId = () => JSON.parse(localStorage.getItem("company") || "{}")?.id;
const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parseTime = (value) => {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (match[3]?.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (match[3]?.toUpperCase() === "AM" && hour === 12) hour = 0;
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
};
const formatMinutes = (value) => {
  const minutes = Number(value);
  return Number.isFinite(minutes) ? `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m` : "0h 0m";
};
const getStatus = (day) => day?.is_leave ? "leave" : day?.is_holiday && (!day.day_status || day.day_status === "upcoming") ? "holiday" : day?.day_status || null;
const getActivityTime = (day, type) => String((day?.activities || []).find((item) => item.type === type)?.time || "").slice(0, 5);
const getWorkMinutes = (day) => {
  const activities = day?.activities || [];
  let start = null;
  let total = 0;
  activities.forEach((activity) => {
    if (activity.type === "PUNCH_IN") start = parseTime(activity.time);
    if (activity.type === "PUNCH_OUT" && start != null) {
      const end = parseTime(activity.time);
      if (end != null) total += end >= start ? end - start : end + 1440 - start;
      start = null;
    }
  });
  return total;
};

function AttendanceEditor({ cell, employee, shift, onClose, onSaved }) {
  const day = cell?.data || {};
  const [mode, setMode] = useState("attendance");
  const [status, setStatus] = useState(["present", "half_day", "absent", "leave"].includes(getStatus(day)) ? getStatus(day) : "present");
  const [punchIn, setPunchIn] = useState(getActivityTime(day, "PUNCH_IN") || String(shift?.start_time || "09:00").slice(0, 5));
  const [punchOut, setPunchOut] = useState(getActivityTime(day, "PUNCH_OUT") || String(shift?.end_time || "18:00").slice(0, 5));
  const [halfDayType, setHalfDayType] = useState(day.half_day_type || "first_half");
  const [leaveType, setLeaveType] = useState(day.is_leave?.type || "unpaid");
  const [leaveCode, setLeaveCode] = useState(day.is_leave?.code || "");
  const [leaveOptions, setLeaveOptions] = useState([]);
  const [breakStart, setBreakStart] = useState("13:00");
  const [breakEnd, setBreakEnd] = useState("14:00");
  const [breakType, setBreakType] = useState("lunch");
  const [notes, setNotes] = useState("");
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== "attendance" || status !== "leave") return undefined;
    let mounted = true;
    setLoadingLeaves(true);
    apiCall(`/leave/company?is_paid=${leaveType === "paid"}`, "GET", null, getCompanyId())
      .then((response) => response.json())
      .then((result) => { if (mounted && result.success) setLeaveOptions((result.data || []).map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))); })
      .catch(() => { if (mounted) setLeaveOptions([]); })
      .finally(() => { if (mounted) setLoadingLeaves(false); });
    return () => { mounted = false; };
  }, [mode, status, leaveType]);

  const save = async () => {
    if (mode === "attendance" && status === "leave" && !leaveCode) return toast.error("Leave code is required");
    if (mode === "attendance" && ["present", "half_day"].includes(status) && (!punchIn || !punchOut)) return toast.error("Punch in and punch out times are required");
    if (mode === "break" && !breakStart) return toast.error("Break start time is required");
    setSaving(true);
    try {
      const payload = mode === "break"
        ? { employee_id: employee.id, date: formatDate(cell.date), type: "break", start_time: breakStart, end_time: breakEnd, break_type: breakType, notes }
        : { employee_id: employee.id, date: formatDate(cell.date), type: "attendance", status, notes, ...( ["present", "half_day"].includes(status) ? { start_time: punchIn, end_time: punchOut } : {}), ...(status === "half_day" ? { half_day_type: halfDayType } : {}), ...(status === "leave" ? { leave_type: leaveType, leave_type_value: leaveCode } : {}), is_overtime: false, is_deductible: false };
      const response = await apiCall("/attendance/mark", "POST", payload, getCompanyId());
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.message || "Failed to save attendance");
      toast.success(result.message || (mode === "break" ? "Break recorded successfully" : "Attendance updated successfully"));
      onSaved();
    } catch (error) {
      toast.error(error.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={!!cell} onClose={onClose} title="Manage Attendance & Break" subtitle={`${employee?.name || "Employee"} | ${formatDate(cell.date)}`} icon={<FaCalendarAlt className="text-blue-600" />} size="xl" footer={<div className="flex justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-600">Cancel</button><button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? <FaSpinner className="animate-spin" /> : <FaSave />} Save</button></div>}>
      <div className="space-y-5">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setMode("attendance")} className={`flex-1 rounded-lg py-2 text-xs font-bold ${mode === "attendance" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><FaCalendarAlt className="mr-2 inline" />Attendance</button><button type="button" onClick={() => setMode("break")} className={`flex-1 rounded-lg py-2 text-xs font-bold ${mode === "break" ? "bg-white text-amber-700 shadow-sm" : "text-slate-500"}`}><FaCoffee className="mr-2 inline" />Break</button></div>
        {mode === "attendance" ? <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[{ value: "present", label: "Present" }, { value: "half_day", label: "Half Day" }, { value: "absent", label: "Absent" }, { value: "leave", label: "Leave" }].map((item) => <button key={item.value} type="button" onClick={() => setStatus(item.value)} className={`rounded-xl border px-2 py-3 text-xs font-bold ${status === item.value ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>{item.label}</button>)}</div>
          {["present", "half_day"].includes(status) && <div className="grid gap-3 sm:grid-cols-2"><TimePickerField label="Punch In" value={punchIn} onChange={setPunchIn} initialValue="09:00" required /><TimePickerField label="Punch Out" value={punchOut} onChange={setPunchOut} initialValue="18:00" required /></div>}
          {status === "half_day" && <div className="grid grid-cols-2 gap-2">{[{ value: "first_half", label: "First Half" }, { value: "second_half", label: "Second Half" }].map((item) => <button key={item.value} type="button" onClick={() => setHalfDayType(item.value)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${halfDayType === item.value ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>{item.label}</button>)}</div>}
          {status === "leave" && <div className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/50 p-4"><div className="flex justify-between text-xs font-bold text-slate-500"><span>Paid Leave</span><button type="button" onClick={() => { setLeaveType((value) => value === "paid" ? "unpaid" : "paid"); setLeaveCode(""); }} className="text-indigo-600">{leaveType === "paid" ? "Paid" : "Unpaid"}</button></div><SelectField value={leaveOptions.find((item) => item.value === leaveCode) || null} onChange={(item) => setLeaveCode(item?.value || "")} options={leaveOptions} isLoading={loadingLeaves} placeholder="Select leave code" menuPortalTarget={document.body} /></div>}
        </> : <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><TimePickerField label="Break Start" value={breakStart} onChange={setBreakStart} initialValue="13:00" required /><TimePickerField label="Break End" value={breakEnd} onChange={setBreakEnd} initialValue="14:00" required /></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{["lunch", "tea", "official", "personal"].map((type) => <button key={type} type="button" onClick={() => setBreakType(type)} className={`rounded-xl border px-2 py-2 text-xs font-bold capitalize ${breakType === type ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600"}`}>{type}</button>)}</div></div>}
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Notes / remarks" className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white" />
      </div>
    </Modal>
  );
}

export default function EmployeeAttendanceTab({ employee, fallbackId, refreshKey = 0 }) {
  const employeeId = employee?.id || fallbackId;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const lastRequest = useRef("");
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const fetchCalendar = useCallback(async () => {
    if (!employeeId) return;
    const requestKey = `${employeeId}-${month}-${year}-${refreshKey}`;
    if (lastRequest.current === requestKey) return;
    lastRequest.current = requestKey;
    setLoading(true);
    try {
      const response = await apiCall(`/shifts/my-calendar?employee_id=${employeeId}&month=${month}&year=${year}`, "GET", null, getCompanyId());
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to fetch calendar");
      setCalendar({ ...result.data, meta: result.meta });
      setError(null);
    } catch (requestError) {
      setError(requestError.message || "Failed to fetch calendar");
    } finally {
      setLoading(false);
    }
  }, [employeeId, month, year, refreshKey]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  const cells = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(year, month - 1, index - firstDay + 1);
      const isCurrentMonth = index >= firstDay && index < firstDay + daysInMonth;
      return { date, dayNumber: date.getDate(), isCurrentMonth, data: calendar?.days?.[formatDate(date)] || null, isToday: date.toDateString() === new Date().toDateString() };
    });
  }, [calendar, month, year]);

  const saveComplete = () => { setSelectedCell(null); lastRequest.current = ""; fetchCalendar(); };
  const meta = calendar?.meta || {};
  const shift = calendar?.shift || {};

  return <div className="max-w-screen-2xl pb-8">
    <div className="mb-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-5 text-white shadow-xl"><h2 className="text-xl font-black">{employee?.name || employee?.employee_name || "Attendance Calendar"}</h2><p className="mt-1 text-xs font-bold uppercase tracking-widest text-indigo-200">{employee?.employee_code || employee?.code || "Employee"}</p><div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4"><div><p className="text-[9px] uppercase text-indigo-200">Shift In</p><p className="font-black">{shift.start_time || "--:--"}</p></div><div><p className="text-[9px] uppercase text-indigo-200">Shift Out</p><p className="font-black">{shift.end_time || "--:--"}</p></div><div><p className="text-[9px] uppercase text-indigo-200">Present</p><p className="font-black">{meta.present || 0}</p></div><div><p className="text-[9px] uppercase text-indigo-200">Worked</p><p className="font-black">{formatMinutes(calendar?.statistics?.worked_minutes)}</p></div></div></div>
    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><button type="button" onClick={() => setCurrentDate((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-500"><FaChevronLeft size={11} /></button><h2 className="min-w-[170px] text-center text-xl font-black text-gray-900">{currentDate.toLocaleString("default", { month: "long" })} {year}</h2><button type="button" onClick={() => setCurrentDate((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-500"><FaChevronRight size={11} /></button><AdvancedDateFilter value={{ month, year }} onChange={(value) => value.month && value.year && setCurrentDate(new Date(value.year, value.month - 1, 1))} tabOptions={["month"]} placeholder="Jump to month" buttonClassName="rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs font-bold text-gray-600" /></div></div>
    <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">{[["Total", meta.total_days, "upcoming"], ["Present", meta.present, "present"], ["Absent", meta.absent, "absent"], ["Leave", meta.leave, "leave"], ["Holiday", meta.holiday, "holiday"], ["Weekend", meta.weekend, "weekend"], ["Half Day", meta.half_day, "half_day"]].map(([label, value, type]) => <div key={label} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"><p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{label}</p><p className="text-lg font-black text-gray-900">{value || 0}</p><span className={`mt-1 inline-block h-2 w-2 rounded-full ${STATUS_STYLES[type].dot}`} /></div>)}</div>
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">{loading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70"><FaSpinner className="animate-spin text-2xl text-indigo-600" /></div>}<div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">{day}</div>)}</div><div className="grid grid-cols-7 gap-px bg-gray-100">{error ? <div className="col-span-7 flex flex-col items-center gap-3 bg-white py-20 text-rose-400"><FaTimesCircle size={32} /><p className="text-xs font-bold">{error}</p><button type="button" onClick={() => { lastRequest.current = ""; fetchCalendar(); }} className="rounded-xl bg-rose-50 px-4 py-2 text-xs font-bold text-rose-600">Retry</button></div> : cells.map((cell) => cell.isCurrentMonth ? <button type="button" key={formatDate(cell.date)} onClick={() => setSelectedCell(cell)} className={`min-h-[100px] border-r border-b p-2 text-left ${STATUS_STYLES[getStatus(cell.data) || "upcoming"].cell} ${cell.isToday ? "ring-2 ring-inset ring-indigo-400" : ""}`}><span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">{cell.dayNumber}</span><span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${STATUS_STYLES[getStatus(cell.data) || "upcoming"].pill}`}><span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[getStatus(cell.data) || "upcoming"].dot}`} />{STATUS_STYLES[getStatus(cell.data) || "upcoming"].label}</span>{getWorkMinutes(cell.data) > 0 && <p className="mt-1 text-[10px] font-bold text-gray-700"><FaCheckCircle className="mr-1 inline text-emerald-500" size={8} />{formatMinutes(getWorkMinutes(cell.data))}</p>}</button> : <div key={formatDate(cell.date)} className="min-h-[100px] bg-gray-50/30 p-2"><span className="text-xs text-gray-200">{cell.dayNumber}</span></div>)}</div></div>
    {selectedCell && <AttendanceEditor cell={selectedCell} employee={employee || { id: employeeId }} shift={shift} onClose={() => setSelectedCell(null)} onSaved={saveComplete} />}
  </div>;
}
