import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FaBan,
  FaBriefcase,
  FaCheck,
  FaCheckSquare,
  FaClock,
  FaExclamationTriangle,
  FaFilter,
  FaHistory,
  FaHourglassHalf,
  FaLayerGroup,
  FaMoneyBillWave,
  FaRegCalendarCheck,
  FaSearch,
  FaSpinner,
  FaTimes,
  FaUmbrellaBeach,
  FaUser,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import apiCall from '../utils/api';
import Modal from '../components/Modal';
import TimePickerField from '../components/TimePicker';
import SelectField from '../components/SelectField';
import TimeDurationPickerField from '../components/TimeDurationPicker';
import AdvancedDateFilter from '../components/AdvancedDateFilter';
import Pagination, { usePagination } from '../components/PaginationComponent';
import {
  EmployeeSelect,
  ManagementButton,
  ManagementHub,
} from '../components/common';
import useEmployeeNavigation from '../hooks/useEmployeeNavigation';
import AttendanceLogsModal from '../components/AttendanceLogsModal';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META = {
  present: { label: 'Present', icon: FaCheck, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  absent: { label: 'Absent', icon: FaBan, className: 'border-rose-200 bg-rose-50 text-rose-700' },
  half_day: { label: 'Half Day', icon: FaHourglassHalf, className: 'border-blue-200 bg-blue-50 text-blue-700' },
  leave: { label: 'On Leave', icon: FaUmbrellaBeach, className: 'border-violet-200 bg-violet-50 text-violet-700' },
  paid_leave: { label: 'Paid Leave', icon: FaUmbrellaBeach, className: 'border-violet-200 bg-violet-50 text-violet-700' },
  unmarked: { label: 'Unmarked', icon: FaExclamationTriangle, className: 'border-amber-200 bg-amber-50 text-amber-700' },
};

const METHOD_LABELS = {
  manual: 'Manual Entry',
  by_admin_manual: 'Admin Entry',
  biometric: 'Biometric',
  gps: 'GPS',
  qr: 'QR Code',
};

const statusOptions = [
  { value: 'present', label: 'Present' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'absent', label: 'Absent' },
  { value: 'leave', label: 'Leave' },
];

const listDayStatusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'paid_leave', label: 'Paid Leave' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'unmarked', label: 'Unmarked' },
];

const bulkModeOptions = [
  { value: 'actual', label: 'Verify Actual' },
  { value: 'present', label: 'Mark Present' },
  { value: 'half_day', label: 'Mark Half Day' },
  { value: 'leave', label: 'Mark Leave' },
  { value: 'absent', label: 'Mark Absent' },
];

const bulkModeDefaultNotes = {
  actual: 'Bulk approved based on actual mode',
  present: 'Manual override: Employee forgot ID card',
  half_day: 'Manual override: Employee forgot ID card',
  leave: 'Manual override: Employee forgot ID card',
  absent: 'Unexcused absence',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTitle = (value) =>
  value ? String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

const getCompanyId = () => {
  try { return JSON.parse(localStorage.getItem('company'))?.id || null; }
  catch { return null; }
};

const stripSeconds = (value) => {
  if (!value) return '';
  const [h = '00', m = '00'] = String(value).split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
};

const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const normalizeStatusForAction = (status) => (status === 'paid_leave' ? 'leave' : status);

const timeToMinutes = (value) => {
  if (!value) return null;
  const [h, m] = String(value).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const calculateWorkedMinutes = (startTime, endTime) => {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null) return 0;
  return end >= start ? end - start : (24 * 60 - start) + end;
};

const getExpectedWorkMinutes = (employee, status = employee?.day_status) => {
  const normalized = normalizeStatusForAction(status);
  const full = Number(employee?.expected_work_minutes) || calculateWorkedMinutes(employee?.shift_start, employee?.shift_end);
  return normalized === 'half_day' ? Math.round(full / 2) : full;
};

const minutesToDurationValue = (minutes) => {
  const total = Math.max(0, Number(minutes) || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const durationValueToMinutes = (value) => {
  if (!value) return null;
  const [h = '0', m = '0'] = String(value).split(':');
  return (Number(h) || 0) * 60 + (Number(m) || 0);
};

const getGraceMinutes = (employee) =>
  Number(employee?.grace_minutes ?? employee?.shift?.grace_minutes ?? 0) || 0;

const getFlagEligibility = (employee, startTime = employee?.punch_in_time, endTime = employee?.punch_out_time) => {
  const status = normalizeStatusForAction(employee?.day_status);
  if (!['present', 'half_day'].includes(status) || !startTime || !endTime) {
    return { overtime: false, deductible: false, workedMinutes: 0, differenceMinutes: 0 };
  }
  const expectedMinutes = getExpectedWorkMinutes(employee, status);
  const workedMinutes = calculateWorkedMinutes(startTime, endTime);
  const graceMinutes = getGraceMinutes(employee);
  const overtimeEligible = workedMinutes > expectedMinutes + graceMinutes;
  const deductibleEligible = workedMinutes < expectedMinutes - graceMinutes;
  let differenceMinutes = 0;
  if (overtimeEligible) differenceMinutes = workedMinutes - expectedMinutes;
  else if (deductibleEligible) differenceMinutes = expectedMinutes - workedMinutes;
  else differenceMinutes = Math.abs(workedMinutes - expectedMinutes);
  return { overtime: overtimeEligible, deductible: deductibleEligible, workedMinutes, differenceMinutes };
};

const formatTime = (value) => {
  if (!value) return '---';
  const parsed = new Date(`1970-01-01T${value}`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const formatMinutes = (minutes = 0) => {
  const value = Number(minutes) || 0;
  if (!value) return '0m';
  const h = Math.floor(value / 60);
  const m = value % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'NA';

const buildLeaveOptions = (configs, isPaid) => {
  const options = configs.map((config) => ({
    value: config.code,
    label: `${config.code} - ${config.name}`,
  }));

  if (isPaid) {
    options.push({ value: 'holiday', label: 'Holiday' });
    options.push({ value: 'weekend', label: 'Weekend' });
  }

  return options;
};

// ─── Data normalisation ───────────────────────────────────────────────────────

const mapEmployee = (employee) => {
  const attendance = employee.attendances?.[0] || employee.attendance || employee;
  const calculations = employee.calculations || attendance.calculations || {};
  const src = employee.employee || {};
  return {
    id: employee.employee_id || employee.id || src.id,
    employee_id: employee.employee_id || employee.id || src.id,
    name: employee.name || src.name || src.user?.name || '',
    email: employee.email || src.email || src.user?.email || '',
    phone: employee.phone || src.phone || src.user?.phone || '',
    employee_code: employee.employee_code || src.employee_code || src.code || '',
    designation: (employee.designation || src.designation) && typeof (employee.designation || src.designation) === 'object' ? (employee.designation || src.designation) : { label: formatTitle(employee.designation || src.designation) },
    profile_picture: employee.profile_picture || src.profile_picture || src.user?.profile_picture,
    shift_start: employee.shift?.start_time || attendance.shift?.start_time || null,
    shift_end: employee.shift?.end_time || attendance.shift?.end_time || null,
    expected_work_minutes: employee.shift?.expected_work_minutes || attendance.shift?.expected_work_minutes || 0,
    allowed_break_minutes: employee.shift?.allowed_break_minutes || attendance.shift?.allowed_break_minutes || 0,
    grace_minutes: employee.shift?.grace_minutes || attendance.shift?.grace_minutes || 0,
    attendance_id: attendance.attendance_id || null,
    attendance_date: attendance.attendance_date || attendance.date || employee.date || '',
    day_status: attendance.day_status || 'unmarked',
    half_day_session: attendance.half_day_session || attendance.half_day_type || '',
    leave_type: attendance.leave_type || '',
    leave_sub_type: attendance.leave_sub_type || attendance.leave_type_value || '',
    is_verified: Boolean(attendance.is_verified),
    is_deductible: Boolean(attendance.is_deductible),
    is_overtime: Boolean(attendance.is_overtime),
    punch_in_time: attendance.punch_in?.time || attendance.start_time || '',
    punch_in_method: attendance.punch_in?.method || '',
    punch_out_time: attendance.punch_out?.time || attendance.end_time || '',
    punch_out_method: attendance.punch_out?.method || '',
    worked_minutes: calculations.worked_minutes || 0,
    break_minutes: calculations.break_minutes || calculations.total_break_time || 0,
    extra_break_minutes: calculations.extra_break_minutes || 0,
    late_minutes: calculations.late_minutes || 0,
    early_leave_minutes: calculations.early_leave_minutes || 0,
    overtime_minutes: calculations.overtime_minutes || 0,
    deductible_minutes: calculations.deductible_minutes || 0,
    leave_day_overtime: attendance.leave_day_overtime ?? null,
    remark: attendance.remark || '',
  };
};

const buildCounts = (employees) =>
  employees.reduce((acc, emp) => {
    const key = emp.day_status === 'paid_leave' ? 'leave' : (emp.day_status || 'unmarked');
    acc.total_employees += 1;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { total_employees: 0, present: 0, absent: 0, leave: 0, half_day: 0, unmarked: 0 });

const normalizeAttendanceResponse = (response) => {
  const rows = Array.isArray(response)
    ? response
    : Array.isArray(response?.data) ? response.data
      : Array.isArray(response?.records) ? response.records
        : [];
  return rows.map(mapEmployee);
};

const normalizeMeta = (response, fallback = {}) => {
  const meta = response?.meta || response?.pagination || {};
  const page = Number(meta.page ?? response?.page ?? fallback.page ?? 1);
  const limit = Number(meta.limit ?? response?.limit ?? fallback.limit ?? 10);
  const total = Number(meta.total ?? response?.total ?? fallback.total ?? 0);
  const totalPages = Number(meta.total_pages ?? response?.total_pages ?? Math.ceil(total / limit) ?? 1) || 1;
  return { page, limit, total, total_pages: totalPages, is_last_page: meta.is_last_page ?? page >= totalPages };
};

// ─── Small presentational components ─────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.unmarked;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
      <Icon size={11} /> {meta.label}
    </span>
  );
};

const FieldLabel = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <div className="mt-0.5 truncate text-xs font-semibold text-slate-800">{children}</div>
  </div>
);

/** Compact toggle switch used per-card in bulk mode */
const ToggleSwitch = ({ isOn, onToggle, size = 'md' }) => {
  const track = size === 'sm' ? 'h-4 w-8' : 'h-5 w-10';
  const thumb = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';
  const translateX = size === 'sm' ? 16 : 20;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`flex ${track} cursor-pointer items-center rounded-full p-1 transition-all duration-300 ${isOn ? 'bg-blue-500 shadow-inner' : 'bg-gray-300'}`}
    >
      <motion.div
        className={`${thumb} rounded-full bg-white shadow-md`}
        initial={false}
        animate={{ x: isOn ? translateX : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </div>
  );
};

const Summary = ({ counts }) => {
  const items = [
    { key: 'total_employees', label: 'Total', icon: FaUser, className: 'bg-slate-50 text-slate-700 border-slate-200' },
    { key: 'present', label: 'Present', icon: FaCheck, className: STATUS_META.present.className },
    { key: 'absent', label: 'Absent', icon: FaBan, className: STATUS_META.absent.className },
    { key: 'half_day', label: 'Half Day', icon: FaHourglassHalf, className: STATUS_META.half_day.className },
    { key: 'leave', label: 'Leave', icon: FaUmbrellaBeach, className: STATUS_META.leave.className },
    { key: 'unmarked', label: 'Unmarked', icon: FaExclamationTriangle, className: STATUS_META.unmarked.className },
  ];
  return (
    <div className="grid grid-cols-3 xsm:grid-cols-3 md:grid-cols-6 gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-xl border ${item.className}`}>
              <Icon size={12} />
            </div>
            <p className="text-xl font-bold text-slate-900">{counts?.[item.key] ?? 0}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
          </div>
        );
      })}
    </div>
  );
};

const EmployeeAvatar = ({ employee, onClick }) => (
  <div
    className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-100 text-xs font-bold text-slate-600 ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
    onClick={onClick}
  >
    {employee.profile_picture ? (
      <img
        src={employee.profile_picture}
        alt={employee.name}
        className="h-full w-full object-cover"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    ) : getInitials(employee.name)}
  </div>
);

// ─── Employee Row Card ────────────────────────────────────────────────────────

const EmployeeRowCard = ({ employee, onManage, onToggleFlag, onViewLogs, selected = false, onSelect }) => {
  const navigateToEmployeeProfile = useEmployeeNavigation();
  const activeStatus = normalizeStatusForAction(employee.day_status);
  const statusButtonVariant = (s) => (activeStatus === s ? 'solid' : 'soft');
  const eligibility = getFlagEligibility(employee);
  const overtimeActionEnabled = employee.is_overtime || eligibility.overtime;
  const deductibleActionEnabled = employee.is_deductible || eligibility.deductible;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl border p-3 shadow-md transition hover:shadow-lg ${selected ? 'ring-2 ring-blue-400 ring-offset-2' : ''
        } ${employee.is_verified
          ? 'bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 border-emerald-200 shadow-emerald-100/70'
          : 'bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border-amber-200 shadow-amber-100/70'
        }`}
    >
      {/* Per-card selection checkbox */}
      <div className="absolute left-3 top-3 z-10 flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect?.(employee.employee_id)}
          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer accent-blue-600"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="flex flex-col justify-between gap-4 lg:flex-row">
        <div className="flex min-w-0 items-start gap-3 lg:max-w-[760px] xl:max-w-[840px] pl-10 sm:pl-12">

          <EmployeeAvatar
            employee={employee}
            onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(employee.employee_id); }}
          />

          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-bold text-slate-900 cursor-pointer hover:underline hover:text-indigo-600 transition-colors"
              onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(employee.employee_id); }}
            >
              {employee.name}
            </p>
            <p className="truncate text-xs font-medium text-slate-500">
              {employee.employee_code} | {employee.designation?.label || 'No designation'}
            </p>

            <div className="mt-3 flex flex-wrap gap-4 sm:gap-x-8">
              <FieldLabel label="Shift Start">{formatTime(employee.shift_start)}</FieldLabel>
              <FieldLabel label="Shift End">{formatTime(employee.shift_end)}</FieldLabel>
              <FieldLabel label="Punch In">
                <span className={employee.punch_in_time ? 'text-emerald-700' : 'text-slate-400'}>
                  {formatTime(employee.punch_in_time)}
                </span>
              </FieldLabel>
              <FieldLabel label="Punch Out">
                <span className={employee.punch_out_time ? 'text-emerald-700' : 'text-slate-400'}>
                  {formatTime(employee.punch_out_time)}
                </span>
              </FieldLabel>
              <FieldLabel label="Worked">{formatMinutes(employee.worked_minutes)}</FieldLabel>
              <FieldLabel label="Expected">{formatMinutes(employee.expected_work_minutes)}</FieldLabel>
            </div>

            {(employee.punch_in_method || employee.punch_out_method) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  {METHOD_LABELS[employee.punch_in_method || employee.punch_out_method] || employee.punch_in_method || employee.punch_out_method}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col justify-between gap-3 border-t border-slate-100 pt-3 lg:w-[360px] lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">

          {/* Status badges + Log button */}
          <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
            <StatusBadge status={employee.day_status} />
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${employee.is_verified
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}>
              {employee.is_verified ? 'Verified' : 'Pending'}
            </span>

            {/* ── Logs button ── */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onViewLogs(employee); }}
              title="View attendance logs"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
            >
              <FaHistory size={11} />
              Logs
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <ManagementButton size="sm" tone="emerald" variant={statusButtonVariant('present')} fullWidth leftIcon={<FaCheck />} onClick={() => onManage(employee, 'present')}>Present</ManagementButton>
            <ManagementButton size="sm" tone="blue" variant={statusButtonVariant('half_day')} fullWidth leftIcon={<FaHourglassHalf />} onClick={() => onManage(employee, 'half_day')}>Half Day</ManagementButton>
            <ManagementButton size="sm" tone="rose" variant={statusButtonVariant('absent')} fullWidth leftIcon={<FaBan />} onClick={() => onManage(employee, 'absent')}>Absent</ManagementButton>
            <ManagementButton size="sm" tone="violet" variant={statusButtonVariant('leave')} fullWidth leftIcon={<FaUmbrellaBeach />} onClick={() => onManage(employee, 'leave')}>Leave</ManagementButton>
            <ManagementButton
              size="sm" tone={employee.is_overtime ? 'amber' : 'slate'} variant="soft" fullWidth
              disabled={!overtimeActionEnabled} leftIcon={<FaClock />}
              onClick={() => onToggleFlag(employee, 'overtime')}
              title={employee.is_overtime ? `Overtime: ${formatMinutes(employee.overtime_minutes || eligibility.differenceMinutes)}` : overtimeActionEnabled ? 'Enable overtime' : 'Not eligible'}
            >
              {employee.is_overtime ? `OT ${formatMinutes(employee.overtime_minutes || eligibility.differenceMinutes)}` : 'Overtime'}
            </ManagementButton>
            <ManagementButton
              size="sm" tone={employee.is_deductible ? 'rose' : 'slate'} variant="soft" fullWidth
              disabled={!deductibleActionEnabled} leftIcon={<FaMoneyBillWave />}
              onClick={() => onToggleFlag(employee, 'deductible')}
              title={employee.is_deductible ? `Deductible: ${formatMinutes(employee.deductible_minutes || eligibility.differenceMinutes)}` : deductibleActionEnabled ? 'Enable deductible' : 'Not eligible'}
            >
              Deduct
            </ManagementButton>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Custom Hooks ─────────────────────────────────────────────────────────────

const useLeaveConfigs = (isPaid, enabled = true) => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setConfigs([]);
      return;
    }

    const companyId = getCompanyId();
    if (!companyId) return;

    let isMounted = true;
    const fetchConfigs = async () => {
      setLoading(true);
      try {
        const response = await apiCall(`/leave/company?is_paid=${isPaid}`, 'GET', null, companyId);
        const result = await response.json();
        if (isMounted) {
          if (result.success) {
            setConfigs(result.data || []);
          } else {
            setConfigs([]);
          }
        }
      } catch (e) {
        console.error('Failed to fetch leave configs', e);
        if (isMounted) setConfigs([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchConfigs();
    return () => { isMounted = false; };
  }, [isPaid, enabled]);

  return { configs, loading };
};

// ─── Manage Attendance Modal ──────────────────────────────────────────────────

const ManageAttendanceModal = ({ employee, initialStatus, isOpen, onClose, onSave, saving = false }) => {
  const hasActualTime = Boolean(employee?.punch_in_time || employee?.punch_out_time);
  const hasCompleteActualTime = Boolean(employee?.punch_in_time && employee?.punch_out_time);

  const getDefaultTimes = (currentStatus, currentHalfDaySession) => {
    const sStart = stripSeconds(employee?.shift_start) || '09:00';
    const sEnd = stripSeconds(employee?.shift_end) || '18:00';
    let times = { punchIn: sStart, punchOut: sEnd };

    if (currentStatus === 'half_day') {
      const startMins = timeToMinutes(sStart);
      const endMins = timeToMinutes(sEnd);
      if (startMins !== null && endMins !== null) {
        const shiftDuration = endMins >= startMins ? endMins - startMins : (24 * 60 - startMins) + endMins;
        const halfDuration = Math.round(shiftDuration / 2);
        const midpointMins = (startMins + halfDuration) % 1440;
        const midpoint = minutesToDurationValue(midpointMins);
        times = currentHalfDaySession === 'second_half'
          ? { punchIn: midpoint, punchOut: sEnd }
          : { punchIn: sStart, punchOut: midpoint };
      }
    }

    if (hasActualTime && currentStatus !== 'half_day') {
      return {
        punchIn: employee?.punch_in_time || times.punchIn,
        punchOut: employee?.punch_out_time || times.punchOut,
      };
    }
    return times;
  };

  const [status, setStatus] = useState(initialStatus || 'present');
  const [halfDaySession, setHalfDaySession] = useState(employee?.half_day_session || 'first_half');
  const [punchIn, setPunchIn] = useState(() => getDefaultTimes(initialStatus || 'present', employee?.half_day_session || 'first_half').punchIn);
  const [punchOut, setPunchOut] = useState(() => getDefaultTimes(initialStatus || 'present', employee?.half_day_session || 'first_half').punchOut);
  const [leaveType, setLeaveType] = useState(employee?.leave_type || 'unpaid');
  const [leaveCode, setLeaveCode] = useState(employee?.leave_sub_type || '');
  const [leaveDayOTEnabled, setLeaveDayOTEnabled] = useState(Boolean(employee?.leave_day_overtime));
  const [leaveDayOT, setLeaveDayOT] = useState(employee?.leave_day_overtime ? minutesToDurationValue(employee.leave_day_overtime) : null);
  const [isOvertime, setIsOvertime] = useState(false);
  const [isDeductible, setIsDeductible] = useState(false);
  const [notes, setNotes] = useState(employee?.remark || '');

  const { configs: leaveConfigs, loading: leaveConfigsLoading } = useLeaveConfigs(leaveType === 'paid', isOpen && status === 'leave');
  const leaveOptions = useMemo(() => buildLeaveOptions(leaveConfigs, leaveType === 'paid'), [leaveConfigs, leaveType]);

  useEffect(() => {
    const targetStatus = initialStatus || 'present';
    const targetSession = employee?.half_day_session || 'first_half';
    const defaults = getDefaultTimes(targetStatus, targetSession);
    setStatus(targetStatus);
    setHalfDaySession(targetSession);
    setPunchIn(defaults.punchIn);
    setPunchOut(defaults.punchOut);
    setLeaveType(employee?.leave_type || 'unpaid');
    setLeaveCode(employee?.leave_sub_type || '');
    setLeaveDayOTEnabled(Boolean(employee?.leave_day_overtime));
    setLeaveDayOT(employee?.leave_day_overtime ? minutesToDurationValue(employee.leave_day_overtime) : null);
    setIsOvertime(false);
    setIsDeductible(false);
    setNotes(employee?.remark || '');
  }, [employee, initialStatus]);

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    if (newStatus === 'half_day' || (!hasCompleteActualTime && newStatus === 'present')) {
      const d = getDefaultTimes(newStatus, halfDaySession);
      setPunchIn(d.punchIn);
      setPunchOut(d.punchOut);
    }
  };

  const handleHalfDaySessionChange = (newSession) => {
    setHalfDaySession(newSession);
    if (status === 'half_day' || !hasCompleteActualTime) {
      const d = getDefaultTimes(status, newSession);
      setPunchIn(d.punchIn);
      setPunchOut(d.punchOut);
    }
  };

  const showTimeFields = status === 'present' || status === 'half_day';
  const canUsePayrollFlags = showTimeFields;
  const modalEmployee = { ...employee, day_status: status };
  const modalEligibility = getFlagEligibility(modalEmployee, punchIn, punchOut);
  const overtimeEnabled = canUsePayrollFlags && modalEligibility.overtime;
  const deductibleEnabled = canUsePayrollFlags && modalEligibility.deductible;

  useEffect(() => {
    if (!overtimeEnabled && isOvertime) setIsOvertime(false);
    if (!deductibleEnabled && isDeductible) setIsDeductible(false);
  }, [overtimeEnabled, deductibleEnabled]);

  if (!employee) return null;

  const handleSave = () => {
    if (showTimeFields && (!punchIn || !punchOut)) {
      toast.error('Punch in and punch out times are required');
      return;
    }
    if (status === 'leave' && !leaveCode) {
      toast.error('Leave code is required');
      return;
    }
    onSave({
      employee_id: employee.employee_id,
      status,
      punch_in: showTimeFields ? punchIn : '',
      punch_out: showTimeFields ? punchOut : '',
      half_day_session: status === 'half_day' ? halfDaySession : '',
      leave_type: status === 'leave' ? leaveType : '',
      leave_sub_type: status === 'leave' ? leaveCode : '',
      leave_day_overtime: status === 'leave' && leaveDayOTEnabled ? durationValueToMinutes(leaveDayOT) : null,
      is_overtime: overtimeEnabled && isOvertime,
      is_deductible: deductibleEnabled && isDeductible,
      notes,
    });
  };

  const toggleOvertime = () => { if (!overtimeEnabled) return; setIsOvertime((c) => { if (!c) setIsDeductible(false); return !c; }); };
  const toggleDeductible = () => { if (!deductibleEnabled) return; setIsDeductible((c) => { if (!c) setIsOvertime(false); return !c; }); };

  return (
    <Modal
      isOpen={isOpen} onClose={onClose}
      title="Manage Attendance"
      subtitle={`${employee.name} | ${employee.employee_code}`}
      icon={<FaRegCalendarCheck className="h-5 w-5" />}
      size="2xl"
      footer={(
        <>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
          <ManagementButton tone="blue" leftIcon={<FaCheck />} onClick={handleSave} loading={saving}>Save Attendance</ManagementButton>
        </>
      )}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statusOptions.map((option) => {
            const meta = STATUS_META[option.value];
            const Icon = meta.icon;
            const isActive = status === option.value;
            return (
              <button
                key={option.value} type="button"
                onClick={() => handleStatusChange(option.value)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${isActive ? meta.className : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <Icon size={13} /> {option.label}
              </button>
            );
          })}
        </div>

        {showTimeFields && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TimePickerField
              label={<span className="inline-flex items-center gap-2">Punch In {!employee?.punch_in_time && <span className="text-[8px] text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded normal-case tracking-normal">System Taken</span>}</span>}
              value={punchIn} onChange={setPunchIn} initialValue={employee.shift_start || '09:00:00'} placeholder="Select punch in" required
            />
            <TimePickerField
              label={<span className="inline-flex items-center gap-2">Punch Out {!employee?.punch_out_time && <span className="text-[8px] text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded normal-case tracking-normal">System Taken</span>}</span>}
              value={punchOut} onChange={setPunchOut} initialValue={employee.shift_end || '18:00:00'} placeholder="Select punch out" required
            />
          </div>
        )}

        {status === 'half_day' && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Half Day Session</p>
            <div className="grid grid-cols-2 gap-3">
              {[{ value: 'first_half', label: 'First Half' }, { value: 'second_half', label: 'Second Half' }].map((o) => (
                <button
                  key={o.value} type="button"
                  onClick={() => handleHalfDaySessionChange(o.value)}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${halfDaySession === o.value ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {status === 'leave' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Paid Leave</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-400">
                    If Turn on Paid Leave, then it will be deducted from the employee leave balance
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLeaveType(prev => prev === 'paid' ? 'unpaid' : 'paid');
                    setLeaveCode('');
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 ${leaveType === 'paid' ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${leaveType === 'paid' ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Leave Code</span>
                <SelectField
                  value={leaveOptions.find((o) => o.value === leaveCode) || null}
                  onChange={(selected) => setLeaveCode(selected ? selected.value : '')}
                  options={leaveOptions}
                  isLoading={leaveConfigsLoading}
                  placeholder="Select leave code..."
                  isClearable
                />
              </label>
            </div>

            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Leave Day Overtime</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-400">Enable only when overtime applies on leave day</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLeaveDayOTEnabled((c) => { const next = !c; if (next && !leaveDayOT) setLeaveDayOT('01:00'); if (!next) setLeaveDayOT(null); return next; })}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 ${leaveDayOTEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${leaveDayOTEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {leaveDayOTEnabled && (
                <div className="mt-4">
                  <TimeDurationPickerField label="Overtime Duration" value={leaveDayOT} onChange={setLeaveDayOT} placeholder="Select duration" mode="duration" />
                </div>
              )}
            </div>
          </div>
        )}

        {canUsePayrollFlags && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Payroll Flags</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" onClick={toggleOvertime} disabled={!overtimeEnabled}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${isOvertime && overtimeEnabled ? 'border-orange-200 bg-orange-50 text-orange-700'
                  : overtimeEnabled ? 'border-orange-200 bg-white text-orange-700'
                    : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                  }`}
              >
                <span>
                  <span className="block text-sm font-bold">Overtime</span>
                  <span className="block text-xs opacity-75">{overtimeEnabled ? `${formatMinutes(modalEligibility.differenceMinutes)} eligible` : 'Enter extra time to enable'}</span>
                </span>
                <FaBriefcase />
              </button>
              <button type="button" onClick={toggleDeductible} disabled={!deductibleEnabled}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${isDeductible && deductibleEnabled ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : deductibleEnabled ? 'border-rose-200 bg-white text-rose-700'
                    : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                  }`}
              >
                <span>
                  <span className="block text-sm font-bold">Deductible</span>
                  <span className="block text-xs opacity-75">{deductibleEnabled ? `${formatMinutes(modalEligibility.differenceMinutes)} eligible` : 'Enter short time to enable'}</span>
                </span>
                <FaMoneyBillWave />
              </button>
            </div>
          </div>
        )}

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Remark</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a note"
            className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
          />
        </label>
      </div>
    </Modal>
  );
};

// ─── Bulk Approval Panel (inside modal) ───────────────────────────────────────

const BulkApprovalPanel = ({
  bulkMode, setBulkMode,
  bulkHalfDayType, setBulkHalfDayType,
  bulkLeaveType, setBulkLeaveType,
  bulkLeaveTypeValue, setBulkLeaveTypeValue,
  bulkNotes, setBulkNotes,
}) => {
  const { configs: leaveConfigs, loading: leaveConfigsLoading } = useLeaveConfigs(bulkLeaveType === 'paid', bulkMode === 'leave');
  const leaveOptions = useMemo(() => buildLeaveOptions(leaveConfigs, bulkLeaveType === 'paid'), [leaveConfigs, bulkLeaveType]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Bulk Mode</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {bulkModeOptions.map((option) => (
              <button
                key={option.value} type="button"
                onClick={() => setBulkMode(option.value)}
                className={`rounded-xl border px-3 py-2 whitespace-nowrap text-xs font-bold transition ${bulkMode === option.value
                  ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {bulkMode === 'half_day' && (
          <div className="md:col-span-2">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Half Day Session</span>
            <div className="grid grid-cols-2 gap-3">
              {[{ value: 'first_half', label: 'First Half' }, { value: 'second_half', label: 'Second Half' }].map((o) => (
                <button
                  key={o.value} type="button"
                  onClick={() => setBulkHalfDayType(o.value)}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${bulkHalfDayType === o.value ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {bulkMode === 'leave' && (
          <>
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Paid Leave</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-400">
                    If Turn on Paid Leave, then it will be deducted from the employee leave balance
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBulkLeaveType(prev => prev === 'paid' ? 'unpaid' : 'paid');
                    setBulkLeaveTypeValue('');
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 ${bulkLeaveType === 'paid' ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${bulkLeaveType === 'paid' ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Leave Code</span>
                <SelectField
                  value={leaveOptions.find((o) => o.value === bulkLeaveTypeValue) || null}
                  onChange={(selected) => setBulkLeaveTypeValue(selected ? selected.value : '')}
                  options={leaveOptions}
                  isLoading={leaveConfigsLoading}
                  placeholder="Select leave code..."
                  isClearable
                  styles={{ control: (base) => ({ ...base, minHeight: '40px' }) }}
                />
              </label>
            </div>
          </>
        )}

        <label className="block md:col-span-2">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</span>
          <input type="text" value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} placeholder="Bulk approval note"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
          />
        </label>
      </div>
    </div>
  );
};

// ─── Flag Confirm Modal ───────────────────────────────────────────────────────

const FlagConfirmModal = ({ state, onClose, onConfirm, saving }) => {
  const employee = state?.employee;
  if (!employee) return null;
  const isOvertime = state.flag === 'overtime';
  const currentlyActive = isOvertime ? employee.is_overtime : employee.is_deductible;
  const nextActive = !currentlyActive;
  const title = `${nextActive ? 'Enable' : 'Disable'} ${isOvertime ? 'Overtime' : 'Deductible'}`;

  return (
    <Modal
      isOpen={Boolean(state)} onClose={onClose}
      title={title}
      subtitle={`${employee.name} | ${employee.employee_code}`}
      icon={isOvertime ? <FaClock className="h-5 w-5" /> : <FaMoneyBillWave className="h-5 w-5" />}
      size="md"
      footer={(
        <>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
          <ManagementButton tone={isOvertime ? 'amber' : 'rose'} leftIcon={<FaCheck />} loading={saving} onClick={onConfirm}>Confirm</ManagementButton>
        </>
      )}
    >
      <p className="text-sm font-medium text-slate-600">
        {nextActive ? 'This will mark' : 'This will remove'} {employee.name} as {isOvertime ? 'overtime' : 'deductible'} for this attendance record.
      </p>
    </Modal>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UnmarkedAttendance() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [dateFilter, setDateFilter] = useState({ date: getToday(), month: '', year: '', from_date: '', to_date: '' });
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  /** 'selected' | 'all' — determines what employee_ids to send */
  const [bulkScope, setBulkScope] = useState('selected');
  const [bulkMode, setBulkMode] = useState('actual');
  const [bulkHalfDayType, setBulkHalfDayType] = useState('first_half');
  const [bulkLeaveType, setBulkLeaveType] = useState('unpaid');
  const [bulkLeaveTypeValue, setBulkLeaveTypeValue] = useState('');
  const [bulkNotes, setBulkNotes] = useState('Bulk approved selected attendance');
  const [modalState, setModalState] = useState(null);
  const [flagConfirm, setFlagConfirm] = useState(null);
  // ── Logs modal state ── { id: attendance_id, type: 'attendance' } | null
  const [logsModal, setLogsModal] = useState(null);

  const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 10);
  const activeListRequestKey = useRef(null);
  const latestListRequestId = useRef(0);

  // Debounce search
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Sync bulk mode default notes
  useEffect(() => {
    setBulkNotes(bulkModeDefaultNotes[bulkMode] || '');
  }, [bulkMode]);

  // Keep selection in sync with visible employees
  useEffect(() => {
    const visibleIds = new Set(employees.map((e) => e.employee_id));
    setSelectedEmployeeIds((cur) => cur.filter((id) => visibleIds.has(id)));
  }, [employees]);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = async (showRefresh = false) => {
    const companyId = getCompanyId();
    if (!companyId) {
      setLoading(false);
      setRefreshing(false);
      toast.error('Company ID not found');
      return;
    }

    const params = new URLSearchParams({ page: String(pagination.page), limit: String(pagination.limit), type: 'attendance' });
    if (debouncedSearch) params.append('search', debouncedSearch);
    if (dateFilter?.date) {
      params.append('from_date', dateFilter.date);
      params.append('to_date', dateFilter.date);
    } else {
      if (dateFilter?.from_date) params.append('from_date', dateFilter.from_date);
      if (dateFilter?.to_date) params.append('to_date', dateFilter.to_date);
    }
    if (employeeId) params.append('employee_id', employeeId);
    if (statusFilter) params.append('day_status', statusFilter);

    const requestKey = `${companyId}:${params.toString()}`;
    if (activeListRequestKey.current === requestKey) return;
    activeListRequestKey.current = requestKey;

    const requestId = ++latestListRequestId.current;
    if (showRefresh) setRefreshing(true); else setLoading(true);

    try {
      const response = await apiCall(`/attendance/list?${params.toString()}`, 'GET', null, companyId);
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.message || 'Failed to load attendance list');
      if (requestId !== latestListRequestId.current) return;
      setEmployees(normalizeAttendanceResponse(result));
      updatePagination(normalizeMeta(result, pagination));
    } catch (error) {
      if (requestId !== latestListRequestId.current) return;
      setEmployees([]);
      toast.error(error.message || 'Failed to load attendance list');
    } finally {
      if (activeListRequestKey.current === requestKey) activeListRequestKey.current = null;
      if (requestId === latestListRequestId.current) { setLoading(false); setRefreshing(false); }
    }
  };

  useEffect(() => { loadData(); }, [pagination.page, pagination.limit, debouncedSearch, dateFilter, employeeId, statusFilter]);
  useEffect(() => { if (pagination.page !== 1) goToPage(1); }, [debouncedSearch, dateFilter, employeeId, statusFilter]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const counts = useMemo(() => buildCounts(employees), [employees]);
  const visibleEmployeeIds = useMemo(() => employees.map((e) => e.employee_id), [employees]);
  const allVisibleSelected = visibleEmployeeIds.length > 0 && visibleEmployeeIds.every((id) => selectedEmployeeIds.includes(id));

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleManage = (employee, initialStatus) => setModalState({ employee, initialStatus });

  const toggleSelectedEmployee = (empId) =>
    setSelectedEmployeeIds((cur) => cur.includes(empId) ? cur.filter((id) => id !== empId) : [...cur, empId]);

  const toggleSelectAllVisible = () => {
    setSelectedEmployeeIds((cur) => {
      if (allVisibleSelected) {
        const visibleSet = new Set(visibleEmployeeIds);
        return cur.filter((id) => !visibleSet.has(id));
      }
      return Array.from(new Set([...cur, ...visibleEmployeeIds]));
    });
  };

  /** Open the bulk modal for selected employees */
  const openBulkModalForSelected = () => {
    if (!selectedEmployeeIds.length) { toast.error('Select at least one employee'); return; }
    setBulkScope('selected');
    setShowBulkModal(true);
  };

  /** Open the bulk modal to act on ALL employees (across all pages) */
  const openBulkModalForAll = () => {
    setBulkScope('all');
    setShowBulkModal(true);
  };

  const closeBulkModal = () => setShowBulkModal(false);

  const getBulkAttendanceDate = () =>
    dateFilter?.date || dateFilter?.from_date || dateFilter?.to_date || getToday();

  /** Build and send the bulk approve payload */
  const handleBulkApprove = async () => {
    const companyId = getCompanyId();
    if (!companyId) { toast.error('Company ID not found'); return; }

    const employeeIds = bulkScope === 'all' ? 'all' : selectedEmployeeIds;

    if (bulkScope === 'selected' && !selectedEmployeeIds.length) {
      toast.error('Select at least one employee');
      return;
    }

    const payload = {
      attendance_date: getBulkAttendanceDate(),
      employee_ids: employeeIds,
      attendance_type: 'attendance',
      mode: bulkMode,
      notes: bulkNotes,
    };

    if (bulkMode === 'half_day') payload.half_day_type = bulkHalfDayType;
    if (bulkMode === 'leave') {
      if (!bulkLeaveTypeValue) {
        toast.error('Leave code is required');
        return;
      }
      payload.leave_type = bulkLeaveType;
      payload.leave_type_value = bulkLeaveTypeValue;
    }

    setBulkSaving(true);
    try {
      const response = await apiCall('/attendance/approve', 'PUT', payload, companyId);
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.message || 'Bulk approval failed');
      toast.success(result.message || 'Attendance approved successfully');
      setSelectedEmployeeIds([]);
      setShowBulkModal(false);
      loadData(true);
    } catch (error) {
      toast.error(error.message || 'Bulk approval failed');
    } finally {
      setBulkSaving(false);
    }
  };

  const buildMarkPayload = (formPayload, sourceEmployee = modalState?.employee) => {
    const date = sourceEmployee?.attendance_date || dateFilter?.date || dateFilter?.from_date || dateFilter?.to_date || getToday();
    const base = { employee_id: formPayload.employee_id, date, type: 'attendance', status: formPayload.status, notes: formPayload.notes || '' };

    if (formPayload.status === 'present') {
      return { ...base, start_time: stripSeconds(formPayload.punch_in), end_time: stripSeconds(formPayload.punch_out), is_deductible: Boolean(formPayload.is_deductible), is_overtime: Boolean(formPayload.is_overtime) };
    }
    if (formPayload.status === 'half_day') {
      return { ...base, half_day_type: formPayload.half_day_session, start_time: stripSeconds(formPayload.punch_in), end_time: stripSeconds(formPayload.punch_out), is_deductible: Boolean(formPayload.is_deductible), is_overtime: Boolean(formPayload.is_overtime) };
    }
    if (formPayload.status === 'leave') {
      return { ...base, leave_type: formPayload.leave_type, leave_type_value: formPayload.leave_sub_type, leave_day_overtime: formPayload.leave_day_overtime };
    }
    return base;
  };

  const handleSave = async (payload) => {
    const companyId = getCompanyId();
    if (!companyId) { toast.error('Company ID not found'); return; }
    try {
      setSaving(true);
      const markPayload = buildMarkPayload(payload);
      const response = await apiCall('/attendance/mark', 'POST', markPayload, companyId);
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.message || 'Failed to mark attendance');
      toast.success(result.message || `Attendance updated for ${modalState.employee.name}`);
      setModalState(null);
      loadData(true);
    } catch (error) {
      toast.error(error.message || 'Failed to mark attendance');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFlag = (employee, flag) => setFlagConfirm({ employee, flag });

  const handleConfirmFlagToggle = async () => {
    const companyId = getCompanyId();
    if (!companyId || !flagConfirm?.employee) { toast.error('Company ID not found'); return; }
    const { employee, flag } = flagConfirm;
    const isOvertimeToggle = flag === 'overtime';
    const nextOvertime = isOvertimeToggle ? !employee.is_overtime : false;
    const nextDeductible = isOvertimeToggle ? false : !employee.is_deductible;
    const status = normalizeStatusForAction(employee.day_status);
    try {
      setSaving(true);
      const markPayload = buildMarkPayload({
        employee_id: employee.employee_id,
        status,
        punch_in: employee.punch_in_time,
        punch_out: employee.punch_out_time,
        half_day_session: employee.half_day_session || 'first_half',
        is_overtime: nextOvertime,
        is_deductible: nextDeductible,
        notes: employee.remark || '',
      }, employee);
      const response = await apiCall('/attendance/mark', 'POST', markPayload, companyId);
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.message || 'Failed to update flag');
      toast.success(result.message || 'Attendance flag updated');
      setFlagConfirm(null);
      loadData(true);
    } catch (error) {
      toast.error(error.message || 'Failed to update attendance flag');
    } finally {
      setSaving(false);
    }
  };

  // ── Logs handler ─────────────────────────────────────────────────────────────

  const handleViewLogs = (employee) => {
    if (!employee.attendance_id) {
      toast.info('No attendance record found to view logs for');
      return;
    }
    setLogsModal({ id: employee.attendance_id, type: 'attendance' });
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ManagementHub
      eyebrow={<><FaRegCalendarCheck size={11} /> Attendance</>}
      title="Unmarked Attendance"
      description="Review daily attendance status and complete missing employee attendance records."
      accent="blue"
      onRefresh={() => loadData(true)}
      refreshing={refreshing}
    >
      <div className="mx-auto max-w-screen-2xl space-y-4 px-2">
        <Summary counts={counts} />

        {/* ── Filter bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

            {/* SEARCH */}
            <div className="w-full lg:flex-1">
              <div className="relative">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, code, or email…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-10 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 min-h-[42px]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <FaTimes size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* EMPLOYEE SELECT */}
            <div className="w-full lg:w-[240px] lg:flex-none">
              <EmployeeSelect
                value={employeeId}
                onChange={(v) => setEmployeeId(v || '')}
                placeholder="All employees"
              />
            </div>

            {/* FILTERS */}
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:flex-none">

              {/* STATUS */}
              <div className="relative w-full text-center sm:flex-1 lg:w-[220px] lg:flex-none">
                <FaFilter
                  className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400"
                  size={12}
                />
                <SelectField
                  value={listDayStatusOptions.find((o) => o.value === statusFilter) || null}
                  onChange={(o) => setStatusFilter(o?.value || '')}
                  options={listDayStatusOptions}
                  styles={{ control: (p) => ({ ...p, paddingLeft: '1.5rem', minHeight: '42px' }) }}
                />
              </div>

              {/* DATE FILTER */}
              <div className="w-full sm:flex-1 lg:w-[260px] lg:flex-none">
                <AdvancedDateFilter
                  value={dateFilter}
                  onChange={setDateFilter}
                  placeholder="Date or range"
                  tabOptions={['date', 'range']}
                  showDateStepper
                  buttonClassName="h-full min-h-[42px] w-full bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Employee list ── */}
        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-100 bg-white py-16 shadow-sm">
            <FaSpinner className="animate-spin text-3xl text-blue-500" />
          </div>
        ) : employees.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-white p-12 text-center shadow-sm">
            <FaRegCalendarCheck className="mx-auto mb-4 text-5xl text-slate-300" />
            <p className="text-base font-semibold text-slate-600">No attendance records found</p>
            <p className="mt-1 text-sm text-slate-400">Try adjusting your search or status filter.</p>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl bg-white px-4 shadow-xl">

            {/* ── TOP BULK CONTROL BAR ── */}
            <div className="flex w-full items-center justify-between pt-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSelectAllVisible}
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                >
                  {allVisibleSelected
                    ? <><FaCheckSquare size={13} /> Deselect all</>
                    : <><FaCheck size={13} /> Select all</>
                  }
                </button>
              </div>
            </div>

            {/* Employee cards */}
            {employees.map((employee) => (
              <EmployeeRowCard
                key={employee.employee_id}
                employee={employee}
                onManage={handleManage}
                onToggleFlag={handleToggleFlag}
                onViewLogs={handleViewLogs}
                selected={selectedEmployeeIds.includes(employee.employee_id)}
                onSelect={toggleSelectedEmployee}
              />
            ))}
            <div className="pb-2" />
          </div>
        )}

        <Pagination
          currentPage={pagination.page}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={goToPage}
          onLimitChange={changeLimit}
        />
      </div>

      {/* ── FLOATING BOTTOM BAR ── */}
      <AnimatePresence>
        {selectedEmployeeIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-8 sm:bottom-8 z-[100] flex flex-wrap items-center gap-2 sm:gap-4 rounded-2xl border border-white/20 bg-white/90 px-4 py-3 sm:px-6 sm:py-4 shadow-[0_20px_50px_rgba(0,0,0,0.2)] backdrop-blur-md"
          >
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Bulk Actions</span>
              <span className="text-sm font-black text-slate-800">{selectedEmployeeIds.length} Selected</span>
            </div>

            <div className="hidden sm:block mx-1 h-10 w-px bg-gray-200" />

            <div className="flex items-center gap-2 flex-wrap">
              {/* Clear */}
              <button
                type="button"
                onClick={() => setSelectedEmployeeIds([])}
                className="px-3 py-1.5 text-xs font-bold text-gray-500 transition-colors hover:text-gray-700"
              >
                Clear
              </button>

              {/* All */}
              <button
                type="button"
                onClick={openBulkModalForAll}
                disabled={!allVisibleSelected}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${allVisibleSelected
                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                  }`}
                title={allVisibleSelected ? 'Apply to all employees across all pages' : 'Select all visible employees to enable'}
              >
                <FaLayerGroup size={11} />
                All
              </button>

              {/* Continue with selected */}
              <ManagementButton
                tone="blue" variant="solid"
                leftIcon={<FaCheck />}
                onClick={openBulkModalForSelected}
                className="shadow-lg shadow-blue-200 !text-xs !px-3 !py-1.5"
              >
                Continue
              </ManagementButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BULK APPROVE MODAL ── */}
      {showBulkModal && (
        <Modal
          isOpen={showBulkModal}
          onClose={closeBulkModal}
          title="Bulk Approve Attendance"
          subtitle={
            bulkScope === 'all'
              ? 'Applies to all employees across all pages'
              : `${selectedEmployeeIds.length} employee${selectedEmployeeIds.length > 1 ? 's' : ''} selected`
          }
          icon={<FaCheck className="h-5 w-5" />}
          size="2xl"
          footer={(
            <div className="flex w-full justify-end gap-3">
              <button type="button" onClick={closeBulkModal} disabled={bulkSaving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <ManagementButton
                tone="blue" leftIcon={<FaCheck />}
                loading={bulkSaving}
                disabled={bulkScope === 'selected' && !selectedEmployeeIds.length}
                onClick={handleBulkApprove}
              >
                Confirm Approve {bulkScope === 'all' ? '(All)' : selectedEmployeeIds.length}
              </ManagementButton>
            </div>
          )}
        >
          <div className="space-y-4">
            {bulkScope === 'all' ? (
              <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm font-medium text-amber-700">
                <span className="font-bold">All employees</span> across all pages will be affected
              </p>
            ) : (
              <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-medium text-blue-700">
                You are about to approve attendance for <span className="font-bold">{selectedEmployeeIds.length}</span> selected employee{selectedEmployeeIds.length > 1 ? 's' : ''}.
              </p>
            )}

            <BulkApprovalPanel
              bulkMode={bulkMode} setBulkMode={setBulkMode}
              bulkHalfDayType={bulkHalfDayType} setBulkHalfDayType={setBulkHalfDayType}
              bulkLeaveType={bulkLeaveType} setBulkLeaveType={setBulkLeaveType}
              bulkLeaveTypeValue={bulkLeaveTypeValue} setBulkLeaveTypeValue={setBulkLeaveTypeValue}
              bulkNotes={bulkNotes} setBulkNotes={setBulkNotes}
            />
          </div>
        </Modal>
      )}

      {/* ── Single-record manage modal ── */}
      <ManageAttendanceModal
        isOpen={Boolean(modalState)}
        employee={modalState?.employee}
        initialStatus={modalState?.initialStatus}
        onClose={() => setModalState(null)}
        onSave={handleSave}
        saving={saving}
      />

      {/* ── Flag toggle confirm modal ── */}
      <FlagConfirmModal
        state={flagConfirm}
        onClose={() => setFlagConfirm(null)}
        onConfirm={handleConfirmFlagToggle}
        saving={saving}
      />

      {/* ── Attendance logs modal ── */}
      {logsModal && (
        <AttendanceLogsModal
          id={logsModal.id}
          type={logsModal.type}
          onClose={() => setLogsModal(null)}
        />
      )}
    </ManagementHub>
  );
}