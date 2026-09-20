import { useMemo, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

const ACCESS_REASONS = {
  ALLOWED: "allowed",
  NO_PERMISSION: "no_permission",
  NO_COMPANY: "no_company",
  OWNER_RESTRICTED: "owner_restricted",
  OWNER_ONLY: "owner_only",
  MISSING_CONFIG: "missing_config",
};

const PERMISSION_ACCESS_CONFIG = {
  pages: {
    home: { permissions: null },
    attendance: {
      permissions: null,
      disableForCompanyOwner: true,
      requireAttendanceMethods: true,
    },
    attendanceHistory: {
      permissions: null,
      disableForCompanyOwner: true,
    },
    myShifts: {
      permissions: null,
      disableForCompanyOwner: true,
    },
    myLeaves: {
      permissions: null,
      disableForCompanyOwner: true,
    },
    mySalary: {
      permissions: null,
      disableForCompanyOwner: true,
    },
    myPayroll: {
      permissions: null,
      disableForCompanyOwner: true,
    },
    myLedger: {
      permissions: null,
      disableForCompanyOwner: true,
    },
    companyLedger: {
      requireCompanyOwner: true,
    },
    employeeBankAccount: {
      permissions: null,
      disableForCompanyOwner: true,
    },
    employeeBankAccountManagement: {
      permissions: ["financial"],
      allowCompanyOwner: true,
    },
    myInvites: { permissions: null },
    holidays: {
      permissions: null,
      disableForCompanyOwner: true,
      requireCompany: true,
      requireAttendanceMethods: true,
    },
    companyInvites: {
      permissions: ["employees"],
    },
    invitePackages: {
      permissions: ["employees"],
    },
    employeeManagement: {
      permissions: ["employees"],
    },
    employeeProfile: {
      permissions: ["employees"],
    },
    permissionManagement: {
      permissions: ["permissions"],
    },
    attendanceManagement: {
      permissions: ["attendance"],
    },
    salaryManagement: {
      permissions: ["financial"],
      allowCompanyOwner: true,
    },
    salaryComponentsManagement: {
      permissions: ["financial"],
      allowCompanyOwner: true,
    },
    salaryPackageManagement: {
      permissions: ["financial"],
      allowCompanyOwner: true,
    },
    employeesShifts: {
      permissions: ["attendance"],
    },
    leaveManagement: {
      permissions: ["leave"],
    },
    leaveConfig: {
      permissions: ["leave"],
    },
    leaveBalance: {
      permissions: ["leave"],
    },
    payrollManagement: {
      permissions: ["financial"],
      allowCompanyOwner: true,
    },
    payrollAdjustment: {
      permissions: ["financial"],
      allowCompanyOwner: true,
    },
    bankAccountManagement: {
      permissions: ["financial"],
      allowCompanyOwner: true,
    },
    pendingAttendance: {
      permissions: ["attendance"],
    },
    companySettings: {
      requireCompanyOwner: true,
    },
    holidayManagement: {
      permissions: ["attendance"],
    },
    help: { permissions: null },
    createCompany: { permissions: null },
  },
  actions: {
    attendance: {
      punch: {
        permissions: null,
        disableForCompanyOwner: true,
      },
      viewOwn: {
        permissions: null,
        disableForCompanyOwner: true,
      },
    },
    myLeaves: {
      apply: {
        permissions: null,
        disableForCompanyOwner: true,
      },
      viewOwn: {
        permissions: null,
        disableForCompanyOwner: true,
      },
      cancelOwn: {
        permissions: null,
        disableForCompanyOwner: true,
      },
    },
    mySalary: {
      viewOwn: {
        permissions: null,
        disableForCompanyOwner: true,
      },
      advanceView: {
        permissions: null,
        disableForCompanyOwner: true,
      },
    },
    myPayroll: {
      read: {
        permissions: null,
        disableForCompanyOwner: true,
      },
      download: {
        permissions: null,
        disableForCompanyOwner: true,
      },
    },
    employeeBankAccount: {
      create: { permissions: null },
      read: { permissions: null },
      update: { permissions: null },
      delete: { permissions: null },
    },
    employeeBankAccountManagement: {
      create: { permissions: "financial", allowCompanyOwner: true },
      read: { permissions: "financial", allowCompanyOwner: true },
      update: { permissions: "financial", allowCompanyOwner: true },
      delete: { permissions: "financial", allowCompanyOwner: true },
    },
    companyInvites: {
      create: { permissions: "employees" },
      update: { permissions: "employees" },
      cancel: { permissions: "employees" },
      resend: { permissions: "employees" },
      read: { permissions: "employees" },
    },
    invitePackages: {
      create: { permissions: "employees" },
      update: { permissions: "employees" },
      delete: { permissions: "employees" },
      read: { permissions: "employees" },
    },
    employeeManagement: {
      create: { permissions: "employees" },
      read: { permissions: "employees" },
      update: { permissions: "employees" },
      delete: { permissions: "employees" },
      report: { permissions: "employees" },
      export: { permissions: "employees" },
    },
    permissionManagement: {
      create: { permissions: "permissions" },
      read: { permissions: "permissions" },
      update: { permissions: "permissions" },
      delete: { permissions: "permissions" },
      assign: { permissions: "permissions" },
    },
    attendanceManagement: {
      read: { permissions: "attendance" },
      review: { permissions: "attendance" },
      approve: { permissions: "attendance" },
      reject: { permissions: "attendance" },
      edit: { permissions: "attendance" },
      create: { permissions: "attendance" },
      delete: { permissions: "attendance" },
      assignMethod: { permissions: "attendance" },
      updateMethod: { permissions: "attendance" },
      removeMethod: { permissions: "attendance" },
      report: { permissions: "attendance" },
      export: { permissions: "attendance" },
    },
    salaryManagement: {
      create: { permissions: "financial", allowCompanyOwner: true },
      read: { permissions: "financial", allowCompanyOwner: true },
      assign: { permissions: "financial", allowCompanyOwner: true },
      update: { permissions: "financial", allowCompanyOwner: true },
      revise: { permissions: "financial", allowCompanyOwner: true },
      delete: { permissions: "financial", allowCompanyOwner: true },
    },
    salaryComponentsManagement: {
      create: { permissions: "financial", allowCompanyOwner: true },
      read: { permissions: "financial", allowCompanyOwner: true },
      update: { permissions: "financial", allowCompanyOwner: true },
      delete: { permissions: "financial", allowCompanyOwner: true },
    },
    salaryPackageManagement: {
      create: { permissions: "financial", allowCompanyOwner: true },
      read: { permissions: "financial", allowCompanyOwner: true },
      update: { permissions: "financial", allowCompanyOwner: true },
      delete: { permissions: "financial", allowCompanyOwner: true },
    },
    employeesShifts: {
      create: { permissions: "attendance" },
      read: { permissions: "attendance" },
      update: { permissions: "attendance" },
      delete: { permissions: "attendance" },
    },
    leaveManagement: {
      read: { permissions: "leave" },
      review: { permissions: "leave" },
      create: { permissions: "leave" },
      approve: { permissions: "leave" },
      reject: { permissions: "leave" },
      update: { permissions: "leave" },
      cancel: { permissions: "leave" },
    },
    leaveConfig: {
      create: { permissions: "leave" },
      read: { permissions: "leave" },
      update: { permissions: "leave" },
      delete: { permissions: "leave" },
    },
    leaveBalance: {
      create: { permissions: "leave" },
      update: { permissions: "leave" },
      delete: { permissions: "leave" },
      read: { permissions: "leave" },
    },
    companySettings: {
      read: { requireCompanyOwner: true },
      updateCompany: { requireCompanyOwner: true },
      updateSettings: { requireCompanyOwner: true },
      updateBranding: { requireCompanyOwner: true },
      updateSecurity: { requireCompanyOwner: true },
      updateNotifications: { requireCompanyOwner: true },
      update: { requireCompanyOwner: true },
      delete: { requireCompanyOwner: true },
      shiftCreate: { requireCompanyOwner: true },
      shiftRead: { requireCompanyOwner: true },
      shiftUpdate: { requireCompanyOwner: true },
      shiftDelete: { requireCompanyOwner: true },
    },
    holidayManagement: {
      create: { permissions: "attendance" },
      read: { permissions: "attendance" },
      update: { permissions: "attendance" },
      delete: { permissions: "attendance" },
    },
    pendingAttendance: {
      read: { permissions: "attendance" },
      review: { permissions: "attendance" },
      approve: { permissions: "attendance" },
      reject: { permissions: "attendance" },
    },
    payrollManagement: {
      read: { permissions: "financial", allowCompanyOwner: true },
      create: { permissions: "financial", allowCompanyOwner: true },
      update: { permissions: "financial", allowCompanyOwner: true },
      delete: { permissions: "financial", allowCompanyOwner: true },
      approve: { permissions: "financial", allowCompanyOwner: true },
      hold: { permissions: "financial", allowCompanyOwner: true },
      release: { permissions: "financial", allowCompanyOwner: true },
      createAdjustment: { permissions: "financial", allowCompanyOwner: true },
      readAdjustment: { permissions: "financial", allowCompanyOwner: true },
      updateAdjustment: { permissions: "financial", allowCompanyOwner: true },
      deleteAdjustment: { permissions: "financial", allowCompanyOwner: true },
    },
    payrollAdjustment: {
      create: { permissions: "financial", allowCompanyOwner: true },
      read: { permissions: "financial", allowCompanyOwner: true },
      update: { permissions: "financial", allowCompanyOwner: true },
      delete: { permissions: "financial", allowCompanyOwner: true },
    },
    bankAccountManagement: {
      create: { permissions: "financial", allowCompanyOwner: true },
      read: { permissions: "financial", allowCompanyOwner: true },
      update: { permissions: "financial", allowCompanyOwner: true },
      delete: { permissions: "financial", allowCompanyOwner: true },
    },
    workspace: {
      addStaff: { permissions: ["employees"] },
    },
  },
};

const normalizeAccessConfig = (configEntry) => {
  if (configEntry === null) {
    return { permissions: null };
  }

  if (typeof configEntry === "string" || Array.isArray(configEntry)) {
    return { permissions: configEntry };
  }

  return configEntry || null;
};

const normalizePermissions = (permissions) => {
  if (!permissions) {
    return [];
  }

  return (Array.isArray(permissions) ? permissions : [permissions]).filter(Boolean);
};

const buildAccessResult = (allowed, reason, permissions = []) => ({
  allowed,
  enabled: allowed,
  disabled: !allowed,
  reason,
  permissions,
});

const getAccessMessage = (access) => {
  if (access.reason === ACCESS_REASONS.OWNER_RESTRICTED) {
    return "Disabled for company owner";
  }

  if (access.reason === ACCESS_REASONS.OWNER_ONLY) {
    return "Only the company owner can access this";
  }

  if (access.reason === ACCESS_REASONS.NO_COMPANY) {
    return "Select a company first";
  }

  if (access.reason === ACCESS_REASONS.MISSING_CONFIG) {
    return "Permission config missing";
  }

  if (access.reason === "no_attendance_methods") {
    return "No attendance methods assigned to your profile. Contact admin.";
  }

  return "You don't have permission";
};

const isAllowedFlag = (value) => (
  value === 1 ||
  value === true ||
  value === "1" ||
  String(value).toLowerCase() === "true"
);

const isAllowedPermission = (permission) => isAllowedFlag(permission?.is_allowed);

export const usePermissionAccess = () => {
  const { permissions = [], userDetails, activeRole, company, attendanceMethods = [] } = useAuth();

  const isSystemAdmin = isAllowedFlag(userDetails?.meta?.is_system_admin);
  const isCompanyOwnerForCurrentCompany =
    activeRole === "company_owner" || company?.role === "company_owner";

  const hasPermissionCode = useCallback((permissionCode) => {
    if (!permissionCode) {
      return true;
    }

    if (isSystemAdmin || isCompanyOwnerForCurrentCompany) {
      return true;
    }

    return permissions.some(
      (permission) => permission.code === permissionCode && isAllowedPermission(permission)
    );
  }, [isSystemAdmin, isCompanyOwnerForCurrentCompany, permissions]);

  const matchPermissions = useCallback((requiredPermissions, match = "any") => {
    const normalizedPermissions = normalizePermissions(requiredPermissions);

    if (normalizedPermissions.length === 0 || isSystemAdmin || isCompanyOwnerForCurrentCompany) {
      return true;
    }

    if (match === "all") {
      return normalizedPermissions.every(hasPermissionCode);
    }

    return normalizedPermissions.some(hasPermissionCode);
  }, [isSystemAdmin, isCompanyOwnerForCurrentCompany, hasPermissionCode]);

  const resolveAccess = useCallback(({
    requiredPermissions,
    match = "any",
    allowCompanyOwner = true,
    disableForCompanyOwner = false,
    requireCompany = false,
    requireAttendanceMethods = false,
    requireCompanyOwner = false,
  }) => {
    const normalizedPermissions = normalizePermissions(requiredPermissions);

    // Personal/self-service pages are hidden for company owners even though they are company admins.
    if (disableForCompanyOwner && isCompanyOwnerForCurrentCompany) {
      return buildAccessResult(false, ACCESS_REASONS.OWNER_RESTRICTED, normalizedPermissions);
    }

    // Company owner and System admin have unrestricted access to everything in the company
    if (isSystemAdmin || isCompanyOwnerForCurrentCompany) {
      return buildAccessResult(true, ACCESS_REASONS.ALLOWED, normalizedPermissions);
    }

    // Hard gate: only company owners are allowed, regardless of permissions
    if (requireCompanyOwner) {
      return buildAccessResult(
        false,
        ACCESS_REASONS.OWNER_ONLY,
        normalizedPermissions
      );
    }

    if (requireCompany && !company?.id) {
      return buildAccessResult(false, ACCESS_REASONS.NO_COMPANY, normalizedPermissions);
    }

    if (requireAttendanceMethods && (!attendanceMethods || attendanceMethods.length === 0)) {
      return buildAccessResult(false, "no_attendance_methods", normalizedPermissions);
    }

    const hasRequiredPermission = matchPermissions(normalizedPermissions, match);

    return buildAccessResult(
      hasRequiredPermission,
      hasRequiredPermission ? ACCESS_REASONS.ALLOWED : ACCESS_REASONS.NO_PERMISSION,
      normalizedPermissions
    );
  }, [isSystemAdmin, isCompanyOwnerForCurrentCompany, company?.id, attendanceMethods, matchPermissions]);

  const checkPageAccess = useCallback((pageKey, overrideOptions = {}) => {
    const pageConfig = normalizeAccessConfig(PERMISSION_ACCESS_CONFIG.pages[pageKey]);

    if (!pageConfig && overrideOptions.requiredPermissions === undefined) {
      return buildAccessResult(false, ACCESS_REASONS.MISSING_CONFIG);
    }

    return resolveAccess({
      ...pageConfig,
      ...overrideOptions,
      requiredPermissions: overrideOptions.requiredPermissions ?? pageConfig?.permissions,
    });
  }, [resolveAccess]);

  const checkActionAccess = useCallback((pageKey, actionKey, overrideOptions = {}) => {
    const actionConfig = normalizeAccessConfig(
      PERMISSION_ACCESS_CONFIG.actions[pageKey]?.[actionKey]
    );

    if (!actionConfig && overrideOptions.requiredPermissions === undefined) {
      return buildAccessResult(false, ACCESS_REASONS.MISSING_CONFIG);
    }

    return resolveAccess({
      ...actionConfig,
      ...overrideOptions,
      requiredPermissions: overrideOptions.requiredPermissions ?? actionConfig?.permissions,
    });
  }, [resolveAccess]);

  return useMemo(() => ({
    accessReasons: ACCESS_REASONS,
    permissionAccessConfig: PERMISSION_ACCESS_CONFIG,
    isSystemAdmin,
    isCompanyOwnerForCurrentCompany,
    hasPermissionCode,
    hasAnyPermission: (requiredPermissions) => matchPermissions(requiredPermissions, "any"),
    hasAllPermissions: (requiredPermissions) => matchPermissions(requiredPermissions, "all"),
    checkPageAccess,
    checkActionAccess,
    getAccessMessage,
  }), [
    isSystemAdmin,
    isCompanyOwnerForCurrentCompany,
    hasPermissionCode,
    matchPermissions,
    checkPageAccess,
    checkActionAccess
  ]);
};

export default usePermissionAccess;
