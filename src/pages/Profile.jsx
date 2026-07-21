import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaEnvelope, FaPhone, FaBuilding, FaMapMarkerAlt, FaShieldAlt,
    FaCrown, FaCheckCircle, FaCalendarAlt, FaIdBadge,
    FaGlobe, FaCity, FaUserCircle, FaHashtag, FaBolt, FaLayerGroup,
    FaUserShield, FaUser, FaSave, FaSpinner, FaExclamationTriangle
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import apiCall, { uploadFile, getMediaUrl } from "../utils/api";
import Modal from "../components/Modal";
import CategoryPermissionSelector from "../components/common/CategoryPermissionSelector";
import { CountryCodeModal, getFlagEmoji } from "../components/common";
import countryCodes from "../utils/countryCodes.json";

// ─── Constants & Helpers ─────────────────────────────────────────────────────

const PROFILE_TABS = ["Overview", "Edit Profile", "Companies", "Permissions"];

const getInitials = (name) =>
    name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
    });
};

const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};


// ─── Main ─────────────────────────────────────────────────────────────────────
const getContactValue = (user, key) => String(user?.[key] || "").trim();
const getFullPhone = (countryCode, phone) => `${String(countryCode || "").trim()}${String(phone || "").trim()}`;
const formatPhoneDisplay = (phone) => {
    if (!phone) return "";
    const p = String(phone).trim();
    if (!p) return "";
    if (p.startsWith("+")) {
        // e.g. "+919547444749" → "+91 9547444749"
        const match = p.match(/^(\+\d{1,4})(\d+)$/);
        return match ? `${match[1]} ${match[2]}` : p;
    }
    // Try to detect embedded country code (e.g. "919547444749" → "+91 9547444749")
    const sorted = [...countryCodes].sort((a, b) => b.dial_code.length - a.dial_code.length);
    for (const c of sorted) {
        if (p.startsWith(c.dial_code) && p.length > c.dial_code.length) {
            return `+${c.dial_code} ${p.slice(c.dial_code.length)}`;
        }
    }
    return p; // plain local number — show as-is
};
const formatPermissionText = (value) =>
    value ? String(value).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "";

const getPermissionCategory = (permission) => {
    if (permission?.category || permission?.permission_category) {
        return formatPermissionText(permission.category || permission.permission_category);
    }

    const code = String(permission?.code || permission?.permission_code || "");
    const [prefix] = code.split("_");
    return formatPermissionText(prefix) || "Other";
};

export default function ProfilePage() {
    const { userDetails, loading, activeRole, companies, permissions, refreshUser } = useAuth();
    const [activeTab, setActiveTab] = useState("Overview");
    const [profileForm, setProfileForm] = useState({
        name: "",
        profile_picture: "",
        whatsapp_country_code: "+91",
        whatsapp: "",
        profession: "",
    });
    const [originalProfile, setOriginalProfile] = useState({
        name: "",
        profile_picture: "",
        whatsapp_country_code: "+91",
        whatsapp: "",
        profession: "",
    });
    const [contactModal, setContactModal] = useState(null);
    const [contactForm, setContactForm] = useState({
        email: "",
        country_code: "+91",
        phone: "",
        otp: "",
    });
    const [contactStep, setContactStep] = useState("form");
    const [pendingContactValue, setPendingContactValue] = useState("");
    const [isRequestingContactOtp, setIsRequestingContactOtp] = useState(false);
    const [isVerifyingContactOtp, setIsVerifyingContactOtp] = useState(false);
    const [imagePreview, setImagePreview] = useState(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [isWhatsappCodeModalOpen, setIsWhatsappCodeModalOpen] = useState(false);
    const [isContactCodeModalOpen, setIsContactCodeModalOpen] = useState(false);
    const fileInputRef = useRef(null);
    const currentUser = userDetails?.user;
    const groupedPermissions = useMemo(() => (
        (permissions || []).map((permission, index) => {
            const id = permission.permission_id ?? permission.id ?? index + 1;
            const fallbackName = formatPermissionText(permission.permission_code ?? permission.code) || "Permission";
            return {
                id,
                code: permission.permission_code ?? permission.code ?? "",
                name: permission.permission_name ?? permission.name ?? fallbackName,
                action: permission.permission_action ?? permission.action ?? "",
                category: getPermissionCategory(permission),
            };
        })
    ), [permissions]);
    const groupedPermissionIds = useMemo(() => groupedPermissions.map((permission) => permission.id), [groupedPermissions]);

    useEffect(() => {
        if (!currentUser) return;

        let wcc = "+91";
        let wn = currentUser.whatsapp || "";
        if (wn.startsWith("+")) {
            // e.g. "+919547444749" → wcc="+91", wn="9547444749"
            const match = wn.match(/^(\+\d{1,4})(.*)$/);
            if (match) {
                wcc = match[1];
                wn = match[2];
            }
        } else if (wn.length > 0) {
            // e.g. "929547444749" stored without + → try to detect country code
            const sortedCodes = [...countryCodes].sort((a, b) => b.dial_code.length - a.dial_code.length);
            for (const c of sortedCodes) {
                if (wn.startsWith(c.dial_code)) {
                    wcc = "+" + c.dial_code;
                    wn = wn.slice(c.dial_code.length);
                    break;
                }
            }
        }

        const nextProfile = {
            name: currentUser.name || "",
            profile_picture: currentUser.profile_picture || "",
            whatsapp_country_code: wcc,
            whatsapp: wn,
            profession: currentUser.profession || "",
        };

        setProfileForm(nextProfile);
        setOriginalProfile(nextProfile);
        setImagePreview(
            currentUser.profile_picture
                ? getMediaUrl(currentUser.profile_picture)
                : null
        );
    }, [currentUser?.id, currentUser?.name, currentUser?.profile_picture, currentUser?.whatsapp, currentUser?.profession]);

    const handleProfileChange = (event) => {
        const { name, value } = event.target;
        if (name === "whatsapp") {
            setProfileForm((prev) => ({ ...prev, whatsapp: value.replace(/\D/g, "").slice(0, 10) }));
        } else {
            setProfileForm((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleImageUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be less than 5MB");
            return;
        }

        setIsUploadingImage(true);
        try {
            const url = await uploadFile(file);
            setProfileForm((prev) => ({ ...prev, profile_picture: url }));
            setImagePreview(url);
            toast.success("Image uploaded successfully!");
        } catch (error) {
            toast.error(error.message || "Failed to upload image");
            setImagePreview(originalProfile.profile_picture || null);
        } finally {
            setIsUploadingImage(false);
            event.target.value = "";
        }
    };

    const handleProfileUpdate = async () => {
        if (!currentUser?.id) {
            toast.error("User profile not found");
            return;
        }

        const changedFields = {};
        Object.keys(profileForm).forEach((key) => {
            if (profileForm[key] !== originalProfile[key]) {
                changedFields[key] = profileForm[key];
            }
        });

        if (Object.keys(changedFields).length === 0) {
            toast.info("No changes detected");
            return;
        }

        setIsUpdatingProfile(true);
        try {
            if (!localStorage.getItem("token")) {
                toast.error("Authentication expired. Please login again.");
                return;
            }

            const whatsappValue = profileForm.whatsapp.trim()
                ? getFullPhone(profileForm.whatsapp_country_code, profileForm.whatsapp)
                : "";

            const payload = {
                name: profileForm.name,
                profile_picture: profileForm.profile_picture,
                whatsapp: whatsappValue,
                profession: profileForm.profession,
            };

            const response = await apiCall("/users/update-profile", "PUT", payload);
            const result = await response.json();

            if (!response.ok || !result.success) {
                toast.error(result.message || "Failed to update profile");
                return;
            }

            await refreshUser();
            setOriginalProfile({ ...profileForm });
            toast.success("Profile updated successfully!");
        } catch (error) {
            console.error("Profile update error:", error);
            toast.error("Network error. Please check your internet connection.");
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const closeContactModal = () => {
        setContactModal(null);
        setContactStep("form");
        setPendingContactValue("");
        setContactForm({
            email: "",
            country_code: "+91",
            phone: "",
            otp: "",
        });
    };

    const openContactModal = (type) => {
        const email = getContactValue(currentUser, "email");
        const phone = getContactValue(currentUser, "phone");

        if (type === "phone" && !email) {
            setContactModal({ type: "email", blockedType: "phone" });
            setContactForm((prev) => ({ ...prev, email: "", otp: "" }));
            setContactStep("form");
            return;
        }

        if (type === "email" && !phone) {
            setContactModal({ type: "phone", blockedType: "email" });
            setContactForm((prev) => ({ ...prev, country_code: "+91", phone: "", otp: "" }));
            setContactStep("form");
            return;
        }

        setContactModal({ type, blockedType: null });
        setContactForm((prev) => ({
            ...prev,
            email: "",
            country_code: "+91",
            phone: "",
            otp: "",
        }));
        setContactStep("form");
    };

    const requestContactOtp = async () => {
        if (!contactModal?.type) return;

        const type = contactModal.type;
        const value = type === "email"
            ? contactForm.email.trim()
            : getFullPhone(contactForm.country_code, contactForm.phone);

        if (!value) {
            toast.error(type === "email" ? "Email is required" : "Phone number is required");
            return;
        }

        setIsRequestingContactOtp(true);
        try {
            const endpoint = type === "email"
                ? "/users/request-update-email-otp"
                : "/users/request-update-phone-otp";
            const payload = type === "email" ? { email: value } : { phone: value };
            const response = await apiCall(endpoint, "POST", payload);
            const result = await response.json();

            if (!response.ok || result.success === false) {
                toast.error(result.message || `Failed to request ${type} OTP`);
                return;
            }

            setPendingContactValue(value);
            setContactStep("otp");
            setContactForm((prev) => ({ ...prev, otp: "" }));
            toast.success(result.message || "OTP sent successfully");
        } catch (error) {
            console.error("Contact OTP request error:", error);
            toast.error("Network error. Please try again.");
        } finally {
            setIsRequestingContactOtp(false);
        }
    };

    const verifyContactOtp = async () => {
        if (!contactModal?.type) return;
        if (!contactForm.otp.trim()) {
            toast.error("OTP is required");
            return;
        }

        const type = contactModal.type;
        const value = pendingContactValue || (type === "email"
            ? contactForm.email.trim()
            : getFullPhone(contactForm.country_code, contactForm.phone));

        setIsVerifyingContactOtp(true);
        try {
            const endpoint = type === "email"
                ? "/users/verify-update-email-otp"
                : "/users/verify-update-phone-otp";
            const payload = type === "email"
                ? { email: value, otp: contactForm.otp.trim() }
                : { phone: value, otp: contactForm.otp.trim() };
            const response = await apiCall(endpoint, "PUT", payload);
            const result = await response.json();

            if (!response.ok || result.success === false) {
                toast.error(result.message || `Failed to update ${type}`);
                return;
            }

            await refreshUser();
            toast.success(result.message || `${type === "email" ? "Email" : "Phone number"} updated successfully`);
            closeContactModal();
        } catch (error) {
            console.error("Contact OTP verify error:", error);
            toast.error("Network error. Please try again.");
        } finally {
            setIsVerifyingContactOtp(false);
        }
    };

    // Loading state
    if (loading || !userDetails) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-indigo-600"
                />
            </div>
        );
    }

    // Destructure directly from userDetails (which is response.data)
    const { user } = userDetails;
    const total_companies = companies.length;

    // Format activeRole for display
    const role = activeRole
        ? activeRole.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        : "Employee";


    return (
        <div className="min-h-screen relative overflow-hidden">

            {/* ── Background blobs ── */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float animation-delay-2000" />
            </div>

            <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* ── Profile Hero ── */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6"
                >
                    {/* Cover strip */}
                    <div className="h-28 bg-gradient-to-r from-indigo-600 to-purple-600 relative overflow-hidden">
                        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
                        <div className="absolute bottom-0 left-1/3 w-24 h-24 bg-white/5 rounded-full" />
                        <div className="absolute top-4 left-12 w-10 h-10 bg-white/10 rounded-xl rotate-12" />
                    </div>

                    {/* Avatar + Role row */}
                    <div className="px-6 pb-6">
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10 mb-4">

                            {/* Avatar */}
                            <motion.div
                                initial={{ scale: 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.15 }}
                                className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl border-4 border-white overflow-hidden"
                            >
                                {user.profile_picture ? (
                                    <img
                                        src={getMediaUrl(user.profile_picture)}
                                        alt={user.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-3xl font-black text-white">
                                        {getInitials(user.name)}
                                    </span>
                                )}
                                {(user.is_active === 1 || user.is_active === true) && (
                                    <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-400 border-2 border-white rounded-full flex items-center justify-center z-10">
                                        <FaCheckCircle className="text-white text-[8px]" />
                                    </span>
                                )}
                            </motion.div>

                            {/* Role badge */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl self-start sm:self-auto"
                            >
                                <FaCrown className="text-amber-500 text-sm" />
                                <span className="text-amber-700 font-semibold text-sm">{role}</span>
                            </motion.div>
                        </div>

                        {/* Name & inline meta */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">{user.name}</h1>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <FaEnvelope className="text-indigo-400" />{user.email}
                                </span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full hidden sm:block" />
                                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <FaPhone className="text-indigo-400" />{formatPhoneDisplay(user.phone) || ''}
                                </span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full hidden sm:block" />
                                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <FaHashtag className="text-indigo-400" />ID {user.id}
                                </span>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>

                <div className="flex gap-1 p-1 bg-white/20 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm mb-6">
                    {PROFILE_TABS.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`relative flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${activeTab === tab ? "text-white" : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            {activeTab === tab && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-md"
                                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                                />
                            )}
                            <span className="relative z-10">{tab}</span>
                        </button>
                    ))}
                </div>

                {/* ── Tab Content ── */}
                <AnimatePresence mode="wait">

                    {/* ── OVERVIEW ── */}
                    {activeTab === "Overview" && (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                        >
                            {/* Contact card */}
                            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                                    <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
                                        <FaIdBadge className="text-indigo-500 text-xs" />
                                    </div>
                                    <p className="text-sm font-semibold text-slate-800">Contact Details</p>
                                </div>
                                <ul className="px-5 py-2 divide-y divide-slate-100">
                                    {[
                                        { icon: FaEnvelope, label: "Email", value: user.email || "Not added", action: () => openContactModal("email") },
                                        { icon: FaPhone, label: "Phone", value: formatPhoneDisplay(user.phone) || "Not added", action: () => openContactModal("phone") },
                                        { icon: FaCalendarAlt, label: "Joined", value: formatDate(user.created_at) },
                                        { icon: FaUserCircle, label: "Status", value: (user.is_active === 1 || user.is_active === true) ? "Active" : "Inactive" },
                                        { icon: FaUserShield, label: "System Admin", value: (user.is_system_admin === 1 || user.is_system_admin === true) ? "Yes" : "No" },
                                    ].map(({ icon: Icon, label, value, action }, i) => (
                                        <motion.li
                                            key={label}
                                            initial={{ opacity: 0, x: -12 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.07 }}
                                            className="flex items-center gap-3 py-3 group"
                                        >
                                            <div className="w-8 h-8 bg-slate-50 group-hover:bg-indigo-50 rounded-lg flex items-center justify-center transition-colors duration-200 flex-shrink-0">
                                                <Icon className="text-slate-400 group-hover:text-indigo-500 text-xs transition-colors duration-200" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-slate-400">{label}</p>
                                                <p className={`text-sm font-medium truncate ${value === "Not added" ? "text-amber-600" : "text-slate-700"}`}>{value}</p>
                                            </div>
                                            {action && (
                                                <button
                                                    type="button"
                                                    onClick={action}
                                                    className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors"
                                                >
                                                    {value === "Not added" ? "Add" : "Change"}
                                                </button>
                                            )}
                                        </motion.li>
                                    ))}
                                </ul>
                            </div>

                            {/* Summary tiles */}
                            <div className="flex flex-col gap-4">
                                {[
                                    {
                                        icon: FaBuilding,
                                        label: "Companies Owned",
                                        value: total_companies,
                                        color: "from-blue-500 to-cyan-500",
                                        bg: "bg-blue-50",
                                        iconColor: "text-blue-500",
                                    },
                                    {
                                        icon: FaShieldAlt,
                                        label: "Active Permissions",
                                        value: permissions.length,
                                        color: "from-indigo-500 to-purple-600",
                                        bg: "bg-indigo-50",
                                        iconColor: "text-indigo-500",
                                    },
                                    {
                                        icon: FaBolt,
                                        label: "Access Level",
                                        value: permissions.some(p => p.code === "OWN_ALL") ? "Full" : "Limited",
                                        color: "from-amber-500 to-orange-500",
                                        bg: "bg-amber-50",
                                        iconColor: "text-amber-500",
                                    },
                                ].map((item, i) => (
                                    <motion.div
                                        key={item.label}
                                        initial={{ opacity: 0, x: 16 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.08 }}
                                        whileHover={{ x: 4 }}
                                        className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-all duration-200"
                                    >
                                        <div className={`w-11 h-11 ${item.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                            <item.icon className={`${item.iconColor} w-5 h-5`} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs text-slate-500">{item.label}</p>
                                            <p className="text-lg font-bold text-slate-800">{item.value}</p>
                                        </div>
                                        <div className={`w-1.5 h-10 rounded-full bg-gradient-to-b ${item.color} opacity-60`} />
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* ── EDIT PROFILE ── */}
                    {activeTab === "Edit Profile" && (
                        <motion.div
                            key="edit-profile"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6"
                        >
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                                    <FaUser className="text-indigo-500 text-sm" />
                                </div>
                                <div>
                                    <p className="text-base font-semibold text-slate-800">Profile Information</p>
                                    <p className="text-xs text-slate-500">Update your name and profile photo.</p>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                                    <div className="relative group flex-shrink-0">
                                        <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                                            {imagePreview ? (
                                                <img
                                                    src={getMediaUrl(imagePreview)}
                                                    alt="Profile"
                                                    className="w-full h-full object-cover"
                                                    onError={() => setImagePreview(null)}
                                                />
                                            ) : (
                                                <FaUser className="text-indigo-300 text-3xl" />
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploadingImage}
                                            className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center disabled:cursor-not-allowed"
                                        >
                                            {isUploadingImage ? (
                                                <FaSpinner className="text-white w-5 h-5 animate-spin" />
                                            ) : (
                                                <span className="text-white text-xs font-semibold">Change</span>
                                            )}
                                        </button>
                                    </div>

                                    <div className="flex flex-col justify-center gap-2 text-center sm:text-left">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleImageUpload}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploadingImage}
                                            className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-200 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isUploadingImage ? (
                                                <><FaSpinner className="w-3.5 h-3.5 animate-spin" />Uploading...</>
                                            ) : (
                                                <><FaSave className="w-3.5 h-3.5" />Upload Photo</>
                                            )}
                                        </button>
                                        <p className="text-xs text-slate-400">JPG, PNG or GIF. Max 5MB</p>
                                        {profileForm.profile_picture && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setImagePreview(null);
                                                    setProfileForm((prev) => ({ ...prev, profile_picture: "" }));
                                                }}
                                                className="text-xs text-red-400 hover:text-red-600 transition-colors"
                                            >
                                                Remove photo
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={profileForm.name}
                                        onChange={handleProfileChange}
                                        className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                        placeholder="Enter your full name"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">WhatsApp</label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setIsWhatsappCodeModalOpen(true)}
                                                className="flex-shrink-0 flex items-center justify-between gap-1 px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors w-24"
                                            >
                                                <span>
                                                    {getFlagEmoji(countryCodes.find(c => c.dial_code === profileForm.whatsapp_country_code.replace("+", ""))?.code || "IN")}{" "}{profileForm.whatsapp_country_code}
                                                </span>
                                                <span className="text-slate-400 text-xs">▼</span>
                                            </button>
                                            <input
                                                type="tel"
                                                name="whatsapp"
                                                value={profileForm.whatsapp}
                                                onChange={handleProfileChange}
                                                maxLength={10}
                                                inputMode="numeric"
                                                className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                                placeholder="Enter WhatsApp number"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Profession</label>
                                        <input
                                            type="text"
                                            name="profession"
                                            value={profileForm.profession}
                                            onChange={handleProfileChange}
                                            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                            placeholder="Teacher"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end pt-2">
                                    <button
                                        type="button"
                                        onClick={handleProfileUpdate}
                                        disabled={isUpdatingProfile || isUploadingImage}
                                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isUpdatingProfile ? (
                                            <><FaSpinner className="w-4 h-4 animate-spin" />Updating...</>
                                        ) : (
                                            <><FaSave className="w-4 h-4" />Save Changes</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── COMPANIES ── */}
                    {activeTab === "Companies" && (
                        <motion.div
                            key="companies"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col gap-4"
                        >
                            {/* Count pill */}
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-lg border border-slate-200 shadow-sm self-start">
                                <FaLayerGroup className="text-indigo-500 text-xs" />
                                <p className="text-xs font-semibold text-slate-600">
                                    {total_companies} {total_companies === 1 ? "Company" : "Companies"} found
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {companies.map((company, i) => {
                                    const initials = company.name?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "??";
                                    const colors = [
                                        { bg: "bg-indigo-50", text: "text-indigo-800", bar: "from-indigo-500 to-purple-500" },
                                        { bg: "bg-teal-50", text: "text-teal-800", bar: "from-teal-500 to-emerald-500" },
                                        { bg: "bg-rose-50", text: "text-rose-800", bar: "from-rose-500 to-orange-400" },
                                        { bg: "bg-blue-50", text: "text-blue-800", bar: "from-blue-500 to-cyan-400" },
                                        { bg: "bg-amber-50", text: "text-amber-800", bar: "from-amber-500 to-orange-400" },
                                    ];
                                    const c = colors[i % colors.length];

                                    // Build address string from available fields
                                    const addressParts = [];
                                    if (company.address_line1) addressParts.push(company.address_line1);
                                    if (company.address_line2) addressParts.push(company.address_line2);
                                    if (company.city) addressParts.push(company.city);
                                    if (company.state) addressParts.push(company.state);
                                    if (company.postal_code) addressParts.push(company.postal_code);
                                    if (company.country) addressParts.push(company.country);

                                    const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : "Location not set";
                                    const shortAddress = [company.city, company.state].filter(Boolean).join(", ") ||
                                        [company.address_line1, company.city].filter(Boolean).join(", ") ||
                                        "Location not set";

                                    return (
                                        <motion.div
                                            key={company.id}
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.06, type: "spring", stiffness: 200, damping: 22 }}
                                            whileHover={{ y: -2 }}
                                            className="bg-white/85 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200"
                                        >
                                            {/* Color bar */}
                                            <div className={`h-1 bg-gradient-to-r ${c.bar}`} />

                                            <div className="p-3.5">
                                                {/* Avatar + Name */}
                                                <div className="flex items-center gap-2.5 mb-3">
                                                    <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                                        <span className={`text-xs font-bold ${c.text}`}>{initials}</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{company.name}</p>
                                                        <p className="text-[11px] text-slate-400 truncate">{company.legal_name || "No legal name"}</p>
                                                    </div>
                                                </div>

                                                {/* Address - show full address with hover tooltip for truncation */}
                                                <div className="group relative mb-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <FaMapMarkerAlt className="text-slate-300 text-[10px] flex-shrink-0 mt-0.5" />
                                                        <span
                                                            className="text-[11px] text-slate-500 line-clamp-2 cursor-help"
                                                            title={fullAddress}
                                                        >
                                                            {shortAddress}
                                                        </span>
                                                    </div>
                                                </div>



                                                {/* Date */}
                                                {company.created_at && (
                                                    <div className="flex items-center gap-1.5 mb-3">
                                                        <FaCalendarAlt className="text-slate-300 text-[10px] flex-shrink-0" />
                                                        <span className="text-[11px] text-slate-500">{formatDate(company.created_at)}</span>
                                                    </div>
                                                )}

                                                {/* Footer */}
                                                <div className="flex items-center justify-end pt-1 border-t border-slate-100">

                                                    <span className="text-[10px] text-slate-400 truncate max-w-[80px] text-right">
                                                        {company.role || company.user_role || "Member"}
                                                    </span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Show message if no companies */}
                            {total_companies === 0 && (
                                <div className="text-center py-12 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200">
                                    <FaBuilding className="text-4xl text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-500">No companies found</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ── PERMISSIONS ── */}
                    {activeTab === "Permissions" && (
                        <motion.div
                            key="permissions"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col gap-4"
                        >
                            {/* Info banner */}
                            <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                                <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <FaShieldAlt className="text-indigo-500 text-xs" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-indigo-800">Access Permissions</p>
                                    <p className="text-xs text-indigo-500 mt-0.5">
                                        Permissions assigned to your account based on your role.
                                    </p>
                                </div>
                            </div>

                            <CategoryPermissionSelector
                                allPermissions={groupedPermissions}
                                selectedIds={groupedPermissionIds}
                                onChange={() => { }}
                                readOnly={true}
                                listHeightClass="max-h-[60vh]"
                            />
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            <Modal
                isOpen={Boolean(contactModal)}
                onClose={closeContactModal}
                title={`${contactStep === "otp" ? "Verify" : contactModal?.blockedType ? "Add" : "Change"} ${contactModal?.type === "email" ? "Email" : "Phone Number"}`}
                subtitle={contactStep === "otp" ? "Enter the OTP to confirm this change." : "We will send an OTP before saving the new contact detail."}
                icon={contactModal?.type === "email" ? <FaEnvelope /> : <FaPhone />}
                size="md"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={closeContactModal}
                            className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-white hover:text-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        {contactStep === "form" ? (
                            <button
                                type="button"
                                onClick={requestContactOtp}
                                disabled={isRequestingContactOtp}
                                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 rounded-xl hover:from-indigo-700 hover:via-violet-700 hover:to-fuchsia-700 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isRequestingContactOtp && <FaSpinner className="w-3.5 h-3.5 animate-spin" />}
                                Send OTP
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={verifyContactOtp}
                                disabled={isVerifyingContactOtp}
                                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 rounded-xl hover:from-indigo-700 hover:via-violet-700 hover:to-fuchsia-700 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isVerifyingContactOtp && <FaSpinner className="w-3.5 h-3.5 animate-spin" />}
                                Verify & Save
                            </button>
                        )}
                    </>
                }
            >
                {(contactModal?.blockedType || contactStep === "form") && (
                    <div className={`mb-4 flex items-start gap-3 rounded-xl border p-3 ${contactModal?.blockedType ? "border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50" : "border-indigo-200 bg-gradient-to-r from-indigo-50 via-violet-50 to-fuchsia-50"}`}>
                        <FaExclamationTriangle className={`mt-0.5 shrink-0 ${contactModal?.blockedType ? "text-amber-500" : "text-indigo-500"}`} />
                        <div>
                            <p className={`text-sm font-semibold ${contactModal?.blockedType ? "text-amber-800" : "text-indigo-800"}`}>
                                {contactModal?.blockedType
                                    ? contactModal.blockedType === "email" ? "Phone number required first" : "Email required first"
                                    : "OTP verification required"}
                            </p>
                            <p className={`mt-0.5 text-xs ${contactModal?.blockedType ? "text-amber-700" : "text-indigo-700"}`}>
                                {contactModal?.blockedType
                                    ? `You cannot change your ${contactModal.blockedType === "email" ? "email" : "phone number"} until you add a ${contactModal.type === "email" ? "email address" : "phone number"} first.`
                                    : `Enter the new ${contactModal?.type === "email" ? "email address" : "phone number"} below. We will send an OTP before saving it.`}
                            </p>
                        </div>
                    </div>
                )}

                {contactStep === "form" ? (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-sky-50 p-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">
                                Current {contactModal?.type === "email" ? "Email" : "Phone Number"}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800 break-all">
                                {contactModal?.type === "email"
                                    ? getContactValue(currentUser, "email") || "Not added"
                                    : getContactValue(currentUser, "phone") || "Not added"}
                            </p>
                        </div>

                        {contactModal?.type === "email" ? (
                            <div>
                                <label className="block text-sm font-semibold text-violet-700 mb-2">New Email Address</label>
                                <input
                                    type="email"
                                    value={contactForm.email}
                                    onChange={(event) => setContactForm((prev) => ({ ...prev, email: event.target.value }))}
                                    className="w-full px-4 py-2.5 text-sm border border-violet-200 bg-white rounded-xl focus:ring-4 focus:ring-violet-500/15 focus:border-violet-500 transition-all"
                                    placeholder="demo@gmail.com"
                                />
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-semibold text-violet-700 mb-2">New Phone Number</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsContactCodeModalOpen(true)}
                                        className="flex-shrink-0 flex items-center justify-between gap-1 px-3 py-2.5 border border-violet-200 bg-violet-50 rounded-xl text-sm font-semibold text-slate-700 hover:bg-violet-100 transition-colors w-24"
                                    >
                                        <span>
                                            {getFlagEmoji(countryCodes.find(c => c.dial_code === contactForm.country_code.replace("+", ""))?.code || "IN")}{" "}{contactForm.country_code}
                                        </span>
                                        <span className="text-slate-400 text-xs">▼</span>
                                    </button>
                                    <input
                                        type="tel"
                                        aria-label="New phone number"
                                        value={contactForm.phone}
                                        onChange={(event) => setContactForm((prev) => ({ ...prev, phone: event.target.value.replace(/\D/g, "").slice(0, 10) }))}
                                        maxLength={10}
                                        inputMode="numeric"
                                        className="flex-1 px-4 py-2.5 text-sm border border-violet-200 bg-white rounded-xl focus:ring-4 focus:ring-violet-500/15 focus:border-violet-500 transition-all"
                                        placeholder="Enter phone number"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">OTP sent for</p>
                            <p className="text-sm font-semibold text-slate-800 break-all">{pendingContactValue}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-emerald-700 mb-2">OTP</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={contactForm.otp}
                                onChange={(event) => setContactForm((prev) => ({ ...prev, otp: event.target.value.replace(/[^0-9]/g, "") }))}
                                className="w-full px-4 py-2.5 text-sm border border-emerald-200 bg-white rounded-xl focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all"
                                placeholder="123456"
                            />
                        </div>
                    </div>
                )}
            </Modal>

            {/* Country Code Modals */}
            <CountryCodeModal
                isOpen={isWhatsappCodeModalOpen}
                onClose={() => setIsWhatsappCodeModalOpen(false)}
                onSelect={(code) => setProfileForm((prev) => ({ ...prev, whatsapp_country_code: "+" + code }))}
                selectedCode={profileForm.whatsapp_country_code.replace("+", "")}
            />
            <CountryCodeModal
                isOpen={isContactCodeModalOpen}
                onClose={() => setIsContactCodeModalOpen(false)}
                onSelect={(code) => setContactForm((prev) => ({ ...prev, country_code: "+" + code }))}
                selectedCode={contactForm.country_code.replace("+", "")}
            />

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33%       { transform: translate(30px, -50px) scale(1.1); }
                    66%       { transform: translate(-20px, 20px) scale(0.9); }
                }
                .animate-float { animation: float 7s infinite; }
                .animation-delay-2000 { animation-delay: 2s; }
            `}</style>
        </div>
    );
}
