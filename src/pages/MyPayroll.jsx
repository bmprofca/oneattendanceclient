import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    FaMoneyBillWave, FaCalendarAlt, FaUserCircle, FaBriefcase,
    FaChartBar, FaArrowUp, FaArrowDown,
    FaSpinner, FaSearch, FaTimes, FaEye, FaDownload,
    FaRegClock, FaFileInvoiceDollar, FaExclamationTriangle,
    FaIdCard,
    FaUserTag, FaWallet, FaCalendarCheck, FaUserTie, FaCog
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import CurrencyIcon from '../components/common/CurrencyIcon';
import apiCall from '../utils/api';
import SkeletonComponent from '../components/SkeletonComponent';
import Pagination, { usePagination } from '../components/PaginationComponent';
import ModalScrollLock from '../components/ModalScrollLock';
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import ActionMenu from '../components/ActionMenu';
import { RefreshButton, ManagementHub } from '../components/common';
import usePermissionAccess from '../hooks/usePermissionAccess';
import AdvancedDateFilter from '../components/AdvancedDateFilter';

// ─── Constants ─────────────────────────────────────────────────────────────────

const triggerFileDownload = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const downloadBlob = (blob, filename) => {
    const downloadUrl = URL.createObjectURL(blob);
    triggerFileDownload(downloadUrl, filename);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
};

const MODAL_TYPES = { NONE: 'NONE', VIEW: 'VIEW', CONFIRM_DOWNLOAD: 'CONFIRM_DOWNLOAD' };

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const mySalaryBackdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
};

// ─── Helper Functions ──────────────────────────────────────────────────────────

const formatCurrency = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
    }).format(Math.abs(num));
};

const formatDays = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    return Number.isInteger(num) ? String(num) : num.toFixed(1);
};

const formatLabel = (str) => {
    if (!str) return 'N/A';
    return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

// ─── Sub Components ────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, gradient, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
        className={`relative overflow-hidden rounded-xl p-5 shadow-lg text-white ${gradient}`}
    >
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 bg-white -translate-y-8 translate-x-8" />
        <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                <Icon className="text-xl" />
            </div>
            {sub && <span className="text-xs text-white/80 bg-white/20 px-2 py-1 rounded-full">{sub}</span>}
        </div>
        <p className="text-sm text-white/80 font-medium">{label}</p>
        <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
    </motion.div>
);

const AttendancePill = ({ label, value, color }) => (
    <div className={`flex flex-col items-center p-3 rounded-xl bg-${color}-50 border border-${color}-100 min-w-0`}>
        <span className={`text-xl font-bold text-${color}-600`}>{formatDays(value)}</span>
        <span className="text-xs text-gray-500 mt-1 text-center">{label}</span>
    </div>
);

// ─── View Modal ────────────────────────────────────────────────────────────────

const PayrollViewModal = ({ payroll, employee, onClose }) => {
    if (!payroll) return null;
    const { payroll: p } = payroll;
    const netNegative = parseFloat(p.net_salary) < 0;

    return (
        <>
            <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-5 sticky top-0 z-[10]">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                        <FaFileInvoiceDollar className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Payroll Details</h2>
                        <p className="text-sm text-slate-500 mt-0.5">{MONTHS[p.month - 1]} {p.year}</p>
                    </div>
                </div>
                <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-all">
                    <FaTimes className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 min-h-0 p-6 overflow-y-auto custom-scrollbar">
                {/* Employee Info */}
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 mb-6">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                        <FaUserCircle className="text-white text-3xl" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{formatLabel(employee?.designation)}</h3>
                        <p className="text-sm text-gray-500 font-mono">{employee?.employee_code}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{formatLabel(employee?.employment_type)}</span>
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{formatLabel(employee?.salary_type)}</span>
                        </div>
                    </div>
                </div>

                {/* Salary Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 text-center">
                        <FaArrowUp className="text-green-500 mx-auto mb-2" />
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Earnings</p>
                        <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(p.total_earnings)}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-red-50 to-rose-50 rounded-xl border border-red-100 text-center">
                        <FaArrowDown className="text-red-500 mx-auto mb-2" />
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Deductions</p>
                        <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(p.total_deductions)}</p>
                    </div>
                    <div className={`p-4 rounded-xl border text-center ${netNegative ? 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-100' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100'}`}>
                        <FaWallet className={`mx-auto mb-2 ${netNegative ? 'text-orange-500' : 'text-blue-500'}`} />
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Net Salary</p>
                        <p className={`text-xl font-bold mt-1 ${netNegative ? 'text-orange-600' : 'text-blue-600'}`}>
                            {netNegative ? '-' : ''}{formatCurrency(p.net_salary)}
                        </p>
                        {netNegative && (
                            <p className="text-xs text-orange-500 mt-1 flex items-center justify-center gap-1">
                                <FaExclamationTriangle className="text-xs" /> Deficit
                            </p>
                        )}
                    </div>
                </div>

                {/* Attendance Summary */}
                {p.attendance && (
                    <div className="mb-6">
                        <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <FaCalendarCheck className="text-indigo-500" /> Attendance Summary
                        </h4>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            <AttendancePill label="Present" value={p.attendance.present_days} color="green" />
                            <AttendancePill label="Absent" value={p.attendance.absent_days} color="red" />
                            <AttendancePill label="Paid Leave" value={p.attendance.paid_leave_days} color="blue" />
                            <AttendancePill label="Unpaid Leave" value={p.attendance.unpaid_leave_days} color="orange" />
                            <AttendancePill label="LOP Days" value={p.attendance.lop_days} color="purple" />
                            <div className="flex flex-col items-center p-3 rounded-xl bg-rose-50 border border-rose-100 min-w-0">
                                <span className="text-sm font-bold text-rose-600 text-center leading-tight">
                                    {p.attendance.lop_deduction ? formatCurrency(p.attendance.lop_deduction) : '₹0'}
                                </span>
                                <span className="text-xs text-gray-500 mt-1 text-center">LOP Deduct.</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Hours */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FaRegClock className="text-blue-600 text-sm" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Worked Hours</p>
                            <p className="text-sm font-semibold text-gray-800">{parseFloat(p.worked_hours || 0).toFixed(2)} hrs</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 border border-purple-100">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FaChartBar className="text-purple-600 text-sm" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Overtime Hours</p>
                            <p className="text-sm font-semibold text-gray-800">{parseFloat(p.overtime_hours || 0).toFixed(2)} hrs</p>
                        </div>
                    </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-medium">Payroll ID</span>
                    <span className="text-xs font-mono font-semibold text-gray-700">#{p.id}</span>
                </div>
            </div>

            <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex justify-end">
                <button onClick={onClose} className="px-6 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl hover:from-gray-200 hover:to-gray-300 transition-all duration-300 font-medium text-sm">
                    Close
                </button>
            </div>
        </>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const MyPayroll = () => {
    const { checkPageAccess, checkActionAccess, getAccessMessage } = usePermissionAccess();
    const pageAccess = checkPageAccess('myPayroll');
    const downloadAccess = checkActionAccess('myPayroll', 'download');

    const [payrollData, setPayrollData] = useState([]);
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(false);
    const [modalType, setModalType] = useState(MODAL_TYPES.NONE);
    const [selectedPayroll, setSelectedPayroll] = useState(null);
    const [viewMode, setViewMode] = useState('table');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activeActionMenu, setActiveActionMenu] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSummary, setIsSummary] = useState(true);
    const [period, setPeriod] = useState(() => ({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
    }));

    const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 12);
    const fetchInProgress = useRef(false);
    const initialFetchDone = useRef(false);
    const isInitialLoad = useRef(true);
    const isMounted = useRef(true);

    // ─── Responsive Columns — mirrors EmployeeManagement pattern ──────────────
    // Columns drop one by one as viewport shrinks:
    //  ≥1280 : all columns visible
    //  ≥1100 : drop Hours
    //  ≥1024 : drop Attendance
    //  ≥768  : drop Deductions
    //  ≥640  : drop Earnings
    //  <640  : Period + Net + Actions only

    const [visibleColumns, setVisibleColumns] = useState(() => ({
        showPeriod: true,
        showEarnings: typeof window === 'undefined' ? true : window.innerWidth >= 768,
        showDeductions: typeof window === 'undefined' ? true : window.innerWidth >= 1024,
        showNet: true,
        showAttendance: typeof window === 'undefined' ? true : window.innerWidth >= 1100,
        showHours: typeof window === 'undefined' ? true : window.innerWidth >= 1280,
    }));

    useEffect(() => {
        let t;
        const onResize = () => {
            clearTimeout(t);
            t = setTimeout(() => setVisibleColumns({
                showPeriod: true,
                showEarnings: window.innerWidth >= 768,
                showDeductions: window.innerWidth >= 1024,
                showNet: true,
                showAttendance: window.innerWidth >= 1100,
                showHours: window.innerWidth >= 1280,
            }), 150);
        };
        onResize();
        window.addEventListener('resize', onResize);
        return () => { clearTimeout(t); window.removeEventListener('resize', onResize); };
    }, []);

    // ─── Lifecycle ─────────────────────────────────────────────────────────────

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // ─── API ────────────────────────────────────────────────────────────────────

    const fetchPayroll = useCallback(async (page = pagination.page, resetLoading = true) => {
        if (!pageAccess.allowed) return;
        if (fetchInProgress.current) return;
        fetchInProgress.current = true;
        if (resetLoading) setLoading(true);

        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const companyId = company?.id ?? null;
            const params = new URLSearchParams({ page: page.toString(), limit: pagination.limit.toString() });
            params.set('month', String(period.month));
            params.set('year', String(period.year));
            if (debouncedSearch) params.append('search', debouncedSearch);

            const response = await apiCall(`/payroll/my?${params}`, 'GET', null, companyId);
            const result = await response.json();

            if (result.success) {
                setPayrollData(result.data || []);
                setEmployee(result.employee || null);
                const currentPage = Number(result.pagination?.page ?? result.meta?.page ?? result.page ?? page);
                const perPage = Number(result.pagination?.limit ?? result.meta?.limit ?? result.limit ?? pagination.limit);
                const total = Number(
                    result.pagination?.total ??
                    result.meta?.total ??
                    result.total ??
                    result.data?.length ??
                    0
                );
                const totalPages = Number(
                    result.pagination?.total_pages ??
                    result.meta?.total_pages ??
                    result.total_pages ??
                    result.last_page ??
                    Math.max(1, Math.ceil(total / perPage))
                );
                updatePagination({
                    page: currentPage,
                    limit: perPage,
                    total,
                    total_pages: totalPages,
                    is_last_page: result.pagination?.is_last_page ?? result.meta?.is_last_page ?? (currentPage >= totalPages)
                });
            } else {
                throw new Error(result.message || 'Failed to fetch payroll');
            }
        } catch (e) {
            toast.error(e.message || 'Failed to fetch payroll');
        } finally {
            setLoading(false);
            fetchInProgress.current = false;
        }
    }, [pageAccess.allowed, pagination.page, pagination.limit, debouncedSearch, period, updatePagination]);

    const lastFetchParams = useRef({ page: null, limit: null, search: null, month: null, year: null });

    useEffect(() => {
        if (pageAccess.allowed) goToPage(1);
    }, [pageAccess.allowed, period, goToPage]);

    useEffect(() => {
        if (!pageAccess.allowed) return;

        if (lastFetchParams.current.search !== null && lastFetchParams.current.search !== debouncedSearch) {
            goToPage(1);
        }
    }, [pageAccess.allowed, debouncedSearch, goToPage]);

    useEffect(() => {
        if (!pageAccess.allowed) return;

        const currentParams = {
            page: pagination.page,
            limit: pagination.limit,
            search: debouncedSearch,
            month: period.month,
            year: period.year,
        };

        if (
            lastFetchParams.current.page === currentParams.page &&
            lastFetchParams.current.limit === currentParams.limit &&
            lastFetchParams.current.search === currentParams.search
        ) {
            return; // Skip duplicate fetch
        }

        lastFetchParams.current = currentParams;
        fetchPayroll(pagination.page, true);
    }, [pageAccess.allowed, pagination.page, pagination.limit, debouncedSearch, period, fetchPayroll]);

    // ─── Summary Stats ──────────────────────────────────────────────────────────

    const totalEarnings = payrollData.reduce((s, r) => s + parseFloat(r.payroll?.total_earnings || 0), 0);
    const totalDeductions = payrollData.reduce((s, r) => s + parseFloat(r.payroll?.total_deductions || 0), 0);
    const totalNet = payrollData.reduce((s, r) => s + parseFloat(r.payroll?.net_salary || 0), 0);
    const latestPayroll = payrollData[0]?.payroll;

    const openViewModal = (item) => { setSelectedPayroll(item); setModalType(MODAL_TYPES.VIEW); setActiveActionMenu(null); };
    const closeModal = () => { setModalType(MODAL_TYPES.NONE); setSelectedPayroll(null); };

    const handlePageChange = useCallback((newPage) => {
        if (newPage !== pagination.page) goToPage(newPage);
    }, [pagination.page, goToPage]);

    const getPayrollPdfFilename = (payrollItem) => {
        const month = Number(payrollItem?.payroll?.month);
        const year = Number(payrollItem?.payroll?.year);
        const normalizedMonth = Number.isFinite(month) ? String(month).padStart(2, '0') : 'month';
        const normalizedYear = Number.isFinite(year) ? String(year) : 'year';
        return `${normalizedMonth}_${normalizedYear}_payroll.pdf`;
    };

    const handleDownloadPdf = (item) => {
        if (!downloadAccess.allowed) {
            toast.error(getAccessMessage(downloadAccess));
            return;
        }
        const payrollEntryId = item?.payroll?.id;
        if (!payrollEntryId) {
            toast.error('Payroll entry ID not found');
            return;
        }
        setSelectedPayroll(item);
        setIsSummary(true);
        setModalType(MODAL_TYPES.CONFIRM_DOWNLOAD);
        setActiveActionMenu(null);
    };

    const handleConfirmDownload = async () => {
        if (!selectedPayroll) return;
        closeModal();
        setIsDownloading(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const companyId = company?.id ?? null;
            const payrollEntryId = selectedPayroll.payroll.id;
            const filename = getPayrollPdfFilename(selectedPayroll);

            const response = await apiCall('/payroll/download', 'POST', { payroll_entry_id: payrollEntryId, type: isSummary ? 'summary' : 'detailed' }, companyId);

            if (!response.ok) {
                let errorMessage = 'Failed to download payslip';
                try {
                    const errorResult = await response.json();
                    errorMessage = errorResult?.message || errorMessage;
                } catch { /* keep fallback */ }
                throw new Error(errorMessage);
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const result = await response.json();
                const fileUrl = result.url || result.file_url || result.data?.url || result.data?.file_url;
                if (result.success && fileUrl) {
                    try {
                        const fileResponse = await fetch(fileUrl);
                        if (!fileResponse.ok) throw new Error('Unable to fetch PDF file');
                        const fileBlob = await fileResponse.blob();
                        downloadBlob(fileBlob, filename);
                    } catch {
                        triggerFileDownload(fileUrl, filename);
                    }
                    toast.success(result.message || 'Payslip downloaded successfully');
                } else {
                    throw new Error(result.message || 'Failed to download payslip');
                }
            } else {
                const blob = await response.blob();
                downloadBlob(blob, filename);
                toast.success('Payslip downloaded successfully');
            }
        } catch (e) {
            toast.error(e.message || 'Failed to download payslip');
        } finally {
            setIsDownloading(false);
        }
    };

    // ─── Render ─────────────────────────────────────────────────────────────────

    if (!pageAccess.allowed) {
        return (
            <ManagementHub
                eyebrow={<><FaFileInvoiceDollar size={11} /> My Payroll</>}
                title="My Payroll"
                description="Review your payroll history, earnings, deductions, and attendance impact."
                accent="blue"
            >
                <div className="text-center py-16 bg-white rounded-xl shadow-xl">
                    <FaExclamationTriangle className="text-6xl text-amber-400 mx-auto mb-4" />
                    <p className="text-xl text-gray-600">{getAccessMessage(pageAccess)}</p>
                </div>
            </ManagementHub>
        );
    }

    return (
        <>
            <AnimatePresence>
                {isDownloading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center"
                    >
                        <FaSpinner className="animate-spin text-blue-600 text-5xl mb-4" />
                        <p className="text-gray-800 font-semibold shadow-sm px-5 py-2.5 bg-white rounded-xl border border-gray-100 flex items-center gap-2">
                            <FaFileInvoiceDollar className="text-blue-500" />
                            Preparing PDF Payslip...
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
            <ManagementHub
                eyebrow={<><FaFileInvoiceDollar size={11} /> My Payroll</>}
            title="My Payroll"
            description="Review your payroll history, earnings, deductions, and attendance impact."
            accent="blue"
            onRefresh={() => fetchPayroll(pagination.page, true)}
            refreshing={loading}
            summary={
                <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm">
                    <FaFileInvoiceDollar className="text-blue-500" />
                    <span className="font-medium text-gray-700">{pagination.total}</span>
                    <span className="text-gray-500">records</span>
                </div>
            }
        >

            {/* Employee Info Strip */}
            {employee && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                    className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
                >
                    {[
                        { icon: FaIdCard, label: 'Employee ID', value: `#${employee.id}`, bg: 'bg-blue-50', border: 'border-blue-100', iconCls: 'text-blue-500' },
                        { icon: FaUserTie, label: 'Designation', value: formatLabel(employee.designation), bg: 'bg-indigo-50', border: 'border-indigo-100', iconCls: 'text-indigo-500' },
                        { icon: FaBriefcase, label: 'Employment Type', value: formatLabel(employee.employment_type), bg: 'bg-purple-50', border: 'border-purple-100', iconCls: 'text-purple-500' },
                        { icon: CurrencyIcon, label: 'Salary Type', value: formatLabel(employee.salary_type), bg: 'bg-emerald-50', border: 'border-emerald-100', iconCls: 'text-emerald-500' },
                    ].map((item, i) => (
                        <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * i }}
                            className={`p-3 ${item.bg} ${item.border} border rounded-xl flex items-center gap-3`}
                        >
                            <item.icon className={`${item.iconCls} flex-shrink-0`} />
                            <div className="min-w-0">
                                <p className="text-xs text-gray-500">{item.label}</p>
                                <p className="text-sm font-bold text-gray-800 truncate">{item.value}</p>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            )}

            {/* Summary Stats */}
            {payrollData.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard icon={FaMoneyBillWave} label="Total Earnings" value={formatCurrency(totalEarnings)}
                        sub={`${payrollData.length} records`}
                        gradient="bg-gradient-to-br from-green-500 to-emerald-600" delay={0.1} />
                    <StatCard icon={FaArrowDown} label="Total Deductions" value={formatCurrency(totalDeductions)}
                        gradient="bg-gradient-to-br from-red-500 to-rose-600" delay={0.15} />
                    <StatCard icon={FaWallet} label="Net Salary" value={(totalNet < 0 ? '-' : '') + formatCurrency(totalNet)}
                        gradient={totalNet < 0 ? "bg-gradient-to-br from-orange-500 to-red-600" : "bg-gradient-to-br from-blue-500 to-indigo-600"} delay={0.2} />
                    <StatCard icon={FaCalendarAlt} label="Latest Payroll"
                        value={latestPayroll ? `${MONTHS[latestPayroll.month - 1]} ${latestPayroll.year}` : 'N/A'}
                        gradient="bg-gradient-to-br from-purple-500 to-violet-600" delay={0.25} />
                </div>
            )}

            {/* Consolidated Filter Bar */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="flex flex-col lg:flex-row lg:items-center md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-2"
            >
                <div className="flex items-center gap-4 flex-1">
                    <AdvancedDateFilter
                        value={period}
                        onChange={nextPeriod => {
                            if (nextPeriod.month && nextPeriod.year) {
                                setPeriod({
                                    month: Number(nextPeriod.month),
                                    year: Number(nextPeriod.year),
                                });
                            }
                        }}
                        tabOptions={["month"]}
                        placeholder="Select payroll month"
                        buttonClassName="bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm hover:bg-gray-50 transition-all font-bold text-gray-600 text-xs"
                    />
                    <div className="relative flex-1 w-full">
                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                        <input
                            type="text"
                            placeholder="Search by month or year..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm min-h-[42px]"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                            >
                                <FaTimes size={14} />
                            </button>
                        )}
                    </div>

                    {!loading && payrollData.length > 0 && (
                        <p className="text-sm text-gray-500 hidden xl:block">
                            <span className="font-semibold text-gray-800">{payrollData.length}</span> of{' '}
                            <span className="font-semibold text-gray-800">{pagination.total}</span> records
                            {debouncedSearch && <span className="ml-1 text-blue-600">· "{debouncedSearch}"</span>}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                    <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="blue" />
                </div>
            </motion.div>

            {/* Loading */}
            {loading && !payrollData.length && <SkeletonComponent />}

            {/* Empty */}
            {!loading && payrollData.length === 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16 bg-white rounded-xl shadow-xl"
                >
                    <FaFileInvoiceDollar className="text-8xl text-gray-300 mx-auto mb-4" />
                    <p className="text-xl text-gray-500">No payroll records found</p>
                    <p className="text-gray-400 mt-2">Your payroll data will appear here once processed</p>
                </motion.div>
            )}

            {!loading && payrollData.length > 0 && (
                <>
                    {/* ── TABLE VIEW ─────────────────────────────────────────────────────── */}
                    {viewMode === 'table' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                            className="max-w-full overflow-hidden rounded-xl bg-white shadow-xl"
                        >
                            <div className="w-full max-w-full overflow-x-auto">
                                <table className="min-w-[680px] w-full text-sm text-left text-gray-700">
                                    <thead className="xsm:hidden bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 uppercase text-xs">
                                        <tr>
                                            {visibleColumns.showPeriod && <th className="px-6 py-4">Period</th>}
                                            {visibleColumns.showEarnings && <th className="px-6 py-4">Earnings</th>}
                                            {visibleColumns.showDeductions && <th className="px-6 py-4">Deductions</th>}
                                            {visibleColumns.showNet && <th className="px-6 py-4">Net Salary</th>}
                                            {visibleColumns.showAttendance && <th className="px-6 py-4">Attendance</th>}
                                            {visibleColumns.showHours && <th className="px-6 py-4">Hours</th>}
                                            <th className="px-6 py-4 text-right"><FaCog className="w-4 h-4 ml-auto" /></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {payrollData.map((item, index) => {
                                            const p = item.payroll;
                                            const netNeg = parseFloat(p.net_salary) < 0;

                                            return (
                                                <motion.tr key={p.id}
                                                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className="cursor-pointer hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-300"
                                                    onClick={() => openViewModal(item)}
                                                >
                                                    {visibleColumns.showPeriod && (
                                                        <td className="px-6 py-4">
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                                    <FaCalendarAlt className="text-blue-500 text-sm" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-semibold text-gray-800 truncate">{MONTHS[p.month - 1]}</p>
                                                                    <p className="text-xs text-gray-500">{p.year}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.showEarnings && (
                                                        <td className="px-6 py-4">
                                                            <span className="text-green-600 font-semibold">{formatCurrency(p.total_earnings)}</span>
                                                        </td>
                                                    )}
                                                    {visibleColumns.showDeductions && (
                                                        <td className="px-6 py-4">
                                                            <span className="text-red-500 font-semibold">{formatCurrency(p.total_deductions)}</span>
                                                        </td>
                                                    )}
                                                    {visibleColumns.showNet && (
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`font-bold text-lg ${netNeg ? 'text-orange-600' : 'text-blue-600'}`}>
                                                                    {netNeg ? '-' : ''}{formatCurrency(p.net_salary)}
                                                                </span>
                                                                {netNeg && <FaExclamationTriangle className="flex-shrink-0 text-orange-400 text-xs" title="Deficit" />}
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.showAttendance && (
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-1 text-xs">
                                                                <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                                    ✓ {formatDays(p.attendance?.present_days || 0)}d
                                                                </span>
                                                                <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                                    ✗ {formatDays(p.attendance?.absent_days || 0)}d
                                                                </span>
                                                                {parseFloat(p.attendance?.paid_leave_days || 0) > 0 && (
                                                                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                                        PL {formatDays(p.attendance.paid_leave_days)}d
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.showHours && (
                                                        <td className="px-6 py-4">
                                                            <div className="text-xs text-gray-600 space-y-0.5">
                                                                <p>{parseFloat(p.worked_hours || 0).toFixed(1)}h worked</p>
                                                                {parseFloat(p.overtime_hours || 0) > 0 && (
                                                                    <p className="text-purple-600">+{parseFloat(p.overtime_hours).toFixed(1)}h OT</p>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                        <ActionMenu
                                                            activeId={activeActionMenu}
                                                            onToggle={(e, id) => setActiveActionMenu((curr) => (curr === id ? null : id))}
                                                            menuId={`table-${p.id}`}
                                                            actions={[
                                                                {
                                                                    label: 'View Details',
                                                                    icon: <FaEye />,
                                                                    onClick: () => openViewModal(item),
                                                                    className: "text-green-600 hover:text-green-700 hover:bg-green-50",
                                                                },
                                                                {
                                                                    label: 'Download PDF',
                                                                    icon: <FaDownload />,
                                                                    onClick: () => handleDownloadPdf(item),
                                                                    className: "text-blue-600 hover:text-blue-700 hover:bg-blue-50",
                                                                    
                                                                }
                                                            ]}
                                                        />
                                                    </td>
                                                </motion.tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}

                    {/* ── CARD VIEW ──────────────────────────────────────────────────────── */}
                    {viewMode === 'card' && (
                        <ManagementGrid viewMode={viewMode}>
                            {payrollData.map((item, index) => {
                                const p = item.payroll;
                                const netNeg = parseFloat(p.net_salary) < 0;

                                return (
                                    <motion.div key={p.id}
                                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="bg-white rounded-xl shadow-md border border-gray-100 p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                                        onClick={() => openViewModal(item)}
                                    >
                                        {/* Card Header */}
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl shadow-md">
                                                <FaCalendarAlt className="text-white text-xl" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div>
                                                    <div>
                                                        <h3 className="font-bold text-lg text-gray-800">{MONTHS[p.month - 1]}</h3>
                                                        <p className="text-xs text-gray-500 font-mono mt-0.5">{p.year} · #{p.id}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Salary Grid */}
                                        <div className="grid grid-cols-3 gap-2 mb-4">
                                            <div className="text-center p-2.5 bg-green-50 rounded-xl border border-green-100">
                                                <FaArrowUp className="text-green-500 text-xs mx-auto mb-1" />
                                                <p className="text-xs text-gray-500">Earnings</p>
                                                <p className="text-sm font-bold text-green-600 mt-0.5">{formatCurrency(p.total_earnings)}</p>
                                            </div>
                                            <div className="text-center p-2.5 bg-red-50 rounded-xl border border-red-100">
                                                <FaArrowDown className="text-red-500 text-xs mx-auto mb-1" />
                                                <p className="text-xs text-gray-500">Deductions</p>
                                                <p className="text-sm font-bold text-red-500 mt-0.5">{formatCurrency(p.total_deductions)}</p>
                                            </div>
                                            <div className={`text-center p-2.5 rounded-xl border ${netNeg ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100'}`}>
                                                <FaWallet className={`text-xs mx-auto mb-1 ${netNeg ? 'text-orange-500' : 'text-blue-500'}`} />
                                                <p className="text-xs text-gray-500">Net</p>
                                                <p className={`text-sm font-bold mt-0.5 ${netNeg ? 'text-orange-600' : 'text-blue-600'}`}>
                                                    {netNeg ? '-' : ''}{formatCurrency(p.net_salary)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Attendance pills */}
                                        <div className="flex flex-wrap gap-1.5 mb-4">
                                            <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2.5 py-1 rounded-full">
                                                ✓ {formatDays(p.attendance?.present_days || 0)}d Present
                                            </span>
                                            <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-full">
                                                ✗ {formatDays(p.attendance?.absent_days || 0)}d Absent
                                            </span>
                                            {parseFloat(p.attendance?.paid_leave_days || 0) > 0 && (
                                                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full">
                                                    PL {formatDays(p.attendance.paid_leave_days)}d
                                                </span>
                                            )}
                                            {parseFloat(p.attendance?.lop_days || 0) > 0 && (
                                                <span className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-full">
                                                    LOP {formatDays(p.attendance.lop_days)}d
                                                </span>
                                            )}
                                        </div>

                                        {/* Footer */}
                                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                                <FaRegClock className="text-gray-400" />
                                                <span>{parseFloat(p.worked_hours || 0).toFixed(1)}h worked</span>
                                                {parseFloat(p.overtime_hours || 0) > 0 && (
                                                    <span className="text-purple-600">+{parseFloat(p.overtime_hours).toFixed(1)}h OT</span>
                                                )}
                                            </div>
                                            <ActionMenu
                                                activeId={activeActionMenu}
                                                onToggle={(e, id) => setActiveActionMenu((curr) => (curr === id ? null : id))}
                                                menuId={`card-${p.id}`}
                                                actions={[
                                                    {
                                                        label: 'View Details',
                                                        icon: <FaEye />,
                                                        onClick: () => openViewModal(item)
                                                    },
                                                    {
                                                        label: 'Download PDF',
                                                        icon: <FaDownload />,
                                                        onClick: () => handleDownloadPdf(item)
                                                    }
                                                ]}
                                            />
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </ManagementGrid>
                    )}

                    {/* Pagination */}
                    <Pagination
                        currentPage={pagination.page}
                        totalItems={pagination.total}
                        itemsPerPage={pagination.limit}
                        onPageChange={handlePageChange}
                        showInfo={true}
                        onLimitChange={changeLimit}
                    />
                </>
            )}

            {/* Download Confirm Modal */}
            <AnimatePresence>
                {modalType === MODAL_TYPES.CONFIRM_DOWNLOAD && selectedPayroll && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
                        onClick={closeModal}
                    >
                        <ModalScrollLock />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                                        <FaDownload className="text-white text-sm" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-slate-900">Download Payslip</h2>
                                        <p className="text-xs text-slate-500 mt-0.5">Choose format before downloading</p>
                                    </div>
                                </div>
                                <button type="button" onClick={closeModal} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-gray-100 transition-all">
                                    <FaTimes className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-6 space-y-4">
                                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                                    <div className="bg-white p-2.5 rounded-xl shadow-sm text-blue-500">
                                        <FaFileInvoiceDollar size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-800 text-sm">{MONTHS[selectedPayroll.payroll?.month - 1]} {selectedPayroll.payroll?.year}</p>
                                        <p className="text-xs text-gray-500 mt-0.5 font-mono">#{selectedPayroll.payroll?.id}</p>
                                    </div>
                                </div>

                                {/* Type Toggle */}
                                <div className="flex items-center justify-between p-4 rounded-xl border border-blue-100 bg-blue-50">
                                    <div>
                                        <div className="text-sm font-semibold text-gray-800">Payslip Format</div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {isSummary ? 'Summary — key totals only.' : 'Details — full breakdown.'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-semibold select-none cursor-pointer transition-colors ${!isSummary ? 'text-gray-800' : 'text-gray-400'}`} onClick={() => setIsSummary(false)}>Details</span>
                                        <button
                                            type="button"
                                            onClick={() => setIsSummary(v => !v)}
                                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isSummary ? 'bg-blue-500' : 'bg-gray-300'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isSummary ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                        <span className={`text-xs font-semibold select-none cursor-pointer transition-colors ${isSummary ? 'text-blue-700' : 'text-gray-400'}`} onClick={() => setIsSummary(true)}>Summary</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={closeModal} className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-white transition-all text-sm">Cancel</button>
                                <button
                                    onClick={handleConfirmDownload}
                                    disabled={!downloadAccess.allowed}
                                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <FaDownload size={13} /> Download PDF
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* View Modal */}
            <AnimatePresence>
                {modalType === MODAL_TYPES.VIEW && (
                    <motion.div variants={mySalaryBackdropVariants} initial="hidden" animate="visible" exit="exit"
                        className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
                        onClick={closeModal}
                    >
                        <ModalScrollLock />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative w-full max-w-4xl max-h-[80vh] m-auto flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <PayrollViewModal payroll={selectedPayroll} employee={employee} onClose={closeModal} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </ManagementHub>
        </>
    );
};

export default MyPayroll;
