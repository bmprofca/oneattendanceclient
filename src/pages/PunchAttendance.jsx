import React, { useState, useEffect, useCallback } from 'react';
import {
  FaFingerprint, FaClock, FaCoffee, FaSignInAlt, FaSignOutAlt,
  FaMapMarkerAlt, FaCamera, FaIdCard, FaWifi, FaHandPaper,
  FaTimesCircle, FaCalendarAlt, FaPause, FaPlay, FaSpinner,
  FaHistory, FaBolt, FaCheckCircle, FaSync,
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBriefcase } from 'react-icons/fa';
import { toast } from 'react-toastify';
import apiCall from '../utils/api';
import { fetchCurrentAttendanceStatus } from '../utils/attendanceStatus';
import { getPreciseLocation } from '../utils/geolocation';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import SwipeConfirmationModal from '../components/SwipeConfirmationModal';

// ─── Constants ────────────────────────────────────────────────────────────────

const ATTENDANCE_ICONS = {
  gps: FaMapMarkerAlt, face: FaCamera, qr: FaIdCard,
  fingerprint: FaFingerprint, ip: FaWifi, manual: FaHandPaper,
};

const STATUS_CONFIG = {
  WORKING: { label: 'Working', dot: 'bg-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: FaPlay },
  ON_BREAK: { label: 'On Break', dot: 'bg-amber-400', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: FaPause },
  OFF_DUTY: { label: 'Off Duty', dot: 'bg-slate-500', badge: 'bg-slate-500/15 text-slate-400 border-slate-500/30', icon: FaTimesCircle },
};

const ACTION_CONFIG = {
  PUNCH_IN: { label: 'Punch In', icon: FaSignInAlt, key: 'punch-in', from: '#10b981', to: '#0d9488', glow: 'rgba(16,185,129,0.35)' },
  PUNCH_OUT: { label: 'Punch Out', icon: FaSignOutAlt, key: 'punch-out', from: '#f43f5e', to: '#e11d48', glow: 'rgba(244,63,94,0.35)' },
  BREAK_START: { label: 'Start Break', icon: FaCoffee, key: 'break-in', from: '#f59e0b', to: '#d97706', glow: 'rgba(245,158,11,0.35)' },
  BREAK_END: { label: 'End Break', icon: FaPlay, key: 'break-out', from: '#6366f1', to: '#4f46e5', glow: 'rgba(99,102,241,0.35)' },
};

const ACTION_ENDPOINTS = {
  'punch-in': '/attendance/punch-in', 'punch-out': '/attendance/punch-out',
  'break-in': '/attendance/break-in', 'break-out': '/attendance/break-out',
};

const ACTIVITY_STYLE = {
  PUNCH_IN: { icon: FaSignInAlt, color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Punch In' },
  PUNCH_OUT: { icon: FaSignOutAlt, color: '#f43f5e', bg: 'rgba(244,63,94,0.12)', label: 'Punch Out' },
  BREAK_START: { icon: FaCoffee, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Break Start' },
  BREAK_END: { icon: FaPlay, color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: 'Break End' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const minsToHM = (m = 0) => `${Math.floor(m / 60)}h ${m % 60}m`;
const pct = (w, e) => (!e ? 0 : Math.min(100, Math.round((w / e) * 100)));

// ─── Sub-components ───────────────────────────────────────────────────────────

const Ring = ({ percent, size = 110, stroke = 9 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = percent >= 100 ? '#10b981' : percent >= 60 ? '#6366f1' : percent >= 30 ? '#f59e0b' : '#f43f5e';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - (percent / 100) * circ }}
        transition={{ duration: 1, ease: 'easeOut' }}
        strokeLinecap="round"
      />
    </svg>
  );
};

const StatChip = ({ label, value, color }) => (
  <div className="flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-100">
    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
    <span className="text-sm font-black text-slate-800" style={{ color }}>{value}</span>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const PunchAttendance = () => {
  const { attendanceMethods } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(null);
  const [activeMode, setActiveMode] = useState(null);
  const [loadingAction, setLoadingAction] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusData, setStatusData] = useState(null);
  const [swipeModalOpen, setSwipeModal] = useState(false);
  const [pendingAction, setPending] = useState(null);

  const status = statusData?.status || 'OFF_DUTY';
  const allowedActions = statusData?.allowed_actions || [];
  const summary = statusData?.today_summary || {};
  const activities = statusData?.today_activities || [];
  const shift = statusData?.shift || {};
  const dayInfo = statusData?.day_info || {};

  const workedMins = summary.total_work_minutes || 0;
  const breakMins = summary.total_break_minutes || 0;
  const expectedMins = shift.expected_work_minutes || 0;
  const progress = pct(workedMins, expectedMins);
  const progressColor = progress >= 100 ? '#10b981' : progress >= 60 ? '#6366f1' : progress >= 30 ? '#f59e0b' : '#f43f5e';

  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.OFF_DUTY;
  const StatusIcon = statusCfg.icon;
  const curMethod = attendanceMethods?.find(m => m.method === activeTab);

  // ─── Init tabs ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (attendanceMethods?.length > 0) {
      const first = attendanceMethods[0];
      setActiveTab(first.method);
      setActiveMode(first.is_manual ? 'manual' : first.is_auto ? 'auto' : null);
    }
  }, [attendanceMethods]);

  useEffect(() => {
    if (!activeTab || !attendanceMethods) return;
    const m = attendanceMethods.find(m => m.method === activeTab);
    if (!m) return;
    if (!activeMode || (activeMode === 'manual' && !m.is_manual) || (activeMode === 'auto' && !m.is_auto)) {
      setActiveMode(m.is_manual ? 'manual' : m.is_auto ? 'auto' : null);
    }
  }, [activeTab, attendanceMethods]);

  // ─── Fetch status ────────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async (force = false) => {
    setLoadingStatus(true);
    try {
      const company = JSON.parse(localStorage.getItem('company'));
      const res = await fetchCurrentAttendanceStatus(company?.id, { forceRefresh: force });
      if (res.success) setStatusData(res.data);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch status');
    } finally { setLoadingStatus(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // ─── API action ──────────────────────────────────────────────────────────────
  const getPublicIP = async () => {
    try { return (await (await fetch('https://api.ipify.org?format=json')).json()).ip; }
    catch { return ''; }
  };

  const callAPI = async (endpoint, key) => {
    setLoadingAction(key);
    try {
      const company = JSON.parse(localStorage.getItem('company'));
      const method = activeTab || 'manual';
      const mode = activeMode || 'manual';
      const payload = { attendance_method: method, attendance_mode: mode };
      if (method === 'gps') { const loc = await getPreciseLocation(); Object.assign(payload, loc); }
      if (method === 'ip') { payload.ip_address = await getPublicIP(); }
      const res = await apiCall(endpoint, 'POST', payload, company?.id);
      const data = await res.json();
      if (res.ok && data.success) { await fetchStatus(true); return true; }
      toast.error(data.message || 'Action failed');
      return false;
    } catch (err) {
      if (err.code === 1) toast.error('Location permission denied.');
      else toast.error(err.message || 'Error');
      return false;
    } finally { setLoadingAction(null); }
  };

  const handleConfirm = async () => {
    const action = pendingAction;
    setSwipeModal(false); setPending(null);
    const endpoint = ACTION_ENDPOINTS[action];
    if (!endpoint) return;
    const ok = await callAPI(endpoint, action);
    if (ok) {
      const msgs = { 'punch-in': '✅ Punched In!', 'punch-out': '✅ Punched Out!', 'break-in': '☕ Break Started', 'break-out': '💪 Break Ended — Welcome back!' };
      toast.success(msgs[action] || 'Done!');
    }
  };

  const trigger = (key) => { setPending(key); setSwipeModal(true); };

  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-5 pb-6">

      {/* ── HERO STATUS CARD ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden bg-white border border-slate-100 shadow-xl shadow-slate-200/40"
      >
        {/* Decorative blobs */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #4f46e5, transparent)' }} />

        <div className="relative z-10 p-6">
          {/* Top row */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                <FaCalendarAlt className="inline mr-1.5 opacity-60" />
                {currentDate}
              </p>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Today's Session</h2>
                {dayInfo.is_holiday && <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-600 border border-amber-400/30">Holiday</span>}
                {dayInfo.is_weekend && <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-400/20 text-slate-500 border border-slate-400/30">Weekend</span>}
              </div>
            </div>

            {/* Status + Refresh */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchStatus(true)}
                disabled={loadingStatus}
                className="p-1.5 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50"
                title="Refresh status"
              >
                <FaSync className={`w-3.5 h-3.5 text-slate-400 ${loadingStatus ? 'animate-spin' : ''}`} />
              </button>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black ${statusCfg.badge}`}>
                {loadingStatus ? <FaSpinner className="animate-spin" /> : (
                  <>
                    <span className={`w-2 h-2 rounded-full animate-pulse ${statusCfg.dot}`} />
                    <StatusIcon />
                    <span>{statusCfg.label}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Progress + Stats */}
          <div className="flex items-center gap-6">
            {/* Ring */}
            <div className="relative shrink-0">
              <Ring percent={progress} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-slate-800 leading-none">{progress}%</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">done</span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap gap-2">
                <StatChip label="Worked" value={minsToHM(workedMins)} color={progressColor} />
                <StatChip label="Break" value={minsToHM(breakMins)} color="#f59e0b" />
                <StatChip label="Target" value={minsToHM(expectedMins)} color="#94a3b8" />
              </div>
              {/* Bar */}
              <div>
                <div className="h-2 rounded-full overflow-hidden bg-slate-100">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${progressColor}, ${progressColor}bb)` }}
                    initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] font-bold text-slate-400">
                  <span>{minsToHM(workedMins)} worked</span>
                  <span>{minsToHM(expectedMins)} target</span>
                </div>
              </div>
            </div>
          </div>

          {/* Shift strip */}
          {shift.start_time && (
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
              <FaBriefcase className="opacity-40" />
              <span>Shift <strong className="text-slate-700">{shift.start_time?.slice(0, 5)}</strong> – <strong className="text-slate-700">{shift.end_time?.slice(0, 5)}</strong></span>
              {shift.grace_minutes > 0 && (
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-black border border-indigo-100 bg-indigo-50 text-indigo-500">
                  Grace {shift.grace_minutes}m
                </span>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── ACTION CARD ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden"
      >
        {/* Method Tabs */}
        {attendanceMethods?.length > 0 && (
          <div className="flex gap-1 p-3 border-b border-slate-100 bg-slate-50/60 overflow-x-auto no-scrollbar">
            {attendanceMethods.map((m) => {
              const TabIcon = ATTENDANCE_ICONS[m.method] || FaFingerprint;
              const isActive = activeTab === m.method;
              return (
                <button
                  key={m.method}
                  onClick={() => setActiveTab(m.method)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all font-bold text-sm flex-shrink-0 ${isActive ? 'bg-white text-indigo-600 shadow-md border border-slate-200/80 scale-[1.02]' : 'text-slate-400 hover:text-slate-600 hover:bg-white/60'
                    }`}
                >
                  <TabIcon className={`w-4 h-4 ${isActive ? 'text-indigo-500' : 'text-slate-300'}`} />
                  <span className="capitalize">{m.method}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Mode toggle */}
        {activeTab && (
          <div className="px-5 py-2.5 border-b border-slate-100 bg-indigo-50/40 flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Validation Mode</span>
            <div className="flex bg-slate-100 p-1 rounded-xl ml-auto">
              {[['manual', curMethod?.is_manual], ['auto', curMethod?.is_auto]].map(([mode, enabled]) => (
                <button
                  key={mode}
                  onClick={() => enabled && setActiveMode(mode)}
                  disabled={!enabled}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all capitalize ${activeMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
                    } ${!enabled ? 'opacity-30 cursor-not-allowed' : 'hover:text-slate-600'}`}
                >{mode}</button>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-5">
          {loadingStatus ? (
            <div className="py-12 flex flex-col items-center gap-3 text-slate-300">
              <FaSpinner className="animate-spin text-3xl" />
              <span className="text-xs font-black uppercase tracking-widest">Fetching status...</span>
            </div>
          ) : allowedActions.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center px-4">
              {dayInfo?.is_holiday || dayInfo?.is_weekend ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-2">
                    <FaCalendarAlt className="text-3xl text-indigo-400" />
                  </div>
                  <p className="text-lg font-black text-indigo-600">
                    {dayInfo.is_holiday ? "It's a Holiday!" : "Enjoy your Weekend!"}
                  </p>
                  <p className="text-sm text-slate-500 max-w-[250px]">
                    Today is marked as your {dayInfo.is_holiday ? "holiday" : "weekend"}. Take some time off to rest and recharge!
                  </p>
                </>
              ) : (
                <>
                  <FaBolt className="text-4xl opacity-30 text-slate-300" />
                  <p className="text-sm font-black text-slate-400">No actions available</p>
                  <p className="text-xs text-slate-400">Your attendance status is up to date</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {allowedActions.map((action, i) => {
                const cfg = ACTION_CONFIG[action];
                if (!cfg) return null;
                const BtnIcon = cfg.icon;
                const isLoading = loadingAction === cfg.key;
                return (
                  <motion.button
                    key={action}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    whileHover={{ scale: 1.03, y: -3 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => trigger(cfg.key)}
                    disabled={!!loadingAction}
                    className="relative flex flex-col items-center justify-center gap-3 py-8 rounded-2xl font-bold text-white text-sm transition-all overflow-hidden disabled:opacity-60"
                    style={{
                      background: `linear-gradient(135deg, ${cfg.from}, ${cfg.to})`,
                      boxShadow: `0 8px 24px ${cfg.glow}`,
                    }}
                  >
                    {isLoading && (
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center backdrop-blur-sm rounded-2xl">
                        <div className="w-7 h-7 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                      <BtnIcon className="w-6 h-6" />
                    </div>
                    <span className="font-black text-sm">{cfg.label}</span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusCfg.dot} animate-pulse`} />
            <span className="text-xs text-slate-500 font-bold">{statusCfg.label}</span>
          </div>
          {activeTab && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 rounded-xl border border-indigo-100">
              <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">via</span>
              <span className="text-xs font-black text-indigo-600 capitalize">{activeTab}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── TODAY'S ACTIVITY TIMELINE ────────────────────────────────────────── */}
      {activities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
          className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <FaHistory className="text-indigo-500 w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">Today's Activity</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{activities.length} event{activities.length !== 1 ? 's' : ''} recorded</p>
            </div>
          </div>

          <div className="p-5 space-y-0">
            {activities.map((act, i) => {
              const style = ACTIVITY_STYLE[act.type] || { icon: FaCheckCircle, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: act.type };
              const Icon = style.icon;
              const isLast = i === activities.length - 1;
              return (
                <div key={i} className="flex gap-4">
                  {/* Timeline line + dot */}
                  <div className="flex flex-col items-center shrink-0">
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.07 }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center z-10"
                      style={{ background: style.bg }}
                    >
                      <Icon style={{ color: style.color }} className="w-4 h-4" />
                    </motion.div>
                    {!isLast && <div className="w-px flex-1 my-1" style={{ background: 'linear-gradient(to bottom, #e2e8f0, transparent)', minHeight: '16px' }} />}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 flex items-center justify-between pb-${isLast ? '0' : '4'} ${!isLast ? 'mb-1' : ''}`}>
                    <div>
                      <p className="text-xs text-slate-700 font-bold">{style.label}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider capitalize">{act.attendance_method}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-800 font-bold" style={{ color: style.color }}>{act.time}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Help tip ────────────────────────────────────────────────────────── */}
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="text-center text-slate-300 text-[11px] flex items-center justify-center gap-1.5 pb-2"
      >
        <FaHandPaper className="w-3 h-3" />
        Ensure you are within the designated area for{' '}
        <span className="font-black uppercase text-slate-400">{activeTab}</span> validation
      </motion.p>

      <SwipeConfirmationModal
        isOpen={swipeModalOpen}
        onClose={() => setSwipeModal(false)}
        onConfirm={handleConfirm}
        actionType={pendingAction}
        isLoading={!!loadingAction}
      />

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default PunchAttendance;