import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FaPlus, FaEdit, FaTrash, FaEye, FaSpinner,
  FaCalendarAlt, FaIdCard, FaSave, FaTimes, FaCheck,
  FaUmbrellaBeach, FaCoins
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import apiCall from '../../utils/api';
import Modal from '../Modal';
import ModalScrollLock from '../ModalScrollLock';
import SelectField from '../SelectField';
import Pagination, { usePagination } from '../PaginationComponent';
import { ManagementTable } from '../common';
import ManagementGrid from '../ManagementGrid';
import ManagementViewSwitcher from '../ManagementViewSwitcher';
import CurrencyIcon from '../common/CurrencyIcon';

const formatDays = (value) => {
  const numericValue = Number.parseFloat(value ?? 0);
  if (!Number.isFinite(numericValue)) return '0';
  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(1);
};

const getRemainingPercentage = (remaining, total) => {
  const remainingNum = Number.parseFloat(remaining ?? 0);
  const totalNum = Number.parseFloat(total ?? 0);
  if (!Number.isFinite(remainingNum) || !Number.isFinite(totalNum) || totalNum <= 0) return 0;
  return Math.min(100, (remainingNum / totalNum) * 100);
};

const isLowBalance = (remaining) => Number.parseFloat(remaining ?? 0) <= 1;

const PaidBadge = ({ isPaid, compact = false }) => (
  isPaid ? (
    <span className={`inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 text-emerald-700 ${compact ? 'px-2 py-0.5 text-[10px] font-bold' : 'px-2.5 py-1 text-xs font-semibold'}`}>
      <CurrencyIcon className="text-emerald-500" size={10} /> PAID
    </span>
  ) : (
    <span className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 text-slate-500 ${compact ? 'px-2 py-0.5 text-[10px] font-bold' : 'px-2.5 py-1 text-xs font-semibold'}`}>
      UNPAID
    </span>
  )
);

export default function EmployeeLeaveBalancesTab({ employeeId, employeeName }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('card');
  const [viewModal, setViewModal] = useState(null);

  // Assign/Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('assign'); // 'assign' | 'edit' | 'delete'
  const [saving, setSaving] = useState(false);
  const [availableConfigs, setAvailableConfigs] = useState([]);
  const [configsLoading, setConfigsLoading] = useState(false);

  const [formData, setFormData] = useState({
    delete_leave_config_ids: [],
    leaves: [{ leave_config_id: '', total_allocated: '' }],
  });

  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({ value: currentYear - 2 + i, label: String(currentYear - 2 + i) })),
    [currentYear]
  );

  const fetchBalances = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      const response = await apiCall(`/leave/employee/${employeeId}?year=${selectedYear}`, 'GET', null, company?.id);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        const mapped = result.data.map((c) => ({
          id: c.leave_config_id || c.id,
          leave_config_id: c.leave_config_id || c.id,
          code: c.code,
          name: c.name,
          is_paid: c.is_paid,
          allow_half_day: c.allow_half_day,
          max_balance: Number(c.max_balance || 0),
          allocated: Boolean(c.allocated),
          used: c.balance ? Number(c.balance.used || 0) : 0,
          total_allocated: c.balance ? Number(c.balance.total_allocated || 0) : 0,
          remaining: c.balance ? Number(c.balance.remaining || 0) : 0,
        }));
        setLeaves(mapped);
      } else {
        setLeaves([]);
      }
    } catch {
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, selectedYear]);

  useEffect(() => {
    fetchBalances();
  }, [employeeId, selectedYear, fetchBalances]);

  const loadAvailableConfigs = useCallback(async () => {
    if (!employeeId) return;
    setConfigsLoading(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      const response = await apiCall(`/leave/employee/${employeeId}?year=${selectedYear}`, 'GET', null, company?.id);
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setAvailableConfigs(
          result.data.map((c) => ({
            id: c.leave_config_id || c.id,
            leave_config_id: c.leave_config_id || c.id,
            code: c.code,
            name: c.name,
            is_paid: c.is_paid,
            max_balance: Number(c.max_balance || 0),
            allocated: Boolean(c.allocated),
            used: c.balance ? Number(c.balance.used || 0) : 0,
            total_allocated: c.balance ? Number(c.balance.total_allocated || 0) : 0,
          }))
        );
      }
    } catch {
      setAvailableConfigs([]);
    } finally {
      setConfigsLoading(false);
    }
  }, [employeeId, selectedYear]);

  const openAssignModal = () => {
    setModalMode('assign');
    setFormData({
      delete_leave_config_ids: [],
      leaves: [{ leave_config_id: '', total_allocated: '' }],
    });
    loadAvailableConfigs();
    setShowModal(true);
  };

  const openEditModal = () => {
    setModalMode('edit');
    const allocatedLeaves = leaves.filter((l) => l.allocated);
    setFormData({
      delete_leave_config_ids: [],
      leaves: allocatedLeaves.map((l) => ({
        leave_config_id: l.leave_config_id,
        total_allocated: String(l.total_allocated),
      })),
    });
    setAvailableConfigs(allocatedLeaves);
    setShowModal(true);
  };

  const openDeleteModal = () => {
    setModalMode('delete');
    setFormData({
      delete_leave_config_ids: [],
      leaves: [],
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      let response;
      if (modalMode === 'assign' || modalMode === 'edit') {
        const payload = {
          employee_id: Number(employeeId),
          leaves: formData.leaves
            .filter((l) => l.leave_config_id && l.total_allocated !== '')
            .map((l) => ({
              leave_config_id: l.leave_config_id,
              total_allocated: Number(l.total_allocated) || 0,
            })),
        };
        response = await apiCall('/leave/upsert-balance', 'PUT', payload, company?.id);
      } else if (modalMode === 'delete') {
        const payload = {
          employee_id: Number(employeeId),
          leave_config_ids: formData.delete_leave_config_ids,
        };
        response = await apiCall('/leave/delete-balance', 'DELETE', payload, company?.id);
      }

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Operation failed');

      toast.success(result.message || 'Leave balances updated successfully');
      setShowModal(false);
      fetchBalances();
    } catch (error) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const allocatedList = useMemo(() => leaves.filter((l) => l.allocated), [leaves]);
  const totalAllocated = useMemo(() => allocatedList.reduce((acc, l) => acc + (l.total_allocated || 0), 0), [allocatedList]);
  const totalUsed = useMemo(() => allocatedList.reduce((acc, l) => acc + (l.used || 0), 0), [allocatedList]);
  const totalRemaining = useMemo(() => allocatedList.reduce((acc, l) => acc + (l.remaining || 0), 0), [allocatedList]);

  const columns = [
    {
      key: 'leave_type',
      label: 'Leave Type',
      render: (l) => (
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-bold font-mono">
            {l.code}
          </span>
          <span className="font-bold text-slate-800 text-sm">{l.name}</span>
          <PaidBadge isPaid={l.is_paid} compact />
        </div>
      ),
    },
    {
      key: 'allocated',
      label: 'Allocated',
      render: (l) => <span className="font-bold text-slate-700 text-sm">{formatDays(l.total_allocated)} days</span>,
    },
    {
      key: 'used',
      label: 'Used',
      render: (l) => <span className="font-bold text-amber-600 text-sm">{formatDays(l.used)} days</span>,
    },
    {
      key: 'remaining',
      label: 'Remaining',
      render: (l) => (
        <span className={`font-black text-sm ${isLowBalance(l.remaining) ? 'text-rose-600' : 'text-emerald-600'}`}>
          {formatDays(l.remaining)} days
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Types</p>
            <p className="text-xl font-black text-slate-800 mt-0.5">{allocatedList.length}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <FaUmbrellaBeach size={16} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Total Quota</p>
            <p className="text-xl font-black text-blue-600 mt-0.5">{formatDays(totalAllocated)} d</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <FaCalendarAlt size={16} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Total Used</p>
            <p className="text-xl font-black text-amber-600 mt-0.5">{formatDays(totalUsed)} d</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <FaCalendarAlt size={16} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Total Remaining</p>
            <p className="text-xl font-black text-emerald-600 mt-0.5">{formatDays(totalRemaining)} d</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FaCheck size={16} />
          </div>
        </div>
      </div>

      {/* Filter and Actions bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="w-[120px]">
          <SelectField
            options={yearOptions}
            value={yearOptions.find((y) => y.value === selectedYear) || yearOptions[2]}
            onChange={(opt) => setSelectedYear(Number(opt?.value || currentYear))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end w-full sm:w-auto">
          <button
            type="button"
            onClick={openAssignModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-violet-200 hover:from-violet-700 hover:to-indigo-700 transition-all"
          >
            <FaPlus size={10} /> Assign Balance
          </button>
          {allocatedList.length > 0 && (
            <>
              <button
                type="button"
                onClick={openEditModal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
              >
                <FaEdit size={11} /> Edit Quotas
              </button>
              <button
                type="button"
                onClick={openDeleteModal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-all"
              >
                <FaTrash size={10} /> Delete
              </button>
            </>
          )}
          {allocatedList.length > 0 && (
            <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="violet" />
          )}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center py-12 gap-2 text-slate-400">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-xs font-medium">Loading balances…</span>
        </div>
      )}

      {!loading && allocatedList.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-100">
          <div className="w-14 h-14 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-3 text-violet-400">
            <FaUmbrellaBeach size={22} />
          </div>
          <p className="text-slate-700 font-bold text-sm">No leave balances assigned</p>
          <p className="text-slate-400 text-xs mt-1">This employee has no leave quotas configured for {selectedYear}.</p>
          <button
            type="button"
            onClick={openAssignModal}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-violet-50 text-violet-700 rounded-xl text-xs font-bold hover:bg-violet-100 transition-all border border-violet-200"
          >
            <FaPlus size={10} /> Assign Leave Quota
          </button>
        </div>
      )}

      {!loading && allocatedList.length > 0 && viewMode === 'table' && (
        <ManagementTable
          rows={allocatedList}
          columns={columns}
          rowKey={(r) => r.id}
          onRowClick={(r) => setViewModal(r)}
          getActions={(r) => [
            { label: 'View Details', icon: <FaEye size={12} />, onClick: () => setViewModal(r), className: 'text-blue-600 hover:bg-blue-50' },
          ]}
          accent="violet"
        />
      )}

      {!loading && allocatedList.length > 0 && viewMode === 'card' && (
        <ManagementGrid viewMode={viewMode}>
          {allocatedList.map((leave) => {
            const pct = getRemainingPercentage(leave.remaining, leave.total_allocated);
            return (
              <motion.div
                key={leave.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                onClick={() => setViewModal(leave)}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-bold font-mono">
                        {leave.code}
                      </span>
                      <h4 className="font-bold text-slate-800 text-sm">{leave.name}</h4>
                    </div>
                    <PaidBadge isPaid={leave.is_paid} compact />
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-slate-50 p-2.5 rounded-xl text-center">
                      <p className="text-[9px] font-bold uppercase text-slate-400">Total</p>
                      <p className="text-xs font-bold text-slate-700">{formatDays(leave.total_allocated)}d</p>
                    </div>
                    <div className="bg-amber-50 p-2.5 rounded-xl text-center">
                      <p className="text-[9px] font-bold uppercase text-amber-500">Used</p>
                      <p className="text-xs font-bold text-amber-700">{formatDays(leave.used)}d</p>
                    </div>
                    <div className="bg-emerald-50 p-2.5 rounded-xl text-center">
                      <p className="text-[9px] font-bold uppercase text-emerald-500">Remaining</p>
                      <p className={`text-xs font-black ${isLowBalance(leave.remaining) ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {formatDays(leave.remaining)}d
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isLowBalance(leave.remaining) ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[9px] font-black text-slate-400 text-right uppercase">{pct.toFixed(0)}% Left</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </ManagementGrid>
      )}

      {/* View Modal */}
      {viewModal && (
        <Modal
          isOpen={!!viewModal}
          onClose={() => setViewModal(null)}
          title={viewModal.name}
          subtitle={`${viewModal.code} · ${selectedYear} Balance Details`}
          icon={<FaUmbrellaBeach className="text-violet-600" />}
          size="md"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <button
                type="button"
                onClick={() => setViewModal(null)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-violet-100 text-violet-800 rounded-lg text-xs font-bold font-mono">
                {viewModal.code}
              </span>
              <PaidBadge isPaid={viewModal.is_paid} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Allocated</p>
                <p className="text-lg font-black text-slate-800">{formatDays(viewModal.total_allocated)}d</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-center">
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Used</p>
                <p className="text-lg font-black text-amber-700">{formatDays(viewModal.used)}d</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Remaining</p>
                <p className={`text-lg font-black ${isLowBalance(viewModal.remaining) ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {formatDays(viewModal.remaining)}d
                </p>
              </div>
            </div>

            {viewModal.max_balance > 0 && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Max Allowed Quota</span>
                <span className="text-sm font-black text-slate-700">{viewModal.max_balance} days</span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Assign / Edit / Delete Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => !saving && setShowModal(false)}
          title={
            modalMode === 'delete'
              ? 'Delete Leave Balances'
              : modalMode === 'edit'
              ? 'Edit Leave Balances'
              : 'Assign Leave Balances'
          }
          subtitle={`Configure leave quotas for ${selectedYear}`}
          icon={modalMode === 'delete' ? <FaTrash className="text-rose-600" /> : <FaUmbrellaBeach className="text-violet-600" />}
          size={modalMode === 'delete' ? 'md' : 'lg'}
          footer={
            <div className="flex gap-2 justify-end w-full">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  saving ||
                  (modalMode === 'delete' && formData.delete_leave_config_ids.length === 0)
                }
                className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest text-white shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 ${
                  modalMode === 'delete'
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 shadow-rose-200 hover:from-red-700 hover:to-rose-700'
                    : 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-violet-200 hover:from-violet-700 hover:to-indigo-700'
                }`}
              >
                {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                {saving ? 'Saving...' : modalMode === 'delete' ? 'Delete Selected' : 'Save Balances'}
              </button>
            </div>
          }
        >
          {modalMode === 'delete' ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Select unused leave types to remove. Leave types with used days cannot be removed.
              </p>
              <div className="space-y-2">
                {allocatedList.map((leave) => {
                  const isUsed = Number(leave.used || 0) > 0;
                  const isChecked = formData.delete_leave_config_ids.includes(leave.leave_config_id);
                  return (
                    <label
                      key={leave.leave_config_id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={isUsed}
                        checked={isChecked}
                        onChange={() => {
                          setFormData((prev) => ({
                            ...prev,
                            delete_leave_config_ids: isChecked
                              ? prev.delete_leave_config_ids.filter((id) => id !== leave.leave_config_id)
                              : [...prev.delete_leave_config_ids, leave.leave_config_id],
                          }));
                        }}
                        className="rounded border-gray-300 text-rose-600"
                      />
                      <div className="flex-1">
                        <span className="font-bold text-slate-800 text-sm">{leave.name}</span>
                        <span className="text-xs text-slate-400 ml-2 font-mono">({leave.code})</span>
                        {isUsed && <p className="text-[10px] text-rose-600 font-bold mt-0.5">Cannot delete - already used {leave.used} days</p>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {modalMode === 'assign' ? 'Allocate Leave Types' : 'Adjust Quotas'}
                </label>
                {modalMode === 'assign' && (
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        leaves: [...prev.leaves, { leave_config_id: '', total_allocated: '' }],
                      }))
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700"
                  >
                    <FaPlus size={9} /> Add Row
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {formData.leaves.map((row, idx) => {
                  const selectedConfig = availableConfigs.find((c) => String(c.id) === String(row.leave_config_id));
                  return (
                    <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                        <div className="sm:col-span-7">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Leave Type
                          </label>
                          <SelectField
                            options={availableConfigs.map((c) => ({
                              value: c.id,
                              label: `${c.name} (${c.code}) - Max ${c.max_balance || 'Unlimited'}d`,
                            }))}
                            value={
                              selectedConfig
                                ? {
                                    value: selectedConfig.id,
                                    label: `${selectedConfig.name} (${selectedConfig.code})`,
                                  }
                                : null
                            }
                            onChange={(opt) => {
                              const updated = [...formData.leaves];
                              updated[idx].leave_config_id = opt?.value || '';
                              setFormData((prev) => ({ ...prev, leaves: updated }));
                            }}
                            disabled={modalMode === 'edit'}
                            placeholder="Select leave type..."
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Days Allocated
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="e.g. 12"
                            value={row.total_allocated}
                            onChange={(e) => {
                              const updated = [...formData.leaves];
                              updated[idx].total_allocated = e.target.value;
                              setFormData((prev) => ({ ...prev, leaves: updated }));
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 outline-none text-sm font-bold text-slate-800"
                          />
                        </div>
                        {modalMode === 'assign' && formData.leaves.length > 1 && (
                          <div className="sm:col-span-1 flex justify-end pt-5">
                            <button
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  leaves: prev.leaves.filter((_, i) => i !== idx),
                                }));
                              }}
                              className="p-2 text-rose-400 hover:text-rose-600 rounded-lg"
                            >
                              <FaTimes size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
