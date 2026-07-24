import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    FaPlus, FaSpinner, FaCheckCircle,
    FaTimesCircle, FaExclamationTriangle, FaTimes,
    FaEdit, FaInfoCircle,
    FaListUl, FaTh, FaEye,
    FaBuilding, FaMapMarkerAlt, FaGlobe, FaSearch,
    FaClock, FaNetworkWired, FaUserCheck, FaRoad, FaCity,
    FaCrosshairs, FaHistory, FaLink, FaMapPin, FaEnvelope,
    FaCheck, FaMinusCircle, FaCog, FaUser, FaCalendarAlt,
    FaCoffee, FaPlay, FaStop, FaChevronDown, FaPhone,
    FaShieldAlt, FaBan
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import apiCall from '../utils/api';
import Pagination, { usePagination } from '../components/PaginationComponent';
import SkeletonComponent from '../components/SkeletonComponent';
import ActionMenu from '../components/ActionMenu';
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import { EmployeeSelect, ManagementHub, ManagementTable, RefreshButton } from '../components/common';
import ModalScrollLock from '../components/ModalScrollLock';
import TimePickerField from '../components/TimePicker';
import AdvancedDateFilter from '../components/AdvancedDateFilter';
import useEmployeeNavigation from '../hooks/useEmployeeNavigation';

// ─── Variants ──────────────────────────────────────────────────────────────────

const modalVariants = {
    hidden: { opacity: 0, scale: 0.92, y: 24 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', duration: 0.45 } },
    exit: { opacity: 0, scale: 0.92, y: 24, transition: { duration: 0.25 } }
};
const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const avatarPalette = [
    { bg: '#EEF2FF', text: '#4338CA' },
    { bg: '#F0FDF4', text: '#15803D' },
    { bg: '#FFF7ED', text: '#C2410C' },
    { bg: '#FDF4FF', text: '#9333EA' },
    { bg: '#EFF6FF', text: '#1D4ED8' },
];

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatDate(str) {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(str) {
    if (!str) return '—';
    return new Date(str).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatTime(t) {
    if (!t) return '—';
    if (typeof t === 'object' && t.time) return t.time.slice(0, 5);
    if (typeof t === 'string') return t.slice(0, 5);
    return '—';
}

function getTimeStr(t) {
    if (!t) return '';
    if (typeof t === 'object' && t.time) return t.time.slice(0, 5);
    if (typeof t === 'string') return t.slice(0, 5);
    return '';
}

function getTodayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatMins(m) {
    if (!m) return '0 min';
    const n = Number(m);
    if (n < 60) return `${n} min`;
    return `${Math.floor(n / 60)}h ${n % 60}m`;
}

function getBreakDurationMins(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    if (isNaN(start) || isNaN(end)) return 0;
    return Math.max(0, Math.round((end - start) / 60000));
}

function desigLabel(val) {
    if (!val) return '—';
    if (typeof val === 'object' && val !== null) {
        const inner = val.label ?? val.value;
        if (typeof inner === 'object' && inner !== null) return inner.label || '—';
        if (typeof inner === 'string') return inner;
    }
    if (typeof val === 'string') return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return '—';
}

// ─── Small Reusable Components ─────────────────────────────────────────────────

const InfoItem = ({ icon, label, value }) => (
    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            {icon} {label}
        </label>
        <div className="text-gray-800 font-semibold text-sm break-words">{value || '—'}</div>
    </div>
);

const VerifiedBadge = ({ isVerified }) => (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border
        ${isVerified
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isVerified ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        {isVerified ? 'Verified' : 'Pending'}
    </span>
);

const DayStatusBadge = ({ status }) => {
    const cfg = {
        present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        absent: 'bg-red-50 text-red-600 border-red-200',
        half_day: 'bg-sky-50 text-sky-700 border-sky-200',
        paid_leave: 'bg-violet-50 text-violet-700 border-violet-200',
        unmarked: 'bg-gray-50 text-gray-500 border-gray-200',
    };
    const label = (status || 'unmarked').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${cfg[status] || cfg.unmarked}`}>
            {label}
        </span>
    );
};

const SummaryCard = ({ icon, label, value, gradient, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4 }}
        className={`bg-gradient-to-r ${gradient} rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300`}>
        <div className="flex items-center justify-between">
            <div>
                <p className="text-xs opacity-80 mb-1">{label}</p>
                <p className="text-3xl font-bold">{value}</p>
            </div>
            <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center text-xl">
                {icon}
            </div>
        </div>
    </motion.div>
);

// ─── Break Detail Modal ────────────────────────────────────────────────────────

const BreakDetailModal = ({ record, onClose, onEdit }) => {
    const navigateToEmployeeProfile = useEmployeeNavigation();
    if (!record) return null;
    const idx = (record.employee_id || 0) % 5;
    const breakStart = record.break_start;
    const breakEnd = record.break_end;
    const startStr = formatTime(breakStart);
    const endStr = formatTime(breakEnd);
    const durationMins = getBreakDurationMins(getTimeStr(breakStart), getTimeStr(breakEnd));

    return (
        <AnimatePresence>
            <motion.div variants={backdropVariants} initial="hidden" animate="visible" exit="exit"
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6"
                onClick={onClose}>
                <ModalScrollLock />
                <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit"
                    className="bg-white relative w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl border border-gray-100 m-auto flex flex-col overflow-hidden"
                    onClick={e => e.stopPropagation()}>

                    {/* Fixed Header */}
                    <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-gray-100 bg-white z-10 flex-shrink-0">
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                            <FaCoffee className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Break Details</h2>
                            <p className="text-xs text-gray-400 mt-0.5">View break record information</p>
                        </div>
                        <button onClick={onClose}
                            className="ml-auto w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-400 hover:text-gray-600"
                            aria-label="Close">
                            <FaTimes className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Scrollable Body */}
                    <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

                        {/* Identity */}
                        <div className="flex flex-col sm:flex-row items-center gap-5 pb-5 border-b border-gray-100">
                            <div 
                                className="w-20 h-20 rounded-xl flex items-center justify-center text-2xl font-black overflow-hidden shadow ring-4 ring-gray-100 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ background: avatarPalette[idx].bg, color: avatarPalette[idx].text }}
                                onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(record.employee_id); }}
                            >
                                {record.profile_picture
                                    ? <img src={record.profile_picture} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                                    : getInitials(record.name)}
                            </div>
                            <div className="text-center sm:text-left">
                                <h3 
                                    className="text-2xl font-black text-gray-900 cursor-pointer hover:underline hover:text-indigo-600 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(record.employee_id); }}
                                >
                                    {record.name}
                                </h3>
                                <p className="text-sm text-gray-400 mt-0.5">{desigLabel(record.designation)}</p>
                                <div className="mt-2 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                    <VerifiedBadge isVerified={record.is_verified} />
                                    <DayStatusBadge status={record.day_status} />
                                    <span className="text-xs text-gray-300 font-mono">#{record.attendance_id}</span>
                                </div>
                            </div>
                        </div>

                        {/* Employee Info */}
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <FaUser className="w-3 h-3" /> Employee Info
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <InfoItem icon={<FaUser className="text-blue-400" />} label="Employee Code" value={record.employee_code} />
                                <InfoItem icon={<FaEnvelope className="text-blue-400" />} label="Email" value={record.email} />
                                <InfoItem icon={<FaPhone className="text-blue-400" />} label="Phone" value={record.phone} />
                                <InfoItem icon={<FaCalendarAlt className="text-blue-400" />} label="Joining Date" value={formatDate(record.joining_date)} />
                            </div>
                        </div>

                        {/* Break Info */}
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <FaCoffee className="w-3 h-3" /> Break Info
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <InfoItem icon={<FaCalendarAlt className="text-amber-400" />} label="Attendance Date" value={formatDate(record.attendance_date)} />
                                <InfoItem icon={<FaClock className="text-amber-400" />} label="Allowed Break" value={formatMins(record.allowed_break_minutes)} />
                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                    <label className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                        <FaPlay className="text-emerald-400" /> Break Start
                                    </label>
                                    <div className="text-gray-800 font-semibold text-sm">{startStr}</div>
                                    {breakStart?.method && (
                                        <div className="text-xs text-gray-400 mt-1">Method: {breakStart.method}</div>
                                    )}
                                </div>
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                    <label className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                        <FaStop className="text-red-400" /> Break End
                                    </label>
                                    <div className="text-gray-800 font-semibold text-sm">{endStr}</div>
                                    {breakEnd?.method && (
                                        <div className="text-xs text-gray-400 mt-1">Method: {breakEnd.method}</div>
                                    )}
                                </div>
                            </div>
                            {durationMins > 0 && (
                                <div className="mt-3 bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Duration Used</span>
                                    <span className="text-lg font-black text-indigo-700">{formatMins(durationMins)}</span>
                                </div>
                            )}
                            {record.remark && (
                                <div className="mt-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Remark</label>
                                    <div className="text-gray-700 text-sm">{record.remark}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Fixed Footer */}
                    <div className="flex flex-col justify-end sm:flex-row gap-3 px-6 py-4 border-t border-gray-100 bg-white flex-shrink-0">
                        <button onClick={onClose}
                            className="flex px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-semibold items-center justify-center gap-2">
                            Close
                        </button>
                        <button onClick={() => { onEdit(record); onClose(); }}
                            className="flex px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-semibold items-center justify-center gap-2 shadow-sm">
                            <FaEdit size={14} /> Edit Break
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ─── Create / Edit Break Modal ─────────────────────────────────────────────────

const BreakFormModal = ({ record, onClose, onSubmit, saving, isEdit = false }) => {
    const [breakStart, setBreakStart] = useState(isEdit ? getTimeStr(record?.break_start) : '');
    const [breakEnd, setBreakEnd] = useState(isEdit ? getTimeStr(record?.break_end) : '');
    const [notes, setNotes] = useState(record?.remark || '');
    const [employeeId, setEmployeeId] = useState(isEdit ? (record?.employee_id || '') : '');
    const [date, setDate] = useState(isEdit ? (record?.attendance_date || '') : new Date().toISOString().slice(0, 10));
    
    const initialEmployee = useMemo(() => {
        if (!record?.employee_id) return null;
        return {
            id: record.employee_id,
            name: record.name,
            employee_code: record.employee_code,
            designation: record.designation,
            profile_picture: record.profile_picture,
        };
    }, [record]);

    const isSaveDisabled = saving || !breakStart || !employeeId || !date;

    const handleSubmit = () => {
        if (!breakStart) return toast.error('Break start time is required');
        if (!employeeId) return toast.error('Employee is required');

        const payload = {
            employee_id: employeeId,
            date,
            type: 'break',
            start_time: breakStart,
            end_time: breakEnd || null,
            notes,
        };

        // ✅ Include record ID when editing to ensure proper update
        if (isEdit && record?.attendance_id) {
            payload.attendance_id = record.attendance_id;
        }

        onSubmit(payload);
    };

    return (
        <AnimatePresence>
            <motion.div variants={backdropVariants} initial="hidden" animate="visible" exit="exit"
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6"
                onClick={onClose}>
                <ModalScrollLock />
                <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit"
                    className="bg-white relative w-full max-w-lg rounded-xl shadow-2xl border border-gray-100 m-auto flex flex-col overflow-hidden"
                    onClick={e => e.stopPropagation()}>

                    <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-gray-100 bg-white z-10 flex-shrink-0">
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                            <FaCoffee className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Break' : 'Create Break'}</h2>
                            <p className="text-xs text-gray-400 mt-0.5">{isEdit ? `Editing record #${record?.attendance_id}` : 'Add a new break record'}</p>
                        </div>
                        <button onClick={onClose}
                            className="ml-auto w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-400 hover:text-gray-600">
                            <FaTimes className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Employee <span className="text-red-400">*</span></label>
                            <EmployeeSelect
                                value={employeeId}
                                onChange={(value) => setEmployeeId(value || '')}
                                placeholder="Choose an employee..."
                                disabled={isEdit}
                                initialEmployee={initialEmployee}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Date <span className="text-red-400">*</span></label>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                disabled={isEdit}
                                className={`h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none shadow-sm transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 ${isEdit ? 'opacity-75 cursor-not-allowed' : ''}`}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <TimePickerField 
                                label="Break Start *" 
                                value={breakStart} 
                                onChange={setBreakStart} 
                                disabled={isEdit} // Start time cannot be changed when editing
                            />
                            <TimePickerField 
                                label="Break End" 
                                value={breakEnd} 
                                onChange={setBreakEnd} 
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Notes (optional)</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={3}
                                placeholder="Add any details..."
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 outline-none resize-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-white flex-shrink-0">
                        <button onClick={onClose}
                            className="px-5 py-2.5 border-2 border-gray-100 text-gray-600 rounded-xl hover:bg-gray-50 transition-all font-semibold">
                            Cancel
                        </button>
                        <button onClick={handleSubmit} disabled={isSaveDisabled}
                            className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl hover:from-amber-500 hover:to-orange-600 transition-all font-semibold flex items-center gap-2 shadow-md disabled:opacity-50">
                            {saving ? <FaSpinner className="animate-spin" size={14} /> : (isEdit ? <FaEdit size={14} /> : <FaPlus size={14} />)}
                            {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Break')}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

const BreakManagementPage = () => {
    const navigateToEmployeeProfile = useEmployeeNavigation();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [viewMode, setViewMode] = useState('table');
    const [activeActionMenu, setActiveActionMenu] = useState(null);
    const [detailTarget, setDetailTarget] = useState(null);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalTarget, setEditModalTarget] = useState(null);
    const [dateFilter, setDateFilter] = useState({
        date: getTodayIso(),
        month: '', year: '', from_date: '', to_date: '',
    });
    const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 20);
    const fetchInProgress = useRef(false);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 500);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const buildDateParams = useCallback(() => {
        if (dateFilter.date) return { from_date: dateFilter.date, to_date: dateFilter.date };
        if (dateFilter.from_date && dateFilter.to_date) return { from_date: dateFilter.from_date, to_date: dateFilter.to_date };
        if (dateFilter.month && dateFilter.year) {
            const from = `${dateFilter.year}-${String(dateFilter.month).padStart(2, '0')}-01`;
            const to = new Date(dateFilter.year, dateFilter.month, 0).toISOString().slice(0, 10);
            return { from_date: from, to_date: to };
        }
        return { from_date: '', to_date: '' };
    }, [dateFilter]);

    const fetchRecords = useCallback(async (page = pagination.page, search = debouncedSearch, resetLoading = true) => {
        if (fetchInProgress.current) return;
        fetchInProgress.current = true;
        if (resetLoading) setLoading(true);
        try {
            const { from_date, to_date } = buildDateParams();
            const companyId = JSON.parse(localStorage.getItem('company'))?.id ?? null;
            let url = `/attendance/list?page=${page}&limit=${pagination.limit}&type=break&from_date=${from_date}&to_date=${to_date}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (employeeId) url += `&employee_id=${encodeURIComponent(employeeId)}`;
            const res = await apiCall(url, 'GET', null, companyId);
            const result = await res.json();
            if (result.success) {
                setRecords(result.data || []);
                const meta = result.meta || {};
                updatePagination({
                    page: Number(meta.page ?? page),
                    limit: Number(meta.limit ?? pagination.limit),
                    total: Number(meta.total ?? 0),
                    total_pages: Number(meta.total_pages ?? 1),
                    is_last_page: meta.is_last_page ?? false,
                });
            } else {
                throw new Error(result.message || 'Failed to fetch break records');
            }
        } catch (e) {
            toast.error(e.message || 'Failed to load break records');
        } finally {
            setLoading(false);
            fetchInProgress.current = false;
            setIsInitialLoad(false);
        }
    }, [pagination.page, pagination.limit, debouncedSearch, buildDateParams, employeeId, updatePagination]);

    useEffect(() => {
        if (!isInitialLoad) {
            if (pagination.page !== 1) goToPage(1);
            else fetchRecords(1, debouncedSearch, true);
        }
    }, [debouncedSearch, dateFilter, employeeId]);

    useEffect(() => {
        if (!isInitialLoad && !fetchInProgress.current) {
            fetchRecords(pagination.page, debouncedSearch, true);
        }
    }, [pagination.page, pagination.limit]);

    useEffect(() => {
        fetchRecords(1, '', true);
    }, []);

    const handleCreate = async (payload) => {
        setSaving(true);
        try {
            const companyId = JSON.parse(localStorage.getItem('company'))?.id ?? null;
            const res = await apiCall('/attendance/mark', 'POST', payload, companyId);
            const result = await res.json();
            if (!result.success) throw new Error(result.message || 'Failed to create break');
            toast.success('Break created successfully!');
            setCreateModalOpen(false);
            fetchRecords(1, debouncedSearch, true);
        } catch (e) {
            toast.error(e.message || 'Failed to create break');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async (payload) => {
        setSaving(true);
        try {
            const companyId = JSON.parse(localStorage.getItem('company'))?.id ?? null;
            const res = await apiCall('/attendance/mark', 'POST', payload, companyId);
            const result = await res.json();
            if (!result.success) throw new Error(result.message || 'Update failed');
            toast.success('Break updated successfully!');
            setEditModalTarget(null);
            fetchRecords(pagination.page, debouncedSearch, true);
        } catch (e) {
            toast.error(e.message || 'Failed to update break');
        } finally {
            setSaving(false);
        }
    };

    const stats = useMemo(() => ({
        total: pagination.total || 0,
        verified: records.filter(r => r.is_verified).length,
        open: records.filter(r => getTimeStr(r.break_start) && !getTimeStr(r.break_end)).length,
        present: records.filter(r => r.day_status === 'present').length,
    }), [records, pagination.total]);

    if (isInitialLoad && loading) return <SkeletonComponent />;

    return (
        <ManagementHub
            eyebrow={<><FaCoffee size={11} /> Break management</>}
            title="Break Management"
            description="Monitor and manage employee break records with time tracking."
            accent="amber"
            summary={
                <div className="flex items-center gap-2 text-sm bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
                    <FaCoffee className="text-amber-400" />
                    <span className="font-semibold text-gray-700">{stats.total}</span>
                    <span className="text-gray-400">records</span>
                </div>
            }
            actions={
                <>
                    <RefreshButton loading={loading} onClick={() => fetchRecords(pagination.page, debouncedSearch, true)}>
                        Refresh
                    </RefreshButton>
                    <motion.button whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setCreateModalOpen(true)}
                        className="group relative px-5 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 overflow-hidden">
                        <FaPlus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                        <span className="text-sm">Create Break</span>
                        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    </motion.button>
                </>
            }
        >
            <div className="mx-auto max-w-screen-2xl space-y-4 px-2">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    <SummaryCard icon={<FaCoffee />} label="Total Records" value={stats.total} gradient="from-amber-400 to-orange-500" delay={0.05} />
                    <SummaryCard icon={<FaCheckCircle />} label="Verified" value={stats.verified} gradient="from-emerald-400 to-teal-500" delay={0.10} />
                    <SummaryCard icon={<FaPlay />} label="Open Breaks" value={stats.open} gradient="from-violet-400 to-purple-500" delay={0.15} />
                    <SummaryCard icon={<FaUserCheck />} label="Present Today" value={stats.present} gradient="from-blue-400 to-indigo-500" delay={0.20} />
                </div>

                {/* Search / Filter / View Toolbar */}
                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        {/* SEARCH */}
                        <div className="w-full lg:flex-1">
                            <div className="relative">
                                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Search by employee name, code, or email..."
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-10 text-sm outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 min-h-[42px]"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                        title="Clear search"
                                    >
                                        <FaTimes size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* EMPLOYEE SELECT */}
                        <div className="w-full lg:w-[240px] lg:flex-none">
                            <EmployeeSelect
                                value={employeeId}
                                onChange={(value) => setEmployeeId(value || '')}
                                placeholder="All employees"
                            />
                        </div>

                        {/* DATE + VIEW */}
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:w-auto lg:flex-none">
                            <div className="w-full sm:flex-1 lg:w-[260px] lg:flex-none">
                                <AdvancedDateFilter
                                    value={dateFilter}
                                    onChange={(val) => {
                                        setDateFilter(val);
                                        goToPage(1);
                                    }}
                                    placeholder="Date or range"
                                    tabOptions={['date', 'range']}
                                    showDateStepper
                                    buttonClassName="h-full min-h-[42px] w-full bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                                />
                            </div>
                            <div className="flex justify-end lg:justify-start">
                                <ManagementViewSwitcher
                                    viewMode={viewMode}
                                    onChange={setViewMode}
                                    accent="amber"
                                />
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Loading skeleton */}
                {loading && !records.length && <SkeletonComponent />}

                {/* Empty State */}
                {!loading && records.length === 0 && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl shadow-md border border-gray-100 p-16 text-center">
                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-5">
                            <FaCoffee className="text-4xl text-amber-200" />
                        </div>
                        <p className="text-xl font-bold text-gray-600 mb-2">No break records found</p>
                        <p className="text-gray-400 text-sm">
                            {debouncedSearch ? `No results for "${debouncedSearch}"` : 'Click "Create Break" to add a record'}
                        </p>
                        {debouncedSearch
                            ? <button onClick={() => setSearchTerm('')} className="mt-4 px-5 py-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 text-sm font-semibold">Clear Search</button>
                            : <button onClick={() => setCreateModalOpen(true)} className="mt-4 px-6 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl text-sm font-semibold shadow-lg">Create Break</button>}
                    </motion.div>
                )}

                {/* Table View */}
                {!loading && records.length > 0 && viewMode === 'table' && (
                    <ManagementTable
                        rows={records}
                        columns={[
                            { key: 'employee', label: 'Employee', render: (record) => {
                                const idx = (record.employee_id || 0) % 5;
                                return (
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden shadow-sm cursor-pointer hover:opacity-80"
                                            style={{ background: avatarPalette[idx].bg, color: avatarPalette[idx].text }}
                                            onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(record.employee_id); }}
                                        >
                                            {record.profile_picture
                                                ? <img src={record.profile_picture} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                                                : getInitials(record.name)}
                                        </div>
                                        <div>
                                            <p
                                                className="font-semibold text-gray-800 cursor-pointer hover:underline hover:text-indigo-600 transition-colors"
                                                onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(record.employee_id); }}
                                            >
                                                {record.name}
                                            </p>
                                            <p className="text-xs text-indigo-400 font-mono">{record.employee_code}</p>
                                        </div>
                                    </div>
                                );
                            }},
                            { key: 'designation', label: 'Designation', render: (record) => (
                                <p className="text-xs text-gray-500 font-medium">{desigLabel(record.designation)}</p>
                            )},
                            { key: 'date', label: 'Date', render: (record) => (
                                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                    <FaCalendarAlt className="text-amber-400 flex-shrink-0" />
                                    <span>{formatDate(record.attendance_date)}</span>
                                </div>
                            )},
                            { key: 'break_start', label: 'Break Start', render: (record) => {
                                const startStr = formatTime(record.break_start);
                                const isOpen = getTimeStr(record.break_start) && !getTimeStr(record.break_end);
                                return (
                                    <div className="flex items-center gap-1.5">
                                        <FaPlay className="text-emerald-400 flex-shrink-0" size={10} />
                                        <span className="text-xs font-mono font-semibold text-gray-700">{startStr}</span>
                                        {isOpen && (
                                            <span className="ml-1 px-1.5 py-0.5 bg-orange-50 border border-orange-200 rounded text-[10px] font-bold text-orange-500 animate-pulse">LIVE</span>
                                        )}
                                    </div>
                                );
                            }},
                            { key: 'break_end', label: 'Break End', render: (record) => (
                                <div className="flex items-center gap-1.5">
                                    <FaStop className="text-red-400 flex-shrink-0" size={10} />
                                    <span className="text-xs font-mono font-semibold text-gray-700">{formatTime(record.break_end)}</span>
                                </div>
                            )},
                            { key: 'day_status', label: 'Status', render: (record) => (
                                <DayStatusBadge status={record.day_status} />
                            )},
                            { key: 'verified', label: 'Verified', render: (record) => (
                                <VerifiedBadge isVerified={record.is_verified} />
                            )},
                        ]}
                        rowKey={(row) => row.attendance_id}
                        onRowClick={(row) => setDetailTarget(row)}
                        getActions={(record) => [
                            { label: 'View Details', icon: <FaEye size={13} />, onClick: () => setDetailTarget(record), className: 'text-green-600 hover:text-green-700 hover:bg-green-50' },
                            { label: 'Edit', icon: <FaEdit size={13} />, onClick: () => setEditModalTarget(record), className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50' },
                        ]}
                        accent="amber"
                    />
                )}

                {/* Card View */}
                {!loading && records.length > 0 && viewMode === 'card' && (
                    <ManagementGrid viewMode={viewMode}>
                        {records.map((record, i) => {
                            const idx = (record.employee_id || 0) % 5;
                            const startStr = formatTime(record.break_start);
                            const endStr = formatTime(record.break_end);
                            const isOpen = getTimeStr(record.break_start) && !getTimeStr(record.break_end);
                            const durationMins = getBreakDurationMins(getTimeStr(record.break_start), getTimeStr(record.break_end));
                            return (
                                <motion.div key={record.attendance_id}
                                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                    onClick={() => setDetailTarget(record)}
                                    className="bg-white rounded-xl shadow-md border border-gray-100 p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col">

                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-base font-bold overflow-hidden shadow-sm group-hover:scale-105 transition-transform duration-300 cursor-pointer hover:opacity-80"
                                                style={{ background: avatarPalette[idx].bg, color: avatarPalette[idx].text }}
                                                onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(record.employee_id); }}
                                            >
                                                {record.profile_picture
                                                    ? <img src={record.profile_picture} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                                                    : getInitials(record.name)}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 
                                                    className="font-bold text-gray-800 text-sm leading-tight truncate group-hover:text-amber-600 transition-colors cursor-pointer hover:underline hover:text-indigo-600"
                                                    onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(record.employee_id); }}
                                                >
                                                    {record.name}
                                                </h3>
                                                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[150px] font-mono">{record.employee_code}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            <VerifiedBadge isVerified={record.is_verified} />
                                            {isOpen && (
                                                <span className="px-2 py-0.5 bg-orange-50 border border-orange-200 rounded text-[10px] font-bold text-orange-500 animate-pulse">LIVE</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="space-y-2.5 mb-4 flex-1">
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <FaCalendarAlt className="text-amber-400 flex-shrink-0 w-3 h-3" />
                                            <span>{formatDate(record.attendance_date)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <FaUser className="text-blue-400 flex-shrink-0 w-3 h-3" />
                                            <span>{desigLabel(record.designation)}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <div className="bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-0.5">Start</p>
                                                <p className="text-xs font-mono font-bold text-gray-800">{startStr}</p>
                                                {record.break_start?.method && (
                                                    <p className="text-[10px] text-gray-400">{record.break_start.method}</p>
                                                )}
                                            </div>
                                            <div className="bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-0.5">End</p>
                                                <p className="text-xs font-mono font-bold text-gray-800">{endStr}</p>
                                                {record.break_end?.method && (
                                                    <p className="text-[10px] text-gray-400">{record.break_end.method}</p>
                                                )}
                                            </div>
                                        </div>
                                        {durationMins > 0 && (
                                            <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-100">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Duration</span>
                                                <span className="text-xs font-black text-indigo-700">{formatMins(durationMins)}</span>
                                            </div>
                                        )}
                                        <DayStatusBadge status={record.day_status} />
                                    </div>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between pt-3 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                                        <span className="text-xs text-gray-300 font-mono">#{record.attendance_id}</span>
                                        <ActionMenu
                                            menuId={`card-${record.attendance_id}`}
                                            activeId={activeActionMenu}
                                            onToggle={(e, id) => setActiveActionMenu(curr => curr === id ? null : id)}
                                            actions={[
                                                { label: 'View Details', icon: <FaEye size={13} />, onClick: () => setDetailTarget(record), className: 'text-green-600 hover:text-green-700 hover:bg-green-50' },
                                                { label: 'Edit', icon: <FaEdit size={13} />, onClick: () => setEditModalTarget(record), className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50' },
                                            ]}
                                        />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </ManagementGrid>
                )}

                {/* Pagination */}
                {!loading && (records.length > 0 || pagination.total > 0) && (
                    <Pagination
                        currentPage={pagination.page}
                        totalItems={pagination.total}
                        itemsPerPage={pagination.limit}
                        onPageChange={(p) => { if (p !== pagination.page) goToPage(p); }}
                        showInfo={true}
                        onLimitChange={changeLimit}
                    />
                )}
            </div>

            {/* Modals */}
            <AnimatePresence>
                {detailTarget && (
                    <BreakDetailModal
                        record={detailTarget}
                        onClose={() => setDetailTarget(null)}
                        onEdit={(r) => { setDetailTarget(null); setEditModalTarget(r); }}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {createModalOpen && (
                    <BreakFormModal
                        onClose={() => setCreateModalOpen(false)}
                        onSubmit={handleCreate}
                        saving={saving}
                        isEdit={false}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {editModalTarget && (
                    <BreakFormModal
                        record={editModalTarget}
                        onClose={() => setEditModalTarget(null)}
                        onSubmit={handleEdit}
                        saving={saving}
                        isEdit={true}
                    />
                )}
            </AnimatePresence>
        </ManagementHub>
    );
};

export default BreakManagementPage;