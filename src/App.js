import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/Landing";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import AcceptInvite from "./pages/AcceptInvite";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import DataDeletion from "./pages/legal/DataDeletion";
import Terms from "./pages/legal/Terms";
import MainLayout from "./layout/MainLayout";
import Home from "./pages/Home";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import NotFound from "./pages/NotFound";
import SettingsPage from "./pages/Setting";
import CompanyInvites from "./pages/CompanyInviteManagement";
import HelpPage from "./pages/Help";
import MyInvites from "./pages/invites";
import MyLeave from "./pages/MyLeave";
import MyAccounts from "./pages/MyAccounts";
import EmployeeManagement from "./pages/EmployeeManagement";
import PunchAttendance from "./pages/PunchAttendance";
import AttendanceHistory from "./pages/AttendanceHistory";
import MySalary from "./pages/MySalary";
import MyPayroll from "./pages/MyPayroll";
import MyLedger from "./pages/MyLedger";
import SalaryManagement from "./pages/SalaryManagement";
import SalaryComponentsManagement from "./pages/SalaryComponentsManagement";
import SalaryPackageManagement from "./pages/SalaryPackageManagement";
import LeaveManagement from "./pages/LeaveManagement";
import LeaveConfigManagement from "./pages/LeaveConfigManagement";
import LeaveBalanceManagement from "./pages/LeaveBalanceManagement";
import InvitePackageManagement from "./pages/InvitePackage";
import PermissionManagement from "./pages/PermissionManagement";
import CompanyHolidays from "./pages/HolidayManagement";
import MyCalendar from "./pages/MyCalendar";
import PayrollManagement from "./pages/PayrollManagement";
import PayrollAdjustment from "./pages/PayrollAdjustment";
import BankAccountManagement from "./pages/BankAccountManagement";
import EmployeeBankAccountManagement from "./pages/EmployeeBankAccountManagement";
import CompanySettings from "./pages/CompanySettings";
import CompanyDetailsPage from "./pages/CompanyDetailsPage";
import EmployeesShifts from "./pages/EmployeesShifts";
import GlobalSkeleton from "./components/GlobalSkeletonComponent";
import ScrollToTop from "./components/ScrollToTop";
import ProfilePage from "./pages/Profile";
import EmployeeProfile from "./pages/EmployeeProfile";
import UnmarkedAttendance from "./pages/UnmarkedAttendance";
import BreakManagement from "./pages/BreakManagement";
import ServerUnavailable from "./pages/ServerUnavailable";
import Subscription from "./pages/Subscription";
import PublicSubscription from "./pages/PublicSubscription";
import {
  TabbedManagementHub,
} from "./components/common";
import {
  FaFileInvoiceDollar,
  FaCalculator,
  FaLayerGroup,
  FaInfoCircle,
  FaUmbrellaBeach,
  FaClipboardList,
  FaChartLine,
  FaUsers,
  FaUserPlus,
  FaClock,
  FaBoxes,
  FaFingerprint,
  FaHistory,
  FaListUl,
  FaCoffee,
  FaBuilding,
  FaUniversity,
  FaMoneyBillWave,
} from "react-icons/fa";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


const PAYROLL_HUB_TABS = [
  {
    id: "payroll",
    label: "Payroll Management",
    shortLabel: "Payroll",
    description: "Generate and manage employee payroll records.",
    icon: FaFileInvoiceDollar,
    pageKey: "payrollManagement",
    component: PayrollManagement,
    accent: "bg-green-50 text-green-700 border-green-200",
  },
  {
    id: "adjustments",
    label: "Payroll Adjustments",
    shortLabel: "Adjustments",
    description: "Manage bonuses, fines, and ledger adjustments.",
    icon: FaCalculator,
    pageKey: "payrollAdjustment",
    component: PayrollAdjustment,
    accent: "bg-blue-50 text-blue-700 border-blue-200",
  },
];

const SALARY_HUB_TABS = [
  {
    id: "salary",
    label: "Salary Management",
    shortLabel: "Salary",
    description: "Assign and manage employee salaries.",
    icon: FaFileInvoiceDollar,
    pageKey: "salaryManagement",
    component: SalaryManagement,
    accent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    id: "components",
    label: "Salary Components",
    shortLabel: "Components",
    description: "Define earnings, deductions, and contributions.",
    icon: FaCalculator,
    pageKey: "salaryComponentsManagement",
    component: SalaryComponentsManagement,
    accent: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "packages",
    label: "Salary Packages",
    shortLabel: "Packages",
    description: "Bundle components into reusable salary packages.",
    icon: FaLayerGroup,
    pageKey: "salaryPackageManagement",
    component: SalaryPackageManagement,
    accent: "bg-violet-50 text-violet-700 border-violet-200",
  },
];

const LEAVE_HUB_TABS = [
  {
    id: "requests",
    label: "Leave Requests",
    shortLabel: "Requests",
    description: "Review employee leave applications and approvals.",
    icon: FaUmbrellaBeach,
    pageKey: "leaveManagement",
    component: LeaveManagement,
    accent: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    id: "config",
    label: "Leave Config",
    shortLabel: "Config",
    description: "Manage leave types, rules, and accrual settings.",
    icon: FaClipboardList,
    pageKey: "leaveConfig",
    component: LeaveConfigManagement,
    accent: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "balance",
    label: "Leave Balance",
    shortLabel: "Balance",
    description: "Assign and review employee leave balances.",
    icon: FaChartLine,
    pageKey: "leaveBalance",
    component: LeaveBalanceManagement,
    accent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
];

const EMPLOYEE_HUB_TABS = [
  {
    id: "employees",
    label: "Employee Management",
    shortLabel: "Employees",
    description: "Manage current employees, their roles, and details.",
    icon: FaUsers,
    pageKey: "employeeManagement",
    component: EmployeeManagement,
    accent: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "invites",
    label: "Employee Onboarding",
    shortLabel: "Invites",
    description: "Send and manage invitations for new employees.",
    icon: FaUserPlus,
    pageKey: "companyInvites",
    component: CompanyInvites,
    accent: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    id: "packages",
    label: "Onboarding Packages",
    shortLabel: "Packages",
    description: "Create reusable invite packages for onboarding workflows.",
    icon: FaBoxes,
    pageKey: "invitePackages",
    component: InvitePackageManagement,
    accent: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    id: "shifts",
    label: "Shift Management",
    shortLabel: "Shifts",
    description: "Monitor and manage employee shift summaries.",
    icon: FaClock,
    pageKey: "employeesShifts",
    component: EmployeesShifts,
    accent: "bg-amber-50 text-amber-700 border-amber-200",
  },
];

const ATTENDANCE_HUB_TABS = [
  {
    id: "punch",
    label: "Mark Attendance",
    shortLabel: "Attendance",
    description: "Mark your daily attendance and check-in status.",
    icon: FaFingerprint,
    pageKey: "attendance",
    component: PunchAttendance,
    accent: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    id: "history",
    label: "Attendance History",
    shortLabel: "History",
    description: "View your past attendance records and logs.",
    icon: FaHistory,
    pageKey: "attendanceHistory",
    component: AttendanceHistory,
    accent: "bg-violet-50 text-violet-700 border-violet-200",
  },
];

const ATTENDANCE_MANAGEMENT_HUB_TABS = [
  {
    id: "attendance",
    label: "Attendance Management",
    shortLabel: "Attendance",
    description: "Mark daily attendance for employees who haven't clocked in.",
    icon: FaFingerprint,
    pageKey: "attendanceManagement",
    component: UnmarkedAttendance,
    accent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    id: "breaks",
    label: "Break Management",
    shortLabel: "Breaks",
    description: "Track and manage employee break sessions.",
    icon: FaCoffee,
    pageKey: "attendanceManagement",
    component: BreakManagement,
    accent: "bg-orange-50 text-orange-700 border-orange-200",
  },
];

const BANK_HUB_TABS = [
  {
    id: "company",
    label: "Company Accounts",
    shortLabel: "Company",
    description: "Manage company bank accounts and cash wallets.",
    icon: FaBuilding,
    pageKey: "bankAccountManagement",
    component: BankAccountManagement,
    accent: "bg-violet-50 text-violet-700 border-violet-200",
  },
  {
    id: "employees",
    label: "Employee Accounts",
    shortLabel: "Employees",
    description: "View and manage employee bank accounts.",
    icon: FaUniversity,
    pageKey: "employeeBankAccountManagement",
    component: EmployeeBankAccountManagement,
    accent: "bg-blue-50 text-blue-700 border-blue-200",
  },
];

const MY_SALARY_HUB_TABS = [
  {
    id: "salary",
    label: "My Salary",
    shortLabel: "Salary",
    description: "View your current salary structure and components.",
    icon: FaMoneyBillWave,
    pageKey: "mySalary",
    component: MySalary,
    accent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    id: "payroll",
    label: "My Payroll",
    shortLabel: "Payroll",
    description: "Review your payroll history and payment records.",
    icon: FaFileInvoiceDollar,
    pageKey: "myPayroll",
    component: MyPayroll,
    accent: "bg-blue-50 text-blue-700 border-blue-200",
  },
];

function AppContent() {
  const { user, loading, mustSelectCompany, serverUnavailable, retryConnection, activeRole, company } = useAuth();
  
  const isCompanyOwner = activeRole === "company_owner" || company?.role === "company_owner";

  if (serverUnavailable) {
    return <ServerUnavailable onReload={retryConnection} isRetrying={loading} />;
  }

  // Show loading state
  if (loading) {
    return (
      <GlobalSkeleton />
    );
  }

  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            user && !mustSelectCompany ? <Navigate to="/home" replace /> : <Login />
          }
        />
        <Route
          path="/signup"
          element={
            user ? <Navigate to={mustSelectCompany ? "/login" : "/home"} replace /> : <Signup />
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/data-deletion" element={<DataDeletion />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/public-subscription" element={<PublicSubscription />} />

        {/* Protected Routes - Only accessible after company selection */}
        <Route path="/home" element={<ProtectedRoute pageKey="home"> <MainLayout> <Home /> </MainLayout> </ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute> <MainLayout> <ProfilePage /> </MainLayout> </ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute> <MainLayout> <SettingsPage /> </MainLayout> </ProtectedRoute>} />
        <Route path="/company-invites" element={<ProtectedRoute pageKey="companyInvites"><Navigate to="/employee-management?tab=invites" replace /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute pageKey="attendance"><MainLayout><TabbedManagementHub
          routePath="/attendance"
          defaultTab="punch"
          title="Attendance Hub"
          description="Mark your presence or review your past activity in one unified dashboard."
          eyebrow={<><FaFingerprint size={11} /> Attendance</>}
          accent="indigo"
          tabs={ATTENDANCE_HUB_TABS}
          accessDeniedTitle="No attendance tabs available"
          accessDeniedDescription="Your current role does not have access to punch attendance or view history."
          accessDeniedIcon={FaInfoCircle}
        /></MainLayout></ProtectedRoute>} />
        <Route path="/attendance-history" element={<ProtectedRoute pageKey="attendanceHistory"><Navigate to="/attendance?tab=history" replace /></ProtectedRoute>} />
        <Route path="/my-salary" element={<ProtectedRoute pageKey="mySalary"><MainLayout><TabbedManagementHub
          routePath="/my-salary"
          defaultTab="salary"
          title="My Salary & Payroll"
          description="View your salary structure, earnings breakdown, and payroll history in one place."
          eyebrow={<><FaMoneyBillWave size={11} /> My Salary</>}
          accent="emerald"
          tabs={MY_SALARY_HUB_TABS}
          accessDeniedTitle="No salary tabs available"
          accessDeniedDescription="Your current role does not have access to salary or payroll information."
          accessDeniedIcon={FaInfoCircle}
        /></MainLayout></ProtectedRoute>} />
        <Route path="/my-ledger" element={<ProtectedRoute pageKey="myLedger"><MainLayout><MyLedger /></MainLayout></ProtectedRoute>} />
        <Route path="/my-accounts" element={<ProtectedRoute pageKey="employeeBankAccount"><MainLayout><MyAccounts /></MainLayout></ProtectedRoute>} />
        <Route path="/attendance-management" element={<ProtectedRoute pageKey="attendanceManagement"><MainLayout><TabbedManagementHub
          routePath="/attendance-management"
          defaultTab="pending"
          title="Attendance Management Hub"
          description="Monitor and approve employee attendance records and punch logs from one unified dashboard."
          eyebrow={<><FaClock size={11} /> Management</>}
          accent="blue"
          tabs={ATTENDANCE_MANAGEMENT_HUB_TABS}
          accessDeniedTitle="No management tabs available"
          accessDeniedDescription="Your current role does not have access to pending attendance or all attendance records."
          accessDeniedIcon={FaInfoCircle}
        /></MainLayout></ProtectedRoute>} />
        <Route path="/salary-management" element={<ProtectedRoute pageKey="salaryManagement"><MainLayout><TabbedManagementHub
          routePath="/salary-management"
          defaultTab="salary"
          title="Salary tools in one place"
          description="Switch between employee salaries, salary components, and salary packages without leaving the page."
          eyebrow={<><FaFileInvoiceDollar size={11} /> Salary management</>}
          accent="green"
          tabs={SALARY_HUB_TABS}
          accessDeniedTitle="No salary tabs available"
          accessDeniedDescription="Your current role does not have access to salary management, salary components, or salary packages."
          accessDeniedIcon={FaInfoCircle}
        /></MainLayout></ProtectedRoute>} />
        <Route path="/salary-components-management" element={<ProtectedRoute pageKey="salaryComponentsManagement"><Navigate to="/salary-management?tab=components" replace /></ProtectedRoute>} />
        <Route path="/salary-package-management" element={<ProtectedRoute pageKey="salaryPackageManagement"><Navigate to="/salary-management?tab=packages" replace /></ProtectedRoute>} />
        <Route path="/employees-shifts" element={<ProtectedRoute pageKey="employeesShifts"><Navigate to="/employee-management?tab=shifts" replace /></ProtectedRoute>} />
        <Route path="/leave-management" element={<ProtectedRoute pageKey="leaveManagement"><MainLayout><TabbedManagementHub
          routePath="/leave-management"
          defaultTab="requests"
          title="All leave tools in one place"
          description="Switch between leave requests, leave setup, and balance allocation without leaving this screen."
          eyebrow={<><FaUmbrellaBeach size={11} /> Leave management</>}
          accent="slate"
          tabs={LEAVE_HUB_TABS}
          accessDeniedTitle="No leave tabs available"
          accessDeniedDescription="Your current role does not have access to leave requests, leave configuration, or leave balances."
          accessDeniedIcon={FaInfoCircle}
        /></MainLayout></ProtectedRoute>} />
        <Route path="/pending-attendance" element={<ProtectedRoute pageKey="pendingAttendance"><Navigate to="/attendance-management?tab=pending" replace /></ProtectedRoute>} />
        <Route path="/holiday-management" element={<ProtectedRoute pageKey="holidayManagement"><MainLayout><CompanyHolidays /></MainLayout></ProtectedRoute>} />
        <Route path="/my-calendar" element={<ProtectedRoute pageKey="holidays"><MainLayout><MyCalendar /></MainLayout></ProtectedRoute>} />
        <Route path="/help" element={<ProtectedRoute pageKey="help"><MainLayout><HelpPage /></MainLayout></ProtectedRoute>} />
        <Route path="/my-leaves" element={<ProtectedRoute pageKey="myLeaves"><MainLayout><MyLeave /></MainLayout></ProtectedRoute>} />
        <Route path="/my-invites" element={<ProtectedRoute pageKey="myInvites"><MainLayout> <MyInvites /></MainLayout></ProtectedRoute>} />
        <Route path="/employee-management" element={<ProtectedRoute pageKey="employeeManagement"><MainLayout><TabbedManagementHub
          routePath="/employee-management"
          defaultTab="employees"
          title="Team, Invitations & Packages Hub"
          description="Manage your active workforce, onboarding invitations, reusable packages, and shift summaries from one place."
          eyebrow={<><FaUsers size={11} /> Staff Management</>}
          accent="blue"
          tabs={EMPLOYEE_HUB_TABS}
          accessDeniedTitle="No employee tabs available"
          accessDeniedDescription="Your current role does not have access to employee management, company invitations, invite packages, or shift summaries."
          accessDeniedIcon={FaInfoCircle}
        /></MainLayout></ProtectedRoute>} />
        <Route path="/company-settings" element={<ProtectedRoute pageKey="companySettings"><MainLayout><CompanySettings /></MainLayout></ProtectedRoute>} />
        <Route path="/company-settings/:companyId" element={<ProtectedRoute pageKey="companySettings"><MainLayout><CompanyDetailsPage /></MainLayout></ProtectedRoute>} />
        {isCompanyOwner && (
          <Route path="/subscription" element={<ProtectedRoute><MainLayout><Subscription /></MainLayout></ProtectedRoute>} />
        )}
        <Route path="/permission-management" element={<ProtectedRoute pageKey="permissionManagement"><MainLayout><PermissionManagement /></MainLayout></ProtectedRoute>} />
        <Route path="/leave-config" element={<ProtectedRoute pageKey="leaveConfig"><Navigate to="/leave-management?tab=config" replace /></ProtectedRoute>} />
        <Route path="/leave-balance" element={<ProtectedRoute pageKey="leaveBalance"><Navigate to="/leave-management?tab=balance" replace /></ProtectedRoute>} />
        <Route path="/payroll-management" element={<ProtectedRoute pageKey="payrollManagement"><MainLayout><TabbedManagementHub
          routePath="/payroll-management"
          defaultTab="payroll"
          title="Payroll Hub"
          description="Manage employee payroll generation, view records, and add adjustments like bonuses and fines."
          eyebrow={<><FaFileInvoiceDollar size={11} /> Payroll Hub</>}
          accent="green"
          tabs={PAYROLL_HUB_TABS}
          accessDeniedTitle="No payroll tabs available"
          accessDeniedDescription="Your current role does not have access to payroll management or adjustments."
          accessDeniedIcon={FaInfoCircle}
        /></MainLayout></ProtectedRoute>} />
        <Route path="/payroll-adjustments" element={<ProtectedRoute pageKey="payrollManagement"><Navigate to="/payroll-management?tab=adjustments" replace /></ProtectedRoute>} />
        <Route path="/bank-account-management" element={<ProtectedRoute pageKey="bankAccountManagement"><MainLayout><TabbedManagementHub
          routePath="/bank-account-management"
          defaultTab="company"
          title="Bank Account Hub"
          description="Manage company and employee bank accounts, wallets, and payment methods from one place."
          eyebrow={<><FaUniversity size={11} /> Bank Accounts</>}
          accent="violet"
          tabs={BANK_HUB_TABS}
          accessDeniedTitle="No bank account tabs available"
          accessDeniedDescription="Your current role does not have access to bank account management."
          accessDeniedIcon={FaInfoCircle}
        />
        </MainLayout></ProtectedRoute>} />
        <Route path="/employee-profile/:employeeId/:tabKey?" element={<ProtectedRoute pageKey="employeeProfile"><MainLayout><EmployeeProfile /></MainLayout></ProtectedRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
    </>
  );
}

export default function App() {
  return <AppContent />;
}
