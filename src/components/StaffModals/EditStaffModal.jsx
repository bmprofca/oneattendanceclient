import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Select from "../SelectField";
import { toast } from "react-toastify";
import apiCall from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import {
  FaUserPlus,
  FaUserTag,
  FaUserCog,
  FaTimes,
  FaCheck,
  FaSpinner,
  FaUserCircle,
  FaBriefcase,
  FaClock,
  FaShieldAlt,
  FaUserTie,
  FaFingerprint,
  FaCalendarAlt,
  FaSearch,
  FaEnvelope,
  FaPhone,
  FaRegCheckCircle,
  FaListAlt,
  FaChevronDown,
  FaChevronUp,
  FaSave,
  FaPlus,
} from "react-icons/fa";
import TimeDurationPickerField from "../TimeDurationPicker";
import ModalScrollLock from "../ModalScrollLock";
import Modal from "../Modal";
import ProfileAvatar from "../common/ProfileAvatar";
import AdvancedDateFilter from "../AdvancedDateFilter";
import CurrencyIcon from "../common/CurrencyIcon";

const ATTENDANCE_LABELS = {
  manual: "Manual",
  gps: "GPS",
  face: "Face Recognition",
  qr: "QR Code",
  fingerprint: "Fingerprint",
  ip: "IP Address",
};

const DEFAULT_SHIFT_START = "09:00:00";
const DEFAULT_SHIFT_END = "18:00:00";
const DEFAULT_DURATION = "00:30";

const normalizeDate = (value) => (value ? String(value).split("T")[0] : "");

const getMonthYearValue = (value) =>
  value
    ? {
        month: parseInt(String(value).split("-")[1], 10),
        year: parseInt(String(value).split("-")[0], 10),
      }
    : null;

const monthYearToDate = (value) =>
  value && value.month && value.year ? `${value.year}-${String(value.month).padStart(2, "0")}-01` : "";

const normalizeDuration = (value, fallback = DEFAULT_DURATION) => {
  if (typeof value === "number") {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  if (!value || typeof value !== "string") return fallback;
  const [hours = "00", minutes = "00"] = value.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
};

const getOptionValue = (value) => {
  if (value && typeof value === "object") return value.value ?? value.id ?? "";
  return value ?? "";
};

const getOptionLabel = (value) => {
  if (value && typeof value === "object") return value.label ?? value.name ?? value.value ?? "";
  return value ?? "";
};

const normalizeAttendanceMethods = (methods = []) =>
  (Array.isArray(methods) ? methods : [])
    .map((item) => {
      if (typeof item === "string") return item.toLowerCase();
      if (item && typeof item === "object") return String(item.method || item.value || "").toLowerCase();
      return "";
    })
    .filter(Boolean);

const normalizeWeekends = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => {
      if (typeof item === "string") return item.toLowerCase();
      if (item && typeof item === "object") return String(item.day || item.value || "").toLowerCase();
      return "";
    })
    .filter(Boolean);

function EditStaffModal({ isOpen, onClose, onSuccess, staffData, submitDisabled = false, submitTitle = "" }) {
  const { attendanceMethods: companyAttendanceMethods = [] } = useAuth();

  const [permissionPackages, setPermissionPackages] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [salaryTypes, setSalaryTypes] = useState([]);

  const [emailQuery, setEmailQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [designation, setDesignation] = useState(null);
  const [selectedPermissionPackage, setSelectedPermissionPackage] = useState(null);
  const [staffType, setStaffType] = useState(null);
  const [employmentType, setEmploymentType] = useState(null);
  const [selectedAttendanceMethods, setSelectedAttendanceMethods] = useState([]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [enableOvertime, setEnableOvertime] = useState(true);
  const [enableDeduction, setEnableDeduction] = useState(true);
  const [shiftStart, setShiftStart] = useState(DEFAULT_SHIFT_START);
  const [shiftEnd, setShiftEnd] = useState(DEFAULT_SHIFT_END);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_DURATION);
  const [graceMinutes, setGraceMinutes] = useState(DEFAULT_DURATION);
  const [weekends, setWeekends] = useState([]);
  const [baseAmount, setBaseAmount] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [salaryComponents, setSalaryComponents] = useState([]);
  const [availableSalaryComponents, setAvailableSalaryComponents] = useState([]);
  const [isLoadingSalaryComponents, setIsLoadingSalaryComponents] = useState(false);
  const [salaryPackages, setSalaryPackages] = useState([]);
  const [selectedSalaryPackageId, setSelectedSalaryPackageId] = useState("");
  const [isLoadingSalaryPackages, setIsLoadingSalaryPackages] = useState(false);

  const [invitePackages, setInvitePackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);

  // Collapsible states matching AddStaffModal
  const [isInvitePackageOpen, setIsInvitePackageOpen] = useState(false);
  const [isRoleFieldsOpen, setIsRoleFieldsOpen] = useState(true);
  const [isSalaryDetailsOpen, setIsSalaryDetailsOpen] = useState(false);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const [isSalaryComponentDropdownOpen, setIsSalaryComponentDropdownOpen] = useState(false);

  // Interaction state for error display (like AddStaffModal)
  const [formInteracted, setFormInteracted] = useState(false);

  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [isLoadingConstants, setIsLoadingConstants] = useState(false);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const constantsRequestRef = useRef(false);
  const permissionPackagesRequestRef = useRef(false);
  const invitePackagesRequestRef = useRef(false);
  const salaryPackagesRequestRef = useRef(false);
  const salaryComponentsRequestRef = useRef(false);

  const companyAttendanceMethodList = useMemo(() => {
    let methods = companyAttendanceMethods;
    if (!methods) return [];
    if (typeof methods === "string") {
      methods = methods.includes(",") ? methods.split(",").map((m) => m.trim()) : [methods];
    }
    if (!Array.isArray(methods)) return [];
    return methods
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          return String(item.method || item.value || "").toLowerCase();
        }
        return String(item || "").toLowerCase();
      })
      .filter(Boolean);
  }, [companyAttendanceMethods]);

  const getIconForType = (key) => {
    const iconMap = {
      FULL_TIME: FaClock,
      PART_TIME: FaClock,
      CONTRACT: FaBriefcase,
      INTERN: FaUserTag,
      FREELANCER: FaBriefcase,
      ADMIN: FaUserCog,
      HR_MANAGER: FaUserCog,
      HR_EXECUTIVE: FaUserCog,
      MANAGER: FaUserTie,
      SUPERVISOR: FaUserTag,
      TEAM_LEAD: FaUserTag,
      SENIOR_EMPLOYEE: FaUserCircle,
      HOURLY: FaClock,
      MONTHLY: FaCalendarAlt,
    };
    return iconMap[key] || FaUserCircle;
  };

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
      padding: "0 0.5rem",
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
      "&:active": { backgroundColor: "#6366f1" },
    }),
    multiValue: (base) => ({ ...base, backgroundColor: "#e0e7ff", borderRadius: "0.5rem" }),
    multiValueLabel: (base) => ({ ...base, color: "#4f46e5" }),
    multiValueRemove: (base) => ({
      ...base,
      color: "#4f46e5",
      "&:hover": { backgroundColor: "#4f46e5", color: "white" },
    }),
  };

  useEffect(() => {
    if (!isOpen) return;
    loadStaffData();
  }, [isOpen, staffData]);

  useEffect(() => {
    if (!isOpen) return;
    if (staffData?.user?.email) {
      setEmailQuery(staffData.user.email);
    }
  }, [isOpen, staffData]);

  // Interaction aware select styles (red only after formInteracted and value missing)
  const getSelectStyles = (value) => ({
    ...customSelectStyles,
    control: (base, state) => ({
      ...customSelectStyles.control(base, state),
      borderColor: formInteracted && !value ? '#f87171' : state.isFocused ? '#6366f1' : '#e2e8f0',
      backgroundColor: formInteracted && !value ? '#fef2f2' : '#f9fafb',
      boxShadow: formInteracted && !value
        ? '0 0 0 1px rgba(248, 113, 113, 0.5)'
        : state.isFocused
        ? '0 0 0 4px rgba(99, 102, 241, 0.1)'
        : 'none',
      '&:hover': {
        borderColor: formInteracted && !value ? '#f87171' : '#cbd5e1'
      }
    })
  });

  // Interaction aware input class
  const getInputClass = (value, defaultClasses) => {
    const isInvalid = !value || String(value).trim() === '';
    return `${defaultClasses} ${
      formInteracted && isInvalid
        ? 'border-red-400 bg-red-50/10 ring-1 ring-red-400/50 focus:border-red-500 focus:ring-red-500/20'
        : 'border-slate-200 bg-white focus:border-indigo-500 focus:ring-indigo-500/10'
    }`;
  };

  // Section red border helper (matching AddStaffModal)
  const hasRoleError = !designation || !selectedPermissionPackage || !employmentType || !staffType;
  const hasSalaryError = !baseAmount || !effectiveFrom;
  const hasAttendanceError = selectedAttendanceMethods.length === 0;
  const hasShiftError = !shiftStart || !shiftEnd;

  const sectionClass = (section, baseClasses = "rounded-xl border bg-white p-4") => {
    const error =
      (section === "role" && hasRoleError) ||
      (section === "salary" && hasSalaryError) ||
      (section === "attendance" && hasAttendanceError) ||
      (section === "shift" && hasShiftError);
    return `${baseClasses} ${formInteracted && error ? "border-red-400 ring-1 ring-red-400" : "border-slate-200"}`;
  };

  const toggleAttendanceMethod = (method) => {
    setSelectedAttendanceMethods((prev) =>
      prev.includes(method) ? prev.filter((item) => item !== method) : [...prev, method]
    );
    setFormInteracted(true);
  };

  const toggleWeekend = (day) => {
    setWeekends((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
    setFormInteracted(true);
  };

  const fetchAllConstants = async () => {
    if ((employmentTypes.length && designations.length && salaryTypes.length) || isLoadingConstants || constantsRequestRef.current) return;
    constantsRequestRef.current = true;
    setIsLoadingConstants(true);
    try {
      const company = JSON.parse(localStorage.getItem("company"));
      const res = await apiCall("/constants/", "GET", null, company?.id);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to fetch configuration data");
      if (data.data.employment_types) {
        setEmploymentTypes(
          data.data.employment_types.map((item) => ({
            value: item.value.value,
            key: item.key,
            label: item.value.label,
            description: item.value.description,
            icon: getIconForType(item.key),
          }))
        );
      }
      if (data.data.designations) {
        setDesignations(
          data.data.designations.map((item) => ({
            value: item.value.value,
            key: item.key,
            label: item.value.label,
            description: item.value.description,
            icon: getIconForType(item.key),
          }))
        );
      }
      if (data.data.salary_types) {
        setSalaryTypes(
          data.data.salary_types.map((item) => ({
            value: item.value.value,
            key: item.key,
            label: item.value.label,
            description: item.value.description,
            icon: getIconForType(item.key),
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch constants", err);
      toast.error(err.message || "Failed to fetch configuration data");
    } finally {
      constantsRequestRef.current = false;
      setIsLoadingConstants(false);
    }
  };

  const fetchPermissionPackages = async () => {
    if (permissionPackages.length || isLoadingPermissions || permissionPackagesRequestRef.current) return;
    permissionPackagesRequestRef.current = true;
    setIsLoadingPermissions(true);
    try {
      const company = JSON.parse(localStorage.getItem("company"));
      const response = await apiCall("/permissions/permission-packages", "GET", null, company?.id);
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || "Failed to fetch permission packages");
      const packages = result.data?.packages || [];
      setPermissionPackages(
        packages.map((pkg) => ({
          value: pkg.id,
          label: pkg.package_name,
          description: pkg.description,
          groupCode: pkg.group_code,
          permissions: pkg.permissions?.filter((p) => p.is_active === 1) || [],
          isActive: pkg.is_active === 1,
        }))
      );
    } catch (err) {
      console.error("Permission packages error", err);
      toast.error(err.message || "Failed to fetch permission packages");
    } finally {
      permissionPackagesRequestRef.current = false;
      setIsLoadingPermissions(false);
    }
  };

  const resolveUserPayload = (result) => {
    const direct = result?.data;
    if (Array.isArray(direct)) return direct[0] || null;
    if (direct?.data) return direct.data;
    if (direct?.user) return direct.user;
    if (result?.user) return result.user;
    return direct || null;
  };

  const getResolvedUserId = (user) => user?.id ?? user?.user_id ?? user?.userId ?? user?.staff_id ?? user?.staffId ?? null;
  const getResolvedUserName = (user) =>
    user?.name ||
    user?.full_name ||
    user?.fullName ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    user?.email ||
    "No Name";

  const loadStaffData = () => {
    if (!staffData) return;
    setIsLoadingStaff(true);
    try {
      if (staffData.user) {
        setSelectedUser({
          id: getResolvedUserId(staffData.user),
          full_name: getResolvedUserName(staffData.user),
          email: staffData.user.email,
          phone: staffData.user.phone || null,
          profile_picture: staffData.user.profile_picture || null,
          is_active: staffData.user.is_active,
          created_at: staffData.user.created_at || null,
        });
      } else if (staffData.user_id) {
        setSelectedUser({
          id: staffData.user_id,
          full_name: staffData.user_name || staffData.name || `User #${staffData.user_id}`,
          email: staffData.email || "",
          phone: staffData.phone || null,
          profile_picture: staffData.profile_picture || null,
          is_active: staffData.is_active,
          created_at: staffData.created_at || null,
        });
      }

      const designationValue = getOptionValue(staffData.designation);
      if (designationValue) {
        const found = designations.find((d) => d.value === designationValue);
        setDesignation(
          found || {
            value: designationValue,
            label: getOptionLabel(staffData.designation) || formatDisplay(designationValue),
          }
        );
      }

      const employmentTypeValue = getOptionValue(staffData.employment_type);
      if (employmentTypeValue) {
        const found = employmentTypes.find((e) => e.value === employmentTypeValue);
        setEmploymentType(
          found || {
            value: employmentTypeValue,
            label: getOptionLabel(staffData.employment_type) || formatDisplay(employmentTypeValue),
          }
        );
      }

      const salaryTypeValue = getOptionValue(staffData.salary_type);
      if (salaryTypeValue) {
        const found = salaryTypes.find((s) => s.value === salaryTypeValue);
        setStaffType(
          found || {
            value: salaryTypeValue,
            label: getOptionLabel(staffData.salary_type) || formatDisplay(salaryTypeValue),
          }
        );
      }

      const permissionPackageId = staffData.permission_package?.id ?? staffData.permission_package_id ?? null;
      if (permissionPackageId) {
        const found = permissionPackages.find((p) => p.value === permissionPackageId);
        setSelectedPermissionPackage(
          found || {
            value: permissionPackageId,
            label: staffData.permission_package?.name || staffData.permission_package_name || `Package ${permissionPackageId}`,
          }
        );
      }

      if (Array.isArray(staffData.attendance_methods)) {
        setSelectedAttendanceMethods(normalizeAttendanceMethods(staffData.attendance_methods));
      }

      if (typeof staffData.auto_approve !== "undefined") {
        setAutoApprove(Boolean(staffData.auto_approve));
      } else {
        setAutoApprove(false);
      }
      setEnableOvertime(staffData.enable_overtime !== undefined ? Boolean(staffData.enable_overtime) : true);
      setEnableDeduction(staffData.enable_deduction !== undefined ? Boolean(staffData.enable_deduction) : true);

      setShiftStart(staffData.shift_start || DEFAULT_SHIFT_START);
      setShiftEnd(staffData.shift_end || DEFAULT_SHIFT_END);
      setBreakMinutes(normalizeDuration(staffData.break_minutes));
      setGraceMinutes(normalizeDuration(staffData.grace_minutes));
      setWeekends(normalizeWeekends(staffData.weekends));
      setBaseAmount(staffData.base_amount === null || typeof staffData.base_amount === "undefined" ? "" : String(staffData.base_amount));
      setEffectiveFrom(normalizeDate(staffData.effective_from));
      setEffectiveTo(normalizeDate(staffData.effective_to));
      setJoiningDate(normalizeDate(staffData.joining_date));
      setSalaryComponents(normalizeSalaryComponents(staffData.salary_components || staffData.components || []));
      setSelectedSalaryPackageId("");

      // Open relevant sections if data present (similar to Add)
      setIsRoleFieldsOpen(true);
      setIsSalaryDetailsOpen(staffData.base_amount || staffData.effective_from || (Array.isArray(staffData.salary_components) && staffData.salary_components.length > 0));
      setIsAttendanceOpen(Array.isArray(staffData.attendance_methods) && staffData.attendance_methods.length > 0);
      setIsShiftOpen(staffData.shift_start || staffData.shift_end || Array.isArray(staffData.weekends) && staffData.weekends.length > 0);
    } catch (err) {
      console.error("Error loading staff data:", err);
      toast.error("Failed to load staff data");
    } finally {
      setIsLoadingStaff(false);
    }
  };

  const normalizeSalaryComponents = (components = []) =>
    components
      .map((component) => ({
        component_id: component.component_id ?? component.id,
        component_name: component.component_name || component.name || "",
        component_code: component.component_code || component.code || "",
        calc_type: component.calc_type || "percentage",
        calc_value: component.calc_value === null || typeof component.calc_value === "undefined" ? "" : String(component.calc_value),
        effective_from: normalizeDate(component.effective_from),
        effective_to: normalizeDate(component.effective_to),
        reason: component.reason || component.remark || "",
      }))
      .filter((component) => component.component_id);

  const fetchSalaryComponents = async () => {
    if (availableSalaryComponents.length || isLoadingSalaryComponents || salaryComponentsRequestRef.current) return;
    salaryComponentsRequestRef.current = true;
    setIsLoadingSalaryComponents(true);
    try {
      const company = JSON.parse(localStorage.getItem("company"));
      const response = await apiCall("/salary/components/list", "GET", null, company?.id);
      const result = await response.json();
      if (result.success) setAvailableSalaryComponents(result.data || []);
    } catch (err) {
      console.error("Failed to fetch salary components", err);
    } finally {
      salaryComponentsRequestRef.current = false;
      setIsLoadingSalaryComponents(false);
    }
  };

  const fetchSalaryPackages = async () => {
    if (salaryPackages.length || isLoadingSalaryPackages || salaryPackagesRequestRef.current) return;
    salaryPackagesRequestRef.current = true;
    setIsLoadingSalaryPackages(true);
    try {
      const company = JSON.parse(localStorage.getItem("company"));
      const response = await apiCall("/salary/components/packages", "GET", null, company?.id);
      const result = await response.json();
      if (result.success) setSalaryPackages(result.data || []);
    } catch (err) {
      console.error("Failed to fetch salary packages", err);
    } finally {
      salaryPackagesRequestRef.current = false;
      setIsLoadingSalaryPackages(false);
    }
  };

  const fetchInvitePackages = async () => {
    if (invitePackages.length || isLoadingPackages || invitePackagesRequestRef.current) return;
    invitePackagesRequestRef.current = true;
    setIsLoadingPackages(true);
    try {
      const company = JSON.parse(localStorage.getItem("company"));
      const res = await apiCall("/company/invites/package-list", "GET", null, company?.id);
      const data = await res.json();
      if (data.success) {
        setInvitePackages(
          (data.data || [])
            .filter((pkg) => pkg.is_active)
            .map((pkg) => ({
              ...pkg,
              value: pkg.id,
              label: `${pkg.name} (${pkg.code})`,
            }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch invite packages", err);
    } finally {
      invitePackagesRequestRef.current = false;
      setIsLoadingPackages(false);
    }
  };

  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
    if (!pkg) return;

    if (pkg.designation) {
      const designationValue = getOptionValue(pkg.designation);
      const found = designations.find((d) => d.value === designationValue);
      setDesignation(found || { value: designationValue, label: getOptionLabel(pkg.designation) || formatDisplay(designationValue) });
    }

    if (pkg.employment_type) {
      const employmentTypeValue = getOptionValue(pkg.employment_type);
      const found = employmentTypes.find((e) => e.value === employmentTypeValue);
      setEmploymentType(found || { value: employmentTypeValue, label: getOptionLabel(pkg.employment_type) || formatDisplay(employmentTypeValue) });
    }

    if (pkg.salary_type) {
      const salaryTypeValue = getOptionValue(pkg.salary_type);
      const found = salaryTypes.find((s) => s.value === salaryTypeValue);
      setStaffType(found || { value: salaryTypeValue, label: getOptionLabel(pkg.salary_type) || formatDisplay(salaryTypeValue) });
    }

    if (pkg.permission_package_id) {
      const found = permissionPackages.find((p) => p.value === pkg.permission_package_id);
      setSelectedPermissionPackage(
        found || {
          value: pkg.permission_package_id,
          label: pkg.permission_package_name || `Package ${pkg.permission_package_id}`,
        }
      );
    }

    if (Array.isArray(pkg.attendance_methods)) {
      setSelectedAttendanceMethods(normalizeAttendanceMethods(pkg.attendance_methods));
    }

    if (typeof pkg.auto_approve !== "undefined") {
      setAutoApprove(Boolean(pkg.auto_approve));
    }
    if (typeof pkg.enable_overtime !== "undefined") {
      setEnableOvertime(Boolean(pkg.enable_overtime));
    }
    if (typeof pkg.enable_deduction !== "undefined") {
      setEnableDeduction(Boolean(pkg.enable_deduction));
    }

    if (pkg.shift_start) setShiftStart(pkg.shift_start);
    if (pkg.shift_end) setShiftEnd(pkg.shift_end);
    if (typeof pkg.break_minutes !== "undefined") {
      setBreakMinutes(normalizeDuration(pkg.break_minutes));
    }
    if (typeof pkg.grace_minutes !== "undefined") {
      setGraceMinutes(normalizeDuration(pkg.grace_minutes));
    }

    if (Array.isArray(pkg.weekends)) {
      setWeekends(pkg.weekends.map((w) => (typeof w === "object" ? w.day : w)));
    }

    if (typeof pkg.base_amount !== "undefined") setBaseAmount(String(pkg.base_amount || ""));
    if (pkg.effective_from) setEffectiveFrom(normalizeDate(pkg.effective_from));
    if (typeof pkg.effective_to !== "undefined") setEffectiveTo(normalizeDate(pkg.effective_to));
    if (typeof pkg.joining_date !== "undefined") setJoiningDate(normalizeDate(pkg.joining_date));

    const packageComponents = pkg.salary_components || pkg.components || [];
    if (Array.isArray(packageComponents)) {
      setSalaryComponents(normalizeSalaryComponents(packageComponents));
      setSelectedSalaryPackageId("");
    }

    toast.info(`Applied details from ${pkg.name}`);
  };

  const methodBadges = companyAttendanceMethodList.length
    ? companyAttendanceMethodList.map((method) => ({
        key: method,
        label: ATTENDANCE_LABELS[method] || formatDisplay(method),
      }))
    : selectedAttendanceMethods.map((method) => ({
        key: method,
        label: ATTENDANCE_LABELS[method] || formatDisplay(method),
      }));

  const showInviteFields = Boolean(selectedUser || staffData);

  const initialInviteState = useMemo(() => {
    const initialUserId = getResolvedUserId(staffData?.user) ?? staffData?.user_id ?? null;
    const initialPermissionPackageId = staffData?.permission_package?.id ?? staffData?.permission_package_id ?? null;
    const initialAttendanceMethods = normalizeAttendanceMethods(staffData?.attendance_methods).sort();

    return {
      userId: initialUserId,
      designation: getOptionValue(staffData?.designation) || null,
      employmentType: getOptionValue(staffData?.employment_type) || null,
      salaryType: getOptionValue(staffData?.salary_type) || null,
      permissionPackageId: initialPermissionPackageId,
      attendanceMethods: initialAttendanceMethods,
      autoApprove: Boolean(staffData?.auto_approve),
      enableOvertime: staffData?.enable_overtime !== undefined ? Boolean(staffData.enable_overtime) : true,
      enableDeduction: staffData?.enable_deduction !== undefined ? Boolean(staffData.enable_deduction) : true,
      shiftStart: staffData?.shift_start ?? DEFAULT_SHIFT_START,
      shiftEnd: staffData?.shift_end ?? DEFAULT_SHIFT_END,
      breakMinutes: normalizeDuration(staffData?.break_minutes),
      graceMinutes: normalizeDuration(staffData?.grace_minutes),
      weekends: normalizeWeekends(staffData?.weekends).sort(),
      baseAmount: staffData?.base_amount === null || typeof staffData?.base_amount === "undefined" ? "" : String(staffData.base_amount),
      effectiveFrom: normalizeDate(staffData?.effective_from),
      effectiveTo: normalizeDate(staffData?.effective_to),
      joiningDate: normalizeDate(staffData?.joining_date) || "",
      components: normalizeSalaryComponents(staffData?.salary_components || staffData?.components || []).sort((a, b) => String(a.component_id).localeCompare(String(b.component_id))),
    };
  }, [staffData]);

  const currentAttendanceMethods = useMemo(() => [...selectedAttendanceMethods].sort(), [selectedAttendanceMethods]);
  const currentSalaryComponents = useMemo(
    () => normalizeSalaryComponents(salaryComponents).sort((a, b) => String(a.component_id).localeCompare(String(b.component_id))),
    [salaryComponents]
  );

  const isUpdateDirty = useMemo(() => {
    if (!selectedUser) return false;

    const currentPermissionPackageId = selectedPermissionPackage?.value ?? null;
    return (
      selectedUser.id !== initialInviteState.userId ||
      (designation?.value ?? null) !== initialInviteState.designation ||
      (employmentType?.value ?? null) !== initialInviteState.employmentType ||
      (staffType?.value ?? null) !== initialInviteState.salaryType ||
      currentPermissionPackageId !== initialInviteState.permissionPackageId ||
      autoApprove !== initialInviteState.autoApprove ||
      enableOvertime !== initialInviteState.enableOvertime ||
      enableDeduction !== initialInviteState.enableDeduction ||
      shiftStart !== initialInviteState.shiftStart ||
      shiftEnd !== initialInviteState.shiftEnd ||
      breakMinutes !== initialInviteState.breakMinutes ||
      graceMinutes !== initialInviteState.graceMinutes ||
      baseAmount !== initialInviteState.baseAmount ||
      effectiveFrom !== initialInviteState.effectiveFrom ||
      effectiveTo !== initialInviteState.effectiveTo ||
      joiningDate !== initialInviteState.joiningDate ||
      JSON.stringify(currentSalaryComponents) !== JSON.stringify(initialInviteState.components) ||
      JSON.stringify([...weekends].sort()) !== JSON.stringify(initialInviteState.weekends) ||
      JSON.stringify(currentAttendanceMethods) !== JSON.stringify(initialInviteState.attendanceMethods)
    );
  }, [
    selectedUser,
    selectedPermissionPackage,
    designation,
    employmentType,
    staffType,
    autoApprove,
    enableOvertime,
    enableDeduction,
    currentAttendanceMethods,
    shiftStart,
    shiftEnd,
    breakMinutes,
    graceMinutes,
    baseAmount,
    effectiveFrom,
    effectiveTo,
    joiningDate,
    currentSalaryComponents,
    weekends,
    initialInviteState,
  ]);

  const handleBaseAmountChange = (value) => {
    const nextValue = value.replace(/[^0-9.]/g, "");
    if (nextValue === "" || /^\d*\.?\d*$/.test(nextValue)) setBaseAmount(nextValue);
  };

  const updateSalaryComponent = (index, key, value) => {
    setSalaryComponents((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: value };
      return updated;
    });
    setSelectedSalaryPackageId("");
  };

  const removeSalaryComponent = (index) => {
    setSalaryComponents((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    setSelectedSalaryPackageId("");
  };

  const addSalaryComponent = (option) => {
    if (!option) return;
    const component = availableSalaryComponents.find((item) => String(item.id) === String(option.value));
    if (!component) return;
    setSalaryComponents((prev) => [
      ...prev,
      {
        component_id: component.id,
        component_name: component.name || "",
        component_code: component.code || "",
        calc_type: component.calc_type || "percentage",
        calc_value: component.calc_value === null || typeof component.calc_value === "undefined" ? "" : String(component.calc_value),
        effective_from: effectiveFrom,
        effective_to: "",
        reason: "",
      },
    ]);
    setIsSalaryComponentDropdownOpen(false);
  };

  const handleInvitePackageMenuOpen = () => {
    fetchAllConstants();
    fetchPermissionPackages();
    fetchInvitePackages();
  };

  const handleSalaryPackageMenuOpen = () => {
    fetchSalaryPackages();
  };

  const handleSalaryComponentMenuOpen = () => {
    fetchSalaryComponents();
  };

  const handleSalaryComponentsToggle = () => {
    fetchSalaryComponents();
    setIsSalaryComponentDropdownOpen((prev) => !prev);
  };

  const handleSalaryPackageChange = (option) => {
    const packageId = option?.value || "";
    setSelectedSalaryPackageId(packageId);
    if (!packageId) return;

    const salaryPackage = salaryPackages.find((pkg) => String(pkg.id) === String(packageId));
    if (!salaryPackage) return;

    setSalaryComponents(
      (salaryPackage.items || []).map((item) => ({
        component_id: item.component_id,
        component_name: item.component_name || "",
        component_code: item.component_code || "",
        calc_type: item.calc_type || "percentage",
        calc_value: parseFloat(item.calc_value || 0).toFixed(2),
        effective_from: effectiveFrom || "",
        effective_to: null,
        reason: `Default from ${salaryPackage.name} package`,
      }))
    );
  };

  const selectedSalaryComponentIds = useMemo(
    () => salaryComponents.map((component) => String(component.component_id)),
    [salaryComponents]
  );

  const salaryComponentOptions = useMemo(
    () =>
      availableSalaryComponents
        .filter((component) => !selectedSalaryComponentIds.includes(String(component.id)))
        .map((component) => ({ value: component.id, label: `${component.name} (${component.code})` })),
    [availableSalaryComponents, selectedSalaryComponentIds]
  );

  const salaryPackageOptions = useMemo(
    () => salaryPackages.map((pkg) => ({ value: pkg.id, label: `${pkg.name} (${pkg.code})` })),
    [salaryPackages]
  );

  const selectedSalaryPackageOption = useMemo(
    () =>
      selectedSalaryPackageId
        ? salaryPackageOptions.find((pkg) => String(pkg.value) === String(selectedSalaryPackageId)) || null
        : null,
    [salaryPackageOptions, selectedSalaryPackageId]
  );

  const canUpdateInvite =
    Boolean(selectedUser) &&
    Boolean(designation) &&
    Boolean(staffType) &&
    Boolean(employmentType) &&
    Boolean(selectedPermissionPackage) &&
    Boolean(shiftStart) &&
    Boolean(shiftEnd) &&
    selectedAttendanceMethods.length > 0 &&
    Boolean(baseAmount) &&
    Boolean(effectiveFrom) &&
    isUpdateDirty &&
    !isSubmitting &&
    !isLoadingConstants &&
    !isLoadingStaff &&
    !submitDisabled;

  const handleSubmit = async () => {
    setFormInteracted(true); // show all errors on submit attempt

    if (!selectedUser?.id) {
      toast.warning("Please search and select a user first");
      return;
    }
    if (!designation) {
      toast.warning("Please select designation");
      return;
    }
    if (!staffType) {
      toast.warning("Please select salary type");
      return;
    }
    if (!employmentType) {
      toast.warning("Please select employment type");
      return;
    }
    if (companyAttendanceMethodList.length === 0) {
      toast.warning("No attendance methods are configured for this company");
      return;
    }
    if (selectedAttendanceMethods.length === 0) {
      toast.warning("Please select at least one attendance method");
      return;
    }
    if (!baseAmount) {
      toast.warning("Please enter base amount");
      return;
    }
    if (!effectiveFrom) {
      toast.warning("Please select salary effective from date");
      return;
    }
    const invalidComponent = salaryComponents.find((component) => !component.component_id || !component.calc_type || component.calc_value === "");
    if (invalidComponent) {
      toast.warning("Please complete salary component details");
      return;
    }

    setIsSubmitting(true);
    try {
      const company = JSON.parse(localStorage.getItem("company"));
      const payload = {
        invite_id: staffData?.id || staffData?.invite_id,
        user_id: selectedUser.id,
        permission_package_id: selectedPermissionPackage?.value || null,
        employment_type: employmentType.value,
        salary_type: staffType.value,
        designation: designation.value,
        attendance_methods: selectedAttendanceMethods,
        auto_approve: autoApprove,
        enable_overtime: enableOvertime,
        enable_deduction: enableDeduction,
        joining_date: joiningDate || null,
        shift_start: shiftStart,
        shift_end: shiftEnd,
        break_minutes: normalizeDuration(breakMinutes),
        grace_minutes: normalizeDuration(graceMinutes),
        weekends: weekends,
        base_amount: parseFloat(baseAmount),
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
        components: salaryComponents.map((component) => ({
          component_id: Number(component.component_id),
          calc_type: component.calc_type,
          calc_value: parseFloat(component.calc_value),
          ...(component.effective_from ? { effective_from: component.effective_from } : {}),
          effective_to: component.effective_to || null,
          remark: component.reason || component.remark || "",
        })),
      };

      const response = await apiCall("/company/invites/update", "PUT", payload, company?.id);
      const result = await response.json();

      if (!response.ok) throw new Error(result?.message || "Failed to update staff");

      toast.success("Invitation updated successfully");
      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error("Error updating staff:", error);
      toast.error(error.message || "Failed to update staff");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setEmailQuery("");
    setSelectedUser(null);
    setDesignation(null);
    setStaffType(null);
    setEmploymentType(null);
    setSelectedPermissionPackage(null);
    setSelectedAttendanceMethods([]);
    setAutoApprove(false);
    setEnableOvertime(true);
    setEnableDeduction(true);
    setShiftStart(DEFAULT_SHIFT_START);
    setShiftEnd(DEFAULT_SHIFT_END);
    setBreakMinutes(DEFAULT_DURATION);
    setGraceMinutes(DEFAULT_DURATION);
    setWeekends([]);
    setBaseAmount("");
    setEffectiveFrom("");
    setEffectiveTo("");
    setJoiningDate("");
    setSalaryComponents([]);
    setSelectedSalaryPackageId("");
    setSelectedPackage(null);
    setIsSubmitting(false);
    setFormInteracted(false);
    setIsRoleFieldsOpen(true);
    setIsSalaryDetailsOpen(false);
    setIsAttendanceOpen(false);
    setIsShiftOpen(false);
    setIsInvitePackageOpen(false);
    setIsSalaryComponentDropdownOpen(false);
    onClose();
  };

  const formatDisplay = (value) =>
    value ? String(value).replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "N/A";

  const updateDisabledReason = submitDisabled
    ? submitTitle
    : !selectedUser
      ? 'No staff member loaded'
      : !designation
        ? 'Select a designation'
        : !selectedPermissionPackage
          ? 'Select a permission package'
          : !employmentType
            ? 'Select an employment type'
            : !staffType
              ? 'Select a salary type'
              : !shiftStart
                ? 'Set shift start time'
                : !shiftEnd
                  ? 'Set shift end time'
                  : selectedAttendanceMethods.length === 0
                    ? 'Select at least one attendance method'
                    : !effectiveFrom
                      ? 'Select salary effective from date'
                      : !baseAmount
                        ? 'Enter base salary amount'
                        : !isUpdateDirty
                          ? 'No changes made yet'
                          : '';

  const onFieldBlur = () => setFormInteracted(true);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Staff Invitation"
      subtitle="Update configuration for this staff member"
      icon={<FaUserCog className="h-6 w-6" />}
      size="4xl"
      footer={
        <>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </motion.button>
          <span title={!canUpdateInvite ? updateDisabledReason : undefined} className="inline-flex">
            <motion.button
              whileHover={{ scale: canUpdateInvite ? 1.02 : 1 }}
              whileTap={{ scale: canUpdateInvite ? 0.98 : 1 }}
              onClick={handleSubmit}
              disabled={!canUpdateInvite}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaSave className="h-4 w-4" />}
              Update Invite
            </motion.button>
          </span>
        </>
      }
    >
      <div className="space-y-6 p-2 lg:p-0">
        {selectedUser && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FaRegCheckCircle className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-emerald-900">Current User</h3>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <ProfileAvatar
                record={selectedUser}
                name={selectedUser.full_name || selectedUser.email}
                className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-lg font-bold text-emerald-700 border border-emerald-200 overflow-hidden"
              >
                {selectedUser.full_name?.charAt(0)?.toUpperCase() || "U"}
              </ProfileAvatar>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold text-slate-900">{selectedUser.full_name}</p>
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <FaEnvelope className="h-3.5 w-3.5 text-slate-400" />
                  {selectedUser.email}
                </p>
                {selectedUser.phone && (
                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    <FaPhone className="h-3.5 w-3.5 text-slate-400" />
                    {selectedUser.phone}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedUser && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
            <button
              type="button"
              onClick={() => setIsInvitePackageOpen(!isInvitePackageOpen)}
              className="flex w-full items-center justify-between"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                <FaListAlt className="h-4 w-4 text-indigo-500" />
                Quick Fill via Package (Optional)
              </label>
              {isInvitePackageOpen ? (
                <FaChevronUp className="h-3 w-3 text-slate-400" />
              ) : (
                <FaChevronDown className="h-3 w-3 text-slate-400" />
              )}
            </button>
            <AnimatePresence>
              {isInvitePackageOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  className="overflow-hidden space-y-3"
                >
                  <Select
                    options={invitePackages}
                    value={selectedPackage}
                    onChange={handlePackageSelect}
                    onMenuOpen={handleInvitePackageMenuOpen}
                    onFocus={handleInvitePackageMenuOpen}
                    placeholder={isLoadingPackages ? "Loading packages..." : "Optional: Select a package to auto-fill"}
                    isClearable
                    isLoading={isLoadingPackages}
                    styles={customSelectStyles}
                  />
                  <p className="text-[10px] text-slate-400 italic">Choosing a package will automatically populate all fields below.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key="invite-fields"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-6"
          >
            {showInviteFields ? (
              <>
                {/* ========== ROLE & EMPLOYMENT (collapsible) ========== */}
                <div className={sectionClass("role")}>
                  <button
                    type="button"
                    onClick={() => setIsRoleFieldsOpen(!isRoleFieldsOpen)}
                    className="flex w-full items-center justify-between"
                  >
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                      <FaBriefcase className="h-4 w-4 text-indigo-500" />
                      Role & Employment
                    </label>
                    {isRoleFieldsOpen ? <FaChevronUp className="h-3 w-3 text-slate-400" /> : <FaChevronDown className="h-3 w-3 text-slate-400" />}
                  </button>
                  <AnimatePresence>
                    {isRoleFieldsOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                        animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Designation *</label>
                            <Select
                              options={designations}
                              value={designation}
                              onChange={(val) => { setDesignation(val); setFormInteracted(true); }}
                              onBlur={onFieldBlur}
                              onMenuOpen={fetchAllConstants}
                              onFocus={fetchAllConstants}
                              placeholder="Select designation"
                              isClearable
                              styles={getSelectStyles(designation)}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Permission Package *</label>
                            <Select
                              options={permissionPackages}
                              value={selectedPermissionPackage}
                              onChange={(val) => { setSelectedPermissionPackage(val); setFormInteracted(true); }}
                              onBlur={onFieldBlur}
                              onMenuOpen={fetchPermissionPackages}
                              onFocus={fetchPermissionPackages}
                              placeholder={isLoadingPermissions ? "Loading..." : "Select permission package"}
                              isClearable
                              isLoading={isLoadingPermissions}
                              styles={getSelectStyles(selectedPermissionPackage)}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Employment Type *</label>
                            <Select
                              options={employmentTypes}
                              value={employmentType}
                              onChange={(val) => { setEmploymentType(val); setFormInteracted(true); }}
                              onBlur={onFieldBlur}
                              onMenuOpen={fetchAllConstants}
                              onFocus={fetchAllConstants}
                              placeholder="Select employment type"
                              isClearable
                              styles={getSelectStyles(employmentType)}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Salary Type *</label>
                            <Select
                              options={salaryTypes}
                              value={staffType}
                              onChange={(val) => { setStaffType(val); setFormInteracted(true); }}
                              onBlur={onFieldBlur}
                              onMenuOpen={fetchAllConstants}
                              onFocus={fetchAllConstants}
                              placeholder="Select salary type"
                              isClearable
                              styles={getSelectStyles(staffType)}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ========== SALARY DETAILS (collapsible) ========== */}
                <div className={sectionClass("salary")}>
                  <button
                    type="button"
                    onClick={() => setIsSalaryDetailsOpen(!isSalaryDetailsOpen)}
                    className="flex w-full items-center justify-between"
                    onBlur={onFieldBlur}
                  >
                    <div className="flex items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                        <CurrencyIcon className="h-4 w-4 text-indigo-500" size={14} />
                        Salary Details
                      </label>
                      <span className="text-xs text-slate-500">Required for invite payroll setup</span>
                    </div>
                    {isSalaryDetailsOpen ? <FaChevronUp className="h-3 w-3 text-slate-400" /> : <FaChevronDown className="h-3 w-3 text-slate-400" />}
                  </button>
                  <AnimatePresence>
                    {isSalaryDetailsOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                        animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Effective From *</label>
                            <AdvancedDateFilter
                              tabOptions={["month"]}
                              value={getMonthYearValue(effectiveFrom)}
                              onChange={(value) => setEffectiveFrom(monthYearToDate(value))}
                              placeholder="Select month"
                              buttonClassName={getInputClass(effectiveFrom, "w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition")}
                              onBlur={onFieldBlur}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Effective To</label>
                            <AdvancedDateFilter
                              tabOptions={["month"]}
                              value={getMonthYearValue(effectiveTo)}
                              onChange={(value) => setEffectiveTo(monthYearToDate(value))}
                              placeholder="Optional"
                              buttonClassName="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Base Amount *</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={baseAmount}
                              onChange={(e) => handleBaseAmountChange(e.target.value)}
                              onBlur={onFieldBlur}
                              placeholder="Enter amount"
                              className={getInputClass(baseAmount, "w-full rounded-xl border px-4 py-2.5 text-sm font-semibold outline-none transition")}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Salary Package (Quick Fill)</label>
                            <Select
                              value={selectedSalaryPackageOption}
                              onChange={handleSalaryPackageChange}
                              onMenuOpen={handleSalaryPackageMenuOpen}
                              onFocus={handleSalaryPackageMenuOpen}
                              options={salaryPackageOptions}
                              isLoading={isLoadingSalaryPackages}
                              isClearable
                              placeholder={isLoadingSalaryPackages ? "Loading packages..." : "Custom / Manual"}
                              noOptionsMessage={() => "No packages found"}
                              menuPlacement="auto"
                              menuPosition="fixed"
                              menuPortalTarget={document.body}
                              styles={{ ...customSelectStyles, menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Joining Date</label>
                            <input
                              type="date"
                              value={joiningDate}
                              onChange={(e) => setJoiningDate(e.target.value)}
                              onBlur={onFieldBlur}
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                            />
                          </div>
                        </div>

                        {/* Salary Components */}
                        <div className="mt-5 border-t border-slate-100 pt-4">
                          <div className="mb-3 flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Salary Components</label>
                            <button
                              type="button"
                              onClick={handleSalaryComponentsToggle}
                              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 transition hover:bg-indigo-100"
                            >
                              <FaPlus className="h-2.5 w-2.5" />
                              Add Component
                            </button>
                          </div>

                          {isSalaryComponentDropdownOpen && (
                            <div className="mb-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-3">
                              <Select
                                value={null}
                                onChange={addSalaryComponent}
                                onMenuOpen={handleSalaryComponentMenuOpen}
                                onFocus={handleSalaryComponentMenuOpen}
                                options={salaryComponentOptions}
                                placeholder={isLoadingSalaryComponents ? "Loading components..." : "Choose a component"}
                                isLoading={isLoadingSalaryComponents}
                                noOptionsMessage={() => "No components available"}
                                menuPlacement="auto"
                                menuPosition="fixed"
                                menuPortalTarget={document.body}
                                styles={{ ...customSelectStyles, menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                              />
                            </div>
                          )}

                          {salaryComponents.length > 0 ? (
                            <div className="space-y-3">
                              {salaryComponents.map((component, index) => {
                                const componentData = availableSalaryComponents.find((item) => String(item.id) === String(component.component_id));
                                const componentName = component.component_name || componentData?.name || `Component ${component.component_id}`;
                                const componentCode = component.component_code || componentData?.code || "";
                                return (
                                  <div key={`${component.component_id}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="grid gap-3 md:grid-cols-12">
                                      <div className="md:col-span-4">
                                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Component</label>
                                        <div className="truncate rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                                          {componentName}
                                          {componentCode && <span className="ml-2 text-[10px] font-normal text-slate-400">({componentCode})</span>}
                                        </div>
                                      </div>
                                      <div className="md:col-span-3">
                                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Type</label>
                                        <Select
                                          value={{ value: component.calc_type, label: component.calc_type === "percentage" ? "Percentage (%)" : "Fixed Amount" }}
                                          onChange={(option) => updateSalaryComponent(index, "calc_type", option?.value || "percentage")}
                                          options={[
                                            { value: "percentage", label: "Percentage (%)" },
                                            { value: "fixed", label: "Fixed Amount" },
                                          ]}
                                          menuPlacement="auto"
                                          menuPosition="fixed"
                                          menuPortalTarget={document.body}
                                          styles={{ ...customSelectStyles, menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                                        />
                                      </div>
                                      <div className="md:col-span-3">
                                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Value</label>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={component.calc_value}
                                          onChange={(e) => {
                                            const value = e.target.value.replace(/[^0-9.]/g, "");
                                            if (value === "" || /^\d*\.?\d*$/.test(value)) updateSalaryComponent(index, "calc_value", value);
                                          }}
                                          onBlur={onFieldBlur}
                                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                                        />
                                      </div>
                                      <div className="flex items-end justify-end md:col-span-2">
                                        <button
                                          type="button"
                                          onClick={() => removeSalaryComponent(index)}
                                          className="rounded-lg p-2.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                                          title="Remove component"
                                        >
                                          <FaTimes className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                      <div className="md:col-span-12">
                                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Reason</label>
                                        <input
                                          type="text"
                                          value={component.reason || ""}
                                          onChange={(e) => updateSalaryComponent(index, "reason", e.target.value)}
                                          onBlur={onFieldBlur}
                                          placeholder="Reason for this component value"
                                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm italic text-slate-600 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                              No salary components selected.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ========== ATTENDANCE (collapsible) ========== */}
                <div className={sectionClass("attendance")}>
                  <button
                    type="button"
                    onClick={() => setIsAttendanceOpen(!isAttendanceOpen)}
                    className="flex w-full items-center justify-between"
                    onBlur={onFieldBlur}
                  >
                    <div className="flex items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                        <FaFingerprint className="h-4 w-4 text-indigo-500" />
                        Attendance
                      </label>
                      <span className="text-xs text-slate-500">Choose from company methods</span>
                    </div>
                    {isAttendanceOpen ? <FaChevronUp className="h-3 w-3 text-slate-400" /> : <FaChevronDown className="h-3 w-3 text-slate-400" />}
                  </button>
                  <AnimatePresence>
                    {isAttendanceOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                        animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                        className="overflow-hidden"
                      >
                        {methodBadges.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {methodBadges.map((method) => {
                              const active = selectedAttendanceMethods.includes(method.key);
                              return (
                                <button
                                  key={method.key}
                                  type="button"
                                  onClick={() => toggleAttendanceMethod(method.key)}
                                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                    active
                                      ? "border-indigo-300 bg-indigo-600 text-white shadow-sm"
                                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50"
                                  }`}
                                >
                                  {active && <FaCheck className="h-3 w-3" />}
                                  {method.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 mb-4">
                            No attendance methods available for this company.
                          </div>
                        )}
                        <div className="flex flex-col gap-3">
                          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm text-slate-700">Auto approve Attendance</span>
                          </label>
                          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <input type="checkbox" checked={enableOvertime} onChange={(e) => setEnableOvertime(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm text-slate-700">Enable Overtime</span>
                          </label>
                          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <input type="checkbox" checked={enableDeduction} onChange={(e) => setEnableDeduction(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm text-slate-700">Enable Deduction</span>
                          </label>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ========== SHIFT & SCHEDULE (collapsible) ========== */}
                <div className={sectionClass("shift")}>
                  <button
                    type="button"
                    onClick={() => setIsShiftOpen(!isShiftOpen)}
                    className="flex w-full items-center justify-between"
                    onBlur={onFieldBlur}
                  >
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                      <FaClock className="h-4 w-4 text-indigo-500" />
                      Shift & Schedule
                    </label>
                    {isShiftOpen ? <FaChevronUp className="h-3 w-3 text-slate-400" /> : <FaChevronDown className="h-3 w-3 text-slate-400" />}
                  </button>
                  <AnimatePresence>
                    {isShiftOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                        animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div>
                            <TimeDurationPickerField
                              label="Start Time"
                              value={shiftStart}
                              onChange={(val) => { setShiftStart(val); setFormInteracted(true); }}
                              mode="time"
                            />
                          </div>
                          <div>
                            <TimeDurationPickerField
                              label="End Time"
                              value={shiftEnd}
                              onChange={(val) => { setShiftEnd(val); setFormInteracted(true); }}
                              mode="time"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <TimeDurationPickerField label="Break Minutes" value={breakMinutes} onChange={setBreakMinutes} mode="duration" />
                          <TimeDurationPickerField label="Grace Minutes" value={graceMinutes} onChange={setGraceMinutes} mode="duration" />
                        </div>

                        {/* Weekends – compact grid */}
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Weekends</label>
                        <div className="flex flex-wrap gap-2">
                          {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => {
                            const isSelected = weekends.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleWeekend(day)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                  isSelected
                                    ? "bg-indigo-600 text-white shadow-sm"
                                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                <span className={`w-3 h-3 rounded flex items-center justify-center ${isSelected ? "bg-white/20" : "bg-slate-100"}`}>
                                  {isSelected && <FaCheck className="w-2 h-2 text-white" />}
                                </span>
                                {day.charAt(0).toUpperCase() + day.slice(1)}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500 text-center">
                Invite details are not available.
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {isLoadingStaff && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 flex items-center justify-center gap-3">
            <FaSpinner className="h-4 w-4 animate-spin text-indigo-500" />
            Loading invite details...
          </div>
        )}
      </div>
    </Modal>
  );
}

export default EditStaffModal;