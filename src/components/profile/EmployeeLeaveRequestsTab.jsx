import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FaEye, FaEdit, FaCheck, FaTrash, FaSpinner, FaTimes, FaPlus,
  FaCloudUploadAlt, FaPaperclip, FaUmbrellaBeach, FaCalendarAlt,
  FaClock, FaInfoCircle, FaSave
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import apiCall, { uploadFile } from '../../utils/api';
import Modal from '../Modal';
import SelectField from '../SelectField';
import AdvancedDateFilter from '../AdvancedDateFilter';
import Pagination, { usePagination } from '../PaginationComponent';
import { ManagementTable } from '../common';
import ManagementGrid from '../ManagementGrid';
import ManagementViewSwitcher from '../ManagementViewSwitcher';

const fmt = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDays = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
};

const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const STATUS = {
  approved: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  rejected: { label: 'Rejected', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', border: 'border-rose-200' },
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
  cancelled: { label: 'Cancelled', bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400', border: 'border-slate-200' },
};

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${s.bg} ${s.text} border ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export default function EmployeeLeaveRequestsTab({ employeeId, employeeName }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailLeave, setDetailLeave] = useState(null);
  const [approveLeave, setApproveLeave] = useState(null);
  const [rejectLeave, setRejectLeave] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Leave configs for Create modal
  const [leaveConfigs, setLeaveConfigs] = useState([]);
  const [leaveConfigsLoading, setLeaveConfigsLoading] = useState(false);
  const [createUploading, setCreateUploading] = useState(false);

  const [createForm, setCreateForm] = useState({
    leave_config_id: '',
    start_date: '',
    end_date: '',
    is_half_day: false,
    half_day_type: 'first_half',
    remarks: '',
    attachments: [],
  });

  const [approveForm, setApproveForm] = useState({
    start_date: '',
    end_date: '',
    is_half_day: false,
    half_day_type: 'first_half',
    remarks: '',
  });

  const [rejectRemarks, setRejectRemarks] = useState('');

  const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 10);

  const fetchLeaves = useCallback(async (page = pagination.page) => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      const params = new URLSearchParams({
        employee_id: String(employeeId),
        page: String(page),
        limit: String(pagination.limit),
      });
      if (statusFilter) params.append('status', statusFilter);

      const response = await apiCall(`/leave/management?${params.toString()}`, 'GET', null, company?.id);
      const result = await response.json();

      if (result.success) {
        setLeaves(result.data || []);
        updatePagination({
          page: result.meta?.page || page,
          limit: result.meta?.limit || pagination.limit,
          total: result.meta?.total || (result.data ? result.data.length : 0),
          total_pages: result.meta?.total_pages || 1,
          is_last_page: page >= (result.meta?.total_pages || 1),
        });
      } else {
        setLeaves([]);
      }
    } catch {
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, pagination.limit, pagination.page, statusFilter, updatePagination]);

  useEffect(() => {
    fetchLeaves(pagination.page);
  }, [employeeId, pagination.page, pagination.limit, statusFilter, fetchLeaves]);

  const loadLeaveConfigs = useCallback(async () => {
    if (!employeeId) return;
    setLeaveConfigsLoading(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      const response = await apiCall(`/leave/employee/${employeeId}`, 'GET', null, company?.id);
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setLeaveConfigs(
          result.data.map((c) => ({
            id: c.leave_config_id || c.id,
            leave_config_id: c.leave_config_id || c.id,
            code: c.code,
            name: c.name,
            is_paid: c.is_paid,
            allow_half_day: c.allow_half_day,
            allocated: Boolean(c.allocated),
            used: c.balance ? Number(c.balance.used || 0) : 0,
            remaining: c.balance ? Number(c.balance.remaining || 0) : 0,
            total_allocated: c.balance ? Number(c.balance.total_allocated || 0) : 0,
          }))
        );
      }
    } catch {
      setLeaveConfigs([]);
    } finally {
      setLeaveConfigsLoading(false);
    }
  }, [employeeId]);

  const openCreateModal = () => {
    setCreateForm({
      leave_config_id: '',
      start_date: '',
      end_date: '',
      is_half_day: false,
      half_day_type: 'first_half',
      remarks: '',
      attachments: [],
    });
    loadLeaveConfigs();
    setShowCreateModal(true);
  };

  const handleCreateAttachmentChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setCreateUploading(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      for (const file of files) {
        const uploadResult = await uploadFile(file, 'leave_attachments', company?.id);
        if (uploadResult?.fileUrl || uploadResult?.url) {
          const url = uploadResult.fileUrl || uploadResult.url;
          setCreateForm((prev) => ({
            ...prev,
            attachments: [...prev.attachments, { name: file.name, url, type: file.type }],
          }));
        }
      }
      toast.success('File(s) uploaded successfully');
    } catch (err) {
      toast.error('Failed to upload attachment');
    } finally {
      setCreateUploading(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e?.preventDefault();
    if (!createForm.leave_config_id) return toast.warning('Please select a leave type');
    if (!createForm.start_date || !createForm.end_date) return toast.warning('Please select a date range');
    if (createForm.end_date < createForm.start_date) return toast.warning('End date cannot be before start date');

    setSubmitting(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      const payload = {
        employee_id: Number(employeeId),
        leave_config_id: String(createForm.leave_config_id),
        start_date: createForm.start_date,
        end_date: createForm.end_date,
        is_half_day: createForm.is_half_day ? 1 : 0,
        half_day_type: createForm.is_half_day ? createForm.half_day_type : null,
        remarks: createForm.remarks || '',
        attachments: createForm.attachments.map((a) => a.url),
      };

      const response = await apiCall('/leave/management/create/', 'POST', payload, company?.id);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to create leave request');

      toast.success('Leave request submitted successfully');
      setShowCreateModal(false);
      fetchLeaves(1);
    } catch (error) {
      toast.error(error.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const openApproveModal = (leave) => {
    setApproveLeave(leave);
    setApproveForm({
      start_date: toDateInputValue(leave.start_date),
      end_date: toDateInputValue(leave.end_date),
      is_half_day: Boolean(leave.is_half_day),
      half_day_type: leave.half_day_type || 'first_half',
      remarks: '',
    });
  };

  const handleApproveSubmit = async () => {
    if (!approveLeave) return;
    setSubmitting(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      const payload = {
        id: approveLeave.id,
        start_date: approveForm.start_date,
        end_date: approveForm.end_date,
        is_half_day: approveForm.is_half_day ? 1 : 0,
        half_day_type: approveForm.is_half_day ? approveForm.half_day_type : null,
        remarks: approveForm.remarks || '',
      };
      const response = await apiCall('/leave/management/approve-edit', 'PUT', payload, company?.id);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to approve leave');

      toast.success(result.message || 'Leave approved successfully');
      setApproveLeave(null);
      fetchLeaves(pagination.page);
    } catch (error) {
      toast.error(error.message || 'Failed to approve leave');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectLeave) return;
    if (!rejectRemarks.trim()) return toast.warning('Rejection reason is required');

    setSubmitting(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      const payload = {
        ids: [rejectLeave.id],
        action: 'reject',
        remarks: rejectRemarks.trim(),
      };
      const response = await apiCall('/leave/management/bulk-approve-reject', 'PUT', payload, company?.id);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to reject leave');

      toast.success(result.message || 'Leave rejected successfully');
      setRejectLeave(null);
      fetchLeaves(pagination.page);
    } catch (error) {
      toast.error(error.message || 'Failed to reject leave');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCreateConfig = useMemo(
    () => leaveConfigs.find((c) => String(c.id) === String(createForm.leave_config_id)),
    [leaveConfigs, createForm.leave_config_id]
  );

  const columns = [
    {
      key: 'leave_type',
      label: 'Leave Type',
      render: (l) => (
        <span className="inline-flex whitespace-nowrap rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-800">
          {l.leave_name || l.leave_type || 'Leave'}
        </span>
      ),
    },
    {
      key: 'dates',
      label: 'Date Range',
      render: (l) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-800">
            {fmt(l.start_date)} → {fmt(l.end_date)}
          </span>
          {l.is_half_day && (
            <span className="text-[10px] text-amber-600 font-bold">
              Half Day ({l.half_day_type === 'first_half' ? '1st Half' : '2nd Half'})
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'total_days',
      label: 'Days',
      render: (l) => <span className="font-bold text-slate-700 text-sm">{formatDays(l.total_days)}d</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (l) => <StatusBadge status={l.status} />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top action and filter bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="w-[140px]">
          <SelectField
            options={[
              { value: '', label: 'All Status' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ]}
            value={
              statusFilter
                ? { value: statusFilter, label: statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) }
                : { value: '', label: 'All Status' }
            }
            onChange={(opt) => setStatusFilter(opt?.value || '')}
          />
        </div>

        <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-200 hover:from-amber-600 hover:to-orange-600 transition-all"
          >
            <FaPlus size={10} /> Request Leave
          </button>
          {leaves.length > 0 && (
            <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="amber" />
          )}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center py-12 gap-2 text-slate-400">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-xs font-medium">Loading leaves…</span>
        </div>
      )}

      {!loading && leaves.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-100">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-400">
            <FaUmbrellaBeach size={22} />
          </div>
          <p className="text-slate-700 font-bold text-sm">No leave applications found</p>
          <p className="text-slate-400 text-xs mt-1">This employee has not submitted any leave requests.</p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all border border-amber-200"
          >
            <FaPlus size={10} /> Request First Leave
          </button>
        </div>
      )}

      {!loading && leaves.length > 0 && viewMode === 'table' && (
        <ManagementTable
          rows={leaves}
          columns={columns}
          rowKey={(l) => l.id}
          onRowClick={(l) => setDetailLeave(l)}
          getActions={(l) => [
            { label: 'View Details', icon: <FaEye size={12} />, onClick: () => setDetailLeave(l), className: 'text-blue-600 hover:bg-blue-50' },
            ...(l.status === 'pending'
              ? [
                  { label: 'Approve / Edit', icon: <FaCheck size={12} />, onClick: () => openApproveModal(l), className: 'text-emerald-600 hover:bg-emerald-50' },
                  { label: 'Reject', icon: <FaTimes size={12} />, onClick: () => { setRejectLeave(l); setRejectRemarks(''); }, className: 'text-rose-600 hover:bg-rose-50' },
                ]
              : []),
          ]}
          accent="amber"
        />
      )}

      {!loading && leaves.length > 0 && viewMode === 'card' && (
        <ManagementGrid viewMode={viewMode}>
          {leaves.map((l) => (
            <motion.div
              key={l.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              onClick={() => setDetailLeave(l)}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-bold text-sm text-slate-800 truncate">{l.leave_name || l.leave_type || 'Leave'}</span>
                  <StatusBadge status={l.status} />
                </div>
                <p className="text-xs text-slate-600 font-medium mb-1">
                  {fmt(l.start_date)} → {fmt(l.end_date)}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                  <span>{formatDays(l.total_days)} day(s)</span>
                  {l.is_half_day && <span className="text-amber-600 font-bold">• Half Day</span>}
                </div>
                {l.reason && <p className="text-xs text-slate-500 italic line-clamp-2">"{l.reason}"</p>}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 mt-3">
                {l.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setRejectLeave(l); setRejectRemarks(''); }}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs"
                      title="Reject"
                    >
                      <FaTimes size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openApproveModal(l); }}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs"
                      title="Approve / Edit"
                    >
                      <FaCheck size={13} />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </ManagementGrid>
      )}

      {/* Pagination */}
      {!loading && leaves.length > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={goToPage}
          onLimitChange={changeLimit}
          showInfo
        />
      )}

      {/* Create Leave Modal matching LeaveManagement.jsx */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => !submitting && setShowCreateModal(false)}
          title="Create Leave Request"
          subtitle={`Submit leave request for ${employeeName || 'Employee'}`}
          icon={<FaUmbrellaBeach className="text-amber-600" />}
          size="2xl"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={submitting}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateSubmit}
                disabled={submitting || !createForm.leave_config_id || !createForm.start_date}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-amber-600 hover:to-orange-600 transition-all flex items-center gap-2 shadow-lg shadow-amber-200 disabled:opacity-50"
              >
                {submitting ? <FaSpinner className="animate-spin" /> : <FaSave />}
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          }
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Leave Type <span className="text-rose-500">*</span>
              </label>
              <SelectField
                options={leaveConfigs.map((c) => ({
                  value: c.id,
                  label: `${c.name} (${c.code}) - ${formatDays(c.remaining)} days left`,
                }))}
                value={
                  selectedCreateConfig
                    ? { value: selectedCreateConfig.id, label: `${selectedCreateConfig.name} (${selectedCreateConfig.code})` }
                    : null
                }
                onChange={(opt) => setCreateForm((prev) => ({ ...prev, leave_config_id: opt?.value || '' }))}
                isLoading={leaveConfigsLoading}
                placeholder="Choose leave type..."
              />
            </div>

            {/* Leave balances chips */}
            {leaveConfigs.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Available Balances</p>
                <div className="flex flex-wrap gap-1.5">
                  {leaveConfigs.map((c) => (
                    <span
                      key={c.id}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold font-mono border ${
                        createForm.leave_config_id === c.id
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {c.code}: <span className={c.remaining <= 0 ? 'text-rose-600' : 'text-emerald-600'}>{formatDays(c.remaining)}d</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Date Range <span className="text-rose-500">*</span>
              </label>
              <AdvancedDateFilter
                value={{
                  date: createForm.start_date && createForm.start_date === createForm.end_date ? createForm.start_date : '',
                  from_date: createForm.start_date && createForm.start_date !== createForm.end_date ? createForm.start_date : '',
                  to_date: createForm.end_date && createForm.start_date !== createForm.end_date ? createForm.end_date : '',
                }}
                onChange={(result) => {
                  const nextStart = result?.date || result?.from_date || '';
                  const nextEnd = result?.date || result?.to_date || nextStart;
                  setCreateForm((prev) => ({ ...prev, start_date: nextStart, end_date: nextEnd }));
                }}
                tabOptions={['date', 'range']}
                placeholder="Select leave date range"
                buttonClassName="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm shadow-sm font-medium"
              />
            </div>

            {/* Half Day Toggle */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Half Day Request</p>
                  <p className="text-xs text-slate-400 mt-0.5">Enable if taking a half-day session</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateForm((prev) => ({ ...prev, is_half_day: !prev.is_half_day }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    createForm.is_half_day ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      createForm.is_half_day ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {createForm.is_half_day && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {[{ value: 'first_half', label: 'First Half' }, { value: 'second_half', label: 'Second Half' }].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCreateForm((prev) => ({ ...prev, half_day_type: opt.value }))}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                        createForm.half_day_type === opt.value
                          ? 'border-amber-400 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Remarks / Reason
              </label>
              <textarea
                rows={3}
                placeholder="State the reason for leave..."
                value={createForm.remarks}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, remarks: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 outline-none text-sm resize-none"
              />
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Attachments (Optional)
              </label>
              <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-amber-400 transition-all bg-slate-50/50">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleCreateAttachmentChange}
                  disabled={createUploading}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center gap-1 text-slate-500">
                  {createUploading ? <FaSpinner className="animate-spin text-amber-500" /> : <FaCloudUploadAlt size={22} />}
                  <span className="text-xs font-bold">
                    {createUploading ? 'Uploading...' : 'Click or drag files to attach (PDF, JPG, PNG)'}
                  </span>
                </div>
              </div>
              {createForm.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {createForm.attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs font-medium text-amber-800">
                      <FaPaperclip size={10} />
                      <span className="truncate max-w-[140px]">{file.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCreateForm((prev) => ({
                            ...prev,
                            attachments: prev.attachments.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <FaTimes size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </Modal>
      )}

      {/* Leave Details Modal matching LeaveManagement.jsx */}
      {detailLeave && (
        <Modal
          isOpen={!!detailLeave}
          onClose={() => setDetailLeave(null)}
          title="Leave Details"
          subtitle={`${detailLeave.leave_name || detailLeave.leave_type || 'Leave'} · ${formatDays(detailLeave.total_days)} Days`}
          icon={<FaEye className="text-amber-500" />}
          size="lg"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <button
                type="button"
                onClick={() => setDetailLeave(null)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                Close
              </button>
              {detailLeave.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => { setRejectLeave(detailLeave); setRejectRemarks(''); setDetailLeave(null); }}
                    className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-rose-700 hover:to-red-700 transition-all flex items-center gap-1.5 shadow-md shadow-rose-200"
                  >
                    <FaTimes size={12} /> Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => { openApproveModal(detailLeave); setDetailLeave(null); }}
                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-emerald-700 hover:to-green-700 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-200"
                  >
                    <FaCheck size={12} /> Approve / Edit
                  </button>
                </>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-amber-50/60 rounded-xl border border-amber-100">
              <div>
                <h4 className="font-black text-slate-800 text-base">{detailLeave.leave_name || detailLeave.leave_type}</h4>
                <p className="text-xs text-amber-700 font-bold mt-0.5">
                  {formatDays(detailLeave.total_days)} Day(s) {detailLeave.is_half_day ? `(Half Day - ${detailLeave.half_day_type === 'first_half' ? 'First Half' : 'Second Half'})` : ''}
                </p>
              </div>
              <StatusBadge status={detailLeave.status} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Start Date</p>
                <p className="text-sm font-semibold text-slate-800">{fmt(detailLeave.start_date)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">End Date</p>
                <p className="text-sm font-semibold text-slate-800">{fmt(detailLeave.end_date)}</p>
              </div>
            </div>

            {detailLeave.reason && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reason</p>
                <p className="text-xs text-slate-700 italic">"{detailLeave.reason}"</p>
              </div>
            )}

            {detailLeave.approval_remarks && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Approval Remarks</p>
                <p className="text-xs text-emerald-800">{detailLeave.approval_remarks}</p>
              </div>
            )}

            {detailLeave.attachments?.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Attachments ({detailLeave.attachments.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {detailLeave.attachments.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:border-amber-200 transition-all"
                    >
                      <FaPaperclip size={10} className="text-amber-500" />
                      Attachment #{i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Approve / Edit Modal matching LeaveManagement.jsx */}
      {approveLeave && (
        <Modal
          isOpen={!!approveLeave}
          onClose={() => !submitting && setApproveLeave(null)}
          title="Approve / Edit Leave"
          subtitle={`Adjust and confirm approval for ${approveLeave.leave_name || 'Leave'}`}
          icon={<FaCheck className="text-emerald-600" />}
          size="md"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <button
                type="button"
                onClick={() => setApproveLeave(null)}
                disabled={submitting}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveSubmit}
                disabled={submitting}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-emerald-700 hover:to-green-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-200 disabled:opacity-50"
              >
                {submitting ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                {submitting ? 'Approving...' : 'Confirm Approve'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Leave Date Range
              </label>
              <AdvancedDateFilter
                value={{
                  date: approveForm.start_date && approveForm.start_date === approveForm.end_date ? approveForm.start_date : '',
                  from_date: approveForm.start_date && approveForm.start_date !== approveForm.end_date ? approveForm.start_date : '',
                  to_date: approveForm.end_date && approveForm.start_date !== approveForm.end_date ? approveForm.end_date : '',
                }}
                onChange={(result) => {
                  const nextStart = result?.date || result?.from_date || '';
                  const nextEnd = result?.date || result?.to_date || nextStart;
                  setApproveForm((prev) => ({ ...prev, start_date: nextStart, end_date: nextEnd }));
                }}
                tabOptions={['date', 'range']}
                placeholder="Adjust leave date range"
                buttonClassName="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-medium"
              />
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Half Day Leave</p>
                  <p className="text-xs text-slate-400 mt-0.5">Approve as half-day session</p>
                </div>
                <button
                  type="button"
                  onClick={() => setApproveForm((prev) => ({ ...prev, is_half_day: !prev.is_half_day }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    approveForm.is_half_day ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      approveForm.is_half_day ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {approveForm.is_half_day && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {[{ value: 'first_half', label: 'First Half' }, { value: 'second_half', label: 'Second Half' }].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setApproveForm((prev) => ({ ...prev, half_day_type: opt.value }))}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                        approveForm.half_day_type === opt.value
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Approval Remarks
              </label>
              <textarea
                rows={3}
                placeholder="Optional approval notes..."
                value={approveForm.remarks}
                onChange={(e) => setApproveForm((prev) => ({ ...prev, remarks: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 outline-none text-sm resize-none"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Modal matching LeaveManagement.jsx */}
      {rejectLeave && (
        <Modal
          isOpen={!!rejectLeave}
          onClose={() => !submitting && setRejectLeave(null)}
          title="Reject Leave Request"
          subtitle={`Reject leave for ${rejectLeave.leave_name || 'Leave'}`}
          icon={<FaTimes className="text-rose-600" />}
          size="sm"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <button
                type="button"
                onClick={() => setRejectLeave(null)}
                disabled={submitting}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={submitting || !rejectRemarks.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-rose-700 hover:to-red-700 transition-all flex items-center gap-2 shadow-lg shadow-rose-200 disabled:opacity-50"
              >
                {submitting ? <FaSpinner className="animate-spin" /> : <FaTimes />}
                {submitting ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="State reason for rejecting this leave..."
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-400 outline-none text-sm resize-none"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
