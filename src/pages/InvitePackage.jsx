import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBox, FaCode, FaTag, FaBriefcase, FaUserTie,
  FaClock, FaCalendarAlt, FaSpinner, FaEye, FaEdit, FaTrash,
  FaCheckCircle, FaTimesCircle, FaSearch, FaTimes, FaShieldAlt,
  FaUserCheck, FaSave, FaPlus, FaCog, FaChevronDown,
  FaToggleOn, FaToggleOff, FaListUl, FaCoins
} from "react-icons/fa";
import { toast } from 'react-toastify';
import apiCall from "../utils/api";
import Pagination, { usePagination } from "../components/PaginationComponent";
import Skeleton from "../components/SkeletonComponent";
import ModalScrollLock from "../components/ModalScrollLock";
import ActionMenu from "../components/ActionMenu";
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import usePermissionAccess from "../hooks/usePermissionAccess";
import { useAuth } from "../context/AuthContext";
import TimeDurationPickerField from "../components/TimeDurationPicker";
import { RefreshButton } from '../components/common';
import SelectField from "../components/SelectField";
import CurrencyIcon from "../components/common/CurrencyIcon";

// ─── Constants & Helpers ─────────────────────────────────────────────────────

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

const formatDisplay = (str) =>
  typeof str === 'object' && str !== null ? str.label || 'N/A' : (str ? str.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "N/A");

const getRecordValue = (value) => {
  if (value && typeof value === "object") return value.value ?? "";
  return value ?? "";
};

const getStatusBadge = (isActive) => {
  if (isActive) {
    return { icon: FaCheckCircle, text: "Active", className: "bg-green-100 text-green-800 border border-green-200" };
  }
  return { icon: FaTimesCircle, text: "Inactive", className: "bg-gray-100 text-gray-800 border border-gray-200" };
};

const getVisibleColumns = (width) => ({
  showCode: width >= 480,
  showName: true,
  showDesignation: width >= 640,
  showStatus: width >= 768,
  showEmployment: width >= 1024,
  showPermissions: width >= 1200,
  showSchedule: width >= 1400
});

// Weekday options
const WEEKDAYS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" }
];

const normalizeAttendanceMethodValue = (value) => {
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (value && typeof value === 'object') {
    return String(value.method || value.key || value.id || value.value || '').trim().toLowerCase();
  }
  return '';
};

const normalizeAttendanceMethods = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(normalizeAttendanceMethodValue).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeAttendanceMethods(parsed);
    } catch {
      return [value.trim().toLowerCase()].filter(Boolean);
    }
  }
  return [];
};

const formatAttendanceMethod = (value) => {
  const normalized = normalizeAttendanceMethodValue(value);
  if (!normalized) return 'N/A';
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

const DEFAULT_DURATION = "00:30";

const normalizeDuration = (value, fallback = DEFAULT_DURATION) => {
  if (value === null || typeof value === "undefined" || value === "") return fallback;
  if (typeof value === "number") {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  if (typeof value !== "string") return fallback;
  const [hours = "00", minutes = "00"] = value.split(":");
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

// Format duration for display: "00:45" → "45 min", "01:00" → "1h 0m"
const formatDurationDisplay = (value) => {
  if (!value) return "N/A";
  const normalized = normalizeDuration(value);
  const [h, m] = normalized.split(":").map(Number);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

// weekends is a plain string[] from the API
const normalizePackageRecord = (pkg) => ({
  ...pkg,
  break_minutes: normalizeDuration(pkg?.break_minutes, DEFAULT_DURATION),
  grace_minutes: normalizeDuration(pkg?.grace_minutes, DEFAULT_DURATION),
  weekends: Array.isArray(pkg?.weekends) ? pkg.weekends : [],
  permissions: Array.isArray(pkg?.permissions) ? pkg.permissions : [],
  salary_components: Array.isArray(pkg?.salary_components) ? pkg.salary_components : [],
});

// ─── Sub-components ──────────────────────────────────────────────────────────

const InfoItem = ({ icon, label, value, className = "" }) => (
  <div className={`flex items-start gap-2 rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 px-3 py-2 ${className}`}>
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80 border border-gray-200">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 leading-none mb-1">
        {label}
      </div>
      <div className="text-sm font-medium text-gray-800 leading-snug break-words">{value}</div>
    </div>
  </div>
);

// Salary component type badge colors
const getSalaryComponentBadge = (type) => {
  if (type === "earning") return "bg-emerald-50 text-emerald-700 border border-emerald-100";
  if (type === "deduction") return "bg-red-50 text-red-700 border border-red-100";
  return "bg-gray-50 text-gray-600 border border-gray-100";
};

// Simple day-toggle weekend config — weekends is string[]
const WeekendConfig = ({ weekends, onChange }) => {
  const toggleDay = (day) => {
    if (weekends.includes(day)) {
      onChange(weekends.filter((d) => d !== day));
    } else {
      onChange([...weekends, day]);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
      {WEEKDAYS.map((day) => {
        const isSelected = weekends.includes(day.value);
        return (
          <button
            key={day.value}
            type="button"
            onClick={() => toggleDay(day.value)}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${isSelected
              ? "bg-indigo-600 border-indigo-600 text-white shadow-md scale-[1.02]"
              : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50"
              }`}
          >
            <span>{day.label}</span>
            {isSelected && <FaCheckCircle className="w-3.5 h-3.5 opacity-90" />}
          </button>
        );
      })}
    </div>
  );
};

// ─── Create/Edit Modal ───────────────────────────────────────────────────────

function PackageFormModal({ isOpen, onClose, onSuccess, packageData, isEditing, submitDisabled, submitTitle }) {
  const { attendanceMethods: companyAttendanceMethods = [], loading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    designation: "",
    salary_type: "",
    employment_type: "",
    permission_package_id: "",
    component_package: "",
    shift_start: "09:00:00",
    shift_end: "18:00:00",
    break_minutes: DEFAULT_DURATION,
    grace_minutes: DEFAULT_DURATION,
    weekends: [],
    attendance_methods: [],
    auto_approve: false,
    enable_overtime: true,
    enable_deduction: true,
    remarks: ""
  });

  const [loading, setLoading] = useState(false);
  const [permissionPackages, setPermissionPackages] = useState([]);
  const [salaryComponentPackages, setSalaryComponentPackages] = useState([]);
  const [constants, setConstants] = useState({ designations: [], salary_types: [], employment_types: [] });
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [showAttendanceMethods, setShowAttendanceMethods] = useState(false);
  const [showWeekends, setShowWeekends] = useState(false);

  const attendanceMethods = useMemo(() => companyAttendanceMethods, [companyAttendanceMethods]);

  useEffect(() => {
    if (isOpen) fetchOptions();
  }, [isOpen]);

  useEffect(() => {
    if (packageData && isEditing) {
      setFormData({
        code: packageData.code || "",
        name: packageData.name || "",
        designation: getRecordValue(packageData.designation),
        salary_type: getRecordValue(packageData.salary_type),
        employment_type: getRecordValue(packageData.employment_type),
        permission_package_id: packageData.permission_package_id?.toString() || "",
        // component_package from API is now a plain integer ID (e.g. 18) or null
        component_package: packageData.component_package != null ? packageData.component_package.toString() : "",
        shift_start: packageData.shift_start || "09:00:00",
        shift_end: packageData.shift_end || "18:00:00",
        break_minutes: normalizeDuration(packageData.break_minutes),
        grace_minutes: normalizeDuration(packageData.grace_minutes),
        weekends: Array.isArray(packageData.weekends) ? packageData.weekends : [],
        attendance_methods: normalizeAttendanceMethods(packageData.attendance_methods || []),
        auto_approve: packageData.auto_approve ?? false,
        enable_overtime: packageData.enable_overtime ?? true,
        enable_deduction: packageData.enable_deduction ?? true,
        remarks: packageData.remarks || ""
      });
    } else {
      setFormData({
        code: "",
        name: "",
        designation: "",
        salary_type: "",
        employment_type: "",
        permission_package_id: "",
        component_package: "",
        shift_start: "09:00:00",
        shift_end: "18:00:00",
        break_minutes: DEFAULT_DURATION,
        grace_minutes: DEFAULT_DURATION,
        weekends: [],
        attendance_methods: [],
        auto_approve: false,
        enable_overtime: true,
        enable_deduction: true,
        remarks: ""
      });
    }
  }, [packageData, isEditing, isOpen]);

  const fetchOptions = async () => {
    setLoadingOptions(true);
    try {
      const company = JSON.parse(localStorage.getItem("company"));
      await Promise.all([
        (async () => {
          try {
            const permRes = await apiCall('/permissions/permission-packages', 'GET', null, company?.id);
            const permJson = await permRes.json();
            if (permJson.success) setPermissionPackages(permJson.data?.packages || []);
          } catch (error) {
            console.error('Failed to fetch permission packages:', error);
          }
        })(),
        (async () => {
          try {
            const constRes = await apiCall('/constants/', 'GET', null, company?.id);
            const constJson = await constRes.json();
            if (constJson.success) {
              const data = constJson.data;
              setConstants({
                designations: data.designations?.map(d => ({ value: d.value.value, label: d.value.label })) || [],
                salary_types: data.salary_types?.map(s => ({ value: s.value.value, label: s.value.label })) || [],
                employment_types: data.employment_types?.map(e => ({ value: e.value.value, label: e.value.label })) || []
              });
            }
          } catch (error) {
            console.error('Failed to fetch form constants:', error);
          }
        })(),
        (async () => {
          try {
            const salaryRes = await apiCall('/salary/components/packages', 'GET', null, company?.id);
            const salaryJson = await salaryRes.json();
            if (salaryJson.success) setSalaryComponentPackages(salaryJson.data || []);
          } catch (error) {
            console.error('Failed to fetch salary component packages:', error);
          }
        })(),
      ]);
    } catch (error) {
      console.error("Failed to fetch options:", error);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleAttendanceToggle = (method) => {
    setFormData(prev => ({
      ...prev,
      attendance_methods: prev.attendance_methods.includes(method)
        ? prev.attendance_methods.filter(m => m !== method)
        : [...prev.attendance_methods, method]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitDisabled) return;

    setLoading(true);
    try {
      const company = JSON.parse(localStorage.getItem("company"));

      const payload = {
        code: formData.code,
        name: formData.name,
        designation: formData.designation || null,
        salary_type: formData.salary_type || null,
        employment_type: formData.employment_type || null,
        permission_package_id: formData.permission_package_id ? parseInt(formData.permission_package_id) : null,
        component_package: formData.component_package ? parseInt(formData.component_package) : null,
        shift_start: formData.shift_start || null,
        shift_end: formData.shift_end || null,
        break_minutes: formData.break_minutes || null,
        grace_minutes: formData.grace_minutes || null,
        weekends: formData.weekends,
        attendance_methods: formData.attendance_methods,
        auto_approve: formData.auto_approve,
        enable_overtime: formData.enable_overtime,
        enable_deduction: formData.enable_deduction,
        remarks: formData.remarks || null
      };

      let response;
      if (isEditing) {
        payload.package_id = packageData.id;
        response = await apiCall('/company/invites/package-update', 'PUT', payload, company?.id);
      } else {
        response = await apiCall('/company/invites/package-create', 'POST', payload, company?.id);
      }

      const result = await response.json();
      if (result.success) {
        toast.success(isEditing ? "Package updated successfully!" : "Package created successfully!");
        onSuccess();
        onClose();
      } else {
        throw new Error(result.message || "Operation failed");
      }
    } catch (error) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      variants={backdropVariants} initial="hidden" animate="visible" exit="exit"
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <ModalScrollLock />
      <motion.div
        variants={modalVariants} initial="hidden" animate="visible" exit="exit"
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b bg-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              {isEditing ? <FaEdit className="w-6 h-6 text-white" /> : <FaPlus className="w-6 h-6 text-white" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{isEditing ? "Edit Package" : "Create New Package"}</h2>
              <p className="text-sm text-gray-500 mt-0.5">Configure invite package settings</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
            <FaTimes className="text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 mb-6 custom-scrollbar">
          {loadingOptions || authLoading ? (
            <div className="flex items-center justify-center py-12">
              <FaSpinner className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="ml-3 text-gray-500">Loading options...</span>
            </div>
          ) : (
            <div className="space-y-6 p-2 lg:p-0">

              {/* Code & Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                    <FaCode className="text-indigo-500" /> Package Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" name="code" value={formData.code} onChange={handleChange}
                    placeholder="e.g., DEV001" required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                    <FaBox className="text-indigo-500" /> Package Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" name="name" value={formData.name} onChange={handleChange}
                    placeholder="e.g., Developer Package" required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                  />
                </div>
              </div>

              {/* Designation / Employment / Salary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                    <FaUserTie className="text-indigo-500" /> Designation
                  </label>
                  <SelectField
                    name="designation"
                    options={constants.designations}
                    value={constants.designations.find(d => d.value === formData.designation) || null}
                    onChange={(option) => handleChange({ target: { name: 'designation', value: option ? option.value : '' } })}
                    placeholder="Select designation"
                    isClearable
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                    <FaBriefcase className="text-indigo-500" /> Employment Type
                  </label>
                  <SelectField
                    name="employment_type"
                    options={constants.employment_types}
                    value={constants.employment_types.find(t => t.value === formData.employment_type) || null}
                    onChange={(option) => handleChange({ target: { name: 'employment_type', value: option ? option.value : '' } })}
                    placeholder="Select type"
                    isClearable
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                    <CurrencyIcon className="text-emerald-500" size={12} /> Salary Type
                  </label>
                  <SelectField
                    name="salary_type"
                    options={constants.salary_types}
                    value={constants.salary_types.find(s => s.value === formData.salary_type) || null}
                    onChange={(option) => handleChange({ target: { name: 'salary_type', value: option ? option.value : '' } })}
                    placeholder="Select type"
                    isClearable
                  />
                </div>
              </div>

              {/* Permission Package / Salary Component Package / Remarks */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                    <FaShieldAlt className="text-indigo-500" /> Permission Package
                  </label>
                  <SelectField
                    name="permission_package_id"
                    options={permissionPackages.map(pkg => ({ value: pkg.id, label: pkg.package_name }))}
                    value={permissionPackages.map(pkg => ({ value: pkg.id, label: pkg.package_name })).find(p => String(p.value) === String(formData.permission_package_id)) || null}
                    onChange={(option) => handleChange({ target: { name: 'permission_package_id', value: option ? option.value : '' } })}
                    placeholder="Select permission package"
                    isClearable
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                    <CurrencyIcon className="text-emerald-500" size={12} /> Salary Component Package
                  </label>
                  <SelectField
                    name="component_package"
                    options={salaryComponentPackages.map(pkg => ({
                      value: pkg.id,
                      label: `${pkg.name} (${pkg.code})`,
                    }))}
                    value={salaryComponentPackages
                      .map(pkg => ({
                        value: pkg.id,
                        label: `${pkg.name} (${pkg.code})`,
                      }))
                      .find(pkg => String(pkg.value) === String(formData.component_package)) || null}
                    onChange={(option) => handleChange({ target: { name: 'component_package', value: option ? option.value : '' } })}
                    placeholder="Select salary package"
                    isClearable
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                    <FaTag className="text-indigo-500" /> Remarks
                  </label>
                  <input
                    type="text" name="remarks" value={formData.remarks} onChange={handleChange}
                    placeholder="Optional notes"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
                  />
                </div>
              </div>

              {/* Shift Timing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <TimeDurationPickerField
                  label="Shift Start" value={formData.shift_start}
                  onChange={(val) => setFormData(prev => ({ ...prev, shift_start: val }))}
                  mode="time"
                />
                <TimeDurationPickerField
                  label="Shift End" value={formData.shift_end}
                  onChange={(val) => setFormData(prev => ({ ...prev, shift_end: val }))}
                  mode="time"
                />
              </div>

              {/* Break & Grace */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <TimeDurationPickerField
                  label="Break Minutes" value={formData.break_minutes}
                  onChange={(val) => setFormData(prev => ({ ...prev, break_minutes: val }))}
                  mode="duration"
                />
                <TimeDurationPickerField
                  label="Grace Minutes" value={formData.grace_minutes}
                  onChange={(val) => setFormData(prev => ({ ...prev, grace_minutes: val }))}
                  mode="duration"
                />
              </div>

              {/* Weekend Config — collapsible */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/30 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowWeekends(!showWeekends)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-100/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FaCalendarAlt className="text-purple-500" />
                    <span className="text-sm font-semibold text-gray-700">Weekend / Off-Day Configuration</span>
                    {formData.weekends?.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-purple-100 text-purple-700 font-bold">
                        {formData.weekends.length}
                      </span>
                    )}
                  </div>
                  <motion.div animate={{ rotate: showWeekends ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <FaChevronDown className="w-4 h-4 text-gray-400" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {showWeekends && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4">
                        <WeekendConfig
                          weekends={formData.weekends}
                          onChange={(newWeekends) => setFormData(prev => ({ ...prev, weekends: newWeekends }))}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Attendance Methods — collapsible */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/30 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAttendanceMethods(!showAttendanceMethods)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-100/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FaUserCheck className="text-indigo-500" />
                    <span className="text-sm font-semibold text-gray-700">Attendance Methods</span>
                    {formData.attendance_methods?.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-indigo-100 text-indigo-700 font-bold">
                        {formData.attendance_methods.length}
                      </span>
                    )}
                  </div>
                  <motion.div animate={{ rotate: showAttendanceMethods ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <FaChevronDown className="w-4 h-4 text-gray-400" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {showAttendanceMethods && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4">
                        {attendanceMethods.length > 0 ? (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {attendanceMethods.map((method) => {
                              const isSelected = formData.attendance_methods.includes(method.method);
                              return (
                                <button
                                  key={method.method}
                                  type="button"
                                  onClick={() => handleAttendanceToggle(method.method)}
                                  className={`flex flex-col items-start gap-1 rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 ${isSelected
                                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
                                    }`}
                                >
                                  <div className="flex w-full items-center justify-between gap-3">
                                    <span className="font-semibold">{method.label || formatAttendanceMethod(method.method)}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
                                      }`}>
                                      {isSelected ? 'Selected' : 'Available'}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                            No attendance methods are available for the current company.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Toggles Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Auto Approve Toggle */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
                        <FaCheckCircle className="h-4 w-4 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Auto Approve</p>
                        <p className="text-xs text-gray-500">Auto approve attendance</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, auto_approve: !prev.auto_approve }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.auto_approve ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${formData.auto_approve ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                    </button>
                  </div>
                </div>

                {/* Enable Overtime Toggle */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                        <FaClock className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Enable Overtime</p>
                        <p className="text-xs text-gray-500">Allow overtime calc</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, enable_overtime: !prev.enable_overtime }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.enable_overtime ? 'bg-emerald-600' : 'bg-gray-200'
                        }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${formData.enable_overtime ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                    </button>
                  </div>
                </div>

                {/* Enable Deduction Toggle */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50">
                        <FaCoins className="h-4 w-4 text-rose-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Enable Deduction</p>
                        <p className="text-xs text-gray-500">Allow penalty deductions</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, enable_deduction: !prev.enable_deduction }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.enable_deduction ? 'bg-rose-600' : 'bg-gray-200'
                        }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${formData.enable_deduction ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <button
              type="button" onClick={onClose} disabled={loading}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={loading || submitDisabled}
              title={submitDisabled ? submitTitle : ""}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-700 hover:to-purple-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <FaSpinner className="w-4 h-4 animate-spin" /> : <FaSave className="w-4 h-4" />}
              {isEditing ? "Update Package" : "Create Package"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── View Modal (Enhanced with ALL details) ─────────────────────────────────

function ViewPackageModal({ isOpen, onClose, package: pkg, onEdit, onDelete, onToggleStatus, updateAccess, deleteAccess, getAccessMessage }) {
  const [showWeekends, setShowWeekends] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showSalaryComponents, setShowSalaryComponents] = useState(false);

  if (!isOpen || !pkg) return null;

  const status = getStatusBadge(pkg.is_active);
  const StatusIcon = status.icon;

  const earningComponents = (pkg.salary_components || []).filter(c => c.component_type === "earning");
  const deductionComponents = (pkg.salary_components || []).filter(c => c.component_type === "deduction");

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          variants={backdropVariants} initial="hidden" animate="visible" exit="exit"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <ModalScrollLock />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 18 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 18 }}
            transition={{ type: "spring", damping: 25, stiffness: 280 }}
            className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="shrink-0 border-b border-slate-100 bg-white p-5 sm:px-6 sm:py-5 z-10">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-100">
                    <FaBox className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Package Details</h2>
                    <p className="text-sm text-slate-500">Comprehensive configuration overview</p>
                  </div>
                </div>
                <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-all">
                  <FaTimes className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">

              {/* Profile Card */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm border border-indigo-100">
                      <FaBriefcase size={24} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold text-slate-900 truncate">{pkg.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold border border-indigo-100 uppercase tracking-wider">
                          {pkg.code}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${status.className}`}>
                          <StatusIcon size={10} />{status.text}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Information Grid - now includes all key fields */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <InfoItem icon={<FaUserTie className="text-blue-500" />} label="Designation" value={formatDisplay(pkg.designation)} />
                <InfoItem icon={<FaBriefcase className="text-purple-500" />} label="Employment" value={formatDisplay(pkg.employment_type)} />
                <InfoItem icon={<CurrencyIcon className="text-emerald-500" size={12} />} label="Salary Type" value={formatDisplay(pkg.salary_type)} />
                <InfoItem icon={<FaClock className="text-orange-500" />} label="Shift Start" value={pkg.shift_start || "—"} />
                <InfoItem icon={<FaClock className="text-amber-500" />} label="Shift End" value={pkg.shift_end || "—"} />
                <InfoItem icon={<FaClock className="text-rose-500" />} label="Break Time" value={formatDurationDisplay(pkg.break_minutes)} />
                <InfoItem icon={<FaClock className="text-indigo-500" />} label="Grace Period" value={formatDurationDisplay(pkg.grace_minutes)} />
                <InfoItem icon={<FaShieldAlt className="text-indigo-400" />} label="Permission Package" value={pkg.permission_package_name || "—"} />
                <InfoItem icon={<FaTag className="text-slate-500" />} label="Remarks" value={pkg.remarks || "—"} />
                {/* Overtime & Deduction status */}
                <InfoItem 
                  icon={<FaClock className="text-emerald-500" />} 
                  label="Overtime" 
                  value={pkg.enable_overtime ? "Enabled" : "Disabled"} 
                />
                <InfoItem 
                  icon={<FaCoins className="text-rose-500" />} 
                  label="Deduction" 
                  value={pkg.enable_deduction ? "Enabled" : "Disabled"} 
                />
                {/* Component package ID if present */}
                {pkg.component_package && (
                  <InfoItem 
                    icon={<FaBox className="text-slate-500" />} 
                    label="Component Pkg ID" 
                    value={pkg.component_package} 
                  />
                )}
              </div>

              {/* Advanced Settings Row - now includes Auto Approve, Overtime & Deduction */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Auto Approve */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pkg.auto_approve ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}`}>
                      <FaCheckCircle size={16} />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">Auto Approve</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${pkg.auto_approve
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                    {pkg.auto_approve ? "On" : "Off"}
                  </span>
                </div>

                {/* Enable Overtime */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pkg.enable_overtime ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                      <FaClock size={16} />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">Overtime</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${pkg.enable_overtime
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                    {pkg.enable_overtime ? "Enabled" : "Disabled"}
                  </span>
                </div>

                {/* Enable Deduction */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pkg.enable_deduction ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
                      <FaCoins size={16} />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">Deduction</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${pkg.enable_deduction
                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                    {pkg.enable_deduction ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>

              {/* Attendance Methods */}
              {pkg.attendance_methods?.length > 0 && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <FaUserCheck className="text-indigo-500" size={16} />
                    <span className="text-sm font-semibold text-slate-700">Attendance Methods</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {pkg.attendance_methods.map((method, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold capitalize border border-slate-100">
                        {formatAttendanceMethod(method)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Weekends — collapsible */}
              {pkg.weekends?.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <button
                    onClick={() => setShowWeekends(!showWeekends)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <FaCalendarAlt className="text-indigo-500" />
                      <span className="text-sm font-semibold text-slate-700">Weekends / Off Days</span>
                      <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-indigo-100 text-indigo-700 font-bold">
                        {pkg.weekends.length}
                      </span>
                    </div>
                    <motion.div animate={{ rotate: showWeekends ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <FaChevronDown className="w-4 h-4 text-slate-400" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {showWeekends && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-3 bg-white flex flex-wrap gap-2">
                          {pkg.weekends.map((day, idx) => (
                            <span
                              key={`${day}-${idx}`}
                              className="capitalize px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-bold tracking-wide"
                            >
                              {day}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Permissions — collapsible, full details */}
              {pkg.permissions?.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <button
                    onClick={() => setShowPermissions(!showPermissions)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <FaShieldAlt className="text-indigo-500" />
                      <span className="text-sm font-semibold text-slate-700">Permissions</span>
                      <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-indigo-100 text-indigo-700 font-bold">
                        {pkg.permissions.length}
                      </span>
                    </div>
                    <motion.div animate={{ rotate: showPermissions ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <FaChevronDown className="w-4 h-4 text-slate-400" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {showPermissions && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-3 bg-white">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {pkg.permissions.map((perm) => (
                              <div
                                key={perm.id}
                                className="flex items-start gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
                              >
                                <FaCheckCircle className="text-indigo-400 mt-0.5 shrink-0" size={12} />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-slate-700 leading-snug truncate">{perm.name}</p>
                                  <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">{perm.code}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Salary Components — collapsible, split by type */}
              {pkg.salary_components?.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <button
                    onClick={() => setShowSalaryComponents(!showSalaryComponents)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <FaCoins className="text-emerald-500" />
                      <span className="text-sm font-semibold text-slate-700">Salary Components</span>
                      <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-emerald-100 text-emerald-700 font-bold">
                        {pkg.salary_components.length}
                      </span>
                      {earningComponents.length > 0 && (
                        <span className="px-2 py-0.5 text-[9px] rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold">
                          {earningComponents.length} earning
                        </span>
                      )}
                      {deductionComponents.length > 0 && (
                        <span className="px-2 py-0.5 text-[9px] rounded-full bg-red-50 text-red-600 border border-red-100 font-bold">
                          {deductionComponents.length} deduction
                        </span>
                      )}
                    </div>
                    <motion.div animate={{ rotate: showSalaryComponents ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <FaChevronDown className="w-4 h-4 text-slate-400" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {showSalaryComponents && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-3 bg-white space-y-3">
                          {/* Earnings */}
                          {earningComponents.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2 flex items-center gap-1">
                                <FaCoins size={9} /> Earnings
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {earningComponents.map((comp) => (
                                  <SalaryComponentRow key={comp.id} comp={comp} />
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Deductions */}
                          {deductionComponents.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-2 flex items-center gap-1">
                                <FaCoins size={9} /> Deductions
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {deductionComponents.map((comp) => (
                                  <SalaryComponentRow key={comp.id} comp={comp} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-3.5 flex justify-end gap-2.5">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-semibold text-[13px] hover:bg-slate-100 transition-all shadow-sm"
              >
                Close
              </button>
              {onToggleStatus && (
                <button
                  onClick={onToggleStatus}
                  disabled={updateAccess?.disabled}
                  title={updateAccess?.disabled ? getAccessMessage?.(updateAccess) : ""}
                  className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-[13px] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${pkg.is_active
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-orange-100 hover:from-amber-600 hover:to-orange-700'
                    : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-emerald-100 hover:from-emerald-600 hover:to-green-700'
                    }`}
                >
                  {pkg.is_active ? <FaToggleOff size={12} /> : <FaToggleOn size={12} />}
                  {pkg.is_active ? "Deactivate" : "Activate"}
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  disabled={deleteAccess?.disabled}
                  title={deleteAccess?.disabled ? getAccessMessage?.(deleteAccess) : ""}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-bold text-[13px] hover:from-red-600 hover:to-rose-700 transition-all shadow-lg shadow-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaTrash size={12} /> Delete
                </button>
              )}
              {onEdit && (
                <button
                  onClick={onEdit}
                  disabled={updateAccess?.disabled}
                  title={updateAccess?.disabled ? getAccessMessage?.(updateAccess) : ""}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-[13px] hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaEdit size={12} /> Edit
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Salary component row used in the View modal
function SalaryComponentRow({ comp }) {
  const isActive = comp.is_active;
  const isPercentage = comp.calc_type === "percentage";

  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors ${isActive
      ? "bg-white border-slate-100 hover:border-slate-200"
      : "bg-slate-50 border-slate-100 opacity-60"
      }`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${getSalaryComponentBadge(comp.component_type)}`}>
          {comp.component_code}
        </span>
        <span className="font-medium text-slate-700 truncate">{comp.component_name}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <span className="font-bold text-slate-800">
          {isPercentage ? `${comp.calc_value}%` : comp.calc_value > 0 ? `${comp.calc_value}` : "—"}
        </span>
        {!isActive && (
          <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-bold">OFF</span>
        )}
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeletePackageModal({ isOpen, onClose, onConfirm, package: pkg, processing }) {
  if (!isOpen || !pkg) return null;

  return (
    <motion.div
      variants={backdropVariants} initial="hidden" animate="visible" exit="exit"
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <ModalScrollLock />
      <motion.div
        variants={modalVariants} initial="hidden" animate="visible" exit="exit"
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b bg-gradient-to-r from-red-600 to-rose-600 text-white">
          <div className="flex items-center gap-2">
            <FaTrash className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Delete Package</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition">
            <FaTimes size={18} />
          </button>
        </div>

        <div className="p-6 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <FaTrash className="text-3xl text-red-600" />
          </div>
          <p className="text-lg font-semibold text-gray-800 mb-2">Are you sure?</p>
          <p className="text-gray-500 mb-6">
            You are about to delete <span className="font-semibold text-red-600">{pkg.name}</span> ({pkg.code}).
            This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={onClose}
              className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={() => onConfirm(pkg.id)} disabled={processing}
              className="px-5 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition shadow-md flex items-center gap-2 disabled:opacity-50">
              {processing && <FaSpinner className="w-4 h-4 animate-spin" />}
              Delete Package
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Toggle Status Modal ──────────────────────────────────────────────────────

function ToggleStatusModal({ isOpen, onClose, onConfirm, package: pkg, processing, newStatus }) {
  if (!isOpen || !pkg) return null;

  const isActivating = newStatus === true;

  return (
    <motion.div
      variants={backdropVariants} initial="hidden" animate="visible" exit="exit"
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <ModalScrollLock />
      <motion.div
        variants={modalVariants} initial="hidden" animate="visible" exit="exit"
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex justify-between items-center p-5 border-b text-white ${isActivating
          ? 'bg-gradient-to-r from-green-600 to-emerald-600'
          : 'bg-gradient-to-r from-amber-600 to-orange-600'
          }`}>
          <div className="flex items-center gap-2">
            {isActivating ? <FaToggleOn className="w-5 h-5" /> : <FaToggleOff className="w-5 h-5" />}
            <h2 className="text-xl font-semibold">{isActivating ? "Activate Package" : "Deactivate Package"}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition">
            <FaTimes size={18} />
          </button>
        </div>

        <div className="p-6 text-center">
          <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${isActivating ? 'bg-green-100' : 'bg-amber-100'
            }`}>
            {isActivating
              ? <FaCheckCircle className="text-3xl text-green-600" />
              : <FaTimesCircle className="text-3xl text-amber-600" />}
          </div>
          <p className="text-lg font-semibold text-gray-800 mb-2">
            {isActivating ? "Activate Package?" : "Deactivate Package?"}
          </p>
          <p className="text-gray-500 mb-6">
            {isActivating
              ? `Are you sure you want to activate "${pkg.name}"? Active packages can be used for new invitations.`
              : `Are you sure you want to deactivate "${pkg.name}"? Inactive packages won't appear in invite creation.`}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={onClose}
              className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={() => onConfirm(pkg.id, newStatus)}
              disabled={processing}
              className={`px-5 py-2 rounded-xl text-white transition shadow-md flex items-center gap-2 disabled:opacity-50 ${isActivating ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
            >
              {processing && <FaSpinner className="w-4 h-4 animate-spin" />}
              {isActivating ? "Activate" : "Deactivate"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvitePackageManagement() {
  const { checkActionAccess, getAccessMessage } = usePermissionAccess();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("table");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [toggleNewStatus, setToggleNewStatus] = useState(false);
  const fetchInProgress = useRef(false);
  const isInitialLoad = useRef(true);

  const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 10);

  const createAccess = checkActionAccess("invitePackages", "create");
  const updateAccess = checkActionAccess("invitePackages", "update");
  const deleteAccess = checkActionAccess("invitePackages", "delete");
  const readAccess = checkActionAccess("invitePackages", "read");

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchPackages = useCallback(async (
    page = pagination.page,
    search = debouncedSearchTerm,
    resetLoading = true
  ) => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    if (resetLoading) setLoading(true);

    try {
      const company = JSON.parse(localStorage.getItem("company"));
      const params = new URLSearchParams({ page: page.toString(), limit: pagination.limit.toString() });
      if (search) params.append("search", search);

      const response = await apiCall(`/company/invites/package-list?${params.toString()}`, 'GET', null, company?.id);
      if (!response.ok) throw new Error("Failed to fetch packages");

      const result = await response.json();
      if (result.success) {
        setPackages((result.data || []).map(normalizePackageRecord));
        const meta = result.meta;
        updatePagination({
          page: meta?.page || page,
          limit: meta?.limit || pagination.limit,
          total: meta?.total || 0,
          total_pages: meta?.total_pages || 1,
          is_last_page: meta?.is_last_page || (page >= meta?.total_pages)
        });
      } else {
        throw new Error(result.message || "Failed to fetch packages");
      }
    } catch (err) {
      toast.error(err.message || "Failed to load packages.");
      console.error("Error fetching packages:", err);
    } finally {
      setLoading(false);
      fetchInProgress.current = false;
      isInitialLoad.current = false;
    }
  }, [pagination.limit, pagination.page, updatePagination, debouncedSearchTerm]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Initial load
  useEffect(() => {
    fetchPackages(1, "", true);
  }, []);

  // Re-fetch on search change
  useEffect(() => {
    if (!isInitialLoad.current) {
      if (pagination.page !== 1) goToPage(1);
      else fetchPackages(1, debouncedSearchTerm, true);
    }
  }, [debouncedSearchTerm]);

  // ── Pagination ─────────────────────────────────────────────────────────────

  const handlePageChange = useCallback((newPage) => {
    if (newPage !== pagination.page) {
      goToPage(newPage);
      fetchPackages(newPage, debouncedSearchTerm, true);
    }
  }, [pagination.page, goToPage, fetchPackages, debouncedSearchTerm]);

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const handleCreateSuccess = () => {
    fetchPackages(1, debouncedSearchTerm, true);
    setIsCreateModalOpen(false);
  };

  const handleEditClick = (pkg) => {
    if (updateAccess.disabled) return;
    setEditingPackage(pkg);
    setIsEditModalOpen(true);
    setActiveActionMenu(null);
  };

  const handleEditSuccess = () => {
    fetchPackages(pagination.page, debouncedSearchTerm, false);
    setIsEditModalOpen(false);
    setEditingPackage(null);
  };

  const handleDelete = async (packageId) => {
    setProcessingId(packageId);
    try {
      const company = JSON.parse(localStorage.getItem("company"));
      const response = await apiCall('/company/invites/package-delete', 'DELETE', { package_id: packageId }, company?.id);
      const result = await response.json();
      if (result.success) {
        toast.success("Package deleted successfully!");
        fetchPackages(pagination.page, debouncedSearchTerm, false);
        closeModal();
      } else {
        throw new Error(result.message || "Delete failed");
      }
    } catch (err) {
      toast.error(err.message || "Failed to delete package");
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleStatus = async (packageId, newStatus) => {
    setProcessingId(packageId);
    try {
      const company = JSON.parse(localStorage.getItem("company"));
      const response = await apiCall(
        '/company/invites/package-update', 'PUT',
        { package_id: packageId, is_active: newStatus },
        company?.id
      );
      const result = await response.json();
      if (result.success) {
        toast.success(`Package ${newStatus ? 'activated' : 'deactivated'} successfully!`);
        fetchPackages(pagination.page, debouncedSearchTerm, false);
        closeModal();
      } else {
        throw new Error(result.message || "Status update failed");
      }
    } catch (err) {
      toast.error(err.message || "Failed to update package status");
    } finally {
      setProcessingId(null);
    }
  };

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openModal = (pkg, type) => {
    setSelectedPackage(pkg);
    setModalType(type);
    setActiveActionMenu(null);
  };

  const openToggleModal = (pkg, newStatus) => {
    setSelectedPackage(pkg);
    setToggleNewStatus(newStatus);
    setModalType("toggle");
    setActiveActionMenu(null);
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedPackage(null);
  };

  // ── Responsive columns ─────────────────────────────────────────────────────

  const [visibleColumns, setVisibleColumns] = useState(() => getVisibleColumns(window.innerWidth));

  useEffect(() => {
    let t;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => setVisibleColumns(getVisibleColumns(window.innerWidth)), 150);
    };
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(t); window.removeEventListener("resize", onResize); };
  }, []);

  if (isInitialLoad.current && loading) return <Skeleton />;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto">

        {/* ── Page Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                <FaBox size={11} />
                Invite management
              </div>
              <div>
                <h1 className="mt-1 text-lg font-bold text-slate-900 md:text-xl">
                  Invite Packages
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Manage invite package templates, permissions, and package-level settings from one place.
                </p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-3 justify-end">
              <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm">
                <FaBox className="h-4 w-4 text-indigo-500" />
                <span className="font-medium text-gray-700">{pagination.total}</span>
                <span className="text-gray-500">packages</span>
              </div>

              <RefreshButton loading={loading} onClick={() => fetchPackages(pagination.page, debouncedSearchTerm, true)}>
                Refresh
              </RefreshButton>

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => !createAccess.disabled && setIsCreateModalOpen(true)}
                disabled={createAccess.disabled}
                title={createAccess.disabled ? getAccessMessage(createAccess) : ""}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2 font-bold text-white shadow-lg transition-all duration-300 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FaPlus className="h-4 w-4" />
                Create
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ── Filter / View Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6"
        >
          <div className="relative flex-1 w-full">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              placeholder="Search by name, code, or designation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm min-h-[42px]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <FaTimes size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="indigo" />
          </div>
        </motion.div>

        {/* ── Loading skeleton ── */}
        {loading && !packages.length && <Skeleton />}

        {/* ── Empty State ── */}
        {!loading && packages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 bg-white rounded-xl shadow-xl"
          >
            <FaBox className="text-8xl text-gray-300 mx-auto mb-4" />
            <p className="text-xl text-gray-500">No packages found</p>
            <p className="text-gray-400 mt-2">
              {searchTerm ? "Try adjusting your search" : "Create your first invite package to get started"}
            </p>
            {!createAccess.disabled && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
              >
                Create Package
              </button>
            )}
          </motion.div>
        )}

        {/* ── Table View ── */}
        {!loading && packages.length > 0 && viewMode === "table" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-xl overflow-hidden"
          >
            <div className="overflow-hidden">
              <table className="w-full table-fixed text-sm text-left text-gray-700">
                <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 uppercase text-xs xsm:hidden">
                  <tr>
                    {visibleColumns.showCode && <th className="px-4 lg:px-6 py-4">Code</th>}
                    {visibleColumns.showName && <th className="px-4 lg:px-6 py-4">Package Name</th>}
                    {visibleColumns.showDesignation && <th className="px-4 lg:px-6 py-4">Designation</th>}
                    {visibleColumns.showEmployment && <th className="px-4 lg:px-6 py-4">Employment</th>}
                    {visibleColumns.showPermissions && <th className="px-4 lg:px-6 py-4">Permissions</th>}
                    {visibleColumns.showSchedule && <th className="px-4 lg:px-6 py-4">Schedule</th>}
                    {visibleColumns.showStatus && <th className="px-4 lg:px-6 py-4">Status</th>}
                    <th className="px-2 py-4 text-right w-16"><FaCog className="text-gray-700 ml-auto mr-4" size={16} /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {packages.map((pkg, index) => {
                    const status = getStatusBadge(pkg.is_active);
                    const StatusIcon = status.icon;
                    return (
                      <motion.tr
                        key={pkg.id}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => readAccess.enabled && openModal(pkg, "view")}
                        className="cursor-pointer hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-300 align-top"
                      >
                        {visibleColumns.showCode && (
                          <td className="px-4 lg:px-6 py-4 font-mono text-xs font-medium text-gray-600">
                            <span className="block truncate">{pkg.code}</span>
                          </td>
                        )}
                        {visibleColumns.showName && (
                          <td className="px-4 lg:px-6 py-4 font-semibold text-gray-800">
                            <span className="block truncate">{pkg.name}</span>
                            {/* Salary components count hint */}
                            {pkg.salary_components?.length > 0 && (
                              <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                                <FaCoins size={8} /> {pkg.salary_components.length} components
                              </span>
                            )}
                          </td>
                        )}
                        {visibleColumns.showDesignation && (
                          <td className="px-4 lg:px-6 py-4">
                            <span className="inline-flex max-w-full truncate px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                              {formatDisplay(pkg.designation)}
                            </span>
                          </td>
                        )}
                        {visibleColumns.showEmployment && (
                          <td className="px-4 lg:px-6 py-4">
                            <div className="flex flex-wrap gap-1 min-w-0">
                              <span className="max-w-[120px] truncate px-2 py-1 bg-purple-50 text-purple-700 rounded text-[10px] sm:text-xs font-medium">
                                {formatDisplay(pkg.employment_type)}
                              </span>
                              <span className="max-w-[120px] truncate px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-[10px] sm:text-xs font-medium">
                                {formatDisplay(pkg.salary_type)}
                              </span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.showPermissions && (
                          <td className="px-4 lg:px-6 py-4">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <FaShieldAlt className="text-indigo-400 shrink-0" />
                              <span className="truncate max-w-[110px]">
                                {pkg.permission_package_name || "N/A"}
                              </span>
                            </div>
                            {pkg.permissions?.length > 0 && (
                              <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-indigo-500 font-medium">
                                <FaListUl size={8} /> {pkg.permissions.length} permissions
                              </span>
                            )}
                          </td>
                        )}
                        {visibleColumns.showSchedule && (
                          <td className="px-4 lg:px-6 py-4">
                            <div className="flex flex-col gap-1 text-xs text-gray-600">
                              <div className="flex items-center gap-1.5">
                                <FaClock className="text-orange-400 shrink-0" />
                                <span className="whitespace-nowrap">
                                  {pkg.shift_start} - {pkg.shift_end}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                <span>Break {formatDurationDisplay(pkg.break_minutes)}</span>
                                <span>·</span>
                                <span>Grace {formatDurationDisplay(pkg.grace_minutes)}</span>
                              </div>
                              {pkg.weekends?.length > 0 && (
                                <div className="text-[10px] text-gray-500 font-medium">
                                  {pkg.weekends.length} Off Day{pkg.weekends.length !== 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          </td>
                        )}
                        {visibleColumns.showStatus && (
                          <td className="px-4 lg:px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium border ${status.className}`}>
                              <StatusIcon size={12} />{status.text}
                            </span>
                          </td>
                        )}
                        <td className="px-2 py-4 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                          <ActionMenu
                            menuId={pkg.id}
                            activeId={activeActionMenu}
                            onToggle={(e, id) => setActiveActionMenu(prev => prev === id ? null : id)}
                            actions={[
                              {
                                label: 'View Details',
                                icon: <FaEye size={14} />,
                                onClick: () => openModal(pkg, "view"),
                                className: 'text-green-600 hover:text-green-700 hover:bg-green-50'
                              },
                              {
                                label: 'Edit',
                                icon: <FaEdit size={14} />,
                                onClick: () => handleEditClick(pkg),
                                disabled: updateAccess.disabled,
                                title: updateAccess.disabled ? getAccessMessage(updateAccess) : "",
                                className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                              },
                              {
                                label: pkg.is_active ? 'Deactivate' : 'Activate',
                                icon: pkg.is_active ? <FaToggleOff size={14} /> : <FaToggleOn size={14} />,
                                onClick: () => openToggleModal(pkg, !pkg.is_active),
                                disabled: updateAccess.disabled,
                                title: updateAccess.disabled ? getAccessMessage(updateAccess) : "",
                                className: pkg.is_active ? 'text-amber-600 hover:text-amber-700' : 'text-green-600 hover:text-green-700'
                              },
                              
                              {
                                label: 'Delete',
                                icon: <FaTrash size={14} />,
                                onClick: () => openModal(pkg, "delete"),
                                disabled: deleteAccess.disabled,
                                title: deleteAccess.disabled ? getAccessMessage(deleteAccess) : "",
                                className: 'text-red-600 hover:text-red-700 hover:bg-red-50'
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

        {/* ── Card View ── */}
        {!loading && packages.length > 0 && viewMode === "card" && (
          <ManagementGrid viewMode={viewMode}>
            {packages.map((pkg, index) => {
              const status = getStatusBadge(pkg.is_active);
              const StatusIcon = status.icon;
              return (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => readAccess.enabled && openModal(pkg, "view")}
                  className="bg-white rounded-xl shadow-md border border-gray-100 p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl shrink-0">
                      <FaBox className="text-white text-2xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg text-gray-800 truncate">{pkg.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${status.className}`}>
                          <StatusIcon size={10} />{status.text}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-mono mt-1 bg-gray-50 px-2 py-1 rounded-lg inline-block">{pkg.code}</p>

                      <div className="mt-3 space-y-2">
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <FaUserTie className="text-indigo-500" />{formatDisplay(pkg.designation)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full">{formatDisplay(pkg.employment_type)}</span>
                          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">{formatDisplay(pkg.salary_type)}</span>
                        </div>

                        {/* Permission package */}
                        {pkg.permission_package_name && (
                          <div className="flex items-center gap-1.5 text-xs text-indigo-600">
                            <FaShieldAlt size={11} />
                            <span className="truncate">{pkg.permission_package_name}</span>
                            {pkg.permissions?.length > 0 && (
                              <span className="ml-auto shrink-0 text-[10px] bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 text-indigo-500 font-bold">
                                {pkg.permissions.length} perms
                              </span>
                            )}
                          </div>
                        )}

                        {/* Salary components summary */}
                        {pkg.salary_components?.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                            <FaCoins size={11} />
                            <span>
                              {pkg.salary_components.filter(c => c.component_type === "earning").length} earnings,&nbsp;
                              {pkg.salary_components.filter(c => c.component_type === "deduction").length} deductions
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-gray-100 flex-wrap gap-1">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <FaClock className="text-yellow-500" />{pkg.shift_start} - {pkg.shift_end}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <FaClock className="text-amber-500" />Break {formatDurationDisplay(pkg.break_minutes)}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <FaClock className="text-rose-500" />Grace {formatDurationDisplay(pkg.grace_minutes)}
                          </span>
                        </div>

                        {/* Weekend pills preview */}
                        {pkg.weekends?.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {pkg.weekends.map((day) => (
                              <span key={day} className="capitalize text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full font-medium">
                                {day}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card actions */}
                  <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openModal(pkg, "view")}
                      className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition" title="View">
                      <FaEye size={14} />
                    </button>
                    <button
                      onClick={() => openToggleModal(pkg, !pkg.is_active)}
                      disabled={updateAccess.disabled}
                      title={updateAccess.disabled ? getAccessMessage(updateAccess) : (pkg.is_active ? "Deactivate" : "Activate")}
                      className={`p-2.5 rounded-xl transition disabled:opacity-50 ${pkg.is_active
                        ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                    >
                      {pkg.is_active ? <FaToggleOff size={14} /> : <FaToggleOn size={14} />}
                    </button>
                    <button
                      onClick={() => handleEditClick(pkg)}
                      disabled={updateAccess.disabled}
                      title={updateAccess.disabled ? getAccessMessage(updateAccess) : "Edit"}
                      className="p-2.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition disabled:opacity-50"
                    >
                      <FaEdit size={14} />
                    </button>
                    <button
                      onClick={() => openModal(pkg, "delete")}
                      disabled={deleteAccess.disabled}
                      title={deleteAccess.disabled ? getAccessMessage(deleteAccess) : "Delete"}
                      className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition disabled:opacity-50"
                    >
                      <FaTrash size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </ManagementGrid>
        )}

        {/* ── Pagination ── */}
        {!loading && (packages.length > 0 || pagination.total > 0) && (
          <Pagination
            currentPage={pagination.page}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={handlePageChange}
            onLimitChange={(newLimit) => { changeLimit(newLimit); fetchPackages(1, debouncedSearchTerm, true); }}
            showInfo={true}
          />
        )}

        {/* ── Modals ── */}
        <AnimatePresence>
          {modalType === "view" && selectedPackage && (
            <ViewPackageModal
              isOpen={true}
              onClose={closeModal}
              package={selectedPackage}
              onEdit={() => { closeModal(); handleEditClick(selectedPackage); }}
              onDelete={() => { closeModal(); openModal(selectedPackage, "delete"); }}
              onToggleStatus={() => { closeModal(); openToggleModal(selectedPackage, !selectedPackage.is_active); }}
              updateAccess={updateAccess}
              deleteAccess={deleteAccess}
              getAccessMessage={getAccessMessage}
            />
          )}
          {modalType === "delete" && selectedPackage && (
            <DeletePackageModal
              isOpen={true} onClose={closeModal} onConfirm={handleDelete}
              package={selectedPackage} processing={processingId === selectedPackage.id}
            />
          )}
          {modalType === "toggle" && selectedPackage && (
            <ToggleStatusModal
              isOpen={true} onClose={closeModal} onConfirm={handleToggleStatus}
              package={selectedPackage} processing={processingId === selectedPackage.id}
              newStatus={toggleNewStatus}
            />
          )}
        </AnimatePresence>

        <PackageFormModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleCreateSuccess}
          packageData={null}
          isEditing={false}
          submitDisabled={createAccess.disabled}
          submitTitle={createAccess.disabled ? getAccessMessage(createAccess) : ""}
        />

        <PackageFormModal
          isOpen={isEditModalOpen}
          onClose={() => { setIsEditModalOpen(false); setEditingPackage(null); }}
          onSuccess={handleEditSuccess}
          packageData={editingPackage}
          isEditing={true}
          submitDisabled={updateAccess.disabled}
          submitTitle={updateAccess.disabled ? getAccessMessage(updateAccess) : ""}
        />
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}