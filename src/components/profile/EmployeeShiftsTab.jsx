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
import { ManagementCard, ManagementTable } from "../common";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (typeof val === "string") return val.slice(0, 5);
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

// ─── Shift Detail Modal ───────────────────────────────────────────────────────

function ShiftDetailModal({ shift, onClose }) {
  if (!shift) return null;

  const dayStatus = shift.day_status || shift.status;
  const statusStyle = SHIFT_STATUS_STYLES[dayStatus] || SHIFT_STATUS_STYLES.upcoming;

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
      <div className="space-y-5">
        {/* Date + Status header */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Shift Date</p>
            <p className="text-lg font-black text-slate-800">{fmtDate(shift.shift_date || shift.date)}</p>
          </div>
          {dayStatus && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${statusStyle.pill}`}>
              <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
              {statusStyle.label || fmt(dayStatus)}
            </span>
          )}
        </div>

        {/* Shift Timing */}
        <div className="border-b border-gray-100 pb-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <FaExchangeAlt className="text-violet-500" /> Shift Timing
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          </div>
        </div>

        {/* Break & Deductions */}
        <div className="border-b border-gray-100 pb-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <FaHourglassHalf className="text-amber-500" /> Breaks & Deductions
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-center">
              <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-0.5">Allowed Break</p>
              <p className="text-sm font-black text-amber-700">{formatMins(shift.allowed_break_minutes)}</p>
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

        {/* Productivity Breakdown */}
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

        {/* Flags */}
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

// ─── Share Shift Schedule Modal ───────────────────────────────────────────────

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
      <form onSubmit={handleSubmit} className="space-y-4">
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

// ─── Main EmployeeShiftsTab Component ─────────────────────────────────────────

export default function EmployeeShiftsTab({ employee, employeeId, refreshKey = 0 }) {
  const targetEmployeeId = employee?.id || employeeId;
  const [rows, setRows] = useState([]);
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

  const fetchShifts = useCallback(async (page, limit) => {
    if (!targetEmployeeId) return;
    try {
      if (mountedRef.current) {
        setLoading(true);
        setError(null);
      }
      const companyId = getCompanyId();
      const response = await apiCall(
        `/employees/${targetEmployeeId}?include=shifts&page=${page}&limit=${limit}`,
        "GET",
        null,
        companyId
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Failed to load shifts");

      const rawShifts = data.data?.shifts ?? data.data ?? [];
      const shiftList = Array.isArray(rawShifts) ? rawShifts : [];
      const meta = data.meta?.shifts ?? data.meta ?? {};

      if (mountedRef.current) {
        setRows(shiftList);
        updatePagination({
          page: Number(meta.page ?? page),
          limit: Number(meta.limit ?? limit),
          total: Number(meta.total ?? shiftList.length),
          total_pages: Number(meta.total_pages ?? 1),
          is_last_page: meta.is_last_page ?? true,
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
  }, [targetEmployeeId, updatePagination]);

  useEffect(() => {
    fetchShifts(pagination.page, pagination.limit);
  }, [fetchShifts, pagination.page, pagination.limit, refreshKey]);

  const handleDownloadPdf = useCallback(async () => {
    if (!targetEmployeeId) return;
    setDownloadingPdf(true);
    try {
      const companyId = getCompanyId();
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const response = await apiCall(
        `/shifts/download?employee_id=${targetEmployeeId}&month=${month}&year=${year}`,
        "GET",
        null,
        companyId
      );
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/pdf") || contentType.includes("application/octet-stream")) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        window.open(blobUrl, "_blank", "noopener,noreferrer");
        return;
      }
      const result = await response.json();
      if (result?.success && result?.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
        return;
      }
      throw new Error(result?.message || "Failed to download shift PDF");
    } catch (err) {
      toast.error(err?.message || "Failed to download shift PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }, [targetEmployeeId]);

  const columns = [
    {
      key: "shift_date",
      label: "Shift Date",
      render: (s) => (
        <span className="font-semibold text-slate-800 text-sm">
          {fmtDate(s.shift_date || s.date)}
        </span>
      ),
    },
    {
      key: "timing",
      label: "Timing",
      render: (s) => (
        <span className="text-xs font-mono text-slate-600">
          {formatTimeValue(s.start_time)} - {formatTimeValue(s.end_time)}
        </span>
      ),
    },
    {
      key: "worked",
      label: "Worked",
      render: (s) => (
        <span className="text-sm font-medium text-slate-700">
          {formatMins(s.worked_minutes)}
        </span>
      ),
    },
    {
      key: "expected",
      label: "Expected",
      render: (s) => (
        <span className="text-xs font-medium text-slate-500">
          {formatMins(s.expected_work_minutes)}
        </span>
      ),
    },
    {
      key: "day_status",
      label: "Status",
      render: (s) => <ShiftStatusPill value={s.day_status || s.status} />,
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
      subtitle={`${formatTimeValue(s.start_time)} - ${formatTimeValue(s.end_time)}`}
      eyebrow="Shift Record"
      badge={<ShiftStatusPill value={s.day_status || s.status} />}
    >
      <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-slate-100">
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

      {/* Toolbar */}
      <div className="flex flex-wrap p-2 bg-white rounded-xl shadow-sm border border-gray-100 items-center justify-between gap-3">
        <p className="text-sm text-slate-800 px-3 font-bold flex items-center gap-2">
          <FaClock className="text-violet-600" />
          Shift Schedules & Records
        </p>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf || !targetEmployeeId}
            className="inline-flex whitespace-nowrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloadingPdf ? <FaSpinner className="animate-spin" size={11} /> : <FaFilePdf size={11} />}
            {downloadingPdf ? "Preparing PDF…" : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={() => setShowShareShiftModal(true)}
            disabled={!targetEmployeeId}
            className="inline-flex whitespace-nowrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-sm transition-all hover:bg-indigo-100"
          >
            <FaEnvelope size={11} /> Share Shift
          </button>
          {rows.length > 0 && (
            <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="violet" />
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
          <div className="w-7 h-7 border-2 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-xs font-bold tracking-wider uppercase text-slate-400">Loading shift records…</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && rows.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-3 text-violet-400">
            <FaClock size={20} />
          </div>
          <p className="text-sm font-bold text-slate-700">No shift records found</p>
          <p className="text-xs text-slate-400 mt-1">There are no shifts scheduled or logged for this employee.</p>
        </div>
      )}

      {/* Table View */}
      {!loading && rows.length > 0 && viewMode === "table" && (
        <ManagementTable
          rows={rows}
          columns={columns}
          rowKey="id"
          onRowClick={(shift) => setSelectedShift(shift)}
          activeId={activeMenu}
          onToggleAction={(e, id) => setActiveMenu((c) => (c === id ? null : id))}
          getActions={getActions}
          accent="violet"
        />
      )}

      {/* Card Grid View */}
      {!loading && rows.length > 0 && viewMode === "card" && (
        <ManagementGrid viewMode={viewMode}>
          {rows.map((row, idx) =>
            cardRenderer(row, idx, activeMenu, (e, id) => setActiveMenu((c) => (c === id ? null : id)))
          )}
        </ManagementGrid>
      )}

      {/* Pagination */}
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

      {/* Modals */}
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
            month={new Date().getMonth() + 1}
            year={new Date().getFullYear()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
