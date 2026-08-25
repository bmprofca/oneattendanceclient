import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaCalendarAlt, FaCheckCircle, FaChevronDown, FaChevronLeft, FaChevronRight, FaChartLine, FaCoffee, FaEdit, FaHourglassHalf, FaInfoCircle, FaSave, FaSpinner, FaTimesCircle, FaUserClock } from "react-icons/fa";
import { toast } from "react-toastify";
import apiCall from "../../utils/api";
import AdvancedDateFilter from "../AdvancedDateFilter";
import Modal from "../Modal";
import SelectField from "../SelectField";
import TimePickerField from "../TimePicker";
import { ManageAttendanceModal } from "../../pages/UnmarkedAttendance";
import { BreakFormModal } from "../../pages/BreakManagement";

const STATUS_STYLES = {
  present: { cell: "bg-emerald-50/60 border-emerald-100", pill: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Present", dot: "bg-emerald-500" },
  absent: { cell: "bg-rose-50/60 border-rose-100", pill: "bg-rose-100 text-rose-700 border-rose-200", label: "Absent", dot: "bg-rose-500" },
  holiday: { cell: "bg-amber-50/60 border-amber-100", pill: "bg-amber-100 text-amber-700 border-amber-200", label: "Holiday", dot: "bg-amber-500" },
  weekend: { cell: "bg-slate-50/60 border-slate-100", pill: "bg-slate-100 text-slate-600 border-slate-200", label: "Weekend", dot: "bg-slate-400" },
  leave: { cell: "bg-violet-50/60 border-violet-100", pill: "bg-violet-100 text-violet-700 border-violet-200", label: "Leave", dot: "bg-violet-500" },
  half_day: { cell: "bg-orange-50/60 border-orange-100", pill: "bg-orange-100 text-orange-700 border-orange-200", label: "Half Day", dot: "bg-orange-500" },
  upcoming: { cell: "bg-white border-gray-100", pill: "bg-gray-100 text-gray-500 border-gray-200", label: "Upcoming", dot: "bg-gray-300" },
  not_joined: { cell: "bg-gray-50/60 border-gray-200", pill: "bg-gray-200 text-gray-600 border-gray-300", label: "Not Joined", dot: "bg-gray-400" },
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
const getBreakTime = (day, type) => String((day?.breaks || []).find((item) => item.type === type)?.time || "").slice(0, 5);
const getBreakPairs = (day) => {
  const pairs = [];
  (day?.breaks || []).forEach((event) => {
    if (event.type === "BREAK_START") pairs.push({ start: event, end: null });
    else if (event.type === "BREAK_END") {
      const openPair = [...pairs].reverse().find((pair) => !pair.end);
      if (openPair) openPair.end = event;
      else pairs.push({ start: null, end: event });
    }
  });
  return pairs;
};
const getBreakDurationMinutes = (start, end) => {
  const startMinutes = parseTime(start);
  const endMinutes = parseTime(end);
  if (startMinutes === null || endMinutes === null) return null;
  return endMinutes >= startMinutes ? endMinutes - startMinutes : endMinutes + 1440 - startMinutes;
};
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

const formatLabel = (value) => String(value || "--").replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
const getActorLabel = (actor) => actor?.name ? `${actor.name}${actor.role ? ` (${formatLabel(actor.role)})` : ""}` : "System";
const getStatusLabel = (day, status) => {
  if (status === "leave") return day?.leave_code || day?.is_leave?.code || STATUS_STYLES.leave.label;
  if (status === "holiday") return day?.is_holiday?.name || STATUS_STYLES.holiday.label;
  return STATUS_STYLES[status]?.label || STATUS_STYLES.upcoming.label;
};

// Safe helper to get style object for a status, falling back to "upcoming"
const getStatusStyle = (status) => STATUS_STYLES[status] || STATUS_STYLES.upcoming;

function CollapsibleEventSection({ title, isOpen, onToggle, children }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-slate-50/40">
      <button type="button" onClick={onToggle} aria-expanded={isOpen} className="flex w-full items-center justify-between px-3 py-3 text-left">
        <span className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</span>
        <FaChevronDown className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} size={11} />
      </button>
      {isOpen && <div className="border-t border-slate-100 p-3">{children}</div>}
    </section>
  );
}

function AttendanceMetricCard({ label, value, type, icon: Icon }) {
  const styles = getStatusStyle(type);
  return <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles.pill}`}><Icon size={14} /></div><div><p className="mb-1 text-[9px] font-bold uppercase leading-none tracking-widest text-gray-400">{label}</p><p className="text-lg font-black text-gray-900">{value}</p></div></div>;
}

function AttendanceDetailsModal({ cell, employee, shift, onClose, onEdit, onBreakEdit }) {
  const day = cell?.data || {};
  const status = getStatus(day) || "upcoming";
  const activities = day.activities || [];
  const breaks = day.breaks || [];
  const logs = day.logs || [];
  const [showAttendanceEvents, setShowAttendanceEvents] = useState(true);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const punchIn = activities.find((activity) => activity.type === "PUNCH_IN");
  const punchOut = activities.find((activity) => activity.type === "PUNCH_OUT");
  const statusStyle = getStatusStyle(status);
  const statusLabel = getStatusLabel(day, status);
  const Detail = ({ label, value }) => <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-800">{value || "--"}</p></div>;

  const isEditable = status !== "not_joined";

  return (
    <Modal isOpen={!!cell} onClose={onClose} title="Attendance Details" subtitle={`${employee?.name || "Employee"} | ${formatDate(cell.date)}`} icon={<FaInfoCircle className="text-indigo-600" />} size="2xl" footer={<div className="flex w-full justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-600">Close</button>{isEditable && <button type="button" onClick={onEdit} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white"><FaEdit /> Edit Attendance</button>}</div>}>
      <div className="space-y-5">
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${statusStyle.cell}`}>
          <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Day status</p><p className="mt-1 text-lg font-black text-slate-900">{statusLabel}</p></div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase ${statusStyle.pill}`}><span className={`h-2 w-2 rounded-full ${statusStyle.dot}`} />{statusLabel}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Detail label="Punch In" value={punchIn?.time} />
          <Detail label="Punch Out" value={punchOut?.time} />
          <Detail label="Worked" value={formatMinutes(getWorkMinutes(day))} />
          <Detail label="Approval" value={day.is_approved ? "Approved" : "Not approved"} />
        </div>

        {(day.is_leave || day.is_holiday) && <div className="grid gap-2 sm:grid-cols-2">{day.is_leave && <Detail label="Leave" value={`${day.is_leave.code || "Leave"}${day.is_leave.name ? ` - ${day.is_leave.name}` : ""}`} />}{day.is_holiday && <Detail label="Holiday" value={`${day.is_holiday.name || "Holiday"}${day.is_holiday.is_optional ? " (Optional)" : ""}`} />}</div>}

        {(day.half_day_type || day.leave_type || day.leave_code || day.leave_day_overtime !== null && day.leave_day_overtime !== undefined) && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {day.half_day_type && <Detail label="Half-day session" value={formatLabel(day.half_day_type)} />}
          {day.leave_type && <Detail label="Leave category" value={formatLabel(day.leave_type)} />}
          {day.leave_code && <Detail label="Leave code" value={day.leave_code} />}
          {day.leave_day_overtime !== null && day.leave_day_overtime !== undefined && <Detail label="Leave-day overtime" value={formatMinutes(day.leave_day_overtime)} />}
        </div>}

        {day.remark && <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Remark</p><p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-700">{day.remark}</p></div>}

        <section><div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Breaks</h3><button type="button" onClick={() => onBreakEdit(null)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-700 transition hover:bg-amber-100"><FaCoffee size={10} /> Add Break</button></div>{breaks.length > 0 ? <div className="space-y-2">{getBreakPairs(day).map((pair, index) => { const breakId = pair.start?.attendance_id || pair.end?.attendance_id; const duration = getBreakDurationMinutes(pair.start?.time, pair.end?.time); return <div key={`${breakId || 'break'}-${index}`} className="flex items-center justify-between gap-2 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2 text-xs"><span className="font-bold text-amber-800">Break {index + 1}</span><span className="font-black text-slate-700">{pair.start?.time || "--"} - {pair.end?.time || "Open"}</span><span className="min-w-[55px] text-center font-bold text-amber-700">{duration === null ? "Open" : `${duration} min`}</span><button type="button" onClick={() => onBreakEdit(breakId)} className="rounded-lg p-1.5 text-amber-700 transition hover:bg-amber-100" title={`Edit break ${index + 1}`}><FaEdit size={11} /></button></div>; })}</div> : <p className="rounded-xl border border-dashed border-amber-200 px-4 py-5 text-center text-xs font-medium text-amber-600">No break recorded for this day.</p>}</section>

        <CollapsibleEventSection title="Attendance events" isOpen={showAttendanceEvents} onToggle={() => setShowAttendanceEvents((open) => !open)}>{activities.length > 0 ? <div className="space-y-2">{activities.map((activity, index) => <div key={`${activity.type}-${index}`} className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-xs"><span className="font-bold text-emerald-800">{formatLabel(activity.type)}</span><span className="font-black text-slate-700">{activity.time || "--"}</span><span className="text-slate-500">{getActorLabel(activity.created_by)}</span></div>)}</div> : <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-xs font-medium text-slate-400">No attendance events recorded.</p>}</CollapsibleEventSection>

        <CollapsibleEventSection title="Activity log" isOpen={showActivityLog} onToggle={() => setShowActivityLog((open) => !open)}>{logs.length > 0 ? <div className="space-y-2">{logs.map((log, index) => <div key={`${log.log_type}-${index}`} className="rounded-xl border border-slate-100 bg-white px-3 py-2"><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-black text-slate-700">{formatLabel(log.log_type)}</span><span className="font-bold text-slate-500">{log.time || "--"}</span></div><p className="mt-1 text-[11px] text-slate-500">{getActorLabel(log.created_by)}{log.attendance_method ? ` | ${formatLabel(log.attendance_method)}` : ""}{log.day_status ? ` | ${formatLabel(log.day_status)}` : ""}</p></div>)}</div> : <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-xs font-medium text-slate-400">No activity log recorded.</p>}</CollapsibleEventSection>

        {day.verified_by && <Detail label="Verified by" value={getActorLabel(day.verified_by)} />}
        <p className="text-[11px] text-slate-400">Scheduled shift: {shift?.start_time || "--:--"} - {shift?.end_time || "--:--"}</p>
      </div>
    </Modal>
  );
}

function AttendanceEditor({ cell, employee, shift, onClose, onSaved }) {
  const day = cell?.data || {};
  const [mode, setMode] = useState(cell?.mode || "attendance");
  const [status, setStatus] = useState(["present", "half_day", "absent", "leave"].includes(getStatus(day)) ? getStatus(day) : "present");
  const [punchIn, setPunchIn] = useState(getActivityTime(day, "PUNCH_IN") || String(shift?.start_time || "09:00").slice(0, 5));
  const [punchOut, setPunchOut] = useState(getActivityTime(day, "PUNCH_OUT") || String(shift?.end_time || "18:00").slice(0, 5));
  const [halfDayType, setHalfDayType] = useState(day.half_day_type || "first_half");
  const [leaveType, setLeaveType] = useState(day.leave_type || "unpaid");
  const [leaveCode, setLeaveCode] = useState(day.leave_code || day.is_leave?.code || "");
  const [leaveOptions, setLeaveOptions] = useState([]);
  const [breakStart, setBreakStart] = useState(getBreakTime(day, "BREAK_START") || "13:00");
  const [breakEnd, setBreakEnd] = useState(getBreakTime(day, "BREAK_END") || "14:00");
  const [breakType, setBreakType] = useState(day.break_type || "lunch");
  const [notes, setNotes] = useState(day.remark || "");
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
        ? { employee_id: employee.id, date: formatDate(cell.date), type: "break", start_time: breakStart, end_time: breakEnd || null, break_type: breakType, notes, ...(day.attendance_id ? { attendance_id: day.attendance_id } : {}) }
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

const getCalendarEmployee = (employee, day, shift) => ({
  ...employee,
  id: employee?.id,
  employee_id: employee?.id,
  employee_code: employee?.employee_code || employee?.code || '',
  name: employee?.name || '',
  designation: employee?.designation || '',
  shift_start: shift?.start_time,
  shift_end: shift?.end_time,
  expected_work_minutes: shift?.expected_work_minutes,
  grace_minutes: shift?.grace_minutes,
  day_status: getStatus(day) || 'unmarked',
  attendance_id: day?.attendance_id,
  attendance_date: day?.attendance_date,
  half_day_session: day?.half_day_type,
  leave_type: day?.leave_type,
  leave_sub_type: day?.leave_code || day?.is_leave?.code,
  leave_day_overtime: day?.leave_day_overtime,
  punch_in_time: getActivityTime(day, 'PUNCH_IN'),
  punch_out_time: getActivityTime(day, 'PUNCH_OUT'),
  is_overtime: Boolean(day?.is_overtime),
  is_deductible: Boolean(day?.is_deductible),
  remark: day?.remark || '',
});

const getCalendarBreakRecord = (employee, cell) => {
  const day = cell?.data || {};
  const breakPairs = getBreakPairs(day);
  const selectedPair = breakPairs.find((pair) => String(pair.start?.attendance_id || pair.end?.attendance_id) === String(cell?.breakAttendanceId)) || breakPairs[0] || {};
  const start = selectedPair.start;
  const end = selectedPair.end;
  return {
    employee_id: employee?.id,
    name: employee?.name,
    employee_code: employee?.employee_code || employee?.code,
    designation: employee?.designation,
    profile_picture: employee?.profile_picture,
    attendance_id: start?.attendance_id || end?.attendance_id,
    attendance_date: formatDate(cell.date),
    break_start: start ? { time: start.time, method: start.method || start.attendance_method } : null,
    break_end: end ? { time: end.time, method: end.method || end.attendance_method } : null,
    remark: day.remark || '',
  };
};

function CalendarManagementModals({ cell, employee, shift, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const day = cell?.data || {};
  const modalEmployee = getCalendarEmployee(employee, day, shift);

  const saveAttendance = async (formPayload) => {
    setSaving(true);
    try {
      const payload = {
        employee_id: formPayload.employee_id,
        date: formatDate(cell.date),
        type: 'attendance',
        status: formPayload.status,
        notes: formPayload.notes || '',
      };
      if (['present', 'half_day'].includes(formPayload.status)) {
        payload.start_time = formPayload.punch_in;
        payload.end_time = formPayload.punch_out;
        payload.is_overtime = Boolean(formPayload.is_overtime);
        payload.is_deductible = Boolean(formPayload.is_deductible);
      }
      if (formPayload.status === 'half_day') payload.half_day_type = formPayload.half_day_session;
      if (formPayload.status === 'leave') {
        payload.leave_type = formPayload.leave_type;
        payload.leave_type_value = formPayload.leave_sub_type;
        payload.leave_day_overtime = formPayload.leave_day_overtime;
      }
      const response = await apiCall('/attendance/mark', 'POST', payload, getCompanyId());
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.message || 'Failed to save attendance');
      toast.success(result.message || 'Attendance updated successfully');
      onSaved();
    } catch (error) {
      toast.error(error.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const saveBreak = async (payload) => {
    setSaving(true);
    try {
      const response = await apiCall('/attendance/mark', 'POST', payload, getCompanyId());
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.message || 'Failed to save break');
      toast.success(result.message || 'Break updated successfully');
      onSaved();
    } catch (error) {
      toast.error(error.message || 'Failed to save break');
    } finally {
      setSaving(false);
    }
  };

  if (!cell) return null;
  if (cell.mode === 'break') {
    const breakRecord = getCalendarBreakRecord(employee, cell);
    const hasBreak = Boolean(breakRecord.break_start || breakRecord.break_end);
    return <BreakFormModal record={hasBreak ? breakRecord : null} initialEmployeeData={employee} initialDate={formatDate(cell.date)} isEdit={hasBreak} onClose={onClose} onSubmit={saveBreak} saving={saving} />;
  }
  return <ManageAttendanceModal employee={modalEmployee} initialStatus={modalEmployee.day_status === 'paid_leave' ? 'leave' : modalEmployee.day_status} isOpen onClose={onClose} onSave={saveAttendance} saving={saving} />;
}

export default function EmployeeAttendanceTab({ employee, fallbackId, refreshKey = 0 }) {
  const employeeId = employee?.id || fallbackId;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [detailsCell, setDetailsCell] = useState(null);
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
  const statistics = calendar?.statistics || {};
  const shift = calendar?.shift || {};

  return (
    <div className="max-w-screen-2xl pb-8">
      {/* Month navigation */}
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setCurrentDate((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-500">
            <FaChevronLeft size={11} />
          </button>
          <h2 className="min-w-[170px] text-center text-xl font-black text-gray-900">
            {currentDate.toLocaleString("default", { month: "long" })} {year}
          </h2>
          <button type="button" onClick={() => setCurrentDate((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-500">
            <FaChevronRight size={11} />
          </button>
          <AdvancedDateFilter value={{ month, year }} onChange={(value) => value.month && value.year && setCurrentDate(new Date(value.year, value.month - 1, 1))} tabOptions={["month"]} placeholder="Jump to month" buttonClassName="rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs font-bold text-gray-600" />
        </div>
      </div>

      {/* Shift info card */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <AttendanceMetricCard label="Shift In" value={shift.start_time || "--:--"} type="present" icon={FaCheckCircle} />
        <AttendanceMetricCard label="Shift Out" value={shift.end_time || "--:--"} type="present" icon={FaCheckCircle} />
        <AttendanceMetricCard label="Expected Work" value={formatMinutes(shift.expected_work_minutes)} type="present" icon={FaChartLine} />
        <AttendanceMetricCard label="Break" value={formatMinutes(shift.break_minutes)} type="holiday" icon={FaCoffee} />
      </div>

      {/* Attendance summary metrics */}
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
        {[
          ["Total", meta.total_days, "upcoming", FaCalendarAlt],
          ["Present", meta.present, "present", FaCheckCircle],
          ["Absent", meta.absent, "absent", FaTimesCircle],
          ["Leave", meta.leave, "leave", FaInfoCircle],
          ["Holiday", meta.holiday, "holiday", FaCalendarAlt],
          ["Weekend", meta.weekend, "weekend", FaCalendarAlt],
          ["Half Day", meta.half_day, "half_day", FaHourglassHalf],
          ["Not Joined", meta.not_joined, "not_joined", FaUserClock],
        ].map(([label, value, type, icon]) => (
          <AttendanceMetricCard key={label} label={label} value={value || 0} type={type} icon={icon} />
        ))}
      </div>

      {/* Worked, break, overtime */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          ["Worked", statistics?.worked_minutes, "present", FaCheckCircle],
          ["Break", statistics?.break_minutes, "holiday", FaCoffee],
          ["Overtime", statistics?.overtime_minutes, "half_day", FaChartLine],
        ].map(([label, value, type, icon]) => (
          <AttendanceMetricCard key={label} label={label} value={formatMinutes(value)} type={type} icon={icon} />
        ))}
      </div>

      {/* Calendar */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
            <FaSpinner className="animate-spin text-2xl text-indigo-600" />
          </div>
        )}
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-100">
          {error ? (
            <div className="col-span-7 flex flex-col items-center gap-3 bg-white py-20 text-rose-400">
              <FaTimesCircle size={32} />
              <p className="text-xs font-bold">{error}</p>
              <button
                type="button"
                onClick={() => {
                  lastRequest.current = "";
                  fetchCalendar();
                }}
                className="rounded-xl bg-rose-50 px-4 py-2 text-xs font-bold text-rose-600"
              >
                Retry
              </button>
            </div>
          ) : (
            cells.map((cell) => {
              const status = getStatus(cell.data) || "upcoming";
              const style = getStatusStyle(status);
              const isClickable = status !== "not_joined"; // not clickable for not_joined days

              if (!cell.isCurrentMonth) {
                return (
                  <div key={formatDate(cell.date)} className="min-h-[100px] bg-gray-50/30 p-2">
                    <span className="text-xs text-gray-200">{cell.dayNumber}</span>
                  </div>
                );
              }

              return (
                <button
                  type="button"
                  key={formatDate(cell.date)}
                  onClick={() => isClickable && setDetailsCell(cell)}
                  disabled={!isClickable}
                  className={`min-h-[100px] border-r border-b p-2 text-left ${style.cell} ${cell.isToday ? "ring-2 ring-inset ring-indigo-400" : ""} ${!isClickable ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                    {cell.dayNumber}
                  </span>
                  <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${style.pill}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                    {getStatusLabel(cell.data, status)}
                  </span>
                  {getWorkMinutes(cell.data) > 0 && (
                    <p className="mt-1 text-[10px] font-bold text-gray-700">
                      <FaCheckCircle className="mr-1 inline text-emerald-500" size={8} />
                      {formatMinutes(getWorkMinutes(cell.data))}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      {detailsCell && (
        <AttendanceDetailsModal
          cell={detailsCell}
          employee={employee}
          shift={shift}
          onClose={() => setDetailsCell(null)}
          onEdit={() => {
            setDetailsCell(null);
            setSelectedCell({ ...detailsCell, mode: "attendance" });
          }}
          onBreakEdit={(breakAttendanceId) => {
            setDetailsCell(null);
            setSelectedCell({ ...detailsCell, mode: "break", breakAttendanceId });
          }}
        />
      )}
      {selectedCell && (
        <CalendarManagementModals
          cell={selectedCell}
          employee={employee || { id: employeeId }}
          shift={shift}
          onClose={() => setSelectedCell(null)}
          onSaved={saveComplete}
        />
      )}
    </div>
  );
}