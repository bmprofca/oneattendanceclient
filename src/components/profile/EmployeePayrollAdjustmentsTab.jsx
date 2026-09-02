import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FaPlus, FaSpinner, FaCalendarAlt, FaCalculator,
  FaMoneyBillWave, FaCoins, FaEdit, FaEye, FaTrash,
  FaCheckSquare, FaSave, FaExclamationTriangle, FaInfoCircle
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import apiCall from '../../utils/api';
import Modal from '../Modal';
import SelectField from '../SelectField';
import Pagination, { usePagination } from '../PaginationComponent';
import { ManagementTable } from '../common';
import ManagementGrid from '../ManagementGrid';
import ManagementViewSwitcher from '../ManagementViewSwitcher';

const inFlightRequests = new Map();
function runDedupedRequest(key, requestFn) {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const promise = requestFn().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);
  return promise;
}

const ADJUSTMENT_TYPES = [
  { value: 'bonus', label: 'Bonus' },
  { value: 'fine', label: 'Fine / Penalty' },
  { value: 'reimbursement', label: 'Reimbursement' },
  { value: 'advance_deduction', label: 'Advance Deduction' },
  { value: 'other_addition', label: 'Other Addition' },
  { value: 'other_deduction', label: 'Other Deduction' },
];

const isAddition = (type) => ['bonus', 'reimbursement', 'other_addition'].includes(type);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function EmployeePayrollAdjustmentsTab({ employeeId, employeeName, refreshKey = 0 }) {
  const currentDate = new Date();
  const [adjustments, setAdjustments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table');
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [adjustmentType, setAdjustmentType] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState(null);
  const [detailAdjustment, setDetailAdjustment] = useState(null);
  const [deleteConfirmState, setDeleteConfirmState] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    adjustment_type: 'bonus',
    usage_type: 'payroll',
    name: '',
    remark: '',
    amount: '',
    adjustment_period: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`,
  });

  const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 10);

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2026, i, 1).toLocaleString('en-US', { month: 'long' }) })),
    []
  );
  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({ value: new Date().getFullYear() - 2 + i, label: String(new Date().getFullYear() - 2 + i) })),
    []
  );

  const fetchAdjustments = useCallback(async (page = 1) => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      const requestKey = `payroll-adjustments:${employeeId}:${selectedMonth}:${selectedYear}:${adjustmentType || 'all'}:${page}:${pagination.limit}`;

      const { res, json } = await runDedupedRequest(requestKey, async () => {
        const params = new URLSearchParams({
          employee_id: String(employeeId),
          page: String(page),
          limit: String(pagination.limit),
          month: String(selectedMonth),
          year: String(selectedYear),
        });
        if (adjustmentType) params.append('adjustment_type', adjustmentType);

        const response = await apiCall(`/payroll/adjustments/list?${params.toString()}`, 'GET', null, company?.id);
        const data = await response.json();
        return { res: response, json: data };
      });

      if (!res.ok || !json.success) {
        setAdjustments([]);
        setSummary(null);
        return;
      }

      setAdjustments(json.data || []);
      setSummary(json.meta?.summary || null);
      updatePagination({
        page: json.meta?.page || page,
        limit: json.meta?.limit || pagination.limit,
        total: json.meta?.total || (json.data ? json.data.length : 0),
        total_pages: json.meta?.total_pages || 1,
        is_last_page: page >= (json.meta?.total_pages || 1),
      });
    } catch {
      setAdjustments([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId, selectedMonth, selectedYear, adjustmentType, pagination.limit, updatePagination]);

  useEffect(() => {
    if (!employeeId) return;
    fetchAdjustments(1);
  }, [employeeId, refreshKey, selectedMonth, selectedYear, adjustmentType, pagination.limit, fetchAdjustments]);

  const openCreateModal = () => {
    setEditingAdjustment(null);
    setFormData({
      adjustment_type: 'bonus',
      usage_type: 'payroll',
      name: '',
      remark: '',
      amount: '',
      adjustment_period: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (adj) => {
    setEditingAdjustment(adj);
    setFormData({
      adjustment_type: adj.adjustment_type || 'bonus',
      usage_type: adj.usage_type || 'payroll',
      name: adj.name || '',
      remark: adj.remark || '',
      amount: adj.amount ? parseFloat(adj.amount).toString() : '',
      adjustment_period: adj.adjustment_period ? adj.adjustment_period.split('T')[0] : `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!formData.name || !formData.amount || !formData.adjustment_period) {
      toast.warning('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      let response;
      if (editingAdjustment) {
        response = await apiCall(
          '/payroll/adjustments/update',
          'PUT',
          {
            id: editingAdjustment.id,
            adjustment_type: formData.adjustment_type,
            usage_type: formData.usage_type,
            name: formData.name,
            remark: formData.remark,
            amount: parseFloat(formData.amount),
            adjustment_period: formData.adjustment_period,
          },
          company?.id
        );
      } else {
        response = await apiCall(
          '/payroll/adjustments',
          'POST',
          {
            employee_id: parseInt(employeeId),
            adjustment_type: formData.adjustment_type,
            usage_type: formData.usage_type,
            name: formData.name,
            remark: formData.remark,
            amount: parseFloat(formData.amount),
            adjustment_period: formData.adjustment_period,
          },
          company?.id
        );
      }

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Operation failed');

      toast.success(editingAdjustment ? 'Adjustment updated successfully' : 'Adjustment added successfully');
      setIsModalOpen(false);
      fetchAdjustments(pagination.page);
    } catch (error) {
      toast.error(error.message || 'Failed to save adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmState) return;
    setDeleting(true);
    try {
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      const response = await apiCall('/payroll/adjustments/delete', 'DELETE', { id: deleteConfirmState.id }, company?.id);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to delete adjustment');

      toast.success('Adjustment deleted successfully');
      setDeleteConfirmState(null);
      fetchAdjustments(pagination.page);
    } catch (error) {
      toast.error(error.message || 'Failed to delete adjustment');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Adjustment',
      render: (a) => (
        <div>
          <span className="font-semibold text-slate-800 text-sm">{a.name}</span>
          {a.remark && <p className="text-[10px] text-slate-400 italic line-clamp-1">"{a.remark}"</p>}
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (a) => {
        const add = isAddition(a.adjustment_type);
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
              add
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {a.adjustment_type ? a.adjustment_type.replace(/_/g, ' ').toUpperCase() : 'ADJUSTMENT'}
          </span>
        );
      },
    },
    {
      key: 'period',
      label: 'Period',
      render: (a) => <span className="text-xs text-slate-600 font-medium">{fmtDate(a.adjustment_period)}</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (a) => {
        const add = isAddition(a.adjustment_type);
        return (
          <span className={`font-black text-sm ${add ? 'text-emerald-600' : 'text-rose-600'}`}>
            {add ? '+' : '-'}₹{Number(a.amount || 0).toLocaleString()}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (a) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            a.status === 'applied'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
              : 'bg-amber-50 text-amber-700 border border-amber-100'
          }`}
        >
          {a.status || 'pending'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Adjustments</p>
            <p className="text-xl font-black text-slate-800 mt-0.5">{summary?.total_count || adjustments.length}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <FaCalculator size={16} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Total Additions</p>
            <p className="text-xl font-black text-emerald-600 mt-0.5">
              +₹{Number(summary?.total_additions || adjustments.filter(a => isAddition(a.adjustment_type)).reduce((acc, a) => acc + Number(a.amount || 0), 0)).toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FaCoins size={16} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Total Deductions</p>
            <p className="text-xl font-black text-rose-600 mt-0.5">
              -₹{Number(summary?.total_deductions || adjustments.filter(a => !isAddition(a.adjustment_type)).reduce((acc, a) => acc + Number(a.amount || 0), 0)).toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <FaMoneyBillWave size={16} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Net Adjustment</p>
            <p className="text-xl font-black text-indigo-600 mt-0.5">
              ₹{Number(summary?.net_amount || (
                adjustments.filter(a => isAddition(a.adjustment_type)).reduce((acc, a) => acc + Number(a.amount || 0), 0) -
                adjustments.filter(a => !isAddition(a.adjustment_type)).reduce((acc, a) => acc + Number(a.amount || 0), 0)
              )).toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <FaCoins size={16} />
          </div>
        </div>
      </div>

      {/* Filter and View switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="w-[130px]">
            <SelectField
              options={monthOptions}
              value={monthOptions.find((m) => m.value === selectedMonth) || null}
              onChange={(opt) => setSelectedMonth(Number(opt?.value || 1))}
            />
          </div>
          <div className="w-[105px]">
            <SelectField
              options={yearOptions}
              value={yearOptions.find((y) => y.value === selectedYear) || null}
              onChange={(opt) => setSelectedYear(Number(opt?.value || new Date().getFullYear()))}
            />
          </div>
          <div className="w-[140px]">
            <SelectField
              options={[{ value: '', label: 'All Types' }, ...ADJUSTMENT_TYPES]}
              value={ADJUSTMENT_TYPES.find((t) => t.value === adjustmentType) || { value: '', label: 'All Types' }}
              onChange={(opt) => setAdjustmentType(opt?.value || '')}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-200 hover:from-indigo-700 hover:to-violet-700 transition-all"
          >
            <FaPlus size={10} /> Add Adjustment
          </button>
          {adjustments.length > 0 && (
            <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="indigo" />
          )}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center py-12 gap-2 text-slate-400">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-xs font-medium">Loading adjustments…</span>
        </div>
      )}

      {!loading && adjustments.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-100">
          <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-400">
            <FaCalculator size={22} />
          </div>
          <p className="text-slate-700 font-bold text-sm">No adjustments found</p>
          <p className="text-slate-400 text-xs mt-1">No adjustments recorded for this period.</p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all border border-indigo-200"
          >
            <FaPlus size={10} /> Add First Adjustment
          </button>
        </div>
      )}

      {!loading && adjustments.length > 0 && viewMode === 'table' && (
        <ManagementTable
          rows={adjustments}
          columns={columns}
          rowKey={(r) => r.id}
          onRowClick={(r) => setDetailAdjustment(r)}
          getActions={(r) => [
            { label: 'View Details', icon: <FaEye size={12} />, onClick: () => setDetailAdjustment(r), className: 'text-blue-600 hover:bg-blue-50' },
            { label: 'Edit', icon: <FaEdit size={12} />, onClick: () => openEditModal(r), className: 'text-indigo-600 hover:bg-indigo-50' },
            { label: 'Delete', icon: <FaTrash size={12} />, onClick: () => setDeleteConfirmState(r), className: 'text-rose-600 hover:bg-rose-50' },
          ]}
          accent="indigo"
        />
      )}

      {!loading && adjustments.length > 0 && viewMode === 'card' && (
        <ManagementGrid viewMode={viewMode}>
          {adjustments.map((adj) => {
            const add = isAddition(adj.adjustment_type);
            return (
              <motion.div
                key={adj.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                onClick={() => setDetailAdjustment(adj)}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-sm text-slate-800 truncate">{adj.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        add ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {add ? '+' : '-'}₹{Number(adj.amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mb-2">{fmtDate(adj.adjustment_period)}</p>
                  {adj.remark && <p className="text-xs text-slate-500 italic line-clamp-2">"{adj.remark}"</p>}
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center mt-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400">{adj.adjustment_type?.replace(/_/g, ' ')}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEditModal(adj); }}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs"
                      title="Edit"
                    >
                      <FaEdit size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmState(adj); }}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs"
                      title="Delete"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </ManagementGrid>
      )}

      {!loading && adjustments.length > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={goToPage}
          onLimitChange={changeLimit}
          showInfo
        />
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => !submitting && setIsModalOpen(false)}
          title={editingAdjustment ? 'Edit Payroll Adjustment' : 'Add Payroll Adjustment'}
          subtitle={editingAdjustment ? 'Update adjustment entry' : 'Add a bonus, fine, or allowance for this employee'}
          icon={<FaCoins className="text-indigo-600" />}
          size="md"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !formData.name || !formData.amount}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-indigo-700 hover:to-violet-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-50"
              >
                {submitting ? <FaSpinner className="animate-spin" /> : <FaSave />}
                {submitting ? 'Saving...' : editingAdjustment ? 'Update' : 'Save Adjustment'}
              </button>
            </div>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Adjustment Type <span className="text-rose-500">*</span>
              </label>
              <SelectField
                options={ADJUSTMENT_TYPES}
                value={ADJUSTMENT_TYPES.find((t) => t.value === formData.adjustment_type) || ADJUSTMENT_TYPES[0]}
                onChange={(opt) => setFormData((prev) => ({ ...prev, adjustment_type: opt?.value || 'bonus' }))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Adjustment Title / Reason <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Monthly Performance Bonus or Late Fine"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none text-sm font-semibold text-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none text-sm font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Adjustment Period <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.adjustment_period}
                  onChange={(e) => setFormData((prev) => ({ ...prev, adjustment_period: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none text-sm font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Remarks / Notes
              </label>
              <textarea
                rows={3}
                placeholder="Optional internal remarks..."
                value={formData.remark}
                onChange={(e) => setFormData((prev) => ({ ...prev, remark: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none text-sm resize-none"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Detail Modal */}
      {detailAdjustment && (
        <Modal
          isOpen={!!detailAdjustment}
          onClose={() => setDetailAdjustment(null)}
          title="Adjustment Details"
          subtitle={detailAdjustment.name}
          icon={<FaEye className="text-indigo-600" />}
          size="md"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <button
                type="button"
                onClick={() => setDetailAdjustment(null)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Type</p>
                <p className="text-sm font-bold capitalize text-slate-700">{detailAdjustment.adjustment_type?.replace(/_/g, ' ')}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Amount</p>
                <p className={`text-base font-black ${isAddition(detailAdjustment.adjustment_type) ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isAddition(detailAdjustment.adjustment_type) ? '+' : '-'}₹{Number(detailAdjustment.amount || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Period</p>
              <p className="text-sm font-semibold text-slate-700">{fmtDate(detailAdjustment.adjustment_period)}</p>
            </div>
            {detailAdjustment.remark && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Remarks</p>
                <p className="text-xs text-slate-700 italic">"{detailAdjustment.remark}"</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmState && (
        <Modal
          isOpen={!!deleteConfirmState}
          onClose={() => !deleting && setDeleteConfirmState(null)}
          title="Delete Adjustment"
          subtitle="Are you sure you want to remove this adjustment entry?"
          icon={<FaTrash className="text-rose-600" />}
          size="sm"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <button
                type="button"
                onClick={() => setDeleteConfirmState(null)}
                disabled={deleting}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-rose-700 hover:to-red-700 transition-all flex items-center gap-2 shadow-lg shadow-rose-200 disabled:opacity-50"
              >
                {deleting ? <FaSpinner className="animate-spin" /> : <FaTrash />}
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          }
        >
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl">
            <p className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-1">Warning</p>
            <p className="text-xs text-rose-600">
              Permanently delete adjustment <strong>{deleteConfirmState.name}</strong> of amount{' '}
              <strong>₹{Number(deleteConfirmState.amount || 0).toLocaleString()}</strong>.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
