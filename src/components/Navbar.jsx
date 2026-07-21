import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBars,
    FaUserCircle,
    FaFingerprint,
    FaCaretDown,
    FaTimes,
    FaCog,
    FaStore,
    FaExchangeAlt,
    FaEnvelope,
    FaBuilding,
    FaMapMarkerAlt,
    FaCheckCircle,
    FaArrowRight,
    FaLayerGroup,
    FaSearch
} from 'react-icons/fa';
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";
import { getMediaUrl } from "../utils/api";

const formatRole = (role) =>
    role?.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'User';

const getInitials = (name = '') =>
    name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

const AVATAR_GRADIENTS = [
    'from-blue-500 to-indigo-600',
    'from-purple-500 to-pink-600',
    'from-green-500 to-teal-600',
    'from-orange-500 to-amber-500',
    'from-rose-500 to-red-600',
    'from-cyan-500 to-blue-500',
];

const avatarGradient = (id) => AVATAR_GRADIENTS[id % AVATAR_GRADIENTS.length];

const CompanyLogo = ({ company, size = 8 }) => {
    const [imgError, setImgError] = useState(false);
    const sizePx = size * 4; // approximate mapping for size classes

    if (company?.logo_url && !imgError) {
        return (
            <img
                src={getMediaUrl(company.logo_url)}
                alt="Company Logo"
                className={`w-${size} h-${size} rounded-xl object-cover border border-slate-100 bg-white shadow-sm`}
                onError={() => setImgError(true)}
            />
        );
    }

    return (
        <div className={`w-${size} h-${size} bg-gradient-to-br ${avatarGradient(company?.id || 0)} rounded-xl flex items-center justify-center text-white font-bold shadow-md select-none`}
            style={{ fontSize: `${sizePx / 2.5}px` }}>
            {getInitials(company?.name || 'C')}
        </div>
    );
};

const CompanySwitcherModal = ({ companies = [], currentCompany, onSwitch, onClose }) => {
    const [search, setSearch] = useState('');

    const filteredCompanies = companies.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.branch?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Switch Workspace"
            subtitle="Access your different business accounts and teams"
            size="4xl"
        >
            <div className="flex flex-col gap-6">
                {/* Search Bar */}
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <FaSearch className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by name, branch or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 transition-all min-h-[42px]"
                    />
                </div>

                {/* Company Grid */}
                <div className="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredCompanies.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4">
                                <FaBuilding size={24} className="text-slate-200" />
                            </div>
                            <p className="text-sm font-medium">No workspaces found matching your search</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                            {filteredCompanies.map((company) => {
                                const isActive = company.id === currentCompany?.id;
                                return (
                                    <button
                                        key={company.id}
                                        onClick={() => { onSwitch(company); onClose(); }}
                                        className={`relative group flex flex-col p-5 rounded-2xl border transition-all duration-300
                                            ${isActive
                                                ? 'border-indigo-200 bg-indigo-50/30 ring-2 ring-indigo-500/20'
                                                : 'border-slate-100 bg-white hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1'}`}
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <CompanyLogo company={company} size={14} />
                                            {isActive ? (
                                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-indigo-500/30">
                                                    <FaCheckCircle size={11} /> Current
                                                </span>
                                            ) : (
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-500/30 transition-all duration-300">
                                                    <FaArrowRight size={14} />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h3 className={`text-lg font-bold truncate mb-1.5 transition-colors ${isActive ? 'text-indigo-900' : 'text-slate-800 group-hover:text-indigo-600'}`}>
                                                {company.name}
                                            </h3>

                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2.5 text-xs text-slate-500 font-medium">
                                                    <div className="w-5 h-5 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-50 transition-colors">
                                                        <FaMapMarkerAlt className="text-slate-400 group-hover:text-indigo-400" size={10} />
                                                    </div>
                                                    <span className="truncate">{company.branch || "Headquarters"}</span>
                                                </div>

                                                <div className="flex items-center gap-2.5 text-xs text-slate-500 font-medium">
                                                    <div className="w-5 h-5 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-50 transition-colors">
                                                        <FaEnvelope className="text-slate-400 group-hover:text-indigo-400" size={10} />
                                                    </div>
                                                    <span className="truncate">{company.email || "No email listed"}</span>
                                                </div>

                                                <div className="pt-2">
                                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-colors
                                                        ${isActive
                                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                            : 'bg-slate-50 border-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:border-indigo-100 group-hover:text-indigo-600'}`}>
                                                        <FaLayerGroup size={11} />
                                                        {formatRole(company.role)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Background glow effect for hover */}
                                        {!isActive && (
                                            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/[0.02] to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

const Navbar = ({
    toggleSidebar,
    isMobile,
    sidebarOpen,
    isDesktopSidebarExpanded,
    company,          // current active company object { id, name, logo_url, branch }
    companies = [],   // array of all companies user has access to
    onCompanySwitch,  // callback(company) when user selects a different company
}) => {
    const { user, employee, logout, activeRole, isEmployee, isCompanyOwner, isSystemAdmin } = useAuth();
    const [openDropdown, setOpenDropdown] = useState(false);
    const [showCompanySwitcher, setShowCompanySwitcher] = useState(false);
    const navigate = useNavigate();
    const canSwitchCompany = isEmployee || isCompanyOwner || isSystemAdmin;

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };


    const isSidebarOpen = isMobile ? sidebarOpen : isDesktopSidebarExpanded;

    return (
        <>
            <nav className="sticky top-0 z-40 h-16 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-lg">
                <div className="pl-2 pr-4 h-full">
                    <div className="flex items-center justify-between h-full">

                        {/* Left section */}
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={toggleSidebar}
                                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none flex-shrink-0
                                    ${isSidebarOpen ? 'text-white' : 'text-white/80 hover:text-white hover:bg-white/20'}`}
                                data-sidebar-toggle="true"
                                aria-label="Toggle menu"
                            >
                                {isSidebarOpen ? <FaTimes className="w-4 h-4" /> : <FaBars className="w-4 h-4" />}
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate('/home')}
                                className="flex items-center gap-1 rounded-lg transition-opacity duration-200 hover:opacity-90 focus:outline-none"
                                aria-label="Go to home"
                            >
                                {/* <div className="bg-white/20 p-1.5 rounded-xl backdrop-blur-sm shadow-inner">
                                    <FaFingerprint className="h-5 w-5 text-white" />
                                </div> */}
                                <div>
                                    <span className="text-xl font-bold text-white tracking-tight">
                                        One<span className="font-light text-white/90">Attendance</span>
                                    </span>
                                </div>
                            </button>
                        </div>

                        {/* Right section */}
                        <div className="flex items-center space-x-2 sm:space-x-3">

                            {/* ── Desktop company switcher ── */}
                            {canSwitchCompany && (
                                <button
                                    onClick={() => setShowCompanySwitcher(true)}
                                    className="hidden md:flex items-center gap-2.5 px-3 py-1.5
                                        transition-all duration-200 group"
                                >
                                    <CompanyLogo company={company} size={6} />
                                    <div className="text-left max-w-[110px]">
                                        <p className="text-xs font-semibold text-white truncate leading-tight">
                                            {company?.name || 'Select Company'}
                                        </p>
                                        <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest leading-none mt-0.5">
                                            {formatRole(activeRole)}
                                        </p>
                                    </div>
                                    <FaExchangeAlt className="w-3 h-3 text-white/40 group-hover:text-white/80 transition-colors ml-0.5" />
                                </button>
                            )}

                            {/* User menu */}
                            <div className="relative inline-block">
                                <button
                                    onClick={() => setOpenDropdown(!openDropdown)}
                                    className="flex items-center space-x-3 p-1.5 pr-3
                                        rounded-lg bg-white/10 hover:bg-white/20
                                        backdrop-blur-sm transition-all duration-200 group"
                                >
                                    {/* Avatar stack — mobile shows company swap badge */}
                                    <div className="relative">
                                        <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-lg bg-white border border-white/20">
                                            {user?.profile_picture ? (
                                                <img
                                                    src={getMediaUrl(user.profile_picture)}
                                                    alt={user.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center">
                                                    <FaUserCircle className="w-6 h-6 text-white" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Online dot */}
                                        <div className="absolute -bottom-1 -right-1 w-3 h-3
                                            bg-emerald-400 border-2 border-white rounded-full"></div>
                                    </div>

                                    <div className="hidden md:block text-left max-w-[120px]">
                                        <p className="text-sm font-semibold text-white truncate">
                                            {user?.name || "User"}
                                        </p>
                                        <p className="text-[10px] text-white/70 truncate">
                                            {company?.role === 'company_owner' ? "Company Owner" : (company?.designation?.label ? formatRole(company.designation.label) : formatRole(activeRole || user?.role))}
                                        </p>
                                    </div>

                                    <FaCaretDown className="w-3 h-3 text-white/70 group-hover:text-white transition-colors hidden md:block" />
                                </button>

                                {/* Dropdown */}
                                {openDropdown && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(false)} />
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
                                            <div className="md:hidden p-3 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white shadow-sm bg-white">
                                                    {user?.profile_picture ? (
                                                        <img
                                                            src={getMediaUrl(user.profile_picture)}
                                                            alt={user.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                                            <FaUserCircle className="w-6 h-6 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-gray-800 truncate">{user?.name || "User"}</p>
                                                    <p className="text-xs text-gray-500 truncate">{company?.role === 'company_owner' ? "Company Owner" : (company?.designation?.label ? formatRole(company.designation.label) : formatRole(activeRole || user?.role))}</p>
                                                </div>
                                            </div>

                                            {/* Mobile: company switcher row inside dropdown */}
                                            {canSwitchCompany && (
                                                <button
                                                    onClick={() => { setOpenDropdown(false); setShowCompanySwitcher(true); }}
                                                    className="md:hidden w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2 border-b border-gray-100"
                                                >
                                                    <FaExchangeAlt className="w-4 h-4 text-indigo-500" />
                                                    <span>Switch Company</span>
                                                    {company?.name && (
                                                        <span className="ml-auto text-xs text-gray-400 truncate max-w-[70px]">{company.name}</span>
                                                    )}
                                                </button>
                                            )}

                                            <button
                                                onClick={() => { setOpenDropdown(false); navigate("/profile"); }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                                            >
                                                <FaUserCircle className="w-4 h-4" />
                                                My Profile
                                            </button>
                                            <button
                                                onClick={() => { setOpenDropdown(false); navigate("/settings"); }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                                            >
                                                <FaCog className="w-4 h-4" />
                                                Settings
                                            </button>

                                            <div className="border-t border-gray-200 my-1"></div>

                                            <button
                                                onClick={handleLogout}
                                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                </svg>
                                                Logout
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Company switcher modal — rendered outside nav to avoid stacking context issues */}
            {showCompanySwitcher && canSwitchCompany && (
                <CompanySwitcherModal
                    companies={companies}
                    currentCompany={company}
                    onSwitch={onCompanySwitch}
                    onClose={() => setShowCompanySwitcher(false)}
                />
            )}
        </>
    );
};

export default Navbar;
