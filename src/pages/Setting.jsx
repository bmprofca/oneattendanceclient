import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBuilding, FaPlus, FaShieldAlt,
  FaBars, FaTimes, FaSpinner, FaCog, FaSync
} from "react-icons/fa";
import { FiLock, FiMonitor, FiTrash2, FiChevronDown, FiLogOut } from "react-icons/fi";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import CompanyCard from "../components/Settings/CompanyCard";
import CreateCompanyModal from "../components/CompanyModals/CreateCompanyModal";
import EditCompanyModal from "../components/CompanyModals/EditCompanyModal";
import ModalScrollLock from "../components/ModalScrollLock";
import Skeleton from "../components/SkeletonComponent";
import apiCall, { getMediaUrl } from "../utils/api";
import { TabbedManagementHub } from "../components/common";
import { usePasswordValidation } from "../hooks/usePasswordValidation";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// (Kept for potential future use, not used in the new sub‑tab layout)
const SecurityCard = ({ title, icon, badge, danger, headerAction, children }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={`bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border mt-4 overflow-hidden transition-all
    ${danger ? "border-red-100" : "border-gray-100"}`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left hover:bg-gray-50/70 transition-colors
        ${danger ? "hover:bg-red-50/40" : ""}`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={`text-base ${danger ? "text-red-500" : "text-indigo-500"}`}>{icon}</span>
          <span className={`text-sm sm:text-base font-semibold ${danger ? "text-red-700" : "text-gray-800"}`}>{title}</span>
          {badge && (
            <span className="bg-indigo-50 text-indigo-600 text-xs font-bold px-2.5 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {open && headerAction}
          <FiChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="px-4 sm:px-6 pb-5 border-t border-gray-100">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
};

const getDeviceIcon = (name) => {
  const n = name.toLowerCase();
  if (n.includes("ios") || n.includes("safari")) return "🍎";
  if (n.includes("android") || n.includes("mobile")) return "📱";
  return "💻";
};

const timeAgo = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr + " UTC")) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ─── Companies Tab ──────────────────────────────────────────────

const CompaniesTab = () => {
  const { user, loading, refreshUser, companies, setCompanies, company } = useAuth();

  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [activeCompany, setActiveCompany] = useState(null);
  const [editingCompany, setEditingCompany] = useState(null);

  useEffect(() => {
    loadActiveCompany();
  }, []);

  useEffect(() => {
    if (user && companies) {
      setCompanies(companies);

      if (company) {
        const matchedCompany = companies.find((item) => item.id === company.id) || company;
        setActiveCompany(matchedCompany);
        localStorage.setItem("company", JSON.stringify(matchedCompany));
        return;
      }

      const storedCompany = JSON.parse(localStorage.getItem("company"));
      if (storedCompany) {
        const companyExists = companies.some(c => c.id === storedCompany.id);
        if (!companyExists) {
          localStorage.removeItem("company");
          setActiveCompany(null);
        } else {
          setActiveCompany(storedCompany);
        }
      }
    }
  }, [user, companies, company, setCompanies]);

  const loadActiveCompany = () => {
    const storedCompany = JSON.parse(localStorage.getItem("company"));
    if (storedCompany) {
      setActiveCompany(storedCompany);
    }
  };

  const selectCompany = async (company) => {
    localStorage.setItem("company", JSON.stringify(company));
    setActiveCompany(company);
    await refreshUser();
    toast.success(`Switched to ${company.name}`);
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setOpenEditModal(true);
  };

  const handleEditSubmit = async (companyId, updatedData) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        toast.error("Authentication expired. Please login again.");
        return;
      }

      const payload = {
        id: companyId,
        ...Object.fromEntries(
          Object.entries(updatedData).filter(([_, value]) => value !== "" && value !== null && value !== undefined)
        )
      };

      const response = await apiCall('/company/update', 'PUT', payload);

      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(result.message || "Failed to update company");
        return;
      }

      if (result.success) {
        if (refreshUser) {
          await refreshUser();
        }

        setOpenEditModal(false);
        setEditingCompany(null);
        toast.success(result.message || "Company updated successfully! 🎉");
      }
    } catch (error) {
      console.error("Company update error:", error);
      toast.error("Network error. Please check your internet connection.");
    }
  };

  const handleDelete = (company) => {
    setCompanyToDelete(company);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!companyToDelete) return;
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        toast.error("Authentication expired. Please login again.");
        return;
      }

      const response = await apiCall('/company/delete', 'DELETE', {
        id: companyToDelete.id
      });

      const result = await response.json();

      if (response.ok && result.success) {
        await refreshUser();

        if (activeCompany?.id === companyToDelete.id) {
          localStorage.removeItem("company");
          setActiveCompany(null);
        }

        toast.success("Company deleted successfully");
      } else {
        toast.error(result.message || "Failed to delete company");
      }

    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Network error. Please try again.");
    }

    setShowDeleteModal(false);
    setCompanyToDelete(null);
  };

  const handleAddCompanyClick = () => {
    setOpenCreateModal(true);
  };

  if (loading) {
    return <Skeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center p-6 bg-white rounded-xl shadow-xl">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Session Expired</h2>
          <p className="text-sm text-gray-600 mb-6">Please login again to continue</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-gray-100 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 text-gray-800">
            <FaBuilding className="text-indigo-600 text-base sm:text-xl" />
            <span>Manage Companies</span>
          </h2>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={handleAddCompanyClick}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 sm:px-4 py-2 rounded-xl text-sm sm:text-base hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl w-full sm:w-auto"
            >
              <FaPlus className="w-4 h-4" />
              <span className="whitespace-nowrap">Create Your Company</span>
            </button>
          </div>
        </div>

        {activeCompany && companies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 flex items-center gap-4 shadow-sm"
          >
            <div className="shrink-0">
              {activeCompany.logo_url ? (
                <img
                  src={getMediaUrl(activeCompany.logo_url)}
                  alt="Company Logo"
                  className="w-16 h-16 rounded-xl object-cover border border-white shadow-md bg-white"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`w-16 h-16 rounded-xl bg-indigo-600 items-center justify-center shadow-lg ${activeCompany.logo_url ? 'hidden' : 'flex'}`}>
                <FaBuilding className="text-white text-2xl" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider">Active Workspace</span>
                {activeCompany.role && (
                  <span className="px-2 py-0.5 rounded-full bg-white border border-indigo-100 text-indigo-600 text-[10px] font-bold uppercase tracking-wider">
                    {activeCompany.role.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <p className="font-bold text-gray-900 text-lg truncate leading-tight">{activeCompany.name}</p>
              <p className="text-sm text-indigo-600/70 font-medium truncate">{activeCompany.legal_name || "Primary Organization"}</p>
            </div>
          </motion.div>
        )}

        <div className="space-y-3">
          {companies.length === 0 ? (
            <div className="text-center py-8 sm:py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 px-4">
              <FaBuilding className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
              <p className="text-sm sm:text-base text-gray-500 mb-3 sm:mb-4">No companies found</p>
              <button
                onClick={() => setOpenCreateModal(true)}
                className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium bg-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-sm sm:text-base shadow-sm border border-gray-200 hover:border-indigo-300 transition-all"
              >
                <FaPlus className="w-3 h-3 sm:w-4 sm:h-4" />
                Create your first company
              </button>
            </div>
          ) : (
            [...companies]
              .sort((a, b) => (a.id === activeCompany?.id ? -1 : b.id === activeCompany?.id ? 1 : 0))
              .map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  isActive={activeCompany?.id === company.id}
                  canManageCompany={company.role !== "employee"}
                  onSwitch={selectCompany}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))
          )}
        </div>
      </div>

      <CreateCompanyModal
        isOpen={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        onCompanyCreated={() => {
          refreshUser();
          setOpenCreateModal(false);
        }}
        userId={user?.id}
      />

      <EditCompanyModal
        isOpen={openEditModal}
        onClose={() => {
          setOpenEditModal(false);
          setEditingCompany(null);
        }}
        onSuccess={handleEditSubmit}
        company={editingCompany}
      />

      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
            <ModalScrollLock />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="flex w-full max-w-lg max-h-[90vh] flex-col justify-center overflow-y-auto rounded-xl bg-white p-6 shadow-xl sm:p-7"
            >
              <h2 className="text-lg font-semibold text-gray-800 mb-2">
                Delete Company
              </h2>

              <p className="text-gray-600 text-sm mb-6">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{companyToDelete?.name}</span>?
                This action cannot be undone.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-lg border hover:bg-gray-100"
                >
                  Cancel
                </button>

                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Security Tab (UPDATED) ──────────────────────────────────────────────────

const SecurityTab = () => {
  const { user, loading, refreshUser } = useAuth();
  const { validatePassword } = usePasswordValidation();

  const [securitySubTab, setSecuritySubTab] = useState("password"); // "password" | "sessions" | "ownership"

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [keepLogin, setKeepLogin] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loggingOutId, setLoggingOutId] = useState(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showAccountDeleteModal, setShowAccountDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState("confirm");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleteOtp, setDeleteOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const response = await apiCall('/auth/sessions', 'GET');
      const result = await response.json();
      if (result.success) {
        setSessions(result.data || []);
      } else {
        toast.error(result.message || "Failed to load sessions");
      }
    } catch {
      toast.error("Failed to load sessions");
    } finally {
      setLoadingSessions(false);
    }
  };

  const forceLogout = async (sessionId) => {
    setLoggingOutId(sessionId);
    try {
      const response = await apiCall('/auth/logout-session', 'POST', { session_id: sessionId });
      const data = await response.json();
      if (data.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        toast.success("Device logged out");
      } else {
        toast.error(data.message || "Failed to logout session");
      }
    } catch {
      toast.error("Failed to logout session");
    } finally {
      setLoggingOutId(null);
    }
  };

  const forceLogoutAll = async () => {
    setLoggingOutAll(true);
    try {
      const response = await apiCall('/auth/logout-all', 'POST');
      const data = await response.json();
      if (data.success) {
        setSessions((prev) => prev.filter((s) => s.is_current));
        toast.success("All other devices logged out");
      } else {
        toast.error(data.message || "Failed to logout all");
      }
    } catch {
      toast.error("Failed to logout all sessions");
    } finally {
      setLoggingOutAll(false);
    }
  };

  const handleDeleteAccount = () => {
    setDeleteConfirmText("");
    setDeleteEmail("");
    setDeleteOtp("");
    setDeleteStep("confirm");
    setShowAccountDeleteModal(true);
  };

  const handleSendDeleteOtp = async () => {
    if (!deleteEmail.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    if (deleteEmail.trim().toLowerCase() !== user?.email?.toLowerCase()) {
      toast.error("Email does not match your account email");
      return;
    }
    setIsSendingOtp(true);
    try {
      const response = await apiCall('/users/delete/request-otp', 'POST', { email: deleteEmail });
      const data = await response.json();
      if (data.success) {
        setDeleteStep("otp");
        toast.success("OTP sent to your email");
      } else {
        toast.error(data.message || "Failed to send OTP");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deleteOtp.trim()) {
      toast.error("Please enter the OTP");
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const response = await apiCall('/users/delete/confirm', 'DELETE', {
        email: deleteEmail,
        otp: deleteOtp,
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Account deleted successfully");
        setShowAccountDeleteModal(false);
        localStorage.clear();
        window.location.href = '/login';
      } else {
        toast.error(data.message || "Invalid OTP. Please try again.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const validatePasswords = () => {
    if (!currentPassword.trim()) {
      toast.error('Current password is required');
      return false;
    }
    if (!newPassword.trim()) {
      toast.error('New password is required');
      return false;
    }
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      toast.error('New password does not meet security requirements');
      return false;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return false;
    }
    if (currentPassword === newPassword) {
      toast.error('New password must be different from current password');
      return false;
    }
    return true;
  };

  const handlePasswordUpdate = async () => {
    if (!validatePasswords()) return;

    setIsUpdatingPassword(true);

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        toast.error("Authentication expired. Please login again.");
        return;
      }

      const response = await apiCall('/users/update-password', 'PUT', {
        user_id: user?.id,
        old_password: currentPassword,
        new_password: newPassword,
        keep_login: keepLogin,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message || "Password updated successfully!");
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setKeepLogin(false);
      } else {
        if (response.status === 401) {
          toast.error("Current password is incorrect");
        } else {
          toast.error(data.message || "Failed to update password");
        }
      }
    } catch (error) {
      console.error("Password update error:", error);
      toast.error("Network error. Please check your connection and try again.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (loading) {
    return <Skeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center p-6 bg-white rounded-xl shadow-xl">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Session Expired</h2>
          <p className="text-sm text-gray-600 mb-6">Please login again to continue</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Premium capsule sub-tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-gray-50 border border-gray-200/80 rounded-xl mb-6 max-w-lg">
        <button
          onClick={() => setSecuritySubTab("password")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all duration-300
          ${securitySubTab === "password"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
            }`}
        >
          <FiLock className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">Change Password</span>
        </button>
        <button
          onClick={() => setSecuritySubTab("sessions")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all duration-300
          ${securitySubTab === "sessions"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
            }`}
        >
          <FiMonitor className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">Sessions</span>
        </button>
        <button
          onClick={() => setSecuritySubTab("ownership")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all duration-300
          ${securitySubTab === "ownership"
              ? "bg-white text-red-600 shadow-sm"
              : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
            }`}
        >
          <FiTrash2 className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">Account Ownership</span>
        </button>
      </div>

      {/* Change Password Sub-Tab */}
      {securitySubTab === "password" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-xl border border-gray-100 p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
              <FiLock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-800">Change Password</h3>
              <p className="text-xs text-slate-500">Update your account login password to ensure security</p>
            </div>
          </div>

          <div className="space-y-4 w-full">
            <input
              type="password"
              placeholder="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              disabled={isUpdatingPassword}
            />
            <div className="space-y-1">
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                disabled={isUpdatingPassword}
              />
              {newPassword && (
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1.5 text-xs mt-1.5">
                  <p className="font-semibold text-gray-700">Password requirements:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <div className={`flex items-center gap-1.5 ${validatePassword(newPassword).minLength ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                      <span>{validatePassword(newPassword).minLength ? '✓' : '•'}</span>
                      <span>At least 8 characters</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${validatePassword(newPassword).hasUpper ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                      <span>{validatePassword(newPassword).hasUpper ? '✓' : '•'}</span>
                      <span>At least 1 uppercase letter</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${validatePassword(newPassword).hasNumber ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                      <span>{validatePassword(newPassword).hasNumber ? '✓' : '•'}</span>
                      <span>At least 1 number</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${validatePassword(newPassword).hasSpecial ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                      <span>{validatePassword(newPassword).hasSpecial ? '✓' : '•'}</span>
                      <span>At least 1 special character</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <input
              type="password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              disabled={isUpdatingPassword}
            />

            {/* Premium Caution & Keep Login Switch */}
            <div className="p-4 bg-amber-50/60 border border-amber-100/70 rounded-2xl space-y-3">
              <div className="flex items-start gap-2.5">
                <span className="text-amber-500 mt-0.5 text-sm">⚠️</span>
                <div>
                  <p className="text-xs font-bold text-amber-800">Security Warning</p>
                  <p className="text-[11px] text-amber-700/90 leading-relaxed mt-0.5">
                    By default, changing your password will automatically log you out of all other devices for security.
                    Turn on the switch below if you wish to remain logged in on other active devices.
                  </p>
                </div>
              </div>

              <label className="flex items-center justify-between cursor-pointer select-none py-1 border-t border-amber-100/50 pt-2.5">
                <span className="text-xs font-semibold text-slate-700">Keep other devices logged in</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={keepLogin}
                    onChange={(e) => setKeepLogin(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </div>
              </label>
            </div>

            <button
              onClick={handlePasswordUpdate}
              disabled={isUpdatingPassword}
              className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdatingPassword ? (
                <><FaSpinner className="w-4 h-4 animate-spin inline mr-2" />Updating...</>
              ) : "Update Password"}
            </button>
          </div>
        </motion.div>
      )}

      {/* Sessions Sub-Tab */}
      {securitySubTab === "sessions" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-xl border border-gray-100 p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                <FiMonitor className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-800">Active Sessions</h3>
                <p className="text-xs text-slate-500">Manage all browser sessions and devices currently logged into your account</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Refresh button */}
              <button
                onClick={fetchSessions}
                disabled={loadingSessions}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-gray-500 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh sessions"
              >
                <FaSync className={`w-3 h-3 ${loadingSessions ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline whitespace-nowrap">Refresh</span>
              </button>

              <button
                onClick={forceLogoutAll}
                disabled={loggingOutAll || sessions.filter((s) => !s.is_current).length === 0}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto"
              >
                {loggingOutAll ? <FaSpinner className="w-3 h-3 animate-spin" /> : <FiLogOut className="w-3 h-3" />}
                <span className="whitespace-nowrap">Logout All Other Devices</span>
              </button>
            </div>
          </div>

          {loadingSessions ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
              <FaSpinner className="animate-spin w-4 h-4" /> Loading sessions...
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all flex-wrap
                  ${session.is_current
                      ? "bg-indigo-50/60 border-indigo-200"
                      : "bg-gray-50 border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30"
                    }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0
                    ${session.device_name.toLowerCase().includes("ios") ? "bg-pink-100"
                        : session.device_name.toLowerCase().includes("android") ? "bg-green-100"
                          : "bg-indigo-100"}`}>
                      {getDeviceIcon(session.device_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800 truncate">{session.device_name}</span>
                        {session.is_current && (
                          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            This Device
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-500">{session.ip_address}</span>
                        {session.location?.latitude && (
                          <span className="text-xs text-gray-400">
                            📍 {parseFloat(session.location.latitude).toFixed(3)}, {parseFloat(session.location.longitude).toFixed(3)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Last active {timeAgo(session.last_active)} · Signed in {timeAgo(session.login_at)}
                      </p>
                    </div>
                  </div>
                  {session.is_current ? (
                    <span className="text-xs text-indigo-500 font-semibold px-2">✓ Active</span>
                  ) : (
                    <button
                      onClick={() => forceLogout(session.id)}
                      disabled={loggingOutId === session.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-500 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {loggingOutId === session.id ? <FaSpinner className="w-3 h-3 animate-spin" /> : <FiLogOut className="w-3 h-3" />}
                      Logout
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Account Ownership Sub-Tab */}
      {securitySubTab === "ownership" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-xl border border-gray-100 p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-500">
              <FiTrash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-800">Account Ownership & Deletion</h3>
              <p className="text-xs text-slate-500">Manage your profile state and permanent deletion options</p>
            </div>
          </div>

          <div className="bg-red-50/50 rounded-xl border border-red-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-500 flex-shrink-0">
                <FiTrash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-bold text-red-700">Delete Account</h4>
                <p className="text-xs text-red-500">Permanently remove your account and all associated workspace records. This is irreversible.</p>
              </div>
            </div>
            <button
              onClick={handleDeleteAccount}
              className="w-full sm:w-auto px-6 py-2.5 bg-red-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-red-700 transition-all shadow-md active:scale-95 flex-shrink-0"
            >
              Delete Account
            </button>
          </div>
        </motion.div>
      )}

      {/* Account Delete Modal */}
      <AnimatePresence>
        {showAccountDeleteModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 px-4">
            <ModalScrollLock />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiTrash2 className="text-white w-5 h-5" />
                  <h2 className="text-white font-semibold text-base">Delete Account</h2>
                </div>
                <button
                  onClick={() => setShowAccountDeleteModal(false)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <FaTimes className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6">
                <div className="flex gap-3 bg-red-50 border border-red-100 rounded-xl p-3 mb-5">
                  <span className="text-red-500 text-lg flex-shrink-0 mt-0.5">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold text-red-700">This is irreversible</p>
                    <p className="text-xs text-red-500 mt-0.5">
                      Your account, data, and all associated records will be permanently erased.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-5">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold
              ${deleteStep === "confirm" ? "bg-red-600 text-white" : "bg-red-100 text-red-600"}`}>
                    1
                  </div>
                  <span className={`text-[10px] font-medium ${deleteStep === "confirm" ? "text-red-700" : "text-red-400"}`}>
                    Confirm
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold
              ${deleteStep === "email" ? "bg-red-600 text-white" : deleteStep === "confirm" ? "bg-gray-100 text-gray-400" : "bg-red-100 text-red-600"}`}>
                    2
                  </div>
                  <span className={`text-[10px] font-medium ${deleteStep === "email" ? "text-red-700" : "text-gray-400"}`}>
                    Verify
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold
              ${deleteStep === "otp" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                    3
                  </div>
                  <span className={`text-[10px] font-medium ${deleteStep === "otp" ? "text-red-700" : "text-gray-400"}`}>
                    OTP
                  </span>
                </div>

                <AnimatePresence mode="wait">
                  {deleteStep === "confirm" ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Safety Check
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
                          Please type <span className="font-bold text-red-600 underline">DELETE</span> below to confirm you want to proceed with account deletion.
                        </p>
                        <input
                          type="text"
                          placeholder="DELETE"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && deleteConfirmText === "DELETE" && setDeleteStep("email")}
                          className="w-full px-4 py-2.5 text-sm border border-red-100 rounded-xl focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none transition-all uppercase"
                        />
                      </div>

                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={() => setShowAccountDeleteModal(false)}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => setDeleteStep("email")}
                          disabled={deleteConfirmText !== "DELETE"}
                          className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Continue
                        </button>
                      </div>
                    </motion.div>
                  ) : deleteStep === "email" ? (
                    <motion.div
                      key="email"
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Confirm your email address
                        </label>
                        <input
                          type="email"
                          placeholder={"your@email.com"}
                          value={deleteEmail}
                          onChange={(e) => setDeleteEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendDeleteOtp()}
                          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none transition-all"
                        />
                        <p className="text-xs text-gray-400 mt-1.5">
                          Must match the email associated with your account.
                        </p>
                      </div>

                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={() => setDeleteStep("confirm")}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleSendDeleteOtp}
                          disabled={isSendingOtp || !deleteEmail.trim()}
                          className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isSendingOtp ? (
                            <><FaSpinner className="w-3.5 h-3.5 animate-spin" />Sending...</>
                          ) : (
                            "Request OTP"
                          )}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="otp"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Enter the OTP sent to
                        </label>
                        <p className="text-sm font-semibold text-indigo-600 mb-3">{deleteEmail}</p>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="• • • • • •"
                          value={deleteOtp}
                          onChange={(e) => setDeleteOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          onKeyDown={(e) => e.key === "Enter" && handleConfirmDeleteAccount()}
                          className="w-full px-4 py-3 text-center text-xl tracking-[0.5em] font-mono border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none transition-all"
                        />
                        <button
                          onClick={() => {
                            setDeleteStep("email");
                            setDeleteOtp("");
                          }}
                          className="text-xs text-gray-400 hover:text-indigo-500 mt-2 block transition-colors"
                        >
                          ← Change email
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={handleSendDeleteOtp}
                          disabled={isSendingOtp}
                          className="text-xs text-gray-500 hover:text-indigo-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {isSendingOtp ? (
                            <><FaSpinner className="w-3 h-3 animate-spin" />Resending...</>
                          ) : (
                            "Resend OTP"
                          )}
                        </button>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setDeleteStep("email")}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleConfirmDeleteAccount}
                          disabled={isVerifyingOtp || deleteOtp.length < 4}
                          className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isVerifyingOtp ? (
                            <><FaSpinner className="w-3.5 h-3.5 animate-spin" />Verifying...</>
                          ) : (
                            "Delete My Account"
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Hub Definitions ───────────────────────────────────────────────────

const SETTINGS_HUB_TABS = [
  {
    id: "companies",
    label: "Companies",
    shortLabel: "Companies",
    description: "Manage your companies and organizational workspaces.",
    icon: FaBuilding,
    component: CompaniesTab,
    accent: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "security",
    label: "Security",
    shortLabel: "Security",
    description: "Update your password, manage active sessions, and delete account.",
    icon: FaShieldAlt,
    component: SecurityTab,
    accent: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
];

const SettingsPage = () => {
  return (
    <div className="min-h-screen">
      {/* Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none hidden sm:block">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>

      <TabbedManagementHub
        routePath="/settings"
        defaultTab="companies"
        title="Settings"
        description="Manage your account settings, companies, active sessions, and security preferences."
        eyebrow={<><FaCog size={11} /> Settings</>}
        accent="blue"
        tabs={SETTINGS_HUB_TABS}
        accessDeniedTitle="Access Denied"
        accessDeniedDescription="You do not have access to these settings."
        accessDeniedIcon={FaShieldAlt}
      />

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
};

export default SettingsPage;