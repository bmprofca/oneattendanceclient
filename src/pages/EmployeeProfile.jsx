import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaChevronDown, FaHistory, FaEye, FaShieldAlt,
  FaClock, FaMoneyBillWave, FaCalendarAlt, FaExchangeAlt,
  FaEnvelope, FaIdCard, FaCheckCircle, FaTimesCircle,
  FaTimes, FaCalculator, FaPhone,
  FaChartBar, FaHandPaper, FaCalendarPlus, FaCalendarCheck,
  FaTag, FaBriefcase, FaMapMarkerAlt, FaNetworkWired,
  FaArrowDown, FaArrowUp, FaUmbrellaBeach, FaChevronRight,
  FaUser, FaUserCheck, FaHourglassEnd, FaExclamationCircle,
  FaComment, FaCog, FaMapPin, FaServer, FaInfoCircle,
  FaSpinner, FaSignInAlt, FaSignOutAlt, FaHourglassHalf,
  FaChevronLeft, FaFilePdf, FaPlus, FaSave,
  FaDownload, FaEdit, FaTrash, FaUniversity, FaCircle,
  FaCoffee, FaCoins
} from "react-icons/fa";
import apiCall from "../utils/api";
import { toast } from "react-toastify";
import Pagination, { usePagination } from "../components/PaginationComponent";
import ManagementGrid from "../components/ManagementGrid";
import ManagementViewSwitcher from "../components/ManagementViewSwitcher";
import { ManagementCard, ManagementTable, RefreshButton } from "../components/common";
import Modal from "../components/Modal";
import ModalScrollLock from "../components/ModalScrollLock";
import AttendanceLogsModal from "../components/AttendanceLogsModal";
import AttendanceTypeTabs, { getAttendanceTypeConfig } from "../components/AttendanceTypeTabs";
import ProfileAvatar from "../components/common/ProfileAvatar";
import AdvancedDateFilter from "../components/AdvancedDateFilter";
import CategoryPermissionSelector from "../components/common/CategoryPermissionSelector";
import SelectField from "../components/SelectField";
import TimePickerField from "../components/TimePicker";
import { ManageAttendanceModal } from "./UnmarkedAttendance";
import CompanyLedger from "./CompanyLedger";
import SkeletonComponent from "../components/SkeletonComponent";
import { AssignSalaryModal, EditSalaryModal, ReviseSalaryModal, DeleteConfirmModal } from "../pages/SalaryManagement";
import EmployeeBankAccountsTab from "../components/EmployeeBankAccountsTab";
import EmployeeBreaksTab from "../components/profile/EmployeeBreaksTab";
import EmployeePayrollAdjustmentsTab from "../components/profile/EmployeePayrollAdjustmentsTab";
import EmployeeLeaveBalancesTab from "../components/profile/EmployeeLeaveBalancesTab";
import EmployeeLeaveRequestsTab from "../components/profile/EmployeeLeaveRequestsTab";

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: "attendance", label: "Attendance", icon: <FaClock size={12} /> },
  { key: "permissions", label: "Permissions", icon: <FaShieldAlt size={12} /> },
  { key: "salary", label: "Salary", icon: <FaMoneyBillWave size={12} /> },
  { key: "payroll", label: "Payroll", icon: <FaCalendarAlt size={12} /> },
  { key: "shifts", label: "Shifts", icon: <FaExchangeAlt size={12} /> },
  { key: "leaves", label: "Leaves", icon: <FaUmbrellaBeach size={12} /> },
  { key: "ledger", label: "Ledger", icon: <FaChartBar size={12} /> },
  { key: "accounts", label: "Accounts", icon: <FaUniversity size={12} /> },
];
const PROFILE_TAB_IDS = new Set(TABS.map((tab) => tab.key));
const DEFAULT_PROFILE_TAB = "attendance";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const getEnumValue = (value) => {
  if (value && typeof value === "object") return value.label || value.value || "";
  return value;
};

const fmt = (value) => {
  const str = getEnumValue(value);
  return str ? String(str).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtMonthYear = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—";

const fmtDateTime = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const formatDays = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
};

const getCurrentMonthDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
};

const getInitials = (name) => {
  const normalizedName = String(getEnumValue(name) || "");
  return normalizedName.trim().split(" ").filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 2).join("") || "?";
};

const AVATAR_GRADIENTS = [
  "from-blue-500 to-indigo-600", "from-purple-500 to-pink-600",
  "from-green-500 to-teal-600", "from-orange-500 to-amber-500",
  "from-rose-500 to-red-600", "from-cyan-500 to-blue-500",
];
const avatarGradient = (id) => AVATAR_GRADIENTS[(id || 0) % AVATAR_GRADIENTS.length];
const PAGE_ACCENT = "from-green-600 to-emerald-600";
const inFlightRequests = new Map();

async function runDedupedRequest(key, requestFn) {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }
  const promise = Promise.resolve()
    .then(requestFn)
    .finally(() => { inFlightRequests.delete(key); });
  inFlightRequests.set(key, promise);
  return promise;
}

const triggerFileDownload = (url, filename) => {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const downloadBlob = (blob, filename) => {
  const downloadUrl = URL.createObjectURL(blob);
  triggerFileDownload(downloadUrl, filename);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
};

// ─── CALENDAR HELPERS (new API structure) ─────────────────────────────────────

function parseTime(timeStr) {
  if (!timeStr) return null;
  const normalizedTime = String(timeStr).trim();
  const match = normalizedTime.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return null;
  let [, h, m, period] = match;
  h = parseInt(h, 10);
  m = parseInt(m, 10);
  if (period) {
    if (period.toUpperCase() === "PM" && h !== 12) h += 12;
    if (period.toUpperCase() === "AM" && h === 12) h = 0;
  }
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function formatTimeValue(value) {
  if (!value) return "—";
  const minutes = parseTime(value);
  return minutes == null ? String(value) : minutesToTimeStr(minutes);
}

function diffTimeMinutes(start, end) {
  const startMinutes = parseTime(start);
  const endMinutes = parseTime(end);
  if (startMinutes == null || endMinutes == null) return 0;
  const difference = endMinutes - startMinutes;
  return difference >= 0 ? difference : difference + 24 * 60;
}
function normalizeAttendanceRecord(record) {
  const breaks = Array.isArray(record.breaks) ? record.breaks : [];
  const breakMinutes = breaks.reduce(
    (total, item) => total + diffTimeMinutes(item.start_time, item.end_time),
    0
  );
  const grossMinutes = diffTimeMinutes(record.start_time, record.end_time);
  const workedMinutes = Math.max(0, grossMinutes - breakMinutes);
  const overtimeMinutes = Number(record.flags?.overtime?.minutes || 0);
  const deductibleMinutes = Number(record.flags?.deductible?.minutes || 0);

  return {
    ...record,
    worked_minutes: record.worked_minutes ?? workedMinutes,
    break_minutes: record.break_minutes ?? breakMinutes,
    overtime_minutes: record.overtime_minutes ?? overtimeMinutes,
    deductible_minutes: record.deductible_minutes ?? deductibleMinutes,
    is_overtime: Boolean(record.is_overtime || record.flags?.overtime?.enabled),
    is_half_day: Boolean(record.is_half_day || record.flags?.half_day?.enabled),
  };
}

function minutesToTimeStr(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, "0")} ${period}`;
}

function formatMinutes(mins) {
  if (mins == null || mins < 0) return "0h 0m";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}

function computeWorkStats(dayData) {
  if (!dayData) return null;

  const activities = dayData.activities || [];
  const breaks = dayData.breaks || [];

  const punches = [];
  let tempIn = null;
  for (const act of activities) {
    if (act.type === "PUNCH_IN") {
      tempIn = act;
    } else if (act.type === "PUNCH_OUT" && tempIn) {
      punches.push({ in: tempIn, out: act });
      tempIn = null;
    }
  }
  if (tempIn) {
    punches.push({ in: tempIn, out: null });
  }

  let totalWork = 0;
  let firstIn = null;
  let lastOut = null;

  punches.forEach(({ in: pin, out: pout }) => {
    const inTime = pin?.time ? parseTime(pin.time) : null;
    const outTime = pout?.time ? parseTime(pout.time) : null;

    if (inTime != null) {
      if (firstIn == null || inTime < firstIn) firstIn = inTime;
    }
    if (inTime != null && outTime != null) {
      let diff = outTime - inTime;
      if (diff < 0) diff += 24 * 60;
      totalWork += diff;
      if (lastOut == null || outTime > lastOut) lastOut = outTime;
    }
  });

  let totalBreak = 0;
  let breakStart = null;
  for (const b of breaks) {
    if (b.type === "BREAK_START") {
      breakStart = b;
    } else if (b.type === "BREAK_END" && breakStart) {
      const s = breakStart?.time ? parseTime(breakStart.time) : null;
      const e = b?.time ? parseTime(b.time) : null;
      if (s != null && e != null) {
        let diff = e - s;
        if (diff < 0) diff += 24 * 60;
        totalBreak += diff;
      }
      breakStart = null;
    }
  }

  const netWork = Math.max(0, totalWork - totalBreak);
  return {
    workedMinutes: netWork,
    breakMinutes: totalBreak,
    grossMinutes: totalWork,
    firstIn: firstIn != null ? minutesToTimeStr(firstIn) : null,
    lastOut: lastOut != null ? minutesToTimeStr(lastOut) : null,
    hasOpenSession: punches.some((p) => p.out === null),
    sessions: punches,
  };
}

function formatDay(day) {
  return parseFloat(day).toString();
}

function getDayStatus(dayData) {
  if (!dayData) return null;
  const s = dayData.day_status;
  if (dayData.is_holiday && (!s || s === "upcoming" || s === "")) return "holiday";
  if (dayData.is_leave) return "leave";
  if (s === "") return "present";
  return s || null;
}

// ─── CALENDAR CONSTANTS ───────────────────────────────────────────────────────

const CALENDAR_STATUS_STYLES = {
  present: {
    cell: "bg-emerald-50/60 border-emerald-100",
    pill: "bg-emerald-100 text-emerald-700 border-emerald-200",
    label: "Present", dot: "bg-emerald-500", color: "text-emerald-600",
  },
  absent: {
    cell: "bg-rose-50/60 border-rose-100",
    pill: "bg-rose-100 text-rose-700 border-rose-200",
    label: "Absent", dot: "bg-rose-500", color: "text-rose-600",
  },
  holiday: {
    cell: "bg-amber-50/60 border-amber-100",
    pill: "bg-amber-100 text-amber-700 border-amber-200",
    label: "Holiday", dot: "bg-amber-500", color: "text-amber-600",
  },
  weekend: {
    cell: "bg-slate-50/60 border-slate-100",
    pill: "bg-slate-100 text-slate-600 border-slate-200",
    label: "Weekend", dot: "bg-slate-400", color: "text-slate-500",
  },
  leave: {
    cell: "bg-violet-50/60 border-violet-100",
    pill: "bg-violet-100 text-violet-700 border-violet-200",
    label: "Leave", dot: "bg-violet-500", color: "text-violet-600",
  },
  upcoming: {
    cell: "bg-white border-gray-100",
    pill: "bg-gray-100 text-gray-500 border-gray-200",
    label: "Upcoming", dot: "bg-gray-300", color: "text-gray-400",
  },
  half_day: {
    cell: "bg-orange-50/60 border-orange-100",
    pill: "bg-orange-100 text-orange-700 border-orange-200",
    label: "Half Day", dot: "bg-orange-500", color: "text-orange-600",
  },
  not_joined: {
    cell: "bg-slate-50/30 border-slate-100 opacity-50",
    pill: "bg-slate-100 text-slate-500 border-slate-200",
    label: "Not Joined", dot: "bg-slate-300", color: "text-slate-400",
  },
};

// ─── CALENDAR CELL ────────────────────────────────────────────────────────────

const CalendarCell = ({ cell, onClick }) => {
  const { dayNumber, isCurrentMonth, data, isToday } = cell;

  if (!isCurrentMonth) {
    return (
      <div className="min-h-[100px] bg-gray-50/20 p-2 border-r border-b border-gray-100/70">
        <span className="text-xs text-gray-200 font-medium">{dayNumber}</span>
      </div>
    );
  }

  const status = getDayStatus(data);
  const styles = CALENDAR_STATUS_STYLES[status] || CALENDAR_STATUS_STYLES.upcoming;
  const workStats = data ? computeWorkStats(data) : null;

  return (
    <motion.div
      whileHover={{ scale: 1.015, zIndex: 10 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onClick={() => data?.day_status !== "not_joined" && onClick(cell)}
      className={`
        min-h-[100px] p-2.5 transition-all border-r border-b cursor-pointer
        ${styles.cell}
        ${isToday ? "ring-2 ring-indigo-400 ring-inset z-10" : ""}
      `}
    >
      <div className="flex items-start justify-between mb-1.5">
        <span className={`
          flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold
          ${isToday ? "bg-indigo-600 text-white shadow-sm" : "text-gray-700"}
        `}>
          {dayNumber}
        </span>
        {data?.is_holiday && (
          <span title={data.is_holiday.name} className="text-amber-400">
            <FaUmbrellaBeach size={10} />
          </span>
        )}
      </div>

      {status && (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${styles.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
          {styles.label}
        </span>
      )}

      {workStats && workStats.workedMinutes > 0 && (
        <div className="mt-1.5">
          <p className="text-[10px] font-bold text-gray-700 flex items-center gap-1">
            <FaClock size={7} className="text-gray-400" />
            {formatMinutes(workStats.workedMinutes)}
          </p>
          {workStats.hasOpenSession && (
            <p className="text-[9px] text-indigo-500 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
              Live
            </p>
          )}
        </div>
      )}

      {data?.is_leave && (
        <p className="mt-1 text-[9px] font-bold text-violet-700 truncate">
          {data.is_leave.code} • {data.is_leave.type?.replace("_", " ")}
        </p>
      )}

      {data?.is_holiday && status === "holiday" && (
        <p className="mt-1 text-[9px] text-amber-700 font-medium line-clamp-2">
          {data.is_holiday.name}
        </p>
      )}

      {data?.is_approved === false && status === "present" && (
        <p className="mt-1 text-[8px] font-bold text-orange-500 uppercase tracking-wider">Pending</p>
      )}
    </motion.div>
  );
};

// ─── CALENDAR SUMMARY CARD ────────────────────────────────────────────────────

const CalendarSummaryCard = ({ label, value, icon: Icon, type }) => {
  const styles = CALENDAR_STATUS_STYLES[type] || CALENDAR_STATUS_STYLES.upcoming;
  return (
    <div className="p-3.5 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center gap-3 hover:shadow-md transition-all hover:-translate-y-0.5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${styles.pill}`}>
        <Icon size={14} />
      </div>
      <div>
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
        <p className="text-lg font-black text-gray-900">{value}</p>
      </div>
    </div>
  );
};

// ─── CALENDAR EMPLOYEE BANNER ─────────────────────────────────────────────────

const CalendarEmployeeInfo = ({ employee, shift, statistics }) => {
  if (!employee) return null;

  const pct = statistics?.expected_work_minutes > 0
    ? Math.min(100, Math.round((statistics.worked_minutes / statistics.expected_work_minutes) * 100))
    : 0;

  const workedH = statistics ? Math.floor(statistics.worked_minutes / 60) : 0;
  const workedM = statistics ? Math.round(statistics.worked_minutes % 60) : 0;

  return (
    <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 rounded-2xl p-5 text-white shadow-xl shadow-indigo-200/60 mb-5 relative overflow-hidden">
      <div className="absolute -right-8 -top-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -left-8 -bottom-8 w-36 h-36 bg-violet-400/20 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <ProfileAvatar
            record={employee}
            name={employee.employee_name || employee.name}
            className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-xl font-black border border-white/30 overflow-hidden"
          >
            {(employee.employee_name || employee.name)?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || <FaUser size={20} />}
          </ProfileAvatar>
          <div>
            <h2 className="text-xl font-black tracking-tight">{employee.employee_name || employee.name || "Attendance Calendar"}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1 opacity-90">
              {(employee.employee_code || employee.code) && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-lg">
                  <FaIdCard size={10} /> {employee.employee_code || employee.code}
                </span>
              )}
              {employee.designation && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-lg">
                  <FaBriefcase size={10} /> {fmt(employee.designation)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t md:border-t-0 md:border-l border-white/20 pt-4 md:pt-0 md:pl-6">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-200 flex items-center gap-1 mb-0.5">
              <FaSignInAlt size={9} /> Shift In
            </p>
            <p className="text-base font-black">{shift?.start_time || "--:--"}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-200 flex items-center gap-1 mb-0.5">
              <FaSignOutAlt size={9} /> Shift Out
            </p>
            <p className="text-base font-black">{shift?.end_time || "--:--"}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-200 flex items-center gap-1 mb-0.5">
              <FaClock size={9} /> Target
            </p>
            <p className="text-base font-black">
              {shift ? `${Math.floor(shift.expected_work_minutes / 60)}h ${shift.expected_work_minutes % 60}m` : "--"}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-200 flex items-center gap-1 mb-0.5">
              <FaCheckCircle size={9} /> Worked
            </p>
            <p className="text-base font-black">{`${workedH}h ${workedM}m`}</p>
          </div>
        </div>
      </div>

      {statistics && (
        <div className="relative z-10 mt-4">
          <div className="flex justify-between text-[9px] font-bold text-indigo-200 uppercase tracking-widest mb-1">
            <span>Monthly Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── CALENDAR DAY DETAILS MODAL ───────────────────────────────────────────────

const CalendarDayDetailsModal = ({ cell, employeeId, onClose, shift, onManage, onViewLogs }) => {
  const { date, data } = cell;
  const status = getDayStatus(data);
  const workStats = data ? computeWorkStats(data) : null;

  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // ── Helper components ─────────────────────────────────────────────────────
  const InfoRow = ({ label, value, icon: Icon, colorClass }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
      <div className="flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorClass}`}>
          <Icon size={12} />
        </div>
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-sm font-black text-gray-800">{value || "—"}</span>
    </div>
  );

  // ── Build timeline events (punches + breaks) in chronological order ──────
  const buildTimeline = () => {
    const events = [];
    const pushEvent = (e) => {
      if (!e?.time) return;
      events.push({
        ...e,
        time: e.time,
        type: e.type,
        sortTime: parseTime(e.time) ?? 0,
      });
    };

    (data?.activities || []).forEach(pushEvent);
    (data?.breaks || []).forEach(pushEvent);

    // Sort by time (if two events same time, keep original order)
    events.sort((a, b) => a.sortTime - b.sortTime || a.originalIndex - b.originalIndex);
    return events;
  };

  const timelineEvents = buildTimeline();

  // Pair breaks for display in the timeline
  const breakPairs = [];
  let breakIn = null;
  for (const b of data?.breaks || []) {
    if (b.type === "BREAK_START") {
      breakIn = b;
    } else if (b.type === "BREAK_END" && breakIn) {
      breakPairs.push({ start: breakIn, end: b });
      breakIn = null;
    }
  }
  if (breakIn) breakPairs.push({ start: breakIn, end: null });

  const attendanceId = data?.id || data?.attendance_id;
  const hasWorkData = workStats && (workStats.grossMinutes > 0 || (data?.activities || []).length > 0);
  const hasBreakData = (data?.breaks || []).length > 0;
  const logs = data?.logs || [];
  const hasLogData = logs.length > 0;

  // State for showing all logs vs. summary
  const [showAllLogs, setShowAllLogs] = useState(false);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <ModalScrollLock />
      <motion.div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">{formattedDate}</p>
            {status && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${CALENDAR_STATUS_STYLES[status]?.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${CALENDAR_STATUS_STYLES[status]?.dot}`} />
                {CALENDAR_STATUS_STYLES[status]?.label}
              </span>
            )}
            {data?.is_holiday && (
              <p className="text-xs font-bold text-amber-600 mt-1">
                {data.is_holiday.name} {data.is_holiday.is_optional ? "(Optional)" : "(Public Holiday)"}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-xl transition-all"
          >
            <FaTimesCircle size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Approval / status flags */}
          {(data?.is_approved === false || data?.is_overtime || data?.is_deductible) && (
            <div className="flex flex-wrap gap-2">
              {data?.is_approved === false && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                  <FaInfoCircle size={10} /> Pending Approval
                </span>
              )}
              {data?.is_approved === true && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                  <FaCheckCircle size={10} /> Approved
                </span>
              )}
              {data?.is_overtime && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                  <FaClock size={10} /> Overtime
                </span>
              )}
              {data?.is_deductible && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                  <FaExclamationCircle size={10} /> Deductible
                </span>
              )}
            </div>
          )}

          {/* Work Summary (if any) */}
          {hasWorkData && (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Work Summary</p>
              <div className="grid grid-cols-2 gap-2">
                <InfoRow label="Total Work" value={formatMinutes(workStats.workedMinutes)} icon={FaClock} colorClass="bg-emerald-100 text-emerald-600" />
                <InfoRow label="Break" value={formatMinutes(workStats.breakMinutes)} icon={FaHourglassHalf} colorClass="bg-amber-100 text-amber-600" />
                <InfoRow label="First In" value={workStats.firstIn || "—"} icon={FaSignInAlt} colorClass="bg-indigo-100 text-indigo-600" />
                <InfoRow
                  label="Last Out"
                  value={workStats.lastOut || (workStats.hasOpenSession ? "Active" : "—")}
                  icon={FaSignOutAlt}
                  colorClass="bg-slate-100 text-slate-600"
                />
              </div>
              {shift && (
                <InfoRow
                  label="Expected"
                  value={formatMinutes(shift.expected_work_minutes - (shift.break_minutes || 0))}
                  icon={FaClock}
                  colorClass="bg-gray-100 text-gray-500"
                />
              )}
            </div>
          )}

          {/* Timeline (punches + breaks) */}
          {timelineEvents.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Timeline</p>
              <div className="space-y-1.5">
                {timelineEvents.map((event, idx) => {
                  const isPunchIn = event.type === "PUNCH_IN";
                  const isPunchOut = event.type === "PUNCH_OUT";
                  const isBreakStart = event.type === "BREAK_START";
                  const isBreakEnd = event.type === "BREAK_END";
                  const isDayStatus = event.type === "day_status";

                  let icon = <FaCircle size={8} className="text-gray-300" />;
                  let colorClass = "bg-slate-50 border-slate-100 text-slate-600";
                  let label = event.type;

                  if (isPunchIn) {
                    icon = <FaSignInAlt size={10} className="text-emerald-500" />;
                    colorClass = "bg-emerald-50 border-emerald-100 text-emerald-700";
                    label = "Punch In";
                  } else if (isPunchOut) {
                    icon = <FaSignOutAlt size={10} className="text-rose-500" />;
                    colorClass = "bg-rose-50 border-rose-100 text-rose-700";
                    label = "Punch Out";
                  } else if (isBreakStart) {
                    icon = <FaCoffee size={10} className="text-amber-500" />;
                    colorClass = "bg-amber-50 border-amber-100 text-amber-700";
                    label = "Break Start";
                  } else if (isBreakEnd) {
                    icon = <FaCoffee size={10} className="text-teal-500" />;
                    colorClass = "bg-teal-50 border-teal-100 text-teal-700";
                    label = "Break End";
                  } else if (isDayStatus) {
                    icon = <FaTag size={10} className="text-indigo-500" />;
                    colorClass = "bg-indigo-50 border-indigo-100 text-indigo-700";
                    label = "Status";
                  }

                  return (
                    <div key={idx} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${colorClass}`}>
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white shadow-sm">{icon}</span>
                      <span className="font-bold uppercase tracking-wider text-[10px]">{label}</span>
                      <span className="flex-1 text-right font-mono font-semibold">{event.time || "—"}</span>
                      {event.attendance_method && (
                        <span className="text-[9px] uppercase font-bold opacity-70">[{event.attendance_method}]</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Leave info */}
          {data?.is_leave && (
            <div className="p-4 bg-violet-50 rounded-xl border border-violet-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center mb-3">
                <FaInfoCircle size={20} />
              </div>
              <h4 className="text-base font-black text-violet-900">{data.is_leave.name}</h4>
              <p className="text-xs font-bold text-violet-500 uppercase tracking-widest mt-0.5">
                {data.is_leave.code} • {data.is_leave.type?.replace("_", " ")}
              </p>
            </div>
          )}

          {/* Raw Logs (collapsible) */}
          {hasLogData && (
            <div>
              <button
                type="button"
                onClick={() => setShowAllLogs(!showAllLogs)}
                className="w-full flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
              >
                <span className="flex items-center gap-2">
                  <FaHistory size={11} className="text-indigo-500" />
                  Raw Log Entries ({logs.length})
                </span>
                <FaChevronDown size={10} className={`transition-transform ${showAllLogs ? "rotate-180" : ""}`} />
              </button>

              {showAllLogs && (
                <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {logs.map((log, i) => (
                    <div key={i} className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-xs flex items-center justify-between">
                      <span className="font-bold text-slate-700">{log.log_type || "LOG"}</span>
                      <span className="font-mono text-gray-500">{log.time || "—"}</span>
                      {log.attendance_method && (
                        <span className="text-[9px] uppercase text-gray-400">[{log.attendance_method}]</span>
                      )}
                      {log.created_by?.name && (
                        <span className="text-[9px] text-gray-400">by {log.created_by.name}</span>
                      )}
                      {log.day_status && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold">
                          → {String(log.day_status).replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!hasWorkData && !data?.is_leave && !data?.is_holiday &&
            (status === "absent" || status === "upcoming" || status === "not_joined") && (
              <div className="py-8 flex flex-col items-center text-center text-gray-300">
                <FaCalendarAlt size={36} className="mb-2 opacity-30" />
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {status === "not_joined" ? "Not yet joined"
                    : status === "absent" ? "No attendance recorded"
                      : "Upcoming day"}
                </p>
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 bg-gray-50/80 px-5 py-4 flex gap-2">
          {attendanceId && (
            <button
              type="button"
              onClick={() => onViewLogs?.(attendanceId)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-indigo-700 hover:bg-indigo-100 transition"
            >
              <FaHistory size={11} /> View Audit Log
            </button>
          )}
          <button
            type="button"
            onClick={() => onManage?.(cell)}
            disabled={status === "not_joined"}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-200 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FaCalendarCheck size={12} /> Manage Attendance
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const getCalendarActivityTime = (activities, type) => {
  const activity = (activities || []).find((item) => item.type === type);
  return activity?.time ? String(activity.time).slice(0, 5) : "";
};

const formatCalendarDate = (date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
);

const getCalendarEmployeeRecord = (employee, shift, cell) => {
  const data = cell?.data || {};
  const status = getDayStatus(data);
  const activityTime = (type) => (data.activities || []).find((item) => item.type === type)?.time || "";
  return {
    ...employee,
    employee_id: employee?.id,
    attendance_date: formatCalendarDate(cell.date),
    day_status: status || "unmarked",
    half_day_session: data.half_day_type || "first_half",
    leave_type: data.is_leave?.type || "",
    leave_sub_type: data.is_leave?.code || "",
    punch_in_time: activityTime("PUNCH_IN"),
    punch_out_time: activityTime("PUNCH_OUT"),
    shift_start: shift?.start_time || employee?.shift_start,
    shift_end: shift?.end_time || employee?.shift_end,
    expected_work_minutes: shift?.expected_work_minutes || employee?.expected_work_minutes,
    grace_minutes: shift?.grace_minutes || employee?.grace_minutes,
  };
};

function CalendarAttendanceModal({ cell, employee, shift, onClose, onSaved }) {
  const data = cell?.data;
  const existingStatus = getDayStatus(data);
  const initialStatus = ["present", "half_day", "absent", "leave"].includes(existingStatus) ? existingStatus : "present";
  const shiftStart = shift?.start_time || employee?.shift_start || "09:00:00";
  const shiftEnd = shift?.end_time || employee?.shift_end || "18:00:00";
  const [status, setStatus] = useState(initialStatus);
  const [halfDayType, setHalfDayType] = useState(data?.half_day_type || "first_half");
  const [leaveType, setLeaveType] = useState(data?.is_leave?.type === "paid" ? "paid" : "unpaid");
  const [leaveCode, setLeaveCode] = useState(data?.is_leave?.code || "");
  const [leaveOptions, setLeaveOptions] = useState([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [startTime, setStartTime] = useState(getCalendarActivityTime(data?.activities, "PUNCH_IN") || String(shiftStart).slice(0, 5));
  const [endTime, setEndTime] = useState(getCalendarActivityTime(data?.activities, "PUNCH_OUT") || String(shiftEnd).slice(0, 5));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status !== "leave") return undefined;
    let mounted = true;
    setLeaveLoading(true);
    const company = localStorage.getItem("company");
    const companyId = company ? JSON.parse(company)?.id : null;
    apiCall(`/leave/company?is_paid=${leaveType === "paid"}`, "GET", null, companyId)
      .then((response) => response.json())
      .then((result) => {
        if (mounted && result.success) setLeaveOptions((result.data || []).map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` })));
      })
      .catch(() => { if (mounted) setLeaveOptions([]); })
      .finally(() => { if (mounted) setLeaveLoading(false); });
    return () => { mounted = false; };
  }, [leaveType, status]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (status === "leave" && !leaveCode) {
      toast.error("Leave code is required");
      return;
    }
    const company = localStorage.getItem("company");
    const companyId = company ? JSON.parse(company)?.id : null;
    setSaving(true);
    try {
      const payload = {
        employee_id: employee?.id,
        date: formatCalendarDate(cell.date),
        type: "attendance",
        status,
        notes,
        ...(status === "present" || status === "half_day" ? { start_time: startTime, end_time: endTime } : {}),
        ...(status === "half_day" ? { half_day_type: halfDayType } : {}),
        ...(status === "leave" ? { leave_type: leaveType, leave_type_value: leaveCode } : {}),
        is_overtime: false,
        is_deductible: false,
      };
      const response = await apiCall("/attendance/mark", "POST", payload, companyId);
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.message || "Failed to update attendance");
      toast.success(result.message || "Attendance updated successfully");
      onSaved();
    } catch (error) {
      toast.error(error.message || "Failed to update attendance");
    } finally {
      setSaving(false);
    }
  };

  if (!cell) return null;
  return (
    <Modal
      isOpen={!!cell}
      onClose={onClose}
      title="Manage Attendance"
      subtitle={`${employee?.name || "Employee"} | ${cell.date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
      icon={<FaCalendarCheck className="text-blue-600" />}
      size="2xl"
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="submit" form="calendar-attendance-form" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-200 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <FaSpinner className="animate-spin" /> : <FaSave />} Save Attendance
          </button>
        </>
      )}
    >
      <form id="calendar-attendance-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[{ value: "present", label: "Present", icon: FaCheckCircle }, { value: "half_day", label: "Half Day", icon: FaHourglassHalf }, { value: "absent", label: "Absent", icon: FaTimesCircle }, { value: "leave", label: "Leave", icon: FaUmbrellaBeach }].map((option) => {
            const Icon = option.icon;
            return <button key={option.value} type="button" onClick={() => setStatus(option.value)} className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-bold transition ${status === option.value ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}><Icon size={12} /> {option.label}</button>;
          })}
        </div>

        {(status === "present" || status === "half_day") && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TimePickerField label="Punch In" value={startTime} onChange={setStartTime} initialValue={shiftStart} required />
            <TimePickerField label="Punch Out" value={endTime} onChange={setEndTime} initialValue={shiftEnd} required />
          </div>
        )}

        {status === "half_day" && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Half Day Session</p>
            <div className="grid grid-cols-2 gap-3">
              {[{ value: "first_half", label: "First Half" }, { value: "second_half", label: "Second Half" }].map((option) => <button key={option.value} type="button" onClick={() => setHalfDayType(option.value)} className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${halfDayType === option.value ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{option.label}</button>)}
            </div>
          </div>
        )}

        {status === "leave" && (
          <div className="space-y-4 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Paid Leave</span>
              <button type="button" onClick={() => { setLeaveType((value) => value === "paid" ? "unpaid" : "paid"); setLeaveCode(""); }} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${leaveType === "paid" ? "bg-indigo-600" : "bg-slate-300"}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${leaveType === "paid" ? "translate-x-6" : "translate-x-1"}`} /></button>
            </div>
            <SelectField value={leaveOptions.find((option) => option.value === leaveCode) || null} onChange={(option) => setLeaveCode(option?.value || "")} options={leaveOptions} isLoading={leaveLoading} placeholder="Select leave code" isClearable menuPortalTarget={document.body} />
          </div>
        )}

        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Add a remark" className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" />
      </form>
    </Modal>
  );
}

function ProfileLeaveActionModal({ leave, action, onClose, onSubmit, submitting }) {
  const [startDate, setStartDate] = useState(leave?.start_date ? String(leave.start_date).slice(0, 10) : "");
  const [endDate, setEndDate] = useState(leave?.end_date ? String(leave.end_date).slice(0, 10) : "");
  const [isHalfDay, setIsHalfDay] = useState(Boolean(leave?.is_half_day));
  const [halfDayType, setHalfDayType] = useState(leave?.half_day_type || "first_half");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (!leave) return;
    setStartDate(leave.start_date ? String(leave.start_date).slice(0, 10) : "");
    setEndDate(leave.end_date ? String(leave.end_date).slice(0, 10) : "");
    setIsHalfDay(Boolean(leave.is_half_day));
    setHalfDayType(leave.half_day_type || "first_half");
    setRemarks("");
  }, [leave]);

  if (!leave) return null;
  const isApprove = action === "approve";

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!remarks.trim() && !isApprove) {
      toast.error("Rejection reason is required");
      return;
    }
    if (isApprove && (!startDate || !endDate || endDate < startDate)) {
      toast.error("Valid leave dates are required");
      return;
    }
    if (isApprove && isHalfDay && startDate !== endDate) {
      toast.error("Half day leave must be for one date");
      return;
    }
    onSubmit({
      id: leave.id,
      start_date: startDate,
      end_date: endDate,
      is_half_day: isHalfDay,
      half_day_type: halfDayType,
      remarks: remarks.trim(),
    });
  };

  return (
    <Modal
      isOpen={!!leave}
      onClose={onClose}
      title={isApprove ? "Approve / Edit Leave" : "Reject Leave"}
      subtitle={`${leave.leave_name || leave.leave_type || "Leave"} | ${fmtDate(leave.start_date)}`}
      icon={isApprove ? <FaCheckCircle className="text-emerald-600" /> : <FaTimesCircle className="text-rose-600" />}
      size="lg"
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="submit" form="profile-leave-action-form" disabled={submitting} className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${isApprove ? "bg-gradient-to-r from-emerald-600 to-green-600 shadow-emerald-200 hover:from-emerald-700 hover:to-green-700" : "bg-gradient-to-r from-rose-600 to-red-600 shadow-rose-200 hover:from-rose-700 hover:to-red-700"}`}>
            {submitting ? <FaSpinner className="animate-spin" /> : isApprove ? <FaCheck /> : <FaTimes />}
            {isApprove ? "Confirm Approve" : "Reject Leave"}
          </button>
        </>
      )}
    >
      <form id="profile-leave-action-form" onSubmit={handleSubmit} className="space-y-5">
        {isApprove ? (
          <>
            <p className="text-gray-600 text-sm leading-relaxed">Approve this leave request. You can adjust the date range or convert it to a half-day before approving.</p>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Leave Date Range</label>
              <AdvancedDateFilter
                value={{
                  date: startDate && startDate === endDate ? startDate : "",
                  from_date: startDate && startDate !== endDate ? startDate : "",
                  to_date: endDate && startDate !== endDate ? endDate : "",
                }}
                onChange={(result) => {
                  const nextStart = result?.date || result?.from_date || "";
                  const nextEnd = result?.date || result?.to_date || nextStart;
                  setStartDate(nextStart);
                  setEndDate(nextEnd);
                }}
                tabOptions={["date", "range"]}
                placeholder="Select leave date range"
                buttonClassName="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Half Day</p><p className="mt-1 text-xs text-slate-400">Convert this request to a half-day leave.</p></div>
                <button type="button" onClick={() => setIsHalfDay((value) => !value)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isHalfDay ? "bg-emerald-600" : "bg-slate-300"}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isHalfDay ? "translate-x-6" : "translate-x-1"}`} /></button>
              </div>
              {isHalfDay && <div className="mt-4 grid grid-cols-2 gap-3">{[{ value: "first_half", label: "First Half" }, { value: "second_half", label: "Second Half" }].map((option) => <button key={option.value} type="button" onClick={() => setHalfDayType(option.value)} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${halfDayType === option.value ? "border-emerald-200 bg-white text-emerald-700 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{option.label}</button>)}</div>}
            </div>
          </>
        ) : null}
        <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={4} placeholder={isApprove ? "Approval remarks (optional)" : "Rejection reason (required)"} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" />
      </form>
    </Modal>
  );
}

// ─── EMPLOYEE ATTENDANCE CALENDAR ─────────────────────────────────────────────

function EmployeeAttendanceCalendar({ employee, fallbackId, refreshKey = 0 }) {
  const employeeId = employee?.id || fallbackId;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [manageCell, setManageCell] = useState(null);
  const [logModal, setLogModal] = useState(null);
  const [savingCalendarAttendance, setSavingCalendarAttendance] = useState(false);
  const lastFetchedKeyRef = useRef(null);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const fetchCalendar = useCallback(async (m, y) => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const companyStr = localStorage.getItem("company");
      const companyId = companyStr ? JSON.parse(companyStr)?.id : null;
      const response = await apiCall(
        `/shifts/my-calendar?employee_id=${employeeId}&month=${m}&year=${y}`,
        "GET", null, companyId
      );
      const json = await response.json();
      if (json.success) {
        setData({ ...json.data, meta: json.meta });
      } else {
        setError(json.message || "Failed to fetch calendar");
        toast.error(json.message || "Failed to fetch calendar");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      toast.error("Could not connect to the server");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    const fetchKey = `${employeeId}-${month}-${year}-${refreshKey}`;
    if (lastFetchedKeyRef.current === fetchKey) return;
    lastFetchedKeyRef.current = fetchKey;
    fetchCalendar(month, year);
  }, [employeeId, fetchCalendar, month, year, refreshKey]);

  const navigateMonth = (dir) => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();
    const today = new Date();
    const grid = [];

    for (let i = 0; i < 42; i++) {
      let dateObj;
      let isCurrentMonth = true;

      if (i < firstDay) {
        dateObj = new Date(year, month - 2, prevMonthDays - (firstDay - i - 1));
        isCurrentMonth = false;
      } else if (i >= firstDay + daysInMonth) {
        dateObj = new Date(year, month, i - (firstDay + daysInMonth) + 1);
        isCurrentMonth = false;
      } else {
        dateObj = new Date(year, month - 1, i - firstDay + 1);
      }

      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
      grid.push({
        date: dateObj,
        dayNumber: dateObj.getDate(),
        isCurrentMonth,
        data: data?.days?.[dateStr] || null,
        isToday: today.toDateString() === dateObj.toDateString(),
      });
    }
    return grid;
  }, [data, month, year]);

  const meta = data?.meta || {};
  const shift = data?.shift || null;
  const statistics = data?.statistics || null;
  const manageEmployee = manageCell ? getCalendarEmployeeRecord(employee, shift, manageCell) : null;

  // ─── MANAGE ATTENDANCE & BREAK MODAL ───────────────────────────────────────────

  const ManageAttendanceAndBreakModal = ({ employee, initialStatus, isOpen, onClose, onSave, saving = false }) => {
    const [activeTab, setActiveTab] = useState("attendance");

    const [status, setStatus] = useState(initialStatus || "present");
    const [punchIn, setPunchIn] = useState(employee?.punch_in_time ? String(employee.punch_in_time).slice(0, 5) : "09:00");
    const [punchOut, setPunchOut] = useState(employee?.punch_out_time ? String(employee.punch_out_time).slice(0, 5) : "18:00");
    const [halfDaySession, setHalfDaySession] = useState(employee?.half_day_session || "first_half");
    const [leaveType, setLeaveType] = useState(employee?.leave_type || "unpaid");
    const [leaveCode, setLeaveCode] = useState(employee?.leave_sub_type || "");
    const [notes, setNotes] = useState(employee?.remark || "");

    const [breakStart, setBreakStart] = useState("13:00");
    const [breakEnd, setBreakEnd] = useState("14:00");
    const [breakType, setBreakType] = useState("lunch");
    const [breakNotes, setBreakNotes] = useState("");

    useEffect(() => {
      if (employee) {
        setStatus(initialStatus || "present");
        setPunchIn(employee.punch_in_time ? String(employee.punch_in_time).slice(0, 5) : "09:00");
        setPunchOut(employee.punch_out_time ? String(employee.punch_out_time).slice(0, 5) : "18:00");
        setHalfDaySession(employee.half_day_session || "first_half");
        setLeaveType(employee.leave_type || "unpaid");
        setLeaveCode(employee.leave_sub_type || "");
        setNotes(employee.remark || "");
      }
    }, [employee, initialStatus]);

    if (!isOpen || !employee) return null;

    const handleSaveAttendance = () => {
      if ((status === "present" || status === "half_day") && (!punchIn || !punchOut)) {
        toast.error("Punch in and punch out times are required");
        return;
      }
      onSave({
        mode: "attendance",
        employee_id: employee.employee_id,
        status,
        punch_in: punchIn,
        punch_out: punchOut,
        half_day_session: status === "half_day" ? halfDaySession : "",
        leave_type: status === "leave" ? leaveType : "",
        leave_sub_type: status === "leave" ? leaveCode : "",
        notes,
      });
    };

    const handleSaveBreak = () => {
      if (!breakStart) {
        toast.error("Break start time is required");
        return;
      }
      onSave({
        mode: "break",
        employee_id: employee.employee_id,
        break_start: breakStart,
        break_end: breakEnd,
        break_type: breakType,
        notes: breakNotes,
      });
    };

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Manage Attendance & Break"
        subtitle={`${employee.name} (${employee.employee_code || "N/A"}) • ${employee.attendance_date || ""}`}
        icon={<FaCalendarCheck className="h-5 w-5 text-blue-600" />}
        size="xl"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            {activeTab === "attendance" ? (
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs uppercase tracking-widest hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-200 transition disabled:opacity-50"
              >
                {saving ? <FaSpinner className="animate-spin" size={12} /> : <FaCheckCircle size={12} />}
                {saving ? "Saving..." : "Save Attendance"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveBreak}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs uppercase tracking-widest hover:from-amber-600 hover:to-orange-600 shadow-md shadow-amber-200 transition disabled:opacity-50"
              >
                {saving ? <FaSpinner className="animate-spin" size={12} /> : <FaCoffee size={12} />}
                {saving ? "Saving..." : "Save Break"}
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          {/* Header 2 Sections / Tabs: Attendance & Break */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("attendance")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === "attendance"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              <FaCalendarCheck size={12} />
              <span>Attendance</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("break")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === "break"
                ? "bg-white text-amber-700 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              <FaCoffee size={12} />
              <span>Break</span>
            </button>
          </div>

          {/* Tab 1: Attendance Section */}
          {activeTab === "attendance" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: "present", label: "Present", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                  { value: "half_day", label: "Half Day", color: "bg-blue-50 text-blue-700 border-blue-200" },
                  { value: "absent", label: "Absent", color: "bg-rose-50 text-rose-700 border-rose-200" },
                  { value: "leave", label: "Leave", color: "bg-violet-50 text-violet-700 border-violet-200" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold uppercase transition ${status === opt.value
                      ? `${opt.color} ring-2 ring-blue-100 shadow-sm`
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {(status === "present" || status === "half_day") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TimePickerField
                    label="Punch In"
                    value={punchIn}
                    onChange={setPunchIn}
                    initialValue="09:00"
                    required
                  />
                  <TimePickerField
                    label="Punch Out"
                    value={punchOut}
                    onChange={setPunchOut}
                    initialValue="18:00"
                    required
                  />
                </div>
              )}

              {status === "half_day" && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Half Day Session</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "first_half", label: "First Half" },
                      { value: "second_half", label: "Second Half" },
                    ].map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setHalfDaySession(s.value)}
                        className={`p-2.5 rounded-xl border text-xs font-bold uppercase transition ${halfDaySession === s.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes / Remarks</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Attendance notes (optional)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 text-sm font-semibold text-slate-800 resize-none"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Break Section */}
          {activeTab === "break" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TimePickerField
                  label="Break Start"
                  value={breakStart}
                  onChange={setBreakStart}
                  initialValue="13:00"
                  required
                />
                <TimePickerField
                  label="Break End"
                  value={breakEnd}
                  onChange={setBreakEnd}
                  initialValue="14:00"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Break Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: "lunch", label: "Lunch" },
                    { value: "tea", label: "Tea" },
                    { value: "official", label: "Official" },
                    { value: "personal", label: "Personal" },
                  ].map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() => setBreakType(b.value)}
                      className={`p-2.5 rounded-xl border text-xs font-bold uppercase transition ${breakType === b.value
                        ? "border-amber-500 bg-amber-50 text-amber-700 shadow-sm ring-2 ring-amber-100"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Break Notes</label>
                <textarea
                  value={breakNotes}
                  onChange={(e) => setBreakNotes(e.target.value)}
                  rows={3}
                  placeholder="Add details about break (optional)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 text-sm font-semibold text-slate-800 resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </Modal>
    );
  };

  const handleCalendarAttendanceSave = async (formPayload) => {
    const companyStr = localStorage.getItem("company");
    const companyId = companyStr ? JSON.parse(companyStr)?.id : null;
    const sourceEmployee = manageEmployee;

    if (formPayload.mode === "break" || formPayload.type === "break") {
      const payload = {
        employee_id: sourceEmployee.employee_id,
        date: sourceEmployee.attendance_date,
        type: "break",
        start_time: formPayload.break_start ? String(formPayload.break_start).slice(0, 5) : "",
        end_time: formPayload.break_end ? String(formPayload.break_end).slice(0, 5) : "",
        break_type: formPayload.break_type || "lunch",
        notes: formPayload.notes || "",
      };
      setSavingCalendarAttendance(true);
      try {
        const response = await apiCall("/attendance/mark", "POST", payload, companyId);
        const result = await response.json();
        if (!response.ok || result.success === false) throw new Error(result.message || "Failed to record break");
        toast.success(result.message || "Break recorded successfully");
        setManageCell(null);
        fetchCalendar(month, year);
      } catch (error) {
        toast.error(error.message || "Failed to record break");
      } finally {
        setSavingCalendarAttendance(false);
      }
      return;
    }

    const payload = {
      employee_id: sourceEmployee.employee_id,
      date: sourceEmployee.attendance_date,
      type: "attendance",
      status: formPayload.status,
      notes: formPayload.notes || "",
      is_overtime: Boolean(formPayload.is_overtime),
      is_deductible: Boolean(formPayload.is_deductible),
    };
    if (formPayload.status === "present" || formPayload.status === "half_day") {
      payload.start_time = String(formPayload.punch_in || "").slice(0, 5);
      payload.end_time = String(formPayload.punch_out || "").slice(0, 5);
    }
    if (formPayload.status === "half_day") payload.half_day_type = formPayload.half_day_session;
    if (formPayload.status === "leave") {
      payload.leave_type = formPayload.leave_type;
      payload.leave_type_value = formPayload.leave_sub_type;
      payload.leave_day_overtime = formPayload.leave_day_overtime;
    }

    setSavingCalendarAttendance(true);
    try {
      const response = await apiCall("/attendance/mark", "POST", payload, companyId);
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.message || "Failed to update attendance");
      toast.success(result.message || "Attendance updated successfully");
      setManageCell(null);
      fetchCalendar(month, year);
    } catch (error) {
      toast.error(error.message || "Failed to update attendance");
    } finally {
      setSavingCalendarAttendance(false);
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto pb-8">
      <CalendarEmployeeInfo employee={employee} shift={shift} statistics={statistics} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateMonth(-1)}
            className="w-8 h-8 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all shadow-sm"
          >
            <FaChevronLeft size={11} />
          </button>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight min-w-[180px] text-center">
            {currentDate.toLocaleString("default", { month: "long" })} {year}
          </h2>
          <button
            onClick={() => navigateMonth(1)}
            className="w-8 h-8 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all shadow-sm"
          >
            <FaChevronRight size={11} />
          </button>
          <AdvancedDateFilter
            value={{ month, year }}
            onChange={(filter) => filter.month && filter.year && setCurrentDate(new Date(filter.year, filter.month - 1, 1))}
            tabOptions={["month"]}
            placeholder="Jump to month"
            buttonClassName="bg-white border border-gray-100 px-3 py-2 rounded-xl shadow-sm hover:bg-gray-50 transition-all font-bold text-gray-600 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {["present", "absent", "holiday", "leave", "half_day"].map((s) => (
            <div key={s} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-gray-100 bg-white shadow-sm">
              <span className={`w-2 h-2 rounded-full ${CALENDAR_STATUS_STYLES[s].dot}`} />
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">{CALENDAR_STATUS_STYLES[s].label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 mb-4">
        <CalendarSummaryCard label="Total" value={meta.total_days || 0} icon={FaCalendarAlt} type="upcoming" />
        <CalendarSummaryCard label="Present" value={meta.present || 0} icon={FaCheckCircle} type="present" />
        <CalendarSummaryCard label="Absent" value={meta.absent || 0} icon={FaTimesCircle} type="absent" />
        <CalendarSummaryCard label="Leave" value={meta.leave || 0} icon={FaInfoCircle} type="leave" />
        <CalendarSummaryCard label="Holiday" value={meta.holiday || 0} icon={FaUmbrellaBeach} type="holiday" />
        <CalendarSummaryCard label="Weekend" value={meta.weekend || 0} icon={FaCalendarAlt} type="weekend" />
        <CalendarSummaryCard label="Half Day" value={meta.half_day || 0} icon={FaHourglassHalf} type="half_day" />
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <FaSpinner className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-[10px] font-black text-indigo-800 uppercase tracking-widest animate-pulse">Loading…</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="py-3 text-center">
              <span className="hidden md:block text-[10px] font-black text-gray-400 uppercase tracking-widest">{day}</span>
              <span className="md:hidden text-[10px] font-black text-gray-400 uppercase tracking-widest">{day}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 bg-gray-100/50 gap-px">
          {error ? (
            <div className="col-span-7 py-24 bg-white flex flex-col items-center gap-4 text-rose-400">
              <FaTimesCircle size={40} className="opacity-30" />
              <p className="font-black uppercase tracking-widest text-sm">{error}</p>
              <button
                onClick={() => fetchCalendar(month, year)}
                className="px-5 py-2 bg-rose-50 text-rose-600 rounded-xl font-bold text-xs uppercase tracking-widest border border-rose-100 hover:bg-rose-100 transition-all"
              >
                Retry
              </button>
            </div>
          ) : (
            calendarGrid.map((cell, idx) => (
              <CalendarCell key={idx} cell={cell} onClick={setSelectedCell} />
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedCell && (
          <CalendarDayDetailsModal
            cell={selectedCell}
            employeeId={employeeId}
            onClose={() => setSelectedCell(null)}
            shift={shift}
            onManage={(cell) => { setSelectedCell(null); setManageCell(cell); }}
            onViewLogs={(attId) => { setSelectedCell(null); setLogModal({ id: attId, type: "attendance" }); }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {logModal && (
          <AttendanceLogsModal
            id={logModal.id}
            type={logModal.type || "attendance"}
            onClose={() => setLogModal(null)}
          />
        )}
      </AnimatePresence>
      <ManageAttendanceAndBreakModal
        isOpen={!!manageCell}
        employee={manageEmployee}
        initialStatus={manageEmployee?.day_status === "unmarked" ? "present" : manageEmployee?.day_status}
        onClose={() => setManageCell(null)}
        onSave={handleCalendarAttendanceSave}
        saving={savingCalendarAttendance}
      />
    </div>
  );
}

// ─── ProfileHub ───────────────────────────────────────────────────────────────

function ProfileHub({
  eyebrow, title, description, accent = "slate",
  summary, actions, tabs = [], activeTab, onTabChange, children,
}) {
  const ACCENT_COLORS = {
    slate: { active: "#444441", border: "#444441" },
    green: { active: "#3B6D11", border: "#3B6D11" },
    blue: { active: "#185FA5", border: "#185FA5" },
    indigo: { active: "#534AB7", border: "#534AB7" },
    amber: { active: "#854F0B", border: "#854F0B" },
  };
  const { active: activeColor } = ACCENT_COLORS[accent] || ACCENT_COLORS.indigo;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1600px]">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden"
        >
          <div className="flex flex-col items-start justify-between gap-4 px-5 pt-4 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                {eyebrow && (
                  <div className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] from-blue-600 to-indigo-600 text-blue-700 border-blue-200">
                    {eyebrow}
                  </div>
                )}
                {title && (
                  <h1 className="text-base font-bold text-slate-900 truncate leading-snug">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>
                )}
              </div>
            </div>

            {(summary || actions) && (
              <div className="w-full flex items-center justify-between gap-3">
                {summary}
                {actions}
              </div>
            )}
          </div>

          {tabs?.length > 0 && (
            <div className="flex items-center gap-1 px-4 overflow-x-auto scrollbar-none">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab;
                const isDisabled = tab.disabled || false;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => !isDisabled && onTabChange?.(tab.id)}
                    disabled={isDisabled}
                    title={tab.title || tab.label}
                    style={isActive ? { color: activeColor, borderBottomColor: activeColor } : {}}
                    className={[
                      "inline-flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium",
                      "border-b-2 whitespace-nowrap transition-colors duration-150",
                      "-mb-px",
                      isActive
                        ? "border-current"
                        : isDisabled
                          ? "border-transparent text-slate-300 cursor-not-allowed"
                          : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300",
                    ].join(" ")}
                  >
                    {tab.icon
                      ? (typeof tab.icon === "function" ? <tab.icon size={12} /> : tab.icon)
                      : null}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>

        <div className="px-1 lg:px-0">{children}</div>
      </div>
    </div>
  );
}

// ─── PILL STYLES ──────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-rose-100 text-rose-800",
  suspended: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-rose-100 text-rose-800",
  paid: "bg-emerald-100 text-emerald-800",
  present: "bg-emerald-100 text-emerald-800",
  leave: "bg-amber-100 text-amber-800",
  holiday: "bg-indigo-100 text-indigo-800",
  manual: "bg-slate-100 text-slate-700",
  biometric: "bg-blue-100 text-blue-700",
  in: "bg-emerald-100 text-emerald-800",
  out: "bg-rose-100 text-rose-800",
  break_start: "bg-amber-100 text-amber-800",
  break_end: "bg-teal-100 text-teal-800",
  earning: "bg-emerald-100 text-emerald-800",
  deduction: "bg-rose-100 text-rose-800",
  half_day: "bg-orange-100 text-orange-800",
  paid_leave: "bg-violet-100 text-violet-800",
  unpaid_leave: "bg-red-100 text-red-800",
  monthly: "bg-blue-100 text-blue-700",
  part_time: "bg-purple-100 text-purple-700",
  full_time: "bg-green-100 text-green-700",
  supervisor: "bg-indigo-100 text-indigo-700",
};

function Pill({ value, className = "" }) {
  const cls = STATUS_COLORS[value?.toLowerCase?.()] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${cls} ${className}`}>
      {fmt(value)}
    </span>
  );
}

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────

function DetailModal({ isOpen, onClose, item, tabKey, tabLabel, subType = "attendance", onApproveLeave, onRejectLeave }) {
  const attendanceTypeConfig = getAttendanceTypeConfig(subType);
  if (!isOpen || !item) return null;

  const renderFields = () => {
    if (tabKey === "basic") {
      return (
        <div className="space-y-2">
          <Field label="ID" value={item.id ?? item.employee_id} />
          <Field label="Name" value={item.name || item.user_name || item.employee_name} highlight />
          <Field label="Code" mono value={item.code || item.employee_code} />
          <Field label="Email" value={item.email || item.user_email} />
          <Field label="Phone" value={item.phone || item.mobile || "—"} />
          <Field label="Designation" value={item.designation} />
          <Field label="Employment Type" value={item.employment_type} />
          <Field label="Salary Type" value={item.salary_type} />
          <Field label="Status" value={<Pill value={item.status} />} />
          <Field label="Joining Date" value={fmtDate(item.joining_date)} />
          <Field label="Created At" value={fmtDateTime(item.created_at)} />
        </div>
      );
    }
    if (tabKey === "permissions") {
      return (
        <div className="space-y-2">
          <Field label="ID" value={item.id} />
          <Field label="Permission Name" value={item.name} highlight />
          <Field label="Code" mono value={item.code} />
        </div>
      );
    }
    if (tabKey === "attendance") {
      const shift = item.shift || {};
      const flags = shift.flags || {};
      const isOvertime = flags.overtime?.enabled || item.is_overtime || false;
      const isHalfDay = flags.half_day?.enabled || item.is_half_day || false;
      const isDeductible = flags.deductible?.enabled || item.is_deductible || false;

      const formatMins = (m) => {
        if (m === null || m === undefined) return "0m";
        const hours = Math.floor(m / 60);
        const mins = m % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      };

      return (
        <div className="space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <FaInfoCircle className="text-blue-500" /> Summary & Status
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Date</label>
                <p className="font-medium text-gray-800 text-sm">{fmtDate(item.attendance_date)}</p>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Status</label>
                <div className="mt-0.5"><Pill value={item.status || (item.is_verified ? "Verified" : "Pending")} /></div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Verification</label>
                <p className="font-medium text-gray-800 text-sm">{item.is_verified ? "Verified Record" : "Unverified"}</p>
              </div>
            </div>
          </div>

          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <FaClock className="text-indigo-500" /> {attendanceTypeConfig.label} Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{attendanceTypeConfig.startLabel}</label>
                <p className="font-medium text-gray-800 text-sm">{item.start_time || "—"}</p>
                {item.punch_in_method && <p className="text-[9px] font-bold uppercase text-slate-400">{fmt(item.punch_in_method)}</p>}
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{attendanceTypeConfig.endLabel}</label>
                <p className="font-medium text-gray-800 text-sm">{item.end_time || "—"}</p>
                {item.punch_out_method && <p className="text-[9px] font-bold uppercase text-slate-400">{fmt(item.punch_out_method)}</p>}
              </div>
            </div>
          </div>

          <div className="border-b border-gray-100 pb-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
              <FaUserCheck className="text-emerald-500" /> Shift & Productivity
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Worked Time</label>
                <p className="mt-0.5 text-sm font-bold text-emerald-600">{formatMins(shift.worked_minutes || item.worked_minutes)}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Break Time</label>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{formatMins(shift.break_minutes || item.break_minutes)}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Shift Start</label>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{formatTimeValue(shift.shift_start_time)}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Shift End</label>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{formatTimeValue(shift.shift_end_time)}</p>
              </div>
            </div>
          </div>

          <div className="border-b border-gray-100 pb-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
              <FaBriefcase className="text-indigo-500" /> Productivity Flags
            </h3>
            <div className="flex flex-wrap gap-3">
              <div className={`flex items-center gap-2 rounded-xl border p-3 ${isOvertime ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isOvertime ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                  <FaClock size={14} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Overtime</p>
                  <p className={`text-xs font-bold ${isOvertime ? "text-emerald-700" : "text-slate-500"}`}>
                    {isOvertime ? `${flags.overtime?.minutes || item.overtime_minutes || 0} mins` : "Disabled"}
                  </p>
                </div>
              </div>
              <div className={`flex items-center gap-2 rounded-xl border p-3 ${isHalfDay ? "border-orange-200 bg-orange-50" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isHalfDay ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                  <FaHourglassEnd size={14} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Half Day</p>
                  <p className={`text-xs font-bold ${isHalfDay ? "text-orange-700" : "text-slate-500"}`}>{isHalfDay ? "Yes" : "No"}</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 rounded-xl border p-3 ${isDeductible ? "border-rose-200 bg-rose-50" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDeductible ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                  <FaExclamationCircle size={14} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Deductible</p>
                  <p className={`text-xs font-bold ${isDeductible ? "text-rose-700" : "text-slate-500"}`}>
                    {isDeductible ? `${flags.deductible?.minutes || item.deductible_minutes || 0} mins` : "None"}
                  </p>
                </div>
              </div>
            </div>
            {isDeductible && flags.deductible?.breakdown && (
              <div className="mt-4 p-4 rounded-xl bg-rose-50/50 border border-rose-100">
                <h4 className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-3">Deductible Breakdown</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="text-[9px] font-bold uppercase text-slate-400 block">Late</label><p className="text-sm font-bold text-rose-700">{flags.deductible.breakdown.late_minutes}m</p></div>
                  <div><label className="text-[9px] font-bold uppercase text-slate-400 block">Early Leave</label><p className="text-sm font-bold text-rose-700">{flags.deductible.breakdown.early_leave_minutes}m</p></div>
                  <div><label className="text-[9px] font-bold uppercase text-slate-400 block">Extra Break</label><p className="text-sm font-bold text-rose-700">{flags.deductible.breakdown.extra_break_minutes}m</p></div>
                </div>
              </div>
            )}
          </div>

          {item.remark && (
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><FaComment className="text-amber-500" /> Remarks</h3>
              <p className="font-medium text-gray-700 text-xs italic p-3 bg-gray-50 rounded-lg border border-gray-100">"{item.remark}"</p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-4">
            <div className="flex items-start gap-4 border-b border-slate-200 pb-4">
              <div className="mt-1 h-8 w-8 rounded-xl bg-white flex items-center justify-center text-amber-500 shadow-sm border border-slate-100 flex-shrink-0">
                <FaMapMarkerAlt size={14} />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Device & Location Punches</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Punch In</p>
                    <p className="text-xs font-semibold text-slate-700">IP: {item.punch_in_ip || "—"}</p>
                    <p className="text-xs font-semibold text-slate-700">GPS: {item.punch_in_latitude && item.punch_in_longitude ? `${item.punch_in_latitude}, ${item.punch_in_longitude}` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Punch Out</p>
                    <p className="text-xs font-semibold text-slate-700">IP: {item.punch_out_ip || "—"}</p>
                    <p className="text-xs font-semibold text-slate-700">GPS: {item.punch_out_latitude && item.punch_out_longitude ? `${item.punch_out_latitude}, ${item.punch_out_longitude}` : "—"}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1 h-8 w-8 rounded-xl bg-white flex items-center justify-center text-amber-500 shadow-sm border border-slate-100 flex-shrink-0">
                <FaCog size={14} />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">System Audit</span>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-white px-2 py-1 rounded-md text-[10px] font-bold text-slate-500 border border-slate-200">ID: {item.id || item.punch_id}</span>
                  {item.reviewed_at && <span className="bg-white px-2 py-1 rounded-md text-[10px] font-bold text-slate-500 border border-slate-200">Reviewed At: {fmtDateTime(item.reviewed_at)}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ── SALARY DETAIL ─────────────────────────────────────────────────────────
    if (tabKey === "salary") {
      const earnings = (item.components || []).filter((c) => c.type === "earning");
      const deductions = (item.components || []).filter((c) => c.type === "deduction");
      return (
        <div className="space-y-5">
          {/* Header snapshot */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Base Amount", value: `₹${Number(item.base_amount || 0).toLocaleString()}`, color: "blue" },
              { label: "CTC", value: item.ctc != null ? `₹${Number(item.ctc).toLocaleString()}` : "—", color: "indigo" },
              { label: "Net Salary", value: item.net_salary != null ? `₹${Number(item.net_salary).toLocaleString()}` : "—", color: "emerald" },
              { label: "Total Deductions", value: item.total_deductions != null ? `₹${Number(item.total_deductions).toLocaleString()}` : "—", color: "rose" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`p-3 rounded-xl bg-${color}-50 border border-${color}-100 text-center`}>
                <p className={`text-[10px] font-bold text-${color}-500 uppercase tracking-widest mb-1`}>{label}</p>
                <p className={`text-base font-black text-${color}-700`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Effective From" value={fmtDate(item.effective_from)} />
            <Field label="Effective To" value={item.effective_to ? fmtDate(item.effective_to) : "Ongoing"} />
          </div>

          {/* Earnings */}
          {earnings.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <FaArrowUp className="text-emerald-500" /> Earnings ({earnings.length})
              </p>
              <div className="space-y-2">
                {earnings.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">{c.code}</span>
                      <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                      <span className="text-[10px] text-gray-400">{c.calc_type === "percentage" ? `${Number(c.calc_value)}%` : "Fixed"}</span>
                    </div>
                    <span className="text-sm font-black text-emerald-700">₹{Number(c.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deductions */}
          {deductions.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <FaArrowDown className="text-rose-500" /> Deductions ({deductions.length})
              </p>
              <div className="space-y-2">
                {deductions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">{c.code}</span>
                      <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                      <span className="text-[10px] text-gray-400">{c.calc_type === "percentage" ? `${Number(c.calc_value)}%` : "Fixed"}</span>
                    </div>
                    <span className="text-sm font-black text-rose-700">₹{Number(c.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── PAYROLL DETAIL ────────────────────────────────────────────────────────
    if (tabKey === "payroll") {
      const att = item.attendance || {};
      const work = item.work || {};
      const snapshot = item.snapshot || {};
      const earnings = item.components_breakdown?.earnings || [];
      const deductions = item.components_breakdown?.deductions || [];
      const adjustments = item.adjustments || [];

      return (
        <div className="space-y-5">
          {/* Period */}
          <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
            <FaCalendarAlt className="text-indigo-500" size={16} />
            <div>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Payroll Period</p>
              <p className="text-base font-black text-indigo-800">
                {item.month && item.year
                  ? new Date(item.year, item.month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
                  : fmtMonthYear(item.payroll_period || item.period || item.month)}
              </p>
            </div>
          </div>

          {/* Financial summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
              <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Total Earnings</p>
              <p className="text-base font-black text-emerald-700">₹{Number(item.total_earnings || 0).toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-center">
              <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mb-1">Total Deductions</p>
              <p className="text-base font-black text-rose-700">₹{Number(item.total_deductions || 0).toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-center">
              <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Net Salary</p>
              <p className="text-base font-black text-indigo-700">₹{Number(item.net_salary || 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Attendance summary */}
          {Object.keys(att).length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <FaCalendarAlt className="text-blue-400" /> Attendance
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { label: "Working Days", value: att.working_days ?? "—", color: "slate" },
                  { label: "Present", value: att.present_days ?? "—", color: "emerald" },
                  { label: "Absent", value: att.absent_days ?? "—", color: "rose" },
                  { label: "Paid Leave", value: att.paid_leave_days ?? "—", color: "violet" },
                  { label: "Unpaid Leave", value: att.unpaid_leave_days ?? "—", color: "orange" },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`p-2.5 rounded-xl bg-${color}-50 border border-${color}-100 text-center`}>
                    <p className={`text-[9px] font-bold text-${color}-500 uppercase tracking-widest mb-0.5`}>{label}</p>
                    <p className={`text-sm font-black text-${color}-700`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Work stats */}
          {Object.keys(work).length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <FaClock className="text-blue-400" /> Work Stats
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-center">
                  <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-0.5">Worked</p>
                  <p className="text-sm font-black text-blue-700">{formatMinutes(work.worked_minutes)}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-center">
                  <p className="text-[9px] font-bold text-purple-500 uppercase tracking-widest mb-0.5">Overtime</p>
                  <p className="text-sm font-black text-purple-700">{formatMinutes(work.overtime_minutes)}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-center">
                  <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mb-0.5">Deduction</p>
                  <p className="text-sm font-black text-rose-700">{formatMinutes(work.deduction_minutes)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Earnings breakdown */}
          {earnings.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <FaArrowUp className="text-emerald-500" /> Earnings Breakdown
              </p>
              <div className="space-y-1.5">
                {earnings.map((e, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span className="text-sm font-semibold text-gray-700">{e.name}</span>
                    <span className="text-sm font-black text-emerald-700">₹{Number(e.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deductions breakdown */}
          {deductions.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <FaArrowDown className="text-rose-500" /> Deductions Breakdown
              </p>
              <div className="space-y-1.5">
                {deductions.map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-rose-50 rounded-lg border border-rose-100">
                    <span className="text-sm font-semibold text-gray-700">{d.name}</span>
                    <span className="text-sm font-black text-rose-700">₹{Number(d.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Snapshot */}
          {Object.keys(snapshot).length > 0 && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Employee Snapshot</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Designation" value={fmt(snapshot.designation)} />
                <Field label="Employment Type" value={<Pill value={snapshot.employment_type} />} />
                <Field label="Salary Type" value={<Pill value={snapshot.salary_type} />} />
                <Field label="Base Amount" value={`₹${Number(snapshot.base_amount || 0).toLocaleString()}`} highlight />
              </div>
            </div>
          )}

          {/* Adjustments */}
          {adjustments.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Adjustments</p>
              <div className="space-y-1.5">
                {adjustments.map((a, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                    <span className="text-sm font-semibold text-gray-700">{a.name || a.label || "Adjustment"}</span>
                    <span className="text-sm font-black text-amber-700">₹{Number(a.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── SHIFTS DETAIL ─────────────────────────────────────────────────────────
    if (tabKey === "shifts") {
      const formatMins = (m) => {
        if (m === null || m === undefined) return "0m";
        const hours = Math.floor(m / 60);
        const mins = m % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      };

      const parseShiftTime = formatTimeValue;

      const dayStatus = item.day_status;
      const statusStyle = CALENDAR_STATUS_STYLES[dayStatus] || CALENDAR_STATUS_STYLES.upcoming;

      return (
        <div className="space-y-5">
          {/* Date + Status header */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Shift Date</p>
              <p className="text-lg font-black text-slate-800">{fmtDate(item.shift_date)}</p>
            </div>
            {dayStatus && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${statusStyle.pill}`}>
                <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                {statusStyle.label || fmt(dayStatus)}
              </span>
            )}
          </div>

          {/* Timing */}
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <FaExchangeAlt className="text-violet-500" /> Shift Timing
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Start</p>
                <p className="text-sm font-black text-emerald-700">{parseShiftTime(item.start_time)}</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-center">
                <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mb-1">End</p>
                <p className="text-sm font-black text-rose-700">{parseShiftTime(item.end_time)}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-center">
                <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-1">Expected</p>
                <p className="text-sm font-black text-blue-700">{formatMins(item.expected_work_minutes)}</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Worked</p>
                <p className="text-sm font-black text-indigo-700">{formatMins(item.worked_minutes)}</p>
              </div>
            </div>
          </div>

          {/* Break & Deductible */}
          <div className="border-b border-gray-100 pb-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
              <FaHourglassHalf className="text-amber-500" /> Breaks & Deductions
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-center">
                <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-0.5">Allowed Break</p>
                <p className="text-sm font-black text-amber-700">{formatMins(item.allowed_break_minutes)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-100 text-center">
                <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest mb-0.5">Extra Break</p>
                <p className="text-sm font-black text-orange-700">{formatMins(item.extra_break_minutes)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-center">
                <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mb-0.5">Deductible</p>
                <p className="text-sm font-black text-rose-700">{formatMins(item.deductible_minutes)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-center">
                <p className="text-[9px] font-bold text-purple-500 uppercase tracking-widest mb-0.5">Overtime</p>
                <p className="text-sm font-black text-purple-700">{formatMins(item.overtime_minutes)}</p>
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
                <p className={`text-sm font-black ${item.late_minutes > 0 ? "text-rose-600" : "text-slate-400"}`}>{formatMins(item.late_minutes)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Early Leave</p>
                <p className={`text-sm font-black ${item.early_leave_minutes > 0 ? "text-amber-600" : "text-slate-400"}`}>{formatMins(item.early_leave_minutes)}</p>
              </div>
            </div>
          </div>

          {/* Flags */}
          <div className="border-b border-gray-100 pb-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
              <FaBriefcase className="text-indigo-500" /> Status Flags
            </h3>
            <div className="flex flex-wrap gap-3">
              <div className={`flex items-center gap-2 rounded-xl border p-3 ${item.overtime_minutes > 0 ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.overtime_minutes > 0 ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}><FaClock size={14} /></div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Overtime</p>
                  <p className={`text-xs font-bold ${item.overtime_minutes > 0 ? "text-emerald-700" : "text-slate-500"}`}>{item.overtime_minutes > 0 ? `${item.overtime_minutes} mins` : "None"}</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 rounded-xl border p-3 ${item.is_deductible ? "border-rose-200 bg-rose-50" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.is_deductible ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-400"}`}><FaExclamationCircle size={14} /></div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Deductible</p>
                  <p className={`text-xs font-bold ${item.is_deductible ? "text-rose-700" : "text-slate-500"}`}>{item.is_deductible ? "Yes" : "No"}</p>
                </div>
              </div>
              {dayStatus === "half_day" && (
                <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-500 text-white"><FaHourglassEnd size={14} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Half Day</p>
                    <p className="text-xs font-bold text-orange-700">{fmt(item.half_day_type) || "Yes"}</p>
                  </div>
                </div>
              )}
              {dayStatus === "leave" && (
                <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500 text-white"><FaUmbrellaBeach size={14} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Leave Type</p>
                    <p className="text-xs font-bold text-violet-700">{item.leave_type_value || fmt(item.leave_type) || "Leave"}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (tabKey === "leaves") {
      return (
        <div className="space-y-2">
          <Field label="ID" value={item.id} />
          <Field label="Leave Type" value={item.leave_type || item.type} highlight />
          <Field label="Start Date" value={fmtDate(item.start_date || item.from_date || item.from)} />
          <Field label="End Date" value={fmtDate(item.end_date || item.to_date || item.to)} />
          <Field label="Total Days" value={formatDays(item.total_days || item.days)} />
          <Field label="Status" value={<Pill value={item.status} />} />
          <Field label="Reason" value={item.reason} />
          <Field label="Attachments" value={Array.isArray(item.attachments) ? `${item.attachments.length} file(s)` : "—"} />
        </div>
      );
    }
    return Object.entries(item).map(([k, v]) => (
      <Field key={k} label={fmt(k)} value={typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")} />
    ));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${tabLabel} Details`}
      subtitle="Record information and detailed logs"
      size={(tabKey === "attendance" || tabKey === "shifts" || tabKey === "payroll") ? "4xl" : "md"}
      footer={
        <div className="flex w-full justify-end gap-3">
          {tabKey === "leaves" && item.status === "pending" && (
            <>
              <button
                type="button"
                onClick={() => onRejectLeave?.(item)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-rose-200 transition-all hover:from-rose-700 hover:to-red-700"
              >
                <FaTrash size={13} /> Reject
              </button>
              <button
                type="button"
                onClick={() => onApproveLeave?.(item)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-200 transition-all hover:from-emerald-700 hover:to-green-700"
              >
                <FaCheck size={13} /> Approve / Edit
              </button>
            </>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
            Close
          </button>
        </div>
      }
    >
      {renderFields()}
    </Modal>
  );
}

function Field({ label, value, mono, highlight }) {
  return (
    <div className="flex justify-between items-start gap-3 border-b border-gray-50 pb-2">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className={`text-sm text-right break-all ${mono ? "font-mono text-gray-600" : ""} ${highlight ? "font-semibold text-gray-800" : "text-gray-700"}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

// ─── PROFILE HEADER SUMMARY ───────────────────────────────────────────────────

function ProfileHeaderSummary({ data }) {
  const { employee: e, user: u } = data;
  return (
    <div className="flex items-center gap-3">
      <ProfileAvatar
        record={u}
        name={u.name}
        className={`h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br ${avatarGradient(u.id)}
          flex items-center justify-center text-base font-bold text-white overflow-hidden select-none`}
      >
        {getInitials(u.name)}
      </ProfileAvatar>

      <div className="text-right hidden sm:block">
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <Pill value={e.status} />
          <Pill value={e.employment_type} />
          <Pill value={e.salary_type} />
        </div>
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 mb-1">
          <FaIdCard size={10} className="shrink-0" />
          {e.code || e.employee_code || "—"}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-slate-600 mb-0.5">
          <FaBriefcase size={10} className="shrink-0 text-emerald-500" />
          {fmt(e.designation)}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <FaEnvelope size={10} className="shrink-0 text-blue-400" />
          <span className="truncate max-w-[180px]">{u.email || "—"}</span>
        </p>
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <FaPhone size={10} className="shrink-0 text-emerald-400" />
          {u.phone || "—"}
        </p>
      </div>
    </div>
  );
}

// ─── TAB CONTENT CONFIGS ──────────────────────────────────────────────────────

function usePermissionsConfig(onView, width) {
  const columns = [
    {
      key: "name", label: "Permission",
      render: (p) => (
        <div className="flex items-center gap-2 max-w-[200px]">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <FaShieldAlt size={11} className="text-indigo-500" />
          </div>
          <span className="font-medium text-gray-800 text-sm truncate min-w-0">{p.name || "—"}</span>
        </div>
      ),
    },
    width > 600 && {
      key: "code", label: "Code",
      render: (p) => <span className="font-mono text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">{p.code || "—"}</span>,
    },
    width > 800 && {
      key: "category", label: "Category",
      render: (p) => { const cat = p.code?.split("_")?.[0] || "unknown"; return <Pill value={cat} />; },
    },
  ].filter(Boolean);

  const cardRenderer = (p, index, activeId, onToggle) => {
    const cat = p.code?.split("_")?.[0] || "unknown";
    return (
      <ManagementCard key={p.id} accent="indigo" delay={index * 0.04} onClick={() => onView(p)} activeId={activeId} onToggle={onToggle} menuId={`perm-${p.id}`}
        actions={[{ label: "View Details", icon: <FaEye size={12} />, onClick: () => onView(p), className: "text-blue-600 hover:bg-blue-50" }]}
        hoverable title={p.name || "Permission"} subtitle={p.code || "No code"} eyebrow={fmt(cat)} badge={<Pill value={cat} />}
      >
        <div className="flex items-center gap-2 mt-1"><FaShieldAlt size={11} className="text-indigo-400" /><span className="text-xs text-gray-500 font-mono">{p.code || "—"}</span></div>
      </ManagementCard>
    );
  };
  return { columns, cardRenderer, rowKey: "id" };
}

function useAttendanceConfig(onView, onViewLogs, width, subType = "attendance") {
  const typeMeta = getAttendanceTypeConfig(subType);
  const columns = [
    { key: "attendance_date", label: "Date", render: (a) => <span className="text-sm font-medium text-gray-800">{fmtDate(a.attendance_date)}</span> },
    {
      key: "start_time", label: typeMeta.startLabel,
      render: (a) => <div className="flex flex-col"><span className="text-sm text-gray-700 font-medium">{a.start_time || "—"}</span><span className="text-[10px] text-gray-400 uppercase font-bold">{fmt(a.punch_in_method)}</span></div>,
    },
    {
      key: "end_time", label: typeMeta.endLabel,
      render: (a) => <div className="flex flex-col"><span className="text-sm text-gray-700 font-medium">{a.end_time || "—"}</span>{a.punch_out_method && <span className="text-[10px] text-gray-400 uppercase font-bold">{fmt(a.punch_out_method)}</span>}</div>,
    },
    width > 600 && {
      key: "flags", label: "Status",
      render: (a) => (
        <div className="flex flex-wrap gap-1">
          {a.is_verified ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200"><FaCheckCircle size={8} /> Verified</span> : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Pending</span>}
          {a.is_overtime && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">Overtime</span>}
          {a.is_half_day && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">Half Day</span>}
        </div>
      ),
    },
    width > 900 && { key: "breaks", label: "Breaks", render: (a) => <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">{a.breaks?.length || 0}</span> },
  ].filter(Boolean);

  const cardRenderer = (a, index, activeId, onToggle) => (
    <ManagementCard key={a.id} accent="blue" delay={index * 0.04} onClick={() => onView(a)} activeId={activeId} onToggle={onToggle} menuId={`att-${a.id}`}
      actions={[{ label: "View Details", icon: <FaEye size={12} />, onClick: () => onView(a), className: "text-blue-600 hover:bg-blue-50" }, { label: "View History", icon: <FaHistory size={12} />, onClick: () => onViewLogs(a), className: "text-emerald-600 hover:bg-emerald-50" }]}
      hoverable title={fmtDate(a.attendance_date)} subtitle={`${a.start_time || "—"} → ${a.end_time || "—"}`} eyebrow="Attendance Record"
      badge={<div className="flex gap-1">{a.is_verified && <FaCheckCircle className="text-emerald-500" size={12} />}{a.is_overtime && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 rounded-full font-bold">OT</span>}{a.is_half_day && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 rounded-full font-bold">HD</span>}</div>}
    >
      <div className="flex gap-2 flex-wrap mt-1">
        <Pill value={a.punch_in_method} />
        {a.breaks?.length > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">{a.breaks.length} Break(s)</span>}
      </div>
    </ManagementCard>
  );
  return { columns, cardRenderer, rowKey: "id" };
}

// ─── SALARY CONFIG (updated for new API structure) ────────────────────────────

function useSalaryConfig(onView, onEdit, onRevise, onDelete, width) {
  const columns = [
    {
      key: "salary_id",
      label: "Salary ID",
      render: (s) => (
        <span className="inline-flex whitespace-nowrap rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 font-mono">
          #{s.salary_id || s.id || "—"}
        </span>
      ),
    },
    {
      key: "base_amount",
      label: "Base / Net",
      render: (s) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-800 text-sm">
            ₹{Number(s.base_amount || 0).toLocaleString()}
          </span>
          {s.net_salary != null && (
            <span className="text-[10px] text-emerald-600 font-bold">
              Net ₹{Number(s.net_salary).toLocaleString()}
            </span>
          )}
        </div>
      ),
    },
    width > 580 && {
      key: "ctc",
      label: "CTC",
      render: (s) => (
        <span className="text-sm font-semibold text-indigo-600">
          {s.ctc != null ? `₹${Number(s.ctc).toLocaleString()}` : "—"}
        </span>
      ),
    },
    width > 700 && {
      key: "effective_from",
      label: "Effective From",
      render: (s) => <span className="text-sm text-gray-600">{fmtDate(s.effective_from)}</span>,
    },
    width > 950 && {
      key: "effective_to",
      label: "Effective To",
      render: (s) => (
        <span className="text-sm text-gray-600">
          {s.effective_to ? fmtDate(s.effective_to) : <span className="italic text-gray-400 text-xs">Ongoing</span>}
        </span>
      ),
    },
    width > 800 && {
      key: "status",
      label: "Status",
      render: (s) => {
        const active = !s.effective_to || new Date(s.effective_to) > new Date();
        return active
          ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><FaCheckCircle size={10} />Active</span>
          : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><FaTimesCircle size={10} />Expired</span>;
      },
    },
  ].filter(Boolean);

  const cardRenderer = (s, index, activeId, onToggle) => {
    const active = !s.effective_to || new Date(s.effective_to) > new Date();
    const sid = s.salary_id || s.id;
    const earnings = (s.components || []).filter((c) => c.type === "earning");
    const deductions = (s.components || []).filter((c) => c.type === "deduction");

    const actions = [
      { label: "View Details", icon: <FaEye size={12} />, onClick: () => onView(s), className: "text-blue-600 hover:bg-blue-50" },
      s.payroll_used
        ? { label: "Revise Salary", icon: <FaExchangeAlt size={12} />, onClick: () => onRevise(s), className: "text-purple-600 hover:bg-purple-50" }
        : { label: "Edit Salary", icon: <FaEdit size={12} />, onClick: () => onEdit(s), className: "text-indigo-600 hover:bg-indigo-50" },
      { label: "Delete", icon: <FaTrash size={12} />, onClick: () => onDelete(s), className: "text-red-600 hover:bg-red-50" },
    ];

    return (
      <ManagementCard
        key={sid || index}
        accent="green"
        delay={index * 0.04}
        onClick={() => onView(s)}
        activeId={activeId}
        onToggle={onToggle}
        menuId={`sal-${sid || index}`}
        actions={actions}
        hoverable
        title={`Salary #${sid || ""}`}
        subtitle={`${fmtDate(s.effective_from)} → ${s.effective_to ? fmtDate(s.effective_to) : "Ongoing"}`}
        eyebrow="Salary Record"
        badge={
          active
            ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><FaCheckCircle size={10} />Active</span>
            : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><FaTimesCircle size={10} />Expired</span>
        }
        footer={
          <div className="flex w-full items-center justify-between text-xs text-gray-400">
            <span>CTC: {s.ctc != null ? `₹${Number(s.ctc).toLocaleString()}` : "—"}</span>
            <span>Net: {s.net_salary != null ? `₹${Number(s.net_salary).toLocaleString()}` : "—"}</span>
          </div>
        }
      >
        {/* Base + financial row */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-2 text-center">
            <p className="text-[9px] font-bold text-blue-500 uppercase mb-0.5">Base</p>
            <p className="text-xs font-black text-blue-700">₹{Number(s.base_amount || 0).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2 text-center">
            <p className="text-[9px] font-bold text-emerald-500 uppercase mb-0.5">Net</p>
            <p className="text-xs font-black text-emerald-700">{s.net_salary != null ? `₹${Number(s.net_salary).toLocaleString()}` : "—"}</p>
          </div>
          <div className="rounded-lg border border-rose-100 bg-rose-50 p-2 text-center">
            <p className="text-[9px] font-bold text-rose-500 uppercase mb-0.5">Deductions</p>
            <p className="text-xs font-black text-rose-700">{s.total_deductions != null ? `₹${Number(s.total_deductions).toLocaleString()}` : "—"}</p>
          </div>
        </div>
        {/* Components preview */}
        {s.components && s.components.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {earnings.slice(0, 2).map((c) => (
              <span key={c.id} className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full font-bold">
                {c.code} +₹{Number(c.amount || 0).toLocaleString()}
              </span>
            ))}
            {deductions.slice(0, 2).map((c) => (
              <span key={c.id} className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 px-1.5 py-0.5 rounded-full font-bold">
                {c.code} -₹{Number(c.amount || 0).toLocaleString()}
              </span>
            ))}
            {s.components.length > 4 && (
              <span className="text-[9px] bg-gray-50 text-gray-500 border border-gray-100 px-1.5 py-0.5 rounded-full font-bold">
                +{s.components.length - 4} more
              </span>
            )}
          </div>
        )}
      </ManagementCard>
    );
  };

  return { columns, cardRenderer, rowKey: (row, idx) => row.salary_id || row.id || `sal-${idx}` };
}

// ─── PAYROLL CONFIG (updated for new API structure) ───────────────────────────

function usePayrollConfig(onView, onDownloadPdf, onSendEmail, width) {
  const columns = [
    {
      key: "payroll_period",
      label: "Period",
      render: (p) => (
        <span className="font-semibold text-gray-800 text-sm">
          {p.month && p.year
            ? new Date(p.year, p.month - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
            : fmtMonthYear(p.payroll_period || p.period || p.month)}
        </span>
      ),
    },
    {
      key: "total_earnings",
      label: "Earnings",
      render: (p) => (
        <span className="text-sm font-semibold text-emerald-700">
          {p.total_earnings != null ? `₹${Number(p.total_earnings).toLocaleString()}` : "—"}
        </span>
      ),
    },
    width > 600 && {
      key: "total_deductions",
      label: "Deductions",
      render: (p) => (
        <span className="text-sm font-semibold text-rose-600">
          {p.total_deductions != null ? `₹${Number(p.total_deductions).toLocaleString()}` : "—"}
        </span>
      ),
    },
    {
      key: "net_salary",
      label: "Net Salary",
      render: (p) => (
        <span className="inline-flex whitespace-nowrap rounded-lg bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
          {p.net_salary != null ? `₹${Number(p.net_salary).toLocaleString()}` : "—"}
        </span>
      ),
    },
    width > 800 && {
      key: "attendance",
      label: "Present / Working",
      render: (p) => {
        const att = p.attendance || {};
        return att.present_days != null ? (
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-700">{formatDay(att.present_days)} / {formatDay(att.working_days)} days</span>
            {Number(att.absent_days) > 0 && (
              <span className="text-[10px] text-rose-500 font-bold">{formatDay(att.absent_days)} absent</span>
            )}
          </div>
        ) : "—";
      },
    },
    width > 1000 && {
      key: "work",
      label: "Worked",
      render: (p) => {
        const work = p.work || {};
        return work.worked_minutes != null
          ? <span className="text-xs text-blue-600 font-semibold">{formatMinutes(work.worked_minutes)}</span>
          : "—";
      },
    },
  ].filter(Boolean);

  const cardRenderer = (p, index, activeId, onToggle) => {
    const att = p.attendance || {};
    const work = p.work || {};
    const earnings = p.components_breakdown?.earnings || [];
    const deductions = p.components_breakdown?.deductions || [];
    const periodLabel = p.month && p.year
      ? new Date(p.year, p.month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
      : fmtMonthYear(p.payroll_period || p.period || p.month);

    const actions = [
      { label: "View Details", icon: <FaEye size={12} />, onClick: () => onView(p), className: "text-blue-600 hover:bg-blue-50" },
      { label: "Download PDF", icon: <FaDownload size={12} />, onClick: () => onDownloadPdf(p), className: "text-blue-600 hover:bg-blue-50" },
      { label: "Send Email", icon: <FaEnvelope size={12} />, onClick: () => onSendEmail(p), className: "text-purple-600 hover:bg-purple-50" },
    ];

    return (
      <ManagementCard
        key={p.id || index}
        accent="emerald"
        delay={index * 0.04}
        onClick={() => onView(p)}
        activeId={activeId}
        onToggle={onToggle}
        menuId={`pay-${p.id || index}`}
        actions={actions}
        hoverable
        title={periodLabel || "Payroll"}
        subtitle={`${att.present_days ?? "—"} present of ${att.working_days ?? "—"} working days`}
        eyebrow="Payroll Record"
        badge={
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            <FaCheckCircle size={9} /> ID #{p.id}
          </span>
        }
        footer={
          <div className="flex w-full items-center justify-between text-xs text-gray-400">
            <span>Worked: {work.worked_minutes != null ? formatMinutes(work.worked_minutes) : "—"}</span>
            {Number(work.overtime_minutes) > 0 && <span className="text-purple-500 font-bold">OT: {formatMinutes(work.overtime_minutes)}</span>}
          </div>
        }
      >
        {/* Financial summary */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2 text-center">
            <p className="text-[9px] font-bold text-emerald-500 uppercase mb-0.5">Earnings</p>
            <p className="text-xs font-black text-emerald-700">
              {p.total_earnings != null ? `₹${Number(p.total_earnings).toLocaleString()}` : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-rose-100 bg-rose-50 p-2 text-center">
            <p className="text-[9px] font-bold text-rose-500 uppercase mb-0.5">Deductions</p>
            <p className="text-xs font-black text-rose-700">
              {p.total_deductions != null ? `₹${Number(p.total_deductions).toLocaleString()}` : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-2 text-center">
            <p className="text-[9px] font-bold text-indigo-500 uppercase mb-0.5">Net</p>
            <p className="text-xs font-black text-indigo-700">
              {p.net_salary != null ? `₹${Number(p.net_salary).toLocaleString()}` : "—"}
            </p>
          </div>
        </div>

        {/* Earnings component preview */}
        {earnings.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {earnings.slice(0, 3).map((e, i) => (
              <span key={i} className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full font-bold">
                {e.name}: ₹{Number(e.amount || 0).toLocaleString()}
              </span>
            ))}
            {earnings.length > 3 && (
              <span className="text-[9px] bg-gray-50 text-gray-500 border border-gray-100 px-1.5 py-0.5 rounded-full font-bold">
                +{earnings.length - 3} more
              </span>
            )}
          </div>
        )}
      </ManagementCard>
    );
  };
  return { columns, cardRenderer, rowKey: "id" };
}

// ─── SHIFTS CONFIG (updated for new API structure) ────────────────────────────

function useShiftConfig(onView, width) {
  const parseShiftTime = (t) => (t ? formatTimeValue(t) : null);

  const columns = [
    {
      key: "shift_date",
      label: "Date",
      render: (s) => <span className="font-medium text-gray-800 text-sm">{fmtDate(s.shift_date)}</span>,
    },
    {
      key: "day_status",
      label: "Status",
      render: (s) => {
        const style = CALENDAR_STATUS_STYLES[s.day_status] || CALENDAR_STATUS_STYLES.upcoming;
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {style.label || fmt(s.day_status)}
          </span>
        );
      },
    },
    {
      key: "start_time",
      label: "Timing",
      render: (s) => (
        <div className="flex flex-col">
          <span className="text-sm text-gray-700 font-medium">
            {parseShiftTime(s.start_time) || "—"} → {parseShiftTime(s.end_time) || "—"}
          </span>
          {s.day_status === "leave" && s.leave_type_value && (
            <span className="text-[10px] font-bold text-violet-600">{s.leave_type_value}</span>
          )}
          {s.day_status === "half_day" && s.half_day_type && (
            <span className="text-[10px] font-bold text-orange-600">{fmt(s.half_day_type)}</span>
          )}
        </div>
      ),
    },
    {
      key: "worked_minutes",
      label: "Worked",
      render: (s) => (
        <div className="flex flex-col">
          <span className="text-sm text-emerald-600 font-semibold">{s.worked_minutes} <span className="text-[10px] text-gray-400 uppercase">mins</span></span>
          <span className="text-[10px] text-gray-400">of {s.expected_work_minutes}m</span>
        </div>
      ),
    },
    width > 700 && {
      key: "late_early",
      label: "Late / Early",
      render: (s) => (
        <div className="flex gap-1.5 justify-center flex-wrap">
          {s.late_minutes > 0 && <span className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-bold">Late {s.late_minutes}m</span>}
          {s.early_leave_minutes > 0 && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-bold">Early {s.early_leave_minutes}m</span>}
          {s.late_minutes === 0 && s.early_leave_minutes === 0 && <span className="text-[10px] text-gray-300">—</span>}
        </div>
      ),
    },

  ].filter(Boolean);

  const cardRenderer = (s, index, activeId, onToggle) => {
    const statusStyle = CALENDAR_STATUS_STYLES[s.day_status] || CALENDAR_STATUS_STYLES.upcoming;
    return (
      <ManagementCard
        key={s.id || index}
        accent="violet"
        delay={index * 0.04}
        onClick={() => onView(s)}
        activeId={activeId}
        onToggle={onToggle}
        menuId={`sh-${s.id || index}`}
        actions={[{ label: "View Details", icon: <FaEye size={12} />, onClick: () => onView(s), className: "text-blue-600 hover:bg-blue-50" }]}
        hoverable
        title={fmtDate(s.shift_date)}
        subtitle={`${parseShiftTime(s.start_time) || "—"} → ${parseShiftTime(s.end_time) || "—"}`}
        eyebrow="Shift Record"
        badge={
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
            {statusStyle.label || fmt(s.day_status)}
          </span>
        }
        footer={
          <div className="flex w-full items-center justify-between text-xs text-gray-400">
            <span>Expected: {s.expected_work_minutes}m</span>
            <span>Allowed break: {s.allowed_break_minutes}m</span>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2 text-center">
            <p className="text-[9px] font-bold text-emerald-500 uppercase mb-0.5">Worked</p>
            <p className="text-xs font-black text-emerald-700">{s.worked_minutes}m</p>
          </div>
          <div className={`rounded-lg border p-2 text-center ${s.deductible_minutes > 0 ? "bg-rose-50 border-rose-100" : "bg-slate-50 border-slate-100"}`}>
            <p className={`text-[9px] font-bold uppercase mb-0.5 ${s.deductible_minutes > 0 ? "text-rose-500" : "text-slate-400"}`}>Deductible</p>
            <p className={`text-xs font-black ${s.deductible_minutes > 0 ? "text-rose-700" : "text-slate-400"}`}>{s.deductible_minutes}m</p>
          </div>
        </div>
        {(s.late_minutes > 0 || s.early_leave_minutes > 0 || s.is_overtime || s.extra_break_minutes > 0) && (
          <div className="flex gap-1.5 flex-wrap mt-2">
            {s.late_minutes > 0 && <span className="text-[9px] text-rose-500 font-bold bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-100">Late {s.late_minutes}m</span>}
            {s.early_leave_minutes > 0 && <span className="text-[9px] text-amber-500 font-bold bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">Early {s.early_leave_minutes}m</span>}
            {s.is_overtime && <span className="text-[9px] text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-100">OT {s.overtime_minutes}m</span>}
            {s.extra_break_minutes > 0 && <span className="text-[9px] text-orange-500 font-bold bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-100">+{s.extra_break_minutes}m break</span>}
          </div>
        )}
        {s.day_status === "leave" && s.leave_type_value && (
          <p className="mt-2 text-[10px] font-bold text-violet-600 flex items-center gap-1">
            <FaUmbrellaBeach size={9} /> {s.leave_type_value} • {fmt(s.leave_type)}
          </p>
        )}
        {s.day_status === "half_day" && s.half_day_type && (
          <p className="mt-2 text-[10px] font-bold text-orange-600 flex items-center gap-1">
            <FaHourglassEnd size={9} /> {fmt(s.half_day_type)}
          </p>
        )}
      </ManagementCard>
    );
  };
  return { columns, cardRenderer, rowKey: "id" };
}

function useLeaveConfig(onView, onApprove, onReject, width) {
  const columns = [
    { key: "leave_type", label: "Leave Type", render: (l) => <span className="inline-flex whitespace-nowrap rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">{l.leave_type || l.type || "—"}</span> },
    width > 600 && { key: "start_date", label: "Start Date", render: (l) => <span className="text-sm text-gray-600">{fmtDate(l.start_date || l.from_date || l.from)}</span> },
    width > 600 && { key: "end_date", label: "End Date", render: (l) => <span className="text-sm text-gray-600">{fmtDate(l.end_date || l.to_date || l.to)}</span> },
    { key: "total_days", label: "Total Days", render: (l) => <span className="font-semibold text-gray-700 text-sm">{formatDays(l.total_days || l.days)}</span> },
    width > 800 && { key: "status", label: "Status", render: (l) => <Pill value={l.status} /> },
  ].filter(Boolean);

  const getActions = (leave) => [
    { label: "View Details", icon: <FaEye size={12} />, onClick: () => onView(leave), className: "text-blue-600 hover:bg-blue-50" },
    ...(leave.status === "pending" ? [
      { label: "Approve / Edit", icon: <FaCheckCircle size={12} />, onClick: () => onApprove(leave), className: "text-emerald-600 hover:bg-emerald-50" },
      { label: "Reject", icon: <FaTimesCircle size={12} />, onClick: () => onReject(leave), className: "text-rose-600 hover:bg-rose-50" },
    ] : []),
  ];

  const cardRenderer = (l, index, activeId, onToggle) => (
    <ManagementCard key={l.id || index} accent="amber" delay={index * 0.04} onClick={() => onView(l)} activeId={activeId} onToggle={onToggle} menuId={`lv-${l.id || index}`}
      actions={getActions(l)}
      hoverable title={l.leave_type || l.type || "Leave"} subtitle={`${fmtDate(l.start_date || l.from_date || l.from)} → ${fmtDate(l.end_date || l.to_date || l.to)}`} eyebrow="Leave Record" badge={<Pill value={l.status} />}
      footer={<div className="flex w-full items-center justify-between text-xs text-gray-400"><span>{formatDays(l.total_days || l.days)} day(s)</span><span>{Array.isArray(l.attachments) ? `${l.attachments.length} attachment(s)` : "No attachments"}</span></div>}
    >
      {l.reason && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{l.reason}</p>}
    </ManagementCard>
  );
  return { columns, cardRenderer, getActions, rowKey: "id" };
}

// ─── CREATE SALARY MODAL ─────────────────────────────────────────────────────

function CreateSalaryModal({ isOpen, onClose, employeeId, onSuccess }) {
  const [packages, setPackages] = useState([]);
  const [availableComponents, setAvailableComponents] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [formData, setFormData] = useState({
    component_package_id: '',
    base_amount: '',
    effective_from: getCurrentMonthDate(),
    effective_to: '',
    components: [],
  });

  const existingComponentIds = useMemo(() => formData.components.map((c) => c.component_id), [formData.components]);
  const filteredAvailableComponents = useMemo(() => availableComponents.filter((c) => !existingComponentIds.includes(c.id)), [availableComponents, existingComponentIds]);

  useEffect(() => {
    if (!isOpen) return;
    loadSalaryPackages();
    loadSalaryComponents();
  }, [isOpen]);

  const loadSalaryPackages = async () => {
    setLoadingPackages(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      const response = await apiCall('/salary/components/packages', 'GET', null, company?.id);
      const result = await response.json();
      if (result.success) setPackages(result.data || []);
    } catch (error) {
      console.error('Failed to load salary packages:', error);
    } finally {
      setLoadingPackages(false);
    }
  };

  const loadSalaryComponents = async () => {
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      const response = await apiCall('/salary/components/list', 'GET', null, company?.id);
      const result = await response.json();
      if (result.success) setAvailableComponents(result.data || []);
    } catch (error) {
      console.error('Failed to load salary components:', error);
    }
  };

  const handlePackageChange = (packageId) => {
    const pkg = packages.find((item) => String(item.id) === String(packageId));
    if (!pkg) return;
    const packageComponents = (pkg.items || []).map((item) => ({
      component_id: item.component_id,
      calc_type: item.calc_type || 'percentage',
      calc_value: item.calc_value ?? '',
      reason: item.reason || '',
    }));
    setFormData((prev) => ({ ...prev, component_package_id: packageId, components: packageComponents }));
  };

  const resetForm = () => {
    setFormData({ component_package_id: '', base_amount: '', effective_from: getCurrentMonthDate(), effective_to: '', components: [] });
    setShowOverrideForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId) { toast.warning('Employee details are not available.'); return; }
    if (!formData.base_amount || !formData.effective_from) { toast.warning('Base amount and effective from are required.'); return; }

    setSubmitting(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      const payload = {
        employee_id: Number(employeeId),
        base_amount: Number(formData.base_amount),
        effective_from: formData.effective_from,
        effective_to: formData.effective_to || null,
        components: formData.components.map((item) => ({
          component_id: Number(item.component_id),
          calc_type: item.calc_type || 'percentage',
          calc_value: Number(item.calc_value || 0),
          reason: item.reason || '',
        })),
      };

      const response = await apiCall('/salary/assign-salary', 'POST', payload, company?.id);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to create salary');

      toast.success('Salary created successfully');
      onSuccess?.();
      onClose();
      resetForm();
    } catch (error) {
      toast.error(error.message || 'Failed to create salary');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { resetForm(); onClose(); }}
      title="Create Salary"
      subtitle="Assign a new salary profile to this employee"
      icon={<FaMoneyBillWave className="text-green-600" />}
      size="4xl"
      footer={
        <>
          <button type="button" onClick={() => { resetForm(); onClose(); }} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={submitting} className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-200">
            {submitting ? <FaSpinner className="animate-spin" /> : <FaSave />}
            {submitting ? 'Creating…' : 'Create Salary'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Effective From *</label>
            <AdvancedDateFilter
              tabOptions={['month']}
              value={formData.effective_from ? { month: Number(formData.effective_from.split('-')[1]), year: Number(formData.effective_from.split('-')[0]) } : null}
              onChange={(val) => setFormData((prev) => ({ ...prev, effective_from: val && val.month && val.year ? `${val.year}-${String(val.month).padStart(2, '0')}-01` : '' }))}
              placeholder="Select month"
              buttonClassName="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-green-500/10 focus:border-green-500 outline-none text-left text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Effective To</label>
            <AdvancedDateFilter
              tabOptions={['month']}
              value={formData.effective_to ? { month: Number(formData.effective_to.split('-')[1]), year: Number(formData.effective_to.split('-')[0]) } : null}
              onChange={(val) => setFormData((prev) => ({ ...prev, effective_to: val && val.month && val.year ? `${val.year}-${String(val.month).padStart(2, '0')}-01` : '' }))}
              placeholder="Optional"
              buttonClassName="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-green-500/10 focus:border-green-500 outline-none text-left text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Salary Package (Quick Fill)</label>
            <SelectField
              value={formData.component_package_id ? { value: formData.component_package_id, label: packages.find((p) => String(p.id) === String(formData.component_package_id))?.name || 'Custom / Manual' } : null}
              onChange={(opt) => handlePackageChange(opt?.value || '')}
              options={packages.map((pkg) => ({ value: pkg.id, label: `${pkg.name} (${pkg.code})` }))}
              isLoading={loadingPackages}
              isClearable
              placeholder={loadingPackages ? 'Loading packages...' : 'Custom / Manual'}
              menuPortalTarget={document.body}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Base Amount *</label>
            <input
              type="text"
              inputMode="decimal"
              value={formData.base_amount}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.]/g, '');
                if (value === '' || /^\d*\.?\d*$/.test(value)) setFormData((prev) => ({ ...prev, base_amount: value }));
              }}
              placeholder="Enter amount"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-green-500/10 focus:border-green-500 outline-none transition-all text-sm font-semibold"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <FaCalculator className="text-green-500" /> Salary Components
            </label>
            <button type="button" onClick={() => setShowOverrideForm(true)} className="text-[10px] px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-all font-bold border border-green-200 shadow-sm flex items-center gap-1.5 uppercase tracking-wider">
              <FaPlus size={8} /> Add Component
            </button>
          </div>

          {formData.components.length > 0 && (
            <div className="space-y-3 mb-3">
              {formData.components.map((comp, idx) => {
                const componentData = availableComponents.find((item) => String(item.id) === String(comp.component_id));
                return (
                  <div key={`${comp.component_id}-${idx}`} className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      <div className="md:col-span-4">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Component</label>
                        <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 truncate">{componentData?.name || `Component ${comp.component_id}`} <span className="text-[10px] text-slate-400 font-mono">({componentData?.code})</span></div>
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Type</label>
                        <SelectField
                          value={comp.calc_type ? { value: comp.calc_type, label: comp.calc_type === 'percentage' ? 'Percentage (%)' : 'Fixed Amount' } : null}
                          onChange={(opt) => {
                            const updated = [...formData.components];
                            updated[idx].calc_type = opt?.value || 'percentage';
                            setFormData((prev) => ({ ...prev, components: updated, component_package_id: '' }));
                          }}
                          options={[{ value: 'percentage', label: 'Percentage (%)' }, { value: 'fixed', label: 'Fixed Amount' }]}
                          placeholder="Select type"
                          menuPortalTarget={document.body}
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Value</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={comp.calc_value ?? ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              const updated = [...formData.components];
                              updated[idx].calc_value = value;
                              setFormData((prev) => ({ ...prev, components: updated, component_package_id: '' }));
                            }
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-bold focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all"
                        />
                      </div>
                      <div className="md:col-span-2 flex justify-end pb-0.5">
                        <button type="button" onClick={() => { const updated = formData.components.filter((_, index) => index !== idx); setFormData((prev) => ({ ...prev, components: updated, component_package_id: '' })); }} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><FaTimes size={14} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showOverrideForm && (
            <div className="mt-4 p-4 bg-green-50/50 rounded-xl border-2 border-dashed border-green-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-green-900 uppercase tracking-widest">Select Component to Add</p>
                <button type="button" onClick={() => setShowOverrideForm(false)} className="text-slate-400 hover:text-slate-600"><FaTimes size={12} /></button>
              </div>
              <SelectField
                value={null}
                onChange={(opt) => {
                  if (!opt) return;
                  const comp = filteredAvailableComponents.find((item) => String(item.id) === String(opt.value));
                  if (!comp) return;
                  setFormData((prev) => ({ ...prev, components: [...prev.components, { component_id: comp.id, calc_type: comp.calc_type || 'percentage', calc_value: comp.calc_value || '', reason: '' }], component_package_id: '' }));
                  setShowOverrideForm(false);
                }}
                options={filteredAvailableComponents.map((comp) => ({ value: comp.id, label: `${comp.name} (${comp.code})` }))}
                placeholder="Choose a component..."
                menuPortalTarget={document.body}
              />
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}

// ─── TRANSFER PERMISSION PACKAGE MODAL ──────────────────────────────────────

function TransferPackageModal({ isOpen, onClose, employeeId, employeeName, onSuccess }) {
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingPackages(true);
    const companyStr = localStorage.getItem("company");
    const companyId = companyStr ? JSON.parse(companyStr)?.id : null;
    apiCall("/permissions/permission-packages", "GET", null, companyId)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setPackages(json.data || []);
      })
      .catch((err) => console.error("Failed to load packages", err))
      .finally(() => setLoadingPackages(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPackageId) {
      toast.warning("Please select a permission package");
      return;
    }
    setSubmitting(true);
    try {
      const companyStr = localStorage.getItem("company");
      const companyId = companyStr ? JSON.parse(companyStr)?.id : null;
      const response = await apiCall("/permissions/transfer-packages", "PUT", {
        assignments: [{ employee_id: Number(employeeId), package_id: Number(selectedPackageId) }]
      }, companyId);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to assign package");
      toast.success(result.message || "Permission package assigned successfully");
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to assign package");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer / Assign Permission Package"
      subtitle={`Assign permission package for ${employeeName || "Employee"}`}
      icon={<FaShieldAlt className="text-indigo-600" />}
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={submitting} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={submitting || !selectedPackageId} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-50">
            {submitting ? <FaSpinner className="animate-spin" size={12} /> : <FaSave size={12} />}
            {submitting ? "Assigning..." : "Assign Package"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Permission Package</label>
          <SelectField
            value={packages.map(p => ({ value: p.id, label: `${p.package_name || p.name} (${p.group_code || 'Code'})` })).find(opt => String(opt.value) === String(selectedPackageId)) || null}
            onChange={(opt) => setSelectedPackageId(opt?.value || "")}
            options={packages.map(p => ({ value: p.id, label: `${p.package_name || p.name} (${p.group_code || 'Code'})` }))}
            isLoading={loadingPackages}
            placeholder={loadingPackages ? "Loading packages..." : "Select permission package"}
            menuPortalTarget={document.body}
          />
        </div>
      </form>
    </Modal>
  );
}

// ─── SHARE SHIFT SCHEDULE MODAL ─────────────────────────────────────────────

function ShareShiftModal({ isOpen, onClose, employeeId, employeeEmail, month, year, onSuccess }) {
  const [targetEmail, setTargetEmail] = useState(employeeEmail || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (employeeEmail) setTargetEmail(employeeEmail);
  }, [employeeEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const companyStr = localStorage.getItem("company");
      const companyId = companyStr ? JSON.parse(companyStr)?.id : null;
      const response = await apiCall("/shifts/send-email", "POST", {
        employee_id: employeeId,
        month,
        year,
        email: targetEmail.trim()
      }, companyId);
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
          <button type="button" onClick={onClose} disabled={submitting} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={submitting} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50">
            {submitting ? <FaSpinner className="animate-spin" size={12} /> : <FaEnvelope size={12} />}
            {submitting ? "Sending..." : "Send Email"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recipient Email</label>
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

// ─── GENERIC TAB CONTENT ──────────────────────────────────────────────────────

function TabContent({ tabKey, tabLabel, tabIcon, employeeId, refreshKey = 0 }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [warn, setWarn] = useState(false);
  const [viewMode, setViewMode] = useState("table");
  const [activeMenu, setActiveMenu] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedLogItem, setSelectedLogItem] = useState(null);
  const [profileLeaveAction, setProfileLeaveAction] = useState(null);
  const [profileLeaveSubmitting, setProfileLeaveSubmitting] = useState(false);
  const [showCreateSalaryModal, setShowCreateSalaryModal] = useState(false);
  const [showCreatePayrollModal, setShowCreatePayrollModal] = useState(false);
  const [showCreateLeaveModal, setShowCreateLeaveModal] = useState(false);
  const [showTransferPackageModal, setShowTransferPackageModal] = useState(false);
  const [showShareShiftModal, setShowShareShiftModal] = useState(false);
  const [leaveTypeOptions, setLeaveTypeOptions] = useState([]);
  const [leaveTypeLoading, setLeaveTypeLoading] = useState(false);
  const [creatingLeave, setCreatingLeave] = useState(false);
  const [leaveCreateForm, setLeaveCreateForm] = useState({ employee_id: employeeId || "", leave_config_id: "", start_date: "", end_date: "", remarks: "" });
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const [sendPayrollPdf, setSendPayrollPdf] = useState(true);
  const [payrollDownloadItem, setPayrollDownloadItem] = useState(null);
  const [payrollEmailItem, setPayrollEmailItem] = useState(null);
  const [payrollPdfIsSummary, setPayrollPdfIsSummary] = useState(true);
  const [payrollEmailOverride, setPayrollEmailOverride] = useState("");
  const [downloadingPayrollPdf, setDownloadingPayrollPdf] = useState(false);
  const [emailingPayrollPdf, setEmailingPayrollPdf] = useState(false);
  const [permissionPackage, setPermissionPackage] = useState(null);

  const [showEditSalaryModal, setShowEditSalaryModal] = useState(false);
  const [showReviseSalaryModal, setShowReviseSalaryModal] = useState(false);
  const [showDeleteSalaryModal, setShowDeleteSalaryModal] = useState(false);
  const [salaryToEdit, setSalaryToEdit] = useState(null);
  const [salaryToRevise, setSalaryToRevise] = useState(null);
  const [salaryToDelete, setSalaryToDelete] = useState(null);
  const [deletingSalary, setDeletingSalary] = useState(false);

  const [subType, setSubType] = useState("attendance");
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2026, i, 1).toLocaleString('en-US', { month: 'long' }) })), []);
  const yearOptions = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ value: new Date().getFullYear() - 2 + i, label: String(new Date().getFullYear() - 2 + i) })), []);
  const [downloadingShiftPdf, setDownloadingShiftPdf] = useState(false);
  const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 10);
  const fetchRef = useRef(false);
  const mountedRef = useRef(false);
  const normalizedTabKey = tabKey === "leave" ? "leaves" : tabKey === "shift" ? "shifts" : tabKey;
  const isAttendance = normalizedTabKey === "attendance";

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const ACCENT_MAP = { basic: "slate", permissions: "indigo", attendance: "blue", salary: "green", payroll: "emerald", leaves: "amber", shifts: "violet" };
  const accent = ACCENT_MAP[normalizedTabKey] || "indigo";



  // ── fetchData FIRST ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async (page, limit) => {
    if (fetchRef.current) return;
    fetchRef.current = true;
    try {
      if (mountedRef.current) { setLoading(true); setWarn(false); }
      const { res, json } = await runDedupedRequest(
        `employee:${employeeId}:tab:${normalizedTabKey}:sub:${isAttendance ? subType : "none"}:page:${page}:limit:${limit}`,
        async () => {
          const companyStr = localStorage.getItem("company");
          const companyId = companyStr ? JSON.parse(companyStr)?.id : null;
          let response;
          if (normalizedTabKey === "permissions") {
            // New dedicated endpoint for permissions (returns package + permissions)
            response = await apiCall(`/permissions/employee-package/${employeeId}`, "GET", null, companyId);
          } else {
            response = await apiCall(
              `/employees/${employeeId}?include=${normalizedTabKey}${isAttendance ? `&sub-tab=${subType}` : ""}&page=${page}&limit=${limit}`,
              "GET", null, companyId
            );
          }
          const data = await response.json();
          return { res: response, json: data };
        }
      );
      if (!res.ok || !json.success) throw new Error(json.message || "API error");

      let rawData = json.data?.[normalizedTabKey] ?? json.data?.[tabKey] ?? json.data ?? [];

      if (normalizedTabKey === "payroll" && Array.isArray(rawData)) {
        rawData = rawData.map((item) => item?.payroll ?? item).filter(Boolean);
      }

      if (normalizedTabKey === "salary" && rawData && !Array.isArray(rawData) && Array.isArray(rawData.salary)) {
        rawData = rawData.salary;
      }

      const dataArr = Array.isArray(rawData) ? rawData : rawData && typeof rawData === "object" ? [rawData] : [];
      const normalizedRows = normalizedTabKey === "attendance"
        ? dataArr.map(normalizeAttendanceRecord)
        : dataArr;
      const meta = json.meta?.[normalizedTabKey] ?? json.meta?.[tabKey] ?? json.meta ?? {};

      if (mountedRef.current) {
        setRows(normalizedRows);
        updatePagination({
          page: Number(meta.page ?? page),
          limit: Number(meta.limit ?? limit),
          total: Number(meta.total ?? normalizedRows.length),
          total_pages: Number(meta.total_pages ?? 1),
          is_last_page: meta.is_last_page ?? true,
        });
      }
    } catch {
      if (mountedRef.current) {
        setRows([]);
        setWarn(true);
        updatePagination({ page, limit, total: 0, total_pages: 1, is_last_page: true });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
      fetchRef.current = false;
    }
  }, [employeeId, isAttendance, subType, normalizedTabKey, tabKey, updatePagination]);

  // ── handleDeleteSalary AFTER (fetchData now exists) ──────────────────────────
  const handleDeleteSalary = useCallback(async () => {
    if (!salaryToDelete) return;
    setDeletingSalary(true);
    try {
      const companyStr = localStorage.getItem("company");
      const companyId = companyStr ? JSON.parse(companyStr)?.id : null;
      const response = await apiCall("/salary/delete-salary", "DELETE", { salary_id: salaryToDelete.salary_id }, companyId);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to delete salary");
      toast.success("Salary deleted successfully");
      setShowDeleteSalaryModal(false);
      setSalaryToDelete(null);
      fetchData(pagination.page, pagination.limit);
    } catch (error) {
      toast.error(error.message || "Failed to delete salary");
    } finally {
      setDeletingSalary(false);
    }
  }, [salaryToDelete, fetchData, pagination.page, pagination.limit]);

  useEffect(() => {
    const page = normalizedTabKey === "permissions" ? 1 : pagination.page;
    const limit = normalizedTabKey === "permissions" ? 1000 : pagination.limit;
    fetchData(page, limit);
  }, [normalizedTabKey, subType, pagination.page, pagination.limit, refreshKey]);

  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    let t;
    const onResize = () => { clearTimeout(t); t = setTimeout(() => setWindowWidth(window.innerWidth), 150); };
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(t); window.removeEventListener("resize", onResize); };
  }, []);
  const sidebarOffset = windowWidth >= 1024 ? 280 : (windowWidth >= 768 ? 80 : 0);
  const effectiveWidth = windowWidth - sidebarOffset;

  const onView = (item) => setSelectedItem(item);
  const onViewLogs = (item) => setSelectedLogItem(item);

  const submitProfileLeaveAction = useCallback(async ({ id, start_date, end_date, is_half_day, half_day_type, remarks }) => {
    if (!id) return;
    setProfileLeaveSubmitting(true);
    try {
      const companyStr = localStorage.getItem("company");
      const companyId = companyStr ? JSON.parse(companyStr)?.id : null;
      const isApprove = profileLeaveAction?.action === "approve";
      const response = await apiCall(
        isApprove ? "/leave/management/approve-edit" : "/leave/management/bulk-approve-reject",
        "PUT",
        isApprove
          ? { id, start_date, end_date, is_half_day, half_day_type, remarks }
          : { ids: [id], action: "reject", remarks },
        companyId
      );
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to update leave");
      toast.success(result.message || (isApprove ? "Leave approved successfully" : "Leave rejected successfully"));
      setProfileLeaveAction(null);
      fetchData(pagination.page, pagination.limit);
    } catch (error) {
      toast.error(error.message || "Failed to update leave");
    } finally {
      setProfileLeaveSubmitting(false);
    }
  }, [fetchData, pagination.limit, pagination.page, profileLeaveAction]);

  const getPayrollPeriodLabel = useCallback((payroll) => {
    if (payroll?.month && payroll?.year) {
      return new Date(payroll.year, payroll.month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    }
    return fmtMonthYear(payroll?.payroll_period || payroll?.period || payroll?.month);
  }, []);

  const getPayrollPdfFilename = useCallback((payroll) => {
    const month = Number(payroll?.month);
    const year = Number(payroll?.year);
    const normalizedMonth = Number.isFinite(month) ? String(month).padStart(2, "0") : "month";
    const normalizedYear = Number.isFinite(year) ? String(year) : "year";
    return `${normalizedMonth}_${normalizedYear}_payroll.pdf`;
  }, []);

  const openPayrollDownloadModal = useCallback((payroll) => {
    if (!payroll?.id) {
      toast.error("Payroll entry ID not found");
      return;
    }
    setPayrollDownloadItem(payroll);
    setPayrollPdfIsSummary(true);
    setActiveMenu(null);
  }, []);

  const openPayrollEmailModal = useCallback((payroll) => {
    if (!payroll?.id) {
      toast.error("Payroll entry ID not found");
      return;
    }
    setPayrollEmailItem(payroll);
    setPayrollPdfIsSummary(true);
    setPayrollEmailOverride("");
    setActiveMenu(null);
  }, []);

  const closePayrollDownloadModal = useCallback(() => {
    if (!downloadingPayrollPdf) setPayrollDownloadItem(null);
  }, [downloadingPayrollPdf]);

  const closePayrollEmailModal = useCallback(() => {
    if (!emailingPayrollPdf) setPayrollEmailItem(null);
  }, [emailingPayrollPdf]);

  const handleConfirmPayrollDownload = useCallback(async () => {
    if (!payrollDownloadItem?.id) return;
    const currentPayroll = payrollDownloadItem;
    setPayrollDownloadItem(null);
    setDownloadingPayrollPdf(true);
    try {
      const companyStr = localStorage.getItem("company");
      const companyId = companyStr ? JSON.parse(companyStr)?.id : null;
      const response = await apiCall(
        "/payroll/download",
        "POST",
        { payroll_entry_id: currentPayroll.id, type: payrollPdfIsSummary ? "summary" : "detailed" },
        companyId
      );

      if (!response.ok) {
        let errorMessage = "Failed to download payslip";
        try {
          const errorResult = await response.json();
          errorMessage = errorResult?.message || errorMessage;
        } catch {
          // Keep fallback when the server does not return JSON.
        }
        throw new Error(errorMessage);
      }

      const filename = getPayrollPdfFilename(currentPayroll);
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const result = await response.json();
        const fileUrl = result.url || result.file_url || result.data?.url || result.data?.file_url;
        if (!result.success || !fileUrl) throw new Error(result.message || "Failed to download payslip");
        try {
          const fileResponse = await fetch(fileUrl);
          if (!fileResponse.ok) throw new Error("Unable to fetch PDF file");
          const fileBlob = await fileResponse.blob();
          downloadBlob(fileBlob, filename);
        } catch {
          triggerFileDownload(fileUrl, filename);
        }
        toast.success(result.message || "Payslip downloaded successfully");
      } else {
        const blob = await response.blob();
        downloadBlob(blob, filename);
        toast.success("Payslip downloaded successfully");
      }
    } catch (error) {
      toast.error(error.message || "Failed to download payslip");
    } finally {
      setDownloadingPayrollPdf(false);
    }
  }, [getPayrollPdfFilename, payrollDownloadItem, payrollPdfIsSummary]);

  const handleConfirmPayrollEmail = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!payrollEmailItem?.id) return;
    const currentPayroll = payrollEmailItem;
    setPayrollEmailItem(null);
    setEmailingPayrollPdf(true);
    try {
      const companyStr = localStorage.getItem("company");
      const companyId = companyStr ? JSON.parse(companyStr)?.id : null;
      const payload = { payroll_entry_id: [currentPayroll.id], type: payrollPdfIsSummary ? "summary" : "details" };
      if (payrollEmailOverride.trim()) {
        payload.email = payrollEmailOverride.trim();
      }
      const response = await apiCall("/payroll/send-email", "POST", payload, companyId);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to send email");
      toast.success(result.message || "Payslip email sent successfully");
      setPayrollEmailOverride("");
    } catch (error) {
      toast.error(error.message || "Failed to send email");
    } finally {
      setEmailingPayrollPdf(false);
    }
  }, [payrollEmailItem, payrollEmailOverride, payrollPdfIsSummary]);

  const handleDownloadShiftPdf = useCallback(async () => {
    if (!employeeId) return;
    setDownloadingShiftPdf(true);
    try {
      const companyStr = localStorage.getItem("company");
      const companyId = companyStr ? JSON.parse(companyStr)?.id : null;
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const response = await apiCall(`/shifts/download?employee_id=${employeeId}&month=${month}&year=${year}`, "GET", null, companyId);
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/pdf") || contentType.includes("application/octet-stream")) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        window.open(blobUrl, "_blank", "noopener,noreferrer");
        return;
      }
      const result = await response.json();
      if (result?.success && result?.url) { window.open(result.url, "_blank", "noopener,noreferrer"); return; }
      throw new Error(result?.message || "Failed to download shift PDF");
    } catch (error) {
      toast.error(error?.message || "Failed to download shift PDF");
    } finally {
      setDownloadingShiftPdf(false);
    }
  }, [employeeId]);

  const fetchLeaveTypes = useCallback(async () => {
    setLeaveTypeLoading(true);
    try {
      const companyStr = localStorage.getItem("company");
      const companyId = companyStr ? JSON.parse(companyStr)?.id : null;
      const response = await apiCall("/leave/company", "GET", null, companyId);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to load leave types");
      const options = (result.data || []).map((item) => ({
        value: String(item.leave_config_id || item.id),
        label: `${item.name || item.leave_type || "Leave"}${item.code ? ` (${item.code})` : ""}`,
        ...item,
      }));
      setLeaveTypeOptions(options);
    } catch (error) {
      toast.error(error.message || "Failed to load leave types");
      setLeaveTypeOptions([]);
    } finally {
      setLeaveTypeLoading(false);
    }
  }, []);

  const handleCreateLeaveClick = useCallback(() => {
    if (!employeeId) { toast.warning("Employee details are not available."); return; }
    setLeaveCreateForm({ employee_id: String(employeeId), leave_config_id: "", start_date: "", end_date: "", remarks: "" });
    setShowCreateLeaveModal(true);
    fetchLeaveTypes();
  }, [employeeId, fetchLeaveTypes]);

  const handleCreateLeaveSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!leaveCreateForm.employee_id) { toast.warning("Employee details are not available."); return; }
    if (!leaveCreateForm.leave_config_id) { toast.warning("Please select a leave type."); return; }
    if (!leaveCreateForm.start_date || !leaveCreateForm.end_date) { toast.warning("Please select a leave date range."); return; }
    if (leaveCreateForm.end_date < leaveCreateForm.start_date) { toast.warning("End date cannot be before start date."); return; }

    setCreatingLeave(true);
    try {
      const companyStr = localStorage.getItem("company");
      const companyId = companyStr ? JSON.parse(companyStr)?.id : null;
      const payload = {
        employee_id: Number(leaveCreateForm.employee_id),
        leave_config_id: String(leaveCreateForm.leave_config_id),
        start_date: leaveCreateForm.start_date,
        end_date: leaveCreateForm.end_date,
        is_half_day: 0,
        attachments: [],
        remarks: leaveCreateForm.remarks || "",
      };
      const response = await apiCall("/leave/management/create/", "POST", payload, companyId);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to create leave");
      toast.success("Leave created successfully");
      setShowCreateLeaveModal(false);
      fetchData(pagination.page, pagination.limit);
    } catch (error) {
      toast.error(error.message || "Failed to create leave");
    } finally {
      setCreatingLeave(false);
    }
  }, [fetchData, leaveCreateForm, pagination.limit, pagination.page]);

  const handleCreatePayrollClick = useCallback(() => {
    if (!employeeId) { toast.warning("Employee details are not available."); return; }
    setPayrollMonth(new Date().getMonth() + 1);
    setPayrollYear(new Date().getFullYear());
    setSendPayrollPdf(true);
    setShowCreatePayrollModal(true);
  }, [employeeId]);

  const handleCreatePayrollSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!employeeId) { toast.warning("Employee details are not available."); return; }
    try {
      const companyStr = localStorage.getItem("company");
      const companyId = companyStr ? JSON.parse(companyStr)?.id : null;
      const payload = {
        month: Number(payrollMonth),
        year: Number(payrollYear),
        employee_id: [Number(employeeId)],
        send_pdf: Boolean(sendPayrollPdf),
      };
      const response = await apiCall("/payroll/generate-payroll", "POST", payload, companyId);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to generate payroll");
      toast.success("Payroll generated successfully");
      setShowCreatePayrollModal(false);
      fetchData(pagination.page, pagination.limit);
    } catch (error) {
      toast.error(error.message || "Failed to generate payroll");
    }
  }, [employeeId, fetchData, pagination.limit, pagination.page, payrollMonth, payrollYear, sendPayrollPdf]);

  const handleCreateSalarySuccess = useCallback(() => {
    setShowCreateSalaryModal(false);
    fetchData(pagination.page, pagination.limit);
  }, [fetchData, pagination.limit, pagination.page]);

  const permConfig = usePermissionsConfig(onView, effectiveWidth);
  const attConfig = useAttendanceConfig(onView, onViewLogs, effectiveWidth, subType);
  // Replace the existing salConfig line:
  const salConfig = useSalaryConfig(
    onView,
    (s) => { setSalaryToEdit(s); setShowEditSalaryModal(true); },
    (s) => { setSalaryToRevise(s); setShowReviseSalaryModal(true); },
    (s) => { setSalaryToDelete(s); setShowDeleteSalaryModal(true); },
    effectiveWidth
  );


  const payConfig = usePayrollConfig(onView, openPayrollDownloadModal, openPayrollEmailModal, effectiveWidth);
  const leaveConfig = useLeaveConfig(
    onView,
    (leave) => setProfileLeaveAction({ leave, action: "approve" }),
    (leave) => setProfileLeaveAction({ leave, action: "reject" }),
    effectiveWidth
  );
  const shiftConfig = useShiftConfig(onView, effectiveWidth);

  const CONFIG_MAP = { permissions: permConfig, attendance: attConfig, salary: salConfig, payroll: payConfig, leaves: leaveConfig, shifts: shiftConfig };
  const activeConfig = CONFIG_MAP[normalizedTabKey] || permConfig;
  const { columns, cardRenderer, rowKey } = activeConfig;
  const hasToolbarActions = normalizedTabKey === "shifts" || normalizedTabKey === "leaves" || normalizedTabKey === "salary" || normalizedTabKey === "payroll";

  // Update getActions to include salary actions:
  const getActions = (row) => {
    const base = [{ label: "View Details", icon: <FaEye size={13} />, onClick: () => setSelectedItem(row), className: "text-blue-600 hover:text-blue-700 hover:bg-blue-50" }];
    if (normalizedTabKey === "attendance") {
      base.push({ label: "View History", icon: <FaHistory size={13} />, onClick: () => setSelectedLogItem(row), className: "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" });
    }
    if (normalizedTabKey === "leaves" && row.status === "pending") {
      base.push(
        { label: "Approve / Edit", icon: <FaCheckCircle size={13} />, onClick: () => setProfileLeaveAction({ leave: row, action: "approve" }), className: "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" },
        { label: "Reject", icon: <FaTimesCircle size={13} />, onClick: () => setProfileLeaveAction({ leave: row, action: "reject" }), className: "text-rose-600 hover:text-rose-700 hover:bg-rose-50" }
      );
    }
    if (normalizedTabKey === "salary") {
      if (row.payroll_used) {
        base.push({ label: "Revise Salary", icon: <FaExchangeAlt size={13} />, onClick: () => { setSalaryToRevise(row); setShowReviseSalaryModal(true); }, className: "text-purple-600 hover:text-purple-700 hover:bg-purple-50" });
      } else {
        base.push({ label: "Edit Salary", icon: <FaEdit size={13} />, onClick: () => { setSalaryToEdit(row); setShowEditSalaryModal(true); }, className: "text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" });
      }
      base.push({ label: "Delete", icon: <FaTrash size={13} />, onClick: () => { setSalaryToDelete(row); setShowDeleteSalaryModal(true); }, className: "text-red-600 hover:text-red-700 hover:bg-red-50" });
    }
    if (normalizedTabKey === "payroll") {
      base.push(
        { label: "Download PDF", icon: <FaDownload size={13} />, onClick: () => openPayrollDownloadModal(row), className: "text-blue-600 hover:text-blue-700 hover:bg-blue-50" },
        { label: "Send Email", icon: <FaEnvelope size={13} />, onClick: () => openPayrollEmailModal(row), className: "text-purple-600 hover:text-purple-700 hover:bg-purple-50" }
      );
    }
    return base;
  };

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {(downloadingPayrollPdf || emailingPayrollPdf) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center"
          >
            <FaSpinner className={`animate-spin text-5xl mb-4 ${downloadingPayrollPdf ? "text-emerald-600" : "text-purple-600"}`} />
            <p className="text-gray-800 font-semibold shadow-sm px-5 py-2.5 bg-white rounded-xl border border-gray-100 flex items-center gap-2">
              {downloadingPayrollPdf ? (
                <>
                  <FaFilePdf className="text-emerald-500" />
                  Preparing PDF Payslip...
                </>
              ) : (
                <>
                  <FaEnvelope className="text-purple-500" />
                  Sending Email...
                </>
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {warn && <p className="text-xs text-amber-500">⚠ Could not load data from API — list may be empty.</p>}

      {normalizedTabKey === "attendance" && (
        <div className="mb-2">
          <AttendanceTypeTabs value={subType} onChange={(val) => { setSubType(val); goToPage(1); }} />
        </div>
      )}

      {!loading && (rows.length > 0 || hasToolbarActions) && (
        <div className="flex p-2 bg-white rounded-xl shadow-lg items-center justify-between">
          <p className="text-md text-blue-700 px-4 font-semibold flex items-center gap-2">
            {tabIcon}{tabLabel}
          </p>
          <div className="flex items-center gap-2 flex-row justify-end">
            {normalizedTabKey === "permissions" && (
              <button
                type="button"
                onClick={() => setShowTransferPackageModal(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm transition-all hover:bg-indigo-100"
              >
                <FaExchangeAlt size={10} /> Transfer Package
              </button>
            )}
            {normalizedTabKey === "shifts" && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadShiftPdf}
                  disabled={downloadingShiftPdf}
                  className="inline-flex whitespace-nowrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloadingShiftPdf ? <FaSpinner className="animate-spin" size={10} /> : <FaFilePdf size={10} />}
                  {downloadingShiftPdf ? "Preparing PDF…" : "Download PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowShareShiftModal(true)}
                  className="inline-flex whitespace-nowrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-700 shadow-sm transition-all hover:bg-indigo-100"
                >
                  <FaEnvelope size={10} /> Share Shift
                </button>
              </>
            )}
            {normalizedTabKey === "leaves" && (
              <button type="button" onClick={handleCreateLeaveClick} className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm transition-all hover:bg-amber-100">
                <FaPlus size={10} /> Create
              </button>
            )}
            {normalizedTabKey === "salary" && (
              <button type="button" onClick={() => setShowCreateSalaryModal(true)} className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 shadow-sm transition-all hover:bg-green-100">
                <FaPlus size={10} /> Create
              </button>
            )}
            {normalizedTabKey === "payroll" && (
              <button type="button" onClick={handleCreatePayrollClick} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100">
                <FaPlus size={10} /> Create
              </button>
            )}
            {rows.length > 0 && normalizedTabKey !== "permissions" && (
              <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent={accent} />
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center py-10 gap-2 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-sm">Loading {tabLabel.toLowerCase()}…</span>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3"><FaEye size={20} className="text-gray-200" /></div>
          <p className="text-sm font-medium">No {tabLabel.toLowerCase()} records found</p>
        </div>
      )}

      {!loading && rows.length > 0 && normalizedTabKey === "permissions" && (
        <CategoryPermissionSelector
          allPermissions={rows.map(r => ({
            ...r,
            category: r.category || (r.code ? r.code.split('_')[0].replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown')
          }))}
          selectedIds={rows.map(r => r.id)}
          readOnly={true}
          listHeightClass="max-h-[60vh]"
        />
      )}

      {!loading && rows.length > 0 && normalizedTabKey !== "permissions" && viewMode === "table" && (
        <ManagementTable rows={rows} columns={columns} rowKey={rowKey} onRowClick={onView} activeId={activeMenu} onToggleAction={(e, id) => setActiveMenu((c) => (c === id ? null : id))} getActions={getActions} accent={accent} headerClassName="xsm:hidden" />
      )}

      {!loading && rows.length > 0 && normalizedTabKey !== "permissions" && viewMode === "card" && (
        <ManagementGrid viewMode={viewMode}>
          {rows.map((row, idx) => cardRenderer(row, idx, activeMenu, (e, id) => setActiveMenu((c) => (c === id ? null : id))))}
        </ManagementGrid>
      )}

      {!loading && rows.length > 0 && normalizedTabKey !== "permissions" && (
        <Pagination currentPage={pagination.page} totalItems={pagination.total} itemsPerPage={pagination.limit} onPageChange={goToPage} onLimitChange={changeLimit} className="mt-2" />
      )}

      <AnimatePresence>
        {showCreateLeaveModal && normalizedTabKey === "leaves" && (
          <Modal
            isOpen={showCreateLeaveModal}
            onClose={() => setShowCreateLeaveModal(false)}
            title="Create Leave"
            subtitle="Create a leave request for this employee"
            icon={<FaUmbrellaBeach className="text-amber-600" />}
            size="lg"
            footer={
              <>
                <button type="button" onClick={() => setShowCreateLeaveModal(false)} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">Cancel</button>
                <button type="button" onClick={handleCreateLeaveSubmit} disabled={creatingLeave || leaveTypeLoading} className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-200 disabled:opacity-60 disabled:cursor-not-allowed">{creatingLeave ? "Creating..." : "Create Leave"}</button>
              </>
            }
          >
            <form onSubmit={handleCreateLeaveSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Leave Type</label>
                <SelectField
                  value={leaveTypeOptions.find((option) => option.value === leaveCreateForm.leave_config_id) || null}
                  onChange={(option) => setLeaveCreateForm((prev) => ({ ...prev, leave_config_id: option?.value || "" }))}
                  options={leaveTypeOptions}
                  placeholder={leaveTypeLoading ? "Loading leave types..." : "Select leave type"}
                  isLoading={leaveTypeLoading}
                  menuPortalTarget={document.body}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date Range</label>
                <AdvancedDateFilter
                  value={{
                    date: leaveCreateForm.start_date && leaveCreateForm.start_date === leaveCreateForm.end_date ? leaveCreateForm.start_date : "",
                    from_date: leaveCreateForm.start_date && leaveCreateForm.start_date !== leaveCreateForm.end_date ? leaveCreateForm.start_date : "",
                    to_date: leaveCreateForm.end_date && leaveCreateForm.start_date !== leaveCreateForm.end_date ? leaveCreateForm.end_date : "",
                  }}
                  onChange={(result) => {
                    const nextStart = result?.date || result?.from_date || "";
                    const nextEnd = result?.date || result?.to_date || nextStart;
                    setLeaveCreateForm((prev) => ({ ...prev, start_date: nextStart, end_date: nextEnd }));
                  }}
                  tabOptions={["date", "range"]}
                  placeholder="Select leave date range"
                  buttonClassName="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm shadow-sm transition hover:border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-500/10 font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Remarks</label>
                <textarea
                  rows={4}
                  placeholder="Add internal remarks for this leave request"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 resize-none"
                  value={leaveCreateForm.remarks}
                  onChange={(e) => setLeaveCreateForm((prev) => ({ ...prev, remarks: e.target.value }))}
                />
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreatePayrollModal && normalizedTabKey === "payroll" && (
          <Modal
            isOpen={showCreatePayrollModal}
            onClose={() => setShowCreatePayrollModal(false)}
            title="Generate Payroll"
            subtitle="Create payroll for this employee"
            icon={<FaMoneyBillWave className="text-emerald-600" />}
            size="md"
            footer={
              <>
                <button type="button" onClick={() => setShowCreatePayrollModal(false)} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">Cancel</button>
                <button type="button" onClick={handleCreatePayrollSubmit} className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg shadow-emerald-200">Generate Payroll</button>
              </>
            }
          >
            <form onSubmit={handleCreatePayrollSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Month</label>
                  <SelectField value={monthOptions.find((option) => option.value === payrollMonth) || null} onChange={(option) => setPayrollMonth(Number(option?.value || 1))} options={monthOptions} placeholder="Select month" menuPortalTarget={document.body} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Year</label>
                  <SelectField value={yearOptions.find((option) => option.value === payrollYear) || null} onChange={(option) => setPayrollYear(Number(option?.value || new Date().getFullYear()))} options={yearOptions} placeholder="Select year" menuPortalTarget={document.body} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Send payslip PDF</p>
                  <p className="text-xs text-emerald-700/80">Email the generated payslip after payroll creation.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sendPayrollPdf}
                  onClick={() => setSendPayrollPdf((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${sendPayrollPdf ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${sendPayrollPdf ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateSalaryModal && normalizedTabKey === "salary" && (
          <CreateSalaryModal
            isOpen={showCreateSalaryModal}
            onClose={() => setShowCreateSalaryModal(false)}
            employeeId={employeeId}
            onSuccess={handleCreateSalarySuccess}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {payrollDownloadItem && normalizedTabKey === "payroll" && (
          <Modal
            isOpen={!!payrollDownloadItem}
            onClose={closePayrollDownloadModal}
            title="Download Payslip"
            subtitle="Choose format before downloading."
            icon={<FaDownload className="text-blue-600" />}
            size="sm"
            footer={
              <>
                <button
                  type="button"
                  onClick={closePayrollDownloadModal}
                  disabled={downloadingPayrollPdf}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayrollDownload}
                  disabled={downloadingPayrollPdf}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {downloadingPayrollPdf ? <FaSpinner className="animate-spin" size={12} /> : <FaDownload size={12} />}
                  {downloadingPayrollPdf ? "Downloading..." : "Download PDF"}
                </button>
              </>
            }
          >
            <div className="space-y-4 pb-2">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-4">
                <div className="bg-white p-3 rounded-xl shadow-sm text-blue-500 mt-0.5">
                  <FaFilePdf size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-800 text-base truncate">{getPayrollPeriodLabel(payrollDownloadItem)}</h4>
                  <p className="text-sm text-gray-600 mb-1">Payroll record #{payrollDownloadItem.id}</p>
                  <p className="text-xs text-gray-500 font-mono">
                    Net: <span className="text-gray-700 font-medium">{payrollDownloadItem.net_salary != null ? `Rs ${Number(payrollDownloadItem.net_salary).toLocaleString()}` : "N/A"}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-blue-100 bg-blue-50">
                <div>
                  <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <FaFilePdf className="text-blue-500" size={13} />
                    Payslip Format
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {payrollPdfIsSummary ? "Summary - key totals only." : "Details - full breakdown with all components."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold select-none cursor-pointer transition-colors ${!payrollPdfIsSummary ? "text-gray-800" : "text-gray-400"}`} onClick={() => setPayrollPdfIsSummary(false)}>Details</span>
                  <button
                    type="button"
                    onClick={() => setPayrollPdfIsSummary((value) => !value)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${payrollPdfIsSummary ? "bg-blue-500" : "bg-gray-300"}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${payrollPdfIsSummary ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                  <span className={`text-xs font-semibold select-none cursor-pointer transition-colors ${payrollPdfIsSummary ? "text-blue-700" : "text-gray-400"}`} onClick={() => setPayrollPdfIsSummary(true)}>Summary</span>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {payrollEmailItem && normalizedTabKey === "payroll" && (
          <Modal
            isOpen={!!payrollEmailItem}
            onClose={closePayrollEmailModal}
            title="Send Payslip Email"
            subtitle="Confirm and optionally provide an alternate email address."
            icon={<FaEnvelope className="text-purple-600" />}
            size="md"
            footer={
              <>
                <button
                  type="button"
                  onClick={closePayrollEmailModal}
                  disabled={emailingPayrollPdf}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayrollEmail}
                  disabled={emailingPayrollPdf}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {emailingPayrollPdf ? <FaSpinner className="animate-spin" size={12} /> : <FaEnvelope size={12} />}
                  {emailingPayrollPdf ? "Sending..." : "Confirm & Send"}
                </button>
              </>
            }
          >
            <form onSubmit={handleConfirmPayrollEmail} className="space-y-5 pb-2">
              <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl flex items-start gap-4">
                <div className="bg-white p-3 rounded-xl shadow-sm text-purple-500 mt-0.5">
                  <FaFilePdf size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-800 text-base truncate">{getPayrollPeriodLabel(payrollEmailItem)}</h4>
                  <p className="text-sm text-gray-600 mb-1">Payroll record #{payrollEmailItem.id}</p>
                  <p className="text-xs text-gray-500 font-mono">
                    Default Email: <span className="text-gray-700 font-medium">{payrollEmailItem.employee?.email || payrollEmailItem.email || "N/A"}</span>
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Alternate Email Address (Optional)
                </label>
                <div className="relative">
                  <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={payrollEmailOverride}
                    onChange={(event) => setPayrollEmailOverride(event.target.value)}
                    placeholder="Leave blank to use default email"
                    disabled={emailingPayrollPdf}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-1">
                  If provided, the payslip will be sent to this email instead of the employee's registered email.
                </p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-purple-100 bg-purple-50">
                <div>
                  <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <FaFilePdf className="text-purple-500" size={13} />
                    Payslip Type
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {payrollPdfIsSummary ? "Summary - key totals only." : "Details - full breakdown with all components."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold select-none cursor-pointer transition-colors ${!payrollPdfIsSummary ? "text-gray-800" : "text-gray-400"}`} onClick={() => setPayrollPdfIsSummary(false)}>Details</span>
                  <button
                    type="button"
                    onClick={() => setPayrollPdfIsSummary((value) => !value)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${payrollPdfIsSummary ? "bg-purple-500" : "bg-gray-300"}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${payrollPdfIsSummary ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                  <span className={`text-xs font-semibold select-none cursor-pointer transition-colors ${payrollPdfIsSummary ? "text-purple-700" : "text-gray-400"}`} onClick={() => setPayrollPdfIsSummary(true)}>Summary</span>
                </div>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTransferPackageModal && (
          <TransferPackageModal
            isOpen={showTransferPackageModal}
            onClose={() => setShowTransferPackageModal(false)}
            employeeId={employeeId}
            employeeName={rows[0]?.name || "Employee"}
            onSuccess={() => fetchData(pagination.page, pagination.limit)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShareShiftModal && (
          <ShareShiftModal
            isOpen={showShareShiftModal}
            onClose={() => setShowShareShiftModal(false)}
            employeeId={employeeId}
            employeeEmail={rows[0]?.email || ""}
            month={new Date().getMonth() + 1}
            year={new Date().getFullYear()}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedItem && (
          <DetailModal
            isOpen={!!selectedItem}
            onClose={() => setSelectedItem(null)}
            item={selectedItem}
            tabKey={tabKey}
            tabLabel={tabLabel}
            subType={subType}
            onApproveLeave={(leave) => { setSelectedItem(null); setProfileLeaveAction({ leave, action: "approve" }); }}
            onRejectLeave={(leave) => { setSelectedItem(null); setProfileLeaveAction({ leave, action: "reject" }); }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedLogItem && <AttendanceLogsModal id={selectedLogItem.id} type={subType} onClose={() => setSelectedLogItem(null)} />}
      </AnimatePresence>

      <ProfileLeaveActionModal
        leave={profileLeaveAction?.leave}
        action={profileLeaveAction?.action}
        onClose={() => !profileLeaveSubmitting && setProfileLeaveAction(null)}
        onSubmit={submitProfileLeaveAction}
        submitting={profileLeaveSubmitting}
      />

      <AnimatePresence>
        {showCreateSalaryModal && normalizedTabKey === "salary" && (
          <AssignSalaryModal
            isOpen={showCreateSalaryModal}
            onClose={() => setShowCreateSalaryModal(false)}
            onSuccess={() => {
              setShowCreateSalaryModal(false);
              fetchData(pagination.page, pagination.limit);
            }}
            initialEmployeeId={employeeId}
            companyCurrency="INR"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditSalaryModal && salaryToEdit && normalizedTabKey === "salary" && (
          <EditSalaryModal
            isOpen={showEditSalaryModal}
            onClose={() => { setShowEditSalaryModal(false); setSalaryToEdit(null); }}
            onSuccess={() => { setShowEditSalaryModal(false); setSalaryToEdit(null); fetchData(pagination.page, pagination.limit); }}
            salary={salaryToEdit}
            companyCurrency="INR"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReviseSalaryModal && salaryToRevise && normalizedTabKey === "salary" && (
          <ReviseSalaryModal
            isOpen={showReviseSalaryModal}
            onClose={() => { setShowReviseSalaryModal(false); setSalaryToRevise(null); }}
            onSuccess={() => { setShowReviseSalaryModal(false); setSalaryToRevise(null); fetchData(1, pagination.limit); }}
            salary={salaryToRevise}
            companyCurrency="INR"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteSalaryModal && salaryToDelete && normalizedTabKey === "salary" && (
          <DeleteConfirmModal
            isOpen={showDeleteSalaryModal}
            onClose={() => { setShowDeleteSalaryModal(false); setSalaryToDelete(null); }}
            onConfirm={handleDeleteSalary}
            salary={salaryToDelete}
            processingId={deletingSalary ? salaryToDelete?.salary_id : null}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── ATTENDANCE SUB-TAB DISPATCHER ──────────────────────────────────────────
function AttendanceSection({ employee, fallbackId, refreshKey }) {
  return (
    <div className="space-y-4">
      <EmployeeAttendanceCalendar employee={employee} fallbackId={fallbackId} refreshKey={refreshKey} />
    </div>
  );
}

// ─── PAYROLL SUB-TAB DISPATCHER ─────────────────────────────────────────────
function PayrollSection({ employee, employeeId, refreshKey }) {
  const [subTab, setSubTab] = useState("records"); // "records" | "adjustments"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => setSubTab("records")}
          className={`inline-flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all ${subTab === "records"
            ? "bg-emerald-600 text-white shadow-sm"
            : "text-gray-600 hover:text-emerald-700 hover:bg-emerald-50"
            }`}
        >
          <FaCalendarAlt size={12} />
          <span>Payroll Records</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab("adjustments")}
          className={`inline-flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all ${subTab === "adjustments"
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-gray-600 hover:text-indigo-700 hover:bg-indigo-50"
            }`}
        >
          <FaCoins size={12} />
          <span>Adjustments (Bonus / Fine)</span>
        </button>
      </div>

      {subTab === "records" ? (
        <TabContent
          tabKey="payroll"
          tabLabel="Payroll"
          tabIcon={<FaCalendarAlt size={12} />}
          employeeId={employeeId}
          refreshKey={refreshKey}
        />
      ) : (
        <EmployeePayrollAdjustmentsTab employeeId={employeeId} employeeName={employee?.name} />
      )}
    </div>
  );
}

// ─── LEAVES SUB-TAB DISPATCHER ──────────────────────────────────────────────
function LeavesSection({ employee, employeeId, refreshKey }) {
  const [subTab, setSubTab] = useState("requests"); // "requests" | "balances"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => setSubTab("requests")}
          className={`inline-flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all ${subTab === "requests"
            ? "bg-amber-500 text-white shadow-sm"
            : "text-gray-600 hover:text-amber-700 hover:bg-amber-50"
            }`}
        >
          <FaUmbrellaBeach size={12} />
          <span>Leave Requests</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab("balances")}
          className={`inline-flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all ${subTab === "balances"
            ? "bg-violet-600 text-white shadow-sm"
            : "text-gray-600 hover:text-violet-700 hover:bg-violet-50"
            }`}
        >
          <FaCalendarPlus size={12} />
          <span>Leave Balances & Quotas</span>
        </button>
      </div>

      {subTab === "requests" ? (
        <EmployeeLeaveRequestsTab employeeId={employeeId} employeeName={employee?.name} />
      ) : (
        <EmployeeLeaveBalancesTab employeeId={employeeId} employeeName={employee?.name} />
      )}
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

export default function EmployeeProfilePage() {
  const { employeeId, tabKey } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const mountedRef = useRef(false);
  const requestedTab = new URLSearchParams(location.search).get("tab");
  const activeTab = PROFILE_TAB_IDS.has(tabKey) ? tabKey : DEFAULT_PROFILE_TAB;

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    const candidateTab = PROFILE_TAB_IDS.has(requestedTab) ? requestedTab : activeTab;
    const desiredPath = `/employee-profile/${employeeId}/${candidateTab}`;
    const hasLegacyQuery = location.search.includes("tab=");
    if (hasLegacyQuery || !tabKey || tabKey !== candidateTab || location.pathname !== desiredPath) {
      navigate(desiredPath, { replace: true });
    }
  }, [activeTab, employeeId, location.pathname, location.search, navigate, requestedTab, tabKey]);

  const fetchProfile = useCallback(async (id) => {
    if (!id) {
      if (mountedRef.current) {
        setError("Missing employee id");
        setProfile(null);
      }
      return;
    }

    try {
      if (mountedRef.current) {
        setLoading(true);
        setError(null);
        setProfile(null);
      }

      const { res, json } = await runDedupedRequest(`employee-profile:${id}`, async () => {
        const companyStr = localStorage.getItem("company");
        const companyId = companyStr ? JSON.parse(companyStr)?.id : null;

        // 🔁 Changed from `/employees/${id}?include=basic` to just `/employees/${id}`
        const response = await apiCall(`/employees/${id}`, "GET", null, companyId);
        const data = await response.json();
        return { res: response, json: data };
      });

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch profile details");
      }

      // 🔁 Backend now returns `json.data` directly (employee object)
      const raw = json.data ?? {};

      if (mountedRef.current) {
        setProfile({
          employee: {
            ...raw,
            code: raw.employee_code || raw.code,
          },
          user: {
            ...raw,
            name: raw.name, // backend uses `name`, not `user_name`
          },
          company: {
            ...raw,
            name: raw.company_name || raw.company?.name || "—",
            legal_name: raw.legal_name || raw.company?.legal_name || "—",
            logo_url: raw.logo_url || raw.company?.logo_url,
            city: raw.city || raw.company?.city,
            state: raw.state || raw.company?.state,
            country: raw.country || raw.company?.country,
          },
        });
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || "Failed to load profile");
        setProfile(null);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(employeeId); }, [employeeId, fetchProfile]);

  const handleTabChange = useCallback((nextTab) => {
    if (!PROFILE_TAB_IDS.has(nextTab) || nextTab === activeTab) return;
    navigate(`/employee-profile/${employeeId}/${nextTab}`);
  }, [activeTab, employeeId, navigate]);

  const handleRefresh = useCallback(async () => {
    setRefreshKey((key) => key + 1);
    await fetchProfile(employeeId);
  }, [employeeId, fetchProfile]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-6 font-sans">
      <div className="mx-auto max-w-[1600px]">
        {loading && <SkeletonComponent />}

        {error && (
          <div className="mb-4 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">⚠ {error}</div>
        )}

        {!loading && !profile && !error && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-sm font-medium text-gray-700">No employee profile data found.</p>
            <p className="text-xs text-gray-500 mt-1">This page now depends entirely on the `include=basic` response.</p>
          </div>
        )}

        <AnimatePresence>
          {profile && !loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
              <ProfileHub
                eyebrow={<><FaIdCard size={11} /> Employee Profile</>}
                title={`${profile.employee?.name || profile.user?.name || "Employee"} Profile`}
                description="Detailed overview of employee performance, attendance, and employment records."
                accent="blue"
                summary={<ProfileHeaderSummary data={profile} />}
                actions={
                  <RefreshButton loading={loading} onClick={handleRefresh}>
                    Refresh
                  </RefreshButton>
                }
                tabs={TABS.map((tab) => ({ id: tab.key, label: tab.label, icon: tab.icon, title: tab.label }))}
                activeTab={activeTab}
                onTabChange={handleTabChange}
              >
                <div className="space-y-4">
                  {activeTab === "attendance" ? (
                    <AttendanceSection employee={profile.employee} fallbackId={employeeId} refreshKey={refreshKey} />
                  ) : activeTab === "payroll" ? (
                    <PayrollSection employee={profile.employee} employeeId={profile.employee?.id ?? employeeId} refreshKey={refreshKey} />
                  ) : activeTab === "leaves" ? (
                    <LeavesSection employee={profile.employee} employeeId={profile.employee?.id ?? employeeId} refreshKey={refreshKey} />
                  ) : activeTab === "ledger" ? (
                    <CompanyLedger employeeId={profile.employee?.id ?? employeeId} />
                  ) : activeTab === "accounts" ? (
                    <EmployeeBankAccountsTab employeeId={profile.employee?.id ?? employeeId} />
                  ) : (
                    <TabContent
                      tabKey={activeTab}
                      tabLabel={TABS.find((tab) => tab.key === activeTab)?.label || "Profile"}
                      tabIcon={TABS.find((tab) => tab.key === activeTab)?.icon || ""}
                      employeeId={profile.employee?.id ?? employeeId}
                      refreshKey={refreshKey}
                    />
                  )}
                </div>
              </ProfileHub>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}