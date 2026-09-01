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
      permissions: ["att_punch", "att_view_own"],
      disableForCompanyOwner: true,
      requireAttendanceMethods: true,
    },
    attendanceHistory: {
      permissions: ["att_punch", "att_view_own"],
      disableForCompanyOwner: true,
    },
    myShifts: {
      permissions: ["att_punch", "att_view_own"],
      disableForCompanyOwner: true,
    },
    myLeaves: {
      permissions: ["leave_apply", "leave_view_own", "leave_cancel_own"],
      disableForCompanyOwner: true,
    },
    mySalary: {
      permissions: ["salary_view_own"],
      disableForCompanyOwner: true,
    },
    myPayroll: {
      permissions: ["payroll_view", "payroll_view_all"],
      disableForCompanyOwner: true,
    },
    myLedger: {
      permissions: ["salary_view_own"],
      disableForCompanyOwner: true,
    },
    companyLedger: {
      permissions: ["payroll_view_all", "cmp_bank_view_all"],
      allowCompanyOwner: true,
    },
    employeeBankAccount: {
      permissions: ["emp_bnk_create", "emp_bnk_view", "emp_bnk_update", "emp_bnk_delete"],
      disableForCompanyOwner: true,
    },
    employeeBankAccountManagement: {
      permissions: ["emp_bnk_create", "emp_bnk_view", "emp_bnk_update", "emp_bnk_delete"],
      allowCompanyOwner: true,
    },
    myInvites: { permissions: null },
    holidays: {
      permissions: null,
      requireCompany: true,
      disableForCompanyOwner: true,
      requireAttendanceMethods: true,
    },
    companyInvites: {
      permissions: ["invite_create", "invite_view_all", "invite_cancel", "invite_resend"],
    },
    invitePackages: {
      permissions: ["invite_package_create", "invite_package_view", "invite_package_update", "invite_package_delete"],
    },
    employeeManagement: {
      permissions: [
        "employee_create",
        "employee_view",
        "employee_view_all",
        "employee_update",
        "employee_delete",
        "invite_create",
        "invite_view_all",
        "invite_cancel",
        "invite_resend",
        "invite_package_create",
        "invite_package_view",
        "invite_package_update",
        "invite_package_delete",
        "shift_create",
        "shift_view",
        "shift_view_all",
        "shift_update",
      ],
    },
    employeeProfile: {
      permissions: ["profile_view_employee", "employee_view", "employee_view_all"],
    },
    permissionManagement: {
      permissions: [
        "permission_package_create",
        "permission_package_view",
        "permission_package_update",
        "permission_package_delete",
        "permission_package_assign",
      ],
    },
    attendanceManagement: {
      permissions: ["att_view_all", "att_create", "att_update", "att_delete", "att_verify"],
    },
    salaryManagement: {
      permissions: [
        "salary_create",
        "salary_view_all",
        "salary_update",
        "salary_delete",
        "salary_component_create",
        "salary_component_view",
        "salary_component_update",
        "salary_component_delete",
        "salary_package_create",
        "salary_package_view",
        "salary_package_update",
        "salary_package_delete",
      ],
      allowCompanyOwner: true,
    },
    salaryComponentsManagement: {
      permissions: ["salary_component_create", "salary_component_view", "salary_component_update", "salary_component_delete"],
      allowCompanyOwner: true,
    },
    salaryPackageManagement: {
      permissions: ["salary_package_create", "salary_package_view", "salary_package_update", "salary_package_delete"],
      allowCompanyOwner: true,
    },
    employeesShifts: {
      permissions: ["shift_view", "shift_view_all", "shift_create", "shift_update"],
    },
    leaveManagement: {
      permissions: [
        "leave_view_all",
        "leave_approve",
        "leave_reject",
        "leave_update",
        "leave_config_create",
        "leave_config_view",
        "leave_config_update",
        "leave_config_delete",
        "leave_balance_assign",
        "leave_balance_view_all",
        "leave_balance_update",
        "leave_balance_delete",
      ],
    },
    leaveConfig: {
      permissions: ["leave_config_create", "leave_config_view", "leave_config_update", "leave_config_delete"],
    },
    leaveBalance: {
      permissions: ["leave_balance_assign", "leave_balance_view_all", "leave_balance_update", "leave_balance_delete"],
    },
    payrollManagement: {
      permissions: [
        "payroll_generate",
        "payroll_view",
        "payroll_view_all",
        "payroll_update",
        "payroll_delete",
        "payroll_approve",
        "payroll_hold",
        "payroll_release",
        "payroll_adjustment_create",
        "payroll_adjustment_view",
        "payroll_adjustment_update",
        "payroll_adjustment_delete",
      ],
      allowCompanyOwner: true,
    },
    payrollAdjustment: {
      permissions: [
        "payroll_adjustment_create",
        "payroll_adjustment_view",
        "payroll_adjustment_update",
        "payroll_adjustment_delete",
      ],
      allowCompanyOwner: true,
    },
    bankAccountManagement: {
      permissions: [
        "cmp_bank_create",
        "cmp_bank_view_own",
        "cmp_bank_view_all",
        "cmp_bank_update",
        "cmp_bank_delete",
        "emp_bnk_create",
        "emp_bnk_view",
        "emp_bnk_update",
        "emp_bnk_delete",
      ],
      allowCompanyOwner: true,
    },
    pendingAttendance: {
      permissions: ["att_view_all", "att_verify"],
    },
    companySettings: {
      requireCompanyOwner: true,
    },
    holidayManagement: {
      permissions: ["holiday_create", "holiday_view", "holiday_update", "holiday_delete"],
    },
    help: { permissions: null },
    createCompany: { permissions: null },
  },
  actions: {
    attendance: {
      punch: {
        permissions: "att_punch",
        disableForCompanyOwner: true,
      },
      viewOwn: {
        permissions: "att_view_own",
        disableForCompanyOwner: true,
      },
    },
    myLeaves: {
      apply: {
        permissions: "leave_apply",
        disableForCompanyOwner: true,
      },
      viewOwn: {
        permissions: "leave_view_own",
        disableForCompanyOwner: true,
      },
      cancelOwn: {
        permissions: "leave_cancel_own",
        disableForCompanyOwner: true,
      },
    },
    mySalary: {
      viewOwn: {
        permissions: "salary_view_own",
        disableForCompanyOwner: true,
      },
      advanceView: {
        permissions: "salary_view_own",
        disableForCompanyOwner: true,
      },
    },
    myPayroll: {
      read: {
        permissions: ["payroll_view", "payroll_view_all"],
        disableForCompanyOwner: true,
      },
      download: {
        permissions: ["payroll_view", "payroll_view_all"],
        disableForCompanyOwner: true,
      },
    },
    employeeBankAccount: {
      create: { permissions: "emp_bnk_create" },
      read: { permissions: "emp_bnk_view" },
      update: { permissions: "emp_bnk_update" },
      delete: { permissions: "emp_bnk_delete" },
    },
    employeeBankAccountManagement: {
      create: { permissions: "emp_bnk_create", allowCompanyOwner: true },
      read: { permissions: "emp_bnk_view", allowCompanyOwner: true },
      update: { permissions: "emp_bnk_update", allowCompanyOwner: true },
      delete: { permissions: "emp_bnk_delete", allowCompanyOwner: true },
    },
    companyInvites: {
      create: { permissions: "invite_create" },
      update: { permissions: "invite_create" },
      cancel: { permissions: "invite_cancel" },
      resend: { permissions: "invite_resend" },
      read: { permissions: "invite_view_all" },
    },
    invitePackages: {
      create: { permissions: "invite_package_create" },
      update: { permissions: "invite_package_update" },
      delete: { permissions: "invite_package_delete" },
      read: { permissions: "invite_package_view" },
    },
    employeeManagement: {
      create: { permissions: "employee_create" },
      read: { permissions: ["employee_view", "employee_view_all"] },
      update: { permissions: "employee_update" },
      delete: { permissions: "employee_delete" },
      report: { permissions: "employee_view_all" },
      export: { permissions: "employee_view_all" },
    },
    permissionManagement: {
      create: { permissions: "permission_package_create" },
      read: { permissions: "permission_package_view" },
      update: { permissions: "permission_package_update" },
      delete: { permissions: "permission_package_delete" },
      assign: { permissions: "permission_package_assign" },
    },
    attendanceManagement: {
      read: { permissions: "att_view_all" },
      review: { permissions: "att_verify" },
      approve: { permissions: "att_verify" },
      reject: { permissions: "att_verify" },
      edit: { permissions: "att_update" },
      create: { permissions: "att_create" },
      delete: { permissions: "att_delete" },
      assignMethod: { permissions: "att_update" },
      updateMethod: { permissions: "att_update" },
      removeMethod: { permissions: "att_update" },
      report: { permissions: "att_view_all" },
      export: { permissions: "att_view_all" },
    },
    salaryManagement: {
      create: { permissions: "salary_create", allowCompanyOwner: true },
      read: { permissions: "salary_view_all", allowCompanyOwner: true },
      assign: { permissions: "salary_create", allowCompanyOwner: true },
      update: { permissions: "salary_update", allowCompanyOwner: true },
      revise: { permissions: "salary_update", allowCompanyOwner: true },
      delete: { permissions: "salary_delete", allowCompanyOwner: true },
    },
    salaryComponentsManagement: {
      create: { permissions: "salary_component_create", allowCompanyOwner: true },
      read: { permissions: "salary_component_view", allowCompanyOwner: true },
      update: { permissions: "salary_component_update", allowCompanyOwner: true },
      delete: { permissions: "salary_component_delete", allowCompanyOwner: true },
    },
    salaryPackageManagement: {
      create: { permissions: "salary_package_create", allowCompanyOwner: true },
      read: { permissions: "salary_package_view", allowCompanyOwner: true },
      update: { permissions: "salary_package_update", allowCompanyOwner: true },
      delete: { permissions: "salary_package_delete", allowCompanyOwner: true },
    },
    employeesShifts: {
      create: { permissions: "shift_create" },
      read: { permissions: ["shift_view", "shift_view_all"] },
      update: { permissions: "shift_update" },
      delete: { permissions: "shift_update" },
    },
    leaveManagement: {
      read: { permissions: "leave_view_all" },
      review: { permissions: ["leave_approve", "leave_reject"] },
      create: { permissions: "leave_apply" },
      approve: { permissions: "leave_approve" },
      reject: { permissions: "leave_reject" },
      update: { permissions: "leave_update" },
      cancel: { permissions: "leave_update" },
    },
    leaveConfig: {
      create: { permissions: "leave_config_create" },
      read: { permissions: "leave_config_view" },
      update: { permissions: "leave_config_update" },
      delete: { permissions: "leave_config_delete" },
    },
    leaveBalance: {
      create: { permissions: "leave_balance_assign" },
      update: { permissions: "leave_balance_update" },
      delete: { permissions: "leave_balance_delete" },
      read: { permissions: "leave_balance_view_all" },
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
      create: { permissions: "holiday_create" },
      read: { permissions: "holiday_view" },
      update: { permissions: "holiday_update" },
      delete: { permissions: "holiday_delete" },
    },
    pendingAttendance: {
      read: { permissions: "att_view_all" },
      review: { permissions: "att_verify" },
      approve: { permissions: "att_verify" },
      reject: { permissions: "att_verify" },
    },
    payrollManagement: {
      read: { permissions: ["payroll_view", "payroll_view_all"], allowCompanyOwner: true },
      create: { permissions: "payroll_generate", allowCompanyOwner: true },
      update: { permissions: "payroll_update", allowCompanyOwner: true },
      delete: { permissions: "payroll_delete", allowCompanyOwner: true },
      approve: { permissions: "payroll_approve", allowCompanyOwner: true },
      hold: { permissions: "payroll_hold", allowCompanyOwner: true },
      release: { permissions: "payroll_release", allowCompanyOwner: true },
      createAdjustment: { permissions: "payroll_adjustment_create", allowCompanyOwner: true },
      readAdjustment: { permissions: "payroll_adjustment_view", allowCompanyOwner: true },
      updateAdjustment: { permissions: "payroll_adjustment_update", allowCompanyOwner: true },
      deleteAdjustment: { permissions: "payroll_adjustment_delete", allowCompanyOwner: true },
    },
    payrollAdjustment: {
      create: { permissions: "payroll_adjustment_create", allowCompanyOwner: true },
      read: { permissions: "payroll_adjustment_view", allowCompanyOwner: true },
      update: { permissions: "payroll_adjustment_update", allowCompanyOwner: true },
      delete: { permissions: "payroll_adjustment_delete", allowCompanyOwner: true },
    },
    bankAccountManagement: {
      create: { permissions: "cmp_bank_create" },
      read: { permissions: ["cmp_bank_view_own", "cmp_bank_view_all"] },
      update: { permissions: "cmp_bank_update" },
      delete: { permissions: "cmp_bank_delete" },
    },
    workspace: {
      addStaff: { permissions: ["employee_create", "invite_create"] },
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

    if (isSystemAdmin) {
      return true;
    }

    return permissions.some(
      (permission) => permission.code === permissionCode && isAllowedPermission(permission)
    );
  }, [isSystemAdmin, permissions]);

  const matchPermissions = useCallback((requiredPermissions, match = "any") => {
    const normalizedPermissions = normalizePermissions(requiredPermissions);

    if (normalizedPermissions.length === 0 || isSystemAdmin) {
      return true;
    }

    if (match === "all") {
      return normalizedPermissions.every(hasPermissionCode);
    }

    return normalizedPermissions.some(hasPermissionCode);
  }, [isSystemAdmin, hasPermissionCode]);

  const resolveAccess = useCallback(({
    requiredPermissions,
    match = "any",
    allowCompanyOwner = false,
    disableForCompanyOwner = false,
    requireCompany = false,
    requireAttendanceMethods = false,
    requireCompanyOwner = false,
  }) => {
    const normalizedPermissions = normalizePermissions(requiredPermissions);

    if (isSystemAdmin) {
      return buildAccessResult(true, ACCESS_REASONS.ALLOWED, normalizedPermissions);
    }

    if (disableForCompanyOwner && isCompanyOwnerForCurrentCompany) {
      return buildAccessResult(false, ACCESS_REASONS.OWNER_RESTRICTED, normalizedPermissions);
    }

    // Hard gate: only company owners are allowed, regardless of permissions
    if (requireCompanyOwner) {
      return buildAccessResult(
        isCompanyOwnerForCurrentCompany,
        isCompanyOwnerForCurrentCompany ? ACCESS_REASONS.ALLOWED : ACCESS_REASONS.OWNER_ONLY,
        normalizedPermissions
      );
    }

    if (allowCompanyOwner && isCompanyOwnerForCurrentCompany && normalizedPermissions.length === 0) {
      return buildAccessResult(true, ACCESS_REASONS.ALLOWED, normalizedPermissions);
    }

    if (requireCompany && !company?.id && !isCompanyOwnerForCurrentCompany) {
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
