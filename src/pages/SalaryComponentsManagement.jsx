import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    FaMoneyBillWave, FaPlus, FaSpinner, FaMinus,
    FaExclamationTriangle, FaTimes,
    FaEdit, FaTrash, FaEye,
    FaSearch, FaBuilding, FaBalanceScale, FaToggleOn, FaSave, FaIdCard,
    FaCheckSquare, FaRegSquare, FaTrashAlt, FaCheck,
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import apiCall from '../utils/api';
import Pagination, { usePagination } from '../components/PaginationComponent';
import SkeletonComponent from '../components/SkeletonComponent';
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import { ManagementButton, ManagementCard, ManagementHub, ManagementTable } from '../components/common';
import ModalScrollLock from "../components/ModalScrollLock";
import Select from '../components/SelectField';

// ─── Constants & Helpers ─────────────────────────────────────────────────────

const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: -20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", damping: 25, stiffness: 300 } },
    exit: { opacity: 0, scale: 0.95, y: -20, transition: { duration: 0.2 } }
};

const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
};

const COMPONENT_TYPES = [
    { value: 'earning', label: 'Earning', color: 'green' },
    { value: 'deduction', label: 'Deduction', color: 'red' },
    { value: 'employer_contribution', label: 'Employer Contribution', color: 'blue' },
];

const CALC_TYPES = [
    { value: 'percentage', label: 'Percentage', icon: '%' },
    { value: 'fixed', label: 'Fixed', icon: '₹' },
];

const getTypeConfig = (type) => {
    const map = {
        earning: { color: 'green', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', gradient: 'from-green-500 to-emerald-600' },
        deduction: { color: 'red', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', gradient: 'from-red-500 to-rose-600' },
        employer_contribution: { color: 'blue', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', gradient: 'from-blue-500 to-indigo-600' },
    };
    return map[type] || { color: 'gray', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', gradient: 'from-gray-500 to-gray-600' };
};

const getCardAccentForType = (type) => {
    const map = {
        earning: 'green',
        deduction: 'rose',
        employer_contribution: 'indigo',
    };
    return map[type] || 'slate';
};

const formatTypeLabel = (type) => {
    const map = {
        earning: 'Earning',
        deduction: 'Deduction',
        employer_contribution: 'Employer Contribution',
    };
    return map[type] || type;
};

const formatCalcValue = (calcType, calcValue) => {
    const v = parseFloat(calcValue || 0);
    if (calcType === 'percentage') return `${v.toFixed(2)}%`;
    return `₹${v.toFixed(2)}`;
};

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
};

const ACTIVE_FILTER_OPTIONS = [
    { value: 'all', label: 'All Status' },
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
];

const TYPE_FILTER_OPTIONS = [
    { value: 'all', label: 'All Types' },
    { value: 'earning', label: 'Earning' },
    { value: 'deduction', label: 'Deduction' },
    { value: 'employer_contribution', label: 'Employer Contribution' },
];

// ─── Component Detail Modal ───────────────────────────────────────────────────

const ComponentDetailModal = ({ component, onClose, onEdit, onDelete }) => {
    if (!component) return null;
    const tc = getTypeConfig(component.type);

    return (
        <AnimatePresence>
            <motion.div variants={backdropVariants} initial="hidden" animate="visible" exit="exit" className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex justify-center items-start overflow-y-auto p-4 sm:p-6 pt-8 sm:pt-16 !mt-0" onClick={onClose}>
                <ModalScrollLock />
                <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white w-full max-w-4xl max-h-[80vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden m-auto" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
                        <div className="flex items-center gap-4">
                            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${tc.gradient} shadow-lg shadow-slate-200`}>
                                <FaMoneyBillWave className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 leading-tight">{component.name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">{component.code}</span>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${component.is_active ? 'bg-green-100 text-green-800 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${component.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                                        {component.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all border border-transparent hover:border-slate-100">
                            <FaTimes className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-slate-50/30">
                        <div className="p-6 space-y-6 p-2 lg:p-0">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Type</p>
                                    <p className={`text-sm font-black uppercase ${tc.text}`}>{formatTypeLabel(component.type)}</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Calculation</p>
                                    <p className="text-sm font-black text-slate-900 uppercase">{component.calc_type}</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Default Value</p>
                                    <p className="text-sm font-black text-indigo-600 uppercase">{formatCalcValue(component.calc_type, component.calc_value)}</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                    <p className={`text-sm font-black uppercase ${component.is_active ? 'text-green-600' : 'text-slate-400'}`}>{component.is_active ? 'Active' : 'Disabled'}</p>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Flags Section */}
                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Configuration Flags</p>
                                    </div>
                                    <div className="divide-y divide-slate-50">
                                        <div className="flex items-center justify-between px-4 py-3.5">
                                            <span className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                                                <FaBalanceScale className="text-orange-500" /> Taxable Component
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${component.is_taxable ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-400'}`}>
                                                {component.is_taxable ? 'YES' : 'NO'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between px-4 py-3.5">
                                            <span className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                                                <FaBuilding className="text-blue-500" /> Statutory Component
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${component.is_statutory ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                                                {component.is_statutory ? 'YES' : 'NO'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Metadata Section */}
                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">System Metadata</p>
                                    </div>
                                    <div className="divide-y divide-slate-50">
                                        <div className="flex items-center justify-between px-4 py-3.5">
                                            <span className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                                                <FaIdCard className="text-slate-400" /> Component ID
                                            </span>
                                            <span className="text-xs font-mono font-bold text-slate-800">#{component.id}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex justify-end gap-3">
                        <button onClick={onClose} className="flex px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                            Close
                        </button>
                        <button onClick={() => { onDelete(component); onClose(); }} className="flex px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-rose-700 hover:to-red-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-100">
                            <FaTrash /> Delete
                        </button>
                        <button onClick={() => { onEdit(component); onClose(); }} className="flex px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">
                            <FaEdit /> Edit
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ─── Form Modal ───────────────────────────────────────────────────────────────

const FormModal = ({ mode, initial, onClose, onSave, saving }) => {
    const isEdit = mode === 'edit';
    const [form, setForm] = useState({
        code: '',
        name: '',
        type: 'earning',
        calc_type: 'percentage',
        calc_value: '',
        is_taxable: false,
        is_statutory: false,
        is_active: true,
        ...initial,
    });
    const [errors, setErrors] = useState({});

    const setField = (key, val) => setForm(p => ({ ...p, [key]: val }));

    const validate = () => {
        const e = {};
        if (!form.code.trim()) e.code = 'Code is required';
        if (!form.name.trim()) e.name = 'Name is required';
        if (form.calc_value === '' || isNaN(Number(form.calc_value))) e.calc_value = 'Enter a valid value';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;
        const payload = {
            ...form,
            calc_value: Number(form.calc_value),
            is_taxable: form.is_taxable ? 1 : 0,
            is_statutory: form.is_statutory ? 1 : 0,
            is_active: form.is_active ? 1 : 0,
        };
        if (isEdit) payload.id = initial.id;
        onSave(payload);
    };

    return (
        <AnimatePresence>
            <motion.div variants={backdropVariants} initial="hidden" animate="visible" exit="exit" className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex justify-center items-start overflow-y-auto p-4 sm:p-6 pt-8 sm:pt-16 !mt-0" onClick={onClose}>
                <ModalScrollLock />
                <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white w-full max-w-4xl max-h-[80vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden m-auto" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-200">
                                {isEdit ? <FaEdit className="h-6 w-6 text-white" /> : <FaPlus className="h-6 w-6 text-white" />}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">{isEdit ? 'Edit Component' : 'New Component'}</h2>
                                <p className="text-sm text-slate-500 font-medium">Configure salary element</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all">
                            <FaTimes className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-slate-50/30">
                        <div className="p-6 space-y-6">
                            {/* Identifiers */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Component Code *</label>
                                    <input value={form.code} onChange={e => setField('code', e.target.value.toUpperCase())} placeholder="e.g. BASIC"
                                        className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all ${errors.code ? 'border-red-400 bg-red-50 text-red-900' : 'border-slate-200 bg-white text-slate-800'}`} />
                                    {errors.code && <p className="text-[10px] text-red-500 mt-1 font-bold ml-1 uppercase">{errors.code}</p>}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Component Name *</label>
                                    <input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Basic Salary"
                                        className={`w-full px-4 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all ${errors.name ? 'border-red-400 bg-red-50 text-red-900' : 'border-slate-200 bg-white text-slate-800'}`} />
                                    {errors.name && <p className="text-[10px] text-red-500 mt-1 font-bold ml-1 uppercase">{errors.name}</p>}
                                </div>
                            </div>

                            {/* Type Selection */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Component Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {COMPONENT_TYPES.map(t => {
                                        const tc = getTypeConfig(t.value);
                                        const active = form.type === t.value;
                                        return (
                                            <button key={t.value} type="button" onClick={() => setField('type', t.value)}
                                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-2 ${active ? `bg-white ${tc.text} border-indigo-500 shadow-md` : `bg-white text-slate-400 border-slate-100 hover:border-slate-200`}`}>
                                                {t.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Calculation Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Calculation Method</label>
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        {CALC_TYPES.map(ct => (
                                            <button key={ct.value} type="button" onClick={() => setField('calc_type', ct.value)}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${form.calc_type === ct.value ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                                <span className="text-sm">{ct.icon}</span> {ct.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Default Value ({form.calc_type === 'percentage' ? '%' : '₹'})</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                                            {form.calc_type === 'percentage' ? '%' : '₹'}
                                        </div>
                                        <input type="text" inputMode="decimal" value={form.calc_value}
                                            onChange={e => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                if (val === '' || /^\d*\.?\d*$/.test(val)) setField('calc_value', val);
                                            }}
                                            placeholder="0.00"
                                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all ${errors.calc_value ? 'border-red-400 bg-red-50 text-red-900' : 'border-slate-200 bg-white text-slate-800'}`} />
                                    </div>
                                    {errors.calc_value && <p className="text-[10px] text-red-500 mt-1 font-bold ml-1 uppercase">{errors.calc_value}</p>}
                                </div>
                            </div>

                            {/* Flags */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                {[
                                    { key: 'is_taxable', label: 'Taxable', sub: 'Apply income tax', icon: <FaBalanceScale /> },
                                    { key: 'is_statutory', label: 'Statutory', sub: 'Govt. regulated', icon: <FaBuilding /> },
                                    { key: 'is_active', label: 'Status', sub: 'Currently active', icon: <FaToggleOn /> },
                                ].map(toggle => {
                                    const isOn = form[toggle.key];
                                    return (
                                        <div key={toggle.key} onClick={() => setField(toggle.key, !isOn)}
                                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${isOn ? 'bg-indigo-50/50 border-indigo-500 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${isOn ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                    {toggle.icon}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800 leading-tight">{toggle.label}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{toggle.sub}</p>
                                                </div>
                                            </div>
                                            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isOn ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isOn ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 justify-end flex gap-3">
                        <button type="button" onClick={onClose} className="flex px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                            Cancel
                        </button>
                        <button onClick={handleSubmit} disabled={saving} className="flex px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:from-indigo-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                            {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Component'}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ─── Bulk Delete Confirm Modal ─────────────────────────────────────────────

const BulkDeleteConfirmModal = ({ scope, count, onClose, onConfirm, deleting }) => {
    const isAll = scope === 'all';
    return (
        <AnimatePresence>
            <motion.div variants={backdropVariants} initial="hidden" animate="visible" exit="exit" className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex justify-center items-start overflow-y-auto p-4 sm:p-6 pt-8 sm:pt-16 !mt-0" onClick={onClose}>
                <ModalScrollLock />
                <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 m-auto flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shadow-sm border border-rose-100">
                                <FaTrashAlt className="h-4 w-4" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Delete Components</h2>
                                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                                    {isAll ? 'All records' : `${count} selected`}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all">
                            <FaTimes className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <div className="p-6 text-center space-y-4">
                        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200 }} className="w-16 h-16 bg-gradient-to-br from-rose-50 to-red-50 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-lg shadow-rose-100/50">
                            <FaExclamationTriangle className="text-2xl text-rose-500" />
                        </motion.div>

                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-slate-900">Are you sure?</h3>
                            <p className="text-xs text-slate-500 leading-relaxed px-4">
                                {isAll
                                    ? 'This will permanently delete all salary components. This action cannot be undone.'
                                    : `Permanently delete ${count} salary component${count > 1 ? 's' : ''}? This cannot be undone.`
                                }
                            </p>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-3.5 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                            Cancel
                        </button>
                        <button onClick={onConfirm} disabled={deleting} className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:from-rose-700 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-rose-200">
                            {deleting ? <FaSpinner className="animate-spin" /> : <FaTrash />}
                            {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SalaryComponents = () => {
    const [components, setComponents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [selectedComponent, setSelectedComponent] = useState(null);
    const [formModal, setFormModal] = useState(null);
    const [viewMode, setViewMode] = useState('table');
    const [activeActionMenu, setActiveActionMenu] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1440);
    const [sidebarOffset, setSidebarOffset] = useState(() => {
        if (typeof window === 'undefined' || window.innerWidth < 768) return 0;
        try {
            const stored = localStorage.getItem('sidebarCollapsed');
            const isCollapsed = stored === null ? true : stored === 'true';
            return isCollapsed ? 64 : 256;
        } catch {
            return 64;
        }
    });

    // ── Bulk selection state ──────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkDeleteScope, setBulkDeleteScope] = useState(null); // 'selected' | 'all' | null

    // Filters
    const [activeFilter, setActiveFilter] = useState('true');
    const [typeFilter, setTypeFilter] = useState('all');

    const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 10);
    const fetchInProgress = useRef(false);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // Window resize
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const syncSidebarOffset = () => {
            if (window.innerWidth < 768) {
                setSidebarOffset(0);
                return;
            }
            try {
                const stored = localStorage.getItem('sidebarCollapsed');
                const isCollapsed = stored === null ? true : stored === 'true';
                setSidebarOffset(isCollapsed ? 64 : 256);
            } catch {
                setSidebarOffset(64);
            }
        };
        syncSidebarOffset();
        window.addEventListener('sidebar-offset-change', syncSidebarOffset);
        window.addEventListener('resize', syncSidebarOffset);
        return () => {
            window.removeEventListener('sidebar-offset-change', syncSidebarOffset);
            window.removeEventListener('resize', syncSidebarOffset);
        };
    }, []);

    const contentWidth = windowWidth - sidebarOffset;

    // Clear selection when data changes
    useEffect(() => {
        setSelectedIds(new Set());
    }, [components]);

    const allVisibleSelected = useMemo(
        () => components.length > 0 && components.every(c => selectedIds.has(c.id)),
        [components, selectedIds]
    );

    const fetchComponents = useCallback(async (page = pagination.page, search = debouncedSearch, resetLoading = true) => {
        if (fetchInProgress.current) return;
        fetchInProgress.current = true;
        if (resetLoading) setLoading(true);

        try {
            const company = JSON.parse(localStorage.getItem('company'));
            let url = `/salary/components/list?page=${page}&limit=${pagination.limit}`;
            if (search) url += `&search=${search}`;
            if (activeFilter !== 'all') url += `&is_active=${activeFilter}`;
            if (typeFilter !== 'all') url += `&type=${typeFilter}`;

            const response = await apiCall(url, 'GET', null, company?.id);
            const result = await response.json();
            if (result.success) {
                setComponents(result.data || []);
                updatePagination({
                    page: result.pagination?.page || page,
                    limit: result.pagination?.limit || pagination.limit,
                    total: result.pagination?.total || 0,
                    total_pages: result.pagination?.total_pages || 1,
                    is_last_page: result.pagination?.is_last_page ?? true
                });
            } else {
                throw new Error(result.message || 'Failed to fetch components');
            }
        } catch (e) {
            console.error(e);
            toast.error(e.message || 'Failed to load components');
        } finally {
            setLoading(false);
            fetchInProgress.current = false;
            setIsInitialLoad(false);
        }
    }, [pagination.page, pagination.limit, debouncedSearch, activeFilter, typeFilter, updatePagination]);

    const handlePageChange = useCallback((newPage) => {
        if (newPage !== pagination.page) goToPage(newPage);
    }, [pagination.page, goToPage]);

    useEffect(() => {
        if (!isInitialLoad) {
            if (pagination.page !== 1) goToPage(1);
            else fetchComponents(1, debouncedSearch, true);
        }
    }, [debouncedSearch, activeFilter, typeFilter]);

    useEffect(() => {
        if (!isInitialLoad && !fetchInProgress.current) {
            fetchComponents(pagination.page, debouncedSearch, true);
        }
    }, [pagination.page, pagination.limit]);

    useEffect(() => {
        const company = JSON.parse(localStorage.getItem('company'));
        if (company && isInitialLoad) {
            fetchComponents(1, "", true);
        } else if (!company) {
            toast.error("Company ID not found.");
            setLoading(false);
            setIsInitialLoad(false);
        }
    }, []);

    const handleSave = async (payload) => {
        setSaving(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const isEdit = !!payload.id;
            const endpoint = `/salary/components/${isEdit ? 'update' : 'create'}`;
            const method = isEdit ? 'PUT' : 'POST';
            const response = await apiCall(endpoint, method, payload, company?.id);
            const result = await response.json();
            if (result.success) {
                toast.success(isEdit ? 'Component updated!' : 'Component created!');
                setFormModal(null);
                fetchComponents(1, debouncedSearch, true);
            } else {
                throw new Error(result.message || 'Save failed');
            }
        } catch (e) {
            toast.error(e.message || 'Failed to save component');
        } finally { setSaving(false); }
    };

    const handleBulkDelete = async () => {
        if (bulkDeleteScope === null) return;
        setDeleting(true);
        try {
            const company = JSON.parse(localStorage.getItem('company'));
            const body = bulkDeleteScope === 'all'
                ? { ids: 'all' }
                : { ids: [...selectedIds] };

            const response = await apiCall('/salary/components/delete', 'DELETE', body, company?.id);
            const result = await response.json();
            if (result.success) {
                toast.success(
                    bulkDeleteScope === 'all'
                        ? 'All components deleted!'
                        : `${result.deleted_count || selectedIds.size} component(s) deleted!`
                );
                setSelectedIds(new Set());
                setBulkDeleteScope(null);
                fetchComponents(1, debouncedSearch, true);
            } else {
                throw new Error(result.message || 'Delete failed');
            }
        } catch (e) {
            toast.error(e.message || 'Failed to delete components');
        } finally { setDeleting(false); }
    };

    const toggleSelectId = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAllVisible = () => {
        if (allVisibleSelected) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(components.map(c => c.id));
            setSelectedIds(allIds);
        }
    };

    const stats = {
        total: pagination.total || 0,
        earningCount: components.filter(c => c.type === 'earning').length,
        deductionCount: components.filter(c => c.type === 'deduction').length,
        employerCount: components.filter(c => c.type === 'employer_contribution').length,
    };

    if (isInitialLoad && loading) return <SkeletonComponent />;

    const showCode = contentWidth >= 1024;
    const showCalc = contentWidth >= 768;
    const showFlags = contentWidth >= 1280;
    const showStatus = contentWidth >= 1024;
    const showType = contentWidth >= 640;
    const showValue = contentWidth >= 420;

    const componentActions = (comp) => ([
        { label: 'View Details', icon: <FaEye size={13} />, onClick: () => setSelectedComponent(comp), className: 'text-green-600 hover:text-green-700 hover:bg-green-50' },
        { label: 'Edit', icon: <FaEdit size={13} />, onClick: () => setFormModal({ mode: 'edit', data: comp }), className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50' },
        { label: 'Delete', icon: <FaTrash size={13} />, onClick: () => { setBulkDeleteScope('selected'); setSelectedIds(new Set([comp.id])); }, className: 'text-red-600 hover:text-red-700 hover:bg-red-50' },
    ]);

    const componentColumns = [
        {
            key: 'checkbox',
            label: '',
            visible: true,
            className: 'w-10',
            render: (comp) => (
                <button onClick={(e) => { e.stopPropagation(); toggleSelectId(comp.id); }} className="focus:outline-none">
                    {selectedIds.has(comp.id) ?
                        <FaCheckSquare className="text-blue-600" size={16} /> :
                        <FaRegSquare className="text-gray-400" size={16} />
                    }
                </button>
            )
        },
        {
            key: 'code', label: 'Code', visible: showCode, className: 'font-mono',
            render: (comp) => <span className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-1 font-mono text-xs font-bold text-gray-700">{comp.code}</span>
        },
        { key: 'name', label: 'Name', className: 'font-semibold text-gray-800', render: (comp) => comp.name },
        {
            key: 'type', label: 'Type', visible: showType,
            render: (comp) => {
                const tc = getTypeConfig(comp.type);
                return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tc.bg} ${tc.text} ${tc.border}`}>{formatTypeLabel(comp.type)}</span>;
            }
        },
        { key: 'calc_type', label: 'Calculation', visible: showCalc, render: (comp) => <span className="capitalize text-gray-600">{comp.calc_type}</span> },
        {
            key: 'calc_value', label: 'Value', visible: showValue,
            render: (comp) => <span className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">{formatCalcValue(comp.calc_type, comp.calc_value)}</span>
        },
        {
            key: 'flags', label: 'Flags', visible: showFlags,
            render: (comp) => (
                <div className="flex flex-wrap gap-1">
                    {comp.is_taxable && <span className="rounded border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">Tax</span>}
                    {comp.is_statutory && <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">Stat</span>}
                    {!comp.is_taxable && !comp.is_statutory && <span className="text-xs text-gray-400">—</span>}
                </div>
            )
        },
        {
            key: 'status', label: 'Status', visible: showStatus,
            render: (comp) => (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${comp.is_active ? 'border-green-200 bg-green-100 text-green-800' : 'border-gray-200 bg-gray-100 text-gray-600'}`}>
                    {comp.is_active ? 'Active' : 'Inactive'}
                </span>
            )
        },
    ];

    const emptyState = (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16 bg-white rounded-xl shadow-xl border border-gray-100">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaMoneyBillWave className="text-4xl text-gray-300" />
            </div>
            <p className="text-xl font-semibold text-gray-600">No components found</p>
            <p className="text-gray-400 mt-2 text-sm">
                {debouncedSearch ? `No results for "${debouncedSearch}"` : 'Click "Add Component" to get started'}
            </p>
            {debouncedSearch ? (
                <button onClick={() => setSearchTerm('')} className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all text-sm font-medium">Clear Search</button>
            ) : (
                <button onClick={() => setFormModal({ mode: 'create', data: {} })} className="mt-4 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all text-sm font-medium">Add Component</button>
            )}
        </motion.div>
    );

    return (
        <ManagementHub
            eyebrow={<><FaMoneyBillWave size={11} /> Global Settings</>}
            title="Salary Components"
            description="Manage earnings, deductions, and employer contribution components for payroll structure."
            accent="blue"
            onRefresh={() => fetchComponents(1, debouncedSearch, true)}
            actions={
                <div className="flex items-center gap-3">
                    <ManagementButton tone="blue" variant="solid" leftIcon={<FaPlus />} onClick={() => setFormModal({ mode: 'create', data: {} })}>
                        Add Component
                    </ManagementButton>
                </div>
            }
        >
            <div className="space-y-6 p-2 lg:p-0">
                {/* Stats */}
                {!loading && components.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Components', val: stats.total, icon: FaMoneyBillWave, color: 'blue' },
                            { label: 'Earnings', val: stats.earningCount, icon: FaPlus, color: 'green' },
                            { label: 'Deductions', val: stats.deductionCount, icon: FaMinus, color: 'red' },
                            { label: 'Contributions', val: stats.employerCount, icon: FaBuilding, color: 'indigo' },
                        ].map((s) => (
                            <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
                                    <p className="text-2xl font-black text-slate-800 mt-1">{s.val}</p>
                                </div>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${s.color === 'blue' ? 'bg-blue-50 text-blue-600' : s.color === 'green' ? 'bg-emerald-50 text-emerald-600' : s.color === 'red' ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                    <s.icon size={18} />
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}

                {/* Filter & View Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="flex flex-col lg:flex-row lg:items-center md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-2"
                >
                    <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
                        {/* Search input */}
                        <div className="relative flex-1 w-full">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                            <input
                                type="text"
                                placeholder="Search by name or code..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-medium min-h-[42px]"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                                    <FaTimes size={14} />
                                </button>
                            )}
                        </div>

                        {/* Type Filter */}
                        <div className="w-full md:w-44">
                            <Select
                                options={TYPE_FILTER_OPTIONS}
                                value={TYPE_FILTER_OPTIONS.find(opt => opt.value === typeFilter) || null}
                                onChange={(option) => {
                                    const newVal = option?.value || 'all';
                                    setTypeFilter(newVal);
                                    if (pagination.page !== 1) goToPage(1);
                                }}
                                placeholder="Type"
                                isClearable={false}
                                styles={customSelectStyles}
                            />
                        </div>

                        {/* Active/Inactive Filter */}
                        <div className="w-full md:w-44">
                            <Select
                                options={ACTIVE_FILTER_OPTIONS}
                                value={ACTIVE_FILTER_OPTIONS.find(opt => opt.value === activeFilter) || null}
                                onChange={(option) => {
                                    const newVal = option?.value || 'true';
                                    setActiveFilter(newVal);
                                    if (pagination.page !== 1) goToPage(1);
                                }}
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

                {/* ── Select All / Deselect All BUTTON ── */}
                {!loading && components.length > 0 && (
                    <div className="flex items-center gap-3 mb-1">
                        <button
                            type="button"
                            onClick={toggleSelectAllVisible}
                            className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                        >
                            {allVisibleSelected
                                ? <><FaCheckSquare size={13} /> Deselect all</>
                                : <><FaCheck size={13} /> Select all</>
                            }
                        </button>
                    </div>
                )}

                {loading && !components.length && <SkeletonComponent />}
                {!loading && components.length === 0 && emptyState}

                {!loading && components.length > 0 && viewMode === "table" && (
                    <ManagementTable
                        rows={components} columns={componentColumns} rowKey="id" accent="blue"
                        activeId={activeActionMenu} onToggleAction={(e, id) => setActiveActionMenu(curr => curr === id ? null : id)}
                        onRowClick={(row) => setSelectedComponent(row)} getActions={componentActions}
                        rowClassName="hover:bg-gradient-to-r hover:from-blue-50 hover:to-violet-50 cursor-pointer"
                    />
                )}

                {!loading && components.length > 0 && viewMode === "card" && (
                    <ManagementGrid viewMode={viewMode}>
                        {components.map((comp, index) => {
                            const tc = getTypeConfig(comp.type);
                            const accent = getCardAccentForType(comp.type);
                            const isSelected = selectedIds.has(comp.id);
                            return (
                                <div key={comp.id} className="relative group">
                                    {/* Checkbox overlay */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleSelectId(comp.id); }}
                                        className="absolute top-2 right-2 z-10 p-1 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        {isSelected ? <FaCheckSquare className="text-blue-600" size={18} /> : <FaRegSquare className="text-gray-400" size={18} />}
                                    </button>
                                    <ManagementCard
                                        accent={accent} title={comp.name} subtitle={comp.code}
                                        icon={<FaMoneyBillWave className="text-gray-600" />}
                                        badge={<span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${comp.is_active ? 'border-green-200 bg-green-100 text-green-800' : 'border-gray-200 bg-gray-100 text-gray-600'}`}>{comp.is_active ? 'Active' : 'Inactive'}</span>}
                                        actions={componentActions(comp)} menuId={`card-${comp.id}`} activeId={activeActionMenu}
                                        onToggle={(e, id) => setActiveActionMenu(curr => curr === id ? null : id)} onClick={() => setSelectedComponent(comp)}
                                        delay={index * 0.05} bodyClassName="space-y-3" footer={<span className="text-xs text-gray-400">ID: #{comp.id}</span>}
                                    >
                                        <div>
                                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tc.bg} ${tc.text} ${tc.border}`}>{formatTypeLabel(comp.type)}</span>
                                        </div>
                                        <div className="text-2xl font-bold text-indigo-600">{formatCalcValue(comp.calc_type, comp.calc_value)}</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-2 text-center">
                                                <p className="text-xs text-gray-500">Calculation</p>
                                                <p className="mt-1 text-sm font-semibold capitalize text-gray-700">{comp.calc_type}</p>
                                            </div>
                                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-2 text-center">
                                                <p className="text-xs text-gray-500">Taxable</p>
                                                <p className={`mt-1 text-sm font-semibold ${comp.is_taxable ? 'text-orange-600' : 'text-gray-400'}`}>{comp.is_taxable ? 'Yes' : 'No'}</p>
                                            </div>
                                            <div className="col-span-2 rounded-xl border border-gray-100 bg-gray-50 p-2 text-center">
                                                <p className="text-xs text-gray-500">Statutory</p>
                                                <p className={`mt-1 text-sm font-semibold ${comp.is_statutory ? 'text-blue-600' : 'text-gray-400'}`}>{comp.is_statutory ? 'Yes' : 'No'}</p>
                                            </div>
                                        </div>
                                    </ManagementCard>
                                </div>
                            );
                        })}
                    </ManagementGrid>
                )}

                {!loading && components.length > 0 && (
                    <Pagination currentPage={pagination.page} totalItems={pagination.total} itemsPerPage={pagination.limit} onPageChange={handlePageChange} showInfo={true} onLimitChange={changeLimit} />
                )}
            </div>

            {/* ── FLOATING BOTTOM BAR ── */}
            <AnimatePresence>
                {selectedIds.size > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-8 sm:bottom-8 z-[100] flex flex-wrap items-center gap-2 sm:gap-4 rounded-2xl border border-white/20 bg-white/90 px-4 py-3 sm:px-6 sm:py-4 shadow-[0_20px_50px_rgba(0,0,0,0.2)] backdrop-blur-md"
                    >
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Bulk Actions</span>
                            <span className="text-sm font-black text-slate-800">{selectedIds.size} Selected</span>
                        </div>

                        <div className="hidden sm:block mx-1 h-10 w-px bg-gray-200" />

                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setSelectedIds(new Set())}
                                className="px-3 py-1.5 text-xs font-bold text-gray-500 transition-colors hover:text-gray-700"
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={() => setBulkDeleteScope('all')}
                                disabled={!allVisibleSelected}
                                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${allVisibleSelected
                                    ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                    : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                                    }`}
                                title={allVisibleSelected ? 'Delete all components (across all pages)' : 'Select all visible components to enable'}
                            >
                                <FaTrashAlt size={11} />
                                All
                            </button>
                            <ManagementButton
                                tone="rose" variant="solid"
                                leftIcon={<FaTrash />}
                                onClick={() => setBulkDeleteScope('selected')}
                                className="shadow-lg shadow-rose-200 !text-xs !px-3 !py-1.5"
                            >
                                Delete
                            </ManagementButton>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Bulk Delete Confirm Modal ── */}
            <AnimatePresence>
                {bulkDeleteScope && (
                    <BulkDeleteConfirmModal
                        scope={bulkDeleteScope}
                        count={bulkDeleteScope === 'all' ? pagination.total : selectedIds.size}
                        onClose={() => setBulkDeleteScope(null)}
                        onConfirm={handleBulkDelete}
                        deleting={deleting}
                    />
                )}
            </AnimatePresence>

            {/* Other modals */}
            <AnimatePresence>
                {selectedComponent && <ComponentDetailModal component={selectedComponent} onClose={() => setSelectedComponent(null)} onEdit={(comp) => setFormModal({ mode: 'edit', data: comp })} onDelete={(comp) => { setBulkDeleteScope('selected'); setSelectedIds(new Set([comp.id])); }} />}
            </AnimatePresence>
            <AnimatePresence>
                {formModal && <FormModal mode={formModal.mode} initial={formModal.data} onClose={() => setFormModal(null)} onSave={handleSave} saving={saving} />}
            </AnimatePresence>
        </ManagementHub>
    );
};

export default SalaryComponents;