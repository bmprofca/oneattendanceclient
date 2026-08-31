import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FaClock, FaCalendarAlt, FaFilePdf, FaEnvelope, FaSpinner,
  FaEye, FaTimes, FaExchangeAlt, FaHourglassHalf, FaUserCheck,
  FaBriefcase, FaExclamationCircle, FaHourglassEnd, FaUmbrellaBeach,
  FaCheckCircle
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import apiCall from "../../utils/api";
import Modal from "../Modal";
import Pagination, { usePagination } from "../PaginationComponent";
import ManagementGrid from "../ManagementGrid";
import ManagementViewSwitcher from "../ManagementViewSwitcher";
import AdvancedDateFilter from "../AdvancedDateFilter";
import { ManagementCard, ManagementTable } from "../common";

const getCompanyId = () => {
  try {
    const company = localStorage.getItem("company");
    return company ? JSON.parse(company)?.id : null;
  } catch {
    return null;
  }
};

const fmt = (str) => {
  if (!str) return "—";
  return String(str)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(dateStr);
  }
};

const formatTimeValue = (val) => {
  if (!val) return "—";
  if (typeof val === "string" && val.includes(":")) {
    const parts = val.split(":");
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
    }
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return String(val);
};

const formatMins = (m) => {
  if (m === null || m === undefined) return "0m";
  const num = Number(m);
  if (!Number.isFinite(num)) return "0m";
  const hours = Math.floor(num / 60);
  const mins = num % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const SHIFT_STATUS_STYLES = {
  present: { pill: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", label: "Present" },
  absent: { pill: "bg-rose-100 text-rose-700 border-rose-200", dot: "bg-rose-500", label: "Absent" },
  holiday: { pill: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500", label: "Holiday" },
  weekend: { pill: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400", label: "Weekend" },
  leave: { pill: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500", label: "Leave" },
  half_day: { pill: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500", label: "Half Day" },
  upcoming: { pill: "bg-gray-100 text-gray-500 border-gray-200", dot: "bg-gray-300", label: "Upcoming" },
};

function ShiftStatusPill({ value }) {
  const key = String(value || "upcoming").toLowerCase();
  const style = SHIFT_STATUS_STYLES[key] || SHIFT_STATUS_STYLES.upcoming;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label || fmt(value)}
    </span>
  );
}

function ShiftDetailModal({ shift, onClose }) {
  if (!shift) return null;

  const dayStatus = shift.day_status || shift.status;
  const statusStyle = SHIFT_STATUS_STYLES[dayStatus] || SHIFT_STATUS_STYLES.upcoming;
  const allowedBreakMinutes = Number(shift.allowed_break_minutes ?? shift.break_minutes ?? 0);
  const graceMinutes = Number(shift.grace_minutes ?? 0);
  const leaveMeta = shift.is_leave || {};
  const holidayMeta = shift.is_holiday || {};
  const leaveType = shift.leave_type || leaveMeta.type || null;
  const leaveTypeValue = shift.leave_type_value || leaveMeta.name || null;
  const leaveCode = shift.leave_code || leaveMeta.code || null;
  const halfDayType = shift.half_day_type || leaveMeta.half_day_type || null;
  const leaveIsPaid = typeof shift.leave_is_paid === "boolean" ? shift.leave_is_paid : leaveMeta.is_paid;
  const holidayName = shift.holiday_name || holidayMeta.name || null;

  const formatHalfDayLabel = (value) => {
    if (!value) return "—";
    return String(value)
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <Modal
      isOpen={!!shift}
      onClose={onClose}
      title="Shift Record Details"
      subtitle={`Detailed information for shift on ${fmtDate(shift.shift_date || shift.date)}`}
      icon={<FaClock className="text-violet-600" />}
      size="3xl"
      footer={
        <div className="flex w-full justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="min-w-0 space-y-5 max-h-[80vh] overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Shift Date</p>
            <p className="break-words text-lg font-black text-slate-800">{fmtDate(shift.shift_date || shift.date)}</p>
            {(shift.is_holiday?.name || shift.is_leave?.name) && (
              <p className="mt-1 break-words text-xs font-semibold text-slate-500">
                {shift.is_holiday?.name || shift.is_leave?.name}
              </p>
            )}
          </div>
          {dayStatus && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${statusStyle.pill}`}>
              <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
              {statusStyle.label || fmt(dayStatus)}
            </span>
          )}
        </div>

        <div className="border-b border-gray-100 pb-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <FaExchangeAlt className="text-violet-500" /> Shift Timing
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
              <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Start Time</p>
              <p className="text-sm font-black text-emerald-700">{formatTimeValue(shift.start_time)}</p>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-center">
              <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mb-1">End Time</p>
              <p className="text-sm font-black text-rose-700">{formatTimeValue(shift.end_time)}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-center">
              <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-1">Expected</p>
              <p className="text-sm font-black text-blue-700">{formatMins(shift.expected_work_minutes)}</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
              <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Worked</p>
              <p className="text-sm font-black text-indigo-700">{formatMins(shift.worked_minutes)}</p>
            </div>
            <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 text-center">
              <p className="text-[9px] font-bold text-sky-500 uppercase tracking-widest mb-1">Grace</p>
              <p className="text-sm font-black text-sky-700">{formatMins(graceMinutes)}</p>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-100 pb-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <FaHourglassHalf className="text-amber-500" /> Breaks & Deductions
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-center">
              <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-0.5">Allowed Break</p>
              <p className="text-sm font-black text-amber-700">{formatMins(allowedBreakMinutes)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-100 text-center">
              <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest mb-0.5">Extra Break</p>
              <p className="text-sm font-black text-orange-700">{formatMins(shift.extra_break_minutes)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-center">
              <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mb-0.5">Deductible</p>
              <p className="text-sm font-black text-rose-700">{formatMins(shift.deductible_minutes)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-center">
              <p className="text-[9px] font-bold text-purple-500 uppercase tracking-widest mb-0.5">Overtime</p>
              <p className="text-sm font-black text-purple-700">{formatMins(shift.overtime_minutes)}</p>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-100 pb-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <FaUserCheck className="text-emerald-500" /> Productivity
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Late</p>
              <p className={`text-sm font-black ${shift.late_minutes > 0 ? "text-rose-600" : "text-slate-400"}`}>
                {formatMins(shift.late_minutes)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Early Leave</p>
              <p className={`text-sm font-black ${shift.early_leave_minutes > 0 ? "text-amber-600" : "text-slate-400"}`}>
                {formatMins(shift.early_leave_minutes)}
              </p>
            </div>
          </div>
        </div>

        {(dayStatus === "leave" || dayStatus === "half_day" || holidayName) && (
          <div className="border-b border-gray-100 pb-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
              <FaBriefcase className="text-indigo-500" /> Leave & Half-Day Details
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {leaveTypeValue && (
                <div className="p-2.5 rounded-xl bg-violet-50 border border-violet-100 text-center">
                  <p className="text-[9px] font-bold text-violet-500 uppercase tracking-widest mb-0.5">Leave Type</p>
                  <p className="text-sm font-black text-violet-700">{leaveTypeValue}</p>
                </div>
              )}
              {leaveCode && (
                <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100 text-center">
                  <p className="text-[9px] font-bold text-sky-500 uppercase tracking-widest mb-0.5">Leave Code</p>
                  <p className="text-sm font-black text-sky-700">{leaveCode}</p>
                </div>
              )}
              {halfDayType && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-center">
                  <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-0.5">Half Day</p>
                  <p className="text-sm font-black text-amber-700">{formatHalfDayLabel(halfDayType)}</p>
                </div>
              )}
              {typeof leaveIsPaid === "boolean" && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                  <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">Paid</p>
                  <p className="text-sm font-black text-emerald-700">{leaveIsPaid ? "Yes" : "No"}</p>
                </div>
              )}
              {holidayName && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-center sm:col-span-2">
                  <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-0.5">Holiday</p>
                  <p className="text-sm font-black text-amber-700">{holidayName}</p>
                </div>
              )}
              {leaveType && !leaveTypeValue && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Type</p>
                  <p className="text-sm font-black text-slate-700">{fmt(leaveType)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <FaBriefcase className="text-indigo-500" /> Status Flags
          </h3>
          <div className="flex flex-wrap gap-3">
            <div className={`flex items-center gap-2 rounded-xl border p-3 ${shift.overtime_minutes > 0 ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-slate-50 opacity-60"}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${shift.overtime_minutes > 0 ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                <FaClock size={14} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Overtime</p>
                <p className={`text-xs font-bold ${shift.overtime_minutes > 0 ? "text-emerald-700" : "text-slate-500"}`}>
                  {shift.overtime_minutes > 0 ? `${shift.overtime_minutes} mins` : "None"}
                </p>
              </div>
            </div>
            <div className={`flex items-center gap-2 rounded-xl border p-3 ${shift.is_deductible ? "border-rose-200 bg-rose-50" : "border-slate-100 bg-slate-50 opacity-60"}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${shift.is_deductible ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                <FaExclamationCircle size={14} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Deductible</p>
                <p className={`text-xs font-bold ${shift.is_deductible ? "text-rose-700" : "text-slate-500"}`}>
                  {shift.is_deductible ? "Yes" : "No"}
                </p>
              </div>
            </div>
            {dayStatus === "half_day" && (
              <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-500 text-white">
                  <FaHourglassEnd size={14} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Half Day</p>
                  <p className="text-xs font-bold text-orange-700">{fmt(shift.half_day_type) || "Yes"}</p>
                </div>
              </div>
            )}
            {dayStatus === "leave" && (
              <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500 text-white">
                  <FaUmbrellaBeach size={14} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Leave Type</p>
                  <p className="text-xs font-bold text-violet-700">{shift.leave_type_value || fmt(shift.leave_type) || "Leave"}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ShareShiftModal({ isOpen, onClose, employeeId, employeeEmail, month, year, onSuccess }) {
  const [targetEmail, setTargetEmail] = useState(employeeEmail || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (employeeEmail) setTargetEmail(employeeEmail);
  }, [employeeEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetEmail.trim()) {
      toast.warning("Please enter a valid recipient email.");
      return;
    }
    setSubmitting(true);
    try {
      const companyId = getCompanyId();
      const response = await apiCall(
        "/shifts/send-email",
        "POST",
        {
          employee_id: employeeId,
          month,
          year,
          email: targetEmail.trim(),
        },
        companyId
      );
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to send shift email");
      toast.success(result.message || "Shift schedule emailed successfully");
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to send shift email");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Shift Schedule"
      subtitle="Send monthly shift schedule via email"
      icon={<FaEnvelope className="text-indigo-600" />}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
          >
            {submitting ? <FaSpinner className="animate-spin" size={12} /> : <FaEnvelope size={12} />}
            {submitting ? "Sending..." : "Send Email"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Recipient Email
          </label>
          <input
            type="email"
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="Enter email address"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none text-sm font-semibold text-slate-800"
            required
          />
        </div>
      </form>
    </Modal>
  );
}

export default function EmployeeShiftsTab({ employee, employeeId, refreshKey = 0 }) {
  const targetEmployeeId = employee?.id || employeeId;
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [rows, setRows] = useState([]);
  const [shiftMeta, setShiftMeta] = useState({});
  const [monthlyStats, setMonthlyStats] = useState({});
  const [monthlyCounts, setMonthlyCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("table");
  const [activeMenu, setActiveMenu] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [showShareShiftModal, setShowShareShiftModal] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 10);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchShifts = useCallback(async () => {
    if (!targetEmployeeId) return;
    try {
      if (mountedRef.current) {
        setLoading(true);
        setError(null);
      }
      const companyId = getCompanyId();
      const month = Number(selectedMonth) || 1;
      const year = Number(selectedYear) || new Date().getFullYear();
      const response = await apiCall(
        `/shifts/employee-shifts/${targetEmployeeId}?month=${month}&year=${year}`,
        "GET",
        null,
        companyId
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Failed to load shifts");

      const shiftSummary = data.data?.shift || {};
      const days = data.data?.days || {};
      const stats = data.data?.statistics || {};
      const counts = data.data?.counts || {};
      const defaultExpectedMinutes =
        shiftSummary.expected_work_minutes ??
        data.data?.employee?.expected_work_minutes ??
        0;

      const shiftList = Object.entries(days).map(([shiftDate, day]) => ({
        id: shiftDate,
        shift_date: shiftDate,
        day_status: day.day_status,
        start_time: shiftSummary.shift_start_time || day.shift?.start_time || null,
        end_time: shiftSummary.shift_end_time || day.shift?.end_time || null,
        worked_minutes: Number(day.shift?.worked_minutes || 0),
        overtime_minutes: Number(day.shift?.overtime_minutes || 0),
        extra_break_minutes: Number(day.shift?.extra_break_minutes || 0),
        early_leave_minutes: Number(day.shift?.early_leave_minutes || 0),
        late_minutes: Number(day.shift?.late_minutes || 0),
        deductible_minutes: Number(day.shift?.deductible_minutes || 0),
        allowed_break_minutes: Number(shiftSummary.allowed_break_minutes ?? day.shift?.allowed_break_minutes ?? 0),
        grace_minutes: Number(shiftSummary.grace_minutes ?? day.shift?.grace_minutes ?? 0),
        expected_work_minutes: defaultExpectedMinutes,
        is_holiday: day.is_holiday,
        is_leave: day.is_leave,
        half_day_type: day.half_day_type || day.is_leave?.half_day_type || null,
        leave_type: day.leave_type || day.is_leave?.type || null,
        leave_type_value: day.leave_type_value || day.is_leave?.name || null,
        leave_code: day.leave_code || day.is_leave?.code || null,
        leave_is_paid: typeof day.is_leave?.is_paid === "boolean" ? day.is_leave.is_paid : null,
        holiday_name: day.is_holiday?.name || null,
      }));

      if (mountedRef.current) {
        setShiftMeta(shiftSummary);
        setMonthlyStats(stats);
        setMonthlyCounts(counts);
        setRows(shiftList);
        updatePagination({
          page: 1,
          limit: shiftList.length || 1,
          total: shiftList.length,
          total_pages: 1,
          is_last_page: true,
        });
      }
    } catch (err) {
      if (mountedRef.current) {
        setRows([]);
        setError(err.message || "Failed to load shift records");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [targetEmployeeId, selectedMonth, selectedYear, updatePagination]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts, refreshKey]);

  const handleDownloadPdf = useCallback(async () => {
    if (!targetEmployeeId) return;
    setDownloadingPdf(true);
    try {
      const companyId = getCompanyId();
      const month = Number(selectedMonth) || 1;
      const year = Number(selectedYear) || new Date().getFullYear();
      const response = await apiCall(
        "/shifts/download",
        "POST",
        { employee_id: targetEmployeeId, month, year },
        companyId
      );

      if (!response.ok) {
        let errorMessage = "Failed to generate shift PDF";
        try {
          const errorResult = await response.json();
          errorMessage = errorResult?.message || errorMessage;
        } catch {
          // Ignore JSON parse errors.
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type") || "";
      const result = contentType.includes("application/json") ? await response.json() : null;
      const fileUrl = result?.url || result?.file_url || result?.data?.url || result?.data?.file_url;

      if (result?.success && fileUrl) {
        window.open(fileUrl, "_blank", "noopener,noreferrer");
        toast.success(result.message || "Shift schedule downloaded successfully");
        return;
      }

      if (contentType.includes("application/pdf") || contentType.includes("application/octet-stream")) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        window.open(blobUrl, "_blank", "noopener,noreferrer");
        return;
      }

      if (result) {
        throw new Error(result?.message || "Failed to download shift PDF");
      }

      throw new Error("Failed to download shift PDF");
    } catch (err) {
      toast.error(err?.message || "Failed to download shift PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }, [targetEmployeeId, selectedMonth, selectedYear]);

  const statusCountEntries = [
    { key: "present", label: "Present" },
    { key: "absent", label: "Absent" },
    { key: "leave", label: "Leave" },
    { key: "holiday", label: "Holiday" },
    { key: "weekend", label: "Weekend" },
    { key: "half_day", label: "Half Day" },
    { key: "not_joined", label: "Not Joined" },
    { key: "upcoming", label: "Upcoming" },
  ];

  const statsCards = [
    { label: "Expected", value: formatMins(monthlyStats.expected_work_minutes ?? shiftMeta.expected_work_minutes ?? 0) },
    { label: "Worked", value: formatMins(monthlyStats.worked_minutes ?? 0) },
    { label: "Overtime", value: formatMins(monthlyStats.overtime_minutes ?? 0) },
    { label: "Late", value: formatMins(monthlyStats.late_minutes ?? 0) },
    { label: "Early Leave", value: formatMins(monthlyStats.early_leave_minutes ?? 0) },
    { label: "Break", value: formatMins(monthlyStats.break_minutes ?? shiftMeta.allowed_break_minutes ?? 0) },
  ];

  const columns = [
    {
      key: "shift_date",
      label: "Date",
      render: (s) => (
        <span className="font-semibold text-slate-800 text-sm">
          {fmtDate(s.shift_date || s.date)}
        </span>
      ),
    },
    {
      key: "day_status",
      label: "Status",
      render: (s) => <ShiftStatusPill value={s.day_status || s.status} />,
    },
    {
      key: "expected_work_minutes",
      label: "Expected",
      render: (s) => (
        <span className="text-xs font-medium text-slate-500">
          {formatMins(s.expected_work_minutes)}
        </span>
      ),
    },
    {
      key: "worked_minutes",
      label: "Worked",
      render: (s) => (
        <span className="text-sm font-medium text-slate-700">
          {formatMins(s.worked_minutes)}
        </span>
      ),
    },
    {
      key: "overtime_minutes",
      label: "Overtime",
      render: (s) => (
        <span className="text-sm font-medium text-violet-700">
          {formatMins(s.overtime_minutes)}
        </span>
      ),
    },
    {
      key: "deductible_minutes",
      label: "Deductible",
      render: (s) => (
        <span className="text-sm font-medium text-rose-700">
          {formatMins(s.deductible_minutes)}
        </span>
      ),
    },
  ];

  const getActions = (shift) => [
    {
      label: "View Details",
      icon: <FaEye size={12} />,
      onClick: () => setSelectedShift(shift),
      className: "text-blue-600 hover:bg-blue-50",
    },
  ];

  const cardRenderer = (s, index, activeId, onToggle) => (
    <ManagementCard
      key={s.id || s.shift_date || index}
      accent="violet"
      delay={index * 0.03}
      onClick={() => setSelectedShift(s)}
      activeId={activeId}
      onToggle={onToggle}
      menuId={`shift-${s.id || index}`}
      actions={getActions(s)}
      hoverable
      title={fmtDate(s.shift_date || s.date)}
      subtitle={
        s.start_time || s.end_time
          ? `${formatTimeValue(s.start_time)} - ${formatTimeValue(s.end_time)}`
          : "Shift summary"
      }
      eyebrow="Shift Record"
      badge={<ShiftStatusPill value={s.day_status || s.status} />}
    >
      {(s.is_holiday?.name || s.is_leave?.name) && (
        <p
          className="mt-2 truncate border-t border-slate-100 pt-2 text-[11px] font-semibold text-slate-500"
          title={s.is_holiday?.name || s.is_leave?.name}
        >
          {s.is_holiday?.name || s.is_leave?.name}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-slate-100 pt-2 text-xs text-gray-500">
        <span>Worked: {formatMins(s.worked_minutes)}</span>
        <span>Expected: {formatMins(s.expected_work_minutes)}</span>
      </div>
    </ManagementCard>
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">
          ⚠ {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <FaClock size={14} />
          </div>
          <p className="truncate text-sm font-bold text-slate-800 sm:text-base">Shift Schedules & Records</p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
          <AdvancedDateFilter
            value={{ month: selectedMonth, year: selectedYear }}
            onChange={(value) => {
              if (value?.month && value?.year) {
                setSelectedMonth(Number(value.month));
                setSelectedYear(Number(value.year));
              }
            }}
            tabOptions={["month"]}
            placeholder={`${new Date(selectedYear, selectedMonth - 1, 1).toLocaleString("en-US", { month: "long" })} ${selectedYear}`}
            buttonClassName="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-100"
          />

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf || !targetEmployeeId}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloadingPdf ? <FaSpinner className="animate-spin" size={10} /> : <FaFilePdf size={10} />}
            {downloadingPdf ? "Preparing…" : "Download PDF"}
          </button>

          <button
            type="button"
            onClick={() => setShowShareShiftModal(true)}
            disabled={!targetEmployeeId}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] font-bold text-indigo-700 shadow-sm transition-all hover:bg-indigo-100 disabled:opacity-60"
          >
            <FaEnvelope size={10} /> Share Shift
          </button>

          {rows.length > 0 && (
            <div className="ml-1">
              <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="violet" />
            </div>
          )}
        </div>
      </div>

{!loading && Object.keys(shiftMeta).length > 0 && (
  <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs">
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr_1fr] gap-3">

      {/* Shift Overview - Enhanced Spacing & Hierarchy */}
      <div className="flex flex-col justify-between rounded-xl border border-violet-200/60 bg-gradient-to-b from-violet-50/80 via-violet-50/30 to-white p-3.5 shadow-2xs">
        <div>
          <div className="flex items-center justify-between border-b border-violet-100 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-600"></span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-800">
                Shift Schedule
              </span>
            </div>
            <span className="rounded-full bg-violet-100/80 px-2 py-0.5 text-[9px] font-semibold text-violet-700 border border-violet-200/50">
              Standard
            </span>
          </div>

          <div className="py-1">
            <p className="text-[11px] font-medium text-slate-500 mb-0.5">Working Hours</p>
            <p className="text-lg font-black tracking-tight text-slate-900 whitespace-nowrap">
              {formatTimeValue(shiftMeta.shift_start_time)}
              <span className="mx-1.5 text-violet-400 font-normal">–</span>
              {formatTimeValue(shiftMeta.shift_end_time)}
            </p>
          </div>
        </div>

        {/* Metas/Allowances Grid */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-1.5 text-[10px]">
          <div className="rounded-lg bg-slate-50/80 p-1.5 text-center border border-slate-200/60">
            <span className="block text-[8px] font-semibold text-slate-400 uppercase tracking-wide">Expected</span>
            <span className="font-extrabold text-slate-800 text-[11px]">{formatMins(shiftMeta.expected_work_minutes)}</span>
          </div>

          <div className="rounded-lg bg-slate-50/80 p-1.5 text-center border border-slate-200/60">
            <span className="block text-[8px] font-semibold text-slate-400 uppercase tracking-wide">Break</span>
            <span className="font-extrabold text-slate-800 text-[11px]">{formatMins(shiftMeta.allowed_break_minutes)}</span>
          </div>

          <div className="rounded-lg bg-slate-50/80 p-1.5 text-center border border-slate-200/60">
            <span className="block text-[8px] font-semibold text-slate-400 uppercase tracking-wide">Grace</span>
            <span className="font-extrabold text-slate-800 text-[11px]">{formatMins(shiftMeta.grace_minutes)}</span>
          </div>
        </div>
      </div>

      {/* Monthly Statistics (3 cols x 2 rows) */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          Monthly Statistics
        </p>

        <div className="grid grid-cols-3 gap-2 h-full">
          {statsCards.map((card) => {
            const colorMap = {
              Expected: "border-sky-200/60 bg-sky-50/60 text-sky-900",
              Worked: "border-emerald-200/60 bg-emerald-50/60 text-emerald-900",
              Overtime: "border-violet-200/60 bg-violet-50/60 text-violet-900",
              Late: "border-rose-200/60 bg-rose-50/60 text-rose-900",
              "Early Leave": "border-amber-200/60 bg-amber-50/60 text-amber-900",
              Break: "border-slate-200/60 bg-slate-100/70 text-slate-800",
            };

            const colorClasses =
              colorMap[card.label] ||
              "border-slate-200 bg-white text-slate-800";

            return (
              <div
                key={card.label}
                className={`flex flex-col justify-center rounded-lg border p-2 transition-all hover:scale-[1.02] ${colorClasses}`}
              >
                <p className="text-[8px] font-semibold uppercase tracking-wider opacity-75 truncate">
                  {card.label}
                </p>
                <p className="text-xs font-black tracking-tight truncate mt-0.5">
                  {card.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Counts */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          Day Counts
        </p>

        <div className="grid grid-cols-4 gap-1.5 h-full">
          {statusCountEntries.map(({ key, label }) => {
            const colorMap = {
              present: "border-emerald-200/60 bg-emerald-50/60 text-emerald-900",
              absent: "border-rose-200/60 bg-rose-50/60 text-rose-900",
              leave: "border-violet-200/60 bg-violet-50/60 text-violet-900",
              holiday: "border-amber-200/60 bg-amber-50/60 text-amber-900",
              weekend: "border-slate-200/60 bg-slate-100/70 text-slate-700",
              half_day: "border-orange-200/60 bg-orange-50/60 text-orange-900",
              not_joined: "border-slate-200/50 bg-slate-100/40 text-slate-500",
              upcoming: "border-slate-200/50 bg-slate-100/40 text-slate-500",
            };

            const colorClasses =
              colorMap[key] ||
              "border-slate-200/50 bg-slate-100/40 text-slate-500";

            return (
              <div
                key={key}
                className={`flex flex-col justify-center rounded-lg border p-1.5 transition-all hover:scale-[1.02] ${colorClasses}`}
              >
                <p className="text-[8px] font-semibold uppercase tracking-wider opacity-75 truncate">
                  {label}
                </p>
                <p className="text-xs font-black tracking-tight truncate mt-0.5">
                  {Number(monthlyCounts[key] || 0)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  </div>
)}

      {loading && (
        <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
          <div className="w-7 h-7 border-2 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-xs font-bold tracking-wider uppercase text-slate-400">Loading shift records…</span>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-3 text-violet-400">
            <FaClock size={20} />
          </div>
          <p className="text-sm font-bold text-slate-700">No shift records found</p>
          <p className="text-xs text-slate-400 mt-1">There are no shifts scheduled or logged for this employee.</p>
        </div>
      )}

      {!loading && rows.length > 0 && viewMode === "table" && (
        <div className="overflow-x-auto">
          <ManagementTable
            rows={rows}
            columns={columns}
            rowKey="id"
            onRowClick={(shift) => setSelectedShift(shift)}
            activeId={activeMenu}
            onToggleAction={(e, id) => setActiveMenu((c) => (c === id ? null : id))}
            getActions={getActions}
            accent="violet"
            tableClassName="min-w-[640px] w-full"
            cellClassName="whitespace-nowrap"
          />
        </div>
      )}

      {!loading && rows.length > 0 && viewMode === "card" && (
        <ManagementGrid viewMode={viewMode}>
          {rows.map((row, idx) =>
            cardRenderer(row, idx, activeMenu, (e, id) => setActiveMenu((c) => (c === id ? null : id)))
          )}
        </ManagementGrid>
      )}

      {!loading && rows.length > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={goToPage}
          onLimitChange={changeLimit}
          className="mt-2"
        />
      )}

      <AnimatePresence>
        {selectedShift && (
          <ShiftDetailModal shift={selectedShift} onClose={() => setSelectedShift(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShareShiftModal && (
          <ShareShiftModal
            isOpen={showShareShiftModal}
            onClose={() => setShowShareShiftModal(false)}
            employeeId={targetEmployeeId}
            employeeEmail={employee?.email || rows[0]?.email || ""}
            month={selectedMonth}
            year={selectedYear}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
