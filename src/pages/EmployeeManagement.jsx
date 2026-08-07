import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBriefcase, FaCalendarAlt, FaCamera, FaCheck, FaClock, FaCog,
    FaEdit, FaEnvelope, FaEye, FaFingerprint,
    FaHandPaper, FaIdCard, FaMapMarkerAlt, FaNetworkWired, FaPhone,
    FaPlus, FaRobot, FaSave, FaSearch, FaShieldAlt, FaSpinner, FaListAlt,
    FaTimes, FaTrash, FaUser, FaUserCheck, FaUserCircle, FaUserCog,
    FaUserTag, FaUserTie, FaChevronDown, FaInfoCircle, FaChevronRight
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import Select from '../components/SelectField';
import { toast } from 'react-toastify';
import apiCall from '../utils/api';
import countryCodes from '../utils/countryCodes.json';
import SkeletonComponent from '../components/SkeletonComponent';
import Pagination, { usePagination } from '../components/PaginationComponent';
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import usePermissionAccess from '../hooks/usePermissionAccess';
import TimeDurationPickerField from '../components/TimeDurationPicker';
import Modal from '../components/Modal';
import AdvancedDateFilter from '../components/AdvancedDateFilter';
import { CountryCodeModal, getFlagEmoji, ManagementHub, ManagementTable, RefreshButton, ManagementCard } from '../components/common';
import ProfileAvatar from '../components/common/ProfileAvatar';
import useEmployeeNavigation from '../hooks/useEmployeeNavigation';
import CurrencyIcon from "../components/common/CurrencyIcon";
import { useAuth } from '../context/AuthContext'; // ← new import

// ─── Constants ────────────────────────────────────────────────────────────────

const customSelectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: '48px',
        backgroundColor: '#f9fafb',
        fontSize: '0.875rem',
        borderColor: state.isFocused ? '#6366f1' : '#e2e8f0',
        boxShadow: state.isFocused ? '0 0 0 4px rgba(99,102,241,0.10)' : 'none',
        '&:hover': { borderColor: '#cbd5e1' },
        borderRadius: '0.75rem',
        padding: '0 0.5rem',
    }),
    valueContainer: (base) => ({ ...base, padding: '0 14px', fontSize: '0.875rem' }),
    input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: '0.875rem' }),
    placeholder: (base) => ({ ...base, color: '#94a3b8', fontWeight: 500, fontSize: '0.875rem' }),
    singleValue: (base) => ({ ...base, color: '#334155', fontWeight: 500, fontSize: '0.875rem' }),
    option: (base, state) => ({
        ...base,
        fontSize: '0.875rem',
        backgroundColor: state.isSelected ? '#6366f1' : state.isFocused ? '#f1f5f9' : 'white',
        color: state.isSelected ? 'white' : '#1e293b',
        '&:active': { backgroundColor: '#6366f1' },
    }),
};

const MODAL_TYPES = { NONE: 'NONE', CREATE: 'CREATE', EDIT: 'EDIT', VIEW: 'VIEW', DELETE_CONFIRM: 'DELETE_CONFIRM' };

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DEFAULT_SHIFT_START = '09:00:00';
const DEFAULT_SHIFT_END = '18:00:00';
const DEFAULT_DURATION = '00:30';

const getDefaultCreateFormData = () => {
    const today = new Date();
    const joining_date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const effective_from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    return {
        signup_type: 'email',
        email: '',
        country_code: '91',
        phone: '',
        otp: '',
        name: '',
        platform: 'web',
        permission_package_id: null,
        selectedPackage: null,
        designation: '',
        salary_type: '',
        employment_type: '',
        weekends: [],
        shift_start: '',
        shift_end: '',
        break_minutes: '',
        grace_minutes: '',
        joining_date,
        base_amount: '',
        effective_from,
        effective_to: '',
        component_package_id: '',
        components: [],
    };
};

const EMPLOYEE_REQUEST_CACHE_TTL = 5000;
let constantsRequestCache = { companyId: null, promise: null, data: null };
let permissionPackagesRequestCache = { companyId: null, promise: null, data: null };
let onboardingPackagesRequestCache = { companyId: null, promise: null, data: null };
const employeeListRequestCache = new Map();

const EMPLOYEE_STATUS_FILTER_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
];

const getEmployeeListCacheKey = ({ companyId, page, limit, search, status }) =>
    `${companyId ?? 'none'}|${page}|${limit}|${search ?? ''}|${status ?? ''}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeDuration = (value, fallback = null) => {
    if (value === null || typeof value === 'undefined' || value === '') return fallback;
    if (typeof value === 'number') {
        const h = Math.floor(value / 60);
        const m = value % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (typeof value !== 'string') return fallback;
    const [hours = '00', minutes = '00'] = value.split(':');
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatDurationDisplay = (value) => normalizeDuration(value, 'N/A');

const normalizeEmployeeRecord = (employee) => ({
    ...employee,
    profile_picture: employee?.profile_picture ?? employee?.user?.profile_picture ?? null,
    permission_package_id: employee?.permission_package_id ?? employee?.package?.id ?? employee?.package_id ?? null,
    break_minutes: normalizeDuration(employee?.break_minutes, DEFAULT_DURATION),
    grace_minutes: normalizeDuration(employee?.grace_minutes, DEFAULT_DURATION),
});

const getIconForType = (key) => {
    const map = {
        MANUAL: FaHandPaper, GPS: FaMapMarkerAlt, FACE: FaCamera,
        QR: FaIdCard, FINGERPRINT: FaFingerprint, IP: FaNetworkWired,
    };
    return map[key] || FaUserCheck;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const InfoItem = ({ icon, label, value }) => (
    <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100 hover:bg-white hover:shadow-sm transition-all group">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-0.5 group-hover:text-indigo-500 transition-colors">
            {icon}{label}
        </label>
        <div className="text-slate-700 text-sm font-semibold truncate">{value}</div>
    </div>
);

const StatusBadge = ({ status, getStatusClassName, getStatusDisplay }) => (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusClassName(status)}`}>
        {getStatusDisplay(status)}
    </span>
);

// ─── Collapsible Section Wrapper (now accepts className) ──────────────────────
const CollapsibleSection = ({ title, icon, children, defaultOpen = true, className = '' }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className={`rounded-xl border bg-white overflow-hidden transition-colors ${className}`}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
            >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    {icon}
                    {title}
                </span>
                <motion.div
                    animate={{ rotate: open ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                >
                    <FaChevronRight size={10} />
                </motion.div>
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 space-y-4">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Edit Modal ───────────────────────────────────────────────────────────────

const EmployeeEditModal = ({
    isOpen, selectedEmployee, formData, setFormData, constants, permissionPackages,
    designationOptions, employmentTypeOptions, salaryTypeOptions,
    attendanceMethods,
    attendanceMethodsConfig, handleToggleMethod, handleEdit, closeModal,
    loading, constantsLoading, permissionsLoading, updateDisabled, submitTitle,
}) => {
    const [isWeekendsOpen, setIsWeekendsOpen] = useState(false);

    const formatDisplay = (value) => {
        if (typeof value === 'object' && value !== null) return value.label || 'N/A';
        return value ? String(value).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'N/A';
    };

    const toggleWeekend = (day) => {
        setFormData(prev => {
            const current = Array.isArray(prev.weekends) ? prev.weekends : [];
            return {
                ...prev,
                weekends: current.includes(day) ? current.filter(d => d !== day) : [...current, day],
            };
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={closeModal}
            title="Edit Employee"
            subtitle="Update configuration and accessibility"
            icon={<FaUserCog className="h-6 w-6" />}
            size="4xl"
            footer={
                <>
                    <button type="button" onClick={closeModal} disabled={loading}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50">
                        Cancel
                    </button>
                    <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        disabled={loading || constantsLoading || permissionsLoading || updateDisabled}
                        title={updateDisabled ? submitTitle : ''}
                        onClick={handleEdit}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 transition hover:scale-[1.02] disabled:opacity-50">
                        {loading ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaSave className="h-4 w-4" />}
                        Update Employee
                    </motion.button>
                </>
            }
        >
            {(constantsLoading || permissionsLoading) ? (
                <div className="flex items-center justify-center py-16">
                    <FaSpinner className="h-8 w-8 animate-spin text-indigo-500" />
                    <span className="ml-3 text-sm font-medium text-slate-500">Loading data...</span>
                </div>
            ) : (
                <div className="space-y-6 p-2 lg:p-0">
                    {/* Employee Preview */}
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-lg font-bold text-emerald-700 border border-emerald-200">
                                {formData.name?.charAt(0)?.toUpperCase() || 'E'}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                                <p className="font-semibold text-slate-900">{formData.name || 'Employee'}</p>
                                <p className="text-sm text-slate-600">{formData.email || 'No email'}</p>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                                        Code: {formData.employee_code || 'N/A'}
                                    </span>
                                    {selectedEmployee?.status && (
                                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                                            Status: {formatDisplay(selectedEmployee.status)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Selects */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <FaUserTie className="h-4 w-4 text-indigo-500" />Designation
                            </label>
                            <Select options={designationOptions}
                                value={designationOptions.find(o => o.value === formData.designation) || null}
                                onChange={(o) => setFormData(p => ({ ...p, designation: o?.value || '' }))}
                                placeholder="Select designation" isClearable styles={customSelectStyles} />
                        </div>
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <FaShieldAlt className="h-4 w-4 text-indigo-500" />Permission Package
                            </label>
                            <Select options={permissionPackages}
                                value={formData.selectedPackage || null}
                                onChange={(o) => setFormData(p => ({ ...p, selectedPackage: o, permission_package_id: o?.value || null }))}
                                placeholder="Select permission package" isClearable styles={customSelectStyles} />
                        </div>
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <FaBriefcase className="h-4 w-4 text-indigo-500" />Employment Type
                            </label>
                            <Select options={employmentTypeOptions}
                                value={employmentTypeOptions.find(o => o.value === formData.employment_type) || null}
                                onChange={(o) => setFormData(p => ({ ...p, employment_type: o?.value || '' }))}
                                placeholder="Select employment type" isClearable styles={customSelectStyles} />
                        </div>
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <CurrencyIcon className="text-emerald-500" size={12} />Salary Type
                            </label>
                            <Select options={salaryTypeOptions}
                                value={salaryTypeOptions.find(o => o.value === formData.salary_type) || null}
                                onChange={(o) => setFormData(p => ({ ...p, salary_type: o?.value || '' }))}
                                placeholder="Select salary type" isClearable styles={customSelectStyles} />
                        </div>
                    </div>

                    {/* Attendance Methods */}
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <FaFingerprint className="h-4 w-4 text-indigo-500" />Attendance Methods
                            </label>
                            {attendanceMethods.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {attendanceMethods.map((method) => {
                                        const active = attendanceMethodsConfig[method.id]?.enabled || false;
                                        return (
                                            <button key={method.id} type="button"
                                                onClick={() => method.available && handleToggleMethod(method.id)}
                                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${active
                                                    ? 'border-indigo-300 bg-indigo-600 text-white shadow-sm'
                                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50'
                                                    } ${!method.available ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                {active && <FaCheck className="h-3 w-3" />}
                                                {method.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                    No attendance methods available.
                                </div>
                            )}
                        </div>

                        {/* Auto Approve */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <FaCheck className="h-4 w-4 text-indigo-500" />Auto Approve Attendance
                                </label>
                                <button type="button"
                                    onClick={() => setFormData(p => ({ ...p, auto_approve: !p.auto_approve }))}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.auto_approve ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.auto_approve ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Timings & Weekends */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <FaClock className="h-4 w-4 text-indigo-500" />Shift Timings
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <TimeDurationPickerField label="Start Time" value={formData.shift_start}
                                    onChange={(v) => setFormData(p => ({ ...p, shift_start: v }))} mode="time" />
                                <TimeDurationPickerField label="End Time" value={formData.shift_end}
                                    onChange={(v) => setFormData(p => ({ ...p, shift_end: v }))} mode="time" />
                            </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <FaClock className="h-4 w-4 text-indigo-500" />Duration Settings
                            </label>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <TimeDurationPickerField label="Break Minutes" value={formData.break_minutes}
                                    onChange={(v) => setFormData(p => ({ ...p, break_minutes: v }))} mode="duration" />
                                <TimeDurationPickerField label="Grace Minutes" value={formData.grace_minutes}
                                    onChange={(v) => setFormData(p => ({ ...p, grace_minutes: v }))} mode="duration" />
                            </div>
                        </div>

                        {/* Weekends */}
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <button type="button" onClick={() => setIsWeekendsOpen(!isWeekendsOpen)}
                                className="flex w-full items-center justify-between">
                                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                                    <FaCalendarAlt className="h-4 w-4 text-indigo-500" />
                                    Weekends
                                    {formData.weekends?.length > 0 && (
                                        <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                                            {formData.weekends.length} Selected
                                        </span>
                                    )}
                                </label>
                                <FaChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isWeekendsOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <AnimatePresence>
                                {isWeekendsOpen && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                        <div className="flex flex-col gap-2 pt-4">
                                            {DAYS_OF_WEEK.map(day => {
                                                const selected = (formData.weekends || []).includes(day);
                                                return (
                                                    <button key={day} type="button" onClick={() => toggleWeekend(day)}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${selected
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50'}`}>
                                                        <div className={`w-3.5 h-3.5 rounded-md flex items-center justify-center border ${selected ? 'bg-white border-white' : 'bg-slate-100 border-slate-200'}`}>
                                                            {selected && <FaCheck className="w-2.5 h-2.5 text-indigo-600" />}
                                                        </div>
                                                        {day.charAt(0).toUpperCase() + day.slice(1)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Additional Settings – Joining Date, Overtime, Deduction */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <FaCog className="h-4 w-4 text-indigo-500" />Additional Settings
                        </label>
                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Joining Date */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Joining Date</label>
                                <AdvancedDateFilter
                                    value={formData.joining_date ? { date: formData.joining_date } : null}
                                    onChange={(val) => setFormData(p => ({ ...p, joining_date: val?.date || '' }))}
                                    tabOptions={['date']}
                                    placeholder="Select joining date"
                                    buttonClassName="w-full min-h-[48px] rounded-xl border border-slate-200 bg-[#f9fafb] px-4 py-3 text-sm outline-none transition hover:border-slate-300 focus:border-indigo-500"
                                />
                            </div>
                            {/* Overtime Toggle */}
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <label className="text-sm font-semibold text-slate-700">Enable Overtime</label>
                                <button
                                    type="button"
                                    onClick={() => setFormData(p => ({ ...p, enable_overtime: !p.enable_overtime }))}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.enable_overtime ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.enable_overtime ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            {/* Deduction Toggle */}
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <label className="text-sm font-semibold text-slate-700">Enable Deduction</label>
                                <button
                                    type="button"
                                    onClick={() => setFormData(p => ({ ...p, enable_deduction: !p.enable_deduction }))}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.enable_deduction ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.enable_deduction ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

// ─── Create Employee Modal (with resend timer) ──────────────
const ManualCreateEmployeeModal = ({
    isOpen, formData, setFormData, constantsLoading, permissionsLoading, otpLoading, createLoading,
    permissionPackages, designationOptions, employmentTypeOptions, salaryTypeOptions,
    onboardingPackages, onboardingPackagesLoading, otpRequested, setOtpRequested,
    handleRequestCreateOtp, handleCreateEmployee, loadOnboardingPackages, closeModal,
    salaryPackages, salaryPackagesLoading, availableComponents, availableComponentsLoading,
    showOverrideForm, setShowOverrideForm, overrideForm, setOverrideForm,
    loadSalaryPackages, loadSalaryComponents
}) => {
    const [isWeekendsOpen, setIsWeekendsOpen] = useState(false);
    const [isCountryCodeOpen, setIsCountryCodeOpen] = useState(false);
    const [selectedOnboardingPackage, setSelectedOnboardingPackage] = useState(null);
    const [resendTimer, setResendTimer] = useState(0);
    const isEmailSignup = formData.signup_type === 'email';
    const selectedCountry = countryCodes.find(c => c.dial_code === formData.country_code);
    const contactDisplay = isEmailSignup ? formData.email : `+${formData.country_code}${formData.phone}`;

    // Countdown effect
    useEffect(() => {
        if (resendTimer <= 0) return;
        const interval = setInterval(() => {
            setResendTimer(prev => {
                if (prev <= 1) return 0;
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [resendTimer]);

    useEffect(() => {
        if (isOpen) {
            setResendTimer(0);
        }
    }, [isOpen]);

    const isContactValid = isEmailSignup
        ? formData.email?.trim()?.length > 0
        : formData.country_code && formData.phone?.trim()?.length >= 8;

    // Section error states
    const contactSectionError = !otpRequested
        ? !isContactValid
        : (!isContactValid || !formData.otp?.trim());

    const employeeDetailsError = !formData.name?.trim()
        || !formData.designation
        || !formData.permission_package_id
        || !formData.employment_type
        || !formData.salary_type;

    const workScheduleError = !formData.shift_start || !formData.shift_end;

    const salaryDetailsError = !formData.effective_from || !formData.base_amount;

    const isFormValid = Boolean(
        formData.signup_type &&
        isContactValid &&
        formData.name?.trim() &&
        formData.otp?.trim() &&
        formData.permission_package_id &&
        formData.designation &&
        formData.salary_type &&
        formData.employment_type &&
        formData.shift_start &&
        formData.shift_end &&
        formData.base_amount &&
        formData.effective_from
    );

    const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-indigo-500/10";

    useEffect(() => {
        if (isOpen) {
            setSelectedOnboardingPackage(null);
            if (!availableComponents.length && !availableComponentsLoading) {
                loadSalaryComponents();
            }
        }
    }, [isOpen, availableComponents.length, availableComponentsLoading, loadSalaryComponents]);

    const toggleWeekend = (day) => {
        setFormData(prev => {
            const current = Array.isArray(prev.weekends) ? prev.weekends : [];
            return {
                ...prev,
                weekends: current.includes(day) ? current.filter(d => d !== day) : [...current, day],
            };
        });
    };

    const handleOnboardingPackageSelect = (pkg) => {
        setSelectedOnboardingPackage(pkg);
        if (!pkg) return;

        const getOptionValue = (value) => (typeof value === 'object' && value !== null ? value.value : value);
        const designationValue = getOptionValue(pkg.designation);
        const employmentTypeValue = getOptionValue(pkg.employment_type);
        const salaryTypeValue = getOptionValue(pkg.salary_type);
        const selectedPackage = permissionPackages.find(p => p.value === pkg.permission_package_id)
            || (pkg.permission_package_id ? {
                value: pkg.permission_package_id,
                label: pkg.permission_package_name || `Package #${pkg.permission_package_id}`,
            } : null);
        const normalizedWeekends = Array.isArray(pkg.weekends)
            ? pkg.weekends.map(w => (typeof w === 'object' ? w.day : w)).filter(Boolean)
            : [];

        const salaryComponentsFromPkg = pkg.salary_components || pkg.components || [];

        setFormData(prev => {
            const newComponents = salaryComponentsFromPkg.map(comp => ({
                component_id: comp.component_id,
                calc_type: comp.calc_type || 'percentage',
                calc_value: comp.calc_value === null || typeof comp.calc_value === 'undefined' ? '' : String(comp.calc_value),
                effective_from: prev.effective_from || '',
                effective_to: '',
                reason: ''
            })).filter(c => c.component_id);

            return {
                ...prev,
                designation: designationValue || prev.designation,
                employment_type: employmentTypeValue || prev.employment_type,
                salary_type: salaryTypeValue || prev.salary_type,
                permission_package_id: pkg.permission_package_id || prev.permission_package_id,
                selectedPackage: selectedPackage || prev.selectedPackage,
                shift_start: pkg.shift_start || prev.shift_start,
                shift_end: pkg.shift_end || prev.shift_end,
                break_minutes: typeof pkg.break_minutes !== 'undefined'
                    ? normalizeDuration(pkg.break_minutes, prev.break_minutes || '')
                    : prev.break_minutes,
                grace_minutes: typeof pkg.grace_minutes !== 'undefined'
                    ? normalizeDuration(pkg.grace_minutes, prev.grace_minutes || '')
                    : prev.grace_minutes,
                weekends: normalizedWeekends.length ? normalizedWeekends : prev.weekends,
                base_amount: typeof pkg.base_amount !== 'undefined' ? String(pkg.base_amount || '') : prev.base_amount,
                components: newComponents.length ? newComponents : prev.components,
                component_package_id: pkg.component_package || prev.component_package_id
            };
        });

        if (normalizedWeekends.length) setIsWeekendsOpen(true);
        toast.info(`Applied details from ${pkg.name || pkg.label}`);
    };

    const handleOnboardingPackageMenuOpen = () => {
        if (!onboardingPackages.length && !onboardingPackagesLoading) {
            loadOnboardingPackages();
        }
    };

    const handleSalaryPackageMenuOpen = () => {
        if (!salaryPackages.length && !salaryPackagesLoading) {
            loadSalaryPackages();
        }
    };

    const handlePackageChange = (packageId) => {
        const pkg = salaryPackages.find(p => String(p.id) === String(packageId));
        if (!pkg) return;

        const packageComponents = (pkg.items || []).map(item => ({
            component_id: item.component_id,
            calc_type: item.calc_type || 'percentage',
            calc_value: item.calc_value || '',
            effective_from: formData.effective_from || '',
            effective_to: '',
            reason: `From ${pkg.name}`
        }));

        setFormData(prev => ({
            ...prev,
            component_package_id: packageId,
            components: packageComponents
        }));
    };

    const existingComponentIds = useMemo(() =>
        formData.components.map(comp => comp.component_id),
        [formData.components]
    );

    const filteredAvailableComponents = useMemo(() =>
        availableComponents.filter(comp => !existingComponentIds.includes(comp.id)),
        [availableComponents, existingComponentIds]
    );

    const createDisabledReason = !isContactValid
        ? (isEmailSignup ? 'Enter a valid email address' : 'Enter a valid phone number')
        : !formData.name?.trim()
            ? 'Enter employee name'
            : !formData.otp?.trim()
                ? 'Enter the OTP received'
                : !formData.designation
                    ? 'Select a designation'
                    : !formData.permission_package_id
                        ? 'Select a permission package'
                        : !formData.employment_type
                            ? 'Select an employment type'
                            : !formData.salary_type
                                ? 'Select a salary type'
                                : !formData.shift_start
                                    ? 'Set shift start time'
                                    : !formData.shift_end
                                        ? 'Set shift end time'
                                        : !formData.effective_from
                                            ? 'Select salary effective from date'
                                            : !formData.base_amount
                                                ? 'Enter base salary amount'
                                                : '';

    // OTP resend handler
    const handleResendOtp = async () => {
        if (!isContactValid) {
            toast.warning(isEmailSignup ? 'Enter a valid email address' : 'Enter a valid phone number');
            return;
        }
        if (resendTimer > 0) return;
        const result = await handleRequestCreateOtp();
        if (result.success) {
            setResendTimer(30);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={closeModal}
            title="Create Employee"
            subtitle="Verify contact with OTP and add employee details"
            icon={<FaUserCheck className="h-6 w-6" />}
            size="4xl"
            footer={
                <>
                    <button type="button" onClick={closeModal} disabled={otpLoading || createLoading}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50">
                        Cancel
                    </button>
                    <button type="button" onClick={handleResendOtp}
                        disabled={otpLoading || createLoading || constantsLoading || permissionsLoading || resendTimer > 0}
                        className={`inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-5 py-2.5 text-sm font-semibold transition hover:bg-indigo-50 disabled:opacity-50 ${resendTimer > 0 ? 'text-slate-400' : 'text-indigo-600'
                            }`}>
                        {otpLoading ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaEnvelope className="h-4 w-4" />}
                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : (otpRequested ? 'Resend OTP' : 'Send OTP')}
                    </button>
                    {otpRequested && (
                        <span title={!isFormValid ? createDisabledReason : undefined} className="inline-flex">
                            <motion.button type="submit"
                                whileHover={{ scale: isFormValid ? 1.02 : 1 }}
                                whileTap={{ scale: isFormValid ? 0.98 : 1 }}
                                disabled={otpLoading || createLoading || constantsLoading || permissionsLoading || !isFormValid}
                                onClick={handleCreateEmployee}
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 transition disabled:cursor-not-allowed disabled:opacity-50">
                                {createLoading ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaPlus className="h-4 w-4" />}
                                Create Employee
                            </motion.button>
                        </span>
                    )}
                </>
            }
        >
            {(constantsLoading || permissionsLoading) ? (
                <div className="flex items-center justify-center py-16">
                    <FaSpinner className="h-8 w-8 animate-spin text-indigo-500" />
                    <span className="ml-3 text-sm font-medium text-slate-500">Loading form data...</span>
                </div>
            ) : (
                <div className="space-y-6 p-2 lg:p-0">
                    {/* Contact Verification Section */}
                    <CollapsibleSection
                        title="Contact Verification"
                        icon={<FaEnvelope className="text-indigo-500" />}
                        className={contactSectionError ? 'border-red-400 ring-1 ring-red-400/50' : 'border-slate-200'}
                    >
                        {otpRequested ? (
                            <div className="space-y-4">
                                <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 break-words">
                                                OTP sent to {contactDisplay}
                                            </p>
                                            <p className="mt-1 text-xs font-medium text-slate-500">
                                                Enter the verification code received on this {isEmailSignup ? 'email address' : 'phone number'} to continue.
                                            </p>
                                        </div>
                                        <button type="button"
                                            onClick={() => {
                                                setFormData(p => ({ ...p, otp: '' }));
                                                setOtpRequested(false);
                                            }}
                                            className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-indigo-600">
                                            Change
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">OTP</label>
                                    <input type="text" inputMode="numeric" value={formData.otp}
                                        onChange={e => setFormData(p => ({ ...p, otp: e.target.value }))}
                                        placeholder="Enter OTP"
                                        className={inputClass} />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Signup Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['email', 'phone'].map(type => (
                                            <button key={type} type="button"
                                                onClick={() => {
                                                    setFormData(p => ({ ...p, signup_type: type, otp: '' }));
                                                    setOtpRequested(false);
                                                }}
                                                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize transition ${formData.signup_type === type
                                                    ? 'border-indigo-500 bg-indigo-600 text-white'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-indigo-50'}`}>
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        {isEmailSignup ? <FaEnvelope className="text-indigo-500" /> : <FaPhone className="text-indigo-500" />}
                                        {isEmailSignup ? 'Email' : 'Phone'}
                                    </label>
                                    {isEmailSignup ? (
                                        <input type="email"
                                            value={formData.email}
                                            onChange={e => {
                                                setFormData(p => ({ ...p, email: e.target.value, otp: '' }));
                                                setOtpRequested(false);
                                            }}
                                            placeholder="employee@example.com"
                                            className={inputClass} />
                                    ) : (
                                        <div className="flex gap-2">
                                            <button type="button"
                                                onClick={() => setIsCountryCodeOpen(true)}
                                                className="flex min-h-[46px] shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                                                <span>{getFlagEmoji(selectedCountry?.code || 'IN')}</span>
                                                <span>+{formData.country_code}</span>
                                                <FaChevronDown className="h-3 w-3 text-slate-400" />
                                            </button>
                                            <input type="tel"
                                                value={formData.phone}
                                                onChange={e => {
                                                    setFormData(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 15), otp: '' }));
                                                    setOtpRequested(false);
                                                }}
                                                placeholder="9876543210"
                                                inputMode="numeric"
                                                className={inputClass} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </CollapsibleSection>

                    {/* Onboarding Package (outside collapsible) */}
                    {otpRequested && (
                        <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <FaListAlt className="h-4 w-4 text-indigo-500" />
                                Onboarding Package
                            </label>
                            <Select
                                options={onboardingPackages}
                                value={selectedOnboardingPackage}
                                onChange={handleOnboardingPackageSelect}
                                onMenuOpen={handleOnboardingPackageMenuOpen}
                                onFocus={handleOnboardingPackageMenuOpen}
                                placeholder={onboardingPackagesLoading ? 'Loading packages...' : 'Optional: Select a package to auto-fill'}
                                isClearable
                                isLoading={onboardingPackagesLoading}
                                styles={customSelectStyles}
                            />
                        </div>
                    )}

                    {otpRequested && (
                        <>
                            {/* Employee Details Section */}
                            <CollapsibleSection
                                title="Employee Details"
                                icon={<FaUser className="text-indigo-500" />}
                                className={employeeDetailsError ? 'border-red-400 ring-1 ring-red-400/50' : 'border-slate-200'}
                            >
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FaUser className="text-indigo-500" />Employee Name</label>
                                    <input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                        placeholder="Employee name"
                                        className={inputClass} required />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2 mt-4">
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FaUserTie className="text-indigo-500" />Designation</label>
                                        <Select options={designationOptions}
                                            value={designationOptions.find(o => o.value === formData.designation) || null}
                                            onChange={(o) => setFormData(p => ({ ...p, designation: o?.value || '' }))}
                                            placeholder="Select designation" isClearable styles={customSelectStyles} />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FaShieldAlt className="text-indigo-500" />Permission Package</label>
                                        <Select options={permissionPackages}
                                            value={formData.selectedPackage || null}
                                            onChange={(o) => setFormData(p => ({ ...p, selectedPackage: o, permission_package_id: o?.value || null }))}
                                            placeholder="Select permission package" isClearable styles={customSelectStyles} />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FaBriefcase className="text-indigo-500" />Employment Type</label>
                                        <Select options={employmentTypeOptions}
                                            value={employmentTypeOptions.find(o => o.value === formData.employment_type) || null}
                                            onChange={(o) => setFormData(p => ({ ...p, employment_type: o?.value || '' }))}
                                            placeholder="Select employment type" isClearable styles={customSelectStyles} />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><CurrencyIcon className="text-emerald-500" size={12} />Salary Type</label>
                                        <Select options={salaryTypeOptions}
                                            value={salaryTypeOptions.find(o => o.value === formData.salary_type) || null}
                                            onChange={(o) => setFormData(p => ({ ...p, salary_type: o?.value || '' }))}
                                            placeholder="Select salary type" isClearable styles={customSelectStyles} />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FaCalendarAlt className="text-indigo-500" />Joining Date</label>
                                        <AdvancedDateFilter
                                            value={{ date: formData.joining_date }}
                                            onChange={(val) => setFormData(p => ({ ...p, joining_date: val.date }))}
                                            tabOptions={['date']}
                                            placeholder="Select joining date"
                                            buttonClassName="w-full min-h-[48px] rounded-xl border border-slate-200 bg-[#f9fafb] px-4 py-3 text-sm outline-none transition hover:border-slate-300 focus:border-indigo-500"
                                        />
                                    </div>
                                </div>
                            </CollapsibleSection>

                            {/* Work Schedule Section */}
                            <CollapsibleSection
                                title="Work Schedule"
                                icon={<FaClock className="text-indigo-500" />}
                                className={workScheduleError ? 'border-red-400 ring-1 ring-red-400/50' : 'border-slate-200'}
                            >
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                                        <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                            <FaClock className="h-4 w-4 text-indigo-500" />
                                            Shift Timings
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <TimeDurationPickerField label="Start Time" value={formData.shift_start}
                                                onChange={(v) => setFormData(p => ({ ...p, shift_start: v }))} mode="time" />
                                            <TimeDurationPickerField label="End Time" value={formData.shift_end}
                                                onChange={(v) => setFormData(p => ({ ...p, shift_end: v }))} mode="time" />
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                                        <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                            <FaClock className="h-4 w-4 text-indigo-500" />
                                            Duration Settings
                                        </label>
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            <TimeDurationPickerField label="Break Minutes" value={formData.break_minutes}
                                                onChange={(v) => setFormData(p => ({ ...p, break_minutes: v }))} mode="duration" />
                                            <TimeDurationPickerField label="Grace Minutes" value={formData.grace_minutes}
                                                onChange={(v) => setFormData(p => ({ ...p, grace_minutes: v }))} mode="duration" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white p-4 mt-4">
                                    <button type="button" onClick={() => setIsWeekendsOpen(!isWeekendsOpen)}
                                        className="flex w-full items-center justify-between">
                                        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                                            <FaCalendarAlt className="h-4 w-4 text-indigo-500" />
                                            Weekends
                                            {formData.weekends?.length > 0 && (
                                                <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                                                    {formData.weekends.length} Selected
                                                </span>
                                            )}
                                        </label>
                                        <FaChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isWeekendsOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    <AnimatePresence>
                                        {isWeekendsOpen && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:flex-wrap">
                                                    {DAYS_OF_WEEK.map(day => {
                                                        const selected = (formData.weekends || []).includes(day);
                                                        return (
                                                            <button key={day} type="button" onClick={() => toggleWeekend(day)}
                                                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${selected
                                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                                                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50'}`}>
                                                                <div className={`w-3.5 h-3.5 rounded-md flex items-center justify-center border ${selected ? 'bg-white border-white' : 'bg-slate-100 border-slate-200'}`}>
                                                                    {selected && <FaCheck className="w-2.5 h-2.5 text-indigo-600" />}
                                                                </div>
                                                                {day.charAt(0).toUpperCase() + day.slice(1)}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </CollapsibleSection>

                            {/* Salary Details Section */}
                            <CollapsibleSection
                                title="Salary Details"
                                icon={<CurrencyIcon className="text-emerald-500" size={16} />}
                                defaultOpen={false}
                                className={salaryDetailsError ? 'border-red-400 ring-1 ring-red-400/50' : 'border-slate-200'}
                            >
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Effective From *</label>
                                            <AdvancedDateFilter tabOptions={["month"]} value={formData.effective_from ? { month: parseInt(formData.effective_from.split('-')[1]), year: parseInt(formData.effective_from.split('-')[0]) } : null} onChange={(val) => { if (val && val.month && val.year) { const firstDate = `${val.year}-${String(val.month).padStart(2, '0')}-01`; setFormData(p => ({ ...p, effective_from: firstDate })); } else { setFormData(p => ({ ...p, effective_from: '' })); } }} placeholder="Select month" buttonClassName="w-full px-4 py-2.5 border rounded-xl outline-none text-left text-sm border-slate-200 bg-white focus:border-indigo-500" required />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Effective To</label>
                                            <AdvancedDateFilter tabOptions={["month"]} value={formData.effective_to ? { month: parseInt(formData.effective_to.split('-')[1]), year: parseInt(formData.effective_to.split('-')[0]) } : null} onChange={(val) => { if (val && val.month && val.year) { const firstDate = `${val.year}-${String(val.month).padStart(2, '0')}-01`; setFormData(p => ({ ...p, effective_to: firstDate })); } else { setFormData(p => ({ ...p, effective_to: '' })); } }} placeholder="Optional" buttonClassName="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-left text-sm" required />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Salary Package (Quick Fill)</label>
                                            <Select
                                                value={formData.component_package_id ? { value: formData.component_package_id, label: salaryPackages.find(p => String(p.id) === String(formData.component_package_id))?.name ? `${salaryPackages.find(p => String(p.id) === String(formData.component_package_id)).name} (${salaryPackages.find(p => String(p.id) === String(formData.component_package_id)).code})` : 'Custom / Manual' } : null}
                                                onChange={(opt) => handlePackageChange(opt?.value || '')}
                                                onMenuOpen={handleSalaryPackageMenuOpen}
                                                onFocus={handleSalaryPackageMenuOpen}
                                                options={salaryPackages.map(pkg => ({ value: pkg.id, label: `${pkg.name} (${pkg.code})` }))}
                                                isLoading={salaryPackagesLoading}
                                                isClearable
                                                placeholder={salaryPackagesLoading ? 'Loading packages...' : 'Custom / Manual'}
                                                noOptionsMessage={() => 'No packages found'}
                                                menuPlacement="auto"
                                                menuPosition="fixed"
                                                menuPortalTarget={document.body}
                                                styles={{ ...customSelectStyles, menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Base Amount *</label>
                                            <input type="text" inputMode="decimal" placeholder="Enter amount" value={formData.base_amount}
                                                onChange={e => {
                                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                                    if (val === '' || /^\d*\.?\d*$/.test(val)) { setFormData(p => ({ ...p, base_amount: val })); }
                                                }}
                                                className={inputClass} required />
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-100 pt-5 mt-2">
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                                <FaListAlt className="text-indigo-500" /> Salary Components
                                            </label>
                                            <button type="button"
                                                onClick={() => { setOverrideForm({ component_id: '', calc_type: 'percentage', calc_value: '', effective_from: formData.effective_from, effective_to: '', reason: '' }); setShowOverrideForm(true); }}
                                                className="text-[10px] px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all font-bold border border-indigo-200 shadow-sm flex items-center gap-1.5 uppercase tracking-wider">
                                                <FaPlus size={8} /> Add Component
                                            </button>
                                        </div>

                                        {formData.components.length > 0 && (
                                            <div className="space-y-4 mb-3">
                                                {formData.components.map((comp, idx) => {
                                                    const componentData = availableComponents.find(c => c.id === comp.component_id);
                                                    return (
                                                        <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm relative group animate-in fade-in slide-in-from-top-1 duration-200">
                                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                                                <div className="md:col-span-4">
                                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between">Component</label>
                                                                    <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 truncate">
                                                                        {componentData?.name || `Component #${comp.component_id}`}
                                                                        <span className="ml-2 text-[10px] text-slate-400 font-mono">({componentData?.code || ''})</span>
                                                                    </div>
                                                                </div>
                                                                <div className="md:col-span-3">
                                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Type</label>
                                                                    <Select
                                                                        value={comp.calc_type ? { value: comp.calc_type, label: comp.calc_type === 'percentage' ? 'Percentage (%)' : 'Fixed Amount' } : null}
                                                                        onChange={(opt) => {
                                                                            const updated = [...formData.components];
                                                                            updated[idx].calc_type = opt?.value || 'percentage';
                                                                            setFormData(p => ({ ...p, components: updated, component_package_id: '' }));
                                                                        }}
                                                                        options={[
                                                                            { value: 'percentage', label: 'Percentage (%)' },
                                                                            { value: 'fixed', label: 'Fixed Amount' }
                                                                        ]}
                                                                        placeholder="Select type"
                                                                        menuPlacement="top"
                                                                        styles={customSelectStyles}
                                                                    />
                                                                </div>
                                                                <div className="md:col-span-3">
                                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Value</label>
                                                                    <input type="text" inputMode="decimal" value={comp.calc_value}
                                                                        onChange={e => {
                                                                            const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                                                const updated = [...formData.components];
                                                                                updated[idx].calc_value = val;
                                                                                setFormData(p => ({ ...p, components: updated, component_package_id: '' }));
                                                                            }
                                                                        }}
                                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                                                    />
                                                                </div>
                                                                <div className="md:col-span-2 flex justify-end gap-2 pb-0.5">
                                                                    <button type="button" onClick={() => {
                                                                        const updated = formData.components.filter((_, i) => i !== idx);
                                                                        setFormData(p => ({ ...p, components: updated, component_package_id: '' }));
                                                                    }} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Remove Component">
                                                                        <FaTimes size={14} />
                                                                    </button>
                                                                </div>
                                                                <div className="md:col-span-12">
                                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reason / Note</label>
                                                                    <input type="text" placeholder="Reason for this component value..." value={comp.reason || ''}
                                                                        onChange={e => {
                                                                            const updated = [...formData.components];
                                                                            updated[idx].reason = e.target.value;
                                                                            setFormData(p => ({ ...p, components: updated, component_package_id: '' }));
                                                                        }}
                                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all italic text-slate-500"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {showOverrideForm && (
                                            <div className="mt-4 p-4 bg-indigo-50/50 rounded-xl border-2 border-dashed border-indigo-200">
                                                <div className="flex items-center justify-between mb-3">
                                                    <p className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest">Select Component to Add</p>
                                                    <button type="button" onClick={() => setShowOverrideForm(false)} className="text-slate-400 hover:text-slate-600"><FaTimes size={12} /></button>
                                                </div>
                                                <div className="flex gap-3">
                                                    <div className="flex-1">
                                                        <Select
                                                            value={null}
                                                            onChange={(opt) => {
                                                                if (!opt) return;
                                                                const comp = filteredAvailableComponents.find(c => String(c.id) === String(opt.value));
                                                                if (comp) {
                                                                    const newComp = {
                                                                        component_id: comp.id,
                                                                        calc_type: comp.calc_type || 'percentage',
                                                                        calc_value: comp.calc_value || '',
                                                                        effective_from: formData.effective_from,
                                                                        effective_to: null,
                                                                        reason: ''
                                                                    };
                                                                    setFormData(p => ({
                                                                        ...p,
                                                                        components: [...p.components, newComp],
                                                                        component_package_id: ''
                                                                    }));
                                                                    setShowOverrideForm(false);
                                                                    setOverrideForm({ component_id: '', calc_type: 'percentage', calc_value: '', effective_from: '', effective_to: '', reason: '' });
                                                                }
                                                            }}
                                                            options={filteredAvailableComponents.map(comp => ({ value: comp.id, label: `${comp.name} (${comp.code})` }))}
                                                            placeholder="Choose a component..."
                                                            menuPlacement="top"
                                                            menuPosition="fixed"
                                                            menuPortalTarget={document.body}
                                                            styles={{ ...customSelectStyles, menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                                                        />
                                                    </div>
                                                </div>
                                                {filteredAvailableComponents.length === 0 && (
                                                    <p className="text-[10px] text-amber-600 mt-2 italic flex items-center gap-1">
                                                        <FaInfoCircle size={10} /> No more components available to add.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CollapsibleSection>
                        </>
                    )}
                </div>
            )}
            <CountryCodeModal
                isOpen={isCountryCodeOpen}
                onClose={() => setIsCountryCodeOpen(false)}
                onSelect={(code) => {
                    setFormData(p => ({ ...p, country_code: code, otp: '' }));
                    setOtpRequested(false);
                }}
                selectedCode={formData.country_code}
            />
        </Modal>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const EmployeeManagement = () => {
    const navigate = useNavigate();
    const navigateToEmployeeProfile = useEmployeeNavigation();
    const { checkActionAccess, getAccessMessage } = usePermissionAccess();
    const { attendanceMethods: companyAttendanceMethods, loading: authLoading } = useAuth(); // ← new

    const [employees, setEmployees] = useState([]);
    const [constants, setConstants] = useState({
        employment_types: [], salary_types: [], designations: [],
        employment_status: [],
    });
    const [permissionPackages, setPermissionPackages] = useState([]);
    const permissionPackagesRef = useRef([]);
    const [onboardingPackages, setOnboardingPackages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [permissionsLoading, setPermissionsLoading] = useState(false);
    const [onboardingPackagesLoading, setOnboardingPackagesLoading] = useState(false);
    const [constantsLoading, setConstantsLoading] = useState(false);
    const [modalType, setModalType] = useState(MODAL_TYPES.NONE);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [activeActionMenu, setActiveActionMenu] = useState(null);
    const [viewMode, setViewMode] = useState('table');
    const [showPermissions, setShowPermissions] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [employeeStatusFilter, setEmployeeStatusFilter] = useState('active');
    const [createFormData, setCreateFormData] = useState(getDefaultCreateFormData);
    const [createOtpRequested, setCreateOtpRequested] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);

    const [salaryPackages, setSalaryPackages] = useState([]);
    const [availableComponents, setAvailableComponents] = useState([]);
    const [salaryPackagesLoading, setSalaryPackagesLoading] = useState(false);
    const [availableComponentsLoading, setAvailableComponentsLoading] = useState(false);
    const [showOverrideForm, setShowOverrideForm] = useState(false);
    const [overrideForm, setOverrideForm] = useState({ component_id: '', calc_type: 'percentage', calc_value: '', effective_from: '', effective_to: '', reason: '' });

    const [formData, setFormData] = useState({
        name: '', designation: '', email: '', phone: '', employee_code: '',
        employment_type: '', salary_type: '', joining_date: '', status: '',
        permission_package_id: null, attendance_methods: [], auto_approve: false,
        shift_start: DEFAULT_SHIFT_START, shift_end: DEFAULT_SHIFT_END,
        break_minutes: DEFAULT_DURATION, grace_minutes: DEFAULT_DURATION, weekends: [],
        enable_overtime: false,
        enable_deduction: false,
    });

    const [attendanceMethodsConfig, setAttendanceMethodsConfig] = useState({});

    const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 20);

    const constantsFetched = useRef(false);
    const permissionsFetched = useRef(false);
    const isMounted = useRef(true);
    const fetchInProgress = useRef(false);
    const initialFetchDone = useRef(false);
    const isInitialLoad = useRef(true);

    const updateEmployeeAccess = checkActionAccess('employeeManagement', 'update');
    const deleteEmployeeAccess = checkActionAccess('employeeManagement', 'delete');
    const readEmployeeAccess = checkActionAccess('employeeManagement', 'read');
    const createEmployeeAccess = checkActionAccess('employeeManagement', 'create');

    // Memoised attendance method options from AuthContext
    const attendanceMethodOptions = useMemo(() => {
        if (!companyAttendanceMethods) return [];
        return companyAttendanceMethods.map(m => ({
            id: m.method.toLowerCase(),
            name: m.label || m.method,
            available: true, // all methods from auth are assumed available
        }));
    }, [companyAttendanceMethods]);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
        return () => clearTimeout(t);
    }, [searchTerm]);

    useEffect(() => {
        if (!isInitialLoad.current && debouncedSearchTerm !== undefined) {
            if (pagination.page !== 1) goToPage(1);
            else fetchEmployees(1);
        }
    }, [debouncedSearchTerm, employeeStatusFilter]);

    // Pre‑fetch on mount
    useEffect(() => {
        fetchConstants();
        fetchPermissionPackages();
    }, []);

    // ─── API Calls ────────────────────────────────────────────────────────────

    const fetchConstants = useCallback(async () => {
        if (constantsFetched.current) return;
        setConstantsLoading(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const companyId = company?.id ?? null;

            if (constantsRequestCache.companyId === companyId && constantsRequestCache.data) {
                setConstants(constantsRequestCache.data);
                constantsFetched.current = true;
                return;
            }
            if (constantsRequestCache.companyId !== companyId) {
                constantsRequestCache = { companyId, promise: null, data: null };
            }
            if (!constantsRequestCache.promise) {
                constantsRequestCache.promise = (async () => {
                    const response = await apiCall('/constants/', 'GET', null, companyId);
                    const result = await response.json();
                    if (!result.success) throw new Error(result.message || 'Failed to load constants');
                    const d = result.data;
                    const mapped = {
                        employment_types: d.employment_types?.map(i => ({ value: i.value.value, key: i.key, label: i.value.label, description: i.value.description })) || [],
                        salary_types: d.salary_types?.map(i => ({ value: i.value.value, key: i.key, label: i.value.label, description: i.value.description })) || [],
                        designations: d.designations?.map(i => ({ value: i.value.value, key: i.key, label: i.value.label, description: i.value.description })) || [],
                        employment_status: d.employment_status?.map(i => ({ value: i.value.value, key: i.key, label: i.value.label, description: i.value.description })) || [],
                        // attendance_methods removed – now from AuthContext
                    };
                    constantsRequestCache = { companyId, promise: null, data: mapped };
                    return mapped;
                })().catch(e => { constantsRequestCache = { companyId, promise: null, data: null }; throw e; });
            }
            const mapped = await constantsRequestCache.promise;
            setConstants(mapped);
            constantsFetched.current = true;
        } catch (e) {
            console.error(e);
            toast.error('Failed to load constants');
        } finally { setConstantsLoading(false); }
    }, []);

    const fetchPermissionPackages = useCallback(async () => {
        if (permissionsFetched.current) return permissionPackagesRef.current;
        setPermissionsLoading(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const companyId = company?.id ?? null;

            if (permissionPackagesRequestCache.companyId === companyId && permissionPackagesRequestCache.data) {
                setPermissionPackages(permissionPackagesRequestCache.data);
                permissionPackagesRef.current = permissionPackagesRequestCache.data;
                permissionsFetched.current = true;
                return permissionPackagesRequestCache.data;
            }
            if (permissionPackagesRequestCache.companyId !== companyId) {
                permissionPackagesRequestCache = { companyId, promise: null, data: null };
            }
            if (!permissionPackagesRequestCache.promise) {
                permissionPackagesRequestCache.promise = (async () => {
                    const response = await apiCall('/permissions/permission-packages', 'GET', null, companyId);
                    const result = await response.json();
                    if (!result.success) throw new Error(result.message || 'Failed to load permission packages');
                    const packages = (result.data?.packages || []).map(pkg => ({
                        value: pkg.id, label: pkg.package_name, description: pkg.description,
                        groupCode: pkg.group_code,
                        permissions: pkg.permissions?.filter(p => p.is_active === 1) || [],
                        isActive: pkg.is_active === 1,
                    }));
                    permissionPackagesRequestCache = { companyId, promise: null, data: packages };
                    return packages;
                })().catch(e => { permissionPackagesRequestCache = { companyId, promise: null, data: null }; throw e; });
            }
            const packages = await permissionPackagesRequestCache.promise;
            setPermissionPackages(packages);
            permissionPackagesRef.current = packages;
            permissionsFetched.current = true;
            return packages;
        } catch (e) {
            console.error(e);
            toast.error('Failed to load permission packages');
            return [];
        } finally { setPermissionsLoading(false); }
    }, []);

    const fetchOnboardingPackages = useCallback(async () => {
        setOnboardingPackagesLoading(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const companyId = company?.id ?? null;

            if (onboardingPackagesRequestCache.companyId === companyId && onboardingPackagesRequestCache.data) {
                setOnboardingPackages(onboardingPackagesRequestCache.data);
                return;
            }
            if (onboardingPackagesRequestCache.companyId !== companyId) {
                onboardingPackagesRequestCache = { companyId, promise: null, data: null };
            }
            if (!onboardingPackagesRequestCache.promise) {
                onboardingPackagesRequestCache.promise = (async () => {
                    const response = await apiCall('/company/invites/package-list', 'GET', null, companyId);
                    const result = await response.json();
                    if (!result.success) throw new Error(result.message || 'Failed to load onboarding packages');
                    const packages = (result.data || [])
                        .filter(pkg => pkg.is_active)
                        .map(pkg => ({
                            ...pkg,
                            value: pkg.id,
                            label: `${pkg.name} (${pkg.code})`,
                        }));
                    onboardingPackagesRequestCache = { companyId, promise: null, data: packages };
                    return packages;
                })().catch(e => { onboardingPackagesRequestCache = { companyId, promise: null, data: null }; throw e; });
            }
            const packages = await onboardingPackagesRequestCache.promise;
            setOnboardingPackages(packages);
        } catch (e) {
            console.error(e);
            toast.error(e.message || 'Failed to load onboarding packages');
        } finally {
            setOnboardingPackagesLoading(false);
        }
    }, []);

    const fetchSalaryPackages = useCallback(async () => {
        setSalaryPackagesLoading(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const response = await apiCall('/salary/components/packages', 'GET', null, company?.id);
            const result = await response.json();
            if (result.success) setSalaryPackages(result.data || []);
        } catch (error) { console.error('Failed to load packages:', error); } finally { setSalaryPackagesLoading(false); }
    }, []);

    const fetchSalaryComponents = useCallback(async () => {
        if (availableComponents.length > 0) return; // already loaded
        setAvailableComponentsLoading(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const response = await apiCall('/salary/components/list', 'GET', null, company?.id);
            const result = await response.json();
            if (result.success) setAvailableComponents(result.data || []);
        } catch (e) { console.error(e); } finally { setAvailableComponentsLoading(false); }
    }, [availableComponents.length]);

    const fetchEmployees = useCallback(async (page = pagination.page, resetLoading = true) => {
        if (fetchInProgress.current) return;
        fetchInProgress.current = true;
        if (resetLoading) setLoading(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const companyId = company?.id ?? null;
            const params = new URLSearchParams({ page: page.toString(), limit: pagination.limit.toString() });
            if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
            if (employeeStatusFilter) params.append('status', employeeStatusFilter);

            const requestKey = getEmployeeListCacheKey({ companyId, page, limit: pagination.limit, search: debouncedSearchTerm, status: employeeStatusFilter });
            const cachedEntry = employeeListRequestCache.get(requestKey);
            let result;

            if (cachedEntry?.data && cachedEntry.expiresAt > Date.now()) {
                result = cachedEntry.data;
            } else if (cachedEntry?.promise) {
                result = await cachedEntry.promise;
            } else {
                const requestPromise = (async () => {
                    const response = await apiCall(`/employees/list?${params}`, 'GET', null, companyId);
                    const json = await response.json();
                    if (!json.success) throw new Error(json.message || 'Failed to fetch employees');
                    employeeListRequestCache.set(requestKey, { data: json, expiresAt: Date.now() + EMPLOYEE_REQUEST_CACHE_TTL });
                    return json;
                })().catch(e => { employeeListRequestCache.delete(requestKey); throw e; });
                employeeListRequestCache.set(requestKey, { promise: requestPromise });
                result = await requestPromise;
            }

            if (result.success) {
                const normalizedEmployees = (result.data || []).map(normalizeEmployeeRecord);
                setEmployees(normalizedEmployees);
                const meta = result.pagination || result.meta || {};
                const totalPages = meta.total_pages || Math.max(1, Math.ceil((meta.total || normalizedEmployees.length || 0) / (meta.limit || pagination.limit)));
                updatePagination({
                    page: meta.page || page, limit: meta.limit || pagination.limit,
                    total: meta.total || normalizedEmployees.length || 0,
                    total_pages: totalPages,
                    is_last_page: meta.is_last_page ?? (meta.page || page) >= totalPages,
                });
            } else {
                throw new Error(result.message || 'Failed to fetch employees');
            }
        } catch (e) {
            toast.error(e.message || 'Failed to fetch employees');
        } finally {
            setLoading(false);
            fetchInProgress.current = false;
            isInitialLoad.current = false;
        }
    }, [pagination.page, pagination.limit, debouncedSearchTerm, employeeStatusFilter, updatePagination]);

    useEffect(() => {
        if (!initialFetchDone.current) { fetchEmployees(1, true); initialFetchDone.current = true; }
    }, [fetchEmployees]);

    useEffect(() => {
        if (!isInitialLoad.current && !fetchInProgress.current && initialFetchDone.current) {
            fetchEmployees(pagination.page, true);
        }
    }, [pagination.page, fetchEmployees]);

    const updateEmployee = async (id, employeeData) => {
        setLoading(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const enabledMethods = Object.entries(attendanceMethodsConfig)
                .filter(([, c]) => c?.enabled && c?.available !== false)
                .map(([methodId]) => methodId);
            const payload = {
                employee_id: id, designation: employeeData.designation,
                employment_type: employeeData.employment_type, salary_type: employeeData.salary_type,
                permission_package_id: employeeData.permission_package_id,
                attendance_methods: enabledMethods, auto_approve: employeeData.auto_approve ?? false,
                shift_start: employeeData.shift_start, shift_end: employeeData.shift_end,
                break_minutes: employeeData.break_minutes, grace_minutes: employeeData.grace_minutes,
                weekends: employeeData.weekends,
                joining_date: employeeData.joining_date || undefined,
                enable_overtime: employeeData.enable_overtime,
                enable_deduction: employeeData.enable_deduction,
            };
            const response = await apiCall('/employees/update', 'PUT', payload, company?.id);
            const result = await response.json();
            if (result.success) { employeeListRequestCache.clear(); await fetchEmployees(pagination.page, false); return { success: true }; }
            throw new Error(result.message || 'Update failed');
        } catch (e) {
            return { success: false, error: e.message };
        } finally { setLoading(false); }
    };

    const deleteEmployee = async (id) => {
        setLoading(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const response = await apiCall('/employees/delete', 'DELETE', { id }, company?.id);
            const result = await response.json();
            if (result.success) { employeeListRequestCache.clear(); await fetchEmployees(pagination.page, false); return { success: true }; }
            throw new Error(result.message || 'Delete failed');
        } catch (e) {
            return { success: false, error: e.message };
        } finally { setLoading(false); }
    };

    const normalizeTimeForApi = (value) => {
        if (!value) return '';
        const parts = String(value).split(':');
        if (parts.length >= 3) return parts.slice(0, 3).join(':');
        if (parts.length === 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
        return value;
    };

    const durationToMinutes = (value) => {
        if (typeof value === 'number') return value;
        if (!String(value).includes(':')) return Number(value);
        const [hours = '0', minutes = '0'] = String(value).split(':');
        return (Number(hours) * 60) + Number(minutes);
    };

    const appendIfPresent = (payload, key, value, transform = v => v) => {
        if (value === null || typeof value === 'undefined' || value === '') return;
        if (Array.isArray(value) && value.length === 0) return;
        payload[key] = transform(value);
    };

    const getCreateContactValue = () => (
        createFormData.signup_type === 'email'
            ? createFormData.email.trim()
            : `+${createFormData.country_code}${createFormData.phone}`.trim()
    );

    const requestCreateOtp = async () => {
        setOtpLoading(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const payload = { signup_type: createFormData.signup_type };
            payload[createFormData.signup_type] = getCreateContactValue();

            const response = await apiCall('/employees/request-create-otp', 'POST', payload, company?.id);
            const result = await response.json();
            if (result.success) return { success: true };
            throw new Error(result.message || 'Failed to send OTP');
        } catch (e) {
            return { success: false, error: e.message };
        } finally { setOtpLoading(false); }
    };

    const createEmployee = async () => {
        setCreateLoading(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const payload = {
                signup_type: createFormData.signup_type,
                otp: createFormData.otp.trim(),
                permission_package_id: Number(createFormData.permission_package_id),
                designation: createFormData.designation,
                salary_type: createFormData.salary_type,
                employment_type: createFormData.employment_type,
            };

            payload[createFormData.signup_type] = getCreateContactValue();

            appendIfPresent(payload, 'name', createFormData.name?.trim());
            appendIfPresent(payload, 'weekends', createFormData.weekends);
            appendIfPresent(payload, 'shift_start', createFormData.shift_start, normalizeTimeForApi);
            appendIfPresent(payload, 'shift_end', createFormData.shift_end, normalizeTimeForApi);
            appendIfPresent(payload, 'break_minutes', createFormData.break_minutes, durationToMinutes);
            appendIfPresent(payload, 'grace_minutes', createFormData.grace_minutes, durationToMinutes);
            appendIfPresent(payload, 'joining_date', createFormData.joining_date);

            if (createFormData.base_amount) {
                payload.base_amount = parseFloat(createFormData.base_amount);
                payload.effective_from = createFormData.effective_from;
                if (createFormData.effective_to) payload.effective_to = createFormData.effective_to;
                payload.components = createFormData.components.map(o => ({
                    component_id: Number(o.component_id),
                    calc_type: o.calc_type,
                    calc_value: parseFloat(o.calc_value),
                    ...(o.effective_from ? { effective_from: o.effective_from } : {}),
                    effective_to: o.effective_to || null,
                    reason: o.reason || ''
                }));
            }

            const response = await apiCall('/employees/create', 'POST', payload, company?.id);
            const result = await response.json();
            if (result.success) {
                employeeListRequestCache.clear();
                await fetchEmployees(1, false);
                return { success: true };
            }
            throw new Error(result.message || 'Create failed');
        } catch (e) {
            return { success: false, error: e.message };
        } finally { setCreateLoading(false); }
    };

    // ─── Modal Handlers ───────────────────────────────────────────────────────

    const openCreateModal = async () => {
        if (createEmployeeAccess.disabled) return;
        setConstantsLoading(true);
        setPermissionsLoading(true);
        try {
            if (!constantsFetched.current) await fetchConstants();
            if (!permissionsFetched.current) await fetchPermissionPackages();
            await fetchSalaryComponents();
            setCreateFormData(getDefaultCreateFormData());
            setCreateOtpRequested(false);
            setModalType(MODAL_TYPES.CREATE);
            setActiveActionMenu(null);
            setShowOverrideForm(false);
            setOverrideForm({ component_id: '', calc_type: 'percentage', calc_value: '', effective_from: '', effective_to: '', reason: '' });
        } catch (e) {
            console.error(e);
            toast.error('Failed to load create form data');
        } finally {
            setConstantsLoading(false);
            setPermissionsLoading(false);
        }
    };

    const openEditModal = async (employee) => {
        if (updateEmployeeAccess.disabled) return;
        setConstantsLoading(true);
        setPermissionsLoading(true);
        try {
            if (!constantsFetched.current) await fetchConstants();
            if (!permissionsFetched.current) await fetchPermissionPackages();

            const norm = normalizeEmployeeRecord(employee);
            setSelectedEmployee(norm);

            const selectedPackage = norm.permission_package_id
                ? {
                    value: norm.permission_package_id,
                    label:
                        norm.package?.package_name ||
                        `Package #${norm.permission_package_id}`,
                }
                : null;

            const initialConfig = {};
            attendanceMethodOptions.forEach(m => {
                initialConfig[m.id] = { enabled: false, available: m.available };
            });
            if (employee.attendance_methods?.length) {
                employee.attendance_methods.forEach(m => {
                    const id = m.method.toLowerCase();
                    if (initialConfig[id]) initialConfig[id] = { ...initialConfig[id], enabled: true };
                });
            }
            setAttendanceMethodsConfig(initialConfig);

            const rawWeekends = norm.weekends;
            const normalizedWeekends = Array.isArray(rawWeekends)
                ? rawWeekends.map(w => (typeof w === 'string' ? w : w?.day)).filter(Boolean)
                : [];

            setFormData({
                name: norm.name || '',
                designation: typeof norm.designation === 'object' ? norm.designation?.value : (norm.designation || ''),
                email: norm.email || '',
                phone: norm.phone || '',
                employee_code: norm.employee_code || '',
                employment_type: typeof norm.employment_type === 'object' ? norm.employment_type?.value : (norm.employment_type || ''),
                salary_type: typeof norm.salary_type === 'object' ? norm.salary_type?.value : (norm.salary_type || ''),
                joining_date: norm.joining_date ? new Date(norm.joining_date).toISOString().split('T')[0] : '',
                status: typeof norm.status === 'object' ? norm.status?.value : (norm.status || ''),
                permission_package_id: norm.permission_package_id,
                selectedPackage: selectedPackage,
                auto_approve: norm.auto_approve ?? false,
                shift_start: norm.shift_start || DEFAULT_SHIFT_START,
                shift_end: norm.shift_end || DEFAULT_SHIFT_END,
                break_minutes: normalizeDuration(norm.break_minutes, DEFAULT_DURATION),
                grace_minutes: normalizeDuration(norm.grace_minutes, DEFAULT_DURATION),
                weekends: normalizedWeekends,
                enable_overtime: !!norm.enable_overtime,
                enable_deduction: !!norm.enable_deduction,
            });

            setModalType(MODAL_TYPES.EDIT);
            setActiveActionMenu(null);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load edit data');
        } finally {
            setConstantsLoading(false);
            setPermissionsLoading(false);
        }
    };

    const openViewModal = async (emp) => {
        if (!constantsFetched.current) await fetchConstants();
        setShowPermissions(false);
        setSelectedEmployee(normalizeEmployeeRecord(emp));
        setModalType(MODAL_TYPES.VIEW);
        setActiveActionMenu(null);
    };

    const openEmployeeProfile = (employee) => {
        if (readEmployeeAccess.disabled || !employee?.id) return;
        setActiveActionMenu(null);
        navigate(`/employee-profile/${employee.id}`);
    };

    const openDeleteModal = (emp) => {
        if (deleteEmployeeAccess.disabled) return;
        setSelectedEmployee(emp);
        setModalType(MODAL_TYPES.DELETE_CONFIRM);
        setActiveActionMenu(null);
    };

    const closeModal = () => {
        setModalType(MODAL_TYPES.NONE);
        setSelectedEmployee(null);
        setShowPermissions(false);
        setAttendanceMethodsConfig({});
        setCreateFormData(getDefaultCreateFormData());
        setCreateOtpRequested(false);
        setFormData({
            name: '', designation: '', email: '', phone: '', employee_code: '',
            employment_type: '', salary_type: '', joining_date: '', status: '',
            permission_package_id: null, selectedPackage: null, attendance_methods: [],
            auto_approve: false, shift_start: DEFAULT_SHIFT_START, shift_end: DEFAULT_SHIFT_END,
            break_minutes: DEFAULT_DURATION, grace_minutes: DEFAULT_DURATION, weekends: [],
            enable_overtime: false,
            enable_deduction: false,
        });
    };

    // ─── Form Handlers ────────────────────────────────────────────────────────

    const validateCreateContact = () => {
        if (createFormData.signup_type === 'email') {
            if (!createFormData.email.trim()) return 'Email is required';
            return null;
        }
        if (!createFormData.phone.trim()) return 'Phone is required';
        return null;
    };

    const handleRequestCreateOtp = async () => {
        const contactError = validateCreateContact();
        if (contactError) { toast.warning(contactError); return { success: false, error: contactError }; }

        const result = await requestCreateOtp();
        if (result.success) {
            setCreateOtpRequested(true);
            toast.success('OTP sent successfully');
        } else {
            toast.error(result.error || 'Failed to send OTP');
        }
        return result;
    };

    const handleCreateEmployee = async (e) => {
        e.preventDefault();
        const contactError = validateCreateContact();
        if (contactError) { toast.warning(contactError); return; }
        if (!createFormData.otp.trim()) { toast.warning('OTP is required'); return; }
        if (!createFormData.permission_package_id) { toast.warning('Permission package is required'); return; }
        if (!createFormData.designation) { toast.warning('Designation is required'); return; }
        if (!createFormData.salary_type) { toast.warning('Salary type is required'); return; }
        if (!createFormData.employment_type) { toast.warning('Employment type is required'); return; }

        const result = await createEmployee();
        if (result.success) { toast.success('Employee created successfully!'); closeModal(); }
        else toast.error(result.error || 'Failed to create employee');
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        if (!selectedEmployee) return;
        const enabled = Object.entries(attendanceMethodsConfig).filter(([, c]) => c?.enabled && c?.available !== false);
        if (enabled.length === 0) { toast.warning('Please enable at least one attendance method'); return; }
        const result = await updateEmployee(selectedEmployee.id, {
            designation: formData.designation, employment_type: formData.employment_type,
            salary_type: formData.salary_type, permission_package_id: formData.permission_package_id,
            auto_approve: formData.auto_approve, shift_start: formData.shift_start,
            shift_end: formData.shift_end, break_minutes: formData.break_minutes,
            grace_minutes: formData.grace_minutes, weekends: formData.weekends,
            joining_date: formData.joining_date,
            enable_overtime: formData.enable_overtime,
            enable_deduction: formData.enable_deduction,
        });
        if (result.success) { toast.success('Employee updated successfully!'); closeModal(); }
        else toast.error(result.error || 'Failed to update employee');
    };

    const handleDelete = async () => {
        if (!selectedEmployee) return;
        const result = await deleteEmployee(selectedEmployee.id);
        if (result.success) { toast.success('Employee deleted successfully!'); closeModal(); }
        else toast.error(result.error || 'Failed to delete employee');
    };

    const handleToggleMethod = (methodId) => {
        setAttendanceMethodsConfig(prev => ({
            ...prev,
            [methodId]: { ...prev[methodId], enabled: !prev[methodId]?.enabled },
        }));
    };

    // ─── Display Helpers ──────────────────────────────────────────────────────

    const formatDate = (s) => {
        if (!s) return 'N/A';
        return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const getDesignationDisplay = useCallback((v) => {
        if (typeof v === 'object' && v !== null) return v.label || 'N/A';
        return constants.designations?.find(x => x.value === v)?.label || v || 'N/A';
    }, [constants.designations]);

    const getEmploymentTypeDisplay = useCallback((v) => {
        if (typeof v === 'object' && v !== null) return v.label || 'N/A';
        return constants.employment_types?.find(x => x.value === v)?.label || v || 'N/A';
    }, [constants.employment_types]);

    const getSalaryTypeDisplay = useCallback((v) => {
        if (typeof v === 'object' && v !== null) return v.label || 'N/A';
        return constants.salary_types?.find(x => x.value === v)?.label || v || 'N/A';
    }, [constants.salary_types]);

    const getStatusDisplay = useCallback((v) => {
        if (typeof v === 'object' && v !== null) return v.label || 'N/A';
        return constants.employment_status?.find(x => x.value === v)?.label || v || 'N/A';
    }, [constants.employment_status]);

    const getStatusClassName = useCallback((v) => {
        const val = typeof v === 'object' && v !== null ? v.value : v;
        return {
            active: 'bg-green-100 text-green-800 border border-green-200',
            inactive: 'bg-gray-100 text-gray-800 border border-gray-200',
            suspended: 'bg-red-100 text-red-800 border border-red-200',
            on_leave: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
        }[val] || 'bg-gray-100 text-gray-800 border border-gray-200';
    }, []);

    // ─── Memoised Options ─────────────────────────────────────────────────────

    const designationOptions = useMemo(() => constants.designations?.map(d => ({ value: d.value, label: d.label, description: d.description })) || [], [constants.designations]);
    const employmentTypeOptions = useMemo(() => constants.employment_types?.map(t => ({ value: t.value, label: t.label, description: t.description })) || [], [constants.employment_types]);
    const salaryTypeOptions = useMemo(() => constants.salary_types?.map(t => ({ value: t.value, label: t.label, description: t.description })) || [], [constants.salary_types]);

    const handlePageChange = useCallback((newPage) => {
        if (newPage !== pagination.page) goToPage(newPage);
    }, [pagination.page, goToPage]);

    // ─── Per-row action builder ───────────────────────────────────────────────

    const getRowActions = useCallback((emp) => [
        {
            label: 'View Details', icon: <FaEye size={14} />,
            onClick: () => openViewModal(emp),
            className: 'text-green-600 hover:text-green-700 hover:bg-green-50',
        },
        {
            label: 'Profile', icon: <FaUserCircle size={14} />,
            onClick: () => openEmployeeProfile(emp),
            disabled: readEmployeeAccess.disabled,
            title: readEmployeeAccess.disabled ? getAccessMessage(readEmployeeAccess) : '',
            className: 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50',
        },
        {
            label: 'Edit', icon: <FaEdit size={14} />,
            onClick: () => openEditModal(emp),
            disabled: updateEmployeeAccess.disabled,
            title: updateEmployeeAccess.disabled ? getAccessMessage(updateEmployeeAccess) : '',
            className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50',
        },
        {
            label: 'Delete', icon: <FaTrash size={14} />,
            onClick: () => openDeleteModal(emp),
            disabled: deleteEmployeeAccess.disabled,
            title: deleteEmployeeAccess.disabled ? getAccessMessage(deleteEmployeeAccess) : '',
            className: 'text-red-600 hover:text-red-700 hover:bg-red-50',
        },
    ], [readEmployeeAccess, updateEmployeeAccess, deleteEmployeeAccess]);

    // ─── Table column definitions ─────────────────────────────────────────────

    const tableColumns = useMemo(() => [
        {
            key: 'name',
            label: 'Employee',
            render: (emp) => (
                <div className="flex items-center gap-3">
                    <ProfileAvatar record={emp} name={emp.name}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-purple-100 overflow-hidden shrink-0"
                        onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(emp.id); }}>
                        <FaUser className="text-purple-500 text-sm" />
                    </ProfileAvatar>
                    <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate max-w-[160px] hover:text-indigo-600 cursor-pointer transition-colors"
                            onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(emp.id); }}>
                            {emp.name}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">{emp.employee_code}</p>
                    </div>
                </div>
            ),
        },
        {
            key: 'designation',
            label: 'Designation',
            render: (emp) => (
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                    {getDesignationDisplay(emp.designation)}
                </span>
            ),
        },
        {
            key: 'email',
            label: 'Email',
            render: (emp) => (
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <FaEnvelope className="text-gray-400 text-xs shrink-0" />
                    <span className="truncate max-w-[160px]">{emp.email}</span>
                </div>
            ),
        },
        {
            key: 'employment_type',
            label: 'Type',
            render: (emp) => (
                <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium">
                    {getEmploymentTypeDisplay(emp.employment_type)}
                </span>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (emp) => (
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${getStatusClassName(emp.status)}`}>
                    {getStatusDisplay(emp.status)}
                </span>
            ),
        },
        {
            key: 'joining_date',
            label: 'Joined',
            render: (emp) => (
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <FaCalendarAlt className="text-gray-400 text-xs shrink-0" />
                    {formatDate(emp.joining_date)}
                </div>
            ),
        },
    ], [getDesignationDisplay, getEmploymentTypeDisplay, getStatusDisplay, getStatusClassName, navigateToEmployeeProfile]);

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <ManagementHub
            eyebrow={<><FaUserCircle size={11} /> Employee management</>}
            title="Employee Management"
            description="Directory of all staff members with profile management and status tracking."
            accent="blue"
            summary={
                <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm">
                    <FaUserCircle className="text-blue-500" />
                    <span className="font-medium text-gray-700">{pagination.total}</span>
                    <span className="text-gray-500">Employees</span>
                </div>
            }
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button"
                        onClick={openCreateModal}
                        disabled={loading || createEmployeeAccess.disabled}
                        title={createEmployeeAccess.disabled ? getAccessMessage(createEmployeeAccess) : ''}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
                        <FaPlus size={13} />
                        Manual Create
                    </button>
                    <RefreshButton loading={loading} onClick={() => fetchEmployees(pagination.page, true)}>
                        Refresh
                    </RefreshButton>
                </div>
            }
        >
            <div className="space-y-6">

                {/* ── Filter & View Bar ── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm"
                >
                    <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
                        <div className="relative flex-1 w-full">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                            <input
                                type="text"
                                placeholder="Search employees by name, email, or code..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm min-h-[42px]"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                                    <FaTimes size={14} />
                                </button>
                            )}
                        </div>
                        <div className="w-full md:w-44">
                            <Select
                                options={EMPLOYEE_STATUS_FILTER_OPTIONS}
                                value={EMPLOYEE_STATUS_FILTER_OPTIONS.find(option => option.value === employeeStatusFilter)}
                                onChange={option => setEmployeeStatusFilter(option?.value || 'active')}
                                placeholder="Status"
                                isClearable={false}
                                styles={customSelectStyles}
                            />
                        </div>
                        <div className="hidden lg:block h-8 w-px bg-gray-200 mx-1" />
                        <div>
                            <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="blue" />
                        </div>
                    </div>
                </motion.div>

                {/* ── Loading skeleton ── */}
                {loading && !employees.length && <SkeletonComponent />}

                {/* ── Empty state ── */}
                {!loading && employees.length === 0 && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-16 bg-white rounded-xl shadow-xl">
                        <FaUserCircle className="text-8xl text-gray-300 mx-auto mb-4" />
                        <p className="text-xl text-gray-500">No employees found</p>
                        <p className="text-gray-400 mt-2">Try adjusting your search or add new employees</p>
                    </motion.div>
                )}

                {/* ── Table / Card views ── */}
                {!loading && employees.length > 0 && (
                    <>
                        {/* TABLE VIEW — uses ManagementTable */}
                        {viewMode === 'table' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                                <ManagementTable
                                    rows={employees}
                                    columns={tableColumns}
                                    rowKey="id"
                                    onRowClick={(emp) => openEmployeeProfile(emp)}
                                    getActions={getRowActions}
                                    activeId={activeActionMenu}
                                    onToggleAction={(e, id) => setActiveActionMenu(cur => cur === id ? null : id)}
                                    accent="blue"
                                    emptyState={
                                        <div className="text-center py-16">
                                            <FaUserCircle className="text-6xl text-gray-300 mx-auto mb-3" />
                                            <p className="text-gray-500">No employees found</p>
                                        </div>
                                    }
                                />
                            </motion.div>
                        )}

                        {/* CARD VIEW — uses ManagementCard */}
                        {viewMode === 'card' && (
                            <ManagementGrid viewMode={viewMode}>
                                {employees.map((emp, index) => (
                                    <ManagementCard
                                        key={emp.id}
                                        delay={index * 0.04}
                                        accent="blue"
                                        hoverable
                                        onClick={() => openEmployeeProfile(emp)}
                                        menuId={`emp-card-${emp.id}`}
                                        activeId={activeActionMenu}
                                        onToggle={(e, id) => { e.stopPropagation(); setActiveActionMenu(cur => cur === id ? null : id); }}
                                        actions={getRowActions(emp)}
                                        eyebrow={emp.employee_code}
                                        icon={
                                            <ProfileAvatar record={emp} name={emp.name}
                                                className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden"
                                                onClick={(e) => { e.stopPropagation(); navigateToEmployeeProfile(emp.id); }}>
                                                <FaUserCircle className="text-white text-base" />
                                            </ProfileAvatar>
                                        }
                                        title={emp.name}
                                        subtitle={getDesignationDisplay(emp.designation)}
                                        badge={
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusClassName(emp.status)}`}>
                                                {getStatusDisplay(emp.status)}
                                            </span>
                                        }
                                        footer={
                                            <>
                                                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                                    <FaUserTag className="text-purple-400" />
                                                    {getEmploymentTypeDisplay(emp.employment_type)}
                                                </span>
                                                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                                    <FaCalendarAlt className="text-green-400" />
                                                    {formatDate(emp.joining_date)}
                                                </span>
                                            </>
                                        }
                                    >
                                        {/* Card body details */}
                                        <div className="mt-1 space-y-1.5">
                                            <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                                <FaEnvelope className="text-gray-400 shrink-0" />
                                                <span className="truncate">{emp.email}</span>
                                            </p>
                                            {emp.phone && (
                                                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                                    <FaPhone className="text-gray-400 shrink-0" />
                                                    {emp.phone}
                                                </p>
                                            )}
                                            <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                                <CurrencyIcon className="text-emerald-500" size={12} />
                                                {getSalaryTypeDisplay(emp.salary_type)}
                                            </p>
                                        </div>
                                    </ManagementCard>
                                ))}
                            </ManagementGrid>
                        )}

                        {/* Pagination */}
                        <Pagination
                            currentPage={pagination.page}
                            totalItems={pagination.total}
                            itemsPerPage={pagination.limit}
                            onPageChange={handlePageChange}
                            onLimitChange={changeLimit}
                            showInfo={true}
                        />
                    </>
                )}
            </div>

            {/* ── Modals ── */}
            <AnimatePresence>

                {/* CREATE MODAL */}
                <ManualCreateEmployeeModal
                    key={MODAL_TYPES.CREATE}
                    isOpen={modalType === MODAL_TYPES.CREATE}
                    formData={createFormData}
                    setFormData={setCreateFormData}
                    constantsLoading={constantsLoading}
                    permissionsLoading={permissionsLoading}
                    otpLoading={otpLoading}
                    createLoading={createLoading}
                    permissionPackages={permissionPackages}
                    designationOptions={designationOptions}
                    employmentTypeOptions={employmentTypeOptions}
                    salaryTypeOptions={salaryTypeOptions}
                    onboardingPackages={onboardingPackages}
                    onboardingPackagesLoading={onboardingPackagesLoading}
                    otpRequested={createOtpRequested}
                    setOtpRequested={setCreateOtpRequested}
                    handleRequestCreateOtp={handleRequestCreateOtp}
                    handleCreateEmployee={handleCreateEmployee}
                    loadOnboardingPackages={fetchOnboardingPackages}
                    closeModal={closeModal}
                    salaryPackages={salaryPackages}
                    salaryPackagesLoading={salaryPackagesLoading}
                    availableComponents={availableComponents}
                    availableComponentsLoading={availableComponentsLoading}
                    showOverrideForm={showOverrideForm}
                    setShowOverrideForm={setShowOverrideForm}
                    overrideForm={overrideForm}
                    setOverrideForm={setOverrideForm}
                    loadSalaryPackages={fetchSalaryPackages}
                    loadSalaryComponents={fetchSalaryComponents}
                />

                {/* VIEW MODAL */}
                <Modal
                    key={MODAL_TYPES.VIEW}
                    isOpen={modalType === MODAL_TYPES.VIEW && !!selectedEmployee}
                    onClose={closeModal}
                    title="Employee Details"
                    subtitle="Comprehensive profile overview"
                    icon={<FaInfoCircle className="h-6 w-6" />}
                    size="4xl"
                    footer={
                        <>
                            <button onClick={closeModal}
                                className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                                Close
                            </button>
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={() => openDeleteModal(selectedEmployee)}
                                disabled={deleteEmployeeAccess.disabled}
                                title={deleteEmployeeAccess.disabled ? getAccessMessage(deleteEmployeeAccess) : ''}
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-red-200 transition disabled:opacity-50">
                                <FaTrash className="h-4 w-4" />Delete
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={() => openEmployeeProfile(selectedEmployee)}
                                disabled={readEmployeeAccess.disabled}
                                title={readEmployeeAccess.disabled ? getAccessMessage(readEmployeeAccess) : ''}
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 transition disabled:opacity-50">
                                <FaUserCircle className="h-4 w-4" />Profile
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={() => openEditModal(selectedEmployee)}
                                disabled={updateEmployeeAccess.disabled}
                                title={updateEmployeeAccess.disabled ? getAccessMessage(updateEmployeeAccess) : ''}
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 transition disabled:opacity-50">
                                <FaEdit className="h-4 w-4" />Edit Details
                            </motion.button>
                        </>
                    }
                >
                    {selectedEmployee && (
                        <div className="space-y-4">
                            {/* Profile card */}
                            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <ProfileAvatar record={selectedEmployee} name={selectedEmployee.name}
                                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-xl font-bold text-white shadow-lg overflow-hidden">
                                        {selectedEmployee.name?.charAt(0).toUpperCase()}
                                    </ProfileAvatar>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-slate-900 truncate">{selectedEmployee.name}</h3>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold border border-blue-100">
                                                {getDesignationDisplay(selectedEmployee.designation)}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${getStatusClassName(selectedEmployee.status)}`}>
                                                {getStatusDisplay(selectedEmployee.status)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Info grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                <InfoItem icon={<FaIdCard />} label="Employee Code" value={selectedEmployee.employee_code} />
                                <InfoItem icon={<FaEnvelope />} label="Email Address" value={selectedEmployee.email} />
                                <InfoItem icon={<FaPhone />} label="Phone Number" value={selectedEmployee.phone || 'N/A'} />
                                <InfoItem icon={<FaBriefcase />} label="Employment" value={getEmploymentTypeDisplay(selectedEmployee.employment_type)} />
                                <InfoItem icon={<CurrencyIcon className="text-emerald-500" size={12} />} label="Salary Type" value={getSalaryTypeDisplay(selectedEmployee.salary_type)} />
                                <InfoItem icon={<FaCalendarAlt />} label="Joining Date" value={formatDate(selectedEmployee.joining_date)} />
                                <InfoItem icon={<FaClock />} label="Overtime" value={selectedEmployee.enable_overtime ? 'Enabled' : 'Disabled'} />
                                <InfoItem icon={<FaCog />} label="Deduction" value={selectedEmployee.enable_deduction ? 'Enabled' : 'Disabled'} />
                            </div>

                            {/* Work Schedule */}
                            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <FaClock className="text-indigo-500" />Work Schedule
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { label: 'Shift Hours', value: `${selectedEmployee.shift_start || 'N/A'} – ${selectedEmployee.shift_end || 'N/A'}` },
                                        { label: 'Break Time', value: formatDurationDisplay(selectedEmployee.break_minutes) },
                                        { label: 'Grace Period', value: formatDurationDisplay(selectedEmployee.grace_minutes) },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase">{label}</span>
                                            <span className="text-xs font-bold text-slate-700">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Permission Package (collapsible) */}
                            {selectedEmployee.package && (
                                <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 overflow-hidden">
                                    <button onClick={() => setShowPermissions(!showPermissions)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-indigo-50/50 transition-colors">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <FaShieldAlt className="text-indigo-500" />Permission & Access
                                        </h4>
                                        <motion.div animate={{ rotate: showPermissions ? 180 : 0 }} transition={{ duration: 0.2 }}
                                            className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                                            <FaChevronDown size={10} />
                                        </motion.div>
                                    </button>
                                    <AnimatePresence>
                                        {showPermissions && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                <div className="px-4 pb-4">
                                                    <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm font-bold text-slate-700">
                                                                {selectedEmployee.package.package_name}
                                                            </span>
                                                            {selectedEmployee.package.group_code && (
                                                                <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg">
                                                                    {selectedEmployee.package.group_code}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {selectedEmployee.permissions?.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                                {selectedEmployee.permissions.map((perm, idx) => (
                                                                    <span key={idx} className="px-2 py-1 bg-slate-50 text-slate-600 text-[10px] font-bold rounded-lg border border-slate-100">
                                                                        {perm.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] text-slate-400 italic">No specific permissions assigned</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* Attendance methods & Weekends */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {selectedEmployee.attendance_methods?.length > 0 && (
                                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <FaUserCheck className="text-blue-500" />Attendance Methods
                                        </h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {selectedEmployee.attendance_methods.map((method, idx) => (
                                                <div key={idx} className="px-2 py-1 bg-white rounded-lg border border-slate-200 text-[10px] font-bold text-slate-700 shadow-sm flex items-center gap-1.5 capitalize">
                                                    <div className="w-1 h-1 rounded-full bg-blue-500" />
                                                    {method.method}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {selectedEmployee.weekends?.length > 0 && (
                                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <FaCalendarAlt className="text-purple-500" />Weekly Holidays
                                        </h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {selectedEmployee.weekends.map((w, idx) => {
                                                const dayName = typeof w === 'string' ? w : w?.day;
                                                return (
                                                    <div key={idx} className="px-2 py-1 bg-white rounded-lg border border-slate-200 text-[10px] font-bold text-slate-700 shadow-sm flex items-center gap-1.5 capitalize">
                                                        <div className="w-1 h-1 rounded-full bg-purple-500" />
                                                        {dayName}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </Modal>

                {/* EDIT MODAL */}
                <EmployeeEditModal
                    key={MODAL_TYPES.EDIT}
                    isOpen={modalType === MODAL_TYPES.EDIT}
                    selectedEmployee={selectedEmployee}
                    formData={formData}
                    setFormData={setFormData}
                    constants={constants}
                    permissionPackages={permissionPackages}
                    designationOptions={designationOptions}
                    employmentTypeOptions={employmentTypeOptions}
                    salaryTypeOptions={salaryTypeOptions}
                    attendanceMethods={attendanceMethodOptions}
                    attendanceMethodsConfig={attendanceMethodsConfig}
                    handleToggleMethod={handleToggleMethod}
                    handleEdit={handleEdit}
                    closeModal={closeModal}
                    loading={loading}
                    constantsLoading={constantsLoading}
                    permissionsLoading={permissionsLoading}
                    updateDisabled={updateEmployeeAccess.disabled}
                    submitTitle={updateEmployeeAccess.disabled ? getAccessMessage(updateEmployeeAccess) : ''}
                />

                {/* DELETE MODAL */}
                <Modal
                    key={MODAL_TYPES.DELETE_CONFIRM}
                    isOpen={modalType === MODAL_TYPES.DELETE_CONFIRM && !!selectedEmployee}
                    onClose={closeModal}
                    title="Confirm Delete"
                    subtitle="This action cannot be undone"
                    icon={<FaTrash className="h-6 w-6" />}
                    size="md"
                    footer={
                        <>
                            <button onClick={closeModal}
                                className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                                Cancel
                            </button>
                            <button onClick={handleDelete}
                                disabled={loading || deleteEmployeeAccess.disabled}
                                title={deleteEmployeeAccess.disabled ? getAccessMessage(deleteEmployeeAccess) : ''}
                                className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-100 hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-2">
                                {loading ? <FaSpinner className="animate-spin" /> : <FaTrash size={14} />}
                                Delete Employee
                            </button>
                        </>
                    }
                >
                    {selectedEmployee && (
                        <div className="text-center py-4">
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.5 }}
                                className="w-24 h-24 bg-gradient-to-br from-red-100 to-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaTrash className="text-4xl text-red-600" />
                            </motion.div>
                            <p className="text-xl text-gray-700 mb-2 font-semibold">Are you sure?</p>
                            <p className="text-gray-500">
                                You are about to delete{' '}
                                <span className="font-semibold text-red-600">{selectedEmployee.name}</span>.
                                {' '}This action cannot be undone.
                            </p>
                        </div>
                    )}
                </Modal>
            </AnimatePresence>
        </ManagementHub>
    );
};

export default EmployeeManagement;