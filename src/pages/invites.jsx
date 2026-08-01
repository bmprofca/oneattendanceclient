import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaClock, FaExclamationCircle, FaSpinner, FaEye,
  FaCheckCircle, FaTimesCircle, FaEnvelope, FaPhone, FaCalendarAlt,
  FaSearch, FaTimes, FaBuilding, FaCheck, FaBan, FaUser, FaMapMarkerAlt,
  FaBriefcase, FaUserTag, FaShieldAlt, FaChevronDown, FaFingerprint,
  FaUserCheck, FaCog, FaPlus, FaEdit, FaTag
} from "react-icons/fa";
import { toast } from 'react-toastify';
import apiCall, { getMediaUrl } from '../utils/api';
import Skeleton from "../components/SkeletonComponent";
import Pagination, { usePagination } from "../components/PaginationComponent";
import { useAuth } from "../context/AuthContext";
import { ManagementHub, ManagementTable, RefreshButton } from '../components/common';
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import ProfileAvatar from '../components/common/ProfileAvatar';
import SelectField from "../components/SelectField";
import AdvancedDateFilter from '../components/AdvancedDateFilter';
import CurrencyIcon from "../components/common/CurrencyIcon";
import Modal from "../components/Modal";

// ─── Status badge helper ────────────────────────────────────────────────────
const isExpired = (date) => new Date(date) < new Date();

const getStatusBadge = (status, expiresAt) => {
  if (isExpired(expiresAt)) {
    return { icon: FaTimesCircle, text: 'Expired', className: 'bg-red-100 text-red-800 border border-red-200' };
  }
  switch (status?.toLowerCase()) {
    case 'accepted':
      return { icon: FaCheckCircle, text: 'Accepted', className: 'bg-green-100 text-green-800 border border-green-200' };
    case 'pending':
      return { icon: FaClock, text: 'Pending', className: 'bg-yellow-100 text-yellow-800 border border-yellow-200' };
    case 'rejected':
    default:
      return { icon: FaExclamationCircle, text: status || 'Unknown', className: 'bg-gray-100 text-gray-800 border border-gray-200' };
  }
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const formatDateSimple = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
};

const formatDisplay = (str) => {
  if (!str) return 'N/A';
  if (typeof str === 'object' && str !== null) return str.label || 'N/A';
  return String(str).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

const DEFAULT_DURATION = "00:30";

const normalizeDuration = (value, fallback = DEFAULT_DURATION) => {
  if (value === null || typeof value === "undefined" || value === "") return fallback;
  if (typeof value === "number") {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  if (typeof value !== "string") return fallback;
  const [hours = "00", minutes = "00"] = value.split(":");
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const formatDurationDisplay = (value) => {
  const normalized = normalizeDuration(value, null);
  if (!normalized) return "N/A";
  const [hours, minutes] = normalized.split(":").map((p) => Number(p) || 0);
  const total = hours * 60 + minutes;
  if (total === 0) return "0m";
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const normalizeInviteRecord = (invite) => ({
  ...invite,
  break_minutes: normalizeDuration(invite?.break_minutes, DEFAULT_DURATION),
  grace_minutes: normalizeDuration(invite?.grace_minutes, DEFAULT_DURATION),
});

// ─── InfoItem (used inside modals) ──────────────────────────────────────────
const InfoItem = ({ icon, label, value, className = "" }) => (
  <div className={`flex items-start gap-2 rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 px-3 py-2 ${className}`}>
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80 border border-gray-200">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 leading-none mb-1">{label}</div>
      <div className="text-sm font-medium text-gray-800 leading-snug break-words">{value}</div>
    </div>
  </div>
);

const StatusBadge = ({ status, expiresAt }) => {
  const badge = getStatusBadge(status, expiresAt);
  const Icon = badge.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.className}`}>
      <Icon size={10} /> {badge.text}
    </span>
  );
};

// ─── Invite Card (card view) ────────────────────────────────────────────────
const InviteCard = ({ invite, index, onView, onAccept, onReject }) => {
  const isPending = invite.status?.toLowerCase() === 'pending' && !isExpired(invite.expires_at);

  const companyLogo = invite.company?.logo_url ? (
    <img
      src={getMediaUrl(invite.company.logo_url)}
      alt="logo"
      className="w-10 h-10 rounded-xl object-cover border border-purple-200 bg-white shrink-0"
      onError={(e) => { e.target.style.display = 'none'; }}
    />
  ) : (
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0">
      <FaBuilding size={16} />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white rounded-xl shadow-md border border-gray-100 p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
      onClick={() => onView(invite)}
    >
      <div className="flex items-start gap-4">
        {companyLogo}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-lg text-gray-800 truncate">{invite.company?.name || 'Unknown Company'}</h3>
            <StatusBadge status={invite.status} expiresAt={invite.expires_at} />
          </div>
          <p className="text-xs text-gray-500 mt-1">{formatDisplay(invite.designation)}</p>
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-1">
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">{formatDisplay(invite.employment_type)}</span>
              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full">{formatDisplay(invite.salary_type)}</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 pt-1 text-xs text-gray-500">
              <div className="flex items-center gap-1.5"><FaClock className="text-indigo-400" /><span>Shift: {invite.shift_start || "N/A"} - {invite.shift_end || "N/A"}</span></div>
              <div className="flex items-center gap-1.5"><FaClock className="text-amber-400" /><span>Break: {formatDurationDisplay(invite.break_minutes)}</span></div>
              <div className="flex items-center gap-1.5"><FaClock className="text-rose-400" /><span>Grace: {formatDurationDisplay(invite.grace_minutes)}</span></div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500 flex items-center gap-1"><FaUser size={10} />{invite.invited_by?.name || 'N/A'}</span>
              <span className="text-xs text-gray-500 flex items-center gap-1"><FaClock size={10} />{formatDateSimple(invite.expires_at)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => onView(invite)} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all hover:scale-110"><FaEye size={16} /></button>
        {isPending && (
          <>
            <button onClick={() => onAccept(invite)} className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all hover:scale-110"><FaCheck size={16} /></button>
            <button onClick={() => onReject(invite)} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all hover:scale-110"><FaBan size={16} /></button>
          </>
        )}
      </div>
    </motion.div>
  );
};

// ─── View Modal (detailed info) ─────────────────────────────────────────────
const ViewModal = ({ invite, onClose, onAccept, onReject }) => {
  const [showSalaryDetails, setShowSalaryDetails] = useState(false);
  const [showAttendanceDetails, setShowAttendanceDetails] = useState(false);
  const [showShiftSchedule, setShowShiftSchedule] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showSalaryComponents, setShowSalaryComponents] = useState(false);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Invitation Details"
      subtitle="Review the invitation sent to you"
      icon={<FaEye className="h-6 w-6" />}
      size="4xl"
      footer={
        <>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">
            Close
          </button>
          {invite.status?.toLowerCase() === 'pending' && !isExpired(invite.expires_at) && (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onReject(invite)}
                className="px-5 py-2.5 rounded-xl border border-red-200 bg-white text-sm font-semibold text-red-600 hover:bg-red-50 transition-all"
              >
                Reject
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onAccept(invite)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-200 transition"
              >
                <FaCheckCircle className="h-4 w-4" /> Accept Invite
              </motion.button>
            </>
          )}
        </>
      }
    >
      {invite && (
        <div className="space-y-4">
          {/* Profile Section */}
          <div className="flex flex-col sm:flex-row items-start gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {invite.company?.logo_url ? (
                <img
                  src={getMediaUrl(invite.company.logo_url)}
                  alt="Company Logo"
                  className="w-14 h-14 rounded-xl object-cover border border-purple-200 shadow-md bg-white shrink-0"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0">
                  <FaBuilding size={20} />
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-gray-800">{invite.company?.name || 'Company Name'}</h3>
                <p className="text-gray-600 flex items-center gap-2 mt-1">
                  <FaMapMarkerAlt className="text-purple-500" size={14} />
                  {[invite.company?.city, invite.company?.state, invite.company?.country, invite.company?.postal_code].filter(Boolean).join(', ') || 'Location not provided'}
                </p>
              </div>
            </div>
          </div>

          {/* Invited By */}
          {invite.invited_by && (
            <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
              <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
                <FaUser className="text-purple-500" /> Invited By
              </h4>
              <div className="flex items-center gap-3">
                <ProfileAvatar
                  record={invite.invited_by}
                  name={invite.invited_by.name}
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold overflow-hidden"
                >
                  {invite.invited_by.name?.charAt(0)?.toUpperCase() || 'U'}
                </ProfileAvatar>
                <div>
                  <p className="font-semibold text-gray-800">{invite.invited_by.name}</p>
                  <p className="text-sm text-gray-600 flex items-center gap-1"><FaEnvelope size={12} /> {invite.invited_by.email}</p>
                  {invite.invited_by.phone && (
                    <p className="text-sm text-gray-600 flex items-center gap-1 mt-1"><FaPhone size={12} /> {invite.invited_by.phone}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Overview */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2 mb-3">
              <FaBriefcase className="text-blue-500" /> Overview
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <InfoItem icon={<FaBriefcase className="text-blue-500" />} label="Designation" value={formatDisplay(invite.designation)} />
              <InfoItem icon={<FaUserTag className="text-purple-500" />} label="Employment Type" value={formatDisplay(invite.employment_type)} />
              <InfoItem icon={<CurrencyIcon className="text-emerald-500" size={12} />} label="Salary Type" value={formatDisplay(invite.salary_type)} />
              <InfoItem icon={<FaCalendarAlt className="text-rose-500" />} label="Sent Date" value={formatDate(invite.created_at)} />
              <InfoItem icon={<FaClock className="text-yellow-500" />} label="Expires At" value={formatDate(invite.expires_at)} />
              <InfoItem
                icon={<FaTag className="text-orange-500" />}
                label="Status"
                value={<StatusBadge status={invite.status} expiresAt={invite.expires_at} />}
              />
            </div>
          </div>

          {/* Salary Details */}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 overflow-hidden shadow-sm">
            <button onClick={() => setShowSalaryDetails(!showSalaryDetails)} className="w-full flex items-center justify-between p-4 hover:bg-emerald-50/50 transition-colors">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <CurrencyIcon className="text-emerald-500" size={12} /> Salary Details
              </h4>
              <motion.div animate={{ rotate: showSalaryDetails ? 180 : 0 }}>
                <FaChevronDown className="w-3 h-3 text-slate-400" />
              </motion.div>
            </button>
            <AnimatePresence>
              {showSalaryDetails && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-white border-t border-emerald-50">
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <InfoItem icon={<CurrencyIcon className="text-emerald-500" size={12} />} label="Base Amount" value={invite.base_amount != null ? `${parseFloat(invite.base_amount).toLocaleString()}` : "N/A"} />
                      <InfoItem icon={<FaCalendarAlt className="text-cyan-500" />} label="Effective From" value={formatDateSimple(invite.effective_from)} />
                      <InfoItem icon={<FaCalendarAlt className="text-cyan-500" />} label="Effective To" value={formatDateSimple(invite.effective_to)} />
                      <InfoItem icon={<FaCalendarAlt className="text-teal-500" />} label="Joining Date" value={formatDateSimple(invite.joining_date)} />
                    </div>
                    {invite.salary_components?.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <button
                          onClick={() => setShowSalaryComponents(!showSalaryComponents)}
                          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          Salary Components ({invite.salary_components.length})
                          <FaChevronDown className={`w-3 h-3 transition-transform ${showSalaryComponents ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {showSalaryComponents && (
                            <motion.div
                              initial={{ height: 0, opacity: 0, marginTop: 0 }}
                              animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                              exit={{ height: 0, opacity: 0, marginTop: 0 }}
                              className="overflow-hidden grid gap-2 sm:grid-cols-2 mt-2"
                            >
                              {invite.salary_components.map((component, idx) => (
                                <div key={component.id ?? idx} className="rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-sm">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-[11px] font-bold text-slate-700">{component.component_name || `Component ${component.component_id}`}</p>
                                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{component.component_code || "N/A"}</p>
                                    </div>
                                    <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[10px] font-bold uppercase text-slate-600 ring-1 ring-slate-200">{component.calc_type || "N/A"}</span>
                                  </div>
                                  <p className="mt-2 text-sm font-bold text-emerald-700">
                                    {component.calc_type === "percentage" ? `${component.calc_value}%` : component.calc_value != null ? parseFloat(component.calc_value).toLocaleString() : "N/A"}
                                  </p>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Attendance */}
          <div className="rounded-xl border border-purple-100 bg-purple-50/30 overflow-hidden shadow-sm">
            <button onClick={() => setShowAttendanceDetails(!showAttendanceDetails)} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <FaFingerprint className="text-purple-500" /> Attendance
              </h4>
              <motion.div animate={{ rotate: showAttendanceDetails ? 180 : 0 }}>
                <FaChevronDown className="w-3 h-3 text-slate-400" />
              </motion.div>
            </button>
            <AnimatePresence>
              {showAttendanceDetails && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-white border-t border-purple-50">
                  <div className="p-4 space-y-3">
                    <div className="flex flex-wrap gap-4">
                      <InfoItem icon={<FaCheckCircle className="text-emerald-500" />} label="Auto Approve" value={invite.auto_approve ? 'Yes' : 'No'} />
                      <InfoItem icon={<FaTag className="text-indigo-500" />} label="Overtime" value={invite.enable_overtime ? 'Yes' : 'No'} />
                      <InfoItem icon={<FaTag className="text-rose-500" />} label="Deduction" value={invite.enable_deduction ? 'Yes' : 'No'} />
                    </div>
                    {invite.attendance_methods?.length > 0 && (
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Methods</label>
                        <div className="flex flex-wrap gap-2">
                          {invite.attendance_methods.map((method, idx) => (
                            <span key={`att-${idx}`} className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-700 text-[11px] font-semibold rounded-full border border-slate-100 shadow-sm capitalize">
                              <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                              {typeof method === 'string' ? method : method?.method || method?.label || 'N/A'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Shift & Schedule */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 overflow-hidden shadow-sm">
            <button onClick={() => setShowShiftSchedule(!showShiftSchedule)} className="w-full flex items-center justify-between p-4 hover:bg-indigo-50/50 transition-colors">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <FaClock className="text-indigo-500" /> Shift & Schedule
              </h4>
              <motion.div animate={{ rotate: showShiftSchedule ? 180 : 0 }}>
                <FaChevronDown className="w-3 h-3 text-slate-400" />
              </motion.div>
            </button>
            <AnimatePresence>
              {showShiftSchedule && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-white border-t border-indigo-50">
                  <div className="p-4 space-y-3">
                    <div className="flex flex-wrap gap-3">
                      <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-[9px] text-slate-400 font-bold uppercase">Shift</span>
                        <span className="text-xs font-bold text-slate-700 block">{invite.shift_start || 'N/A'} - {invite.shift_end || 'N/A'}</span>
                      </div>
                      <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-[9px] text-slate-400 font-bold uppercase">Break</span>
                        <span className="text-xs font-bold text-slate-700 block">{formatDurationDisplay(invite.break_minutes)}</span>
                      </div>
                      <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-[9px] text-slate-400 font-bold uppercase">Grace</span>
                        <span className="text-xs font-bold text-slate-700 block">{formatDurationDisplay(invite.grace_minutes)}</span>
                      </div>
                    </div>
                    {invite.weekends?.length > 0 && (
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Weekends</label>
                        <div className="flex flex-wrap gap-2">
                          {invite.weekends.map((weekend, idx) => (
                            <div key={`weekend-${idx}`} className="text-center px-3 py-2 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-slate-100 shadow-sm min-w-[120px]">
                              <span className="text-sm text-slate-700 capitalize">{weekend}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Permissions */}
          {invite.permissions?.length > 0 && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/30 overflow-hidden shadow-sm">
              <button onClick={() => setShowPermissions(!showPermissions)} className="w-full flex items-center justify-between p-4 hover:bg-blue-50/50 transition-colors">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                  <FaShieldAlt className="text-blue-500" /> Permissions
                </h4>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-700 font-bold">{invite.permissions.length}</span>
                  <motion.div animate={{ rotate: showPermissions ? 180 : 0 }}>
                    <FaChevronDown className="w-3 h-3 text-slate-400" />
                  </motion.div>
                </div>
              </button>
              <AnimatePresence>
                {showPermissions && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-white border-t border-blue-50">
                    <div className="p-3 flex flex-wrap gap-2">
                      {invite.permissions.map((perm, idx) => (
                        <span key={perm.id || `perm-${idx}`} className="px-3 py-1.5 bg-slate-50 text-slate-600 text-[11px] font-semibold rounded-lg border border-slate-100 shadow-sm">{perm.name}</span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

// ─── Accept / Reject Confirmation Modals ────────────────────────────────────
const AcceptModal = ({ invite, onClose, onConfirm, processingId }) => (
  <Modal
    isOpen={true}
    onClose={onClose}
    title="Accept Invitation"
    subtitle="Join this company's organisation"
    icon={<FaCheckCircle className="h-6 w-6 text-green-500" />}
    size="md"
    footer={
      <>
        <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">Cancel</button>
        <button
          onClick={() => onConfirm(invite.token || invite.invite_token)}
          disabled={processingId === (invite.token || invite.invite_token)}
          className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-100 hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {processingId === (invite.token || invite.invite_token) && <FaSpinner className="animate-spin" />}
          Accept Invitation
        </button>
      </>
    }
  >
    <div className="text-center py-4">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <FaCheckCircle className="text-4xl text-green-600" />
      </motion.div>
      <p className="text-xl font-semibold text-gray-700 mb-2">Accept Invitation?</p>
      <p className="text-gray-500">
        You are about to accept the invitation from <span className="font-semibold text-green-600">{invite.company?.name}</span>. This will add you to their organization.
      </p>
    </div>
  </Modal>
);

const RejectModal = ({ invite, onClose, onConfirm, processingId }) => (
  <Modal
    isOpen={true}
    onClose={onClose}
    title="Reject Invitation"
    subtitle="Decline this invitation"
    icon={<FaBan className="h-6 w-6 text-red-500" />}
    size="md"
    footer={
      <>
        <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">Cancel</button>
        <button
          onClick={() => onConfirm(invite.token || invite.invite_token)}
          disabled={processingId === (invite.token || invite.invite_token)}
          className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-100 hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {processingId === (invite.token || invite.invite_token) && <FaSpinner className="animate-spin" />}
          Reject Invitation
        </button>
      </>
    }
  >
    <div className="text-center py-4">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 bg-gradient-to-br from-red-100 to-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <FaBan className="text-4xl text-red-600" />
      </motion.div>
      <p className="text-xl font-semibold text-gray-700 mb-2">Reject Invitation?</p>
      <p className="text-gray-500">
        Are you sure you want to reject the invitation from <span className="font-semibold text-red-600">{invite.company?.name}</span>? This action cannot be undone.
      </p>
    </div>
  </Modal>
);

// ─── Main Component ─────────────────────────────────────────────────────────
export default function MyInvites() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [selectedInvite, setSelectedInvite] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [dateFilter, setDateFilter] = useState(null);
  const [viewMode, setViewMode] = useState("table");
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const fetchInProgress = useRef(false);
  const initialFetchDone = useRef(false);

  const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 10);
  const { refreshUser } = useAuth();

  const MODAL_TYPES = {
    VIEW: 'VIEW',
    ACCEPT: 'ACCEPT',
    REJECT: 'REJECT',
  };

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchInvites = useCallback(async (page = pagination.page, resetLoading = true) => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    if (resetLoading) setLoading(true);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });

      // Status – send any value except "all"
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);

      // Date filters – pass everything the AdvancedDateFilter provides
      if (dateFilter) {
        if (dateFilter.from_date) params.append('from_date', dateFilter.from_date);
        if (dateFilter.to_date) params.append('to_date', dateFilter.to_date);
        if (dateFilter.month) params.append('month', dateFilter.month);
        if (dateFilter.year) params.append('year', dateFilter.year);
      }

      const response = await apiCall(`/company/invites/my?${params.toString()}`, 'GET');
      if (!response.ok) throw new Error('Failed to fetch invites');

      const result = await response.json();
      if (result.success) {
        // No client‑side filtering – backend returns exactly what we requested
        const allData = (result.data || []).map(normalizeInviteRecord);
        setInvites(allData);

        const currentPage = Number(result.current_page ?? result.page ?? page);
        const perPage = Number(result.per_page ?? result.limit ?? pagination.limit);
        const total = Number(result.total ?? result.meta?.total ?? 0);
        const totalPages = Number(
          result.last_page ?? result.total_pages ?? result.meta?.total_pages ?? Math.max(1, Math.ceil(total / perPage))
        );

        updatePagination({
          page: currentPage,
          limit: perPage,
          total,
          total_pages: totalPages,
          is_last_page: result.is_last_page ?? result.meta?.is_last_page ?? (currentPage >= totalPages),
        });
        setError(null);
      } else {
        throw new Error(result.message || 'Failed to fetch invites');
      }
    } catch (err) {
      setError(err.message);
      toast.error(err.message || "Failed to load invitations.");
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
      fetchInProgress.current = false;
    }
  }, [pagination.limit, statusFilter, debouncedSearchTerm, dateFilter, updatePagination]);

  // Initial fetch
  useEffect(() => {
    if (!initialFetchDone.current) {
      fetchInvites(1, true);
      initialFetchDone.current = true;
    }
  }, [fetchInvites]);

  // Page / filter changes
  useEffect(() => {
    if (!isInitialLoad && !fetchInProgress.current && initialFetchDone.current) {
      fetchInvites(pagination.page, true);
    }
  }, [pagination.page, pagination.limit, debouncedSearchTerm, statusFilter, dateFilter]); // eslint-disable-line

  // Reset to page 1 when filters change
  useEffect(() => {
    if (!isInitialLoad) {
      if (pagination.page !== 1) goToPage(1);
      else fetchInvites(1, true);
    }
  }, [debouncedSearchTerm, statusFilter, dateFilter]); // eslint-disable-line

  const handleAcceptInvite = async (inviteToken) => {
    try {
      setProcessingId(inviteToken);
      const response = await apiCall('/company/invites/accept', 'POST', { token: inviteToken });
      if (!response.ok) throw new Error('Failed to accept invite');
      const result = await response.json();
      if (result.success) {
        toast.success("Invitation accepted successfully!");
        setInvites((prev) => prev.map((inv) => inv.invite_token === inviteToken ? { ...inv, status: 'accepted' } : inv));
        await refreshUser();
        closeModal();
        await fetchInvites(pagination.page, false);
      } else {
        throw new Error(result.message || 'Failed to accept invite');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectInvite = async (inviteToken) => {
    try {
      setProcessingId(inviteToken);
      const response = await apiCall('/company/invites/reject', 'PUT', { token: inviteToken });
      if (!response.ok) throw new Error('Failed to reject invite');
      const result = await response.json();
      if (result.success) {
        toast.success("Invitation rejected.");
        closeModal();
        await fetchInvites(pagination.page, false);
      } else {
        throw new Error(result.message || 'Failed to reject invite');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const openModal = (invite, type) => {
    setSelectedInvite(invite);
    setModalType(type);
  };
  const closeModal = () => {
    setSelectedInvite(null);
    setModalType(null);
  };

  const handlePageChange = useCallback((newPage) => {
    if (newPage !== pagination.page) goToPage(newPage);
  }, [pagination.page, goToPage]);

  // ─── Table columns configuration ─────────────────────────────────────────
  const tableColumns = useMemo(() => [
    {
      key: 'company',
      label: 'Company',
      render: (invite) => (
        <div className="flex items-center gap-3">
          {invite.company?.logo_url ? (
            <img
              src={getMediaUrl(invite.company.logo_url)}
              alt="logo"
              className="w-9 h-9 rounded-full object-cover border border-purple-200 bg-white shrink-0"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0">
              <FaBuilding size={14} />
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-800 text-sm">{invite.company?.name || 'N/A'}</p>
            <p className="text-xs text-gray-500">{[invite.company?.city, invite.company?.state].filter(Boolean).join(', ')}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'invited_by',
      label: 'Invited By',
      render: (invite) => (
        <div className="flex items-center gap-2">
          <ProfileAvatar
            record={invite.invited_by}
            name={invite.invited_by?.name}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center overflow-hidden"
          >
            <FaUser className="text-purple-600" size={12} />
          </ProfileAvatar>
          <div>
            <p className="text-sm font-medium text-gray-800">{invite.invited_by?.name}</p>
            <p className="text-xs text-gray-500">{invite.invited_by?.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'designation',
      label: 'Designation',
      render: (invite) => (
        <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-semibold">
          {formatDisplay(invite.designation)}
        </span>
      ),
    },
    {
      key: 'employment',
      label: 'Employment',
      render: (invite) => (
        <div className="flex flex-wrap gap-1">
          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{formatDisplay(invite.employment_type)}</span>
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">{formatDisplay(invite.salary_type)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (invite) => <StatusBadge status={invite.status} expiresAt={invite.expires_at} />,
    },
    {
      key: 'expires_at',
      label: 'Expires',
      render: (invite) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <FaClock className="text-gray-400 text-xs shrink-0" />
          {formatDateSimple(invite.expires_at)}
        </div>
      ),
    },
  ], []);

  if (isInitialLoad && loading) return <Skeleton />;

  return (
    <ManagementHub
      eyebrow={<><FaShieldAlt size={11} /> Invitations</>}
      title="Incoming Invitations"
      description="Review and manage company invitations from a single workspace."
      accent="violet"
      onRefresh={() => fetchInvites(1, true)}
      summary={
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
          Total: <span className="font-semibold text-slate-900">{pagination.total}</span> invitations
        </div>
      }
    >
      <div className="space-y-6 p-2 lg:p-0">
        {/* Filters Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 w-full">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                placeholder="Search by company, designation, or inviter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 outline-none transition-all text-sm min-h-[42px]"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                  <FaTimes size={14} />
                </button>
              )}
            </div>

            {!loading && invites.length > 0 && (
              <p className="text-sm text-gray-500 hidden xl:block">
                <span className="font-semibold text-gray-800">{invites.length}</span> of{' '}
                <span className="font-semibold text-gray-800">{pagination.total}</span> invitations
                {searchTerm && <span className="ml-1 text-violet-600">· "{searchTerm}"</span>}
              </p>
            )}
          </div>

          <div className="flex w-full lg:w-auto items-center justify-between lg:justify-end gap-4">
            <div className="w-full sm:w-auto min-w-[220px]">
              <AdvancedDateFilter
                value={dateFilter}
                onChange={(filter) => setDateFilter(filter)}
                placeholder="Filter by date"
                buttonClassName="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 min-h-[42px] text-gray-700"
              />
            </div>
            <div className="min-w-[180px]">
              <SelectField
                options={[
                  { value: "all", label: "All" },
                  { value: "pending", label: "Pending" },
                  { value: "accepted", label: "Accepted" },
                  { value: "rejected", label: "Rejected" },
                  { value: "expired", label: "Expired" },
                ]}
                value={[
                  { value: "all", label: "All" },
                  { value: "pending", label: "Pending" },
                  { value: "accepted", label: "Accepted" },
                  { value: "rejected", label: "Rejected" },
                  { value: "expired", label: "Expired" },
                ].find((o) => o.value === statusFilter)}
                onChange={(val) => setStatusFilter(val?.value ?? 'pending')}
                className="text-sm font-medium"
              />
            </div>
            <div className="h-8 w-px bg-gray-200 hidden lg:block" />
            <div className="flex w-full lg:w-auto justify-end">
              <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="violet" />
            </div>
          </div>
        </motion.div>

        {/* Loading skeleton */}
        {loading && !invites.length && <Skeleton />}

        {/* Empty state */}
        {!loading && !error && invites.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16 bg-white rounded-xl shadow-xl">
            <FaEnvelope className="text-8xl text-gray-300 mx-auto mb-4" />
            <p className="text-xl text-gray-500">No invitations found</p>
            <p className="text-gray-400 mt-2">
              {searchTerm || statusFilter !== 'pending' ? 'Try adjusting your filters' : "You haven't received any invitations yet"}
            </p>
          </motion.div>
        )}

        {/* Content */}
        {!loading && !error && invites.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl bg-white shadow-xl"
            >
              {/* Table View */}
              {viewMode === 'table' && (
                <ManagementTable
                  rows={invites}
                  columns={tableColumns}
                  rowKey={(row) => row.invite_id}
                  onRowClick={(row) => openModal(row, MODAL_TYPES.VIEW)}
                  getActions={(invite) => [
                    {
                      label: 'View Details',
                      icon: <FaEye size={12} />,
                      onClick: () => openModal(invite, MODAL_TYPES.VIEW),
                      className: 'text-green-600 hover:text-green-700 hover:bg-green-50',
                    },
                    ...(invite.status?.toLowerCase() === 'pending' && !isExpired(invite.expires_at)
                      ? [
                        {
                          label: 'Accept Invite',
                          icon: <FaCheck size={12} />,
                          onClick: () => openModal(invite, MODAL_TYPES.ACCEPT),
                          className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50',
                        },
                        {
                          label: 'Reject Invite',
                          icon: <FaBan size={12} />,
                          onClick: () => openModal(invite, MODAL_TYPES.REJECT),
                          className: 'text-red-600 hover:text-red-700 hover:bg-red-50',
                        },
                      ]
                      : []),
                  ]}
                  accent="violet"
                />
              )}

              {/* Card View */}
              {viewMode === 'card' && (
                <ManagementGrid viewMode={viewMode} className="p-3 sm:p-4">
                  <AnimatePresence>
                    {invites.map((invite, index) => (
                      <InviteCard
                        key={invite.invite_id}
                        invite={invite}
                        index={index}
                        onView={(inv) => openModal(inv, MODAL_TYPES.VIEW)}
                        onAccept={(inv) => openModal(inv, MODAL_TYPES.ACCEPT)}
                        onReject={(inv) => openModal(inv, MODAL_TYPES.REJECT)}
                      />
                    ))}
                  </AnimatePresence>
                </ManagementGrid>
              )}
            </motion.div>

            {/* Pagination */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-6">
              <Pagination
                currentPage={pagination.page}
                totalItems={pagination.total}
                itemsPerPage={pagination.limit}
                onPageChange={handlePageChange}
                showInfo={viewMode !== 'card'}
                onLimitChange={changeLimit}
              />
            </motion.div>
          </>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modalType === MODAL_TYPES.VIEW && selectedInvite && (
          <ViewModal
            invite={selectedInvite}
            onClose={closeModal}
            onAccept={(inv) => openModal(inv, MODAL_TYPES.ACCEPT)}
            onReject={(inv) => openModal(inv, MODAL_TYPES.REJECT)}
          />
        )}
        {modalType === MODAL_TYPES.ACCEPT && selectedInvite && (
          <AcceptModal
            invite={selectedInvite}
            onClose={closeModal}
            onConfirm={handleAcceptInvite}
            processingId={processingId}
          />
        )}
        {modalType === MODAL_TYPES.REJECT && selectedInvite && (
          <RejectModal
            invite={selectedInvite}
            onClose={closeModal}
            onConfirm={handleRejectInvite}
            processingId={processingId}
          />
        )}
      </AnimatePresence>
    </ManagementHub>
  );
}