import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCalendarCheck, FaUmbrellaBeach, FaClock, FaMoneyBillWave,
  FaChartBar, FaShieldAlt, FaUniversity, FaHistory,
  FaIdCard, FaBriefcase, FaEnvelope, FaPhone
} from "react-icons/fa";
import apiCall from "../utils/api";
import { RefreshButton } from "../components/common";
import ProfileAvatar from "../components/common/ProfileAvatar";
import SkeletonComponent from "../components/SkeletonComponent";

// ─── Modular Tab Components ───────────────────────────────────────────────────
import EmployeeAttendanceTab from "../components/profile/EmployeeAttendanceTab";
import EmployeeLeavesTab from "../components/profile/EmployeeLeavesTab";
import EmployeeShiftsTab from "../components/profile/EmployeeShiftsTab";
import EmployeeSalaryTab from "../components/profile/EmployeeSalaryTab";
import EmployeePayrollSection from "../components/profile/EmployeePayrollSection";
import EmployeePermissionsPanel from "../components/profile/EmployeePermissionsPanel";
import EmployeeBankAccountsTab from "../components/EmployeeBankAccountsTab";
import CompanyLedger from "./CompanyLedger";

// ─── Tabs Configuration ───────────────────────────────────────────────────────

const TABS = [
  { key: "attendance", label: "Attendance", icon: FaCalendarCheck, accent: "blue" },
  { key: "leaves", label: "Leaves", icon: FaUmbrellaBeach, accent: "amber" },
  { key: "shifts", label: "Shifts", icon: FaClock, accent: "violet" },
  { key: "salary", label: "Salary", icon: FaMoneyBillWave, accent: "green" },
  { key: "payroll", label: "Payroll", icon: FaChartBar, accent: "indigo" },
  { key: "permissions", label: "Permissions", icon: FaShieldAlt, accent: "indigo" },
  { key: "accounts", label: "Bank Accounts", icon: FaUniversity, accent: "slate" },
  { key: "ledger", label: "Ledger", icon: FaHistory, accent: "slate" },
];

const DEFAULT_PROFILE_TAB = "attendance";
const PROFILE_TAB_IDS = new Set(TABS.map((t) => t.key));

// ─── Request Deduplication ────────────────────────────────────────────────────

const inFlightRequests = new Map();
function runDedupedRequest(key, requestFn) {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }
  const promise = requestFn().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (str) => {
  if (!str) return "—";
  return String(str)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const getInitials = (name = "") =>
  name.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const AVATAR_GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-purple-500 to-pink-600",
  "from-green-500 to-teal-600",
  "from-orange-500 to-amber-500",
  "from-rose-500 to-red-600",
  "from-cyan-500 to-blue-500",
];

const avatarGradient = (id) => AVATAR_GRADIENTS[(Number(id) || 0) % AVATAR_GRADIENTS.length];

const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-rose-100 text-rose-800",
  suspended: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-rose-100 text-rose-800",
  paid: "bg-emerald-100 text-emerald-800",
  present: "bg-emerald-100 text-emerald-800",
  monthly: "bg-blue-100 text-blue-700",
  part_time: "bg-purple-100 text-purple-700",
  full_time: "bg-green-100 text-green-700",
};

function Pill({ value, className = "" }) {
  const cls = STATUS_COLORS[value?.toLowerCase?.()] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${cls} ${className}`}>
      {fmt(value)}
    </span>
  );
}

// ─── Profile Shell (Header + Tabs Bar) ────────────────────────────────────────

function ProfileHub({
  eyebrow, title, description, accent = "slate",
  summary, actions, tabs = [], activeTab, onTabChange, children,
}) {
  const ACCENT_COLORS = {
    slate: { active: "#444441", border: "#444441" },
    green: { active: "#3B6D11", border: "#3B6D11" },
    blue: { active: "#185FA5", border: "#185FA5" },
    indigo: { active: "#534AB7", border: "#534AB7" },
    amber: { active: "#854F0B", border: "#854F0B" },
    violet: { active: "#7C3AED", border: "#7C3AED" },
  };
  const { active: activeColor } = ACCENT_COLORS[accent] || ACCENT_COLORS.indigo;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1600px]">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden"
        >
          <div className="flex flex-col items-start justify-between gap-4 px-5 pt-4 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                {eyebrow && (
                  <div className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] from-blue-600 to-indigo-600 text-blue-700 border-blue-200">
                    {eyebrow}
                  </div>
                )}
                {title && (
                  <h1 className="text-base font-bold text-slate-900 truncate leading-snug">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>
                )}
              </div>
            </div>

            {(summary || actions) && (
              <div className="w-full flex items-center justify-between gap-3">
                {summary}
                {actions}
              </div>
            )}
          </div>

          {tabs?.length > 0 && (
            <div className="flex items-center gap-1 px-4 overflow-x-auto scrollbar-none">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab;
                const isDisabled = tab.disabled || false;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => !isDisabled && onTabChange?.(tab.id)}
                    disabled={isDisabled}
                    title={tab.title || tab.label}
                    style={isActive ? { color: activeColor, borderBottomColor: activeColor } : {}}
                    className={[
                      "inline-flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium",
                      "border-b-2 whitespace-nowrap transition-colors duration-150",
                      "-mb-px",
                      isActive
                        ? "border-current"
                        : isDisabled
                          ? "border-transparent text-slate-300 cursor-not-allowed"
                          : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300",
                    ].join(" ")}
                  >
                    {tab.icon
                      ? (typeof tab.icon === "function" ? <tab.icon size={12} /> : tab.icon)
                      : null}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>

        <div className="px-1 lg:px-0">{children}</div>
      </div>
    </div>
  );
}

// ─── Header Summary (Avatar + Badges + Contact) ───────────────────────────────

function ProfileHeaderSummary({ data }) {
  const { employee: e, user: u } = data;
  return (
    <div className="flex items-center gap-3">
      <ProfileAvatar
        record={u}
        name={u.name}
        className={`h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br ${avatarGradient(u.id)}
          flex items-center justify-center text-base font-bold text-white overflow-hidden select-none`}
      >
        {getInitials(u.name)}
      </ProfileAvatar>

      <div className="text-right hidden sm:block">
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <Pill value={e.status} />
          <Pill value={e.employment_type.label} />
          <Pill value={e.salary_type.label} />
        </div>
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 mb-1">
          <FaIdCard size={10} className="shrink-0" />
          {e.code || e.employee_code || "—"}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-slate-600 mb-0.5">
          <FaBriefcase size={10} className="shrink-0 text-emerald-500" />
          {fmt(e.designation.label)}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <FaEnvelope size={10} className="shrink-0 text-blue-400" />
          <span className="truncate max-w-[180px]">{u.email || "—"}</span>
        </p>
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <FaPhone size={10} className="shrink-0 text-emerald-400" />
          {u.phone || "—"}
        </p>
      </div>
    </div>
  );
}

// ─── Main EmployeeProfilePage Component ───────────────────────────────────────

export default function EmployeeProfilePage() {
  const { employeeId, tabKey } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const mountedRef = useRef(false);

  const requestedTab = new URLSearchParams(location.search).get("tab");
  const activeTab = PROFILE_TAB_IDS.has(tabKey) ? tabKey : DEFAULT_PROFILE_TAB;
  const currentTabConfig = TABS.find((t) => t.key === activeTab) || TABS[0];

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const candidateTab = PROFILE_TAB_IDS.has(requestedTab) ? requestedTab : activeTab;
    const desiredPath = `/employee-profile/${employeeId}/${candidateTab}`;
    const hasLegacyQuery = location.search.includes("tab=");
    if (hasLegacyQuery || !tabKey || tabKey !== candidateTab || location.pathname !== desiredPath) {
      navigate(desiredPath, { replace: true });
    }
  }, [activeTab, employeeId, location.pathname, location.search, navigate, requestedTab, tabKey]);

  const fetchProfile = useCallback(async (id) => {
    if (!id) {
      if (mountedRef.current) {
        setError("Missing employee id");
        setProfile(null);
      }
      return;
    }

    try {
      if (mountedRef.current) {
        setLoading(true);
        setError(null);
        setProfile(null);
      }

      const { res, json } = await runDedupedRequest(`employee-profile:${id}`, async () => {
        const companyStr = localStorage.getItem("company");
        const companyId = companyStr ? JSON.parse(companyStr)?.id : null;
        const response = await apiCall(`/employees/${id}`, "GET", null, companyId);
        const data = await response.json();
        return { res: response, json: data };
      });

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch profile details");
      }

      const raw = json.data ?? {};

      if (mountedRef.current) {
        setProfile({
          employee: {
            ...raw,
            code: raw.employee_code || raw.code,
          },
          user: {
            ...raw,
            name: raw.name,
          },
          company: {
            ...raw,
            name: raw.company_name || raw.company?.name || "—",
            legal_name: raw.legal_name || raw.company?.legal_name || "—",
            logo_url: raw.logo_url || raw.company?.logo_url,
            city: raw.city || raw.company?.city,
            state: raw.state || raw.company?.state,
            country: raw.country || raw.company?.country,
          },
        });
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || "Failed to load profile");
        setProfile(null);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile(employeeId);
  }, [employeeId, fetchProfile]);

  const handleTabChange = useCallback((nextTab) => {
    if (!PROFILE_TAB_IDS.has(nextTab) || nextTab === activeTab) return;
    navigate(`/employee-profile/${employeeId}/${nextTab}`);
  }, [activeTab, employeeId, navigate]);

  const handleRefresh = useCallback(async () => {
    setRefreshKey((key) => key + 1);
    await fetchProfile(employeeId);
  }, [employeeId, fetchProfile]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-6 font-sans">
      <div className="mx-auto max-w-[1600px]">
        {loading && <SkeletonComponent />}

        {error && (
          <div className="mb-4 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
            ⚠ {error}
          </div>
        )}

        {!loading && !profile && !error && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-sm font-medium text-gray-700">No employee profile data found.</p>
            <p className="text-xs text-gray-500 mt-1">Please verify the employee ID and try again.</p>
          </div>
        )}

        <AnimatePresence>
          {profile && !loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
              <ProfileHub
                eyebrow={<><FaIdCard size={11} /> Employee Profile</>}
                title={`${profile.employee?.name || profile.user?.name || "Employee"} Profile`}
                description="Detailed overview of employee performance, attendance, and employment records."
                accent={currentTabConfig.accent || "blue"}
                summary={<ProfileHeaderSummary data={profile} />}
                actions={
                  <RefreshButton loading={loading} onClick={handleRefresh}>
                    Refresh
                  </RefreshButton>
                }
                tabs={TABS.map((tab) => ({ id: tab.key, label: tab.label, icon: tab.icon, title: tab.label }))}
                activeTab={activeTab}
                onTabChange={handleTabChange}
              >
                <div className="space-y-4">
                  {activeTab === "attendance" && (
                    <EmployeeAttendanceTab
                      employee={profile.employee}
                      fallbackId={employeeId}
                      refreshKey={refreshKey}
                    />
                  )}

                  {activeTab === "leaves" && (
                    <EmployeeLeavesTab
                      employee={profile.employee}
                      employeeId={profile.employee?.id ?? employeeId}
                      refreshKey={refreshKey}
                    />
                  )}

                  {activeTab === "shifts" && (
                    <EmployeeShiftsTab
                      employee={profile.employee}
                      employeeId={profile.employee?.id ?? employeeId}
                      refreshKey={refreshKey}
                    />
                  )}

                  {activeTab === "salary" && (
                    <EmployeeSalaryTab
                      employeeId={profile.employee?.id ?? employeeId}
                      refreshKey={refreshKey}
                    />
                  )}

                  {activeTab === "payroll" && (
                    <EmployeePayrollSection
                      employee={profile.employee}
                      employeeId={profile.employee?.id ?? employeeId}
                      refreshKey={refreshKey}
                    />
                  )}

                  {activeTab === "permissions" && (
                    <EmployeePermissionsPanel
                      employeeId={profile.employee?.id ?? employeeId}
                      refreshKey={refreshKey}
                    />
                  )}

                  {activeTab === "accounts" && (
                    <EmployeeBankAccountsTab
                      employeeId={profile.employee?.id ?? employeeId}
                      refreshKey={refreshKey}
                    />
                  )}

                  {activeTab === "ledger" && (
                    <CompanyLedger
                      employeeId={profile.employee?.id ?? employeeId}
                      refreshKey={refreshKey}
                    />
                  )}
                </div>
              </ProfileHub>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}