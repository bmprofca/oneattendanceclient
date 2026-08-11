import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    FaEye, FaEdit, FaCheck, FaTrash, FaSpinner, FaTimes, FaPlus,
    FaCloudUploadAlt, FaCog, FaSearch, FaFilter, FaCalendarAlt,
    FaClock, FaUser, FaClipboardList, FaChartBar, FaPaperclip, FaExclamationTriangle
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import apiCall, { uploadFile } from '../utils/api';
import { toast } from 'react-toastify';
import Pagination, { usePagination } from '../components/PaginationComponent';
import Modal from '../components/Modal';
import SelectField from '../components/SelectField';
import AdvancedDateFilter from '../components/AdvancedDateFilter';
import usePermissionAccess from '../hooks/usePermissionAccess';
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import { EmployeeSelect, ManagementButton, ManagementCard, ManagementHub, ManagementTable } from '../components/common';
import ProfileAvatar from '../components/common/ProfileAvatar';
import useEmployeeNavigation from '../hooks/useEmployeeNavigation';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
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

const toNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const normalizeKey = (value) =>
    String(value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');

const getRequestedDays = (startDate, endDate, isHalfDay) => {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

    if (isHalfDay) return 0.5;

    return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
};

const normalizeEmployeeLeaveBalances = (employee) => {
    const balances = employee?.leave_balances || employee?.leaves || [];
    if (!Array.isArray(balances)) return [];

    return balances.map((leave) => ({
        leave_config_id: leave.leave_config_id || leave.leave_config?.id || leave.id,
        code: leave.leave_code || leave.code || leave.type || leave.leave_config?.code || '',
        name: leave.leave_name || leave.name || leave.leave_config?.name || 'Leave',
        is_paid: leave.is_paid ?? leave.leave_config?.is_paid ?? true,
        allow_half_day: leave.allow_half_day ?? leave.leave_config?.allow_half_day ?? false,
        total_allocated: toNumber(leave.total_allocated ?? leave.total ?? leave.allocated),
        used: toNumber(leave.used),
        remaining: toNumber(leave.remaining ?? ((leave.total_allocated ?? leave.total ?? 0) - (leave.used ?? 0))),
    }));
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
    const url = file?.url || '';
    const fileType = String(file?.type || '').toLowerCase();
    const fileExtension = getFileExtension(file?.name || url);
    return fileType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp'].includes(fileExtension) || /\.(jpg|jpeg|png|webp)$/i.test(url);
};

const getEmptyCreateForm = () => ({
    employee_id: '',
    leave_config_id: '',
    start_date: '',
    end_date: '',
    is_half_day: false,
    half_day_type: 'first_half',
    remarks: '',
    attachments: [],
});

const STATUS = {
    approved: {
        label: 'Approved',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        dot: 'bg-emerald-500',
        border: 'border-emerald-100'
    },
    rejected: {
        label: 'Rejected',
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        dot: 'bg-rose-500',
        border: 'border-rose-100'
    },
    pending: {
        label: 'Pending',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        dot: 'bg-amber-500',
        border: 'border-amber-100'
    },
    cancelled: {
        label: 'Cancelled',
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        dot: 'bg-slate-400',
        border: 'border-slate-100'
    },
};

const STAT_STYLES = {
    blue: { iconWrap: 'bg-blue-50 text-blue-600' },
    green: { iconWrap: 'bg-emerald-50 text-emerald-600' },
    red: { iconWrap: 'bg-rose-50 text-rose-600' },
    yellow: { iconWrap: 'bg-amber-50 text-amber-600' },
};

function StatusBadge({ status }) {
    const s = STATUS[status] || STATUS.pending;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight uppercase ${s.bg} ${s.text} border ${s.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
        </span>
    );
}

const ToggleSwitch = ({ isOn, onToggle, accent = "blue", disabled = false }) => (
    <div
        onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onToggle();
        }}
        className={`w-10 h-5 flex items-center rounded-full p-1 transition-all duration-300 ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'} ${isOn ? `bg-${accent}-500 shadow-inner` : 'bg-gray-300'}`}
    >
        <motion.div
            className="bg-white w-3 h-3 rounded-full shadow-md"
            initial={false}
            animate={{ x: isOn ? 20 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
    </div>
);

const LeaveManagement = () => {
    const navigateToEmployeeProfile = useEmployeeNavigation();
    const { checkActionAccess, getAccessMessage } = usePermissionAccess();
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [viewMode, setViewMode] = useState('table');
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const [selectedIds, setSelectedIds] = useState([]);
    const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
    const [bulkApproveRemarks, setBulkApproveRemarks] = useState('');
    const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
    const [bulkRejectRemarks, setBulkRejectRemarks] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState(getEmptyCreateForm);
    const [createEmployee, setCreateEmployee] = useState(null);
    const [leaveConfigs, setLeaveConfigs] = useState([]);
    const [leaveConfigsLoading, setLeaveConfigsLoading] = useState(false);
    const [createUploading, setCreateUploading] = useState(false);
    const [overBalanceConfirm, setOverBalanceConfirm] = useState(null);

    const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 10);

    // Modal states
    const [detailLeave, setDetailLeave] = useState(null);
    const [approveLeave, setApproveLeave] = useState(null);
    const [rejectLeave, setRejectLeave] = useState(null);
    const [approveEmployee, setApproveEmployee] = useState(null);
    const [approveEmployeeLoading, setApproveEmployeeLoading] = useState(false);

    const [approveRemarks, setApproveRemarks] = useState('');
    const [approveForm, setApproveForm] = useState({
        start_date: '',
        end_date: '',
        is_half_day: false,
        half_day_type: 'first_half',
    });
    const [rejectRemarks, setRejectRemarks] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Permission Access
    const createAccess = checkActionAccess('leaveManagement', 'create');
    const approveAccess = checkActionAccess('leaveManagement', 'approve');
    const rejectAccess = checkActionAccess('leaveManagement', 'reject');
    const reviewMessage = getAccessMessage(approveAccess.disabled ? approveAccess : rejectAccess);
    const createMessage = getAccessMessage(createAccess);

    const fetchInProgress = useRef(false);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(t);
    }, [search]);

    const fetchLeaves = useCallback(async (page = pagination.page, searchVal = debouncedSearch, typeVal = typeFilter, resetLoading = true) => {
        if (fetchInProgress.current) return;
        fetchInProgress.current = true;
        if (resetLoading) setLoading(true);

        try {
            const companyId = JSON.parse(localStorage.getItem('company'))?.id;
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pagination.limit.toString(),
            });
            if (searchVal) params.append('search', searchVal);
            if (typeVal) params.append('leave_type', typeVal);

            const response = await apiCall(`/leave/emp-leaves?${params}`, 'GET', null, companyId);
            const result = await response.json();

            if (!response.ok || !result.success) throw new Error(result.message || 'Failed to load leaves');

            const rows = result.data || [];
            updatePagination({
                page: Number(result.meta?.page || page),
                limit: Number(result.meta?.limit || pagination.limit),
                total: Number(result.meta?.total || rows.length),
                total_pages: Number(result.meta?.total_pages || 1),
            });
            setLeaves(rows);
        } catch (error) {
            toast.error(error.message || 'Failed to load leaves');
        } finally {
            setLoading(false);
            fetchInProgress.current = false;
            setIsInitialLoad(false);
        }
    }, [pagination.limit, updatePagination, debouncedSearch, typeFilter]);

    useEffect(() => {
        if (!isInitialLoad) fetchLeaves(pagination.page, debouncedSearch, typeFilter, true);
    }, [pagination.page, pagination.limit, debouncedSearch, typeFilter]);

    useEffect(() => {
        fetchLeaves(1, '', '', true);
    }, []);

    const fetchLeaveConfigs = useCallback(async () => {
        setLeaveConfigsLoading(true);
        try {
            const companyId = JSON.parse(localStorage.getItem('company'))?.id;
            const response = await apiCall('/leave/company', 'GET', null, companyId);
            const result = await response.json();

            if (!response.ok || !result.success) throw new Error(result.message || 'Failed to load leave types');
            setLeaveConfigs(result.data || []);
        } catch (error) {
            toast.error(error.message || 'Failed to load leave types');
            setLeaveConfigs([]);
        } finally {
            setLeaveConfigsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (showCreateModal || approveLeave) fetchLeaveConfigs();
    }, [showCreateModal, approveLeave, fetchLeaveConfigs]);

    const closeCreateModal = () => {
        setShowCreateModal(false);
        setCreateForm(getEmptyCreateForm());
        setCreateEmployee(null);
        setOverBalanceConfirm(null);
    };

    const handleCreateAttachmentChange = async (event) => {
        const selectedFiles = Array.from(event.target.files || []);
        event.target.value = '';

        const validFiles = selectedFiles.filter(isAllowedAttachment);
        const invalidFiles = selectedFiles.filter((file) => !isAllowedAttachment(file));

        if (invalidFiles.length > 0) {
            toast.error('Only PDF, JPG, JPEG, PNG and WEBP files are allowed');
        }

        if (validFiles.length === 0) return;

        setCreateUploading(true);
        try {
            const uploadedFiles = await Promise.all(validFiles.map((file) =>
                uploadFile(file).then((url) => ({
                    url,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                }))
            ));

            setCreateForm((prev) => ({
                ...prev,
                attachments: [...prev.attachments, ...uploadedFiles],
            }));
            toast.success(`${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} uploaded`);
        } catch (error) {
            toast.error(error.message || 'Failed to upload attachment');
        } finally {
            setCreateUploading(false);
        }
    };

    useEffect(() => {
        if (!approveLeave) {
            setApproveEmployee(null);
            setApproveEmployeeLoading(false);
            return;
        }

        if (approveLeave.leave_balances || approveLeave.leaves) {
            setApproveEmployee(approveLeave);
            return;
        }

        let cancelled = false;
        const loadEmployeeForApproval = async () => {
            setApproveEmployeeLoading(true);
            try {
                const companyId = JSON.parse(localStorage.getItem('company'))?.id;
                const params = new URLSearchParams({
                    page: '1',
                    limit: '20',
                });
                const searchValue = approveLeave.employee_code || approveLeave.employee_name || '';
                if (searchValue) params.append('search', searchValue);

                const response = await apiCall(`/employees/list?${params.toString()}`, 'GET', null, companyId);
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.message || 'Failed to load employee balance');

                const employees = result.data || [];
                const match = employees.find((employee) => {
                    if (approveLeave.employee_id && String(employee.id) === String(approveLeave.employee_id)) return true;
                    if (approveLeave.employee_code && String(employee.employee_code) === String(approveLeave.employee_code)) return true;
                    return normalizeKey(employee.name) === normalizeKey(approveLeave.employee_name);
                }) || employees[0] || null;

                if (!cancelled) setApproveEmployee(match);
            } catch (error) {
                if (!cancelled) {
                    setApproveEmployee(null);
                    toast.error(error.message || 'Failed to load employee balance');
                }
            } finally {
                if (!cancelled) setApproveEmployeeLoading(false);
            }
        };

        loadEmployeeForApproval();

        return () => {
            cancelled = true;
        };
    }, [approveLeave]);

    const submitCreateLeave = async ({ skipBalanceConfirm = false } = {}) => {
        if (!createForm.employee_id) return toast.warn('Employee is required');
        if (!createForm.leave_config_id) return toast.warn('Leave type is required');
        if (!createForm.start_date || !createForm.end_date) return toast.warn('Leave date range is required');
        if (createForm.end_date < createForm.start_date) return toast.warn('End date cannot be before start date');
        if (createOverBalance && !skipBalanceConfirm) {
            setOverBalanceConfirm('create');
            return;
        }

        setSubmitting(true);
        try {
            const companyId = JSON.parse(localStorage.getItem('company'))?.id;
            const payload = {
                employee_id: Number(createForm.employee_id),
                leave_config_id: String(createForm.leave_config_id),
                start_date: createForm.start_date,
                end_date: createForm.end_date,
                is_half_day: createForm.is_half_day ? 1 : 0,
                attachments: createForm.attachments.map((file) => file.url),
                remarks: createForm.remarks,
            };

            if (createForm.is_half_day) {
                payload.half_day_type = createForm.half_day_type;
            }

            const response = await apiCall('/leave/management/create/', 'POST', payload, companyId);
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Failed to create leave');

            toast.success('Leave created successfully');
            setOverBalanceConfirm(null);
            closeCreateModal();
            fetchLeaves(1, debouncedSearch, typeFilter, true);
        } catch (error) {
            toast.error(error.message || 'Failed to create leave');
        } finally {
            setSubmitting(false);
        }
    };

    const submitApprove = async ({ skipBalanceConfirm = false } = {}) => {
        if (!approveLeave) return;

        const originalStartDate = toDateInputValue(approveLeave.start_date);
        const originalEndDate = toDateInputValue(approveLeave.end_date);
        const hasDateChange = approveForm.start_date !== originalStartDate || approveForm.end_date !== originalEndDate;

        if ((hasDateChange || approveForm.is_half_day) && (!approveForm.start_date || !approveForm.end_date)) {
            toast.warn('Start date and end date are required when editing leave dates');
            return;
        }

        if (approveForm.start_date && approveForm.end_date && approveForm.end_date < approveForm.start_date) {
            toast.warn('End date cannot be before start date');
            return;
        }

        if (approveOverBalance && !skipBalanceConfirm) {
            setOverBalanceConfirm('approve');
            return;
        }

        setSubmitting(true);
        try {
            const companyId = JSON.parse(localStorage.getItem('company'))?.id;
            const payload = {
                id: approveLeave.id,
                remarks: approveRemarks,
            };

            if (hasDateChange || approveForm.is_half_day) {
                payload.start_date = approveForm.start_date;
                payload.end_date = approveForm.end_date;
            }

            if (approveForm.is_half_day) {
                payload.is_half_day = true;
                payload.half_day_type = approveForm.half_day_type;
            }

            const response = await apiCall('/leave/management/approve-edit', 'PUT', payload, companyId);
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Failed to approve');
            toast.success('Leave approved successfully');
            setOverBalanceConfirm(null);
            setApproveLeave(null);
            setApproveRemarks('');
            setApproveForm({
                start_date: '',
                end_date: '',
                is_half_day: false,
                half_day_type: 'first_half',
            });
            fetchLeaves();
        } catch (error) {
            toast.error(error.message || 'Failed to approve');
        } finally {
            setSubmitting(false);
        }
    };

    const submitReject = async () => {
        if (!rejectLeave) return;
        if (!rejectRemarks.trim()) return toast.warn('Rejection reason is required');
        setSubmitting(true);
        try {
            const companyId = JSON.parse(localStorage.getItem('company'))?.id;
            const response = await apiCall('/leave/management/bulk-approve-reject', 'PUT', { ids: [rejectLeave.id], action: 'reject', remarks: rejectRemarks }, companyId);
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Failed to reject');
            toast.success('Leave rejected');
            setRejectLeave(null);
            fetchLeaves();
        } catch (error) {
            toast.error(error.message || 'Failed to reject');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleSelectAll = () => {
        const pendingLeaves = visibleLeaves.filter(l => l.status === 'pending');
        const pendingIds = pendingLeaves.map(l => l.id);
        const allPendingSelected = pendingIds.length > 0 && pendingIds.every(id => selectedIds.includes(id));

        if (allPendingSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(pendingIds);
        }
    };

    const toggleSelectRow = (eOrId, maybeId) => {
        if (eOrId?.stopPropagation) eOrId.stopPropagation();
        const id = maybeId ?? eOrId;
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleBulkApprove = async () => {
        if (selectedIds.length === 0) return;
        setSubmitting(true);
        try {
            const companyId = JSON.parse(localStorage.getItem('company'))?.id;
            const response = await apiCall('/leave/management/bulk-approve-reject', 'PUT', { ids: selectedIds, action: 'approve', remarks: bulkApproveRemarks }, companyId);
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Failed to approve');
            toast.success(`${selectedIds.length} leave request${selectedIds.length > 1 ? 's' : ''} approved successfully`);
            setSelectedIds([]);
            setShowBulkApproveModal(false);
            setBulkApproveRemarks('');
            fetchLeaves();
        } catch (error) {
            toast.error(error.message || 'Failed to approve requests');
        } finally {
            setSubmitting(false);
        }
    };

    const handleBulkReject = async () => {
        if (selectedIds.length === 0) return;
        if (!bulkRejectRemarks.trim()) return toast.warn('Rejection reason is required');
        setSubmitting(true);
        try {
            const companyId = JSON.parse(localStorage.getItem('company'))?.id;
            const response = await apiCall('/leave/management/bulk-approve-reject', 'PUT', { ids: selectedIds, action: 'reject', remarks: bulkRejectRemarks }, companyId);
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Failed to reject');
            toast.success(`${selectedIds.length} leave request${selectedIds.length > 1 ? 's' : ''} rejected successfully`);
            setSelectedIds([]);
            setShowBulkRejectModal(false);
            setBulkRejectRemarks('');
            fetchLeaves();
        } catch (error) {
            toast.error(error.message || 'Failed to reject requests');
        } finally {
            setSubmitting(false);
        }
    };

    const ActionMenuButtons = (leave) => {
        const isPending = leave.status === 'pending';
        return [
            { label: 'View Details', icon: <FaEye size={13} />, onClick: () => setDetailLeave(leave), className: 'text-green-600 hover:text-green-700 hover:bg-green-50' },
            ...(isPending ? [
                {
                    label: 'Approve / Edit',
                    icon: <FaCheck size={13} />,
                    onClick: () => {
                        setApproveLeave(leave);
                        setApproveRemarks('');
                        setApproveForm({
                            start_date: toDateInputValue(leave.start_date),
                            end_date: toDateInputValue(leave.end_date),
                            is_half_day: Boolean(leave.is_half_day),
                            half_day_type: leave.half_day_type || 'first_half',
                        });
                    },
                    disabled: approveAccess.disabled,
                    title: approveAccess.disabled ? reviewMessage : '',
                    className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                },
                { label: 'Reject', icon: <FaTrash size={13} />, onClick: () => { setRejectLeave(leave); setRejectRemarks(''); }, disabled: rejectAccess.disabled, title: rejectAccess.disabled ? reviewMessage : '', className: 'text-rose-600 hover:text-rose-700 hover:bg-rose-50' }
            ] : [])
        ];
    };

    const stats = [
        { label: 'Total Requests', val: pagination.total || 0, icon: FaClipboardList, color: 'blue' },
        { label: 'Approved', val: leaves.filter(l => l.status === 'approved').length, icon: FaCheck, color: 'green' },
        { label: 'Rejected', val: leaves.filter(l => l.status === 'rejected').length, icon: FaTrash, color: 'red' },
        { label: 'Pending', val: leaves.filter(l => l.status === 'pending').length, icon: FaClock, color: 'yellow' },
    ];

    const leaveTypeOptions = useMemo(() => {
        const seen = new Map();

        leaves.forEach((leave) => {
            const rawValue = String(leave.leave_code || leave.leave_name || leave.leave_type || '').trim();
            if (!rawValue) return;

            const normalized = rawValue.toLowerCase();
            if (!seen.has(normalized)) {
                seen.set(normalized, {
                    value: normalized,
                    label: leave.leave_name || leave.leave_code || rawValue,
                });
            }
        });

        return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [leaves]);

    const leaveTypeFilterOptions = useMemo(
        () => [
            { value: '', label: 'All Leave Types' },
            ...leaveTypeOptions,
        ],
        [leaveTypeOptions]
    );

    const selectedLeaveTypeFilter = useMemo(
        () => leaveTypeFilterOptions.find((option) => option.value === typeFilter) || leaveTypeFilterOptions[0],
        [leaveTypeFilterOptions, typeFilter]
    );

    const visibleLeaves = useMemo(() => {
        if (!typeFilter) return leaves;

        const normalized = typeFilter.toLowerCase();
        return leaves.filter((leave) => {
            const candidates = [leave.leave_name, leave.leave_code, leave.leave_type]
                .filter(Boolean)
                .map((value) => String(value).toLowerCase());

            return candidates.some((value) => value === normalized || value.includes(normalized));
        });
    }, [leaves, typeFilter]);

    const visiblePendingLeaves = useMemo(
        () => visibleLeaves.filter((leave) => leave.status === 'pending'),
        [visibleLeaves]
    );
    const allVisibleSelected = visiblePendingLeaves.length > 0 && visiblePendingLeaves.every((leave) => selectedIds.includes(leave.id));

    const leaveConfigsById = useMemo(() => {
        const map = new Map();
        leaveConfigs.forEach((config) => {
            map.set(String(config.id), config);
        });
        return map;
    }, [leaveConfigs]);

    const buildEmployeeLeaveOptions = useCallback((employee) => {
        return normalizeEmployeeLeaveBalances(employee).map((balance) => {
            const config = leaveConfigsById.get(String(balance.leave_config_id));
            const configName = config?.name || config?.leave_name;
            const configCode = config?.code || config?.leave_code;
            const name = configName || balance.name;
            const code = configCode || balance.code;
            const isPaid = config?.is_paid ?? balance.is_paid;
            const allowHalfDay = config?.allow_half_day ?? balance.allow_half_day;
            const remaining = toNumber(balance.remaining);

            return {
                value: String(balance.leave_config_id),
                label: `${name}${code ? ` (${code})` : ''} - ${formatDays(remaining)} left${isPaid === false ? ' (Unpaid)' : ''}`,
                name,
                code,
                remaining,
                total_allocated: toNumber(balance.total_allocated),
                used: toNumber(balance.used),
                is_paid: isPaid,
                allow_half_day: allowHalfDay,
                isDisabled: !balance.leave_config_id,
            };
        });
    }, [leaveConfigsById]);

    const createLeaveOptions = useMemo(
        () => buildEmployeeLeaveOptions(createEmployee),
        [buildEmployeeLeaveOptions, createEmployee]
    );

    const selectedCreateLeaveConfig = useMemo(
        () => createLeaveOptions.find((option) => String(option.value) === String(createForm.leave_config_id)) || null,
        [createLeaveOptions, createForm.leave_config_id]
    );

    const createRequestedDays = useMemo(
        () => getRequestedDays(createForm.start_date, createForm.end_date, createForm.is_half_day),
        [createForm.start_date, createForm.end_date, createForm.is_half_day]
    );

    const createOverBalance = Boolean(selectedCreateLeaveConfig && createRequestedDays > selectedCreateLeaveConfig.remaining);

    // ─── Half-day permission flags ────────────────────────────────────────────
    // When no leave type is selected yet, default to true (don't restrict the toggle prematurely).
    // When a leave type IS selected, respect its allow_half_day flag exactly.
    const createAllowHalfDay = selectedCreateLeaveConfig ? (selectedCreateLeaveConfig.allow_half_day ?? true) : true;

    const approveLeaveOptions = useMemo(
        () => buildEmployeeLeaveOptions(approveEmployee),
        [buildEmployeeLeaveOptions, approveEmployee]
    );

    const selectedApproveLeaveConfig = useMemo(() => {
        if (!approveLeave) return null;
        const requestedId = approveLeave.leave_config_id || approveLeave.leave_type_id;
        const byId = requestedId
            ? approveLeaveOptions.find((option) => String(option.value) === String(requestedId))
            : null;
        if (byId) return byId;

        const leaveKey = normalizeKey(approveLeave.leave_code || approveLeave.leave_name || approveLeave.leave_type);
        return approveLeaveOptions.find((option) =>
            [option.code, option.name].some((value) => normalizeKey(value) === leaveKey)
        ) || null;
    }, [approveLeave, approveLeaveOptions]);

    const approveRequestedDays = useMemo(
        () => getRequestedDays(approveForm.start_date, approveForm.end_date, approveForm.is_half_day),
        [approveForm.start_date, approveForm.end_date, approveForm.is_half_day]
    );

    const approveOverBalance = Boolean(selectedApproveLeaveConfig && approveRequestedDays > selectedApproveLeaveConfig.remaining);

    const approveAllowHalfDay = selectedApproveLeaveConfig ? (selectedApproveLeaveConfig.allow_half_day ?? true) : true;

    const overBalanceDetails = useMemo(() => {
        if (overBalanceConfirm === 'create' && selectedCreateLeaveConfig) {
            return {
                title: 'Create Leave Anyway?',
                actionLabel: 'Create Leave',
                employeeName: createEmployee?.name || createEmployee?.employee_name || 'selected employee',
                leaveName: selectedCreateLeaveConfig.name,
                requestedDays: createRequestedDays,
                remainingDays: selectedCreateLeaveConfig.remaining,
                onConfirm: () => submitCreateLeave({ skipBalanceConfirm: true }),
            };
        }

        if (overBalanceConfirm === 'approve' && selectedApproveLeaveConfig && approveLeave) {
            return {
                title: 'Approve Leave Anyway?',
                actionLabel: 'Approve Leave',
                employeeName: approveLeave.employee_name || 'selected employee',
                leaveName: selectedApproveLeaveConfig.name,
                requestedDays: approveRequestedDays,
                remainingDays: selectedApproveLeaveConfig.remaining,
                onConfirm: () => submitApprove({ skipBalanceConfirm: true }),
            };
        }

        return null;
    }, [
        overBalanceConfirm,
        selectedCreateLeaveConfig,
        createEmployee,
        createRequestedDays,
        selectedApproveLeaveConfig,
        approveLeave,
        approveRequestedDays,
    ]);

    const columns = [
        {
            key: 'employee',
            label: (
                <div className="flex items-center gap-2">
                    <span>Employee</span>
                </div>
            ),
            render: (leave) => (
                <div className="flex items-center gap-4">
                    <div className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                        <input
                            type="checkbox"
                            checked={selectedIds.includes(leave.id)}
                            onChange={() => toggleSelectRow(leave.id)}
                            disabled={leave.status !== 'pending'}
                            className="w-3 h-3 lg:w-4 lg:h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 accent-blue-600"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="flex min-w-0 items-center gap-3">
                        <ProfileAvatar
                            record={leave}
                            name={leave.employee_name}
                            className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(leave.employee_id); }}
                        >
                            {leave.employee_name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </ProfileAvatar>
                        <div className="min-w-0">
                            <div
                                className="font-semibold text-slate-800 truncate cursor-pointer hover:underline hover:text-indigo-600 transition-colors"
                                onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(leave.employee_id); }}
                            >
                                {leave.employee_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono tracking-tighter">{leave.employee_code}</div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: 'leave_type',
            label: 'Leave Type',
            render: (leave) => (
                <div>
                    <div className="font-semibold text-slate-800 text-xs">{leave.leave_name}</div>
                    <span className="inline-flex items-center justify-center rounded-lg bg-slate-50 border border-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tight">
                        {leave.leave_code}
                    </span>
                </div>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (leave) => <StatusBadge status={leave.status} />
        },
        {
            key: 'duration',
            label: 'Duration',
            render: (leave) => (
                <div className="text-[11px] leading-tight">
                    <div className="font-medium text-slate-700">{fmt(leave.start_date)}</div>
                    <div className="text-slate-400">to {fmt(leave.end_date)}</div>
                </div>
            )
        },
        {
            key: 'days',
            label: 'Days',
            render: (leave) => <span className="font-bold text-slate-700 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-xs">{formatDays(leave.total_days)}d</span>
        },
        {
            key: 'applied',
            label: 'Applied',
            render: (leave) => <span className="text-[11px] text-slate-400 font-medium">{fmt(leave.applied_at)}</span>
        }
    ];

    if (isInitialLoad && loading) return (
        <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <FaSpinner className="animate-spin text-blue-500 text-4xl" />
                <p className="text-slate-400 font-medium animate-pulse">Loading leave applications...</p>
            </div>
        </div>
    );

    return (
        <ManagementHub
            eyebrow={<><FaChartBar size={11} /> Application History</>}
            title="Leave Management"
            description="Manage and review employee leave requests, approvals and history."
            accent="blue"
            onRefresh={() => fetchLeaves(1, debouncedSearch, typeFilter, true)}
            actions={
                <ManagementButton
                    tone="blue"
                    variant="solid"
                    leftIcon={<FaPlus />}
                    onClick={() => setShowCreateModal(true)}
                    // disabled={createAccess.disabled}
                    title={createAccess.disabled ? createMessage : 'Create leave request'}
                >
                    Create Leave
                </ManagementButton>
            }
        >
            <div className="space-y-6 p-2 lg:p-0">
                {/* Stats */}
                {!loading && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {stats.map((s) => (
                            <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
                                    <p className="text-2xl font-black text-slate-800 mt-1">{s.val}</p>
                                </div>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${STAT_STYLES[s.color].iconWrap}`}>
                                    <s.icon size={18} />
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}

                {/* ─── Consolidated Filter & View Bar ─── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6 md:flex-row md:items-center md:justify-between"
                >
                    {/* Left Section: Search & Type Filter */}
                    <div className="flex flex-col gap-4 flex-1 sm:flex-row sm:items-center md:flex-row md:items-center">
                        <div className="relative flex-1 w-full">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                            <input
                                type="text"
                                placeholder="Search by name, code, or leave type..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-11 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-medium min-h-[42px]"
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
                    </div>

                    {/* Right Section: View Mode */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-[170px] flex-col sm:w-56">
                            <SelectField
                                options={leaveTypeFilterOptions}
                                value={selectedLeaveTypeFilter}
                                onChange={(option) => setTypeFilter(option?.value || '')}
                                isClearable={false}
                                placeholder="All Leave Types"
                            />
                        </div>
                        {/* Vertical Separator */}
                        <div className="h-8 w-px bg-gray-200 hidden lg:block mx-1"></div>

                        <ManagementViewSwitcher
                            viewMode={viewMode}
                            onChange={setViewMode}
                            accent="blue"
                        />
                    </div>
                </motion.div>

                {visibleLeaves.length === 0 && !loading ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-100">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><FaClipboardList size={24} /></div>
                        <p className="text-slate-500 font-bold">No leave requests found</p>
                        <p className="text-slate-400 text-sm mt-1 mx-auto max-w-xs">
                            {search
                                ? `We couldn't find anything matching "${search}"`
                                : typeFilter
                                    ? `No leave requests match the selected leave type.`
                                    : "Employee leave applications will appear here."}
                        </p>
                    </motion.div>
                ) : (
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
                                    disabled={visiblePendingLeaves.length === 0}
                                    className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {allVisibleSelected
                                        ? <><FaCheck size={13} /> Deselect all</>
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

                        {viewMode === 'table' ? (
                            <ManagementTable
                                rows={visibleLeaves}
                                columns={columns}
                                rowKey={(row) => row.id}
                                onRowClick={(row) => setDetailLeave(row)}
                                getActions={ActionMenuButtons}
                                accent="blue"
                            />
                        ) : (
                            <ManagementGrid viewMode={viewMode}>
                                {visibleLeaves.map((leave) => (
                                    <ManagementCard
                                        key={leave.id}
                                        className={selectedIds.includes(leave.id) ? 'border-blue-200 ring-2 ring-blue-400 ring-offset-2' : ''}
                                        eyebrow={
                                            <div className="flex items-center gap-2">
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(leave.id)}
                                                        onChange={() => toggleSelectRow(leave.id)}
                                                        disabled={leave.status !== 'pending'}
                                                        className="w-3 h-3 lg:w-4 lg:h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 accent-blue-600"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                                <StatusBadge status={leave.status} />
                                                <span className="text-[10px] font-bold text-slate-400"># {leave.id}</span>
                                            </div>
                                        }
                                        title={
                                            <span
                                                className="cursor-pointer hover:underline hover:text-indigo-600 transition-colors inline-block"
                                                onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(leave.employee_id); }}
                                            >
                                                {leave.employee_name}
                                            </span>
                                        }
                                        subtitle={<div className="font-mono text-[10px] text-slate-400">{leave.employee_code}</div>}
                                        actions={ActionMenuButtons(leave)}
                                        onClick={() => setDetailLeave(leave)}
                                    >
                                        <div className="space-y-4 pt-2">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Leave Type</p>
                                                    <p className="text-sm font-bold text-slate-700">{leave.leave_name}</p>
                                                </div>
                                                <div className="text-right space-y-1">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duration</p>
                                                    <p className="text-sm font-black text-blue-600">{formatDays(leave.total_days)} Days</p>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100/50">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">From</span>
                                                        <span className="text-xs font-bold text-slate-600">{fmt(leave.start_date)}</span>
                                                    </div>
                                                    <div className="h-4 w-[1px] bg-slate-200" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">To</span>
                                                        <span className="text-xs font-bold text-slate-600">{fmt(leave.end_date)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {leave.reason && (
                                                <div className="text-[11px] text-slate-500 italic line-clamp-2">
                                                    "{leave.reason}"
                                                </div>
                                            )}
                                        </div>
                                    </ManagementCard>
                                ))}
                            </ManagementGrid>
                        )}
                    </>
                )}

                {pagination.total > 0 && (
                    <div className="mt-8">
                        <Pagination
                            currentPage={pagination.page}
                            totalItems={pagination.total}
                            itemsPerPage={pagination.limit}
                            onPageChange={(p) => goToPage(p)}
                            onLimitChange={changeLimit}
                            showInfo={true}
                        />
                    </div>
                )}

                {/* Modals */}
                {showCreateModal && (
                    <Modal
                        isOpen={showCreateModal}
                        onClose={closeCreateModal}
                        title="Create Leave"
                        subtitle="Create a leave request for an employee."
                        icon={<FaPlus className="h-6 w-6" />}
                        size="3xl"
                        footer={
                            <div className="flex gap-3 w-full justify-end">
                                <button
                                    type="button"
                                    onClick={closeCreateModal}
                                    disabled={submitting}
                                    className="flex px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all disabled:opacity-60"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={submitCreateLeave}
                                    disabled={submitting || createUploading}
                                    className="flex px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {submitting ? <FaSpinner className="animate-spin" /> : <FaPlus />}
                                    {submitting ? 'Creating...' : 'Create Leave'}
                                </button>
                            </div>
                        }
                    >
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        Employee <span className="text-rose-500">*</span>
                                    </label>
                                    <EmployeeSelect
                                        value={createForm.employee_id}
                                        onChange={(employeeId, employee) => {
                                            setCreateEmployee(employee);
                                            setCreateForm((prev) => ({
                                                ...prev,
                                                employee_id: employeeId,
                                                leave_config_id: '',
                                                // Reset half-day when employee changes since leave type resets
                                                is_half_day: false,
                                                half_day_type: 'first_half',
                                            }));
                                        }}
                                        placeholder="Select employee..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        Leave Type <span className="text-rose-500">*</span>
                                    </label>
                                    <SelectField
                                        options={createLeaveOptions}
                                        value={selectedCreateLeaveConfig}
                                        onChange={(option) => {
                                            const allowHalf = option?.allow_half_day ?? true;
                                            setCreateForm((prev) => ({
                                                ...prev,
                                                leave_config_id: option ? option.value : '',
                                                // Auto-reset half day if new leave type doesn't allow it
                                                is_half_day: allowHalf ? prev.is_half_day : false,
                                                half_day_type: allowHalf ? prev.half_day_type : 'first_half',
                                            }));
                                        }}
                                        placeholder={
                                            !createEmployee
                                                ? 'Select employee first'
                                                : leaveConfigsLoading
                                                    ? 'Loading leave types...'
                                                    : createLeaveOptions.length
                                                        ? 'Choose leave type...'
                                                        : 'No assigned leave balance'
                                        }
                                        isLoading={leaveConfigsLoading}
                                        isDisabled={!createEmployee || leaveConfigsLoading || createLeaveOptions.length === 0}
                                        isClearable
                                    />
                                </div>
                            </div>

                            {createEmployee && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Available Leaves</p>
                                        {selectedCreateLeaveConfig && (
                                            <p className={`text-[11px] font-bold ${createOverBalance ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                Selected {formatDays(createRequestedDays)} / {formatDays(selectedCreateLeaveConfig.remaining)} day(s)
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {createLeaveOptions.length > 0 ? createLeaveOptions.map((option) => (
                                            <span
                                                key={option.value}
                                                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${String(option.value) === String(createForm.leave_config_id)
                                                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                                                    : 'border-slate-200 bg-white text-slate-600'
                                                    }`}
                                            >
                                                {option.code || option.name}
                                                <span className={option.remaining <= 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                                    {formatDays(option.remaining)} left
                                                </span>
                                            </span>
                                        )) : (
                                            <span className="text-xs font-medium text-slate-400">No leave balances are assigned to this employee.</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        Date Range <span className="text-rose-500">*</span>
                                    </label>
                                    <AdvancedDateFilter
                                        value={{
                                            date: (createForm.start_date && createForm.start_date === createForm.end_date) ? createForm.start_date : "",
                                            from_date: (createForm.start_date && createForm.start_date !== createForm.end_date) ? createForm.start_date : "",
                                            to_date: (createForm.end_date && createForm.start_date !== createForm.end_date) ? createForm.end_date : "",
                                        }}
                                        onChange={(result) => {
                                            const nextStart = result?.date || result?.from_date || '';
                                            const nextEnd = result?.date || result?.to_date || nextStart;
                                            setCreateForm((prev) => ({
                                                ...prev,
                                                start_date: nextStart,
                                                end_date: nextEnd,
                                            }));
                                        }}
                                        tabOptions={["date", "range"]}
                                        placeholder="Select leave date range"
                                        buttonClassName="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm shadow-sm transition hover:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 font-medium"
                                    />
                                    {selectedCreateLeaveConfig && (
                                        <p className={`mt-2 text-[11px] font-semibold ${createOverBalance ? 'text-rose-600' : 'text-slate-500'}`}>
                                            {createOverBalance
                                                ? `Selected range is ${formatDays(createRequestedDays)} day(s), which exceeds the ${formatDays(selectedCreateLeaveConfig.remaining)} day(s) remaining.`
                                                : `Selected range uses ${formatDays(createRequestedDays)} of ${formatDays(selectedCreateLeaveConfig.remaining)} available day(s).`}
                                        </p>
                                    )}
                                </div>

                                {/* ─── Half Day Toggle — Create Modal ─── */}
                                <div>
                                    <div className={`rounded-xl border p-4 transition-all ${!createAllowHalfDay
                                        ? 'border-slate-100 bg-slate-50 opacity-60'
                                        : createForm.is_half_day
                                            ? 'border-blue-200 bg-blue-50/60 ring-2 ring-blue-100'
                                            : 'border-slate-200 bg-slate-50'
                                        }`}>
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Half Day</p>
                                                <p className="mt-0.5 text-xs font-medium text-slate-400">
                                                    {!createAllowHalfDay
                                                        ? 'Half day not allowed for this leave type'
                                                        : createForm.is_half_day
                                                            ? 'Half day leave enabled'
                                                            : 'Enable for half day leave'}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={!createAllowHalfDay}
                                                onClick={() => {
                                                    if (!createAllowHalfDay) return;
                                                    setCreateForm((prev) => ({
                                                        ...prev,
                                                        is_half_day: !prev.is_half_day,
                                                        half_day_type: !prev.is_half_day ? (prev.half_day_type || 'first_half') : 'first_half',
                                                    }));
                                                }}
                                                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 ${!createAllowHalfDay
                                                    ? 'bg-slate-200 cursor-not-allowed'
                                                    : createForm.is_half_day
                                                        ? 'bg-blue-600'
                                                        : 'bg-slate-300'
                                                    }`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${createForm.is_half_day ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                        {createAllowHalfDay && createForm.is_half_day && (
                                            <div className="mt-4">
                                                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Half Day Session</p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {[
                                                        { value: 'first_half', label: 'First Half' },
                                                        { value: 'second_half', label: 'Second Half' },
                                                    ].map((option) => (
                                                        <button
                                                            key={option.value}
                                                            type="button"
                                                            onClick={() => setCreateForm((prev) => ({ ...prev, half_day_type: option.value }))}
                                                            className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${createForm.half_day_type === option.value
                                                                ? 'border-blue-200 bg-white text-blue-700 shadow-sm'
                                                                : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-700 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Remarks</label>
                                <textarea
                                    rows={4}
                                    placeholder="Internal remarks..."
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 resize-none"
                                    value={createForm.remarks}
                                    onChange={(e) => setCreateForm((prev) => ({ ...prev, remarks: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attachments</label>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">PDF, JPG, PNG, WEBP</span>
                                </div>
                                <div className="relative group">
                                    <input
                                        type="file"
                                        multiple
                                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                                        onChange={handleCreateAttachmentChange}
                                        disabled={createUploading}
                                        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                                    />
                                    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-5 text-center transition-all group-hover:border-blue-300 group-hover:bg-blue-50/40">
                                        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-500 shadow-sm">
                                            {createUploading ? <FaSpinner className="animate-spin" /> : <FaCloudUploadAlt />}
                                        </div>
                                        <p className="text-sm font-bold text-slate-700">Drop files here or browse</p>
                                        <p className="mt-1 text-[11px] font-medium text-slate-400">Uploaded files are attached to the leave request</p>
                                    </div>
                                </div>

                                {createForm.attachments.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                                        {createForm.attachments.map((file, index) => (
                                            <div key={`${file.url}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                                {isImageAttachment(file) ? (
                                                    <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-orange-50 text-orange-500">
                                                        <FaPaperclip />
                                                        <span className="max-w-full truncate px-2 text-[9px] font-bold uppercase">{file.name}</span>
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setCreateForm((prev) => ({
                                                        ...prev,
                                                        attachments: prev.attachments.filter((_, fileIndex) => fileIndex !== index),
                                                    }))}
                                                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/80 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                                >
                                                    <FaTimes size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Modal>
                )}

                {detailLeave && (
                    <Modal
                        isOpen={!!detailLeave}
                        onClose={() => setDetailLeave(null)}
                        title="Leave Details"
                        subtitle={`${detailLeave.employee_name} · ${detailLeave.leave_name}`}
                        icon={<FaEye className="h-6 w-6" />}
                        size="3xl"
                        footer={
                            <div className="flex gap-2 justify-end w-full">
                                <button
                                    type="button"
                                    onClick={() => setDetailLeave(null)}
                                    className="rounded-xl bg-gray-100 py-2.5 px-5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-200"
                                >
                                    Close
                                </button>
                                {detailLeave.status === 'pending' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRejectLeave(detailLeave);
                                                setRejectRemarks('');
                                                setDetailLeave(null);
                                            }}
                                            disabled={rejectAccess.disabled}
                                            title={rejectAccess.disabled ? reviewMessage : ''}
                                            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-rose-200 transition-all hover:from-rose-700 hover:to-red-700 disabled:opacity-50"
                                        >
                                            <FaTrash size={13} /> Reject
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setApproveLeave(detailLeave);
                                                setApproveRemarks('');
                                                setApproveForm({
                                                    start_date: toDateInputValue(detailLeave.start_date),
                                                    end_date: toDateInputValue(detailLeave.end_date),
                                                    is_half_day: Boolean(detailLeave.is_half_day),
                                                    half_day_type: detailLeave.half_day_type || 'first_half',
                                                });
                                                setDetailLeave(null);
                                            }}
                                            disabled={approveAccess.disabled}
                                            title={approveAccess.disabled ? reviewMessage : ''}
                                            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-200 transition-all hover:from-emerald-700 hover:to-green-700 disabled:opacity-50"
                                        >
                                            <FaCheck size={13} /> Approve / Edit
                                        </button>
                                    </>
                                )}
                            </div>
                        }
                    >
                        <div className="space-y-4">
                            {/* Header Card */}
                            <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xl font-black tracking-tight text-slate-800">
                                            {detailLeave.employee_name}
                                        </h3>
                                        <p className="text-blue-600 mt-1 font-semibold text-sm">
                                            {detailLeave.leave_name} · {formatDays(detailLeave.total_days)} Days
                                            {detailLeave.is_half_day && (
                                                <span className="ml-1 text-xs font-bold text-indigo-500">
                                                    (Half Day – {detailLeave.half_day_type === 'first_half' ? 'First Half' : 'Second Half'})
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <StatusBadge status={detailLeave.status} />
                                </div>
                                <div className="mt-2 inline-flex items-center rounded-lg bg-white/70 px-2 py-1 text-[10px] font-bold text-slate-500 border border-slate-200/70">
                                    {detailLeave.leave_code}
                                </div>
                            </div>

                            {/* Key Dates Grid */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-3">
                                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Start Date</label>
                                    <div className="text-sm font-medium text-gray-800">{fmt(detailLeave.start_date)}</div>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-3">
                                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">End Date</label>
                                    <div className="text-sm font-medium text-gray-800">{fmt(detailLeave.end_date)}</div>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-3">
                                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Applied On</label>
                                    <div className="text-sm font-medium text-gray-800">{fmt(detailLeave.applied_at)}</div>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-3">
                                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Payment Type</label>
                                    <div className="text-sm font-medium text-gray-800">{detailLeave.is_paid ? 'Paid Leave' : 'Unpaid Leave'}</div>
                                </div>

                                {/* Approved / Cancelled Dates */}
                                {detailLeave.approved_at && (
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Approved On</label>
                                        <div className="text-sm font-medium text-emerald-800">{fmt(detailLeave.approved_at)}</div>
                                    </div>
                                )}
                                {detailLeave.cancelled_at && (
                                    <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-rose-600">Cancelled On</label>
                                        <div className="text-sm font-medium text-rose-800">{fmt(detailLeave.cancelled_at)}</div>
                                    </div>
                                )}
                            </div>

                            {/* Half Day Detail (if not already shown) – added as a separate card for clarity */}
                            {detailLeave.is_half_day && (
                                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-indigo-600">Half Day Session</label>
                                    <div className="text-sm font-medium text-indigo-800">
                                        {detailLeave.half_day_type === 'first_half' ? 'First Half' : 'Second Half'}
                                    </div>
                                </div>
                            )}

                            {/* Reason / Description */}
                            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-3">
                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Reason / Description</label>
                                <div className="text-sm italic leading-relaxed text-gray-700">"{detailLeave.reason || 'No reason provided.'}"</div>
                            </div>

                            {/* Approval Remarks */}
                            {detailLeave.approval_remarks && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Approval Remarks</label>
                                    <div className="text-sm text-emerald-800">{detailLeave.approval_remarks}</div>
                                </div>
                            )}

                            {/* Attachments */}
                            {detailLeave.attachments?.length > 0 && (
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                        Attachments ({detailLeave.attachments.length})
                                    </label>
                                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                                        {detailLeave.attachments.map((url, index) => {
                                            const fileObj = {
                                                url,
                                                name: decodeURIComponent(url.substring(url.lastIndexOf('/') + 1) || 'attachment'),
                                                type: '', // will be detected by extension
                                            };
                                            const isImage = isImageAttachment(fileObj);
                                            return (
                                                <a
                                                    key={index}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow"
                                                >
                                                    {isImage ? (
                                                        <img
                                                            src={url}
                                                            alt={fileObj.name}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-orange-50 text-orange-500">
                                                            <FaPaperclip />
                                                            <span className="max-w-full truncate px-1 text-[9px] font-bold uppercase">
                                                                {fileObj.name.split('.').pop()}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                                </a>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Modal>
                )}

                {approveLeave && (
                    <Modal
                        isOpen={!!approveLeave}
                        onClose={() => {
                            setApproveLeave(null);
                            setApproveEmployee(null);
                            setApproveRemarks('');
                            setOverBalanceConfirm(null);
                            setApproveForm({
                                start_date: '',
                                end_date: '',
                                is_half_day: false,
                                half_day_type: 'first_half',
                            });
                        }}
                        title="Approve / Edit Leave"
                        subtitle={approveLeave.employee_name}
                        icon={<FaCheck className="h-6 w-6" />}
                        size="lg"
                        footer={
                            <div className="flex gap-3 w-full justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setApproveLeave(null);
                                        setApproveEmployee(null);
                                        setApproveRemarks('');
                                        setOverBalanceConfirm(null);
                                        setApproveForm({
                                            start_date: '',
                                            end_date: '',
                                            is_half_day: false,
                                            half_day_type: 'first_half',
                                        });
                                    }}
                                    className="flex px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={submitApprove}
                                    disabled={submitting || approveEmployeeLoading}
                                    className="flex px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-medium hover:from-emerald-700 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {submitting ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                                    {submitting ? 'Approving...' : 'Confirm Approve'}
                                </button>
                            </div>
                        }
                    >
                        <div className="space-y-4">
                            <p className="text-gray-600 text-sm leading-relaxed">Approve this leave request for <span className="font-bold text-gray-800">{approveLeave.employee_name}</span>. You can adjust the date range or convert it to a half-day before approving.</p>
                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Available Balance</p>
                                    {approveEmployeeLoading && <FaSpinner className="animate-spin text-slate-400" />}
                                </div>
                                {selectedApproveLeaveConfig ? (
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{selectedApproveLeaveConfig.name}</p>
                                            <p className="text-[11px] font-medium text-slate-500">
                                                {selectedApproveLeaveConfig.code || 'Leave'} · {formatDays(selectedApproveLeaveConfig.used)} used of {formatDays(selectedApproveLeaveConfig.total_allocated)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-lg font-black ${approveOverBalance ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {formatDays(selectedApproveLeaveConfig.remaining)}
                                            </p>
                                            <p className="text-[10px] font-bold uppercase text-slate-400">left</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs font-medium text-slate-400">
                                        {approveEmployeeLoading ? 'Loading employee leave balance...' : 'Balance was not found for this leave type.'}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Leave Date Range</label>
                                <AdvancedDateFilter
                                    value={{
                                        date: (approveForm.start_date && approveForm.start_date === approveForm.end_date) ? approveForm.start_date : "",
                                        from_date: (approveForm.start_date && approveForm.start_date !== approveForm.end_date) ? approveForm.start_date : "",
                                        to_date: (approveForm.end_date && approveForm.start_date !== approveForm.end_date) ? approveForm.end_date : "",
                                    }}
                                    onChange={(result) => {
                                        const nextStart = result?.date || result?.from_date || '';
                                        const nextEnd = result?.date || result?.to_date || nextStart;

                                        setApproveForm((prev) => ({
                                            ...prev,
                                            start_date: nextStart,
                                            end_date: nextEnd,
                                        }));
                                    }}
                                    tabOptions={["date", "range"]}
                                    placeholder="Select leave date range"
                                    buttonClassName="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                />
                                {selectedApproveLeaveConfig && (
                                    <p className={`mt-2 text-[11px] font-semibold ${approveOverBalance ? 'text-rose-600' : 'text-slate-500'}`}>
                                        {approveOverBalance
                                            ? `Selected range is ${formatDays(approveRequestedDays)} day(s), which exceeds the ${formatDays(selectedApproveLeaveConfig.remaining)} day(s) remaining.`
                                            : `Selected range uses ${formatDays(approveRequestedDays)} of ${formatDays(selectedApproveLeaveConfig.remaining)} available day(s).`}
                                    </p>
                                )}
                            </div>

                            {/* ─── Half Day Toggle — Approve Modal ─── */}
                            <div className={`rounded-xl border p-4 transition-all ${!approveAllowHalfDay
                                ? 'border-slate-100 bg-slate-50 opacity-60'
                                : approveForm.is_half_day
                                    ? 'border-emerald-200 bg-emerald-50/60 ring-2 ring-emerald-100'
                                    : 'border-gray-200 bg-gray-50'
                                }`}>
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Half Day</p>
                                        <p className="mt-0.5 text-xs font-medium text-slate-400">
                                            {!approveAllowHalfDay
                                                ? 'Half day not allowed for this leave type'
                                                : approveForm.is_half_day
                                                    ? 'Converting to half day'
                                                    : 'Convert this leave to half day'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!approveAllowHalfDay}
                                        onClick={() => {
                                            if (!approveAllowHalfDay) return;
                                            setApproveForm((prev) => ({
                                                ...prev,
                                                is_half_day: !prev.is_half_day,
                                                half_day_type: prev.half_day_type || 'first_half',
                                            }));
                                        }}
                                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 ${!approveAllowHalfDay
                                            ? 'bg-slate-200 cursor-not-allowed'
                                            : approveForm.is_half_day
                                                ? 'bg-emerald-600'
                                                : 'bg-slate-300'
                                            }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${approveForm.is_half_day ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                {approveAllowHalfDay && approveForm.is_half_day && (
                                    <div className="mt-4">
                                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Half Day Session</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { value: 'first_half', label: 'First Half' },
                                                { value: 'second_half', label: 'Second Half' },
                                            ].map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setApproveForm((prev) => ({ ...prev, half_day_type: option.value }))}
                                                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${approveForm.half_day_type === option.value
                                                        ? 'border-emerald-200 bg-white text-emerald-700 shadow-sm'
                                                        : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Approval Remarks (Optional)</label>
                                <textarea
                                    placeholder="Optional approval remarks..."
                                    className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none h-24"
                                    value={approveRemarks}
                                    onChange={(e) => setApproveRemarks(e.target.value)}
                                />
                            </div>
                        </div>
                    </Modal>
                )}

                {overBalanceDetails && (
                    <Modal
                        isOpen={!!overBalanceDetails}
                        onClose={() => {
                            if (!submitting) setOverBalanceConfirm(null);
                        }}
                        title={overBalanceDetails.title}
                        subtitle="Leave balance is lower than the selected date range."
                        icon={<FaExclamationTriangle className="h-6 w-6" />}
                        size="md"
                        footer={
                            <div className="flex gap-3 w-full justify-end">
                                <button
                                    type="button"
                                    onClick={() => setOverBalanceConfirm(null)}
                                    disabled={submitting}
                                    className="flex px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all disabled:opacity-60"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={overBalanceDetails.onConfirm}
                                    disabled={submitting}
                                    className="flex px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-medium hover:from-amber-700 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed items-center justify-center gap-2"
                                >
                                    {submitting ? <FaSpinner className="animate-spin" /> : <FaExclamationTriangle />}
                                    {submitting ? 'Submitting...' : overBalanceDetails.actionLabel}
                                </button>
                            </div>
                        }
                    >
                        <div className="space-y-4">
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                                <p className="font-bold">This request exceeds the available leave balance.</p>
                                <p className="mt-2 leading-relaxed">
                                    {overBalanceDetails.employeeName} selected {formatDays(overBalanceDetails.requestedDays)} day(s) of {overBalanceDetails.leaveName}, but only {formatDays(overBalanceDetails.remainingDays)} day(s) are available.
                                </p>
                            </div>
                            <p className="text-sm leading-relaxed text-slate-600">
                                Confirm only if you want to continue submitting this leave request despite the balance shortage.
                            </p>
                        </div>
                    </Modal>
                )}

                {rejectLeave && (
                    <Modal
                        isOpen={!!rejectLeave}
                        onClose={() => setRejectLeave(null)}
                        title="Reject Leave"
                        subtitle={rejectLeave.employee_name}
                        icon={<FaTrash className="h-6 w-6" />}
                        size="md"
                        footer={
                            <div className="flex gap-3 justify-end w-full">
                                <button
                                    type="button"
                                    onClick={() => setRejectLeave(null)}
                                    className="flex px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={submitReject}
                                    disabled={submitting}
                                    className="flex px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl font-medium hover:from-rose-700 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {submitting ? <FaSpinner className="animate-spin" /> : <FaTrash />}
                                    {submitting ? 'Rejecting...' : 'Reject Request'}
                                </button>
                            </div>
                        }
                    >
                        <div className="space-y-4">
                            <p className="text-gray-600 text-sm leading-relaxed">Please provide a reason for rejecting <span className="font-bold text-gray-800">{rejectLeave.employee_name}</span>'s request.</p>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Rejection Reason <span className="text-red-500">*</span></label>
                                <textarea
                                    placeholder="Rejection reason (Required)..."
                                    className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all resize-none h-24"
                                    value={rejectRemarks}
                                    onChange={(e) => setRejectRemarks(e.target.value)}
                                />
                            </div>
                        </div>
                    </Modal>
                )}
            </div>

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
                                onClick={() => setSelectedIds([])}
                                className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Clear
                            </button>
                            <ManagementButton
                                tone="green"
                                variant="solid"
                                leftIcon={<FaCheck />}
                                onClick={() => { setBulkApproveRemarks(''); setShowBulkApproveModal(true); }}
                                disabled={approveAccess.disabled}
                                className="shadow-lg shadow-green-200 !text-xs !px-3 !py-1.5"
                                title={approveAccess.disabled ? reviewMessage : ""}
                            >
                                Approve All
                            </ManagementButton>
                            <ManagementButton
                                tone="red"
                                variant="solid"
                                leftIcon={<FaTimes />}
                                onClick={() => { setBulkRejectRemarks(''); setShowBulkRejectModal(true); }}
                                disabled={rejectAccess.disabled}
                                className="shadow-lg shadow-red-200 !text-xs !px-3 !py-1.5"
                                title={rejectAccess.disabled ? reviewMessage : ""}
                            >
                                Reject All
                            </ManagementButton>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {showBulkApproveModal && (
                <Modal
                    isOpen={showBulkApproveModal}
                    onClose={() => { setShowBulkApproveModal(false); setBulkApproveRemarks(''); }}
                    title="Bulk Approve Leaves"
                    subtitle={`${selectedIds.length} leave request${selectedIds.length > 1 ? 's' : ''} selected`}
                    icon={<FaCheck className="h-6 w-6" />}
                    size="md"
                    footer={
                        <div className="flex gap-3 w-full justify-end">
                            <button
                                type="button"
                                onClick={() => { setShowBulkApproveModal(false); setBulkApproveRemarks(''); }}
                                className="flex px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleBulkApprove}
                                disabled={submitting}
                                className="flex-1 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-medium hover:from-emerald-700 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                                {submitting ? 'Approving...' : `Confirm Approve ${selectedIds.length}`}
                            </button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <p className="text-gray-600 text-sm leading-relaxed">
                            You are about to approve <span className="font-bold text-gray-800">{selectedIds.length} leave request{selectedIds.length > 1 ? 's' : ''}</span>. This action cannot be undone.
                        </p>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Approval Remarks <span className="text-gray-400 font-normal">(Optional)</span>
                            </label>
                            <textarea
                                placeholder="Add optional remarks for all selected leave requests..."
                                className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none h-24"
                                value={bulkApproveRemarks}
                                onChange={(e) => setBulkApproveRemarks(e.target.value)}
                            />
                        </div>
                    </div>
                </Modal>
            )}

            {showBulkRejectModal && (
                <Modal
                    isOpen={showBulkRejectModal}
                    onClose={() => { setShowBulkRejectModal(false); setBulkRejectRemarks(''); }}
                    title="Bulk Reject Leaves"
                    subtitle={`${selectedIds.length} leave request${selectedIds.length > 1 ? 's' : ''} selected`}
                    icon={<FaTimes className="h-6 w-6" />}
                    size="md"
                    footer={
                        <div className="flex gap-3 w-full justify-end">
                            <button
                                type="button"
                                onClick={() => { setShowBulkRejectModal(false); setBulkRejectRemarks(''); }}
                                className="flex px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleBulkReject}
                                disabled={submitting}
                                className="flex-1 px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl font-medium hover:from-rose-700 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? <FaSpinner className="animate-spin" /> : <FaTimes />}
                                {submitting ? 'Rejecting...' : `Confirm Reject ${selectedIds.length}`}
                            </button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <p className="text-gray-600 text-sm leading-relaxed">
                            You are about to reject <span className="font-bold text-gray-800">{selectedIds.length} leave request{selectedIds.length > 1 ? 's' : ''}</span>. This action cannot be undone.
                        </p>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Rejection Reason <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                placeholder="Provide a reason for rejecting all selected leave requests..."
                                className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all resize-none h-24"
                                value={bulkRejectRemarks}
                                onChange={(e) => setBulkRejectRemarks(e.target.value)}
                            />
                        </div>
                    </div>
                </Modal>
            )}
        </ManagementHub>
    );
};

export default LeaveManagement;
