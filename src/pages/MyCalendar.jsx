import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaCalendarAlt,
  FaSpinner,
  FaCheckCircle,
  FaTimesCircle,
  FaUmbrellaBeach,
  FaInfoCircle,
  FaUser,
  FaClock,
  FaIdCard,
  FaBriefcase,
  FaSignOutAlt,
  FaSignInAlt,
  FaHourglassHalf,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa';
import apiCall from '../utils/api';
import { ManagementHub } from '../components/common';
import ModalScrollLock from '../components/ModalScrollLock';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import AdvancedDateFilter from '../components/AdvancedDateFilter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse "HH:MM AM/PM" → total minutes since midnight
 */
function parseTime(timeStr) {
  if (!timeStr) return null;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let [, h, m, period] = match;
  h = parseInt(h, 10);
  m = parseInt(m, 10);
  if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (period.toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

/** Format total minutes → "Xh Ym" */
function formatMinutes(mins) {
  if (mins == null || mins < 0) return '0h 0m';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}

// Pair consecutive PUNCH_IN / PUNCH_OUT activities
function pairActivities(rawActivities) {
  const activities = [];
  if (!Array.isArray(rawActivities)) return activities;
  for (let i = 0; i < rawActivities.length; i++) {
    if (rawActivities[i].type === 'PUNCH_IN') {
      const inAct = rawActivities[i];
      let outAct = null;
      if (i + 1 < rawActivities.length && rawActivities[i + 1].type === 'PUNCH_OUT') {
        outAct = rawActivities[i + 1];
        i++;
      }
      activities.push([inAct, outAct]);
    } else if (rawActivities[i].type === 'PUNCH_OUT') {
      activities.push([null, rawActivities[i]]);
    } else if (Array.isArray(rawActivities[i])) {
      // Handle legacy format if still pairs
      activities.push(rawActivities[i]);
    } else {
      activities.push([rawActivities[i], null]);
    }
  }
  return activities;
}

// Pair consecutive BREAK_START / BREAK_END activities
function pairBreaks(rawBreaks) {
  const paired = [];
  if (!Array.isArray(rawBreaks)) return paired;
  for (let i = 0; i < rawBreaks.length; i++) {
    if (rawBreaks[i].type === 'BREAK_START') {
      const start = rawBreaks[i];
      let end = null;
      if (i + 1 < rawBreaks.length && rawBreaks[i + 1].type === 'BREAK_END') {
        end = rawBreaks[i + 1];
        i++;
      }
      paired.push([start, end]);
    } else if (rawBreaks[i].type === 'BREAK_END') {
      paired.push([null, rawBreaks[i]]);
    } else if (Array.isArray(rawBreaks[i])) {
      paired.push(rawBreaks[i]); // legacy pairs
    } else {
      paired.push([rawBreaks[i], null]);
    }
  }
  return paired;
}

/**
 * Compute worked minutes and break minutes from the day's API data.
 * activities: flat array of activity objects
 * breaks: flat array of break objects
 * Returns { workedMinutes, breakMinutes, firstIn, lastOut, hasOpenSession }
 */
function computeWorkStats(dayData) {
  if (!dayData) return null;

  const activities = pairActivities(dayData.activities);
  const rawBreaks = dayData.breaks || [];
  const breaks = pairBreaks(rawBreaks);

  let totalWork = 0;
  let firstIn = null;
  let lastOut = null;

  activities.forEach((pair) => {
    const inTime = pair[0]?.time ? parseTime(pair[0].time) : null;
    const outTime = pair[1]?.time ? parseTime(pair[1].time) : null;
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
  breaks.forEach((pair) => {
    const startTime = pair[0]?.time ? parseTime(pair[0].time) : null;
    const endTime = pair[1]?.time ? parseTime(pair[1].time) : null;
    if (startTime != null && endTime != null) {
      let diff = endTime - startTime;
      if (diff < 0) diff += 24 * 60;
      totalBreak += diff;
    }
  });

  const netWork = Math.max(0, totalWork - totalBreak);

  return {
    workedMinutes: netWork,
    breakMinutes: totalBreak,
    grossMinutes: totalWork,
    firstIn: firstIn != null ? minutesToTimeStr(firstIn) : null,
    lastOut: lastOut != null ? minutesToTimeStr(lastOut) : null,
    hasOpenSession: activities.some((pair) => pair[0]?.time && !pair[1]?.time),
  };
}

function minutesToTimeStr(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

/** Determine display status for a day */
function getDayStatus(dayData) {
  if (!dayData) return null;
  const s = dayData.day_status;
  if (dayData.is_holiday && (!s || s === 'upcoming' || s === '')) return 'holiday';
  if (dayData.is_leave) return 'leave';
  if (s === '') return 'present';
  return s || null;
}

// ─── Constants (STATUS_STYLES, CALENDAR_STATUS_STYLES unchanged) ────────────
const STATUS_STYLES = {
  present: {
    cell: 'bg-emerald-50/60 border-emerald-100',
    pill: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    label: 'Present',
    icon: FaCheckCircle,
    dot: 'bg-emerald-500',
    color: 'text-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700',
  },
  absent: {
    cell: 'bg-rose-50/60 border-rose-100',
    pill: 'bg-rose-100 text-rose-700 border-rose-200',
    label: 'Absent',
    icon: FaTimesCircle,
    dot: 'bg-rose-500',
    color: 'text-rose-600',
    badge: 'bg-rose-50 text-rose-700',
  },
  holiday: {
    cell: 'bg-amber-50/60 border-amber-100',
    pill: 'bg-amber-100 text-amber-700 border-amber-200',
    label: 'Holiday',
    icon: FaUmbrellaBeach,
    dot: 'bg-amber-500',
    color: 'text-amber-600',
    badge: 'bg-amber-50 text-amber-700',
  },
  weekend: {
    cell: 'bg-slate-50/60 border-slate-100',
    pill: 'bg-slate-100 text-slate-600 border-slate-200',
    label: 'Weekend',
    icon: FaCalendarAlt,
    dot: 'bg-slate-400',
    color: 'text-slate-500',
    badge: 'bg-slate-50 text-slate-600',
  },
  leave: {
    cell: 'bg-violet-50/60 border-violet-100',
    pill: 'bg-violet-100 text-violet-700 border-violet-200',
    label: 'Leave',
    icon: FaInfoCircle,
    dot: 'bg-violet-500',
    color: 'text-violet-600',
    badge: 'bg-violet-50 text-violet-700',
  },
  upcoming: {
    cell: 'bg-white border-gray-100',
    pill: 'bg-gray-100 text-gray-500 border-gray-200',
    label: 'Upcoming',
    icon: FaClock,
    dot: 'bg-gray-300',
    color: 'text-gray-400',
    badge: 'bg-gray-50 text-gray-500',
  },
  half_day: {
    cell: 'bg-orange-50/60 border-orange-100',
    pill: 'bg-orange-100 text-orange-700 border-orange-200',
    label: 'Half Day',
    icon: FaHourglassHalf,
    dot: 'bg-orange-500',
    color: 'text-orange-600',
    badge: 'bg-orange-50 text-orange-700',
  },
  not_joined: {
    cell: 'bg-slate-50/30 border-slate-100 opacity-50',
    pill: 'bg-slate-100 text-slate-500 border-slate-200',
    label: 'Not Joined',
    icon: FaInfoCircle,
    dot: 'bg-slate-300',
    color: 'text-slate-400',
    badge: 'bg-slate-50 text-slate-500',
  },
};

// ─── Sub-components (CalendarCell, ShiftBanner, CalendarSummaryCard) unchanged ───
const CalendarCell = ({ cell, onClick }) => {
  const { dayNumber, isCurrentMonth, data, isToday } = cell;

  if (!isCurrentMonth) {
    return (
      <div className="min-h-[110px] bg-gray-50/20 p-2 border-r border-b border-gray-100/70">
        <span className="text-xs text-gray-200 font-medium">{dayNumber}</span>
      </div>
    );
  }

  const status = getDayStatus(data);
  const styles = STATUS_STYLES[status] || STATUS_STYLES.upcoming;
  const workStats =
    (status === 'present' || (data && data.activities?.length > 0))
      ? computeWorkStats(data)
      : null;

  return (
    <motion.div
      whileHover={{ scale: 1.015, zIndex: 10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={() => data?.day_status !== 'not_joined' && onClick(cell)}
      className={`min-h-[110px] p-2.5 transition-all border-r border-b cursor-pointer
        ${styles.cell}
        ${isToday ? 'ring-2 ring-indigo-400 ring-inset z-10' : ''}`}
    >
      <div className="flex items-start justify-between mb-1.5">
        <span
          className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold
          ${isToday ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-300' : 'text-gray-700'}`}
        >
          {dayNumber}
        </span>
        {data?.is_holiday && (
          <span title={data.is_holiday.name} className="text-amber-400">
            <FaUmbrellaBeach size={10} />
          </span>
        )}
      </div>

      {status && (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${styles.pill}`}
        >
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
        <p className="mt-1 text-[9px] font-bold text-violet-700 truncate leading-tight">
          {data.is_leave.code} • {data.is_leave.type?.replace('_', ' ')}
        </p>
      )}

      {data?.is_holiday && status === 'holiday' && (
        <p className="mt-1 text-[9px] text-amber-700 font-medium leading-tight line-clamp-2">
          {data.is_holiday.name}
        </p>
      )}

      {data?.is_approved === false && status === 'present' && (
        <p className="mt-1 text-[8px] font-bold text-orange-500 uppercase tracking-wider">
          Pending
        </p>
      )}
    </motion.div>
  );
};

// ─── Stats Summary Card ────
const CALENDAR_STATUS_STYLES = STATUS_STYLES; // reuse same styles

const CalendarSummaryCard = ({ label, value, icon: Icon, type }) => {
  const styles = CALENDAR_STATUS_STYLES[type] || CALENDAR_STATUS_STYLES.upcoming;
  return (
    <div className="p-3.5 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center gap-3 hover:shadow-md transition-all hover:-translate-y-0.5">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${styles.pill}`}
      >
        <Icon size={14} />
      </div>
      <div>
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">
          {label}
        </p>
        <p className="text-lg font-black text-gray-900">{value}</p>
      </div>
    </div>
  );
};

// ─── Shift Banner ────
const ShiftBanner = ({ shift, employee, statistics }) => {
  const expectedH = shift ? Math.floor(shift.expected_work_minutes / 60) : 0;
  const expectedM = shift ? shift.expected_work_minutes % 60 : 0;
  const workedH = statistics ? Math.floor(statistics.worked_minutes / 60) : 0;
  const workedM = statistics ? Math.round(statistics.worked_minutes % 60) : 0;
  const pct =
    statistics?.expected_work_minutes > 0
      ? Math.min(
          100,
          Math.round(
            (statistics.worked_minutes / statistics.expected_work_minutes) * 100
          )
        )
      : 0;

  return (
    <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 rounded-2xl p-5 text-white shadow-xl shadow-indigo-200/60 mb-6 relative overflow-hidden">
      <div className="absolute -right-8 -top-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -left-8 -bottom-8 w-36 h-36 bg-violet-400/20 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-xl font-black border border-white/30">
            {employee?.name
              ? employee.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
              : <FaUser size={20} />}
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight">
              {employee?.name || 'My Calendar'}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1 opacity-90">
              {employee?.employee_code && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-lg">
                  <FaIdCard size={10} /> {employee.employee_code}
                </span>
              )}
              {employee?.designation && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-lg">
                  <FaBriefcase size={10} />{' '}
                  {employee.designation.replace(/_/g, ' ')}
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
            <p className="text-base font-black">
              {shift?.start_time || '--:--'}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-200 flex items-center gap-1 mb-0.5">
              <FaSignOutAlt size={9} /> Shift Out
            </p>
            <p className="text-base font-black">
              {shift?.end_time || '--:--'}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-200 flex items-center gap-1 mb-0.5">
              <FaClock size={9} /> Target
            </p>
            <p className="text-base font-black">{`${expectedH}h ${expectedM}m`}</p>
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
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Day Details Modal ────────────────────────────────────────────────────────
const DayDetailsModal = ({ cell, onClose, shift }) => {
  if (!cell) return null;
  const { date, data } = cell;
  const status = getDayStatus(data);
  const workStats = data ? computeWorkStats(data) : null;

  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const InfoRow = ({ label, value, icon: Icon, colorClass }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
      <div className="flex items-center gap-2.5">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorClass}`}
        >
          <Icon size={12} />
        </div>
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <span className="text-sm font-black text-gray-800">{value || '—'}</span>
    </div>
  );

  const activities = data?.activities ? pairActivities(data.activities) : [];
  const rawBreaks = data?.breaks || [];
  const breaks = pairBreaks(rawBreaks);
  const logs = data?.logs || [];

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <ModalScrollLock />
      <motion.div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">
              {formattedDate}
            </p>
            {status && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${STATUS_STYLES[status]?.pill}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLES[status]?.dot}`}
                />
                {STATUS_STYLES[status]?.label}
              </span>
            )}
            {data?.is_holiday && (
              <p className="text-xs font-bold text-amber-600 mt-1">
                {data.is_holiday.name}{' '}
                {data.is_holiday.is_optional ? '(Optional)' : '(Public Holiday)'}
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
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Worked stats */}
          {workStats && workStats.grossMinutes > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Work Summary
              </p>
              <div className="grid grid-cols-2 gap-2">
                <InfoRow
                  label="Total Work"
                  value={formatMinutes(workStats.workedMinutes)}
                  icon={FaClock}
                  colorClass="bg-emerald-100 text-emerald-600"
                />
                <InfoRow
                  label="Break"
                  value={formatMinutes(workStats.breakMinutes)}
                  icon={FaHourglassHalf}
                  colorClass="bg-amber-100 text-amber-600"
                />
                <InfoRow
                  label="First In"
                  value={workStats.firstIn || '—'}
                  icon={FaSignInAlt}
                  colorClass="bg-indigo-100 text-indigo-600"
                />
                <InfoRow
                  label="Last Out"
                  value={
                    workStats.lastOut ||
                    (workStats.hasOpenSession ? 'Active' : '—')
                  }
                  icon={FaSignOutAlt}
                  colorClass="bg-slate-100 text-slate-600"
                />
              </div>
              {shift && (
                <InfoRow
                  label="Expected"
                  value={formatMinutes(
                    shift.expected_work_minutes - (shift.break_minutes || 0)
                  )}
                  icon={FaClock}
                  colorClass="bg-gray-100 text-gray-500"
                />
              )}
              {data?.is_approved === false && (
                <div className="flex items-center gap-2 p-2.5 bg-orange-50 border border-orange-100 rounded-xl">
                  <FaInfoCircle size={12} className="text-orange-500" />
                  <span className="text-[11px] font-bold text-orange-600">
                    Attendance pending approval
                  </span>
                </div>
              )}
              {data?.is_approved === true && (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <FaCheckCircle size={12} className="text-emerald-500" />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-emerald-600">
                      Attendance approved
                    </span>
                    {data.verified_by?.name && (
                      <span className="text-[9px] text-emerald-500">
                        Verified by {data.verified_by.name}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity Sessions */}
          {activities.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Sessions
              </p>
              <div className="space-y-1.5">
                {activities.map((pair, i) => {
                  const inAct = pair[0];
                  const outAct = pair[1];
                  return (
                    <div
                      key={i}
                      className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-emerald-600">
                          <FaSignInAlt size={11} />
                          <span className="font-bold">
                            {inAct?.time || '—'}
                          </span>
                        </div>
                        <div className="flex-1 h-px bg-gray-200" />
                        <div className="flex items-center gap-1.5 text-rose-500">
                          <span className="font-bold">
                            {outAct?.time || (
                              <span className="text-indigo-400 animate-pulse">
                                Active
                              </span>
                            )}
                          </span>
                          <FaSignOutAlt size={11} />
                        </div>
                      </div>
                      {(inAct?.attendance_method ||
                        inAct?.created_by?.name ||
                        outAct?.attendance_method ||
                        outAct?.created_by?.name) && (
                        <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-gray-100">
                          <span className="flex items-center gap-1 truncate">
                            {inAct?.attendance_method && (
                              <span className="capitalize">
                                {inAct.attendance_method}
                              </span>
                            )}
                            {inAct?.created_by?.name
                              ? ` • In by ${inAct.created_by.name}`
                              : ''}
                          </span>
                          <span className="flex items-center gap-1 truncate">
                            {outAct?.created_by?.name
                              ? `Out by ${outAct.created_by.name}`
                              : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Break Sessions – MOVED HERE, right after sessions */}
          {breaks.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Breaks ({breaks.length})
              </p>
              <div className="space-y-1.5">
                {breaks.map((pair, i) => {
                  const s = pair[0]?.time ? parseTime(pair[0].time) : null;
                  const e = pair[1]?.time ? parseTime(pair[1].time) : null;
                  let dur = null;
                  if (s != null && e != null) {
                    dur = e - s;
                    if (dur < 0) dur += 24 * 60;
                  }
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-100 text-[11px]"
                    >
                      <span className="font-bold text-amber-700">
                        {pair[0]?.time || '—'} → {pair[1]?.time || '—'}
                      </span>
                      {dur != null && dur > 0 && (
                        <span className="font-black text-amber-600">{dur}m</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activity Logs – now appears after breaks */}
          {logs.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 mt-4">
                Activity Logs
              </p>
              <div className="space-y-2">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-[11px] p-2 bg-slate-50 border border-slate-100 rounded-lg"
                  >
                    <FaClock className="mt-0.5 text-slate-400" size={10} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-700 capitalize">
                          {log.log_type?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-slate-500">{log.time}</span>
                      </div>
                      <div className="text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                        {log.created_by?.name && (
                          <span>
                            <span className="font-medium text-slate-600">
                              By:
                            </span>{' '}
                            {log.created_by.name}
                          </span>
                        )}
                        {log.day_status && (
                          <span>
                            <span className="font-medium text-slate-600">
                              Status:
                            </span>{' '}
                            {log.day_status}
                          </span>
                        )}
                        {log.attendance_method && (
                          <span>
                            <span className="font-medium text-slate-600">
                              Method:
                            </span>{' '}
                            <span className="capitalize">
                              {log.attendance_method}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leave info */}
          {data?.is_leave && (
            <div className="p-4 bg-violet-50 rounded-xl border border-violet-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center mb-3">
                <FaInfoCircle size={20} />
              </div>
              <h4 className="text-base font-black text-violet-900">
                {data.is_leave.name}
              </h4>
              <p className="text-xs font-bold text-violet-500 uppercase tracking-widest mt-0.5">
                {data.is_leave.code} •{' '}
                {data.is_leave.type?.replace('_', ' ')}
              </p>
            </div>
          )}

          {/* No data fallback */}
          {!workStats?.grossMinutes &&
            !data?.is_leave &&
            !data?.is_holiday &&
            (status === 'absent' ||
              status === 'upcoming' ||
              status === 'not_joined') && (
              <div className="py-10 flex flex-col items-center text-center text-gray-300">
                <FaCalendarAlt size={40} className="mb-3 opacity-30" />
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {status === 'not_joined'
                    ? 'Not yet joined'
                    : status === 'absent'
                    ? 'No attendance recorded'
                    : 'Upcoming day'}
                </p>
              </div>
            )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const MyCalendar = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  const lastFetchedKeyRef = useRef(null);

  const fetchCalendar = useCallback(async (m, y) => {
    setLoading(true);
    setError(null);
    try {
      const companyId = JSON.parse(localStorage.getItem('company'))?.id;
      const response = await apiCall(
        `/shifts/my-calendar?month=${m}&year=${y}`,
        'GET',
        null,
        companyId
      );
      const json = await response.json();
      if (json.success) {
        setData({ ...json.data, meta: json.meta });
      } else {
        setError(json.message || 'Failed to fetch calendar');
        toast.error(json.message || 'Failed to fetch calendar');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      toast.error('Could not connect to the server');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const key = `${month}-${year}`;
    if (lastFetchedKeyRef.current === key) return;
    lastFetchedKeyRef.current = key;
    fetchCalendar(month, year);
  }, [month, year, fetchCalendar]);

  const handleFilterChange = (filter) => {
    if (filter.month && filter.year) {
      setCurrentDate(new Date(filter.year, filter.month - 1, 1));
    }
  };

  const navigateMonth = (dir) => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };

  // ── Build calendar grid ──
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

      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

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

  return (
    <ManagementHub
      eyebrow={
        <>
          <FaCalendarAlt size={11} /> Dashboard
        </>
      }
      title="Attendance Calendar"
      description="Track your attendance, leave history, and upcoming holidays."
      accent="indigo"
      onRefresh={() => fetchCalendar(month, year)}
    >
      <div className="max-w-screen-2xl mx-auto px-4 pb-12">
        <ShiftBanner shift={shift} employee={user} statistics={statistics} />

        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateMonth(-1)}
              className="w-8 h-8 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all shadow-sm"
            >
              <FaChevronLeft size={11} />
            </button>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight min-w-[180px] text-center">
              {currentDate.toLocaleString('default', { month: 'long' })}{' '}
              {year}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="w-8 h-8 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all shadow-sm"
            >
              <FaChevronRight size={11} />
            </button>
            <AdvancedDateFilter
              value={{ month, year }}
              onChange={handleFilterChange}
              tabOptions={['month']}
              placeholder="Jump to month"
              buttonClassName="bg-white border border-gray-100 px-3 py-2 rounded-xl shadow-sm hover:bg-gray-50 transition-all font-bold text-gray-600 text-xs"
            />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-2">
            {['present', 'absent', 'holiday', 'leave', 'half_day'].map((s) => (
              <div
                key={s}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-gray-100 bg-white shadow-sm"
              >
                <span
                  className={`w-2 h-2 rounded-full ${STATUS_STYLES[s].dot}`}
                />
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">
                  {STATUS_STYLES[s].label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 mb-4">
          <CalendarSummaryCard
            label="Total"
            value={meta.total_days || 0}
            icon={FaCalendarAlt}
            type="upcoming"
          />
          <CalendarSummaryCard
            label="Present"
            value={meta.present || 0}
            icon={FaCheckCircle}
            type="present"
          />
          <CalendarSummaryCard
            label="Absent"
            value={meta.absent || 0}
            icon={FaTimesCircle}
            type="absent"
          />
          <CalendarSummaryCard
            label="Leave"
            value={meta.leave || 0}
            icon={FaInfoCircle}
            type="leave"
          />
          <CalendarSummaryCard
            label="Holiday"
            value={meta.holiday || 0}
            icon={FaUmbrellaBeach}
            type="holiday"
          />
          <CalendarSummaryCard
            label="Weekend"
            value={meta.weekend || 0}
            icon={FaCalendarAlt}
            type="weekend"
          />
          <CalendarSummaryCard
            label="Half Day"
            value={meta.half_day || 0}
            icon={FaHourglassHalf}
            type="half_day"
          />
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <FaSpinner className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-[10px] font-black text-indigo-800 uppercase tracking-widest animate-pulse">
                  Loading…
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="py-3 text-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {day}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 bg-gray-100/50 gap-px">
            {error ? (
              <div className="col-span-7 py-24 bg-white flex flex-col items-center gap-4 text-rose-400">
                <FaTimesCircle size={40} className="opacity-30" />
                <p className="font-black uppercase tracking-widest text-sm">
                  {error}
                </p>
                <button
                  onClick={() => fetchCalendar(month, year)}
                  className="px-5 py-2 bg-rose-50 text-rose-600 rounded-xl font-bold text-xs uppercase tracking-widest border border-rose-100 hover:bg-rose-100 transition-all"
                >
                  Retry
                </button>
              </div>
            ) : (
              calendarGrid.map((cell, idx) => (
                <CalendarCell
                  key={idx}
                  cell={cell}
                  onClick={setSelectedCell}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedCell && (
          <DayDetailsModal
            cell={selectedCell}
            onClose={() => setSelectedCell(null)}
            shift={shift}
          />
        )}
      </AnimatePresence>
    </ManagementHub>
  );
};

export default MyCalendar;