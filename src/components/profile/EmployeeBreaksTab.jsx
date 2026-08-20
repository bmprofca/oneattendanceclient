import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FaCoffee, FaPlus, FaSpinner, FaEye, FaEdit, FaTimes,
  FaClock, FaCalendarAlt, FaPlay, FaStop, FaUser, FaEnvelope,
  FaPhone, FaCheckCircle, FaSave
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import apiCall from '../../utils/api';
import Modal from '../Modal';
import ModalScrollLock from '../ModalScrollLock';
import TimePickerField from '../TimePicker';
import AdvancedDateFilter from '../AdvancedDateFilter';
import Pagination, { usePagination } from '../PaginationComponent';
import { ManagementTable } from '../common';
import ManagementGrid from '../ManagementGrid';
import ManagementViewSwitcher from '../ManagementViewSwitcher';

const formatTime = (t) => {
  if (!t) return '—';
  if (typeof t === 'object' && t.time) return t.time.slice(0, 5);
  if (typeof t === 'string') return t.slice(0, 5);
  return '—';
};

const getTimeStr = (t) => {
  if (!t) return '';
  if (typeof t === 'object' && t.time) return t.time.slice(0, 5);
  if (typeof t === 'string') return t.slice(0, 5);
  return '';
};

const formatDate = (str) => {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatMins = (m) => {
  if (!m) return '0 min';
  const n = Number(m);
  if (n < 60) return `${n} min`;
  return `${Math.floor(n / 60)}h ${n % 60}m`;
};

const getBreakDurationMins = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  const start = new Date(`1970-01-01T${startTime}`);
  const end = new Date(`1970-01-01T${endTime}`);
  if (isNaN(start) || isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 60000));
};

// ─── Break Detail Modal ────────────────────────────────────────────────────────

const BreakDetailModal = ({ record, onClose, onEdit }) => {
  if (!record) return null;
  const breakStart = record.break_start;
  const breakEnd = record.break_end;
  const startStr = formatTime(breakStart);
  const endStr = formatTime(breakEnd);
  const durationMins = getBreakDurationMins(getTimeStr(breakStart), getTimeStr(breakEnd));

  return (
    <Modal
      isOpen={!!record}
      onClose={onClose}
      title="Break Details"
      subtitle={`Break record for ${formatDate(record.attendance_date)}`}
      icon={<FaCoffee className="text-amber-500" />}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => { onEdit(record); onClose(); }}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-amber-600 hover:to-orange-600 transition-all flex items-center gap-2 shadow-lg shadow-amber-200"
          >
            <FaEdit size={13} /> Edit Break
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <FaCalendarAlt className="text-amber-500" /> Attendance Date
            </p>
            <p className="text-sm font-black text-slate-800">{formatDate(record.attendance_date)}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <FaClock className="text-amber-500" /> Allowed Break
            </p>
            <p className="text-sm font-black text-slate-800">{formatMins(record.allowed_break_minutes || 60)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <FaPlay className="text-emerald-500" size={10} /> Break Start
            </p>
            <p className="text-sm font-black text-emerald-800">{startStr}</p>
            {breakStart?.method && (
              <p className="text-[10px] text-emerald-600/80 mt-1 font-semibold uppercase">Method: {breakStart.method}</p>
            )}
          </div>
          <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <FaStop className="text-rose-500" size={10} /> Break End
            </p>
            <p className="text-sm font-black text-rose-800">{endStr}</p>
            {breakEnd?.method && (
              <p className="text-[10px] text-rose-600/80 mt-1 font-semibold uppercase">Method: {breakEnd.method}</p>
            )}
          </div>
        </div>

        {durationMins > 0 && (
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Duration Used</span>
            <span className="text-base font-black text-amber-800">{formatMins(durationMins)}</span>
          </div>
        )}

        {record.remark && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Remark / Notes</p>
            <p className="text-xs text-slate-700 italic">"{record.remark}"</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ─── Create / Edit Break Form Modal ───────────────────────────────────────────

const BreakFormModal = ({ record, employeeId, onClose, onSuccess, isEdit = false }) => {
  const [breakStart, setBreakStart] = useState(isEdit ? getTimeStr(record?.break_start) : '');
  const [breakEnd, setBreakEnd] = useState(isEdit ? getTimeStr(record?.break_end) : '');
  const [notes, setNotes] = useState(record?.remark || '');
  const [date, setDate] = useState(isEdit ? (record?.attendance_date || '') : new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!breakStart) return toast.error('Break start time is required');
    if (!employeeId) return toast.error('Employee ID is missing');
    if (!date) return toast.error('Date is required');

    setSubmitting(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      const payload = {
        employee_id: employeeId,
        date,
        type: 'break',
        start_time: breakStart,
        end_time: breakEnd || null,
        notes,
      };

      if (isEdit && record?.attendance_id) {
        payload.attendance_id = record.attendance_id;
      }

      const response = await apiCall('/attendance/mark', 'POST', payload, company?.id);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to save break');

      toast.success(result.message || (isEdit ? 'Break updated successfully' : 'Break recorded successfully'));
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to save break');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={() => !submitting && onClose()}
      title={isEdit ? 'Edit Break Record' : 'Add Break Record'}
      subtitle={isEdit ? 'Update start and end times for this break' : 'Record a break for this employee'}
      icon={<FaCoffee className="text-amber-500" />}
      size="md"
      footer={
        <div className="flex gap-2 justify-end w-full">
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
            disabled={submitting || !breakStart || !date}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-amber-600 hover:to-orange-600 transition-all flex items-center gap-2 shadow-lg shadow-amber-200 disabled:opacity-50"
          >
            {submitting ? <FaSpinner className="animate-spin" /> : <FaSave />}
            {submitting ? 'Saving...' : isEdit ? 'Update Break' : 'Save Break'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Break Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={isEdit}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 outline-none text-sm font-semibold disabled:opacity-60"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Break Start <span className="text-rose-500">*</span>
            </label>
            <TimePickerField
              value={breakStart}
              onChange={setBreakStart}
              placeholder="00:00"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Break End (Optional)
            </label>
            <TimePickerField
              value={breakEnd}
              onChange={setBreakEnd}
              placeholder="00:00"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Notes / Remark
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add optional break notes..."
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 outline-none text-sm resize-none"
          />
        </div>
      </form>
    </Modal>
  );
};

// ─── Main Employee Breaks Component ───────────────────────────────────────────

export default function EmployeeBreaksTab({ employeeId, employeeName }) {
  const [breaks, setBreaks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table');
  const [detailBreak, setDetailBreak] = useState(null);
  const [editingBreak, setEditingBreak] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 10);

  const fetchBreaks = useCallback(async (page = pagination.page) => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      const params = new URLSearchParams({
        employee_id: String(employeeId),
        type: 'break',
        page: String(page),
        limit: String(pagination.limit),
      });

      const response = await apiCall(`/attendance/list?${params.toString()}`, 'GET', null, company?.id);
      const result = await response.json();

      if (result.success) {
        setBreaks(result.data || []);
        updatePagination({
          page: result.meta?.page || page,
          limit: result.meta?.limit || pagination.limit,
          total: result.meta?.total || (result.data ? result.data.length : 0),
          total_pages: result.meta?.total_pages || 1,
          is_last_page: page >= (result.meta?.total_pages || 1),
        });
      } else {
        setBreaks([]);
      }
    } catch {
      setBreaks([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, pagination.limit, pagination.page, updatePagination]);

  useEffect(() => {
    fetchBreaks(pagination.page);
  }, [employeeId, pagination.page, pagination.limit, fetchBreaks]);

  const columns = [
    {
      key: 'date',
      label: 'Date',
      render: (b) => <span className="font-semibold text-slate-800 text-sm">{formatDate(b.attendance_date)}</span>,
    },
    {
      key: 'start',
      label: 'Break Start',
      render: (b) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-xs">
          <FaPlay size={8} /> {formatTime(b.break_start)}
        </span>
      ),
    },
    {
      key: 'end',
      label: 'Break End',
      render: (b) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 font-bold text-xs">
          <FaStop size={8} /> {formatTime(b.break_end)}
        </span>
      ),
    },
    {
      key: 'duration',
      label: 'Duration',
      render: (b) => {
        const mins = getBreakDurationMins(getTimeStr(b.break_start), getTimeStr(b.break_end));
        return <span className="font-mono text-xs font-bold text-amber-700">{formatMins(mins)}</span>;
      },
    },
    {
      key: 'remark',
      label: 'Remark',
      render: (b) => <span className="text-xs text-slate-500 truncate max-w-[180px]">{b.remark || '—'}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex p-2 bg-white rounded-xl shadow-sm border border-gray-100 items-center justify-between">
        <p className="text-md text-amber-700 px-3 font-semibold flex items-center gap-2">
          <FaCoffee size={14} /> Break History & Management
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-amber-200 hover:from-amber-600 hover:to-orange-600 transition-all"
          >
            <FaPlus size={10} /> Add Break
          </button>
          {breaks.length > 0 && (
            <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="amber" />
          )}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center py-12 gap-2 text-slate-400">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-xs font-medium">Loading breaks…</span>
        </div>
      )}

      {!loading && breaks.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-100">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-400">
            <FaCoffee size={22} />
          </div>
          <p className="text-slate-700 font-bold text-sm">No breaks recorded</p>
          <p className="text-slate-400 text-xs mt-1">This employee has no break records yet.</p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all border border-amber-200"
          >
            <FaPlus size={10} /> Record First Break
          </button>
        </div>
      )}

      {!loading && breaks.length > 0 && viewMode === 'table' && (
        <ManagementTable
          rows={breaks}
          columns={columns}
          rowKey={(r, i) => r.attendance_id || r.id || i}
          onRowClick={(r) => setDetailBreak(r)}
          getActions={(r) => [
            { label: 'View Details', icon: <FaEye size={12} />, onClick: () => setDetailBreak(r), className: 'text-blue-600 hover:bg-blue-50' },
            { label: 'Edit Break', icon: <FaEdit size={12} />, onClick: () => setEditingBreak(r), className: 'text-amber-600 hover:bg-amber-50' },
          ]}
          accent="amber"
        />
      )}

      {!loading && breaks.length > 0 && viewMode === 'card' && (
        <ManagementGrid viewMode={viewMode}>
          {breaks.map((b, idx) => {
            const mins = getBreakDurationMins(getTimeStr(b.break_start), getTimeStr(b.break_end));
            return (
              <motion.div
                key={b.attendance_id || b.id || idx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                onClick={() => setDetailBreak(b)}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-bold text-sm text-slate-800">{formatDate(b.attendance_date)}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      {formatMins(mins)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                      <span className="text-[9px] uppercase font-bold block opacity-70">Start</span>
                      <span className="font-bold">{formatTime(b.break_start)}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
                      <span className="text-[9px] uppercase font-bold block opacity-70">End</span>
                      <span className="font-bold">{formatTime(b.break_end)}</span>
                    </div>
                  </div>
                  {b.remark && <p className="text-xs text-slate-500 italic line-clamp-1">"{b.remark}"</p>}
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditingBreak(b); }}
                    className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg text-xs font-bold"
                    title="Edit Break"
                  >
                    <FaEdit size={13} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </ManagementGrid>
      )}

      {!loading && breaks.length > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={goToPage}
          onLimitChange={changeLimit}
          showInfo
        />
      )}

      {/* Detail Modal */}
      {detailBreak && (
        <BreakDetailModal
          record={detailBreak}
          onClose={() => setDetailBreak(null)}
          onEdit={(b) => setEditingBreak(b)}
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <BreakFormModal
          employeeId={employeeId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => fetchBreaks(1)}
        />
      )}

      {/* Edit Modal */}
      {editingBreak && (
        <BreakFormModal
          record={editingBreak}
          employeeId={employeeId}
          isEdit={true}
          onClose={() => setEditingBreak(null)}
          onSuccess={() => fetchBreaks(pagination.page)}
        />
      )}
    </div>
  );
}
