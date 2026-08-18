import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    FaPlus, FaSpinner, FaCalendarAlt, FaCalculator,
    FaMoneyBillWave, FaCoins, FaEdit, FaEye, FaTrash,
    FaCheckSquare, FaRegSquare
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import apiCall from '../utils/api';
import SkeletonComponent from '../components/SkeletonComponent';
import Pagination, { usePagination } from '../components/PaginationComponent';
import Modal from '../components/Modal';
import usePermissionAccess from '../hooks/usePermissionAccess';
import { EmployeeSelect, ManagementCard, ManagementTable, ManagementHub, ManagementButton } from '../components/common';
import ProfileAvatar from '../components/common/ProfileAvatar';
import SelectField from '../components/SelectField';
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import AdvancedDateFilter from '../components/AdvancedDateFilter';
import useEmployeeNavigation from '../hooks/useEmployeeNavigation';

export default function PayrollAdjustment() {
    const navigateToEmployeeProfile = useEmployeeNavigation();
    const { checkActionAccess, getAccessMessage } = usePermissionAccess();
    const createAccess = checkActionAccess('payrollAdjustment', 'create');
    const updateAccess = checkActionAccess('payrollAdjustment', 'update');
    const deleteAccess = checkActionAccess('payrollAdjustment', 'delete');

    const [adjustments, setAdjustments] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('table');

    // Filters
    const currentDate = new Date();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
    const [adjustmentType, setAdjustmentType] = useState('');

    const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 20);

    const isMounted = useRef(true);
    const fetchInProgress = useRef(false);

    // Modal & Selection States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAdjustment, setEditingAdjustment] = useState(null);
    const [detailAdjustment, setDetailAdjustment] = useState(null);
    const [deleteConfirmState, setDeleteConfirmState] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState(null);

    const [selectedIds, setSelectedIds] = useState([]);

    const [formData, setFormData] = useState({
        employee_id: '',
        adjustment_type: 'bonus',
        usage_type: 'payroll',
        name: '',
        remark: '',
        amount: '',
        adjustment_period: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`
    });

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const fetchAdjustments = useCallback(async (page = pagination.page) => {
        if (fetchInProgress.current) return;
        fetchInProgress.current = true;
        setLoading(true);

        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pagination.limit.toString(),
                month: selectedMonth.toString(),
                year: selectedYear.toString()
            });

            if (adjustmentType) params.append('adjustment_type', adjustmentType);
            if (selectedEmployeeId) params.append('employee_id', selectedEmployeeId.toString());

            const response = await apiCall(`/payroll/adjustments/list?${params}`, 'GET', null, company?.id);
            const result = await response.json();

            if (result.success) {
                setAdjustments(result.data || []);
                setSummary(result.meta?.summary || null);
                updatePagination({
                    page: result.meta?.page || page,
                    limit: result.meta?.limit || pagination.limit,
                    total: result.meta?.total || 0,
                    total_pages: result.meta?.total_pages || 1,
                    is_last_page: page >= (result.meta?.total_pages || 1)
                });
            } else {
                throw new Error(result.message || 'Failed to fetch adjustments');
            }
        } catch (e) {
            toast.error(e.message || 'Failed to fetch adjustments');
        } finally {
            setLoading(false);
            fetchInProgress.current = false;
        }
    }, [pagination.page, pagination.limit, selectedMonth, selectedYear, adjustmentType, selectedEmployeeId, updatePagination]);

    useEffect(() => {
        if (isMounted.current) {
            fetchAdjustments(pagination.page);
        }
    }, [pagination.page, pagination.limit, selectedMonth, selectedYear, adjustmentType, selectedEmployeeId]);

    const openCreateModal = () => {
        setEditingAdjustment(null);
        setFormData({
            employee_id: '',
            adjustment_type: 'bonus',
            usage_type: 'payroll',
            name: '',
            remark: '',
            amount: '',
            adjustment_period: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`
        });
        setIsModalOpen(true);
    };

    const openEditModal = (adj) => {
        setEditingAdjustment(adj);
        setFormData({
            employee_id: adj.employee_id || '',
            adjustment_type: adj.adjustment_type || 'bonus',
            usage_type: adj.usage_type || 'payroll',
            name: adj.name || '',
            remark: adj.remark || '',
            amount: adj.amount ? parseFloat(adj.amount).toString() : '',
            adjustment_period: adj.adjustment_period ? adj.adjustment_period.split('T')[0] : `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (submitting) return;
        setIsModalOpen(false);
        setEditingAdjustment(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!editingAdjustment && !formData.employee_id) {
            toast.warning('Please select an employee');
            return;
        }

        if (!formData.name || !formData.amount || !formData.adjustment_period) {
            toast.warning('Please fill in all required fields');
            return;
        }

        setSubmitting(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));

            let response;
            if (editingAdjustment) {
                response = await apiCall('/payroll/adjustments/update', 'PUT', {
                    id: editingAdjustment.id,
                    adjustment_type: formData.adjustment_type,
                    usage_type: formData.usage_type,
                    name: formData.name,
                    remark: formData.remark,
                    amount: parseFloat(formData.amount),
                    adjustment_period: formData.adjustment_period
                }, company?.id);
            } else {
                response = await apiCall('/payroll/adjustments', 'POST', {
                    employee_id: parseInt(formData.employee_id),
                    adjustment_type: formData.adjustment_type,
                    usage_type: formData.usage_type,
                    name: formData.name,
                    remark: formData.remark,
                    amount: parseFloat(formData.amount),
                    adjustment_period: formData.adjustment_period
                }, company?.id);
            }

            const result = await response.json();
            if (result.success) {
                toast.success(editingAdjustment ? 'Adjustment updated successfully!' : 'Adjustment created successfully!');
                setIsModalOpen(false);
                setFormData({
                    employee_id: '',
                    adjustment_type: 'bonus',
                    usage_type: 'payroll',
                    name: '',
                    remark: '',
                    amount: '',
                    adjustment_period: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`
                });
                setEditingAdjustment(null);
                fetchAdjustments(editingAdjustment ? pagination.page : 1);
            } else {
                throw new Error(result.message || `Failed to ${editingAdjustment ? 'update' : 'create'} adjustment`);
            }
        } catch (e) {
            toast.error(e.message || `Failed to ${editingAdjustment ? 'update' : 'create'} adjustment`);
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Selection helpers ────────────────────────────────────────────────
    const allVisibleSelected = useMemo(() => {
        return adjustments.length > 0 && adjustments.every(adj => selectedIds.includes(adj.id));
    }, [adjustments, selectedIds]);

    const toggleSelectAll = () => {
        if (allVisibleSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(adjustments.map(adj => adj.id));
        }
    };

    const toggleSelectRow = (e, id) => {
        e.stopPropagation();
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const clearSelection = () => {
        setSelectedIds([]);
    };

    // ─── Delete handlers ──────────────────────────────────────────────────
    const handleDeleteClick = (id) => {
        setDeleteConfirmState({ type: 'single', id });
    };

    const handleBulkDeleteSelected = () => {
        if (selectedIds.length === 0) return;
        setDeleteConfirmState({ type: 'selected', ids: selectedIds });
    };

    const handleBulkDeleteAllVisible = () => {
        if (!allVisibleSelected || adjustments.length === 0) return;
        setDeleteConfirmState({ type: 'allVisible', ids: adjustments.map(adj => adj.id) });
    };

    const confirmDelete = async () => {
        if (!deleteConfirmState) return;

        setSubmitting(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            let idsToDelete = [];

            if (deleteConfirmState.type === 'single') {
                idsToDelete = [deleteConfirmState.id];
            } else {
                idsToDelete = deleteConfirmState.ids;
            }

            const response = await apiCall('/payroll/adjustments/delete', 'DELETE', {
                ids: idsToDelete
            }, company?.id);

            const result = await response.json();
            if (result.success) {
                const deletedCount = idsToDelete.length;
                toast.success(
                    deleteConfirmState.type === 'single'
                        ? 'Adjustment deleted successfully!'
                        : `${deletedCount} adjustments deleted successfully!`
                );

                setSelectedIds([]);
                setDeleteConfirmState(null);

                fetchAdjustments(1);
            } else {
                throw new Error(result.message || 'Failed to delete adjustment(s)');
            }
        } catch (e) {
            toast.error(e.message || 'Failed to delete');
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (amount) => {
        const num = parseFloat(amount);
        if (isNaN(num)) return '₹0.00';
        return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    };

    const typeOptions = [
        { value: '', label: 'All Types' },
        { value: 'bonus', label: 'Bonus' },
        { value: 'fine', label: 'Fine' }
    ];

    const selectedTypeOption = useMemo(() => typeOptions.find(opt => opt.value === adjustmentType) || typeOptions[0], [adjustmentType]);

    const ActionMenuButtons = (adj) => [
        {
            label: 'View Details',
            icon: <FaEye size={13} />,
            onClick: () => setDetailAdjustment(adj),
            className: 'text-green-600 hover:text-green-700 hover:bg-green-50'
        },
        {
            label: 'Edit',
            icon: <FaEdit size={13} />,
            onClick: () => openEditModal(adj),
            disabled: updateAccess.disabled,
            title: updateAccess.disabled ? getAccessMessage(updateAccess) : 'Edit adjustment',
            className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
        },
        {
            label: 'Delete',
            icon: <FaTrash size={13} />,
            onClick: () => handleDeleteClick(adj.id),
            disabled: deleteAccess.disabled,
            title: deleteAccess.disabled ? getAccessMessage(deleteAccess) : 'Delete adjustment',
            className: 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
        }
    ];

    const columns = useMemo(() => [
        {
            key: 'employee',
            label: <span>Employee</span>,   // ✅ Removed the header checkbox
            render: (adj) => (
                <div className="flex items-center gap-4">
                    {deleteAccess.enabled && (
                        <div onClick={(e) => e.stopPropagation()}>
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(adj.id)}
                                onChange={(e) => toggleSelectRow(e, adj.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        <ProfileAvatar
                            record={adj}
                            name={adj.employee_name}
                            className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs border border-indigo-100 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(adj.employee_id); }}
                        >
                            {adj.employee_name?.charAt(0).toUpperCase() || 'E'}
                        </ProfileAvatar>
                        <div>
                            <p
                                className="font-semibold text-gray-800 leading-tight cursor-pointer hover:underline hover:text-indigo-600 transition-colors inline-block"
                                onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(adj.employee_id); }}
                            >
                                {adj.employee_name || 'N/A'}
                            </p>
                            {adj.employee_code && <p className="text-[10px] text-gray-500 font-mono mt-0.5">{adj.employee_code}</p>}
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: 'name',
            label: 'Adjustment Name',
            render: (adj) => (
                <div>
                    <p className="text-gray-800 font-semibold">{adj.name}</p>
                    {adj.remark && <p className="text-xs text-gray-500 max-w-xs truncate mt-0.5">{adj.remark}</p>}
                </div>
            )
        },
        {
            key: 'adjustment_type',
            label: 'Type',
            render: (adj) => (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${adj.adjustment_type === 'bonus' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${adj.adjustment_type === 'bonus' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                    {adj.adjustment_type === 'bonus' ? 'Bonus' : 'Fine'}
                </span>
            )
        },
        {
            key: 'adjustment_period',
            label: 'Period',
            render: (adj) => (
                <div className="flex items-center gap-2">
                    <FaCalendarAlt className="text-gray-400 text-xs" />
                    <span className="text-sm font-medium text-gray-600">{formatDate(adj.adjustment_period)}</span>
                </div>
            )
        },
        {
            key: 'amount',
            label: 'Amount',
            headerClassName: 'text-right',
            className: 'text-right',
            render: (adj) => (
                <span className={`font-black text-base ${adj.adjustment_type === 'bonus' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                    {adj.adjustment_type === 'bonus' ? '+' : '-'}{formatCurrency(adj.amount)}
                </span>
            )
        }
    ], [selectedIds, deleteAccess.enabled, adjustments]);

    return (
        <ManagementHub
            eyebrow={<><FaCalculator size={11} /> Payroll Adjustments</>}
            title="Payroll Adjustments"
            description="Manage bonuses, fines, and ledger adjustments."
            accent="blue"
            onRefresh={() => fetchAdjustments(pagination.page)}
            refreshing={loading}
            actions={
                <ManagementButton
                    tone="blue"
                    variant="solid"
                    leftIcon={<FaPlus />}
                    onClick={openCreateModal}
                    disabled={createAccess.disabled}
                    title={createAccess.disabled ? getAccessMessage(createAccess) : 'Create Adjustment'}
                >
                    Create Adjustment
                </ManagementButton>
            }
        >
            <div className="space-y-6 p-2 lg:p-0">
                {/* Summary Cards */}
                {summary && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <motion.div
                            whileHover={{ y: -4, scale: 1.01 }}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/40 via-white to-emerald-50/10 p-6 shadow-sm transition-all"
                        >
                            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 rounded-full bg-emerald-500/5 blur-xl pointer-events-none"></div>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                    <FaMoneyBillWave size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-emerald-600/80 uppercase tracking-widest mb-0.5">Total Payroll Bonus</p>
                                    <p className="text-2xl font-black text-emerald-700">{formatCurrency(summary.payroll?.bonus)}</p>
                                </div>
                            </div>
                        </motion.div>
                        <motion.div
                            whileHover={{ y: -4, scale: 1.01 }}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="relative overflow-hidden rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/40 via-white to-rose-50/10 p-6 shadow-sm transition-all"
                        >
                            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 rounded-full bg-rose-500/5 blur-xl pointer-events-none"></div>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-rose-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20">
                                    <FaCoins size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-rose-600/80 uppercase tracking-widest mb-0.5">Total Payroll Fine</p>
                                    <p className="text-2xl font-black text-rose-700">{formatCurrency(summary.payroll?.fine)}</p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Filter Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm"
                >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="w-full">
                            <EmployeeSelect
                                value={selectedEmployeeId}
                                onChange={(id) => setSelectedEmployeeId(id || "")}
                                placeholder="All Employees"
                            />
                        </div>
                        <div className="flex flex-col lg:flex-row gap-3 w-full justify-end">
                            <div className="flex flex-col sm:flex-row gap-3 lg:items-center">
                                <div className="flex-1 lg:flex-none min-w-0">
                                    <AdvancedDateFilter
                                        tabOptions={["month"]}
                                        value={{
                                            date: "",
                                            month: selectedMonth,
                                            year: selectedYear,
                                            from_date: "",
                                            to_date: ""
                                        }}
                                        onChange={(val) => {
                                            if (val?.month && val?.year) {
                                                setSelectedMonth(Number(val.month));
                                                setSelectedYear(Number(val.year));
                                            }
                                        }}
                                        buttonClassName="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none hover:border-gray-300 transition-all flex items-center justify-between cursor-pointer"
                                    />
                                </div>
                                <div className="flex-1 lg:flex-none text-center min-w-0">
                                    <SelectField
                                        options={typeOptions}
                                        value={selectedTypeOption}
                                        onChange={(opt) => setAdjustmentType(opt ? opt.value : "")}
                                        isClearable={false}
                                        placeholder="Adjustment Type"
                                        styles={{
                                            control: (base) => ({
                                                ...base,
                                                minHeight: "42px",
                                                height: "42px"
                                            })
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-start lg:justify-end">
                                <ManagementViewSwitcher
                                    viewMode={viewMode}
                                    onChange={setViewMode}
                                    accent="blue"
                                />
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Select all / Deselect all bar */}
                {!loading && adjustments.length > 0 && deleteAccess.enabled && (
                    <div className="flex items-center gap-3 mb-1">
                        <button
                            type="button"
                            onClick={toggleSelectAll}
                            className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                        >
                            {allVisibleSelected ? (
                                <>
                                    <FaCheckSquare size={13} /> Deselect all
                                </>
                            ) : (
                                <>
                                    <FaRegSquare size={13} /> Select all
                                </>
                            )}
                        </button>
                    </div>
                )}

                {loading && !adjustments.length ? (
                    <SkeletonComponent />
                ) : !loading && adjustments.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
                        <FaCalculator className="text-6xl text-gray-200 mx-auto mb-4" />
                        <p className="text-xl text-gray-500 font-medium">No adjustments found</p>
                        <p className="text-gray-400 mt-2 text-sm">Try changing your filters or create a new adjustment.</p>
                    </div>
                ) : (
                    <>
                        {viewMode === 'table' && (
                            <ManagementTable
                                rows={adjustments}
                                columns={columns}
                                rowKey="id"
                                onRowClick={(row) => setDetailAdjustment(row)}
                                getActions={ActionMenuButtons}
                                activeId={activeMenuId}
                                onToggleAction={(e, id) => setActiveMenuId((current) => (current === id ? null : id))}
                                accent="blue"
                            />
                        )}

                        {viewMode === 'card' && (
                            <ManagementGrid viewMode={viewMode}>
                                {adjustments.map((adj) => (
                                    <ManagementCard
                                        key={adj.id}
                                        accent="blue"
                                        onClick={() => setDetailAdjustment(adj)}
                                        hoverable
                                        eyebrow={
                                            <div className="flex items-center gap-2">
                                                {deleteAccess.enabled && (
                                                    <div onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.includes(adj.id)}
                                                            onChange={(e) => toggleSelectRow(e, adj.id)}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer mr-2"
                                                        />
                                                    </div>
                                                )}
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${adj.adjustment_type === 'bonus' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                                                    }`}>
                                                    {adj.adjustment_type}
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-400"># {adj.id}</span>
                                            </div>
                                        }
                                        title={
                                            <span
                                                className="cursor-pointer hover:underline hover:text-indigo-600 transition-colors inline-block"
                                                onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(adj.employee_id); }}
                                            >
                                                {adj.employee_name}
                                            </span>
                                        }
                                        subtitle={adj.employee_code}
                                        icon={
                                            <ProfileAvatar
                                                record={adj}
                                                name={adj.employee_name}
                                                className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-100 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(adj.employee_id); }}
                                            >
                                                {adj.employee_name?.charAt(0).toUpperCase() || 'E'}
                                            </ProfileAvatar>
                                        }
                                        actions={ActionMenuButtons(adj)}
                                        activeId={activeMenuId}
                                        onToggle={(e, id) => setActiveMenuId((current) => (current === id ? null : id))}
                                        menuId={`adjustment-${adj.id}`}
                                        footer={
                                            <div className="flex w-full items-center justify-between pt-4 border-t border-gray-100">
                                                <div className="flex items-center gap-1 text-gray-400 text-xs">
                                                    <FaCalendarAlt />
                                                    <span>{formatDate(adj.adjustment_period)}</span>
                                                </div>
                                                <span className={`text-lg font-black ${adj.adjustment_type === 'bonus' ? 'text-emerald-600' : 'text-rose-600'
                                                    }`}>
                                                    {adj.adjustment_type === 'bonus' ? '+' : '-'}{formatCurrency(adj.amount)}
                                                </span>
                                            </div>
                                        }
                                    >
                                        <div className="mb-4">
                                            <p className="text-sm font-semibold text-gray-800">{adj.name}</p>
                                            {adj.remark && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{adj.remark}</p>}
                                        </div>
                                    </ManagementCard>
                                ))}
                            </ManagementGrid>
                        )}

                        <Pagination
                            currentPage={pagination.page}
                            totalItems={pagination.total}
                            itemsPerPage={pagination.limit}
                            onPageChange={goToPage}
                            showInfo={true}
                            onLimitChange={changeLimit}
                        />
                    </>
                )}

                {/* Selection Action Bar (Floating) */}
                <AnimatePresence>
                    {selectedIds.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 100 }}
                            className="fixed bottom-8 right-8 z-[100] flex items-center gap-4 bg-white/80 backdrop-blur-md px-6 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white/20"
                        >
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bulk Actions</span>
                                <span className="text-sm font-black text-slate-800">{selectedIds.length} Selected</span>
                            </div>
                            <div className="h-10 w-px bg-gray-200 mx-2"></div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={clearSelection}
                                    className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    Clear
                                </button>
                                <ManagementButton
                                    tone="rose"
                                    variant="solid"
                                    size="sm"
                                    leftIcon={<FaTrash />}
                                    onClick={handleBulkDeleteSelected}
                                    disabled={deleteAccess.disabled}
                                    title={deleteAccess.disabled ? getAccessMessage(deleteAccess) : 'Delete selected adjustments'}
                                    className="shadow-lg shadow-rose-200"
                                >
                                    Delete Selected
                                </ManagementButton>
                                <ManagementButton
                                    tone="rose"
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<FaTrash />}
                                    onClick={handleBulkDeleteAllVisible}
                                    disabled={!allVisibleSelected || deleteAccess.disabled}
                                    title={
                                        !allVisibleSelected
                                            ? 'Select all rows to enable deleting all visible'
                                            : deleteAccess.disabled
                                                ? getAccessMessage(deleteAccess)
                                                : 'Delete all rows on this page'
                                    }
                                    className="shadow-lg"
                                >
                                    Delete All
                                </ManagementButton>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Create/Edit Modal */}
                <Modal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    title={editingAdjustment ? 'Edit Adjustment' : 'Create Adjustment'}
                    subtitle={editingAdjustment ? 'Modify existing bonus or fine' : 'Add a new bonus or fine'}
                    icon={<FaCoins className="text-blue-600 h-5 w-5" />}
                    size="2xl"
                    footer={
                        <div className="flex justify-end gap-3 w-full">
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                disabled={submitting}
                                className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="payroll-adjustment-form"
                                disabled={submitting}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {submitting ? <FaSpinner className="animate-spin" /> : null}
                                {submitting ? 'Saving...' : 'Save Adjustment'}
                            </button>
                        </div>
                    }
                >
                    <form id="payroll-adjustment-form" onSubmit={handleSubmit} className="space-y-5">
                        {editingAdjustment ? (
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Employee</label>
                                <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl">
                                    <ProfileAvatar
                                        record={editingAdjustment}
                                        name={editingAdjustment.employee_name}
                                        className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-100 flex-shrink-0"
                                    >
                                        {editingAdjustment.employee_name?.charAt(0).toUpperCase() || 'E'}
                                    </ProfileAvatar>
                                    <div>
                                        <p className="font-semibold text-gray-800">{editingAdjustment.employee_name || 'N/A'}</p>
                                        {editingAdjustment.employee_code && <p className="text-xs text-gray-500 font-mono mt-0.5">{editingAdjustment.employee_code}</p>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Employee *</label>
                                <EmployeeSelect
                                    value={formData.employee_id}
                                    onChange={(id) => setFormData({ ...formData, employee_id: id })}
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Adjustment Type *</label>
                                <SelectField
                                    options={[
                                        { value: 'bonus', label: 'Bonus (+)' },
                                        { value: 'fine', label: 'Fine (-)' }
                                    ]}
                                    value={formData.adjustment_type === 'bonus' ? { value: 'bonus', label: 'Bonus (+)' } : { value: 'fine', label: 'Fine (-)' }}
                                    onChange={(opt) => setFormData({ ...formData, adjustment_type: opt ? opt.value : 'bonus' })}
                                    isClearable={false}
                                    placeholder="Select adjustment type"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Usage Type *</label>
                                <SelectField
                                    options={[
                                        { value: 'payroll', label: 'Payroll' },
                                        { value: 'ledger', label: 'Ledger' }
                                    ]}
                                    value={formData.usage_type === 'ledger' ? { value: 'ledger', label: 'Ledger' } : { value: 'payroll', label: 'Payroll' }}
                                    onChange={(opt) => setFormData({ ...formData, usage_type: opt ? opt.value : 'payroll' })}
                                    isClearable={false}
                                    placeholder="Select usage type"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Adjustment Name *</label>
                            <input
                                type="text"
                                placeholder="e.g., Performance Bonus"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-800"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Remark</label>
                            <textarea
                                placeholder="Add any context or details..."
                                rows="2"
                                value={formData.remark}
                                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none font-medium text-gray-800"
                            ></textarea>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Amount *</label>
                                <input
                                    type="text"
                                    placeholder="0.00"
                                    value={formData.amount}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (/^\d*\.?\d*$/.test(val)) {
                                            setFormData({ ...formData, amount: val });
                                        }
                                    }}
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-gray-800"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Period *</label>
                                <input
                                    type="date"
                                    value={formData.adjustment_period}
                                    onChange={(e) => setFormData({ ...formData, adjustment_period: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 font-semibold"
                                />
                            </div>
                        </div>
                    </form>
                </Modal>

                {/* View Details Modal */}
                {detailAdjustment && (
                    <Modal
                        isOpen={!!detailAdjustment}
                        onClose={() => setDetailAdjustment(null)}
                        title="Adjustment Details"
                        subtitle={`${detailAdjustment.employee_name} · ${detailAdjustment.name}`}
                        icon={<FaEye className="h-6 w-6 text-blue-600" />}
                        size="lg"
                        footer={
                            <div className="flex gap-2 justify-end w-full">
                                <button
                                    type="button"
                                    onClick={() => setDetailAdjustment(null)}
                                    className="rounded-xl bg-gray-100 py-2.5 px-5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-200"
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDeleteConfirmState({ type: 'single', id: detailAdjustment.id });
                                        setDetailAdjustment(null);
                                    }}
                                    disabled={deleteAccess.disabled}
                                    title={deleteAccess.disabled ? getAccessMessage(deleteAccess) : 'Delete adjustment'}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-rose-200 transition-all hover:from-rose-700 hover:to-red-700 disabled:opacity-50"
                                >
                                    <FaTrash size={13} /> Delete
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        openEditModal(detailAdjustment);
                                        setDetailAdjustment(null);
                                    }}
                                    disabled={updateAccess.disabled}
                                    title={updateAccess.disabled ? getAccessMessage(updateAccess) : 'Edit adjustment'}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 transition-all hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50"
                                >
                                    <FaEdit size={13} /> Edit
                                </button>
                            </div>
                        }
                    >
                        <div className="space-y-4">
                            <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 flex items-center gap-4">
                                <ProfileAvatar
                                    record={detailAdjustment}
                                    name={detailAdjustment.employee_name}
                                    className="w-12 h-12 rounded-xl bg-white text-indigo-600 font-bold text-lg border border-indigo-100 flex-shrink-0"
                                >
                                    {detailAdjustment.employee_name?.charAt(0).toUpperCase() || 'E'}
                                </ProfileAvatar>
                                <div>
                                    <h3 className="text-lg font-black tracking-tight text-slate-800 leading-tight">{detailAdjustment.employee_name || 'N/A'}</h3>
                                    {detailAdjustment.employee_code && <p className="text-xs text-slate-500 font-mono mt-0.5">{detailAdjustment.employee_code}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-3">
                                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Adjustment Period</label>
                                    <div className="text-sm font-medium text-gray-800">{formatDate(detailAdjustment.adjustment_period)}</div>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-3">
                                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Adjustment Type</label>
                                    <div className="text-sm font-medium text-gray-800 capitalize">{detailAdjustment.adjustment_type || 'N/A'}</div>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-3">
                                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Usage Type</label>
                                    <div className="text-sm font-medium text-gray-800 capitalize">{detailAdjustment.usage_type || 'Payroll'}</div>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-3">
                                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Amount</label>
                                    <div className={`text-base font-bold ${detailAdjustment.adjustment_type === 'bonus' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {detailAdjustment.adjustment_type === 'bonus' ? '+' : '-'}{formatCurrency(detailAdjustment.amount)}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-3 col-span-2">
                                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Adjustment Name</label>
                                    <div className="text-sm font-medium text-gray-800">{detailAdjustment.name || 'N/A'}</div>
                                </div>
                            </div>

                            {detailAdjustment.remark && (
                                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-3">
                                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Remark / Notes</label>
                                    <div className="text-sm italic leading-relaxed text-gray-700">"{detailAdjustment.remark}"</div>
                                </div>
                            )}
                        </div>
                    </Modal>
                )}

                {/* Delete Confirmation Modal */}
                {deleteConfirmState && (
                    <Modal
                        isOpen={!!deleteConfirmState}
                        onClose={() => setDeleteConfirmState(null)}
                        title="Confirm Deletion"
                        subtitle={
                            deleteConfirmState.type === 'single'
                                ? "Are you sure you want to permanently delete this payroll adjustment?"
                                : `Are you sure you want to permanently delete the ${deleteConfirmState.ids.length} selected payroll adjustments?`
                        }
                        icon={<FaTrash className="h-6 w-6 text-rose-600" />}
                        size="md"
                        footer={
                            <div className="flex justify-end gap-3 w-full">
                                <button
                                    type="button"
                                    onClick={() => setDeleteConfirmState(null)}
                                    disabled={submitting}
                                    className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmDelete}
                                    disabled={submitting}
                                    className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {submitting ? <FaSpinner className="animate-spin" /> : null}
                                    {submitting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        }
                    >
                        <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-sm text-rose-800 leading-relaxed">
                            <span className="font-bold">Warning:</span> This action is permanent and cannot be undone. The payroll adjustment record(s) will be deleted from the system immediately.
                        </div>
                    </Modal>
                )}
            </div>
        </ManagementHub>
    );
}