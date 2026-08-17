import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  FaCalendarAlt,
  FaEdit,
  FaEye,
  FaPaperclip,
  FaPlus,
  FaSearch,
  FaSpinner,
  FaTimes,
  FaTrash,
  FaCalendarCheck,
  FaInfoCircle,
  FaUpload,
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import apiCall, { uploadFile } from '../utils/api';
import ModalScrollLock from '../components/ModalScrollLock';
import Pagination, { usePagination } from '../components/PaginationComponent';
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import ActionMenu from '../components/ActionMenu';
import { DateRangePickerField } from '../components/DatePicker';
import { ManagementHub, ManagementTable } from '../components/common';
import Modal from '../components/Modal';
import SelectField from '../components/SelectField';
import { useAuth } from '../context/AuthContext';
import AdvancedDateFilter from '../components/AdvancedDateFilter';

/* ──────────────────────────────── Helpers ──────────────────────────────── */
const getCompanyId = () => {
  try {
    return JSON.parse(localStorage.getItem('company'))?.id ?? null;
  } catch {
    return null;
  }
};

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : 'N/A');
const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : 'N/A');
const formatDays = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
};

const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ALLOWED_ATTACHMENT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

const getFileExtension = (fileName = '') => {
  const normalizedName = String(fileName).toLowerCase();
  const lastDotIndex = normalizedName.lastIndexOf('.');
  return lastDotIndex >= 0 ? normalizedName.slice(lastDotIndex) : '';
};

const isAllowedAttachment = (file) => {
  const fileType = String(file?.type || '').toLowerCase();
  const fileExtension = getFileExtension(file?.name);
  return ALLOWED_ATTACHMENT_TYPES.includes(fileType) || ALLOWED_ATTACHMENT_EXTENSIONS.includes(fileExtension);
};

const isImageAttachment = (file) => {
  if (!file) return false;
  const url = typeof file === 'string' ? file : (file.url || file.file_url || '');
  const name = file.name || file.original_name || (url ? url.split('/').pop() : '');
  const fileType = String(file.type || file.file_type || '').toLowerCase();
  const fileExtension = getFileExtension(name);
  return (
    fileType.startsWith('image/') ||
    ['.jpg', '.jpeg', '.png', '.webp'].includes(fileExtension) ||
    (url && /\.(jpg|jpeg|png|webp|gif)$/i.test(url))
  );
};

const request = async (endpoint, method = 'GET', body = null) => {
  const response = await apiCall(endpoint, method, body, getCompanyId());
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || 'Request failed');
  return result;
};

const formatLeaveTypeName = (key) => {
  const nameMap = {
    sick_leave: 'Sick Leave',
    casual_leave: 'Casual Leave',
    annual_leave: 'Annual Leave',
    maternity_leave: 'Maternity Leave',
    work_from_home: 'Work From Home',
    compensatory_off: 'Compensatory Off',
  };
  return nameMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const toNumber = (value) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};

const getRequestedDays = (startDate, endDate, isHalfDay) => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dayCount = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
  if (isHalfDay && start.toDateString() === end.toDateString()) return 0.5;
  return dayCount;
};

/* ─────────────────────────── Subcomponents ─────────────────────────── */
const StatusBadge = ({ status }) => {
  const styles = {
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-gray-100 text-gray-700',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] || styles.pending
        }`}
    >
      {status || 'pending'}
    </span>
  );
};

const LeaveTypeBadge = ({ name, isPaid }) => (
  <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700">
    {name} {!isPaid && '(Unpaid)'}
  </span>
);

/* ──────────────────────── Leave Balance Card ──────────────────────── */
const LeaveBalanceCard = ({ item }) => {
  const isAllocated = Boolean(item.allocated && item.balance);
  const total = isAllocated ? Number(item.balance.total_allocated || 0) : 0;
  const used = isAllocated ? Number(item.balance.used || 0) : 0;
  const remaining = isAllocated ? Number(item.balance.remaining || 0) : 0;

  const percentage = total > 0 ? (used / total) * 100 : 0;
  const usedPct = Math.min(100, Math.round(percentage));
  const displayName = item.name || formatLeaveTypeName(item.code || '');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className={`rounded-2xl p-4 shadow-md border transition-all space-y-3 ${isAllocated
          ? 'bg-white border-gray-100 hover:shadow-lg'
          : 'bg-slate-50/70 border-slate-200/80 opacity-80 hover:opacity-95'
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 text-sm truncate">{displayName}</h3>
          <div className="flex flex-wrap gap-1 mt-1">
            {item.code && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 font-mono">
                {item.code}
              </span>
            )}
            {item.is_paid ? (
              <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-green-100 text-green-700">
                Paid
              </span>
            ) : (
              <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700">
                Unpaid
              </span>
            )}
            {item.allow_half_day && (
              <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                Half‑day
              </span>
            )}
            {item.exclude_weekends && (
              <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-yellow-100 text-yellow-700">
                Excl. Wknd
              </span>
            )}
            {!isAllocated && (
              <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                Not Allocated
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {isAllocated ? (
            <>
              <p className={`text-2xl font-black ${remaining <= 0 ? 'text-rose-600' : 'text-purple-600'}`}>
                {remaining}
              </p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">remaining</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-black text-slate-400">N/A</p>
              <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">Not Allocated</p>
            </>
          )}
        </div>
      </div>

      <div>
        <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          {isAllocated && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${usedPct}%` }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
            />
          )}
        </div>
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>
            Used: <strong>{isAllocated ? used : 0}</strong>
          </span>
          <span>
            Total: <strong>{isAllocated ? total : (item.max_balance ?? 'N/A')}</strong>
          </span>
        </div>
      </div>

      {Number(item.carry_forward_limit) > 0 && (
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <span className="text-[10px] text-gray-400">
            Carry fwd limit:{' '}
            <strong className="text-gray-600">{item.carry_forward_limit}d</strong>
          </span>
        </div>
      )}
    </motion.div>
  );
};

/* ────────────────────────── Leave Card (Mobile) ────────────────────────── */
const LeaveCard = ({ leave, onViewDetails, onEdit, onCancel }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="rounded-xl bg-white p-4 shadow-md border border-gray-100 cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
      onClick={() => onViewDetails(leave)}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          {/* Updated: use leave_name from backend */}
          <LeaveTypeBadge name={leave.leave_name} isPaid={leave.is_paid} />
          <p className="mt-1 text-xs text-gray-400">Applied: {formatDate(leave.applied_at)}</p>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ActionMenu
            menuId={`leave-card-${leave.id}`}
            actions={[
              {
                label: 'View Details',
                icon: <FaEye size={12} />,
                onClick: () => onViewDetails(leave),
                className: 'text-green-600 hover:text-green-700 hover:bg-green-50',
              },
              ...(leave.status === 'pending'
                ? [
                  {
                    label: 'Edit',
                    icon: <FaEdit size={12} />,
                    onClick: () => onEdit(leave),
                    className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50',
                  },
                ]
                : []),
              ...(leave.status === 'pending'
                ? [
                  {
                    label: 'Cancel',
                    icon: <FaTimes size={12} />,
                    onClick: () => onCancel(leave),
                    className: 'text-red-600 hover:text-red-700 hover:bg-red-50',
                  },
                ]
                : []),
            ]}
          />
        </div>
      </div>
      <div className="space-y-2 border-t border-gray-100 pt-3">
        <div className="flex justify-between">
          <span className="text-xs text-gray-500">Duration:</span>
          <span className="text-xs font-medium text-gray-700">
            {formatDays(leave.total_days)} day(s)
            {leave.is_half_day &&
              ` (${leave.half_day_type === 'first_half' ? 'First Half' : 'Second Half'})`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-gray-500">From:</span>
          <span className="text-xs text-gray-700">{formatDate(leave.start_date)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-gray-500">To:</span>
          <span className="text-xs text-gray-700">{formatDate(leave.end_date)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Status:</span>
          <StatusBadge status={leave.status} />
        </div>
        <div className="mt-2 rounded-lg bg-gray-50 p-2">
          <p className="line-clamp-2 text-xs text-gray-600">{leave.reason}</p>
        </div>
      </div>
    </motion.div>
  );
};

/* ──────────────────────── Cancel Leave Modal ──────────────────────── */
const CancelLeaveModal = ({ leave, onClose, onSuccess }) => {
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCancel = async () => {
    setSubmitting(true);
    try {
      await request('/leave/cancel', 'PUT', { id: leave.id, remarks });
      toast.success('Leave cancelled successfully');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to cancel leave');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {leave && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
          <ModalScrollLock />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="border-b border-gray-100 bg-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Cancel Leave</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <FaTimes />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to cancel this leave? Please provide a reason.
              </p>
              <textarea
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                placeholder="Remarks for cancellation..."
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={onClose}
                className="flex-1 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
              >
                Back
              </button>
              <button
                onClick={handleCancel}
                disabled={submitting || !remarks.trim()}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? <FaSpinner className="animate-spin" /> : <FaTimes />}
                Confirm Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ──────────────────────── Leave Form Modal ──────────────────────── */
const LeaveFormModal = ({ open, title, leaveTypes, balances, initialLeave, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    leave_config_id: '',
    start_date: '',
    end_date: '',
    is_half_day: false,
    half_day_type: 'first_half',
    reason: '',
    attachments: [],
    deleted_attachments: [],
  });
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attachmentPreviews, setAttachmentPreviews] = useState([]);
  const isEditing = Boolean(initialLeave);

  const selectedLeaveType = useMemo(
    () => leaveTypes.find((type) => String(type.id) === String(form.leave_config_id)) || null,
    [leaveTypes, form.leave_config_id]
  );

  const leaveTypeSelectOptions = useMemo(
    () =>
      leaveTypes
        .filter((type) => type.allocated)
        .map((type) => ({
          value: type.id,
          label: `${type.name}${type.code ? ` (${type.code})` : ''}${!type.is_paid ? ' (Unpaid)' : ''}`,
        })),
    [leaveTypes]
  );

  const selectedLeaveTypeOption = useMemo(
    () =>
      leaveTypeSelectOptions.find((opt) => String(opt.value) === String(form.leave_config_id)) || null,
    [leaveTypeSelectOptions, form.leave_config_id]
  );

  const selectedLeaveBalance = useMemo(() => {
    if (!selectedLeaveType) return null;
    return selectedLeaveType._balance;
  }, [selectedLeaveType]);

  const isAllocated = Boolean(selectedLeaveType?.allocated);
  const remainingDays = isAllocated ? toNumber(selectedLeaveBalance?.remaining) : 0;
  const selectedDays = getRequestedDays(form.start_date, form.end_date, form.is_half_day);
  const overBalance = Boolean(selectedLeaveType && isAllocated && selectedDays > remainingDays);
  const unallocatedSelected = Boolean(selectedLeaveType && !isAllocated);

  const handleDateChange = (range) => {
    if (!range) return;
    setForm((prev) => ({
      ...prev,
      start_date: range.start || '',
      end_date: range.end || '',
    }));
  };

  const handleAttachmentChange = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    const validFiles = selectedFiles.filter(isAllowedAttachment);
    const invalidFiles = selectedFiles.filter((file) => !isAllowedAttachment(file));
    if (invalidFiles.length) toast.error('Only JPG/JPEG images and PDF files are allowed');
    if (!validFiles.length) return;

    setIsUploading(true);
    try {
      const uploadPromises = validFiles.map((file) =>
        uploadFile(file).then((url) => ({ url, name: file.name, type: file.type, size: file.size }))
      );
      const uploadedFiles = await Promise.all(uploadPromises);
      setForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...uploadedFiles] }));
      toast.success(`${uploadedFiles.length} file(s) uploaded successfully`);
    } catch (error) {
      toast.error('Failed to upload one or more files');
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!initialLeave) {
      setForm({
        leave_config_id: '',
        start_date: '',
        end_date: '',
        is_half_day: false,
        half_day_type: 'first_half',
        reason: '',
        attachments: [],
        deleted_attachments: [],
      });
      return;
    }
    // Use the correct field names from the API response
    setForm({
      leave_config_id: String(initialLeave.leave_config_id || ''),
      start_date: initialLeave.start_date || '',
      end_date: initialLeave.end_date || '',
      is_half_day: Boolean(initialLeave.is_half_day),
      half_day_type: initialLeave.half_day_type || 'first_half',
      reason: initialLeave.reason || '',
      attachments: [],
      deleted_attachments: [],
    });
  }, [initialLeave, open]);

  useEffect(() => {
    const nextPreviews = form.attachments.map((att) => ({
      key: att.url || `${att.name}-${att.size}`,
      name: att.name,
      isImage: isImageAttachment(att),
      url: att.url,
    }));
    setAttachmentPreviews(nextPreviews);
  }, [form.attachments]);

  const submit = async (event) => {
    event.preventDefault();
    if (unallocatedSelected) {
      toast.error('Selected leave type is not allocated to you.');
      return;
    }
    if (overBalance) {
      toast.error(
        `Selected date range exceeds your ${formatDays(remainingDays)} day balance for ${selectedLeaveType?.name || 'this leave type'
        }.`
      );
      return;
    }
    setSaving(true);
    try {
      let endpoint = '/leave/apply';
      let method = 'POST';
      const payload = {
        leave_config_id: form.leave_config_id,
        start_date: form.start_date,
        end_date: form.end_date,
        is_half_day: form.is_half_day ? true : false,
        reason: form.reason,
        attachments: form.attachments.map((a) => a.url),
      };
      if (form.is_half_day) payload.half_day_type = form.half_day_type;

      if (initialLeave) {
        method = 'PUT';
        endpoint = '/leave/application-update';
        payload.id = initialLeave.id;
        payload.deleted_attachments = form.deleted_attachments;
      }

      await request(endpoint, method, payload);
      toast.success(
        initialLeave ? 'Leave updated successfully' : 'Leave application submitted successfully'
      );
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Unable to save leave');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={title}
      subtitle={isEditing ? 'Update your leave request details.' : 'Submit a new leave application.'}
      icon={
        isEditing ? (
          <FaEdit className="h-6 w-6 text-blue-600" />
        ) : (
          <FaPlus className="h-6 w-6 text-blue-600" />
        )
      }
      size="3xl"
      footer={
        <div className="flex gap-3 w-full justify-end sm:w-auto">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-all border border-slate-200"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="leave-form"
            disabled={
              saving ||
              isUploading ||
              overBalance ||
              unallocatedSelected ||
              !form.leave_config_id
            }
            title={
              unallocatedSelected
                ? 'This leave type is not allocated to you.'
                : overBalance
                  ? `Selected ${formatDays(selectedDays)} day(s), but only ${formatDays(
                    remainingDays
                  )} day(s) are available.`
                  : ''
            }
            className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-bold hover:from-violet-700 hover:to-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <FaSpinner className="animate-spin" /> : isEditing ? <FaEdit /> : <FaPlus />}
            {saving ? 'Processing...' : 'Save'}
          </button>
        </div>
      }
    >
      <form id="leave-form" onSubmit={submit} className="space-y-6">
        {/* Balance Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between group hover:border-violet-200 transition-all">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Selected Mode
            </span>
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-2 h-2 rounded-full ${isEditing ? 'bg-amber-400' : 'bg-green-400'}`} />
              <p className="text-sm font-bold text-slate-700">
                {isEditing ? 'Editing Request' : 'New Application'}
              </p>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between group hover:border-violet-200 transition-all">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Current Balance
            </span>
            {selectedLeaveType && !isAllocated ? (
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold text-amber-600">Not Allocated</span>
              </div>
            ) : (
              <div className="mt-1 flex items-baseline gap-1">
                <span
                  className={`text-2xl font-black ${remainingDays <= 0 ? 'text-rose-600' : 'text-slate-800'
                    }`}
                >
                  {formatDays(remainingDays)}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Days Left</span>
              </div>
            )}
          </div>
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex flex-col justify-between group hover:border-indigo-200 transition-all">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
              Selected Range
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className={`text-2xl font-black ${overBalance ? 'text-rose-600' : 'text-indigo-600'
                  }`}
              >
                {formatDays(selectedDays)}
              </span>
              <span className="text-[10px] font-bold text-indigo-400 uppercase">Days Selected</span>
            </div>
          </div>
        </div>

        {/* Leave Type & Half Day */}
        <div className="flex flex-col gap-6">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Leave Type <span className="text-rose-500">*</span>
            </label>
            <SelectField
              options={leaveTypeSelectOptions}
              value={selectedLeaveTypeOption}
              onChange={(option) =>
                setForm((prev) => ({ ...prev, leave_config_id: option ? option.value : '' }))
              }
              placeholder="Choose leave type..."
              isClearable
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: '48px',
                  borderRadius: '12px',
                  borderColor: '#e2e8f0',
                  boxShadow: 'none',
                  '&:hover': { borderColor: '#8b5cf6' },
                }),
                valueContainer: (base) => ({
                  ...base,
                  padding: '0 14px',
                }),
                input: (base) => ({
                  ...base,
                  margin: 0,
                  padding: 0,
                }),
                placeholder: (base) => ({
                  ...base,
                  color: '#94a3b8',
                  fontWeight: 500,
                }),
                singleValue: (base) => ({
                  ...base,
                  color: '#334155',
                  fontWeight: 500,
                }),
              }}
            />
            {unallocatedSelected && (
              <p className="mt-1.5 text-xs text-amber-600 font-semibold flex items-center gap-1">
                <FaInfoCircle size={12} /> This leave type is not allocated to you.
              </p>
            )}
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Day Type
            </label>
            <div
              className={`bg-slate-50 rounded-2xl p-3 border border-slate-100 flex flex-col gap-3 transition-all ${form.is_half_day ? 'ring-2 ring-violet-100 border-violet-200 bg-white' : ''
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">Half Day</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={form.is_half_day}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setForm((prev) => ({
                        ...prev,
                        is_half_day: checked,
                        half_day_type: checked ? 'first_half' : '',
                      }));
                    }}
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
                </label>
              </div>
              {form.is_half_day && (
                <AnimatePresence>
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/50">
                      {['first_half', 'second_half'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, half_day_type: type }))}
                          className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${form.half_day_type === type
                              ? 'bg-white text-violet-600 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                          {type === 'first_half' ? '1st' : '2nd'} Half
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Date Range */}
          <div className="md:col-span-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Date Range <span className="text-rose-500">*</span>
              </label>
              {overBalance && (
                <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                  <FaInfoCircle size={10} /> Exceeds Balance
                </span>
              )}
            </div>
            <DateRangePickerField
              value={{ start: form.start_date, end: form.end_date }}
              onChange={handleDateChange}
              placeholder="Select leave dates"
              buttonClassName="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm shadow-sm transition hover:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/10 font-medium"
              popoverClassName="mt-2"
              initialTab="single"
              mode="range"
              showQuickSelect={false}
              minDate={new Date()}
              maxDays={selectedLeaveType ? Math.max(0, remainingDays) : null}
            />
            <p className="mt-2 text-[11px] text-slate-400 italic">
              Selected:{' '}
              <span className="font-bold text-slate-600">
                {form.start_date ? formatDate(form.start_date) : '...'}
              </span>{' '}
              to{' '}
              <span className="font-bold text-slate-600">
                {form.end_date ? formatDate(form.end_date) : '...'}
              </span>
            </p>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Reason / Description
          </label>
          <textarea
            rows={3}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 placeholder:text-slate-300 resize-none font-medium"
            placeholder="Describe the reason for your leave application..."
            value={form.reason}
            onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
          />
        </div>

        {/* Attachments */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Attachments
            </label>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              PDF, JPG, PNG (Max 5MB)
            </span>
          </div>
          {initialLeave?.attachments?.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {initialLeave.attachments.map((file) => {
                const marked = form.deleted_attachments.includes(file.id);
                const isImage = isImageAttachment(file);
                return (
                  <div
                    key={file.id}
                    className={`group relative rounded-xl border overflow-hidden aspect-square transition-all ${marked ? 'border-rose-200 ring-2 ring-rose-100 opacity-60' : 'border-slate-100'
                      }`}
                  >
                    <div className="h-full w-full bg-slate-50 flex items-center justify-center">
                      {isImage ? (
                        <img
                          src={file.file_url}
                          alt={file.original_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-slate-400">
                          <FaPaperclip size={20} />
                          <span className="text-[9px] font-bold uppercase truncate px-2 max-w-full">
                            {file.original_name}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          deleted_attachments: marked
                            ? prev.deleted_attachments.filter((id) => id !== file.id)
                            : [...prev.deleted_attachments, file.id],
                        }))
                      }
                      className={`absolute inset-0 flex flex-col items-center justify-center gap-1 transition-all ${marked
                          ? 'bg-rose-500/90 text-white'
                          : 'bg-slate-900/0 text-transparent group-hover:bg-slate-900/60 group-hover:text-white'
                        }`}
                    >
                      {marked ? <FaPlus className="rotate-45" /> : <FaTrash size={14} />}
                      <span className="text-[10px] font-black uppercase tracking-tighter">
                        {marked ? 'Restore' : 'Remove'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="relative group">
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleAttachmentChange}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 flex flex-col items-center justify-center text-center group-hover:border-violet-300 group-hover:bg-violet-50/30 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-3 shadow-sm group-hover:text-violet-600 transition-colors">
                {isUploading ? <FaSpinner className="animate-spin" /> : <FaUpload />}
              </div>
              <p className="text-sm font-bold text-slate-700">
                Drop files here or <span className="text-violet-600">Browse</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                Add medical certificates or support documents
              </p>
            </div>
          </div>
          <AnimatePresence>
            {attachmentPreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2">
                {attachmentPreviews.map((preview, index) => (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    key={preview.key}
                    className="relative aspect-square rounded-lg border border-slate-200 bg-white group overflow-hidden shadow-sm"
                  >
                    {preview.isImage ? (
                      <img src={preview.url} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-orange-400 bg-orange-50">
                        <FaPaperclip />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          attachments: prev.attachments.filter((_, i) => i !== index),
                        }))
                      }
                      className="absolute top-1 right-1 w-5 h-5 bg-slate-900/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <FaTimes size={10} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </form>
    </Modal>
  );
};

/* ──────────────────────────── MyLeave Main Component ──────────────────────────── */
const MyLeave = () => {
  const { user, employee, company } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [viewMode, setViewMode] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'card' : 'table'
  );
  const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 10);
  const [resultMeta, setResultMeta] = useState({ total: 0, total_pages: 1, counts: {} });
  const [viewLeave, setViewLeave] = useState(null);
  const [editLeave, setEditLeave] = useState(null);
  const [showApply, setShowApply] = useState(false);
  const [cancellingLeave, setCancellingLeave] = useState(null);
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(null);

  const lastRequestKeyRef = useRef('');

  const buildQueryParams = useCallback(
    (page, limit) => {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', limit);
      if (status && status !== 'all') params.set('status', status);
      if (search) params.set('search', search);
      if (leaveTypeFilter) params.set('leave_type', leaveTypeFilter);
      if (dateFilter?.from_date) params.set('start_date', dateFilter.from_date);
      if (dateFilter?.to_date) params.set('end_date', dateFilter.to_date);
      return params.toString();
    },
    [status, search, leaveTypeFilter, dateFilter]
  );

  const loadLeaves = useCallback(
    async (targetPage = pagination.page, force = false) => {
      const queryString = buildQueryParams(targetPage, pagination.limit);
      const requestKey = `${queryString}`;
      if (!force && lastRequestKeyRef.current === requestKey) return;
      setLoading(true);
      try {
        lastRequestKeyRef.current = requestKey;
        const result = await request(`/leave/my-applications?${queryString}`);
        const rows = result.data || [];
        const total = Number(result.meta?.total ?? result.total ?? rows.length ?? 0);
        const totalPages = Number(
          result.meta?.total_pages ??
          result.last_page ??
          Math.max(1, Math.ceil(total / pagination.limit))
        );
        setLeaves(rows);
        setResultMeta({
          total,
          total_pages: totalPages,
          counts: result.meta?.counts || {},
        });
        updatePagination({
          page: result.meta?.page || targetPage,
          limit: result.meta?.limit || pagination.limit,
          total,
          total_pages: totalPages,
          is_last_page: (result.meta?.page || targetPage) >= totalPages,
        });
      } catch (error) {
        lastRequestKeyRef.current = '';
        toast.error(error.message || 'Failed to load leaves');
      } finally {
        setLoading(false);
      }
    },
    [pagination.page, pagination.limit, buildQueryParams, updatePagination]
  );

  const loadBalances = useCallback(async () => {
    const employeeId = company?.employee_id || employee?.id || user?.id;
    if (!employeeId) return;
    try {
      const year = new Date().getFullYear();
      const result = await request(`/leave/employee/${employeeId}?year=${year}`);
      const data = Array.isArray(result.data) ? result.data : [];
      setBalances(data);
      const types = data.map((item) => ({
        id: String(item.leave_config_id),
        name: item.name || formatLeaveTypeName(item.code || ''),
        code: item.code || '',
        is_paid: item.is_paid,
        allow_half_day: item.allow_half_day,
        allocated: Boolean(item.allocated),
        max_balance: item.max_balance,
        carry_forward_limit: item.carry_forward_limit,
        exclude_weekends: item.exclude_weekends,
        _balance: item.balance,
        _item: item,
      }));
      setLeaveTypes(types);
    } catch (error) {
      toast.error(error.message || 'Failed to load leave balances');
    }
  }, [company, employee, user]);

  const initialFetchDoneRef = useRef(false);

  useEffect(() => {
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;
    const loadInitialData = async () => {
      await Promise.all([loadBalances(), loadLeaves(1)]);
    };
    loadInitialData();
  }, [loadBalances, loadLeaves]);

  useEffect(() => {
    goToPage(1);
    loadLeaves(1, true);
  }, [status, search, leaveTypeFilter, dateFilter, goToPage, loadLeaves]);

  useEffect(() => {
    loadLeaves(pagination.page);
  }, [pagination.page, loadLeaves]);

  const stats = useMemo(
    () => ({
      total: resultMeta.total,
      pending: resultMeta.counts?.pending || 0,
      approved: resultMeta.counts?.approved || 0,
      rejected: resultMeta.counts?.rejected || 0,
      cancelled: resultMeta.counts?.cancelled || 0,
    }),
    [resultMeta]
  );

  const leaveTypeOptions = useMemo(
    () =>
      leaveTypes
        .filter((type) => type.allocated)
        .map((type) => ({
          value: type.code || type.name,
          label: `${type.name}${!type.is_paid ? ' (Unpaid)' : ''}`,
        })),
    [leaveTypes]
  );

  const handleDateFilterChange = (value) => {
    if (!value) {
      setDateFilter(null);
      return;
    }
    if (value.date) {
      setDateFilter({ from_date: value.date, to_date: value.date });
    } else if (value.from_date && value.to_date) {
      setDateFilter({ from_date: value.from_date, to_date: value.to_date });
    } else {
      setDateFilter(null);
    }
  };

  const handlePageChange = (nextPage) => {
    goToPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ManagementHub
      eyebrow={
        <>
          <FaCalendarAlt size={11} /> Leave management
        </>
      }
      title="My Leaves"
      description="Manage your leave applications and track leave balance."
      accent="violet"
      onRefresh={async () => {
        await loadBalances();
        await loadLeaves(pagination.page, true);
      }}
      actions={
        <button
          type="button"
          onClick={() => setShowApply(true)}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-300"
        >
          <FaPlus />
          Apply Leave
        </button>
      }
    >
      <div className="space-y-6 p-2 lg:p-0">
        {/* Statistics Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
        >
          <div className="rounded-xl bg-white p-3 shadow-md sm:p-4">
            <div className="mb-1 flex items-center gap-2">
              <FaCalendarCheck className="text-violet-500 text-sm sm:text-base" />
              <p className="text-xs text-gray-500 uppercase">Total</p>
            </div>
            <p className="text-xl font-bold text-gray-800 sm:text-2xl">{stats.total}</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-md sm:p-4">
            <div className="mb-1 flex items-center gap-2">
              <FaSpinner className="text-yellow-500 text-sm sm:text-base" />
              <p className="text-xs text-gray-500 uppercase">Pending</p>
            </div>
            <p className="text-xl font-bold text-yellow-600 sm:text-2xl">{stats.pending}</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-md sm:p-4">
            <div className="mb-1 flex items-center gap-2">
              <FaEye className="text-green-500 text-sm sm:text-base" />
              <p className="text-xs text-gray-500 uppercase">Approved</p>
            </div>
            <p className="text-xl font-bold text-green-600 sm:text-2xl">{stats.approved}</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-md sm:p-4">
            <div className="mb-1 flex items-center gap-2">
              <FaTimes className="text-red-500 text-sm sm:text-base" />
              <p className="text-xs text-gray-500 uppercase">Rejected</p>
            </div>
            <p className="text-xl font-bold text-red-600 sm:text-2xl">{stats.rejected}</p>
          </div>
        </motion.div>

        {/* Leave Balance Section */}
        {Array.isArray(balances) && balances.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 sm:mb-6"
          >
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <FaCalendarCheck className="text-violet-500" /> Leave Balance
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {balances
                .map((item) => (
                  <LeaveBalanceCard key={item.leave_config_id} item={item} />
                ))}
            </div>
          </motion.div>
        )}

        {/* Filters Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
              <input
                className="w-full pl-11 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 outline-none transition-all text-sm min-h-[42px]"
                placeholder="Search by type or reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <FaTimes size={14} />
                </button>
              )}
            </div>
            <div className="min-w-[180px]">
              <SelectField
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
                value={[
                  { value: 'all', label: 'All Status' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                  { value: 'cancelled', label: 'Cancelled' },
                ].find((opt) => opt.value === status)}
                onChange={(option) => setStatus(option ? option.value : 'all')}
                className="text-sm font-medium"
              />
            </div>
          </div>

          <div className="flex w-full lg:w-auto items-center justify-between lg:justify-end gap-4">
            <div className="min-w-[200px]">
              <SelectField
                options={leaveTypeOptions}
                value={leaveTypeOptions.find((opt) => opt.value === leaveTypeFilter) || null}
                onChange={(option) => setLeaveTypeFilter(option ? option.value : '')}
                placeholder="All Leave Types"
                isClearable
                className="text-sm font-medium"
              />
            </div>
            <div className="min-w-[240px]">
              <AdvancedDateFilter
                value={
                  dateFilter
                    ? dateFilter.from_date === dateFilter.to_date
                      ? { date: dateFilter.from_date }
                      : { from_date: dateFilter.from_date, to_date: dateFilter.to_date }
                    : null
                }
                onChange={handleDateFilterChange}
                placeholder="Filter by date"
                tabOptions={['date', 'range']}
                buttonClassName="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm shadow-sm transition hover:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/10 font-medium"
              />
            </div>
            <div className="h-8 w-px bg-gray-200 hidden lg:block"></div>
            <div className="flex w-full lg:w-auto justify-end">
              <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="violet" />
            </div>
          </div>
        </motion.div>

        {/* Leaves List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl bg-white shadow-xl overflow-visible"
        >
          {loading ? (
            <div className="flex justify-center py-16">
              <FaSpinner className="text-3xl text-purple-500 animate-spin" />
            </div>
          ) : leaves.length === 0 ? (
            <div className="p-10 text-center">
              <FaInfoCircle className="mx-auto mb-3 text-4xl text-gray-300" />
              <p className="text-gray-500">No leaves found</p>
              <p className="mt-1 text-xs text-gray-400">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              {viewMode === 'table' && (
                <ManagementTable
                  rows={leaves}
                  columns={[
                    {
                      key: 'leave_type',
                      label: 'Leave Type',
                      render: (leave) => (
                        <>
                          {/* Updated: use leave_name and is_paid */}
                          <LeaveTypeBadge name={leave.leave_name} isPaid={leave.is_paid} />
                          <p className="mt-1 text-xs text-gray-500">
                            {formatDays(leave.total_days)} day(s)
                          </p>
                        </>
                      ),
                    },
                    {
                      key: 'start_date',
                      label: 'Start Date',
                      render: (leave) => (
                        <span className="text-sm">{formatDate(leave.start_date)}</span>
                      ),
                    },
                    {
                      key: 'end_date',
                      label: 'End Date',
                      render: (leave) => (
                        <span className="text-sm">{formatDate(leave.end_date)}</span>
                      ),
                    },
                    {
                      key: 'duration',
                      label: 'Duration',
                      render: (leave) => (
                        <span className="text-sm">
                          {formatDays(leave.total_days)} day(s)
                          {leave.is_half_day &&
                            ` (${leave.half_day_type === 'first_half' ? 'First Half' : 'Second Half'})`}
                        </span>
                      ),
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      render: (leave) => <StatusBadge status={leave.status} />,
                    },
                    {
                      key: 'applied_on',
                      label: 'Applied On',
                      render: (leave) => (
                        <span className="text-sm">{formatDateTime(leave.applied_at)}</span>
                      ),
                    },
                  ]}
                  rowKey={(row) => row.id}
                  onRowClick={(row) => setViewLeave(row)}
                  getActions={(leave) => [
                    {
                      label: 'View Details',
                      icon: <FaEye size={12} />,
                      onClick: () => setViewLeave(leave),
                      className: 'text-green-600 hover:text-green-700 hover:bg-green-50',
                    },
                    ...(leave.status === 'pending'
                      ? [
                        {
                          label: 'Edit',
                          icon: <FaEdit size={12} />,
                          onClick: () => setEditLeave(leave),
                          className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50',
                        },
                      ]
                      : []),
                    ...(leave.status === 'pending'
                      ? [
                        {
                          label: 'Cancel',
                          icon: <FaTimes size={12} />,
                          onClick: () => setCancellingLeave(leave),
                          className: 'text-red-600 hover:text-red-700 hover:bg-red-50',
                        },
                      ]
                      : []),
                  ]}
                  accent="violet"
                />
              )}
              {viewMode === 'card' && (
                <ManagementGrid viewMode={viewMode} className="p-3 sm:p-4">
                  <AnimatePresence>
                    {leaves.map((leave) => (
                      <LeaveCard
                        key={leave.id}
                        leave={leave}
                        onViewDetails={setViewLeave}
                        onEdit={setEditLeave}
                        onCancel={setCancellingLeave}
                      />
                    ))}
                  </AnimatePresence>
                </ManagementGrid>
              )}
            </>
          )}
        </motion.div>

        {/* Pagination */}
        {!loading && leaves.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-6"
          >
            <Pagination
              currentPage={pagination.page}
              totalItems={resultMeta.total}
              itemsPerPage={pagination.limit}
              onPageChange={handlePageChange}
              showInfo={viewMode !== 'card'}
              onLimitChange={changeLimit}
            />
          </motion.div>
        )}
      </div>

      {/* ─── View Leave Modal ─── */}
      <AnimatePresence>
        {viewLeave && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onMouseDown={(e) => e.target === e.currentTarget && setViewLeave(null)}
          >
            <ModalScrollLock />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: 'spring', duration: 0.5 } }}
              exit={{ scale: 0.9, opacity: 0, y: 20, transition: { duration: 0.3 } }}
              className="relative bg-white backdrop-blur-xl w-full max-w-4xl max-h-[85vh] rounded-xl shadow-2xl border border-gray-100 m-auto flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 sm:px-8 py-5 sticky top-0 z-[10]">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-fuchsia-200">
                    <FaEye className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Leave Details</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge status={viewLeave.status} />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewLeave(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-all"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 px-6 sm:px-8 py-6">
                {/* Updated: use leave_name */}
                <div className="p-4 bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-xl border border-violet-100">
                  <h3 className="text-2xl font-black text-slate-800">
                    {viewLeave.leave_name}
                  </h3>
                  <p className="text-violet-600 mt-1 font-semibold text-sm">
                    {viewLeave.is_paid ? 'Paid Leave' : 'Unpaid Leave'} ·{' '}
                    {formatDays(viewLeave.total_days)} Days{' '}
                    {viewLeave.is_half_day &&
                      `(${viewLeave.half_day_type === 'first_half' ? 'First Half' : 'Second Half'
                      })`}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                      Start Date
                    </label>
                    <div className="text-gray-800 font-medium">
                      {formatDate(viewLeave.start_date)}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                      End Date
                    </label>
                    <div className="text-gray-800 font-medium">
                      {formatDate(viewLeave.end_date)}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                      Applied On
                    </label>
                    <div className="text-gray-800 font-medium">
                      {formatDateTime(viewLeave.applied_at)}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                      Status
                    </label>
                    <div className="text-gray-800 font-medium">
                      <StatusBadge status={viewLeave.status} />
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                    Reason / Description
                  </label>
                  <div className="text-gray-700 text-sm italic leading-relaxed">
                    "{viewLeave.reason || 'No reason provided.'}"
                  </div>
                </div>

                {viewLeave.approval_remarks && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                    <label className="text-xs font-semibold text-amber-600 uppercase tracking-wider block mb-2">
                      Approval Remarks
                    </label>
                    <div className="text-amber-800 text-sm">
                      {viewLeave.approval_remarks}
                    </div>
                  </div>
                )}

                {viewLeave.attachments?.length > 0 && (
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                      Attachments
                    </label>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {viewLeave.attachments.map((file) => {
                        const isImage = isImageAttachment(file);
                        return (
                          <a
                            key={file.id}
                            href={file.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:border-violet-300 hover:shadow-md"
                          >
                            <div className="relative aspect-square flex items-center justify-center bg-gray-50">
                              {isImage ? (
                                <img
                                  src={file.file_url}
                                  alt={file.original_name}
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://placehold.co/100x100?text=Error';
                                  }}
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-2 text-gray-400">
                                  <FaPaperclip size={24} />
                                  <span className="px-2 text-center text-[10px] font-medium line-clamp-2">
                                    {file.original_name}
                                  </span>
                                </div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-transparent transition-all group-hover:bg-black/20 group-hover:text-white">
                                <FaEye size={20} />
                              </div>
                            </div>
                            <div className="border-t border-gray-100 bg-white px-2 py-1.5">
                              <p className="truncate text-[10px] font-medium text-gray-600">
                                {file.original_name ||
                                  (file.file_url
                                    ? file.file_url.split('/').pop()
                                    : 'Attachment')}
                              </p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end w-full px-6 sm:px-8 py-5 border-t border-gray-100 bg-white">
                <button
                  type="button"
                  onClick={() => setViewLeave(null)}
                  className="flex px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
                >
                  Close
                </button>
                {viewLeave.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setCancellingLeave(viewLeave);
                        setViewLeave(null);
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl font-medium hover:from-rose-700 hover:to-red-700 transition-all"
                    >
                      <FaTimes size={14} /> Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditLeave(viewLeave);
                        setViewLeave(null);
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-fuchsia-700 transition-all shadow-lg shadow-purple-200"
                    >
                      <FaEdit size={14} /> Edit
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Apply / Edit / Cancel Modals */}
      <LeaveFormModal
        open={showApply}
        title="Apply Leave"
        leaveTypes={leaveTypes}
        balances={balances}
        initialLeave={null}
        onClose={() => setShowApply(false)}
        onSuccess={() => {
          goToPage(1);
          loadBalances();
          loadLeaves(1, true);
        }}
      />

      <LeaveFormModal
        open={!!editLeave}
        title="Edit Leave"
        leaveTypes={leaveTypes}
        balances={balances}
        initialLeave={editLeave}
        onClose={() => setEditLeave(null)}
        onSuccess={() => {
          loadLeaves(pagination.page, true);
          loadBalances();
        }}
      />

      <CancelLeaveModal
        leave={cancellingLeave}
        onClose={() => setCancellingLeave(null)}
        onSuccess={() => {
          loadLeaves(pagination.page, true);
          loadBalances();
        }}
      />
    </ManagementHub>
  );
};

export default MyLeave;