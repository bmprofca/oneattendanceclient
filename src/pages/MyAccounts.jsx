import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FaPlus, FaEdit, FaTrash, FaSearch, FaTimes, FaCheck,
  FaEye, FaSpinner, FaChevronDown, FaListUl, FaCog,
  FaUniversity, FaStar, FaMoneyBillWave, FaChartBar,
  FaBuilding, FaShieldAlt, FaExclamationTriangle, FaUser,
  FaCreditCard, FaIdCard, FaQrcode, FaMobileAlt,
  FaCheckSquare, FaRegSquare, FaTrashAlt,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import apiCall from '../utils/api';
import Pagination, { usePagination } from '../components/PaginationComponent';
import Modal from '../components/Modal';
import { ManagementButton, ManagementHub, ManagementTable } from '../components/common';
import usePermissionAccess from '../hooks/usePermissionAccess';
import { useAuth } from '../context/AuthContext';
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import { fetchIfscDetails } from '../utils/ifscLookup';
import SelectField from '../components/SelectField';

const ITEMS_PER_PAGE = 10;
const STATUS_OPTIONS = ['active', 'inactive'];
const ACCOUNT_TYPES = ['current', 'savings', 'upi'];

const getCompanyId = () => {
  try {
    return JSON.parse(localStorage.getItem('company'))?.id ?? null;
  } catch {
    return null;
  }
};

const STAT_STYLES = {
  violet: { iconWrap: 'bg-violet-50 text-violet-600' },
  emerald: { iconWrap: 'bg-emerald-50 text-emerald-600' },
  indigo: { iconWrap: 'bg-indigo-50 text-indigo-600' },
  amber: { iconWrap: 'bg-amber-50 text-amber-600' },
};

// Account types that represent traditional bank accounts (backend expects these)
const BANK_ACCOUNT_TYPES = ['current', 'savings', 'loan'];
const isBankAccount = (type) => BANK_ACCOUNT_TYPES.includes(type);

// ─── Badges ───────────────────────────────────────────────────────────────────

const AccountTypeBadge = ({ type, compact = false }) => {
  const isCash = type === 'cash';
  const isUpi = type === 'upi';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${isCash
      ? 'bg-amber-100 border border-amber-200 text-amber-700'
      : isUpi
        ? 'bg-emerald-100 border border-emerald-200 text-emerald-700'
        : 'bg-indigo-100 border border-indigo-200 text-indigo-700'
      } ${compact ? 'px-2 py-0.5 text-[10px] font-bold' : 'px-2.5 py-1 text-xs'}`}>
      {isCash ? <FaMoneyBillWave size={compact ? 8 : 10} /> : isUpi ? <FaQrcode size={compact ? 8 : 10} /> : <FaUniversity size={compact ? 8 : 10} />}
      {isCash ? 'CASH' : isUpi ? 'UPI' : 'BANK'}
    </span>
  );
};

const StatusBadge = ({ status, compact = false }) => {
  const isActive = status === 'active';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${isActive
      ? 'bg-emerald-100 border border-emerald-200 text-emerald-700'
      : 'bg-slate-100 border border-slate-200 text-slate-500'
      } ${compact ? 'px-2 py-0.5 text-[10px] font-bold' : 'px-2.5 py-1 text-xs'}`}>
      {isActive ? <FaCheck size={compact ? 7 : 9} /> : <FaTimes size={compact ? 7 : 9} />}
      {isActive ? 'ACTIVE' : 'INACTIVE'}
    </span>
  );
};

const PrimaryBadge = ({ compact = false }) => (
  <span className={`inline-flex items-center gap-1 rounded-full bg-violet-100 border border-violet-200 text-violet-700 font-bold ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
    }`}>
    <FaStar size={compact ? 7 : 9} /> PRIMARY
  </span>
);

const maskAccount = (num) => {
  if (!num) return '—';
  if (num.length <= 4) return num;
  return '••••  ••••  ••••  ' + num.slice(-4);
};

const shortMask = (num) => {
  if (!num) return '—';
  if (num.length <= 4) return num;
  return '••••' + num.slice(-4);
};

// ─── Action Menu ──────────────────────────────────────────────────────────────

const ActionMenu = ({ account, onEdit, onDelete, onView, editDisabled, deleteDisabled, editMessage, deleteMessage }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const items = [
    { label: 'View Details', icon: <FaEye size={13} />, onClick: () => { onView(account); setOpen(false); }, disabled: false, title: '', cls: 'text-gray-700 hover:text-violet-600 hover:bg-violet-50' },
    { label: 'Edit Account', icon: <FaEdit size={13} />, onClick: () => { onEdit(account); setOpen(false); }, disabled: editDisabled, title: editDisabled ? editMessage : '', cls: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50' },
    { label: 'Delete', icon: <FaTrash size={13} />, onClick: () => { onDelete(account); setOpen(false); }, disabled: deleteDisabled, title: deleteDisabled ? deleteMessage : '', cls: 'text-red-600 hover:text-red-700 hover:bg-red-50' },
  ];

  return (
    <div className="relative" ref={ref}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(p => !p); }}
        className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">
        <FaCog size={14} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }}
            className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-slate-100 bg-white shadow-xl overflow-hidden">
            {items.map((item) => (
              <button key={item.label} type="button" onClick={item.onClick} disabled={item.disabled} title={item.title}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${item.cls}`}>
                {item.icon}{item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Mobile Card (with optional selection checkbox) ─────────────────────────

const MobileBankCard = ({ account, onEdit, onDelete, onView, editDisabled, deleteDisabled, editMessage, deleteMessage, selected, onToggleSelect }) => {
  const showSelect = typeof onToggleSelect === 'function';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-xl shadow-sm border p-5 cursor-pointer hover:shadow-md transition-all duration-300 group h-full flex flex-col ${selected ? 'border-violet-400 ring-2 ring-violet-100' : 'border-slate-100'}`}
      onClick={() => onView(account)}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 flex items-center justify-center text-violet-600 shrink-0">
            {account.account_type === 'cash' ? <FaMoneyBillWave size={18} /> : <FaUniversity size={18} />}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-bold text-slate-800">{account.account_holder_name}</h3>
            <p className="text-[10px] text-slate-400 font-mono italic">
              {account.account_type === 'upi' ? (account.upi_id || 'UPI ID') : (account.bank_name || 'Cash Account')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {showSelect && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelect(account.bank_account_id ?? account.id); }}
              className="p-2 rounded-lg hover:bg-violet-50 transition-colors"
            >
              {selected ? <FaCheckSquare className="text-violet-600" size={16} /> : <FaRegSquare className="text-gray-400" size={16} />}
            </button>
          )}
          <ActionMenu account={account} onEdit={onEdit} onDelete={onDelete} onView={onView}
            editDisabled={editDisabled} deleteDisabled={deleteDisabled} editMessage={editMessage} deleteMessage={deleteMessage} />
        </div>
      </div>

      {/* Badges */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        <AccountTypeBadge type={account.account_type} compact />
        <StatusBadge status={account.status} compact />
        {account.is_primary && <PrimaryBadge compact />}
      </div>

      {/* Card-style visual */}
      {(isBankAccount(account.account_type) || account.account_type === 'upi') && (
        <div className={`mt-4 rounded-xl p-4 text-white bg-gradient-to-br ${account.account_type === 'upi' ? 'from-emerald-600 to-teal-700' : 'from-violet-600 to-indigo-700'}`}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/60 mb-2">
            {account.account_type === 'upi' ? 'UPI ID' : 'Account Number'}
          </p>
          <p className="font-mono text-sm font-bold tracking-widest truncate">
            {account.account_type === 'upi' ? account.upi_id : maskAccount(account.account_number)}
          </p>
          {isBankAccount(account.account_type) && account.ifsc_code && (
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-[9px] text-white/60 uppercase tracking-widest">IFSC</p>
                <p className="text-xs font-bold font-mono">{account.ifsc_code}</p>
              </div>
              {account.branch_name && (
                <div className="text-right">
                  <p className="text-[9px] text-white/60 uppercase tracking-widest">Branch</p>
                  <p className="text-xs font-bold truncate max-w-[100px]">{account.branch_name}</p>
                </div>
              )}
            </div>
          )}
          {account.account_type === 'upi' && (
            <div className="mt-3 flex items-center justify-end">
              <FaQrcode size={18} className="text-white/30" />
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
        <p className="text-[10px] text-slate-400 font-medium">
          Added {account.created_at ? new Date(account.created_at).toLocaleDateString() : '—'}
        </p>
        {account.is_active && (
          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Live
          </span>
        )}
      </div>
    </motion.div>
  );
};

// ─── Form Field ───────────────────────────────────────────────────────────────

const FormField = ({ label, required, children }) => (
  <div className="space-y-2">
    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
      {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-500/5 placeholder:font-normal placeholder:text-slate-400";
const selectCls = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 cursor-pointer appearance-none";

// ─── Empty form ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  bank_id: null,
  account_type: 'savings',
  bank_name: '',
  account_holder_name: '',
  account_number: '',
  ifsc_code: '',
  branch_name: '',
  address: '',
  city: '',
  district: '',
  state: '',
  micr: '',
  contact: '',
  upi: false,
  upi_id: '',
  is_primary: false,
  status: 'active',
};

const EMPTY_AUTO_LOCKED_FIELDS = {
  bank_name: false,
  branch_name: false,
  address: false,
  city: false,
  district: false,
  state: false,
  micr: false,
  contact: false,
};

// ─── Main Component ──────────────────────────────────────────────────────────

const MyAccountManagement = () => {
  const { employee, user, company } = useAuth();
  const { checkActionAccess, getAccessMessage } = usePermissionAccess();
  const isMountedRef = useRef(true);

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterAccountType, setFilterAccountType] = useState(null);
  const [filterIsPrimary, setFilterIsPrimary] = useState(null);
  const [totalServerItems, setTotalServerItems] = useState(null);
  const [viewModal, setViewModal] = useState({ open: false, account: null });
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('table');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteScope, setBulkDeleteScope] = useState(null); // 'selected' | 'all' | null
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [ifscLookupState, setIfscLookupState] = useState({ loading: false, error: '' });
  const [autoLockedFields, setAutoLockedFields] = useState(EMPTY_AUTO_LOCKED_FIELDS);
  const ifscLookupRequestRef = useRef(0);
  const ifscLookupTimerRef = useRef(null);
  const lastIfscLookupRef = useRef('');

  const { pagination, goToPage, changeLimit } = usePagination(1, ITEMS_PER_PAGE);

  const createAccess = checkActionAccess('employeeBankAccount', 'create');
  const updateAccess = checkActionAccess('employeeBankAccount', 'update');
  const deleteAccess = checkActionAccess('employeeBankAccount', 'delete');
  const createMessage = getAccessMessage(createAccess);
  const updateMessage = getAccessMessage(updateAccess);
  const deleteMessage = getAccessMessage(deleteAccess);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Debounce search ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ── Fetch data from server with filters and pagination ─────────────────────
  const fetchData = useCallback(async ({ force = false } = {}) => {
    const companyId = getCompanyId();
    if (!companyId) return;

    const params = new URLSearchParams();
    params.append('page', pagination.page);
    params.append('limit', pagination.limit);
    if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
    if (filterStatus?.value) params.append('status', filterStatus.value);
    if (filterAccountType?.value) params.append('account_type', filterAccountType.value);
    if (filterIsPrimary?.value !== undefined && filterIsPrimary?.value !== '') params.append('is_primary', filterIsPrimary.value);

    const qs = params.toString();
    const url = `/bank-accounts/my${qs ? `?${qs}` : ''}`;

    if (isMountedRef.current) setLoading(true);

    try {
      const response = await apiCall(url, 'GET', null, companyId);
      const result = await response.json();
      if (!isMountedRef.current) return;

      if (result.success) {
        setAccounts(result.data || []);
        if (result.meta?.total !== undefined) {
          setTotalServerItems(result.meta.total);
        } else if (result.total !== undefined) {
          setTotalServerItems(result.total);
        } else {
          setTotalServerItems(null);
        }
      } else {
        toast.error(result.message || 'Failed to fetch accounts');
        setAccounts([]);
        setTotalServerItems(null);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      toast.error('Connection error while fetching accounts');
      setAccounts([]);
      setTotalServerItems(null);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [debouncedSearchTerm, filterStatus, filterAccountType, filterIsPrimary, pagination.page, pagination.limit]);

  const initialDone = useRef(false);
  const prevDep = useRef('');

  useEffect(() => {
    const dep = `${debouncedSearchTerm}|${filterStatus?.value || ''}|${filterAccountType?.value || ''}|${filterIsPrimary?.value || ''}|${pagination.page}|${pagination.limit}`;
    if (!initialDone.current || prevDep.current !== dep) {
      fetchData();
      initialDone.current = true;
      prevDep.current = dep;
    }
  }, [debouncedSearchTerm, filterStatus, filterAccountType, filterIsPrimary, pagination.page, pagination.limit, fetchData]);

  // Reset page on filter/search change
  useEffect(() => {
    goToPage(1);
  }, [debouncedSearchTerm, filterStatus, filterAccountType, filterIsPrimary, goToPage]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => [
    { label: 'Total Accounts', value: totalServerItems ?? accounts.length, icon: FaCreditCard, color: 'violet' },
    { label: 'Active', value: accounts.filter(a => a.status === 'active').length, icon: FaCheck, color: 'emerald' },
    { label: 'Bank Accounts', value: accounts.filter(a => isBankAccount(a.account_type)).length, icon: FaUniversity, color: 'indigo' },
    { label: 'Primary Set', value: accounts.filter(a => a.is_primary).length, icon: FaStar, color: 'amber' },
  ], [accounts, totalServerItems]);

  const totalItems = totalServerItems !== null ? totalServerItems : accounts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pagination.limit));

  useEffect(() => {
    if (pagination.page > totalPages && totalPages > 0) goToPage(totalPages);
  }, [goToPage, pagination.page, totalPages]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const toggleSelectId = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds(prev => {
      const allSelected = accounts.length > 0 && accounts.every(a => prev.has(a.bank_account_id ?? a.id));
      if (allSelected) return new Set();
      return new Set(accounts.map(a => a.bank_account_id ?? a.id));
    });
  }, [accounts]);

  const allVisibleSelected = useMemo(
    () => accounts.length > 0 && accounts.every(a => selectedIds.has(a.bank_account_id ?? a.id)),
    [accounts, selectedIds]
  );

  // Clear selection when data changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [accounts, debouncedSearchTerm, filterStatus, filterAccountType, filterIsPrimary, pagination.page]);

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openModal = (mode, account = null) => {
    if (mode === 'create' && createAccess.disabled) return;
    if (mode === 'edit' && updateAccess.disabled) return;
    if (mode === 'delete' && deleteAccess.disabled) return;
    setModalMode(mode);
    setSelectedAccount(account);
    if (account && mode !== 'delete') {
      setFormData({
        bank_id: account.bank_account_id ?? account.id ?? null,
        account_type: account.account_type || 'savings',
        bank_name: account.bank_name || '',
        account_holder_name: account.account_holder_name || '',
        account_number: account.account_number || '',
        ifsc_code: account.ifsc_code || '',
        branch_name: account.branch_name || '',
        address: account.address || '',
        city: account.city || '',
        district: account.district || '',
        state: account.state || '',
        micr: account.micr || '',
        contact: account.contact || '',
        upi: account.upi ?? false,
        upi_id: account.upi_id || '',
        is_primary: account.is_primary || false,
        status: account.status || 'active',
      });
    } else if (!account) {
      setFormData({ ...EMPTY_FORM, account_type: 'savings' });
    }
    ifscLookupRequestRef.current += 1;
    if (ifscLookupTimerRef.current) {
      clearTimeout(ifscLookupTimerRef.current);
      ifscLookupTimerRef.current = null;
    }
    lastIfscLookupRef.current = '';
    setIfscLookupState({ loading: false, error: '' });
    setAutoLockedFields(EMPTY_AUTO_LOCKED_FIELDS);
    setShowModal(true);
  };

  const closeModal = useCallback(() => { if (!saving) setShowModal(false); }, [saving]);
  const closeViewModal = useCallback(() => setViewModal({ open: false, account: null }), []);

  const resetIfscLookupState = () => {
    ifscLookupRequestRef.current += 1;
    if (ifscLookupTimerRef.current) {
      clearTimeout(ifscLookupTimerRef.current);
      ifscLookupTimerRef.current = null;
    }
    lastIfscLookupRef.current = '';
    setIfscLookupState({ loading: false, error: '' });
    setAutoLockedFields(EMPTY_AUTO_LOCKED_FIELDS);
  };

  const handleIfscChange = (value) => {
    const nextIfsc = value.toUpperCase();

    setFormData((prev) => {
      const shouldClearFetchedFields = !nextIfsc.trim() || nextIfsc.length < 11 || nextIfsc !== lastIfscLookupRef.current;

      if (!shouldClearFetchedFields) {
        return { ...prev, ifsc_code: nextIfsc };
      }

      return {
        ...prev,
        ifsc_code: nextIfsc,
        bank_name: '',
        branch_name: '',
        address: '',
        city: '',
        district: '',
        state: '',
        micr: '',
        contact: '',
        upi: false,
      };
    });
    resetIfscLookupState();
  };

  const lockedInputClass = (locked) => `${inputCls} ${locked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`;
  const lockedTextareaClass = (locked) => `${inputCls} resize-none ${locked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`;

  const applyIfscLookup = useCallback(async (ifscValue, { silent = false } = {}) => {
    const ifsc = String(ifscValue || '').trim().toUpperCase();

    if (ifsc.length !== 11) {
      if (!silent) {
        toast.error('Enter a valid 11-character IFSC code');
      }
      return false;
    }

    const requestId = ++ifscLookupRequestRef.current;
    setIfscLookupState({ loading: true, error: '' });

    try {
      const details = await fetchIfscDetails(ifsc);

      if (requestId !== ifscLookupRequestRef.current || !isMountedRef.current) {
        return false;
      }

      lastIfscLookupRef.current = ifsc;
      setAutoLockedFields({
        bank_name: !!details.bank_name,
        branch_name: !!details.branch_name,
        address: !!details.address,
        city: !!details.city,
        district: !!details.district,
        state: !!details.state,
        micr: !!details.micr,
        contact: !!details.contact,
      });
      setFormData((prev) => ({
        ...prev,
        ifsc_code: ifsc,
        bank_name: details.bank_name || prev.bank_name,
        branch_name: details.branch_name || prev.branch_name,
        address: details.address || prev.address,
        city: details.city || prev.city,
        district: details.district || prev.district,
        state: details.state || prev.state,
        micr: details.micr || prev.micr,
        contact: details.contact || prev.contact,
        upi: typeof details.upi === 'boolean' ? details.upi : prev.upi,
      }));
      return true;
    } catch (error) {
      if (requestId !== ifscLookupRequestRef.current || !isMountedRef.current) {
        return false;
      }

      const message = error.message || 'Failed to fetch bank details';
      setIfscLookupState({ loading: false, error: message });
      if (!silent) {
        toast.error(message);
      }
      return false;
    } finally {
      if (requestId === ifscLookupRequestRef.current && isMountedRef.current) {
        setIfscLookupState((prev) => ({ ...prev, loading: false }));
      }
    }
  }, []);

  useEffect(() => {
    if (!showModal && !viewModal.open) return;
    const handler = (e) => {
      if (e.key === 'Escape') { if (viewModal.open) { closeViewModal(); return; } closeModal(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeModal, closeViewModal, showModal, viewModal.open]);

  useEffect(() => {
    if (!showModal || modalMode === 'delete' || !isBankAccount(formData.account_type)) {
      return undefined;
    }

    const ifsc = String(formData.ifsc_code || '').trim().toUpperCase();
    if (ifsc.length !== 11 || ifsc === lastIfscLookupRef.current) {
      return undefined;
    }

    if (ifscLookupTimerRef.current) {
      clearTimeout(ifscLookupTimerRef.current);
    }

    ifscLookupTimerRef.current = setTimeout(() => {
      void applyIfscLookup(ifsc, { silent: true });
    }, 450);

    return () => {
      if (ifscLookupTimerRef.current) {
        clearTimeout(ifscLookupTimerRef.current);
        ifscLookupTimerRef.current = null;
      }
    };
  }, [applyIfscLookup, formData.account_type, formData.ifsc_code, modalMode, showModal]);

  // ── Action (create / edit / single delete) ───────────────────────────────
  const handleAction = async () => {
    if (modalMode !== 'delete') {
      if (!formData.account_holder_name.trim()) { toast.error('Account holder name is required'); return; }
      if (isBankType && (!formData.bank_name.trim() || !formData.account_number.trim() || !formData.ifsc_code.trim())) {
        toast.error('Bank name, account number and IFSC code are required');
        return;
      }
      if (isUpiType && !formData.upi_id.trim()) { toast.error('UPI ID is required'); return; }
    }

    setSaving(true);
    try {
      const companyId = getCompanyId();
      const employeeId = company?.employee_id ?? employee?.id ?? user?.id ?? null;
      if (!employeeId) {
        throw new Error('Unable to determine your employee ID. Please refresh and try again.');
      }

      let response;

      if (modalMode === 'create') {
        const payload = {
          bank_owner_type: 'employee',
          employee_id: employeeId,
          account_type: formData.account_type,
          account_holder_name: formData.account_holder_name,
          is_primary: formData.is_primary,
        };
        if (isBankType) {
          payload.bank_name = formData.bank_name;
          payload.account_number = formData.account_number;
          payload.ifsc_code = formData.ifsc_code;
          payload.branch_name = formData.branch_name;
        } else if (isUpiType) {
          payload.upi_id = formData.upi_id;
        }
        response = await apiCall('/bank-accounts/create', 'POST', payload, companyId);
      } else if (modalMode === 'edit') {
        const payload = {
          bank_id: formData.bank_id,
          account_type: formData.account_type,
          account_holder_name: formData.account_holder_name,
          is_primary: formData.is_primary,
          status: formData.status,
        };
        if (isBankType) {
          payload.bank_name = formData.bank_name;
          payload.account_number = formData.account_number;
          payload.ifsc_code = formData.ifsc_code;
          payload.branch_name = formData.branch_name;
        } else if (isUpiType) {
          payload.upi_id = formData.upi_id;
        }
        response = await apiCall('/bank-accounts/update', 'PUT', payload, companyId);
      } else if (modalMode === 'delete') {
        response = await apiCall('/bank-accounts/delete', 'DELETE', { ids: selectedAccount.bank_account_id ?? selectedAccount.id }, companyId);
      }

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Operation failed');

      toast.success(result.message || `Account ${modalMode === 'create' ? 'added' : modalMode === 'edit' ? 'updated' : 'deleted'} successfully`);
      setShowModal(false);
      await fetchData({ force: true });
    } catch (error) {
      toast.error(error.message || 'An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Bulk Delete ──────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (bulkDeleteScope === null) return;
    setDeleting(true);
    try {
      const companyId = getCompanyId();
      const body = bulkDeleteScope === 'all'
        ? { ids: 'all' }
        : { ids: [...selectedIds] };

      const response = await apiCall('/bank-accounts/delete', 'DELETE', body, companyId);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Delete failed');

      toast.success(
        bulkDeleteScope === 'all'
          ? 'All bank accounts deleted!'
          : `${result.deleted_count || selectedIds.size} account(s) deleted!`
      );
      setSelectedIds(new Set());
      setBulkDeleteScope(null);
      await fetchData({ force: true });
    } catch (error) {
      toast.error(error.message || 'Failed to delete accounts');
    } finally {
      setDeleting(false);
    }
  };

  const handlePageChange = useCallback((page) => {
    goToPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [goToPage]);

  const isBankType = isBankAccount(formData.account_type);
  const isUpiType = formData.account_type === 'upi';
  const isEdit = modalMode === 'edit';

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    // Checkbox column (only if delete allowed)
    ...(deleteAccess.enabled ? [{
      key: 'checkbox',
      label: '',
      width: '40px',
      render: (account) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleSelectId(account.bank_account_id ?? account.id); }}
          className="focus:outline-none"
        >
          {selectedIds.has(account.bank_account_id ?? account.id)
            ? <FaCheckSquare className="text-violet-600" size={16} />
            : <FaRegSquare className="text-gray-400" size={16} />
          }
        </button>
      ),
    }] : []),
    {
      key: 'account',
      label: 'Account',
      render: (account) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 flex items-center justify-center text-violet-600 shrink-0">
            {account.account_type === 'cash' ? <FaMoneyBillWave size={14} /> : account.account_type === 'upi' ? <FaQrcode size={14} /> : <FaUniversity size={14} />}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-800 text-sm truncate">{account.account_holder_name}</div>
            <div className="text-[10px] text-slate-400 font-mono italic">
              {account.account_type === 'upi' ? (account.upi_id || 'UPI ID') : (account.bank_name || 'Cash Account')}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'type_badges',
      label: 'Type',
      render: (account) => (
        <div className="flex flex-col gap-1">
          <AccountTypeBadge type={account.account_type} compact />
          {account.is_primary && <PrimaryBadge compact />}
        </div>
      ),
    },
    {
      key: 'account_number',
      label: 'Account No.',
      render: (account) => (
        <span className="font-mono text-sm text-slate-600">
          {account.account_type === 'upi' ? account.upi_id : shortMask(account.account_number)}
        </span>
      ),
    },
    {
      key: 'ifsc_branch',
      label: 'IFSC / Branch',
      render: (account) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-700">{account.ifsc_code || '—'}</span>
          <span className="text-[10px] text-slate-400">{account.branch_name || ''}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (account) => <StatusBadge status={account.status} compact />,
    },
  ];

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading && accounts.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <FaSpinner className="animate-spin text-violet-500 text-4xl" />
          <p className="text-slate-400 font-medium animate-pulse">Loading your accounts...</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ManagementHub
      eyebrow={<><FaIdCard size={11} /> My Finances</>}
      title="My Bank Accounts"
      description="Manage your personal bank accounts and payment details linked to your profile."
      accent="violet"
      onRefresh={() => fetchData({ force: true })}
      actions={
        <>
          <ManagementButton
            tone="violet"
            variant="solid"
            leftIcon={<FaPlus />}
            onClick={() => openModal('create')}
            disabled={createAccess.disabled}
            title={createAccess.disabled ? createMessage : ''}
          >
            Add Account
          </ManagementButton>
        </>
      }
    >
      <div className="space-y-6 p-2 lg:p-0">
        {/* ── Stats ── */}
        {!loading && accounts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-500 transition-colors">{stat.label}</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${STAT_STYLES[stat.color].iconWrap}`}>
                  <stat.icon size={18} />
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Primary account spotlight ── */}
        {!loading && accounts.some(a => a.is_primary && a.account_type === 'bank') && (() => {
          const primary = accounts.find(a => a.is_primary && a.account_type === 'bank');
          return (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-indigo-800 p-6 text-white shadow-xl shadow-violet-200">
                <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5" />
                <div className="pointer-events-none absolute -bottom-6 right-16 h-28 w-28 rounded-full bg-white/5" />

                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FaStar size={11} className="text-amber-300" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Primary Account</span>
                    </div>
                    <p className="text-sm font-semibold text-white/70">{primary.bank_name}</p>
                    <p className="mt-1 font-mono text-lg font-bold tracking-[0.18em]">{maskAccount(primary.account_number)}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end text-sm">
                    <div>
                      <p className="text-[9px] text-white/50 uppercase tracking-widest">Holder</p>
                      <p className="font-bold">{primary.account_holder_name}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/50 uppercase tracking-widest">IFSC</p>
                      <p className="font-mono font-bold">{primary.ifsc_code || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* ── Filter & View Bar (One line on desktop) ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col lg:flex-row gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-2"
        >
          {/* Search - half width on desktop */}
          <div className="relative flex-1 min-w-[200px] lg:max-w-[50%]">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by bank name, account number, IFSC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 outline-none transition-all text-sm min-h-[42px]"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-[130px]">
              <SelectField
                options={[{ value: '', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
                value={filterStatus || { value: '', label: 'All Status' }}
                onChange={(opt) => { setFilterStatus(opt.value ? opt : null); goToPage(1); }}
              />
            </div>
            <div className="w-[140px]">
              <SelectField
                options={[
                  { value: '', label: 'All Types' },
                  { value: 'savings', label: 'Savings' },
                  { value: 'current', label: 'Current' },
                  { value: 'upi', label: 'UPI' },
                ]}
                value={filterAccountType || { value: '', label: 'All Types' }}
                onChange={(opt) => { setFilterAccountType(opt.value ? opt : null); goToPage(1); }}
              />
            </div>
            <div className="w-[140px]">
              <SelectField
                options={[
                  { value: '', label: 'All Primary' },
                  { value: 'true', label: 'Primary Only' },
                  { value: 'false', label: 'Non-Primary' },
                ]}
                value={filterIsPrimary || { value: '', label: 'All Primary' }}
                onChange={(opt) => { setFilterIsPrimary(opt.value ? opt : null); goToPage(1); }}
              />
            </div>
          </div>

          {/* View Switcher */}
          <div className="flex items-center justify-end lg:ml-auto">
            <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="violet" />
          </div>
        </motion.div>

        {/* ── Select All / Deselect All (only if delete allowed and accounts exist) ── */}
        {!loading && accounts.length > 0 && deleteAccess.enabled && (
          <div className="flex items-center gap-3 mb-1">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
            >
              {allVisibleSelected
                ? <><FaCheckSquare size={13} /> Deselect all</>
                : <><FaCheck size={13} /> Select all</>
              }
            </button>
          </div>
        )}

        {/* ── Content ── */}
        {totalItems === 0 && !loading ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-100">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <FaUniversity size={24} />
            </div>
            <p className="text-slate-500 font-bold">No accounts found</p>
            <p className="text-slate-400 text-sm mt-1 mx-auto max-w-xs">
              {debouncedSearchTerm ? `No results matching "${debouncedSearchTerm}"` : 'Add your first bank account to get started.'}
            </p>
          </motion.div>
        ) : viewMode === 'table' ? (
          <ManagementTable
            rows={accounts}
            columns={columns}
            rowKey={(row) => row.bank_account_id ?? row.id}
            onRowClick={(row) => setViewModal({ open: true, account: row })}
            getActions={(row) => [
              { label: 'View Details', icon: <FaEye size={13} />, onClick: () => setViewModal({ open: true, account: row }), className: 'text-green-600 hover:text-green-700 hover:bg-green-50' },
              { label: 'Edit Account', icon: <FaEdit size={13} />, onClick: () => openModal('edit', row), disabled: updateAccess.disabled, title: updateAccess.disabled ? updateMessage : '', className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50' },
              { label: 'Delete', icon: <FaTrash size={13} />, onClick: () => openModal('delete', row), disabled: deleteAccess.disabled, title: deleteAccess.disabled ? deleteMessage : '', className: 'text-red-600 hover:text-red-700 hover:bg-red-50' },
            ]}
            accent="violet"
          />
        ) : (
          <ManagementGrid viewMode="card">
            {accounts.map((account) => (
              <MobileBankCard
                key={account.bank_account_id ?? account.id}
                account={account}
                onEdit={(r) => openModal('edit', r)}
                onDelete={(r) => openModal('delete', r)}
                onView={(r) => setViewModal({ open: true, account: r })}
                editDisabled={updateAccess.disabled}
                deleteDisabled={deleteAccess.disabled}
                editMessage={updateMessage}
                deleteMessage={deleteMessage}
                selected={selectedIds.has(account.bank_account_id ?? account.id)}
                onToggleSelect={deleteAccess.enabled ? toggleSelectId : undefined}
              />
            ))}
          </ManagementGrid>
        )}

        {/* ── Pagination ── */}
        {totalItems > 0 && (
          <div className="mt-8">
            <Pagination
              currentPage={pagination.page}
              totalItems={totalItems}
              itemsPerPage={pagination.limit}
              onPageChange={handlePageChange}
              onLimitChange={changeLimit}
              showInfo
            />
          </div>
        )}
      </div>

      {/* ── FLOATING BOTTOM BAR (bulk delete) ── */}
      <AnimatePresence>
        {selectedIds.size > 0 && deleteAccess.enabled && (
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
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  allVisibleSelected
                    ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                    : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                }`}
                title={allVisibleSelected ? 'Delete all bank accounts (across all pages)' : 'Select all visible accounts to enable'}
              >
                <FaTrashAlt size={11} />
                All
              </button>
              <ManagementButton
                tone="rose"
                variant="solid"
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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex justify-center items-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shadow-sm border border-rose-100">
                    <FaExclamationTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Delete Accounts</h2>
                    <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                      {bulkDeleteScope === 'all' ? 'All records' : `${selectedIds.size} selected`}
                    </p>
                  </div>
                </div>
                <button onClick={() => setBulkDeleteScope(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all">
                  <FaTimes className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="p-6 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="w-16 h-16 bg-gradient-to-br from-rose-50 to-red-50 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-lg shadow-rose-100/50"
                >
                  <FaExclamationTriangle className="text-2xl text-rose-500" />
                </motion.div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">Are you sure?</h3>
                  <p className="text-xs text-slate-500 leading-relaxed px-4">
                    {bulkDeleteScope === 'all'
                      ? 'This will permanently delete all bank accounts. This action cannot be undone.'
                      : `Permanently delete ${selectedIds.size} bank account${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`
                    }
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 bg-slate-50 px-5 py-3.5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setBulkDeleteScope(null)}
                  className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:from-rose-700 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-rose-200"
                >
                  {deleting ? <FaSpinner className="animate-spin" /> : <FaTrash />}
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── View Modal ── */}
      <Modal
        isOpen={viewModal.open && !!viewModal.account}
        onClose={closeViewModal}
        title={viewModal.account?.account_holder_name}
        subtitle={viewModal.account?.account_type === 'upi' ? viewModal.account?.upi_id : (viewModal.account?.bank_name || 'Cash Account')}
        icon={viewModal.account?.account_type === 'cash' ? <FaMoneyBillWave size={22} /> : viewModal.account?.account_type === 'upi' ? <FaQrcode size={22} /> : <FaUniversity size={22} />}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <button
              onClick={closeViewModal}
              className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
            >
              Close
            </button>
            <button
              onClick={() => { closeViewModal(); openModal('delete', viewModal.account); }}
              disabled={deleteAccess.disabled}
              title={deleteAccess.disabled ? deleteMessage : ''}
              className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-rose-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaTrash /> Delete
            </button>
            <button
              onClick={() => { closeViewModal(); openModal('edit', viewModal.account); }}
              disabled={updateAccess.disabled}
              title={updateAccess.disabled ? updateMessage : ''}
              className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-violet-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaEdit /> Edit Account
            </button>
          </div>
        }
      >
        {/* View modal content unchanged */}
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <AccountTypeBadge type={viewModal.account?.account_type} />
            <StatusBadge status={viewModal.account?.status} />
            {viewModal.account?.is_primary && <PrimaryBadge />}
          </div>

          {(isBankAccount(viewModal.account?.account_type) || viewModal.account?.account_type === 'upi') && (
            <div className={`relative overflow-hidden rounded-xl p-6 text-white shadow-lg bg-gradient-to-br ${viewModal.account?.account_type === 'upi' ? 'from-emerald-600 via-teal-600 to-emerald-800' : 'from-violet-600 via-indigo-600 to-indigo-800'}`}>
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/5" />
              <div className="pointer-events-none absolute -bottom-4 right-12 h-20 w-20 rounded-full bg-white/5" />
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-3">
                {viewModal.account?.account_type === 'upi' ? 'UPI ID' : 'Account Number'}
              </p>
              <p className="font-mono text-base font-bold tracking-[0.2em] truncate">
                {viewModal.account?.account_type === 'upi' ? viewModal.account?.upi_id : maskAccount(viewModal.account?.account_number)}
              </p>
              <div className="mt-4 flex justify-between items-end">
                <div>
                  <p className="text-[9px] text-white/50 uppercase tracking-widest">Holder</p>
                  <p className="text-sm font-bold">{viewModal.account?.account_holder_name}</p>
                </div>
                {viewModal.account?.account_type === 'upi' ? <FaQrcode size={28} className="text-white/20" /> : <FaUniversity size={28} className="text-white/20" />}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'IFSC Code', value: viewModal.account?.ifsc_code || '—' },
              { label: 'Branch', value: viewModal.account?.branch_name || '—' },
              { label: 'Added On', value: viewModal.account?.created_at ? new Date(viewModal.account.created_at).toLocaleDateString() : '—' },
              { label: 'Live Status', value: viewModal.account?.is_active ? 'Active' : 'Inactive' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-sm font-bold text-slate-700">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 p-4 bg-violet-50/60 border border-violet-100 rounded-xl">
            <FaShieldAlt className="text-violet-400 shrink-0" size={16} />
            <p className="text-xs text-violet-600 font-medium">Your account details are encrypted and stored securely.</p>
          </div>
        </div>
      </Modal>

      {/* ── Create / Edit / Delete Modal ── */}
      {modalMode === 'delete' ? (
        <Modal
          isOpen={showModal}
          onClose={closeModal}
          title="Remove Account"
          subtitle="This action cannot be undone"
          icon={<FaTrash className="text-sm" />}
          size="lg"
          footer={
            <>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAction}
                disabled={saving || deleteAccess.disabled}
                title={deleteAccess.disabled ? deleteMessage : ''}
                className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-medium hover:from-red-700 hover:to-rose-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Removing...' : 'Remove Account'}
              </button>
            </>
          }
        >
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto">
              <FaExclamationTriangle className="text-red-400" size={22} />
            </div>
            <p className="text-slate-600 text-sm leading-relaxed">
              Are you sure you want to remove <span className="font-bold text-slate-800">"{selectedAccount?.account_holder_name}"</span>? This cannot be undone.
            </p>
          </div>
        </Modal>
      ) : (
        <Modal
          isOpen={showModal}
          onClose={closeModal}
          title={modalMode === 'create' ? 'Add Bank Account' : 'Edit Account'}
          subtitle={modalMode === 'create' ? 'Link a new account to your profile' : `Editing: ${selectedAccount?.account_holder_name}`}
          icon={modalMode === 'create' ? <FaPlus /> : <FaEdit />}
          size="lg"
          footer={
            <>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleAction}
                disabled={
                  saving ||
                  !formData.account_holder_name.trim() ||
                  (isBankType && (!formData.bank_name.trim() || !formData.account_number.trim() || !formData.ifsc_code.trim())) ||
                  (isUpiType && !formData.upi_id.trim()) ||
                  (modalMode === 'create' ? createAccess.disabled : updateAccess.disabled)
                }
                title={modalMode === 'create' ? (createAccess.disabled ? createMessage : '') : (updateAccess.disabled ? updateMessage : '')}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <div className="flex items-center justify-center gap-2"><FaSpinner className="animate-spin" /><span>Saving...</span></div>
                ) : modalMode === 'create' ? 'Add Account' : 'Save Changes'}
              </button>
            </>
          }
        >
          {/* Modal form content unchanged */}
          <div className="space-y-5">
            {isEdit ? (
              <FormField label="Account Type">
                <div className="flex items-center gap-3">
                  <AccountTypeBadge type={formData.account_type} />
                  <span className="text-sm font-semibold text-slate-700">
                    {formData.account_type === 'upi' ? 'UPI' : 'Bank Account'}
                  </span>
                </div>
              </FormField>
            ) : (
              <FormField label="Account Type">
                <div className="flex flex-wrap gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                  {ACCOUNT_TYPES.map((type) => {
                    const isActive = formData.account_type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, account_type: type }))}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive
                          ? 'bg-white text-violet-600 shadow-sm border border-violet-100 ring-4 ring-violet-500/5'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                          }`}
                      >
                        {type === 'upi' ? <FaQrcode size={12} /> : <FaUniversity size={12} />}
                        {type}
                      </button>
                    );
                  })}
                </div>
              </FormField>
            )}

            <FormField label="Account Holder Name" required>
              <input
                type="text"
                value={formData.account_holder_name}
                onChange={(e) => setFormData(p => ({ ...p, account_holder_name: e.target.value }))}
                placeholder="Your full name as on bank records"
                className={inputCls}
              />
            </FormField>

            {isUpiType && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <FormField label="UPI ID" required>
                  <input
                    type="text"
                    value={formData.upi_id}
                    onChange={(e) => setFormData(p => ({ ...p, upi_id: e.target.value }))}
                    placeholder="e.g. yourname@okaxis"
                    className={inputCls}
                  />
                </FormField>
              </motion.div>
            )}

            {isBankType && (
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField label="Account Number" required>
                    <input type="text" value={formData.account_number} onChange={(e) => setFormData(p => ({ ...p, account_number: e.target.value }))} placeholder="98765432100" className={inputCls} />
                  </FormField>
                  <FormField label="IFSC Code" required>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.ifsc_code}
                          onChange={(e) => handleIfscChange(e.target.value)}
                          placeholder="HDFC0005678"
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={() => void applyIfscLookup(formData.ifsc_code)}
                          disabled={ifscLookupState.loading || formData.ifsc_code.trim().length !== 11}
                          className="shrink-0 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {ifscLookupState.loading ? 'Checking...' : 'Fetch'}
                        </button>
                      </div>
                      {ifscLookupState.error && (
                        <p className="text-xs font-semibold text-rose-500">{ifscLookupState.error}</p>
                      )}
                    </div>
                  </FormField>
                </div>
                <FormField label="Bank Name" required>
                  <input
                    type="text"
                    value={formData.bank_name}
                    onChange={(e) => setFormData(p => ({ ...p, bank_name: e.target.value }))}
                    readOnly={autoLockedFields.bank_name}
                    placeholder="e.g. HDFC Bank"
                    className={lockedInputClass(autoLockedFields.bank_name)}
                  />
                </FormField>
                <FormField label="Branch Name">
                  <input
                    type="text"
                    value={formData.branch_name}
                    onChange={(e) => setFormData(p => ({ ...p, branch_name: e.target.value }))}
                    readOnly={autoLockedFields.branch_name}
                    placeholder="e.g. Salt Lake Branch"
                    className={lockedInputClass(autoLockedFields.branch_name)}
                  />
                </FormField>
              </div>
            )}

            {isEdit && (
              <FormField label="Status">
                <div className="relative">
                  <select value={formData.status} onChange={(e) => setFormData(p => ({ ...p, status: e.target.value }))} className={selectCls}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                  <FaChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={11} />
                </div>
              </FormField>
            )}

            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/60">
              <div>
                <p className="text-sm font-bold text-slate-700">Set as Primary Account</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Salary and reimbursements will be credited here</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, is_primary: !p.is_primary }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.is_primary ? 'bg-violet-500' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${formData.is_primary ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </ManagementHub>
  );
};

export default MyAccountManagement;