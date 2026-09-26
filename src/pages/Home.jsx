import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import apiCall from "../utils/api";
import { useAuth } from "../context/AuthContext";
import usePermissionAccess from "../hooks/usePermissionAccess";
import { useNavigate } from "react-router-dom";
import {
  FaUsers,
  FaQuestionCircle,
  FaArrowRight,
  FaClock,
  FaBuilding,
  FaEnvelope,
  FaUserPlus,
  FaFingerprint,
  FaUserCheck,
  FaCalendarAlt,
  FaRegCalendarAlt,
  FaCog,
  FaUmbrellaBeach,
  FaFileInvoiceDollar,
  FaUserShield,
  FaHistory,
  FaSync,
  FaChartBar
} from "react-icons/fa";
import Skeleton from "../components/SkeletonComponent";
import AddStaffModal from "../components/StaffModals/AddStaffModal";
import CreateCompanyModal from "../components/CompanyModals/CreateCompanyModal";
import { usePendingInvites } from '../context/PendingInvitesContext';



function HomePage() {
  const { user, loading, company, companies = [], refreshUser } = useAuth();
  const { checkPageAccess, checkActionAccess } = usePermissionAccess();
  const { pendingInviteCount } = usePendingInvites();
  const navigate = useNavigate();
  const [openAddStaffModal, setOpenAddStaffModal] = useState(false);
  const [openCreateCompanyModal, setOpenCreateCompanyModal] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const fetchedRef = useRef(null);

  const fetchDashboardSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await apiCall('/attendance/dashboard-summary', 'GET', null, company?.id);
      const response = await res.json();
      if (response.success) {
        setDashboardData(response.data);
      }
    } catch (error) {
      console.error("Dashboard summary fetch failed:", error);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (user && company && checkPageAccess('attendanceManagement').allowed) {
      // Avoid redundant calls if already fetched for this company
      if (fetchedRef.current === company.id) return;
      fetchedRef.current = company.id;
      fetchDashboardSummary();
    } else {
      setLoadingSummary(false);
    }
  }, [user, company, checkPageAccess]);

  // Show loading state
  if (loading) {
    return <Skeleton />;
  }

  // Check if user exists
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md mx-auto p-8 bg-white/80 backdrop-blur-xl rounded-xl shadow-xl border border-slate-100"
        >
          <div className="w-20 h-20 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
            <FaQuestionCircle className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Session Expired</h2>
          <p className="text-slate-600 mb-8">Please login again to continue</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="group px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center gap-2"
          >
            Go to Login
            <FaArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    );
  }

  const handleAddStaffClick = async () => {
    const storedCompany = localStorage.getItem("company");

    if (!storedCompany) {
      try {
        const res = await apiCall('/users/profile-role', 'GET');
        const response = await res.json();

        if (response.success && response.data) {
          const ownedCompanies = response.data.companies?.owned_companies || [];
          const memberCompanies = response.data.companies?.companies || [];
          const userCompaniesData = [...ownedCompanies, ...memberCompanies];

          // Multiple companies or single company -> set and proceed
          if (userCompaniesData.length >= 1) {
            localStorage.setItem("company", JSON.stringify(userCompaniesData[0]));
            setOpenAddStaffModal(true);
            return;
          }

          // No companies → create company
          setOpenCreateCompanyModal(true);
          return;
        }
      } catch (error) {
        console.error("Profile fetch failed:", error);
        return;
      }
    }

    setOpenAddStaffModal(true);
  };


  // Get current time for greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Format date
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Quick Actions Definition based on Role
  const getQuickActions = () => {
    const attendancePageAccess = checkPageAccess("attendance");
    const punchActionAccess = checkActionAccess("attendance", "punch");
    const attendanceHistoryAccess = checkPageAccess("attendanceHistory");
    const myShiftsAccess = checkPageAccess("myShifts");
    const myLeavesAccess = checkPageAccess("myLeaves");
    const mySalaryAccess = checkPageAccess("mySalary");
    const myLedgerAccess = checkPageAccess("myLedger");
    const myInvitesAccess = checkPageAccess("myInvites");
    const addStaffAccess = checkActionAccess("workspace", "addStaff");
    const inviteMgmtAccess = checkPageAccess("companyInvites");
    const employeeMgmtAccess = checkPageAccess("employeeManagement");
    const permissionMgmtAccess = checkPageAccess("permissionManagement");
    const attendanceMgmtAccess = checkPageAccess("attendanceManagement");
    const salaryMgmtAccess = checkPageAccess("salaryManagement");
    const employeeShiftsAccess = checkPageAccess("employeesShifts");
    const leaveMgmtAccess = checkPageAccess("leaveManagement");
    const holidayMgmtAccess = checkPageAccess("holidayManagement");
    const myCalendarAccess = checkPageAccess("myCalendar");
    const companySettingsAccess = checkPageAccess("companySettings");

    const actions = [
      {
        title: "Punch Attendance",
        description: punchActionAccess.allowed
          ? "Mark your work session"
          : attendancePageAccess.allowed
            ? "View attendance details"
            : "No permission",
        icon: FaFingerprint,
        color: attendancePageAccess.allowed ? "from-indigo-500 to-purple-500" : "from-slate-400 to-slate-500",
        onClick: () => attendancePageAccess.allowed && navigate('/attendance'),
        gradient: attendancePageAccess.allowed ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "bg-slate-200",
        disabled: !attendancePageAccess.allowed
      },
      {
        title: "My Leaves",
        description: myLeavesAccess.allowed ? "Apply & view leaves" : "No permission",
        icon: FaUmbrellaBeach,
        color: myLeavesAccess.allowed ? "from-cyan-500 to-blue-500" : "from-slate-400 to-slate-500",
        onClick: () => myLeavesAccess.allowed && navigate('/my-leaves'),
        gradient: myLeavesAccess.allowed ? "bg-gradient-to-r from-cyan-500 to-blue-500" : "bg-slate-200",
        disabled: !myLeavesAccess.allowed
      },
      {
        title: "Attendance History",
        description: attendanceHistoryAccess.allowed ? "Review your past records" : "No permission",
        icon: FaHistory,
        color: attendanceHistoryAccess.allowed ? "from-violet-500 to-fuchsia-500" : "from-slate-400 to-slate-500",
        onClick: () => attendanceHistoryAccess.allowed && navigate('/attendance-history'),
        gradient: attendanceHistoryAccess.allowed ? "bg-gradient-to-r from-violet-500 to-fuchsia-500" : "bg-slate-200",
        disabled: !attendanceHistoryAccess.allowed
      },
      {
        title: "My Salary",
        description: mySalaryAccess.allowed ? "View financial logs" : "No permission",
        icon: FaFileInvoiceDollar,
        color: mySalaryAccess.allowed ? "from-amber-500 to-orange-500" : "from-slate-400 to-slate-500",
        onClick: () => mySalaryAccess.allowed && navigate('/my-salary'),
        gradient: mySalaryAccess.allowed ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-slate-200",
        disabled: !mySalaryAccess.allowed
      },
      {
        title: "My Ledger",
        description: myLedgerAccess.allowed ? "View ledger transactions" : "No permission",
        icon: FaChartBar,
        color: myLedgerAccess.allowed ? "from-violet-500 to-indigo-500" : "from-slate-400 to-slate-500",
        onClick: () => myLedgerAccess.allowed && navigate('/my-ledger'),
        gradient: myLedgerAccess.allowed ? "bg-gradient-to-r from-violet-500 to-indigo-500" : "bg-slate-200",
        disabled: !myLedgerAccess.allowed
      },
      {
        title: "My Invites",
        description: "View personal invitations",
        icon: FaEnvelope,
        color: "from-pink-500 to-rose-500",
        badgeCount: myInvitesAccess.allowed ? pendingInviteCount : 0,
        onClick: () => myInvitesAccess.allowed && navigate('/my-invites'),
        gradient: "bg-gradient-to-r from-pink-500 to-rose-500",
        disabled: !myInvitesAccess.allowed
      },
      {
        title: "Add Staff",
        description: addStaffAccess.allowed ? "Onboard new members" : "No permission",
        icon: FaUserPlus,
        color: addStaffAccess.allowed ? "from-green-500 to-emerald-500" : "from-slate-400 to-slate-500",
        onClick: () => addStaffAccess.allowed && handleAddStaffClick(),
        gradient: addStaffAccess.allowed ? "bg-gradient-to-r from-green-500 to-emerald-500" : "bg-slate-200",
        disabled: !addStaffAccess.allowed
      },
      {
        title: "Onboarding Mgmt",
        description: inviteMgmtAccess.allowed ? "Manage onboarding" : "No permission",
        icon: FaBuilding,
        color: inviteMgmtAccess.allowed ? "from-indigo-600 to-blue-600" : "from-slate-400 to-slate-500",
        onClick: () => inviteMgmtAccess.allowed && navigate('/employee-management?tab=invites'),
        gradient: inviteMgmtAccess.allowed ? "bg-gradient-to-r from-indigo-600 to-blue-600" : "bg-slate-200",
        disabled: !inviteMgmtAccess.allowed
      },
      {
        title: "Employee Mgmt",
        description: employeeMgmtAccess.allowed ? "Manage directory" : "No permission",
        icon: FaUsers,
        color: employeeMgmtAccess.allowed ? "from-blue-500 to-cyan-500" : "from-slate-400 to-slate-500",
        onClick: () => employeeMgmtAccess.allowed && navigate('/employee-management'),
        gradient: employeeMgmtAccess.allowed ? "bg-gradient-to-r from-blue-500 to-cyan-500" : "bg-slate-200",
        disabled: !employeeMgmtAccess.allowed
      },
      {
        title: "Permissions",
        description: permissionMgmtAccess.allowed ? "Manage roles" : "No permission",
        icon: FaUserShield,
        color: permissionMgmtAccess.allowed ? "from-purple-500 to-pink-500" : "from-slate-400 to-slate-500",
        onClick: () => permissionMgmtAccess.allowed && navigate('/permission-management'),
        gradient: permissionMgmtAccess.allowed ? "bg-gradient-to-r from-purple-500 to-pink-500" : "bg-slate-200",
        disabled: !permissionMgmtAccess.allowed
      },
      {
        title: "Attendance Mgmt",
        description: attendanceMgmtAccess.allowed ? "Review & edit records" : "No permission",
        icon: FaClock,
        color: attendanceMgmtAccess.allowed ? "from-teal-500 to-emerald-500" : "from-slate-400 to-slate-500",
        onClick: () => attendanceMgmtAccess.allowed && navigate('/attendance-management'),
        gradient: attendanceMgmtAccess.allowed ? "bg-gradient-to-r from-teal-500 to-emerald-500" : "bg-slate-200",
        disabled: !attendanceMgmtAccess.allowed
      },
      {
        title: "Salary Mgmt",
        description: salaryMgmtAccess.allowed ? "Assign and manage employee salaries" : "No permission",
        icon: FaFileInvoiceDollar,
        color: salaryMgmtAccess.allowed ? "from-emerald-500 to-teal-500" : "from-slate-400 to-slate-500",
        onClick: () => salaryMgmtAccess.allowed && navigate('/salary-management'),
        gradient: salaryMgmtAccess.allowed ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-slate-200",
        disabled: !salaryMgmtAccess.allowed
      },
      {
        title: "Employee Shifts",
        description: employeeShiftsAccess.allowed ? "Monitor team shift summaries" : "No permission",
        icon: FaUserCheck,
        color: employeeShiftsAccess.allowed ? "from-indigo-500 to-cyan-500" : "from-slate-400 to-slate-500",
        onClick: () => employeeShiftsAccess.allowed && navigate('/attendance-management?tab=shifts'),
        gradient: employeeShiftsAccess.allowed ? "bg-gradient-to-r from-indigo-500 to-cyan-500" : "bg-slate-200",
        disabled: !employeeShiftsAccess.allowed
      },
      {
        title: "Leave Mgmt",
        description: leaveMgmtAccess.allowed ? "Review applications" : "No permission",
        icon: FaUmbrellaBeach,
        color: leaveMgmtAccess.allowed ? "from-orange-500 to-red-500" : "from-slate-400 to-slate-500",
        onClick: () => leaveMgmtAccess.allowed && navigate('/leave-management'),
        gradient: leaveMgmtAccess.allowed ? "bg-gradient-to-r from-orange-500 to-red-500" : "bg-slate-200",
        disabled: !leaveMgmtAccess.allowed
      },
      {
        title: "Holiday Mgmt",
        description: holidayMgmtAccess.allowed ? "Configure company holidays" : "No permission",
        icon: FaCalendarAlt,
        color: holidayMgmtAccess.allowed ? "from-sky-500 to-indigo-500" : "from-slate-400 to-slate-500",
        onClick: () => holidayMgmtAccess.allowed && navigate('/holiday-management'),
        gradient: holidayMgmtAccess.allowed ? "bg-gradient-to-r from-sky-500 to-indigo-500" : "bg-slate-200",
        disabled: !holidayMgmtAccess.allowed
      },
      {
        title: "Company Config",
        description: companySettingsAccess.allowed ? "Manage settings & shifts" : "No permission",
        icon: FaCog,
        color: companySettingsAccess.allowed ? "from-slate-600 to-slate-800" : "from-slate-400 to-slate-500",
        onClick: () => companySettingsAccess.allowed && navigate('/company-settings'),
        gradient: companySettingsAccess.allowed ? "bg-gradient-to-r from-slate-600 to-slate-800" : "bg-slate-200",
        disabled: !companySettingsAccess.allowed
      },
      ...(companies.length === 0 ? [{
        title: "Create Company",
        description: "Launch a new organization",
        icon: FaBuilding,
        color: "from-blue-600 to-indigo-700",
        onClick: () => setOpenCreateCompanyModal(true),
        gradient: "bg-gradient-to-r from-blue-600 to-indigo-700",
        disabled: false
      }] : [])
    ];

    return actions;
  };

  const quickActions = getQuickActions().filter((action) => !action.disabled);
  const punchActionAccess = checkActionAccess("attendance", "punch");
  const canPunch = punchActionAccess.allowed;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-indigo-100/10 to-purple-100/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Compact Header */}
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl   text-slate-800 tracking-tight">
              {getGreeting()}, <span className="text-indigo-600">{user?.full_name?.split(' ')[0] || 'User'}</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
              <FaRegCalendarAlt className="text-indigo-300" />
              {currentDate}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-emerald-50 border-emerald-100 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Live System</span>
          </div>
        </header>
        {/* Unified Summary Card */}
        {checkPageAccess('attendanceManagement').allowed && (
          <section className="mb-8">
            {loadingSummary && !dashboardData ? (
              <div className="h-32 w-full bg-white/50 animate-pulse rounded-2xl border border-slate-100"></div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col lg:flex-row"
              >
                {/* Left Grid: Summary Data */}
                <div className="flex-1 p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 bg-gradient-to-br from-white to-slate-50/50">
                  {[
                    {
                      label: "Present Today",
                      value: dashboardData?.attendance_today?.present || 0,
                      color: "text-indigo-600",
                      icon: FaUserCheck,
                      bg: "bg-indigo-50",
                      iconColor: "text-indigo-500"
                    },
                    {
                      label: "Total Staff",
                      value: dashboardData?.employees?.total || 0,
                      color: "text-slate-800",
                      icon: FaUsers,
                      bg: "bg-slate-100",
                      iconColor: "text-slate-500"
                    },
                    {
                      label: "Overtime",
                      value: dashboardData?.attendance_today?.overtime_employees || 0,
                      color: "text-amber-600",
                      icon: FaClock,
                      bg: "bg-amber-50",
                      iconColor: "text-amber-500"
                    },
                    {
                      label: "Attendance Rate",
                      value: dashboardData?.employees?.total > 0
                        ? `${Math.round(((dashboardData?.attendance_today?.present || 0) / dashboardData.employees.total) * 100)}%`
                        : "0%",
                      color: "text-emerald-600",
                      icon: FaChartBar,
                      bg: "bg-emerald-50",
                      iconColor: "text-emerald-500"
                    }
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-center gap-4 group">
                      <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                        <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</span>
                        <span className={`text-2xl   tracking-tight ${stat.color}`}>{stat.value}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right Grid: Refresh & Date */}
                <div className="bg-slate-900 text-white p-8 flex items-center justify-between lg:justify-end gap-8 lg:min-w-[320px] relative overflow-hidden">
                  {/* Decorative background circle */}
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>

                  <div className="flex flex-col lg:items-end text-left lg:text-right relative z-10">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">Last Sync</span>
                    <div className="text-sm   text-white uppercase tracking-tight">{currentDate.split(',')[0]}</div>
                    <div className="text-[11px] font-bold text-white/60">{currentDate.split(',')[1]}</div>
                  </div>

                  <div className="flex items-center gap-5 relative z-10">
                    <div className="h-10 w-px bg-white/10 hidden lg:block"></div>
                    <button
                      onClick={fetchDashboardSummary}
                      disabled={loadingSummary}
                      className={`group p-4 rounded-2xl bg-white/10 border border-white/10 text-white/80 hover:text-white hover:bg-white/20 hover:border-white/20 hover:shadow-xl transition-all active:scale-95 ${loadingSummary ? 'opacity-50' : ''}`}
                      title="Refresh Summary"
                    >
                      <FaSync className={`w-5 h-5 transition-transform duration-700 ${loadingSummary ? 'animate-spin text-white' : 'group-hover:rotate-180'}`} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </section>
        )}
        {/* Single High-Density Section Header */}
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Workspace Shortcuts</h2>
          <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            {quickActions.length} Actions Available
          </div>
        </div>

        {/* High-Density Action Grid - All Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {quickActions.map((action, index) => (
            <motion.button
              key={action.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={action.onClick}
              aria-label={action.badgeCount > 0
                ? `${action.title}, ${action.badgeCount} pending invites`
                : action.title}
              className="group relative bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-100 transition-all text-left flex flex-col gap-3 overflow-hidden"
            >
              {/* Subtle background glow */}
              <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-500`}></div>

              {action.badgeCount > 0 && (
                <span className="absolute right-3 top-3 z-10 min-w-6 h-6 px-1.5 rounded-full bg-rose-600 text-white text-[11px] font-bold inline-flex items-center justify-center shadow-sm">
                  {action.badgeCount > 99 ? '99+' : action.badgeCount}
                </span>
              )}

              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${action.color} shadow-lg shadow-indigo-500/10 group-hover:rotate-6 transition-transform duration-300`}>
                <action.icon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm text-slate-800 group-hover:text-indigo-600 transition-colors leading-tight mb-1">{action.title}</h3>
                <p className="text-[10px] font-medium text-slate-400 line-clamp-2 leading-relaxed">{action.description}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>


      {/* Modals */}
      <AddStaffModal
        isOpen={openAddStaffModal}
        onClose={() => setOpenAddStaffModal(false)}
        onSuccess={() => setOpenAddStaffModal(false)}
      />

      <CreateCompanyModal
        isOpen={openCreateCompanyModal}
        onClose={() => setOpenCreateCompanyModal(false)}
        onSuccess={() => { setOpenCreateCompanyModal(false); refreshUser(); }}
        userId={user?.id}
      />

      <style>{`
        @keyframes float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, -10px); } }
        .animate-float { animation: float 5s ease-in-out infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        @keyframes gradient { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .animate-gradient { background-size: 200% 200%; animation: gradient 3s ease infinite; }
      `}</style>
    </div>
  );
}

export default HomePage;
