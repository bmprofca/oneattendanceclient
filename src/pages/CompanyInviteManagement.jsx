import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaUserTie, FaClock, FaExclamationCircle, FaSpinner,
  FaEye, FaEdit, FaBan, FaCheckCircle, FaTimesCircle, FaEnvelope,
  FaPhone, FaCalendarAlt, FaBriefcase, FaTag,
  FaSearch, FaTimes, FaShieldAlt, FaUserCircle, FaPlus, FaChevronDown, FaUserCheck, FaCog,
  FaFingerprint, FaFilter
} from "react-icons/fa";
import { toast } from 'react-toastify';
import apiCall from "../utils/api";
import Pagination, { usePagination } from "../components/PaginationComponent";
import EditStaffModal from "../components/StaffModals/EditStaffModal";
import CreateInviteModal from "../components/StaffModals/AddStaffModal";
import Skeleton from "../components/SkeletonComponent";
import ActionMenu from "../components/ActionMenu";
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import usePermissionAccess from "../hooks/usePermissionAccess";
import Modal from "../components/Modal";
import { RefreshButton } from "../components/common";
import ProfileAvatar from "../components/common/ProfileAvatar";
import CurrencyIcon from "../components/common/CurrencyIcon";
import AdvancedDateFilter from '../components/AdvancedDateFilter';
import Select from '../components/SelectField';


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
  // Hide the vertical separator bar (the "|")
  indicatorSeparator: (base) => ({ ...base, display: 'none' }),
  // Style the dropdown arrow (optional)
  dropdownIndicator: (base) => ({ ...base, color: '#6366f1' }),
};

// ─── Status filter options ─────────────────────────────────────────────────
const INVITE_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isExpired = (date) => new Date(date) < new Date();

const getStatusBadge = (status, expiresAt) => {
  if (isExpired(expiresAt))
    return { icon: FaTimesCircle, text: "Expired", className: "bg-red-100 text-red-800 border border-red-200" };
  switch (status) {
    case "accepted":
      return { icon: FaCheckCircle, text: "Accepted", className: "bg-green-100 text-green-800 border border-green-200" };
    case "pending":
      return { icon: FaClock, text: "Pending", className: "bg-yellow-100 text-yellow-800 border border-yellow-200" };
    case "cancelled":
      return { icon: FaBan, text: "Cancelled", className: "bg-gray-100 text-gray-800 border border-gray-200" };
    default:
      return { icon: FaExclamationCircle, text: status, className: "bg-gray-100 text-gray-800 border border-gray-200" };
  }
};

const formatDate = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
};

const formatDateSimple = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric"
  });
};

const formatDisplay = (str) => {
  if (typeof str === 'object' && str !== null) return str.label || "N/A";
  return str ? String(str).replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "N/A";
};

const formatBoolean = (value) => (value ? "Yes" : "No");

const minutesToDuration = (value) => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const minutes = Number(value);
  if (Number.isNaN(minutes)) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const normalizeDuration = (value, fallback = null) => {
  if (value === null || typeof value === "undefined" || value === "") return fallback;
  if (typeof value === "number") return minutesToDuration(value);
  if (typeof value !== "string") return fallback;
  const parts = value.split(":");
  if (parts.length >= 2) {
    return `${String(parts[0] || "00").padStart(2, "0")}:${String(parts[1] || "00").padStart(2, "0")}`;
  }
  return fallback;
};

const formatDurationDisplay = (value) => {
  const normalized = normalizeDuration(value, null);
  if (!normalized) return "N/A";
  return normalized;
};

const formatCurrency = (value) => {
  if (value === null || typeof value === "undefined" || value === "") return "N/A";
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
};

const formatAttendanceMethod = (method) => {
  if (typeof method === "string") return formatDisplay(method);
  if (method && typeof method === "object") return formatDisplay(method.method || method.value || method.label);
  return "N/A";
};

const formatWeekendDay = (weekend) => {
  if (typeof weekend === "string") return formatDisplay(weekend);
  if (weekend && typeof weekend === "object") return formatDisplay(weekend.day || weekend.value);
  return "N/A";
};

const normalizeInviteRecord = (invite) => ({
  ...invite,
  id: invite.invite_id,
  token: invite.token,
  user_id: invite?.user?.id ?? invite?.user_id ?? null,
  permission_package_id: invite?.permission_package?.id ?? invite?.permission_package_id ?? null,
  break_minutes: normalizeDuration(invite?.break_minutes, "00:30"),
  grace_minutes: normalizeDuration(invite?.grace_minutes, "00:30"),
  enable_overtime: Boolean(invite?.enable_overtime),
  enable_deduction: Boolean(invite?.enable_deduction),
});

// ─── InfoItem ────────────────────────────────────────────────────────────────

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

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CompanyInvites() {
  const { checkActionAccess, getAccessMessage } = usePermissionAccess();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedInvite, setSelectedInvite] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [viewMode, setViewMode] = useState("table");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingInvite, setEditingInvite] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [openCreateInviteModal, setOpenCreateInviteModal] = useState(false);

  // Collapsible sections in view modal
  const [showSalaryDetails, setShowSalaryDetails] = useState(false);
  const [showAttendanceDetails, setShowAttendanceDetails] = useState(false);
  const [showShiftSchedule, setShowShiftSchedule] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showSalaryComponents, setShowSalaryComponents] = useState(false);

  const fetchInProgress = useRef(false);

  const MODAL_TYPES = {
    NONE: null,
    VIEW: 'VIEW',
    CANCEL: 'CANCEL',
  };

  const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 10);
  const createInviteAccess = checkActionAccess("companyInvites", "create");
  const updateInviteAccess = checkActionAccess("companyInvites", "update");
  const cancelInviteAccess = checkActionAccess("companyInvites", "cancel");

  const company_id = JSON.parse(localStorage.getItem("company"))?.id;

  // ── Debounce search ──────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ── Fetch invites ────────────────────────────────────────────────────────
  const fetchInvites = useCallback(
    async (page = pagination.page, resetLoading = true) => {
      if (fetchInProgress.current) return;
      fetchInProgress.current = true;
      if (resetLoading) setLoading(true);

      try {
        const company = JSON.parse(localStorage.getItem("company"));
        const params = new URLSearchParams({ page: page.toString(), limit: pagination.limit.toString() });
        if (debouncedSearchTerm) params.append("search", debouncedSearchTerm);

        if (statusFilter && statusFilter !== "all") {
          params.append("status", statusFilter);
        }

        if (dateFilter) {
          if (dateFilter.date) {
            params.append("from_date", dateFilter.date);
            params.append("to_date", dateFilter.date);
          } else {
            if (dateFilter.from_date) params.append("from_date", dateFilter.from_date);
            if (dateFilter.to_date) params.append("to_date", dateFilter.to_date);
          }
          if (dateFilter.month && dateFilter.year) {
            params.append("month", dateFilter.month);
            params.append("year", dateFilter.year);
          }
        }

        const response = await apiCall(`/company/invites/list?${params.toString()}`, 'GET', null, company?.id);
        if (!response.ok) throw new Error("Failed to fetch invites");

        const result = await response.json();
        if (result.success) {
          setInvites((result.data || []).map(normalizeInviteRecord));
          const currentPage = Number(result.current_page ?? result.page ?? result.meta?.page ?? page);
          const perPage = Number(result.per_page ?? result.limit ?? result.meta?.limit ?? pagination.limit);
          const total = Number(result.total ?? result.meta?.total ?? result.data?.length ?? 0);
          const totalPages = Number(
            result.last_page ??
            result.total_pages ??
            result.meta?.total_pages ??
            Math.max(1, Math.ceil(total / perPage))
          );
          updatePagination({
            page: currentPage,
            limit: perPage,
            total,
            total_pages: totalPages,
            is_last_page: result.is_last_page ?? result.meta?.is_last_page ?? (currentPage >= totalPages)
          });
        } else {
          throw new Error(result.message || "Failed to fetch invites");
        }
      } catch (err) {
        toast.error(err.message || "Failed to load invitations.");
        console.error("Error fetching invites:", err);
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
        fetchInProgress.current = false;
      }
    },
    [company_id, pagination.limit, updatePagination, debouncedSearchTerm, dateFilter, statusFilter]
  );

  const handlePageChange = useCallback(
    (newPage) => { if (newPage !== pagination.page) goToPage(newPage); },
    [pagination.page, goToPage]
  );

  useEffect(() => {
    if (!isInitialLoad && !fetchInProgress.current) {
      fetchInvites(pagination.page, true);
    }
  }, [pagination.page, pagination.limit, debouncedSearchTerm, dateFilter, statusFilter]);

  useEffect(() => {
    if (!isInitialLoad) {
      if (pagination.page !== 1) goToPage(1);
      else fetchInvites(1, true);
    }
  }, [debouncedSearchTerm, dateFilter, statusFilter]);

  useEffect(() => {
    if (company_id && isInitialLoad) {
      fetchInvites(1, true);
    } else if (!company_id) {
      toast.error("Company ID not found. Please ensure you're logged in as a company.");
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [company_id]);

  // ── Cancel invite ────────────────────────────────────────────────────────
  const handleCancelInvite = async (inviteId) => {
    try {
      setProcessingId(inviteId);
      const company = JSON.parse(localStorage.getItem("company"));
      const response = await apiCall('/company/invites/cancel', 'DELETE', { token: inviteId }, company?.id);
      if (!response.ok) throw new Error("Failed to cancel invite");
      const result = await response.json();
      if (result.success) {
        toast.success("Invitation cancelled successfully.");
        await fetchInvites(pagination.page, false);
        closeModal();
      } else {
        throw new Error(result.message || "Failed to cancel invite");
      }
    } catch (err) {
      toast.error(err.message || "Something went wrong while cancelling.");
    } finally {
      setProcessingId(null);
    }
  };

  // ── Resend invite ────────────────────────────────────────────────────────
  const handleResendInvite = async (invite) => {
    const inviteId = invite.id;
    if (!inviteId) return toast.error("Invite ID not found.");
    const processingKey = `resend-${inviteId}`;
    try {
      setProcessingId(processingKey);
      setActiveActionMenu(null);
      const company = JSON.parse(localStorage.getItem("company"));
      const response = await apiCall('/company/invites/resend', 'POST', { invite_id: inviteId }, company?.id);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to resend invite");
      toast.success(result.message || "Invitation resent successfully.");
      await fetchInvites(pagination.page, false);
    } catch (err) {
      toast.error(err.message || "Something went wrong while resending.");
    } finally {
      setProcessingId(null);
    }
  };

  // ── Edit invite ──────────────────────────────────────────────────────────
  const handleEditClick = (invite) => {
    if (updateInviteAccess.disabled) return;
    setEditingInvite(normalizeInviteRecord(invite));
    setIsEditModalOpen(true);
    setActiveActionMenu(null);
  };

  const handleEditSuccess = () => {
    toast.success("Invitation updated successfully.");
    fetchInvites(pagination.page, false);
    setIsEditModalOpen(false);
    setEditingInvite(null);
  };

  const openModal = (invite, type) => {
    setSelectedInvite(invite);
    setModalType(type);
    setActiveActionMenu(null);
    setShowSalaryDetails(false);
    setShowAttendanceDetails(false);
    setShowShiftSchedule(false);
    setShowPermissions(false);
    setShowSalaryComponents(false);
  };

  const closeModal = () => {
    setSelectedInvite(null);
    setModalType(null);
    setShowSalaryDetails(false);
    setShowAttendanceDetails(false);
    setShowShiftSchedule(false);
    setShowPermissions(false);
    setShowSalaryComponents(false);
  };

  // ─── Responsive columns ─────────────────────────────────────────────────
  const getEffectiveWidth = () => {
    const width = window.innerWidth;
    const offset = width >= 1024 ? 280 : (width >= 768 ? 80 : 0);
    return width - offset;
  };

  const getVisibleColumns = useCallback((width) => ({
    showUser: true,
    showEmailInside: width >= 800,
    showDesignation: width >= 600,
    showEmployment: width >= 1000,
    showStatus: width >= 500,
    showExpires: width >= 1200,
    showJoiningDate: width >= 1400,
    showOvertime: width >= 1600,
    showDeduction: width >= 1800,
  }), []);

  const [visibleColumns, setVisibleColumns] = useState(() => getVisibleColumns(getEffectiveWidth()));

  useEffect(() => {
    let t;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        setVisibleColumns(getVisibleColumns(getEffectiveWidth()));
      }, 150);
    };
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(t); window.removeEventListener("resize", onResize); };
  }, [getVisibleColumns]);

  // ── Early return ─────────────────────────────────────────────────────────
  if (isInitialLoad && loading) return <Skeleton />;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <FaEnvelope size={11} />
                Invite management
              </div>
              <div>
                <h1 className="mt-1 text-lg font-bold text-slate-900 md:text-xl">Company Invitations</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Manage and track invitations sent to prospective employees and staff members.
                </p>
              </div>
            </div>
            <div className="flex flex-row sm:items-center gap-3 justify-end flex-wrap">
              <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm">
                <FaUserCheck className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-gray-700">{invites.length}</span>
                <span className="text-gray-500">invites</span>
              </div>
              <RefreshButton loading={loading} onClick={() => fetchInvites(pagination.page, true)}>
                Refresh
              </RefreshButton>
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => !createInviteAccess.disabled && setOpenCreateInviteModal(true)}
                disabled={createInviteAccess.disabled}
                title={createInviteAccess.disabled ? getAccessMessage(createInviteAccess) : ""}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2 font-bold text-white shadow-lg transition-all duration-300 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FaPlus size={14} />
                <span className="text-sm">Create</span>
              </motion.button>
            </div>
          </div>
          <CreateInviteModal
            isOpen={openCreateInviteModal}
            onClose={() => setOpenCreateInviteModal(false)}
            onSuccess={() => {
              setOpenCreateInviteModal(false);
              fetchInvites(pagination.page, false);
            }}
            submitDisabled={createInviteAccess.disabled}
            submitTitle={createInviteAccess.disabled ? getAccessMessage(createInviteAccess) : ""}
          />
        </motion.div>

        {/* Search, Date Filter & View bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6"
        >
          <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
            <div className="relative flex-1 w-full">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                placeholder="Search by name, email or designation..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm min-h-[42px]"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                  <FaTimes size={14} />
                </button>
              )}
            </div>
            <div className="w-full sm:w-auto min-w-[220px]">
              <AdvancedDateFilter
                value={dateFilter}
                onChange={(filter) => setDateFilter(filter)}
                placeholder="Filter by date"
                buttonClassName="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 min-h-[42px] text-gray-700"
              />
            </div>
            {/* Status Filter – now without the pipe icon */}
            <div className="w-full sm:w-auto md:w-44">
              <Select
                options={INVITE_STATUS_FILTER_OPTIONS}
                value={INVITE_STATUS_FILTER_OPTIONS.find(option => option.value === statusFilter)}
                onChange={(option) => setStatusFilter(option?.value || 'pending')}
                placeholder="Status"
                isClearable={false}
                styles={customSelectStyles}
              />
            </div>
            <div className="hidden lg:block h-8 w-px bg-gray-200 mx-1"></div>
            <div>
              <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="blue" />
            </div>
          </div>
        </motion.div>

        {/* Loading / Empty */}
        {loading && !invites.length && <Skeleton />}
        {!loading && invites.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16 bg-white rounded-xl shadow-xl">
            <FaEnvelope className="text-8xl text-gray-300 mx-auto mb-4" />
            <p className="text-xl text-gray-500">No invitations found</p>
            <p className="text-gray-400 mt-2">
              {searchTerm ? "Try adjusting your search" : "Your company hasn't sent any invitations yet"}
            </p>
          </motion.div>
        )}

        {/* Table / Cards */}
        {!loading && invites.length > 0 && (
          <>
            {viewMode === "table" && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-white rounded-xl shadow-xl overflow-hidden">
                <div className="overflow-x-auto overflow-y-visible">
                  <table className="w-full text-sm text-left text-gray-700">
                    <thead className="xsm:hidden bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 uppercase text-xs">
                      <tr>
                        {visibleColumns.showUser && <th className="px-6 py-4">User</th>}
                        {visibleColumns.showDesignation && <th className="px-6 py-4">Designation</th>}
                        {visibleColumns.showEmployment && <th className="px-6 py-4">Employment</th>}
                        {visibleColumns.showStatus && <th className="px-6 py-4">Status</th>}
                        {visibleColumns.showExpires && <th className="px-6 py-4">Expires</th>}
                        {visibleColumns.showJoiningDate && <th className="px-6 py-4">Joining</th>}
                        {visibleColumns.showOvertime && <th className="px-6 py-4">OT</th>}
                        {visibleColumns.showDeduction && <th className="px-6 py-4">Deduction</th>}
                        <th className="px-6 py-4 text-right"><FaCog className="w-4 h-4 ml-auto" /></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {invites.map((invite, index) => {
                        const status = getStatusBadge(invite.status, invite.expires_at);
                        const StatusIcon = status.icon;
                        return (
                          <motion.tr key={invite.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => openModal(invite, MODAL_TYPES.VIEW)}
                            className="cursor-pointer hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-300">
                            {visibleColumns.showUser && (
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <ProfileAvatar
                                    record={invite.user}
                                    name={invite.user?.name || invite.user?.email}
                                    className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold overflow-hidden"
                                  >
                                    {invite.user?.name?.charAt(0)?.toUpperCase() || invite.user?.email?.charAt(0)?.toUpperCase()}
                                  </ProfileAvatar>
                                  <div>
                                    <p className="font-semibold text-gray-800 truncate max-w-[120px] sm:max-w-[180px]">{invite.user?.name || "No name"}</p>
                                    {visibleColumns.showEmailInside && (
                                      <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <FaEnvelope className="text-gray-400" size={10} />
                                        <span className="truncate max-w-[150px]">{invite.user?.email}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                            )}
                            {visibleColumns.showDesignation && (
                              <td className="px-6 py-4">
                                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium truncate max-w-[120px] inline-block">{formatDisplay(invite.designation)}</span>
                              </td>
                            )}
                            {visibleColumns.showEmployment && (
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1">
                                  <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium">{formatDisplay(invite.employment_type)}</span>
                                  <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">{formatDisplay(invite.salary_type)}</span>
                                </div>
                              </td>
                            )}
                            {visibleColumns.showStatus && (
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${status.className}`}>
                                  <StatusIcon size={12} />{status.text}
                                </span>
                              </td>
                            )}
                            {visibleColumns.showExpires && (
                              <td className="px-6 py-4"><FaClock className="inline text-gray-400 mr-1" />{formatDateSimple(invite.expires_at)}</td>
                            )}
                            {visibleColumns.showJoiningDate && (
                              <td className="px-6 py-4"><FaCalendarAlt className="inline text-gray-400 mr-1" />{formatDateSimple(invite.joining_date)}</td>
                            )}
                            {visibleColumns.showOvertime && (
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${invite.enable_overtime ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {invite.enable_overtime ? 'Yes' : 'No'}
                                </span>
                              </td>
                            )}
                            {visibleColumns.showDeduction && (
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${invite.enable_deduction ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {invite.enable_deduction ? 'Yes' : 'No'}
                                </span>
                              </td>
                            )}
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <ActionMenu
                                menuId={invite.token}
                                activeId={activeActionMenu}
                                onToggle={(e, id) => setActiveActionMenu((current) => (current === id ? null : id))}
                                actions={[
                                  { label: 'View Details', icon: <FaEye size={14} />, onClick: () => openModal(invite, MODAL_TYPES.VIEW), className: 'text-green-600 hover:text-green-700 hover:bg-green-50' },
                                  ...(invite.status === "pending" && !isExpired(invite.expires_at) ? [
                                    { label: 'Edit Invite', icon: <FaEdit size={14} />, onClick: () => handleEditClick(invite), disabled: updateInviteAccess.disabled, title: updateInviteAccess.disabled ? getAccessMessage(updateInviteAccess) : "", className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50' },
                                    { label: 'Cancel Invite', icon: <FaBan size={14} />, onClick: () => !cancelInviteAccess.disabled && openModal(invite, MODAL_TYPES.CANCEL), disabled: cancelInviteAccess.disabled, title: cancelInviteAccess.disabled ? getAccessMessage(cancelInviteAccess) : "", className: 'text-red-600 hover:text-red-700 hover:bg-red-50' }
                                  ] : []),
                                  ...(invite.status === "pending" ? [
                                    { label: processingId === `resend-${invite.id}` ? 'Resending...' : 'Resend Invite', icon: processingId === `resend-${invite.id}` ? <FaSpinner size={14} className="animate-spin" /> : <FaEnvelope size={14} />, onClick: () => handleResendInvite(invite), disabled: processingId === `resend-${invite.id}` || !invite.id, title: !invite.id ? "Invite ID not found" : "", className: 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50' }
                                  ] : [])
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
            {viewMode === "card" && (
              <ManagementGrid viewMode={viewMode}>
                {invites.map((invite, index) => {
                  const status = getStatusBadge(invite.status, invite.expires_at);
                  const StatusIcon = status.icon;
                  return (
                    <motion.div key={invite.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => openModal(invite, MODAL_TYPES.VIEW)}
                      className="bg-white rounded-xl shadow-md border border-gray-100 p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                      <div className="flex items-start gap-4">
                        <ProfileAvatar
                          record={invite.user}
                          name={invite.user?.name || invite.user?.email}
                          className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                        >
                          <FaUserCircle className="text-white text-3xl" />
                        </ProfileAvatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h3 className="font-bold text-lg text-gray-800 truncate">{invite.user?.name || "No name"}</h3>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${status.className}`}>
                              <StatusIcon size={10} />{status.text}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><FaEnvelope className="text-gray-400" size={10} />{invite.user?.email}</p>
                          <div className="mt-3 space-y-2">
                            <p className="text-sm text-gray-600 flex items-center gap-2"><FaBriefcase className="text-blue-500" />{formatDisplay(invite.designation)}</p>
                            <div className="flex flex-wrap gap-2">
                              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full">{formatDisplay(invite.employment_type)}</span>
                              <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">{formatDisplay(invite.salary_type)}</span>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5 pt-1 text-xs text-gray-500">
                              <div className="flex items-center gap-1.5"><FaClock className="text-indigo-400" /><span>Shift: {invite.shift_start || "N/A"} - {invite.shift_end || "N/A"}</span></div>
                              <div className="flex items-center gap-1.5"><FaClock className="text-amber-400" /><span>Break: {formatDurationDisplay(invite.break_minutes)}</span></div>
                              <div className="flex items-center gap-1.5"><FaClock className="text-rose-400" /><span>Grace: {formatDurationDisplay(invite.grace_minutes)}</span></div>
                              <div className="flex items-center gap-1.5"><FaCalendarAlt className="text-teal-400" /><span>Joining: {formatDateSimple(invite.joining_date)}</span></div>
                              <div className="flex items-center gap-1.5"><FaTag className="text-indigo-400" /><span>OT: {invite.enable_overtime ? 'Yes' : 'No'}</span></div>
                              <div className="flex items-center gap-1.5"><FaTag className="text-rose-400" /><span>Deduction: {invite.enable_deduction ? 'Yes' : 'No'}</span></div>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                              <span className="text-xs text-gray-500"><FaClock className="inline text-yellow-500 mr-1" />Expires: {formatDateSimple(invite.expires_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openModal(invite, MODAL_TYPES.VIEW)} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all hover:scale-110"><FaEye size={16} /></button>
                        {invite.status === "pending" && !isExpired(invite.expires_at) && (
                          <>
                            <button onClick={() => handleEditClick(invite)} disabled={updateInviteAccess.disabled} title={updateInviteAccess.disabled ? getAccessMessage(updateInviteAccess) : ""} className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all hover:scale-110 disabled:opacity-50"><FaEdit size={16} /></button>
                            <button onClick={() => !cancelInviteAccess.disabled && openModal(invite, MODAL_TYPES.CANCEL)} disabled={cancelInviteAccess.disabled} title={cancelInviteAccess.disabled ? getAccessMessage(cancelInviteAccess) : ""} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all hover:scale-110 disabled:opacity-50"><FaBan size={16} /></button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </ManagementGrid>
            )}
            <Pagination
              currentPage={pagination.page}
              totalItems={pagination.total || invites.length}
              itemsPerPage={pagination.limit}
              onPageChange={handlePageChange}
              showInfo={true}
              onLimitChange={changeLimit}
            />
          </>
        )}

        {/* Modals */}
        <AnimatePresence>
          {modalType === MODAL_TYPES.VIEW && selectedInvite && (
            <Modal
              key="view-modal"
              isOpen={true}
              onClose={closeModal}
              title="Invitation Details"
              subtitle="Review sent invitation parameters"
              icon={<FaEye className="h-6 w-6" />}
              size="4xl"
              footer={
                <>
                  <button onClick={closeModal} className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">Close</button>
                  {selectedInvite?.status === "pending" && (
                    <>
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => handleResendInvite(selectedInvite)}
                        disabled={processingId === `resend-${selectedInvite.id}` || !selectedInvite.id}
                        title={!selectedInvite.id ? "Invite ID not found" : ""}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 transition disabled:opacity-50"
                      >
                        {processingId === `resend-${selectedInvite.id}` ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaEnvelope className="h-4 w-4" />}
                        {processingId === `resend-${selectedInvite.id}` ? 'Resending...' : 'Resend Invite'}
                      </motion.button>
                      {!isExpired(selectedInvite?.expires_at) && (
                        <>
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={() => !cancelInviteAccess.disabled && openModal(selectedInvite, MODAL_TYPES.CANCEL)}
                            disabled={cancelInviteAccess.disabled} title={cancelInviteAccess.disabled ? getAccessMessage(cancelInviteAccess) : ""}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-red-200 transition disabled:opacity-50"><FaBan className="h-4 w-4" />Cancel Invite</motion.button>
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={() => handleEditClick(selectedInvite)}
                            disabled={updateInviteAccess.disabled} title={updateInviteAccess.disabled ? getAccessMessage(updateInviteAccess) : ""}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-green-200 transition disabled:opacity-50"><FaEdit className="h-4 w-4" />Edit Invite</motion.button>
                        </>
                      )}
                    </>
                  )}
                </>
              }
            >
              {selectedInvite && (
                <div className="space-y-4">
                  {/* Profile Section – User + Inviter */}
                  <div className="flex flex-col sm:flex-row items-start gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <ProfileAvatar
                        record={selectedInvite.user}
                        name={selectedInvite.user?.name || selectedInvite.user?.email}
                        className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg flex items-center justify-center shrink-0 overflow-hidden"
                      >
                        <FaUserCircle className="text-white text-md" />
                      </ProfileAvatar>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-800 truncate">
                          {selectedInvite.user?.name || "No name"}
                        </h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                          <p className="text-sm text-slate-500 flex items-center gap-2">
                            <FaEnvelope className="text-blue-500 shrink-0" size={14} />
                            {selectedInvite.user?.email}
                          </p>
                          {selectedInvite.user?.phone && (
                            <p className="text-sm text-slate-500 flex items-center gap-2">
                              <FaPhone className="text-green-500 shrink-0" size={14} />
                              {selectedInvite.user.phone}
                            </p>
                          )}
                        </div>
                        {selectedInvite.invited_by && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="text-xs text-slate-500">Invited by</span>
                            <ProfileAvatar
                              record={selectedInvite.invited_by}
                              name={selectedInvite.invited_by.name}
                              className="w-5 h-5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full text-white text-[8px] font-bold overflow-hidden"
                            >
                              {selectedInvite.invited_by.name?.charAt(0)?.toUpperCase() || "?"}
                            </ProfileAvatar>
                            <span className="text-xs font-semibold text-slate-700 truncate max-w-[150px]">
                              {selectedInvite.invited_by.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Overview */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <FaBriefcase className="text-blue-500" /> Overview
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      <InfoItem icon={<FaBriefcase className="text-blue-500" />} label="Designation" value={formatDisplay(selectedInvite.designation)} />
                      <InfoItem icon={<FaUserTie className="text-purple-500" />} label="Employment Type" value={formatDisplay(selectedInvite.employment_type)} />
                      <InfoItem icon={<CurrencyIcon className="text-emerald-500" size={12} />} label="Salary Type" value={formatDisplay(selectedInvite.salary_type)} />
                      <InfoItem icon={<FaShieldAlt className="text-indigo-500" />} label="Permission Package" value={selectedInvite.permission_package?.name || selectedInvite.permission_package_name || "N/A"} />
                      <InfoItem icon={<FaCalendarAlt className="text-rose-500" />} label="Sent Date" value={formatDate(selectedInvite.created_at)} />
                      <InfoItem icon={<FaClock className="text-yellow-500" />} label="Expires At" value={formatDate(selectedInvite.expires_at)} />
                      <InfoItem icon={<FaTag className="text-orange-500" />} label="Status"
                        value={
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${getStatusBadge(selectedInvite.status, selectedInvite.expires_at).className}`}>
                            {getStatusBadge(selectedInvite.status, selectedInvite.expires_at).text}
                          </span>
                        }
                      />
                    </div>
                  </div>

                  {/* Salary Details */}
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 overflow-hidden shadow-sm">
                    <button onClick={() => setShowSalaryDetails(!showSalaryDetails)} className="w-full flex items-center justify-between p-4 hover:bg-emerald-50/50 transition-colors">
                      <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                        <CurrencyIcon className="text-emerald-500" size={12} /> Salary Details
                      </h4>
                      <motion.div animate={{ rotate: showSalaryDetails ? 180 : 0 }}>
                        <FaChevronDown className="w-3 h-3 text-slate-400" />
                      </motion.div>
                    </button>
                    <AnimatePresence>
                      {showSalaryDetails && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-white border-t border-emerald-50">
                          <div className="p-4 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              <InfoItem icon={<CurrencyIcon className="text-emerald-500" size={12} />} label="Base Amount" value={formatCurrency(selectedInvite.base_amount)} />
                              <InfoItem icon={<FaCalendarAlt className="text-cyan-500" />} label="Effective From" value={formatDateSimple(selectedInvite.effective_from)} />
                              <InfoItem icon={<FaCalendarAlt className="text-cyan-500" />} label="Effective To" value={formatDateSimple(selectedInvite.effective_to)} />
                              <InfoItem icon={<FaCalendarAlt className="text-teal-500" />} label="Joining Date" value={formatDateSimple(selectedInvite.joining_date)} />
                            </div>
                            {selectedInvite.salary_components?.length > 0 && (
                              <div className="pt-2 border-t border-slate-100">
                                <button
                                  onClick={() => setShowSalaryComponents(!showSalaryComponents)}
                                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                  Salary Components ({selectedInvite.salary_components.length})
                                  <FaChevronDown className={`w-3 h-3 transition-transform ${showSalaryComponents ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                  {showSalaryComponents && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                      animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                      className="overflow-hidden grid gap-2 sm:grid-cols-2 mt-2"
                                    >
                                      {selectedInvite.salary_components.map((component, idx) => (
                                        <div key={component.id ?? component.component_id ?? `comp-${idx}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-sm">
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                              <p className="truncate text-[11px] font-bold text-slate-700">{component.component_name || component.name || `Component ${component.component_id}`}</p>
                                              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{component.component_code || component.code || "N/A"}</p>
                                            </div>
                                            <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[10px] font-bold uppercase text-slate-600 ring-1 ring-slate-200">{component.calc_type || "N/A"}</span>
                                          </div>
                                          <p className="mt-2 text-sm font-bold text-emerald-700">{component.calc_type === "percentage" ? `${component.calc_value}%` : formatCurrency(component.calc_value)}</p>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Attendance */}
                  <div className="rounded-xl border border-purple-100 bg-purple-50/30 overflow-hidden shadow-sm">
                    <button onClick={() => setShowAttendanceDetails(!showAttendanceDetails)} className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition-colors">
                      <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                        <FaFingerprint className="text-purple-500" /> Attendance
                      </h4>
                      <motion.div animate={{ rotate: showAttendanceDetails ? 180 : 0 }}>
                        <FaChevronDown className="w-3 h-3 text-slate-400" />
                      </motion.div>
                    </button>
                    <AnimatePresence>
                      {showAttendanceDetails && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-white border-t border-purple-50">
                          <div className="p-4 space-y-3">
                            <div className="flex flex-wrap gap-4">
                              <InfoItem icon={<FaCheckCircle className="text-emerald-500" />} label="Auto Approve" value={formatBoolean(selectedInvite.auto_approve)} />
                              <InfoItem icon={<FaTag className="text-indigo-500" />} label="Overtime" value={formatBoolean(selectedInvite.enable_overtime)} />
                              <InfoItem icon={<FaTag className="text-rose-500" />} label="Deduction" value={formatBoolean(selectedInvite.enable_deduction)} />
                            </div>
                            {selectedInvite.attendance_methods?.length > 0 && (
                              <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Methods</label>
                                <div className="flex flex-wrap gap-2">
                                  {selectedInvite.attendance_methods.map((method, idx) => (
                                    <span key={`att-${idx}`} className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-700 text-[11px] font-semibold rounded-full border border-slate-100 shadow-sm capitalize">
                                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                      {formatAttendanceMethod(method)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Shift & Schedule */}
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 overflow-hidden shadow-sm">
                    <button onClick={() => setShowShiftSchedule(!showShiftSchedule)} className="w-full flex items-center justify-between p-4 hover:bg-indigo-50/50 transition-colors">
                      <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                        <FaClock className="text-indigo-500" /> Shift & Schedule
                      </h4>
                      <motion.div animate={{ rotate: showShiftSchedule ? 180 : 0 }}>
                        <FaChevronDown className="w-3 h-3 text-slate-400" />
                      </motion.div>
                    </button>
                    <AnimatePresence>
                      {showShiftSchedule && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-white border-t border-indigo-50">
                          <div className="p-4 space-y-3">
                            <div className="flex flex-wrap gap-3">
                              <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                                <span className="text-[9px] text-slate-400 font-bold uppercase">Shift</span>
                                <span className="text-xs font-bold text-slate-700 block">{selectedInvite.shift_start || 'N/A'} - {selectedInvite.shift_end || 'N/A'}</span>
                              </div>
                              <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                                <span className="text-[9px] text-slate-400 font-bold uppercase">Break</span>
                                <span className="text-xs font-bold text-slate-700 block">{formatDurationDisplay(selectedInvite.break_minutes)}</span>
                              </div>
                              <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                                <span className="text-[9px] text-slate-400 font-bold uppercase">Grace</span>
                                <span className="text-xs font-bold text-slate-700 block">{formatDurationDisplay(selectedInvite.grace_minutes)}</span>
                              </div>
                            </div>
                            {selectedInvite.weekends?.length > 0 && (
                              <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Weekends</label>
                                <div className="flex flex-wrap gap-2">
                                  {selectedInvite.weekends.map((weekend, idx) => (
                                    <div key={`weekend-${idx}`} className="text-center px-3 py-2 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-slate-100 shadow-sm min-w-[120px]">
                                      <span className="text-sm text-light-500 capitalize">{formatWeekendDay(weekend)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Permissions */}
                  {selectedInvite.permissions?.length > 0 && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/30 overflow-hidden shadow-sm">
                      <button onClick={() => setShowPermissions(!showPermissions)} className="w-full flex items-center justify-between p-4 hover:bg-blue-50/50 transition-colors">
                        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                          <FaShieldAlt className="text-blue-500" /> Assigned Permissions
                        </h4>
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-700 font-bold">{selectedInvite.permissions.length}</span>
                          <motion.div animate={{ rotate: showPermissions ? 180 : 0 }}>
                            <FaChevronDown className="w-3 h-3 text-slate-400" />
                          </motion.div>
                        </div>
                      </button>
                      <AnimatePresence>
                        {showPermissions && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-white border-t border-blue-50">
                            <div className="p-3 flex flex-wrap gap-2">
                              {selectedInvite.permissions.map((perm, idx) => (
                                <span key={perm.id || `perm-${idx}`} className="px-3 py-1.5 bg-slate-50 text-slate-600 text-[11px] font-semibold rounded-lg border border-slate-100 shadow-sm">{perm.name}</span>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              )}
            </Modal>
          )}

          {modalType === MODAL_TYPES.CANCEL && selectedInvite && (
            <Modal
              key="cancel-modal"
              isOpen={true}
              onClose={closeModal}
              title="Cancel Invitation"
              subtitle="This action cannot be undone"
              icon={<FaBan className="h-6 w-6 text-red-500" />}
              size="md"
              footer={
                <>
                  <button onClick={closeModal} className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">Keep</button>
                  <button onClick={() => selectedInvite?.token && handleCancelInvite(selectedInvite.token)} disabled={!selectedInvite || processingId === selectedInvite?.token || cancelInviteAccess.disabled} title={cancelInviteAccess.disabled ? getAccessMessage(cancelInviteAccess) : ""}
                    className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-100 hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-2">
                    {processingId === selectedInvite?.token && <FaSpinner className="animate-spin" />}
                    Confirm Cancellation
                  </button>
                </>
              }
            >
              {selectedInvite && (
                <div className="text-center py-4">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.5 }} className="w-24 h-24 bg-gradient-to-br from-red-100 to-rose-100 rounded-full flex items-center justify-center mx-auto mb-4"><FaBan className="text-4xl text-red-600" /></motion.div>
                  <p className="text-xl text-gray-700 mb-2 font-semibold">Are you sure?</p>
                  <p className="text-gray-500">You are about to cancel the invitation for <span className="font-semibold text-red-600">{selectedInvite.user?.email}</span>.</p>
                </div>
              )}
            </Modal>
          )}
        </AnimatePresence>

        <EditStaffModal
          isOpen={isEditModalOpen}
          onClose={() => { setIsEditModalOpen(false); setEditingInvite(null); }}
          onSuccess={handleEditSuccess}
          staffData={editingInvite}
          submitDisabled={updateInviteAccess.disabled}
          submitTitle={updateInviteAccess.disabled ? getAccessMessage(updateInviteAccess) : ""}
        />
      </div>
    </div>
  );
}