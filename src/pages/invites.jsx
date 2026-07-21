import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaClock, FaExclamationCircle, FaSpinner, FaEye,
  FaCheckCircle, FaTimesCircle, FaEnvelope, FaPhone, FaCalendarAlt,
  FaSearch, FaBuilding, FaCheck, FaBan, FaUser, FaMapMarkerAlt,
  FaTimes, FaBriefcase, FaUserTag, FaInfoCircle, FaTag,
  FaShieldAlt, FaUserCheck, FaChevronDown,
} from "react-icons/fa";
import { toast } from 'react-toastify';
import apiCall, { getMediaUrl } from '../utils/api';
import Skeleton from "../components/SkeletonComponent";
import Pagination, { usePagination } from "../components/PaginationComponent";
import { useAuth } from "../context/AuthContext";
import ModalScrollLock from "../components/ModalScrollLock";
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import { ManagementHub, ManagementTable, ManagementCard } from '../components/common';
import ProfileAvatar from '../components/common/ProfileAvatar';
import SelectField from "../components/SelectField";
import CurrencyIcon from "../components/common/CurrencyIcon";

// ─── Constants & Helpers ─────────────────────────────────────────────────────

const modalVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", duration: 0.5 } },
  exit: { opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.3 } },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const CONFIRM_MODAL_CLASS =
  'bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col';

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
    case 'cancelled':
      return { icon: FaBan, text: formatDisplay(status), className: 'bg-gray-100 text-gray-800 border border-gray-200' };
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

// ─── Local Sub-components ────────────────────────────────────────────────────

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

// ─── Invite Card (card-view row) ─────────────────────────────────────────────

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
    <ManagementCard
      delay={index * 0.05}
      accent="violet"
      eyebrow={[invite.company?.city, invite.company?.state].filter(Boolean).join(', ') || 'Location N/A'}
      title={invite.company?.name || 'Unknown Company'}
      subtitle={formatDisplay(invite.designation)}
      icon={companyLogo}
      badge={<StatusBadge status={invite.status} expiresAt={invite.expires_at} />}
      onClick={() => onView(invite)}
      hoverable
      actions={[
        {
          label: 'View Details',
          icon: <FaEye size={12} />,
          onClick: () => onView(invite),
          className: 'text-green-600 hover:text-green-700 hover:bg-green-50',
        },
        ...(isPending
          ? [
            {
              label: 'Accept Invite',
              icon: <FaCheck size={12} />,
              onClick: () => onAccept(invite),
              className: 'text-green-600 hover:text-green-700 hover:bg-green-50',
            },
            {
              label: 'Reject Invite',
              icon: <FaBan size={12} />,
              onClick: () => onReject(invite),
              className: 'text-red-600 hover:text-red-700 hover:bg-red-50',
            },
          ]
          : []),
      ]}
      menuId={`invite-card-${invite.invite_id}`}
      footer={
        <div className="flex items-center justify-between w-full text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <FaUser size={10} className="text-purple-400" />
            {invite.invited_by?.name || 'N/A'}
          </span>
          <span className="flex items-center gap-1">
            <FaClock size={10} className="text-yellow-400" />
            Exp: {formatDateSimple(invite.expires_at)}
          </span>
        </div>
      }
    >
      <div className="space-y-2 mt-1">
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
            {formatDisplay(invite.employment_type)}
          </span>
          <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
            {formatDisplay(invite.salary_type)}
          </span>
        </div>
        <p className="text-xs text-gray-500 flex items-center gap-1.5">
          <FaEnvelope size={10} className="text-gray-400 shrink-0" />
          <span className="truncate">{invite.invited_by?.email || 'N/A'}</span>
        </p>
      </div>
    </ManagementCard>
  );
};

// ─── Modals ───────────────────────────────────────────────────────────────────

const ViewModal = ({ invite, onClose, onAccept, onReject }) => {
  const [showPermissions, setShowPermissions] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [showWeekends, setShowWeekends] = useState(false);

  return (
    <motion.div
      variants={backdropVariants} initial="hidden" animate="visible" exit="exit"
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <ModalScrollLock />
      <motion.div
        variants={modalVariants} initial="hidden" animate="visible" exit="exit"
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden m-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex justify-between items-center p-5 border-b bg-white rounded-t-xl">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
            <FaEye className="text-indigo-500" /> Invitation Details
          </h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-all shadow-sm hover:shadow-md bg-white/50 border border-slate-100">
            <FaTimes size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {/* Company header */}
          <div className="flex items-center gap-4 pb-4 border-b">
            {invite.company?.logo_url ? (
              <img
                src={getMediaUrl(invite.company.logo_url)}
                alt="Company Logo"
                className="w-14 h-14 rounded-xl object-cover border border-purple-200 shadow-md bg-white shrink-0"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-3 rounded-xl flex items-center justify-center w-14 h-14 shrink-0">
                <FaBuilding className="text-white text-3xl" />
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold text-gray-800">{invite.company?.name || 'Company Name'}</h3>
              <p className="text-gray-600 flex items-center gap-2 mt-1">
                <FaMapMarkerAlt className="text-purple-500" size={14} />
                {[invite.company?.city, invite.company?.state, invite.company?.country].filter(Boolean).join(', ') || 'Location not provided'}
              </p>
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

          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
            <InfoItem icon={<FaBriefcase className="text-blue-500" />} label="Designation" value={formatDisplay(invite.designation)} />
            <InfoItem icon={<FaUserTag className="text-purple-500" />} label="Employment Type" value={formatDisplay(invite.employment_type)} />
            <InfoItem icon={<CurrencyIcon className="text-emerald-500" size={12} />} label="Salary Type" value={formatDisplay(invite.salary_type)} />
            <InfoItem
              icon={<FaClock className="text-orange-500" />}
              label="Schedule"
              value={
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                    {`${invite.shift_start || "N/A"} - ${invite.shift_end || "N/A"}`}
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    Break {formatDurationDisplay(invite.break_minutes)}
                  </span>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                    Grace {formatDurationDisplay(invite.grace_minutes)}
                  </span>
                </div>
              }
            />
            <InfoItem
              icon={<FaTag className="text-orange-500" />}
              label="Status"
              value={<StatusBadge status={invite.status} expiresAt={invite.expires_at} />}
            />
            <InfoItem icon={<FaCalendarAlt className="text-rose-500" />} label="Sent Date" value={formatDate(invite.created_at)} />
            <InfoItem icon={<FaClock className="text-yellow-500" />} label="Expires At" value={formatDate(invite.expires_at)} />
          </div>

          {/* Collapsible: Weekends */}
          {invite.weekends?.length > 0 && (
            <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => setShowWeekends(!showWeekends)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                type="button"
              >
                <div className="flex items-center gap-2">
                  <FaCalendarAlt className="text-indigo-500" />
                  <span className="text-sm font-semibold text-gray-700">Weekends</span>
                  <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700 font-medium">{invite.weekends.length}</span>
                </div>
                <motion.div animate={{ rotate: showWeekends ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <FaChevronDown className="w-4 h-4 text-gray-400" />
                </motion.div>
              </button>
              <AnimatePresence>
                {showWeekends && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="p-3 bg-white grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto">
                      {/* ✅ FIX: weekends is array of strings, not objects */}
                      {invite.weekends.map((weekend, idx) => (
                        <motion.div
                          key={`${weekend}-${idx}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          className="flex items-center justify-between p-2.5 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100"
                        >
                          <span className="text-sm font-medium text-gray-700 capitalize">{weekend}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Collapsible: Permissions */}
          {invite.permissions?.length > 0 && (
            <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <button onClick={() => setShowPermissions(!showPermissions)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors" type="button">
                <div className="flex items-center gap-2">
                  <FaShieldAlt className="text-blue-500" />
                  <span className="text-sm font-semibold text-gray-700">Permissions</span>
                  <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-medium">{invite.permissions.length}</span>
                </div>
                <motion.div animate={{ rotate: showPermissions ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <FaChevronDown className="w-4 h-4 text-gray-400" />
                </motion.div>
              </button>
              <AnimatePresence>
                {showPermissions && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="p-3 bg-white grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto">
                      {invite.permissions.map((perm, idx) => (
                        <motion.div key={`perm-${perm.id}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}
                          className="flex items-center p-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                          <span className="text-sm font-medium text-gray-700">{perm.name}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Collapsible: Attendance Methods */}
          {invite.attendance_methods?.length > 0 && (
            <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <button onClick={() => setShowAttendance(!showAttendance)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors" type="button">
                <div className="flex items-center gap-2">
                  <FaUserCheck className="text-purple-500" />
                  <span className="text-sm font-semibold text-gray-700">Attendance Methods</span>
                  <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 font-medium">{invite.attendance_methods.length}</span>
                </div>
                <motion.div animate={{ rotate: showAttendance ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <FaChevronDown className="w-4 h-4 text-gray-400" />
                </motion.div>
              </button>
              <AnimatePresence>
                {showAttendance && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="p-3 bg-white flex flex-wrap gap-2">
                      {/* ✅ FIX: attendance_methods is array of strings, not objects */}
                      {invite.attendance_methods.map((method, idx) => (
                        <motion.div
                          key={`method-${idx}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-full border border-purple-100"
                        >
                          <span className="text-sm font-medium text-gray-700 capitalize">{method}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">
            Close
          </button>
          {invite.status?.toLowerCase() === 'pending' && !isExpired(invite.expires_at) && (
            <>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => onReject(invite)}
                className="px-5 py-2.5 rounded-xl border border-red-200 bg-white text-sm font-semibold text-red-600 hover:bg-red-50 transition-all">
                Reject
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => onAccept(invite)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-200 transition">
                <FaCheckCircle className="h-4 w-4" /> Accept Invite
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const AcceptModal = ({ invite, onClose, onConfirm, processingId }) => (
  <motion.div variants={backdropVariants} initial="hidden" animate="visible" exit="exit"
    className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    onClick={onClose}>
    <ModalScrollLock />
    <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit"
      className={CONFIRM_MODAL_CLASS} onClick={(e) => e.stopPropagation()}>
      <div className="shrink-0 flex justify-between items-center p-5 border-b bg-white rounded-t-xl">
        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><FaCheckCircle className="text-green-500" /> Accept Invitation</h2>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50 transition-all border border-slate-100"><FaTimes size={18} /></button>
      </div>
      <div className="flex flex-1 flex-col justify-center p-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.5 }}
          className="w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FaCheckCircle className="text-4xl text-green-600" />
        </motion.div>
        <p className="text-xl text-gray-700 mb-2 font-semibold">Accept Invitation?</p>
        <p className="text-gray-500 mb-6">
          You are about to accept the invitation from <span className="font-semibold text-green-600">{invite.company?.name}</span>. This will add you to their organization.
        </p>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 shrink-0">
        <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">Cancel</button>
        <button onClick={() => onConfirm(invite.invite_token)} disabled={processingId === invite.invite_token}
          className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-100 hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-2">
          {processingId === invite.invite_token && <FaSpinner className="animate-spin" />} Accept Invitation
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const RejectModal = ({ invite, onClose, onConfirm, processingId }) => (
  <motion.div variants={backdropVariants} initial="hidden" animate="visible" exit="exit"
    className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    onClick={onClose}>
    <ModalScrollLock />
    <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit"
      className={CONFIRM_MODAL_CLASS} onClick={(e) => e.stopPropagation()}>
      <div className="shrink-0 flex justify-between items-center p-5 border-b bg-white rounded-t-xl">
        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><FaBan className="text-red-500" /> Reject Invitation</h2>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50 transition-all border border-slate-100"><FaTimes size={18} /></button>
      </div>
      <div className="flex flex-1 flex-col justify-center p-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.5 }}
          className="w-24 h-24 bg-gradient-to-br from-red-100 to-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FaBan className="text-4xl text-red-600" />
        </motion.div>
        <p className="text-xl text-gray-700 mb-2 font-semibold">Reject Invitation?</p>
        <p className="text-gray-500 mb-6">
          Are you sure you want to reject the invitation from <span className="font-semibold text-red-600">{invite.company?.name}</span>? This action cannot be undone.
        </p>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 shrink-0">
        <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">Cancel</button>
        <button onClick={() => onConfirm(invite.invite_token)} disabled={processingId === invite.invite_token}
          className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-100 hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-2">
          {processingId === invite.invite_token && <FaSpinner className="animate-spin" />} Reject Invitation
        </button>
      </div>
    </motion.div>
  </motion.div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MyInvites() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [selectedInvite, setSelectedInvite] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [viewMode, setViewMode] = useState("table");

  const fetchInProgress = useRef(false);
  const initialFetchDone = useRef(false);

  const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 10);
  const { refreshUser } = useAuth();

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
      const params = new URLSearchParams({ page: page.toString(), limit: pagination.limit.toString() });
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);

      const response = await apiCall(`/company/invites/my?${params.toString()}`, 'GET');
      if (!response.ok) throw new Error('Failed to fetch invites');

      const result = await response.json();
      if (result.success) {
        setInvites((result.data || []).map(normalizeInviteRecord));
        const currentPage = Number(result.current_page ?? result.page ?? page);
        const perPage = Number(result.per_page ?? result.limit ?? pagination.limit);
        const total = Number(result.total ?? result.meta?.total ?? 0);
        const totalPages = Number(
          result.last_page ?? result.total_pages ?? result.meta?.total_pages ?? Math.max(1, Math.ceil(total / perPage))
        );
        updatePagination({
          page: currentPage, limit: perPage, total, total_pages: totalPages,
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
  }, [pagination.limit, statusFilter, debouncedSearchTerm, updatePagination]);

  // Initial load
  useEffect(() => {
    if (!initialFetchDone.current) {
      fetchInvites(1, true);
      initialFetchDone.current = true;
    }
  }, [fetchInvites]);

  // Page change
  useEffect(() => {
    if (!isInitialLoad && !fetchInProgress.current && initialFetchDone.current) {
      fetchInvites(pagination.page, true);
    }
  }, [pagination.page, pagination.limit, debouncedSearchTerm, statusFilter]); // eslint-disable-line

  // Filter reset
  useEffect(() => {
    if (!isInitialLoad) {
      if (pagination.page !== 1) goToPage(1);
      else fetchInvites(1, true);
    }
  }, [debouncedSearchTerm, statusFilter]); // eslint-disable-line

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

  const openModal = (invite, type) => { setSelectedInvite(invite); setModalType(type); };
  const closeModal = () => { setSelectedInvite(null); setModalType(null); };

  const handlePageChange = useCallback((newPage) => {
    if (newPage !== pagination.page) goToPage(newPage);
  }, [pagination.page, goToPage]);

  // ─── Table columns config ─────────────────────────────────────────────────

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
            <div className="min-w-[180px]">
              <SelectField
                options={[
                  { value: "all", label: "All Statuses" },
                  { value: "pending", label: "Pending" },
                  { value: "accepted", label: "Accepted" },
                  { value: "rejected", label: "Rejected" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
                value={[
                  { value: "all", label: "All Statuses" },
                  { value: "pending", label: "Pending" },
                  { value: "accepted", label: "Accepted" },
                  { value: "rejected", label: "Rejected" },
                  { value: "cancelled", label: "Cancelled" },
                ].find((o) => o.value === statusFilter)}
                onChange={(val) => setStatusFilter(val?.value ?? 'all')}
                className="text-sm font-medium"
              />
            </div>

            <div className="h-8 w-px bg-gray-200 hidden lg:block" />

            <div className="flex w-full lg:w-auto justify-end">
              <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="violet" />
            </div>
          </div>
        </motion.div>

        {/* Loading */}
        {loading && !invites.length && <Skeleton />}

        {/* Empty state */}
        {!loading && !error && invites.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16 bg-white rounded-xl shadow-xl">
            <FaEnvelope className="text-8xl text-gray-300 mx-auto mb-4" />
            <p className="text-xl text-gray-500">No invitations found</p>
            <p className="text-gray-400 mt-2">{searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : "You haven't received any invitations yet"}</p>
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
                  onRowClick={(row) => openModal(row, 'view')}
                  getActions={(invite) => [
                    {
                      label: 'View Details',
                      icon: <FaEye size={12} />,
                      onClick: () => openModal(invite, 'view'),
                      className: 'text-green-600 hover:text-green-700 hover:bg-green-50',
                    },
                    ...(invite.status?.toLowerCase() === 'pending' && !isExpired(invite.expires_at)
                      ? [
                        {
                          label: 'Accept Invite',
                          icon: <FaCheck size={12} />,
                          onClick: () => openModal(invite, 'accept'),
                          className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50',
                        },
                        {
                          label: 'Reject Invite',
                          icon: <FaBan size={12} />,
                          onClick: () => openModal(invite, 'reject'),
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
                        onView={(inv) => openModal(inv, 'view')}
                        onAccept={(inv) => openModal(inv, 'accept')}
                        onReject={(inv) => openModal(inv, 'reject')}
                      />
                    ))}
                  </AnimatePresence>
                </ManagementGrid>
              )}
            </motion.div>

            {/* Pagination */}
            {(invites.length > 0 || pagination.total > 0) && (
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
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modalType === 'view' && selectedInvite && (
          <ViewModal
            invite={selectedInvite}
            onClose={closeModal}
            onAccept={(inv) => openModal(inv, 'accept')}
            onReject={(inv) => openModal(inv, 'reject')}
          />
        )}
        {modalType === 'accept' && selectedInvite && (
          <AcceptModal
            invite={selectedInvite}
            onClose={closeModal}
            onConfirm={handleAcceptInvite}
            processingId={processingId}
          />
        )}
        {modalType === 'reject' && selectedInvite && (
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