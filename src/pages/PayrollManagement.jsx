import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    FaEdit, FaTrash, FaEye, FaTimes, FaCheck, FaUserCircle,
    FaSearch, FaSpinner, FaCalendarAlt,
    FaMoneyBillWave, FaChartLine, FaExclamationTriangle,
    FaCheckCircle, FaCheckSquare, FaFileInvoiceDollar, FaClock, FaPlus,
    FaDownload, FaSave, FaCalculator, FaClipboardList,
    FaTh, FaListUl, FaBriefcase, FaEnvelope, FaIdCard,
    FaUsers, FaUserFriends, FaUser, FaCog, FaAngleDoubleRight, FaAngleDoubleLeft
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import Select from '../components/SelectField';
import { toast } from 'react-toastify';
import apiCall from '../utils/api';
import SkeletonComponent from '../components/SkeletonComponent';
import Pagination, { usePagination } from '../components/PaginationComponent';
import ModalScrollLock from '../components/ModalScrollLock';
import ActionMenu from '../components/ActionMenu';
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import usePermissionAccess from '../hooks/usePermissionAccess';
import { EmployeeSelect, ManagementButton, RefreshButton } from '../components/common';
import AdvancedDateFilter from '../components/AdvancedDateFilter';
import ProfileAvatar from '../components/common/ProfileAvatar';
import useEmployeeNavigation from '../hooks/useEmployeeNavigation';
import Modal from '../components/Modal';
import CurrencyIcon from "../components/common/CurrencyIcon";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODAL_TYPES = {
    NONE: 'NONE',
    VIEW: 'VIEW',
    GENERATE: 'GENERATE',
    CONFIRM_GENERATE: 'CONFIRM_GENERATE',
    SEND_EMAIL: 'SEND_EMAIL',
    CONFIRM_DOWNLOAD: 'CONFIRM_DOWNLOAD',
};

const modalVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", duration: 0.5 } },
    exit: { opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.3 } }
};

const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
};

const PAYROLL_REQUEST_CACHE_TTL = 5000;
const payrollListRequestCache = new Map();

const getPayrollListCacheKey = ({ companyId, page, limit, month, year }) =>
    `${companyId ?? 'none'}|${page}|${limit}|${month}|${year}`;

const GENERATION_MODES = {
    INDIVIDUAL: 'individual',
    MULTIPLE: 'multiple',
    ALL: 'all'
};

const PAYROLL_ROW_TYPES = {
    GENERATED: 'generated',
    PREVIEW: 'preview',
};

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

// Normalize the entire payroll list (handles both array and {generated_payrolls, preview_payrolls} shapes)
const normalizePayrollList = (data) => {
    if (Array.isArray(data)) {
        return data.map(item => ({
            ...item,
            rowType: item?.rowType || (item?.payroll?.id ? PAYROLL_ROW_TYPES.GENERATED : PAYROLL_ROW_TYPES.PREVIEW),
        }));
    }

    const generatedPayrolls = Array.isArray(data?.generated_payrolls) ? data.generated_payrolls : [];
    const previewPayrolls = Array.isArray(data?.preview_payrolls) ? data.preview_payrolls : [];

    return [
        ...generatedPayrolls.map(item => ({ ...item, rowType: PAYROLL_ROW_TYPES.GENERATED })),
        ...previewPayrolls.map(item => ({ ...item, rowType: PAYROLL_ROW_TYPES.PREVIEW })),
    ];
};

// Normalize a single payroll item to ensure consistent structure for attendance and work
const normalizePayrollItem = (item) => {
    const payroll = item?.payroll;
    if (!payroll) return item;

    // Normalize attendance
    let attendance;
    if (payroll.attendance && typeof payroll.attendance === 'object') {
        attendance = payroll.attendance;
    } else {
        attendance = {
            working_days: payroll.working_days ?? 0,
            present_days: payroll.present_days ?? 0,
            absent_days: payroll.absent_days ?? 0,
            paid_leave_days: payroll.paid_leave_days ?? 0,
            unpaid_leave_days: payroll.unpaid_leave_days ?? 0,
        };
    }

    // Normalize work (convert minutes to hours where needed)
    let work;
    if (payroll.work && typeof payroll.work === 'object') {
        work = {
            worked_hours: (payroll.work.worked_minutes ?? 0) / 60,
            overtime_hours: (payroll.work.overtime_minutes ?? 0) / 60,
            deduction_minutes: payroll.work.deduction_minutes ?? 0,
        };
    } else {
        work = {
            worked_hours: (payroll.worked_minutes ?? 0) / 60,
            overtime_hours: (payroll.overtime_minutes ?? 0) / 60,
            deduction_minutes: payroll.deduction_minutes ?? 0,
        };
    }

    // Ensure month/year are present (extract from payroll_period if missing)
    let month = payroll.month;
    let year = payroll.year;
    if (!month || !year) {
        const period = payroll.payroll_period ? new Date(payroll.payroll_period) : null;
        if (period && !isNaN(period.getTime())) {
            month = period.getMonth() + 1;
            year = period.getFullYear();
        }
    }

    return {
        ...item,
        payroll: {
            ...payroll,
            attendance,
            work,
            month: month || undefined,
            year: year || undefined,
        },
    };
};

// ─── Helper Components ───────────────────────────────────────────────────────

const InfoItem = ({ icon, label, value, valueClassName = '' }) => (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-2">
            {icon}{label}
        </label>
        <div className={`text-gray-800 font-medium ${valueClassName}`}>{value}</div>
    </div>
);

const ToggleSwitch = ({ isOn, onToggle, accent = "green", size = "md" }) => (
    <div
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`${size === 'sm' ? 'h-5 w-9' : 'h-5 w-10'} flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ${isOn ? `bg-${accent}-500 shadow-inner` : 'bg-gray-300'}`}
    >
        <motion.div
            className={`${size === 'sm' ? 'h-3 w-3': 'h-4 w-4'} bg-white rounded-full shadow-md`}
            initial={false}
            animate={{ x: isOn ? (size === 'sm' ? 16 : 20) : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
    </div>
);

const StatusBadge = ({ status }) => {
    const normalizedStatus = String(status || 'generated').toLowerCase();
    const statusStyles = {
        generated: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        preview: 'bg-amber-50 text-amber-700 border-amber-200',
        paid: 'bg-blue-50 text-blue-700 border-blue-200',
        pending: 'bg-amber-50 text-amber-700 border-amber-200',
        failed: 'bg-red-50 text-red-700 border-red-200',
        cancelled: 'bg-slate-50 text-slate-600 border-slate-200',
    };
    const label = normalizedStatus
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    return (
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${statusStyles[normalizedStatus] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
            {label}
        </span>
    );
};


const PayrollManagement = () => {
    const navigateToEmployeeProfile = useEmployeeNavigation();
    const { checkActionAccess, getAccessMessage } = usePermissionAccess();
    const [payrollList, setPayrollList] = useState([]);
    const [employeeList, setEmployeeList] = useState([]);
    const [employeesLoading, setEmployeesLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [modalType, setModalType] = useState(MODAL_TYPES.NONE);
    const [selectedPayroll, setSelectedPayroll] = useState(null);
    const [activeActionMenu, setActiveActionMenu] = useState(null);
    const [viewMode, setViewMode] = useState('table');
    const [selectedIds, setSelectedIds] = useState([]);

    const [availableSearch, setAvailableSearch] = useState('');
    const [selectedSearch, setSelectedSearch] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [isEmailing, setIsEmailing] = useState(false);
    const [isSummary, setIsSummary] = useState(true);
    const [emailOverride, setEmailOverride] = useState('');
    const [previewGenerateSendPdf, setPreviewGenerateSendPdf] = useState(true);

    const currentDate = new Date();
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

    const [generationMode, setGenerationMode] = useState(GENERATION_MODES.INDIVIDUAL);
    const [generateFormData, setGenerateFormData] = useState({
        employee_id: null,
        employee_ids: [],
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        send_pdf: false,
    });

    const {
        pagination,
        updatePagination,
        goToPage,
        changeLimit,
    } = usePagination(1, 20);

    const isMounted = useRef(true);
    const fetchInProgress = useRef(false);
    const payrollListRequestId = useRef(0);
    const initialFetchDone = useRef(false);
    const isInitialLoad = useRef(true);

    const viewPayrollAccess = checkActionAccess('payrollManagement', 'read');
    const generatePayrollAccess = checkActionAccess('payrollManagement', 'create');
    const downloadPayrollAccess = checkActionAccess('payrollManagement', 'read');
    const emailPayrollAccess = checkActionAccess('payrollManagement', 'read');

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    // ─── API Calls ────────────────────────────────────────────────────────────────

    const fetchEmployees = useCallback(async () => {
        setEmployeesLoading(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const companyId = company?.id ?? null;

            // Fetch all employees
            const response = await apiCall('/employees/all-list', 'GET', null, companyId);
            const result = await response.json();

            if (result.success) {
                setEmployeeList(result.data || []);
            } else {
                throw new Error(result.message || 'Failed to fetch employees');
            }
        } catch (e) {
            console.error(e);
            toast.error('Failed to load employees');
        } finally {
            setEmployeesLoading(false);
        }
    }, []);

    const fetchPayrollList = useCallback(async (page = pagination.page, resetLoading = true) => {
        const requestId = ++payrollListRequestId.current;
        fetchInProgress.current = true;
        if (resetLoading) setLoading(true);

        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const companyId = company?.id ?? null;
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pagination.limit.toString(),
                month: selectedMonth.toString(),
                year: selectedYear.toString()
            });

            const requestKey = getPayrollListCacheKey({
                companyId,
                page,
                limit: pagination.limit,
                month: selectedMonth,
                year: selectedYear
            });
            const cachedEntry = payrollListRequestCache.get(requestKey);
            let result;

            if (cachedEntry?.data && cachedEntry.expiresAt > Date.now()) {
                result = cachedEntry.data;
            } else if (cachedEntry?.promise) {
                result = await cachedEntry.promise;
            } else {
                const requestPromise = (async () => {
                    const response = await apiCall(`/payroll/list?${params}`, 'GET', null, companyId);
                    const json = await response.json();
                    if (!json.success) {
                        throw new Error(json.message || 'Failed to fetch payroll');
                    }
                    payrollListRequestCache.set(requestKey, {
                        data: json,
                        expiresAt: Date.now() + PAYROLL_REQUEST_CACHE_TTL
                    });
                    return json;
                })().catch((error) => {
                    payrollListRequestCache.delete(requestKey);
                    throw error;
                });

                payrollListRequestCache.set(requestKey, { promise: requestPromise });
                result = await requestPromise;
            }

            if (requestId !== payrollListRequestId.current) return;

            if (result.success) {
                // Normalize the list: first convert shape, then normalize each item
                const normalizedPayrolls = normalizePayrollList(result.data).map(normalizePayrollItem);
                setPayrollList(normalizedPayrolls);
                
                const currentPage = Number(result.pagination?.page ?? result.meta?.page ?? result.page ?? page);
                const perPage = Number(result.pagination?.limit ?? result.meta?.limit ?? result.limit ?? pagination.limit);
                const total = Number(
                    result.pagination?.total ??
                    result.meta?.total ??
                    result.total ??
                    normalizedPayrolls.length ??
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
            if (requestId === payrollListRequestId.current) {
                setLoading(false);
                fetchInProgress.current = false;
                isInitialLoad.current = false;
            }
        }
    }, [pagination.page, pagination.limit, selectedMonth, selectedYear, updatePagination]);

    useEffect(() => {
        if (!initialFetchDone.current) {
            fetchPayrollList(1, true);
            initialFetchDone.current = true;
        }
    }, [fetchPayrollList]);

    useEffect(() => {
        if (!isInitialLoad.current && initialFetchDone.current) {
            fetchPayrollList(pagination.page, true);
        }
    }, [pagination.page, fetchPayrollList]);

    useEffect(() => {
        setSelectedIds(prev => {
            const currentIds = new Set(payrollList.map(item => item?.payroll?.id).filter(Boolean));
            return prev.filter(id => currentIds.has(id));
        });
    }, [payrollList]);

    const generatePayroll = async (mode, data) => {
        setLoading(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const payload = {
                employee_id: data.employee_ids,
                month: data.month,
                year: data.year,
                send_pdf: data.send_pdf ?? false,
            };

            const response = await apiCall('/payroll/generate-payroll', 'POST', payload, company?.id);
            const result = await response.json();
            if (result.success) {
                payrollListRequestCache.clear();
                await fetchPayrollList(pagination.page, false);
                return { success: true };
            }
            throw new Error(result.message || 'Generation failed');
        } catch (e) {
            return { success: false, error: e.message };
        } finally { setLoading(false); }
    };

    // ─── Modal Handlers ──────────────────────────────────────────────────────

    const openViewModal = (payrollData) => {
        setSelectedPayroll(payrollData);
        setModalType(MODAL_TYPES.VIEW);
        setActiveActionMenu(null);
    };

    const openGenerateModal = async () => {
        if (generatePayrollAccess.disabled) return;
        setGenerationMode(GENERATION_MODES.INDIVIDUAL);
        setGenerateFormData({
            employee_id: null,
            employee_ids: [],
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear(),
            send_pdf: false,
        });
        setModalType(MODAL_TYPES.GENERATE);
        setAvailableSearch('');
        setSelectedSearch('');

        // Fetch employees when modal opens
        await fetchEmployees();
    };

    const openPreviewGenerateConfirm = (item) => {
        if (generatePayrollAccess.disabled) return;
        setSelectedPayroll(item);
        setPreviewGenerateSendPdf(true);
        setModalType(MODAL_TYPES.CONFIRM_GENERATE);
        setActiveActionMenu(null);
    };

    const openEmailModal = (item) => {
        if (emailPayrollAccess.disabled) return;
        setSelectedPayroll(item);
        setEmailOverride('');
        setModalType(MODAL_TYPES.SEND_EMAIL);
        setActiveActionMenu(null);
    };

    const openBulkEmailModal = () => {
        if (selectedIds.length === 0 || emailPayrollAccess.disabled) return;
        setSelectedPayroll(null);
        setEmailOverride('');
        setModalType(MODAL_TYPES.SEND_EMAIL);
        setActiveActionMenu(null);
    };

    const closeModal = () => {
        setModalType(MODAL_TYPES.NONE);
        setSelectedPayroll(null);
    };

    const getPayrollEntryId = (item) => item?.payroll?.id;

    const visiblePayrollIds = payrollList.map(getPayrollEntryId).filter(Boolean);
    const allVisibleSelected = visiblePayrollIds.length > 0 && visiblePayrollIds.every(id => selectedIds.includes(id));

    const toggleSelectAll = () => {
        setSelectedIds(prev => {
            if (allVisibleSelected) {
                const visibleSet = new Set(visiblePayrollIds);
                return prev.filter(id => !visibleSet.has(id));
            }
            return Array.from(new Set([...prev, ...visiblePayrollIds]));
        });
    };

    const toggleSelectRow = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]);
    };

    // ─── Form Handlers ───────────────────────────────────────────────────────

    const handleGenerate = async (e) => {
        e.preventDefault();

        if (!generateFormData.employee_ids || generateFormData.employee_ids.length === 0) {
            toast.warning('Please select at least one employee');
            return;
        }

        const result = await generatePayroll(GENERATION_MODES.MULTIPLE, {
            employee_ids: generateFormData.employee_ids,
            month: generateFormData.month,
            year: generateFormData.year,
            send_pdf: generateFormData.send_pdf,
        });

        if (result.success) {
            toast.success(`Payroll generated for ${generateFormData.employee_ids.length} employees successfully!`);
            closeModal();
        } else {
            toast.error(result.error || 'Failed to generate payroll');
        }
    };

    const handleConfirmPreviewGenerate = async () => {
        if (!selectedPayroll?.employee?.id) {
            toast.error('Employee details not found');
            return;
        }

        const result = await generatePayroll(GENERATION_MODES.INDIVIDUAL, {
            employee_ids: [selectedPayroll.employee.id],
            month: selectedPayroll.payroll?.month ?? selectedMonth,
            year: selectedPayroll.payroll?.year ?? selectedYear,
            send_pdf: previewGenerateSendPdf,
        });

        if (result.success) {
            toast.success('Payroll generated successfully!');
            closeModal();
        } else {
            toast.error(result.error || 'Failed to generate payroll');
        }
    };

    const handlePeriodFilterApply = useCallback((result) => {
        const fallbackMonth = currentDate.getMonth() + 1;
        const fallbackYear = currentDate.getFullYear();

        let nextMonth = fallbackMonth;
        let nextYear = fallbackYear;

        if (result?.month && result?.year) {
            nextMonth = Number(result.month);
            nextYear = Number(result.year);
        } else if (result?.date) {
            const parsed = new Date(`${result.date}T00:00:00`);
            if (!Number.isNaN(parsed.getTime())) {
                nextMonth = parsed.getMonth() + 1;
                nextYear = parsed.getFullYear();
            }
        } else if (result?.from_date) {
            const parsed = new Date(`${result.from_date}T00:00:00`);
            if (!Number.isNaN(parsed.getTime())) {
                nextMonth = parsed.getMonth() + 1;
                nextYear = parsed.getFullYear();
            }
        }

        setSelectedMonth(nextMonth);
        setSelectedYear(nextYear);

        if (pagination.page !== 1) {
            goToPage(1);
        }
    }, [currentDate, goToPage, pagination.page]);

    const getPayrollPdfFilename = (payrollItem) => {
        const month = Number(payrollItem?.payroll?.month ?? selectedMonth);
        const year = Number(payrollItem?.payroll?.year ?? selectedYear);
        const normalizedMonth = Number.isFinite(month) ? String(month).padStart(2, '0') : 'month';
        const normalizedYear = Number.isFinite(year) ? String(year) : 'year';
        return `${normalizedMonth}_${normalizedYear}_payroll.pdf`;
    };

    const handleDownloadPdf = (payrollItem) => {
        if (downloadPayrollAccess.disabled) return;
        const payrollEntryId = payrollItem?.payroll?.id;
        if (!payrollEntryId) {
            toast.error('Payroll entry ID not found');
            return;
        }
        setSelectedPayroll(payrollItem);
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
            const response = await apiCall('/payroll/download', 'POST', { payroll_entry_id: payrollEntryId, type: isSummary ? 'summary' : 'detailed' }, companyId);

            if (!response.ok) {
                let errorMessage = 'Failed to download payslip';
                try {
                    const errorResult = await response.json();
                    errorMessage = errorResult?.message || errorMessage;
                } catch {
                    // Keep fallback message when the server does not return JSON.
                }
                throw new Error(errorMessage);
            }

            const filename = getPayrollPdfFilename(selectedPayroll);
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

    const handleConfirmSendEmail = async (e) => {
        if (e) e.preventDefault();
        const payrollIds = selectedPayroll ? [selectedPayroll.payroll.id] : selectedIds;
        if (!payrollIds.length) return;

        setIsEmailing(true);
        const isBulkEmail = !selectedPayroll;
        closeModal();

        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const companyId = company?.id ?? null;
            const payload = { payroll_entry_id: payrollIds, type: isSummary ? 'summary' : 'details' };
            if (emailOverride && emailOverride.trim()) {
                payload.email = emailOverride.trim();
            }
            const response = await apiCall('/payroll/send-email', 'POST', payload, companyId);
            const result = await response.json();
            if (result.success) {
                toast.success(result.message || `Email sent for ${payrollIds.length} payroll record${payrollIds.length > 1 ? 's' : ''}`);
                if (isBulkEmail) {
                    setSelectedIds([]);
                }
            } else {
                throw new Error(result.message || 'Failed to send email');
            }
        } catch (error) {
            toast.error(error.message || 'Failed to send email');
        } finally {
            setIsEmailing(false);
        }
    };

    // ─── Helpers ─────────────────────────────────────────────────────────────

    const formatCurrency = (amount) => {
        const num = parseFloat(amount);
        if (isNaN(num)) return '₹0.00';
        return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatDays = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return '0';
        return Number.isInteger(num) ? String(num) : num.toFixed(1);
    };

    const getMonthName = (monthNum) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[monthNum - 1] || '';
    };

    // ─── Responsive Columns ──────────────────────────────────────────────────

    const [visibleColumns, setVisibleColumns] = useState(() => ({
        showName: true,
        showDesignation: window.innerWidth >= 768,
        showNetSalary: true,
        showEarnings: window.innerWidth >= 1100,
        showDeductions: window.innerWidth >= 1100,
        showAttendance: window.innerWidth >= 1440,
    }));

    useEffect(() => {
        let t;
        const onResize = () => {
            clearTimeout(t);
            t = setTimeout(() => setVisibleColumns({
                showName: true,
                showDesignation: window.innerWidth >= 768,
                showNetSalary: true,
                showEarnings: window.innerWidth >= 1100,
                showDeductions: window.innerWidth >= 1100,
                showStatus: window.innerWidth >= 640,
                showAttendance: window.innerWidth >= 1440,
            }), 150);
        };
        window.addEventListener('resize', onResize);
        return () => { clearTimeout(t); window.removeEventListener('resize', onResize); };
    }, []);

    const handlePageChange = useCallback((newPage) => {
        if (newPage !== pagination.page) {
            goToPage(newPage);
        }
    }, [pagination.page, goToPage]);

    const customSelectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: "48px",
            backgroundColor: "#f9fafb",
            fontSize: "0.875rem",
            borderColor: state.isFocused ? "#6366f1" : "#e2e8f0",
            boxShadow: state.isFocused ? "0 0 0 4px rgba(99, 102, 241, 0.10)" : "none",
            "&:hover": { borderColor: "#cbd5e1" },
            borderRadius: "0.75rem",
            padding: "0 0.5rem"
        }),
        valueContainer: (base) => ({
            ...base,
            padding: "0 14px",
            fontSize: "0.875rem",
        }),
        input: (base) => ({
            ...base,
            margin: 0,
            padding: 0,
            fontSize: "0.875rem",
        }),
        placeholder: (base) => ({
            ...base,
            color: "#94a3b8",
            fontWeight: 500,
            fontSize: "0.875rem",
        }),
        singleValue: (base) => ({
            ...base,
            color: "#334155",
            fontWeight: 500,
            fontSize: "0.875rem",
        }),
        option: (base, state) => ({
            ...base,
            fontSize: "0.875rem",
            backgroundColor: state.isSelected ? "#6366f1" : state.isFocused ? "#f1f5f9" : "white",
            color: state.isSelected ? "white" : "#1e293b",
            "&:active": { backgroundColor: "#6366f1" }
        }),
    };

    // Month options
    const monthOptions = Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: new Date(2000, i).toLocaleString('default', { month: 'long' })
    }));

    // Year options (current year ± 5 years)
    const yearOptions = Array.from({ length: 11 }, (_, i) => {
        const year = currentDate.getFullYear() - 5 + i;
        return { value: year, label: year.toString() };
    });

    // Dual-List Computations for MULTIPLE mode
    const availableEmployees = useMemo(() => {
        return employeeList
            .filter(emp => !generateFormData.employee_ids.includes(emp.id))
            .filter(emp => emp.name.toLowerCase().includes(availableSearch.toLowerCase()) ||
                emp.employee_code.toLowerCase().includes(availableSearch.toLowerCase()));
    }, [employeeList, generateFormData.employee_ids, availableSearch]);

    const selectedEmployees = useMemo(() => {
        return employeeList
            .filter(emp => generateFormData.employee_ids.includes(emp.id))
            .filter(emp => emp.name.toLowerCase().includes(selectedSearch.toLowerCase()) ||
                emp.employee_code.toLowerCase().includes(selectedSearch.toLowerCase()));
    }, [employeeList, generateFormData.employee_ids, selectedSearch]);

    // Avatar styling helper for dual list
    const AVATAR_GRADIENTS = [
        'from-blue-500 to-indigo-600',
        'from-purple-500 to-pink-600',
        'from-green-500 to-teal-600',
        'from-orange-500 to-amber-500',
        'from-rose-500 to-red-600',
        'from-cyan-500 to-blue-500',
    ];
    const getInitials = (name = '') => name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const avatarGradient = (id) => AVATAR_GRADIENTS[id % AVATAR_GRADIENTS.length];

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="space-y-3 relative min-w-0 max-w-full overflow-x-hidden">
            
            {/* Full Page Loader for PDF Download */}
            <AnimatePresence>
                {(isDownloading || isEmailing) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center"
                    >
                        <FaSpinner className={`animate-spin text-5xl mb-4 ${isDownloading ? 'text-emerald-600' : 'text-purple-600'}`} />
                        <p className="text-gray-800 font-semibold shadow-sm px-5 py-2.5 bg-white rounded-xl border border-gray-100 flex items-center gap-2">
                            {isDownloading ? (
                                <>
                                    <FaFileInvoiceDollar className="text-emerald-500" />
                                    Preparing PDF Payslip...
                                </>
                            ) : (
                                <>
                                    <FaEnvelope className="text-purple-500" />
                                    Sending Email...
                                </>
                            )}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
            >
                <div>
                    <p className="inline-flex items-center gap-1 rounded-full border px-2  text-[9px] font-bold uppercase tracking-[0.14em] from-green-600 to-emerald-600 text-green-700 border-green-200">
                        Payroll Overview
                    </p>
                    <h1 className="mt-1 text-lg font-bold text-slate-900 md:text-xl">
                        Payroll Management
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Generate and manage employee payroll records with integrated attendance data.
                    </p>
                </div>
                <div className="flex items-center gap-3 justify-end">
                    <RefreshButton loading={loading} onClick={() => {
                        fetchPayrollList(1, true);
                    }}>
                        Refresh
                    </RefreshButton>
                    <button
                        onClick={openGenerateModal}
                        disabled={generatePayrollAccess.disabled}
                        title={generatePayrollAccess.disabled ? getAccessMessage(generatePayrollAccess) : ''}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold"
                    >
                        <FaPlus size={14} />
                        Generate Payroll
                    </button>
                </div>
            </motion.div>

            {/* ─── Consolidated Filter & View Bar ─── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex w-full justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6"
            >
                {/* Left Section: Time Period Filters */}
                <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
                    <div className="w-full sm:w-auto">
                        <AdvancedDateFilter
                            value={{ month: selectedMonth, year: selectedYear }}
                            onChange={handlePeriodFilterApply}
                            placeholder={`${getMonthName(selectedMonth)} ${selectedYear}`}
                            buttonClassName="inline-flex w-full min-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-green-200 hover:bg-green-50"
                            tabOptions={["month"]}
                        />
                    </div>
                </div>

                {/* Right Section: Controls */}
                <div className="flex items-center gap-4">
                    {/* View Switcher */}
                    <div>
                        <ManagementViewSwitcher
                            viewMode={viewMode}
                            onChange={setViewMode}
                            accent="green"
                        />
                    </div>
                </div>
            </motion.div>

            {loading && !payrollList.length && <SkeletonComponent />}

            {!loading && payrollList.length === 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16 bg-white rounded-xl shadow-xl"
                >
                    <FaFileInvoiceDollar className="text-8xl text-gray-300 mx-auto mb-4" />
                    <p className="text-xl text-gray-500">No payroll records found</p>
                    <p className="text-gray-400 mt-2">Generate payroll for {getMonthName(selectedMonth)} {selectedYear}</p>
                </motion.div>
            )}

            {!loading && payrollList.length > 0 && (
                <>
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col gap-3"
                    >
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={toggleSelectAll}
                                className="inline-flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs font-bold text-green-700 transition hover:bg-green-100"
                            >
                                {allVisibleSelected
                                    ? <><FaCheckSquare size={13} /> Deselect all</>
                                    : <><FaCheck size={13} /> Select all</>
                                }
                            </button>
                            {selectedIds.length > 0 && (
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    {selectedIds.length} selected
                                </span>
                            )}
                        </div>
                    </motion.div>

                    {viewMode === 'table' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                            className="max-w-full overflow-hidden rounded-xl bg-white shadow-xl"
                        >
                            <div className="w-full max-w-full overflow-x-auto">
                                <table className="min-w-[680px] w-full text-sm text-left text-gray-700">
                                    <thead className="xsm:hidden bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 uppercase text-xs">
                                        <tr>
                                            {visibleColumns.showName && (
                                                <th className="px-6 py-4">
                                                    Employee
                                                </th>
                                            )}
                                            {visibleColumns.showDesignation && <th className="px-6 py-4">Designation</th>}
                                            {visibleColumns.showNetSalary && <th className="px-6 py-4">Net Salary</th>}
                                            {visibleColumns.showEarnings && <th className="px-6 py-4">Earnings</th>}
                                            {visibleColumns.showDeductions && <th className="px-6 py-4">Deductions</th>}
                                            {visibleColumns.showAttendance && <th className="px-6 py-4">Attendance</th>}
                                            <th className="px-6 py-4 text-right"><FaCog className="w-4 h-4 ml-auto" /></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {payrollList.map((item, index) => {
                                            const netSalary = parseFloat(item.payroll.net_salary);
                                            const isNegative = netSalary < 0;
                                            const isPreview = item.rowType === PAYROLL_ROW_TYPES.PREVIEW;
                                            const rowKey = item.payroll.id ?? `preview-${item.employee?.id}-${item.payroll?.month}-${item.payroll?.year}`;

                                            return (
                                                <motion.tr key={rowKey} initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className="cursor-pointer hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 transition-all duration-300"
                                                    onClick={() => openViewModal(item)}
                                                >
                                                    {visibleColumns.showName && (
                                                        <td className="px-3 py-4 font-semibold sm:px-6">
                                                            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                                                                <div className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                                                                    {isPreview ? (
                                                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                                                                            Preview
                                                                        </span>
                                                                    ) : (
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedIds.includes(item.payroll.id)}
                                                                            onChange={() => toggleSelectRow(item.payroll.id)}
                                                                            className="w-3 h-3 lg:w-4 lg:h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 focus:ring-offset-0 cursor-pointer accent-green-600"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        />
                                                                    )}
                                                                </div>
                                                                <ProfileAvatar
                                                                    record={item.employee}
                                                                    name={item.employee.name}
                                                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br from-emerald-500 to-green-600 shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                                                    onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(item.employee.id); }}
                                                                >
                                                                    {getInitials(item.employee.name)}
                                                                </ProfileAvatar>
                                                                <div className="xsm:hidden inline">
                                                                    <div
                                                                        className="text-gray-800 font-medium cursor-pointer hover:underline hover:text-indigo-600 transition-colors inline-block"
                                                                        onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(item.employee.id); }}
                                                                    >
                                                                        {item.employee.name}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">{item.employee.email}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.showDesignation && (
                                                        <td className="px-6 py-4">
                                                            <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium capitalize">
                                                                {typeof item.employee.designation === 'object' ? item.employee.designation?.label : item.employee.designation?.replace('_', ' ')}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {visibleColumns.showNetSalary && (
                                                        <td className="px-6 py-4">
                                                            <div className={`font-bold text-lg ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                                                                {formatCurrency(item.payroll.net_salary)}
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.showEarnings && (
                                                        <td className="px-6 py-4">
                                                            <div className="text-green-700 font-semibold">
                                                                {formatCurrency(item.payroll.total_earnings)}
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.showDeductions && (
                                                        <td className="px-6 py-4">
                                                            <div className="text-red-700 font-semibold">
                                                                {formatCurrency(item.payroll.total_deductions)}
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.showAttendance && (
                                                        <td className="px-6 py-4">
                                                            <div className="text-xs space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <FaCheckCircle className="text-green-500" />
                                                                    <span>{formatDays(item.payroll.attendance.present_days)} Present</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <FaExclamationTriangle className="text-red-500" />
                                                                    <span>{formatDays(item.payroll.attendance.absent_days)} Absent</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                        <ActionMenu
                                                            menuId={rowKey}
                                                            activeId={activeActionMenu}
                                                            onToggle={(e, id) => {
                                                                setActiveActionMenu((current) => (current === id ? null : id));
                                                            }}
                                                            actions={isPreview ? [
                                                                {
                                                                    label: 'View Details',
                                                                    icon: <FaEye size={14} />,
                                                                    onClick: () => openViewModal(item),
                                                                    className: 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                                                },
                                                                {
                                                                    label: 'Generate Payroll',
                                                                    icon: <FaCalculator size={14} />,
                                                                    onClick: () => openPreviewGenerateConfirm(item),
                                                                    disabled: generatePayrollAccess.disabled,
                                                                    title: generatePayrollAccess.disabled ? getAccessMessage(generatePayrollAccess) : '',
                                                                    className: 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                                                },
                                                            ] : [
                                                                {
                                                                    label: 'View Details',
                                                                    icon: <FaEye size={14} />,
                                                                    onClick: () => openViewModal(item),
                                                                    className: 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                                                },
                                                                {
                                                                    label: 'Download PDF',
                                                                    icon: <FaDownload size={14} />,
                                                                    onClick: () => handleDownloadPdf(item),
                                                                    disabled: downloadPayrollAccess.disabled,
                                                                    title: downloadPayrollAccess.disabled ? getAccessMessage(downloadPayrollAccess) : '',
                                                                    className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                                                                },
                                                                {
                                                                    label: 'Send Email',
                                                                    icon: <FaEnvelope size={14} />,
                                                                    onClick: () => openEmailModal(item),
                                                                    disabled: emailPayrollAccess.disabled,
                                                                    title: emailPayrollAccess.disabled ? getAccessMessage(emailPayrollAccess) : '',
                                                                    className: 'text-purple-600 hover:text-purple-700 hover:bg-purple-50'
                                                                },
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

                    {viewMode === 'card' && (
                        <ManagementGrid viewMode={viewMode}>
                            {payrollList.map((item, index) => {
                                const netSalary = parseFloat(item.payroll.net_salary);
                                const isNegative = netSalary < 0;
                                const isPreview = item.rowType === PAYROLL_ROW_TYPES.PREVIEW;
                                const rowKey = item.payroll.id ?? `preview-${item.employee?.id}-${item.payroll?.month}-${item.payroll?.year}`;

                                return (
                                    <motion.div key={rowKey} initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                                        className={`relative bg-white rounded-xl shadow-md border p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group ${!isPreview && selectedIds.includes(item.payroll.id) ? 'border-green-200 ring-2 ring-green-400 ring-offset-2' : 'border-gray-100'}`}
                                        onClick={() => openViewModal(item)}
                                    >
                                        <div className="absolute left-3 top-3 z-10 flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                                            {isPreview ? (
                                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                                                    Preview
                                                </span>
                                            ) : (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(item.payroll.id)}
                                                    onChange={() => toggleSelectRow(item.payroll.id)}
                                                    className="w-3 h-3 lg:w-4 lg:h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 focus:ring-offset-0 cursor-pointer accent-green-600"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            )}
                                        </div>
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-xl ml-10">
                                                <FaFileInvoiceDollar className="text-white text-3xl" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-2 relative">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <h3
                                                            className="font-bold text-lg text-gray-800 truncate cursor-pointer hover:underline hover:text-indigo-600 transition-colors pr-2"
                                                            onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(item.employee.id); }}
                                                        >
                                                            {item.employee.name}
                                                        </h3>
                                                    </div>
                                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                        <ActionMenu
                                                            menuId={`card-${rowKey}`}
                                                            activeId={activeActionMenu}
                                                            onToggle={(e, id) => {
                                                                setActiveActionMenu((current) => (current === id ? null : id));
                                                            }}
                                                            actions={isPreview ? [
                                                                {
                                                                    label: 'View Details',
                                                                    icon: <FaEye size={14} />,
                                                                    onClick: () => openViewModal(item),
                                                                    className: 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                                                },
                                                                {
                                                                    label: 'Generate Payroll',
                                                                    icon: <FaCalculator size={14} />,
                                                                    onClick: () => openPreviewGenerateConfirm(item),
                                                                    disabled: generatePayrollAccess.disabled,
                                                                    title: generatePayrollAccess.disabled ? getAccessMessage(generatePayrollAccess) : '',
                                                                    className: 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                                                },
                                                            ] : [
                                                                {
                                                                    label: 'View Details',
                                                                    icon: <FaEye size={14} />,
                                                                    onClick: () => openViewModal(item),
                                                                    className: 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                                                },
                                                                {
                                                                    label: 'Download PDF',
                                                                    icon: <FaDownload size={14} />,
                                                                    onClick: () => handleDownloadPdf(item),
                                                                    disabled: downloadPayrollAccess.disabled,
                                                                    title: downloadPayrollAccess.disabled ? getAccessMessage(downloadPayrollAccess) : '',
                                                                    className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                                                                },
                                                                {
                                                                    label: 'Send Email',
                                                                    icon: <FaEnvelope size={14} />,
                                                                    onClick: () => openEmailModal(item),
                                                                    disabled: emailPayrollAccess.disabled,
                                                                    title: emailPayrollAccess.disabled ? getAccessMessage(emailPayrollAccess) : '',
                                                                    className: 'text-purple-600 hover:text-purple-700 hover:bg-purple-50'
                                                                },
                                                            ]}
                                                        />
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded-lg inline-block">
                                                    {item.employee.employee_code}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3 mb-4">
                                            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                                                <span className="text-sm text-gray-600 flex items-center gap-2">
                                                    <CurrencyIcon className="text-green-500" size={12} />
                                                    Net Salary
                                                </span>
                                                <span className={`font-bold text-lg ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                                                    {formatCurrency(item.payroll.net_salary)}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="p-2 bg-green-50 rounded-lg">
                                                    <div className="text-xs text-gray-500">Earnings</div>
                                                    <div className="font-semibold text-green-700 text-sm">
                                                        {formatCurrency(item.payroll.total_earnings)}
                                                    </div>
                                                </div>
                                                <div className="p-2 bg-red-50 rounded-lg">
                                                    <div className="text-xs text-gray-500">Deductions</div>
                                                    <div className="font-semibold text-red-700 text-sm">
                                                        {formatCurrency(item.payroll.total_deductions)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-gray-100">
                                                <div className="text-xs font-semibold text-gray-600 mb-2">Attendance</div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="flex items-center gap-1 text-green-600">
                                                        <FaCheckCircle />
                                                        <span>{formatDays(item.payroll.attendance.present_days)} Present</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-red-600">
                                                        <FaExclamationTriangle />
                                                        <span>{formatDays(item.payroll.attendance.absent_days)} Absent</span>
                                                    </div>
                                                </div>
                                            </div>
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

            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-8 sm:bottom-8 z-[100] flex flex-wrap items-center gap-2 sm:gap-4 bg-white/90 backdrop-blur-md px-4 py-3 sm:px-6 sm:py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white/20"
                    >
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bulk Actions</span>
                            <span className="text-sm font-black text-slate-800">{selectedIds.length} Selected</span>
                        </div>
                        <div className="hidden sm:block h-10 w-px bg-gray-200 mx-1"></div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setSelectedIds([])}
                                className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Clear
                            </button>
                            <ManagementButton
                                tone="violet"
                                variant="solid"
                                leftIcon={<FaEnvelope />}
                                onClick={openBulkEmailModal}
                                disabled={isEmailing || emailPayrollAccess.disabled}
                                title={emailPayrollAccess.disabled ? getAccessMessage(emailPayrollAccess) : ''}
                                className="shadow-lg shadow-purple-200 !text-xs !px-3 !py-1.5"
                            >
                                Send Email
                            </ManagementButton>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modals */}
            <Modal
                isOpen={modalType === MODAL_TYPES.VIEW && !!selectedPayroll}
                onClose={closeModal}
                title="Payroll Details"
                subtitle={`${getMonthName(selectedPayroll?.payroll?.month ?? selectedMonth)} ${selectedPayroll?.payroll?.year ?? selectedYear}`}
                icon={<FaFileInvoiceDollar size={18} />}
                size="4xl"
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <button
                            onClick={closeModal}
                            className="px-6 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl hover:from-gray-200 hover:to-gray-300 transition-all duration-300 font-medium"
                        >
                            Close
                        </button>
                        {selectedPayroll?.rowType === PAYROLL_ROW_TYPES.PREVIEW ? (
                            <button
                                onClick={() => {
                                    closeModal();
                                    openPreviewGenerateConfirm(selectedPayroll);
                                }}
                                disabled={generatePayrollAccess.disabled}
                                title={generatePayrollAccess.disabled ? getAccessMessage(generatePayrollAccess) : ''}
                                className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-300 font-medium shadow-md shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FaCalculator size={14} /> Generate Payroll
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => {
                                        closeModal();
                                        handleDownloadPdf(selectedPayroll);
                                    }}
                                    disabled={downloadPayrollAccess.disabled}
                                    title={downloadPayrollAccess.disabled ? getAccessMessage(downloadPayrollAccess) : ''}
                                    className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 font-medium shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FaDownload size={14} /> Download PDF
                                </button>
                                <button
                                    onClick={() => {
                                        closeModal();
                                        openEmailModal(selectedPayroll);
                                    }}
                                    disabled={emailPayrollAccess.disabled}
                                    title={emailPayrollAccess.disabled ? getAccessMessage(emailPayrollAccess) : ''}
                                    className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 font-medium shadow-md shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FaEnvelope size={14} /> Send Email
                                </button>
                            </>
                        )}
                    </div>
                }
            >
                {selectedPayroll && (
                    <div className="grid grid-cols-1 gap-6">
                        {/* Employee Info */}
                        <div className="col-span-1 pb-6 border-b">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FaUserCircle className="text-emerald-500" />
                                Employee Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InfoItem icon={<FaUserCircle className="text-emerald-500" />} label="Name" value={selectedPayroll.employee.name} />
                                <InfoItem icon={<FaIdCard className="text-blue-500" />} label="Employee Code" value={selectedPayroll.employee.employee_code} />
                                <InfoItem icon={<FaEnvelope className="text-green-500" />} label="Email" value={selectedPayroll.employee.email} />
                                <InfoItem icon={<FaBriefcase className="text-purple-500" />} label="Designation" value={
                                    <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium capitalize">
                                        {typeof selectedPayroll.employee.designation === 'object' ? selectedPayroll.employee.designation?.label : selectedPayroll.employee.designation?.replace('_', ' ')}
                                    </span>
                                } />
                            </div>
                        </div>

                        {/* Salary Summary */}
                        <div className="col-span-1 pb-6 border-b">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <CurrencyIcon className="text-green-500" size={12} />
                                Salary Summary
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <InfoItem icon={<FaMoneyBillWave className="text-green-500" />} label="Total Earnings" value={formatCurrency(selectedPayroll.payroll.total_earnings)} valueClassName="text-green-600" />
                                <InfoItem icon={<FaChartLine className="text-red-500" />} label="Total Deductions" value={formatCurrency(selectedPayroll.payroll.total_deductions)} valueClassName="text-red-600" />
                                <InfoItem icon={<FaCalculator className="text-blue-500" />} label="Net Salary" value={formatCurrency(selectedPayroll.payroll.net_salary)} valueClassName={parseFloat(selectedPayroll.payroll.net_salary) < 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'} />
                            </div>
                            <div className="mt-4">
                                <InfoItem icon={<FaClipboardList className="text-purple-500" />} label="Status" value={<StatusBadge status={selectedPayroll.payroll.status || selectedPayroll.rowType} />} />
                            </div>
                        </div>

                        {/* Attendance Details */}
                        <div className="col-span-1">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FaCalendarAlt className="text-indigo-500" />
                                Attendance Details
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FaCheckCircle className="text-green-600" />
                                        <span className="text-xs font-semibold text-gray-600">Present Days</span>
                                    </div>
                                    <div className="text-2xl font-bold text-green-700">{formatDays(selectedPayroll.payroll.attendance.present_days)}</div>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FaExclamationTriangle className="text-red-600" />
                                        <span className="text-xs font-semibold text-gray-600">Absent Days</span>
                                    </div>
                                    <div className="text-2xl font-bold text-red-700">{formatDays(selectedPayroll.payroll.attendance.absent_days)}</div>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FaCalendarAlt className="text-blue-600" />
                                        <span className="text-xs font-semibold text-gray-600">Paid Leave</span>
                                    </div>
                                    <div className="text-2xl font-bold text-blue-700">{formatDays(selectedPayroll.payroll.attendance.paid_leave_days)}</div>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FaCalendarAlt className="text-yellow-600" />
                                        <span className="text-xs font-semibold text-gray-600">Unpaid Leave</span>
                                    </div>
                                    <div className="text-2xl font-bold text-yellow-700">{formatDays(selectedPayroll.payroll.attendance.unpaid_leave_days)}</div>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FaExclamationTriangle className="text-orange-600" />
                                        <span className="text-xs font-semibold text-gray-600">LOP Days</span>
                                    </div>
                                    <div className="text-2xl font-bold text-orange-700">{formatDays(selectedPayroll.payroll.attendance?.lop_days || 0)}</div>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CurrencyIcon className="text-purple-600" size={12} />
                                        <span className="text-xs font-semibold text-gray-600">LOP Deduction</span>
                                    </div>
                                    <div className="text-lg font-bold text-purple-700">{formatCurrency(selectedPayroll.payroll.attendance?.lop_deduction || 0)}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <InfoItem icon={<FaClock className="text-indigo-500" />} label="Worked Hours" value={`${selectedPayroll.payroll.work?.worked_hours || 0} hours`} />
                                <InfoItem icon={<FaClock className="text-orange-500" />} label="Overtime Hours" value={`${selectedPayroll.payroll.work?.overtime_hours || 0} hours`} />
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={modalType === MODAL_TYPES.CONFIRM_GENERATE && !!selectedPayroll}
                onClose={closeModal}
                title="Generate Payroll"
                subtitle="Confirm payroll generation for this preview."
                icon={<FaCalculator size={18} />}
                size="md"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            type="button"
                            onClick={closeModal}
                            disabled={loading}
                            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-white hover:border-gray-300 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmPreviewGenerate}
                            disabled={loading || generatePayrollAccess.disabled}
                            title={generatePayrollAccess.disabled ? getAccessMessage(generatePayrollAccess) : ''}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg shadow-emerald-200 hover:shadow-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <FaSpinner className="w-4 h-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <FaCalculator className="w-4 h-4" />
                                    Confirm Generate
                                </>
                            )}
                        </button>
                    </div>
                }
            >
                {selectedPayroll && (
                    <div className="space-y-5 pb-2">
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-4">
                            <div className="bg-white p-3 rounded-xl shadow-sm text-emerald-600 mt-0.5">
                                <FaFileInvoiceDollar size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-800 text-base truncate">{selectedPayroll.employee.name}</h4>
                                <p className="text-sm text-gray-600 mb-1">
                                    Generate payroll for <span className="font-medium text-gray-800">{getMonthName(selectedPayroll.payroll?.month ?? selectedMonth)} {selectedPayroll.payroll?.year ?? selectedYear}</span>
                                </p>
                                <p className="text-xs text-gray-500 font-mono">
                                    Employee ID: <span className="text-gray-700 font-medium">{selectedPayroll.employee.id}</span>
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <InfoItem icon={<FaMoneyBillWave className="text-green-500" />} label="Total Earnings" value={formatCurrency(selectedPayroll.payroll.total_earnings)} valueClassName="text-green-600" />
                            <InfoItem icon={<FaChartLine className="text-red-500" />} label="Deductions" value={formatCurrency(selectedPayroll.payroll.total_deductions)} valueClassName="text-red-600" />
                            <InfoItem icon={<FaCalculator className="text-blue-500" />} label="Net Salary" value={formatCurrency(selectedPayroll.payroll.net_salary)} valueClassName="text-green-600 font-bold" />
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50">
                            <div>
                                <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                    <FaEnvelope className="text-emerald-500" />
                                    Send PDF Payslip
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Email the payslip PDF after payroll generation.
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={previewGenerateSendPdf}
                                onClick={() => setPreviewGenerateSendPdf(prev => !prev)}
                                disabled={loading}
                                className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed ${previewGenerateSendPdf
                                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 shadow-emerald-200 shadow-md'
                                    : 'bg-gray-200'
                                    }`}
                            >
                                <span
                                    className={`inline-block w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${previewGenerateSendPdf ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                                {previewGenerateSendPdf && (
                                    <span className="absolute left-1.5 text-white" style={{ fontSize: '7px', fontWeight: 800, lineHeight: 1, letterSpacing: '0.05em' }}></span>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={modalType === MODAL_TYPES.GENERATE}
                onClose={closeModal}
                title="Generate Payroll"
                subtitle="Create payroll for employees"
                icon={<FaPlus size={18} />}
                size="4xl"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            type="button"
                            onClick={closeModal}
                            disabled={loading}
                            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-white hover:border-gray-300 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="generate-payroll-form"
                            disabled={loading || employeesLoading || generatePayrollAccess.disabled}
                            title={generatePayrollAccess.disabled ? getAccessMessage(generatePayrollAccess) : ''}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg shadow-emerald-200 hover:shadow-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <FaSpinner className="w-4 h-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <FaCalculator className="w-4 h-4" />
                                    Generate Payroll
                                </>
                            )}
                        </button>
                    </div>
                }
            >
                <form id="generate-payroll-form" onSubmit={handleGenerate} className="flex flex-col flex-1">
                    <div className="space-y-6">
                        {/* Month and Year Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    <FaCalendarAlt className="text-emerald-500" />
                                    Month
                                </label>
                                <Select
                                    options={monthOptions}
                                    value={monthOptions.find(opt => opt.value === generateFormData.month)}
                                    onChange={(option) => setGenerateFormData(prev => ({
                                        ...prev,
                                        month: option.value
                                    }))}
                                    styles={customSelectStyles}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    <FaCalendarAlt className="text-emerald-500" />
                                    Year
                                </label>
                                <Select
                                    options={yearOptions}
                                    value={yearOptions.find(opt => opt.value === generateFormData.year)}
                                    onChange={(option) => setGenerateFormData(prev => ({
                                        ...prev,
                                        year: option.value
                                    }))}
                                    styles={customSelectStyles}
                                />
                            </div>
                        </div>
                        {/* Send PDF Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50 shadow-sm">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                    <FaDownload className="text-emerald-500" size={13} />
                                    Send Payslip via Email
                                </span>
                                <span className="text-xs text-gray-500 leading-relaxed">
                                    When enabled, a PDF payslip will be automatically emailed to each selected employee after payroll is generated.
                                </span>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={generateFormData.send_pdf}
                                onClick={() => setGenerateFormData(prev => ({ ...prev, send_pdf: !prev.send_pdf }))}
                                className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 shrink-0 ${generateFormData.send_pdf
                                        ? 'bg-gradient-to-r from-emerald-500 to-green-500 shadow-emerald-200 shadow-md'
                                        : 'bg-gray-200'
                                    }`}
                            >
                                <span
                                    className={`inline-block w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${generateFormData.send_pdf ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                                {generateFormData.send_pdf && (
                                    <span className="absolute left-1.5 text-white" style={{ fontSize: '7px', fontWeight: 800, lineHeight: 1, letterSpacing: '0.05em' }}></span>
                                )}
                            </button>
                        </div>

                        {/* Employee Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <FaUserFriends className="text-emerald-500" />
                                Select Employees
                            </label>
                            {employeesLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <FaSpinner className="animate-spin text-emerald-500 mr-2" />
                                    <span className="text-gray-500">Loading employees...</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 mt-2">
                                    {/* Available Employees Pane */}
                                    <div className="flex flex-col border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                                            <span className="font-semibold text-sm text-gray-700">Available</span>
                                            <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{availableEmployees.length}</span>
                                        </div>
                                        <div className="p-2 border-b border-gray-100">
                                            <div className="relative">
                                                <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                                                <input
                                                    type="text"
                                                    placeholder="Search available..."
                                                    value={availableSearch}
                                                    onChange={(e) => setAvailableSearch(e.target.value)}
                                                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[42px]"
                                                />
                                            </div>
                                        </div>
                                        <div className="h-64 overflow-y-auto p-2 custom-scrollbar space-y-1">
                                            {availableEmployees.length === 0 ? (
                                                <div className="text-center py-8 text-sm text-gray-400">No employees found</div>
                                            ) : (
                                                availableEmployees.map(emp => (
                                                    <div
                                                        key={emp.id}
                                                        onClick={() => setGenerateFormData(prev => ({
                                                            ...prev,
                                                            employee_ids: [...prev.employee_ids, emp.id]
                                                        }))}
                                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-50 border border-transparent hover:border-emerald-100 cursor-pointer transition-colors group"
                                                    >
                                                        <ProfileAvatar
                                                            record={emp}
                                                            name={emp.name}
                                                            className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(emp.id)} flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden`}
                                                        >
                                                            {getInitials(emp.name)}
                                                        </ProfileAvatar>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-sm font-semibold text-gray-800 truncate">{emp.name}</div>
                                                            <div className="text-xs text-gray-500 truncate">{emp.employee_code}</div>
                                                        </div>
                                                        <div className="opacity-0 group-hover:opacity-100 text-emerald-500">
                                                            <FaCheckCircle size={14} />
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Divider / Visual Arrows */}
                                    <div className="hidden md:flex flex-col items-center justify-center gap-3 px-2">
                                        <button
                                            type="button"
                                            title="Select All"
                                            onClick={() => setGenerateFormData(prev => ({
                                                ...prev,
                                                employee_ids: [...new Set([...prev.employee_ids, ...availableEmployees.map(emp => emp.id)])]
                                            }))}
                                            className="p-2 rounded-lg bg-gray-50 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 border border-gray-200 hover:border-emerald-200 transition-colors"
                                        >
                                            <FaAngleDoubleRight size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            title="Deselect All"
                                            onClick={() => setGenerateFormData(prev => ({
                                                ...prev,
                                                employee_ids: prev.employee_ids.filter(id => !selectedEmployees.find(emp => emp.id === id))
                                            }))}
                                            className="p-2 rounded-lg bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600 border border-gray-200 hover:border-red-200 transition-colors"
                                        >
                                            <FaAngleDoubleLeft size={16} />
                                        </button>
                                    </div>

                                    {/* Selected Employees Pane */}
                                    <div className="flex flex-col border border-emerald-200 rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-emerald-50">
                                        <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-100 flex justify-between items-center">
                                            <span className="font-semibold text-sm text-emerald-800">Selected</span>
                                            <span className="bg-emerald-200 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">{selectedEmployees.length}</span>
                                        </div>
                                        <div className="p-2 border-b border-emerald-50">
                                            <div className="relative">
                                                <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-400" size={12} />
                                                <input
                                                    type="text"
                                                    placeholder="Search selected..."
                                                    value={selectedSearch}
                                                    onChange={(e) => setSelectedSearch(e.target.value)}
                                                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-emerald-50/30 min-h-[42px]"
                                                />
                                            </div>
                                        </div>
                                        <div className="h-64 overflow-y-auto p-2 custom-scrollbar space-y-1">
                                            {selectedEmployees.length === 0 ? (
                                                <div className="text-center py-8 text-sm text-emerald-400">No employees selected</div>
                                            ) : (
                                                selectedEmployees.map(emp => (
                                                    <div
                                                        key={emp.id}
                                                        onClick={() => setGenerateFormData(prev => ({
                                                            ...prev,
                                                            employee_ids: prev.employee_ids.filter(id => id !== emp.id)
                                                        }))}
                                                        className="flex items-center gap-3 p-2 rounded-lg bg-emerald-50/50 hover:bg-red-50 border border-emerald-100 hover:border-red-100 cursor-pointer transition-colors group"
                                                    >
                                                        <ProfileAvatar
                                                            record={emp}
                                                            name={emp.name}
                                                            className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(emp.id)} flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden`}
                                                        >
                                                            {getInitials(emp.name)}
                                                        </ProfileAvatar>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-sm font-semibold text-emerald-900 truncate group-hover:text-red-900">{emp.name}</div>
                                                            <div className="text-xs text-emerald-600 truncate group-hover:text-red-600">{emp.employee_code}</div>
                                                        </div>
                                                        <div className="opacity-0 group-hover:opacity-100 text-red-500">
                                                            <FaTimes size={14} />
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>


                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={modalType === MODAL_TYPES.SEND_EMAIL && (!!selectedPayroll || selectedIds.length > 0)}
                onClose={closeModal}
                title="Send Payslip Email"
                subtitle="Confirm and optionally provide an alternate email address."
                icon={<FaEnvelope size={18} />}
                size="md"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            type="button"
                            onClick={closeModal}
                            disabled={isEmailing}
                            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-white hover:border-gray-300 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmSendEmail}
                            disabled={isEmailing}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-purple-200 hover:shadow-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isEmailing ? (
                                <>
                                    <FaSpinner className="w-4 h-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <FaEnvelope className="w-4 h-4" />
                                    Confirm & Send
                                </>
                            )}
                        </button>
                    </div>
                }
            >
                {(selectedPayroll || selectedIds.length > 0) && (
                    <div className="space-y-6 pb-2">
                        <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl flex items-start gap-4">
                            <div className="bg-white p-3 rounded-xl shadow-sm text-purple-500 mt-0.5">
                                <FaFileInvoiceDollar size={24} />
                            </div>
                            <div className="flex-1">
                                {selectedPayroll ? (
                                    <>
                                        <h4 className="font-semibold text-gray-800 text-base">{selectedPayroll.employee.name}</h4>
                                        <p className="text-sm text-gray-600 mb-1">
                                            Payslip for <span className="font-medium text-gray-800">{getMonthName(selectedPayroll.payroll?.month ?? selectedMonth)} {selectedPayroll.payroll?.year ?? selectedYear}</span>
                                        </p>
                                        <p className="text-xs text-gray-500 font-mono">
                                            Default Email: <span className="text-gray-700 font-medium">{selectedPayroll.employee.email || 'N/A'}</span>
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <h4 className="font-semibold text-gray-800 text-base">{selectedIds.length} payroll records selected</h4>
                                        <p className="text-sm text-gray-600 mb-1">
                                            Payslips for <span className="font-medium text-gray-800">{getMonthName(selectedMonth)} {selectedYear}</span>
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Emails will be sent to the selected employees.
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Alternate Email Address (Optional)
                            </label>
                            <div className="relative">
                                <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="email"
                                    value={emailOverride}
                                    onChange={(e) => setEmailOverride(e.target.value)}
                                    placeholder="Leave blank to use default email"
                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all text-sm"
                                    disabled={isEmailing}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2 ml-1">
                                If provided, the payslip will be sent to this email instead of the employee's default registered email.
                            </p>
                        </div>

                        {/* Document Type Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl border border-purple-100 bg-purple-50">
                            <div>
                                <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                    <FaFileInvoiceDollar className="text-purple-500" size={13} />
                                    Payslip Type
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {isSummary ? 'Summary — key totals only.' : 'Details — full breakdown with all components.'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold select-none cursor-pointer transition-colors ${!isSummary ? 'text-gray-800' : 'text-gray-400'}`} onClick={() => setIsSummary(false)}>Details</span>
                                <button
                                    type="button"
                                    onClick={() => setIsSummary(v => !v)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isSummary ? 'bg-purple-500' : 'bg-gray-300'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isSummary ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                                <span className={`text-xs font-semibold select-none cursor-pointer transition-colors ${isSummary ? 'text-purple-700' : 'text-gray-400'}`} onClick={() => setIsSummary(true)}>Summary</span>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Download Confirm Modal */}
            <Modal
                isOpen={modalType === MODAL_TYPES.CONFIRM_DOWNLOAD && !!selectedPayroll}
                onClose={closeModal}
                title="Download Payslip"
                subtitle="Choose format before downloading."
                icon={<FaDownload size={18} />}
                size="sm"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            type="button"
                            onClick={closeModal}
                            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-white hover:border-gray-300 transition-all duration-200 text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmDownload}
                            disabled={downloadPayrollAccess.disabled}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-200 hover:shadow-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <FaDownload className="w-4 h-4" />
                            Download PDF
                        </button>
                    </div>
                }
            >
                {selectedPayroll && (
                    <div className="space-y-4 pb-2">
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-4">
                            <div className="bg-white p-3 rounded-xl shadow-sm text-blue-500 mt-0.5">
                                <FaFileInvoiceDollar size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-800 text-base truncate">{selectedPayroll.employee?.name}</h4>
                                <p className="text-sm text-gray-600 mb-1">
                                    Payslip for <span className="font-medium text-gray-800">{getMonthName(selectedPayroll.payroll?.month ?? selectedMonth)} {selectedPayroll.payroll?.year ?? selectedYear}</span>
                                </p>
                                <p className="text-xs text-gray-500 font-mono">Net: <span className="font-medium text-gray-700">{formatCurrency(selectedPayroll.payroll?.net_salary)}</span></p>
                            </div>
                        </div>

                        {/* Type Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl border border-blue-100 bg-blue-50">
                            <div>
                                <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                    <FaFileInvoiceDollar className="text-blue-500" size={13} />
                                    Payslip Format
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {isSummary ? 'Summary — key totals only.' : 'Details — full breakdown with all components.'}
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
                )}
            </Modal>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `}</style>
        </div>
    );
};

export default PayrollManagement;