import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FaSearch, FaTimes, FaCheck,
  FaUser, FaSpinner,
  FaUniversity, FaStar, FaPlus,
  FaMoneyBillWave, FaChartBar, FaEye, FaQrcode, FaShieldAlt,
  FaEdit, FaTrash, FaExclamationTriangle, FaChevronDown,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import apiCall from '../utils/api';
import Pagination, { usePagination } from '../components/PaginationComponent';
import Modal from '../components/Modal';
import { ManagementHub, ManagementTable, ManagementButton } from '../components/common';
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import { fetchIfscDetails } from '../utils/ifscLookup';
import EmployeeSelect from '../components/common/EmployeeSelect';
import SelectField from '../components/SelectField';

const ITEMS_PER_PAGE = 10;

const getCompanyId = () => {
  try {
    return JSON.parse(localStorage.getItem('company'))?.id ?? null;
  } catch {
    return null;
  }
};

const STAT_STYLES = {
  blue: { iconWrap: 'bg-blue-50 text-blue-600', glow: 'bg-blue-100/70' },
  emerald: { iconWrap: 'bg-emerald-50 text-emerald-600', glow: 'bg-emerald-100/70' },
  indigo: { iconWrap: 'bg-indigo-50 text-indigo-600', glow: 'bg-indigo-100/70' },
  amber: { iconWrap: 'bg-amber-50 text-amber-600', glow: 'bg-amber-100/70' },
};

// Valid account types for employee bank accounts per API spec
const EMPLOYEE_ACCOUNT_TYPES = ['savings', 'current', 'upi'];
const BANK_ACCOUNT_TYPES = ['bank', 'savings', 'current', 'loan'];
const isBankAccount = (type) => BANK_ACCOUNT_TYPES.includes(type);

const employeeBankAccountsRequestCache = new Map();
const getEmployeeBankAccountsCacheKey = (companyId) => String(companyId ?? 'no-company');

// ─── Form Defaults ──────────────────────────────────────────────────────────────

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
  upi_id: '',
  is_primary: false,
  employee_id: '',
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AccountTypeBadge = ({ type, compact = false }) => {
  const isCash = type === 'cash';
  const isUpi = type === 'upi';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${isCash
        ? 'bg-amber-100 border border-amber-200 text-amber-700'
        : isUpi
          ? 'bg-emerald-100 border border-emerald-200 text-emerald-700'
          : 'bg-indigo-100 border border-indigo-200 text-indigo-700'
        } ${compact ? 'px-2 py-0.5 text-[10px] font-bold' : 'px-2.5 py-1 text-xs'}`}
    >
      {isCash ? <FaMoneyBillWave size={compact ? 8 : 10} /> : isUpi ? <FaQrcode size={compact ? 8 : 10} /> : <FaUniversity size={compact ? 8 : 10} />}
      {isCash ? 'CASH' : isUpi ? 'UPI' : 'BANK'}
    </span>
  );
};

const StatusBadge = ({ status, compact = false }) => {
  const isActive = status === 'active';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${isActive
        ? 'bg-emerald-100 border border-emerald-200 text-emerald-700'
        : 'bg-slate-100 border border-slate-200 text-slate-500'
        } ${compact ? 'px-2 py-0.5 text-[10px] font-bold' : 'px-2.5 py-1 text-xs'}`}
    >
      {isActive ? <FaCheck size={compact ? 7 : 9} /> : <FaTimes size={compact ? 7 : 9} />}
      {isActive ? 'ACTIVE' : 'INACTIVE'}
    </span>
  );
};

const PrimaryBadge = ({ compact = false }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 text-blue-700 font-bold ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}
  >
    <FaStar size={compact ? 7 : 9} /> PRIMARY
  </span>
);

const maskAccount = (num) => {
  if (!num) return '—';
  if (num.length <= 4) return num;
  return '••••' + num.slice(-4);
};

// ─── Form Field ────────────────────────────────────────────────────────────────

const FormField = ({ label, children }) => (
  <div className="space-y-2">
    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 placeholder:font-normal placeholder:text-slate-400";

const lockedInputClass = (locked) => `${inputCls} ${locked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`;

// ─── Mobile Card ───────────────────────────────────────────────────────────────

const MobileEmployeeBankCard = ({ account, onView }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 cursor-pointer hover:shadow-md transition-all duration-300 group h-full flex flex-col"
    onClick={() => onView(account)}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
          {account.account_type === 'cash' ? <FaMoneyBillWave size={18} /> : <FaUniversity size={18} />}
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-bold text-slate-800">{account.employee_name || account.account_holder_name}</h3>
          <p className="text-[10px] text-slate-400 font-mono italic">
            {account.account_type === 'upi' ? (account.upi_id || 'UPI ID') : (account.bank_name || 'Cash Account')}
          </p>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onView(account); }}
        className="p-2 rounded-xl text-green-600 hover:text-green-700 hover:bg-green-50 transition-all shrink-0"
        title="View Details"
      >
        <FaEye size={14} />
      </button>
    </div>

    <div className="mt-4 flex flex-wrap gap-1.5">
      <AccountTypeBadge type={account.account_type} compact />
      <StatusBadge status={account.status} compact />
      {account.is_primary && <PrimaryBadge compact />}
    </div>

    <div className="mt-4 space-y-2">
      {account.employee_code && (
        <div className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
          <span className="text-[10px] font-bold text-blue-600 uppercase">Employee ID</span>
          <span className="text-xs font-black text-blue-700 font-mono">
            {account.employee_code || account.employee_id}
          </span>
        </div>
      )}
      {account.account_type === 'upi' && (
        <div className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
          <span className="text-[10px] font-bold text-emerald-600 uppercase">UPI ID</span>
          <span className="text-xs font-black text-emerald-700 font-mono">{account.upi_id}</span>
        </div>
      )}
      {account.account_number && isBankAccount(account.account_type) && (
        <div className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100/50">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Account No.</span>
          <span className="text-xs font-black text-slate-700 font-mono">
            {account.account_number_masked || maskAccount(account.account_number)}
          </span>
        </div>
      )}
      {account.ifsc_code && isBankAccount(account.account_type) && (
        <div className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100/50">
          <span className="text-[10px] font-bold text-slate-400 uppercase">IFSC</span>
          <span className="text-xs font-black text-slate-700 font-mono">{account.ifsc_code}</span>
        </div>
      )}
    </div>
  </motion.div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const EmployeeBankAccountManagement = () => {
  const isMountedRef = useRef(true);
  const [accounts, setAccounts] = useState([]);
  const [filteredAccounts, setFilteredAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterAccountType, setFilterAccountType] = useState(null);
  const [filterIsPrimary, setFilterIsPrimary] = useState(null);
  const [filterEmployee, setFilterEmployee] = useState(null);
  const [totalServerItems, setTotalServerItems] = useState(null);
  const [viewModal, setViewModal] = useState({ open: false, account: null });
  const [viewMode, setViewMode] = useState('table');

  // ── Add Account Modal State ──────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [ifscLookupState, setIfscLookupState] = useState({ loading: false, error: '' });
  const [autoLockedFields, setAutoLockedFields] = useState(EMPTY_AUTO_LOCKED_FIELDS);
  const ifscLookupRequestRef = useRef(0);
  const ifscLookupTimerRef = useRef(null);
  const lastIfscLookupRef = useRef('');

  const getEffectiveWidth = () => {
    const width = window.innerWidth;
    const offset = width >= 1024 ? 280 : (width >= 768 ? 80 : 0);
    return width - offset;
  };

  const getVisibleColumns = useCallback((width) => ({
    showEmployee: true,
    showAccount: width >= 640,
    showType: width >= 540,
    showAccountNumber: width >= 760,
    showIfscBranch: width >= 980,
    showStatus: width >= 620,
  }), []);
  const [visibleColumns, setVisibleColumns] = useState(() => getVisibleColumns(getEffectiveWidth()));

  const { pagination, goToPage, changeLimit } = usePagination(1, ITEMS_PER_PAGE);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    let timer;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setVisibleColumns(getVisibleColumns(getEffectiveWidth()));
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => { clearTimeout(timer); window.removeEventListener('resize', handleResize); };
  }, [getVisibleColumns]);

  // ── Fetch ────────────────────────────────────────────────────────────────────

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
    if (filterEmployee?.id) params.append('employee_id', filterEmployee.id);

    const qs = params.toString();
    const url = `/bank-accounts/management/employee${qs ? `?${qs}` : ''}`;

    const cacheKey = getEmployeeBankAccountsCacheKey(companyId) + '-' + qs;
    let requestPromise = force ? null : employeeBankAccountsRequestCache.get(cacheKey);

    if (!requestPromise) {
      requestPromise = (async () => {
        const response = await apiCall(url, 'GET', null, companyId);
        return response.json();
      })();
      employeeBankAccountsRequestCache.set(cacheKey, requestPromise);
    }

    if (isMountedRef.current) setLoading(true);

    try {
      const result = await requestPromise;
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
        toast.error(result.message || 'Failed to fetch employee bank accounts');
        setAccounts([]);
        setTotalServerItems(null);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      toast.error('Connection error while fetching employee bank accounts');
      setAccounts([]);
      setTotalServerItems(null);
    } finally {
      if (isMountedRef.current) setLoading(false);
      if (employeeBankAccountsRequestCache.get(cacheKey) === requestPromise) {
        employeeBankAccountsRequestCache.delete(cacheKey);
      }
    }
  }, [debouncedSearchTerm, filterStatus, filterAccountType, filterIsPrimary, filterEmployee, pagination.page, pagination.limit]);

  const initialDone = useRef(false);
  const prevDep = useRef('');

  useEffect(() => {
    const dep = `${debouncedSearchTerm}|${filterStatus?.value || ''}|${filterAccountType?.value || ''}|${filterIsPrimary?.value || ''}|${filterEmployee?.id || ''}|${pagination.page}|${pagination.limit}`;
    if (!initialDone.current || prevDep.current !== dep) {
      fetchData();
      initialDone.current = true;
      prevDep.current = dep;
    }
  }, [debouncedSearchTerm, filterStatus, filterAccountType, filterIsPrimary, filterEmployee, pagination.page, pagination.limit, fetchData]);

  // ── Filter ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    if (totalServerItems !== null) {
      setFilteredAccounts(accounts);
      return;
    }
    const q = debouncedSearchTerm.trim().toLowerCase();
    let list = [...accounts];
    if (q) {
      list = list.filter((a) =>
        a.employee_name?.toLowerCase().includes(q) ||
        a.employee_id?.toLowerCase().includes(q) ||
        a.account_holder_name?.toLowerCase().includes(q) ||
        a.bank_name?.toLowerCase().includes(q) ||
        a.account_number?.toLowerCase().includes(q) ||
        a.ifsc_code?.toLowerCase().includes(q) ||
        a.account_type?.toLowerCase().includes(q) ||
        a.status?.toLowerCase().includes(q)
      );
    }
    if (filterStatus?.value) list = list.filter(a => a.status === filterStatus.value);
    if (filterAccountType?.value) list = list.filter(a => a.account_type === filterAccountType.value);
    if (filterIsPrimary?.value !== undefined && filterIsPrimary?.value !== '') list = list.filter(a => String(a.is_primary) === String(filterIsPrimary.value));
    if (filterEmployee?.id) list = list.filter(a => String(a.employee_id) === String(filterEmployee.id));

    setFilteredAccounts(list);
  }, [accounts, debouncedSearchTerm, filterStatus, filterAccountType, filterIsPrimary, filterEmployee, totalServerItems]);

  useEffect(() => { goToPage(1); }, [debouncedSearchTerm, filterStatus, filterAccountType, filterIsPrimary, filterEmployee, goToPage]);

  const totalItems = totalServerItems !== null ? totalServerItems : filteredAccounts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pagination.limit));

  useEffect(() => {
    if (pagination.page > totalPages && totalPages > 0) goToPage(totalPages);
  }, [goToPage, pagination.page, totalPages]);

  const paginatedData = useMemo(() => {
    if (totalServerItems !== null) return filteredAccounts;
    return filteredAccounts.slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit);
  }, [filteredAccounts, pagination.page, pagination.limit, totalServerItems]);

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => [
    { label: 'Total Accounts', value: accounts.length, icon: FaUniversity, color: 'blue', isCount: true },
    { label: 'Active Accounts', value: accounts.filter(a => a.status === 'active').length, icon: FaCheck, color: 'emerald', isCount: true },
    { label: 'Bank Accounts', value: accounts.filter(a => isBankAccount(a.account_type)).length, icon: FaUniversity, color: 'indigo', isCount: true },
    { label: 'UPI/Cash Accounts', value: accounts.filter(a => a.account_type === 'cash' || a.account_type === 'upi').length, icon: FaMoneyBillWave, color: 'amber', isCount: true },
  ], [accounts]);

  // ── IFSC Lookup ───────────────────────────────────────────────────────────────

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
      if (!shouldClearFetchedFields) return { ...prev, ifsc_code: nextIfsc };
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
      };
    });
    resetIfscLookupState();
  };

  const applyIfscLookup = useCallback(async (ifscValue, { silent = false } = {}) => {
    const ifsc = String(ifscValue || '').trim().toUpperCase();
    if (ifsc.length !== 11) {
      if (!silent) toast.error('Enter a valid 11-character IFSC code');
      return false;
    }

    const requestId = ++ifscLookupRequestRef.current;
    setIfscLookupState({ loading: true, error: '' });

    try {
      const details = await fetchIfscDetails(ifsc);
      if (requestId !== ifscLookupRequestRef.current || !isMountedRef.current) return false;

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
      }));
      return true;
    } catch (error) {
      if (requestId !== ifscLookupRequestRef.current || !isMountedRef.current) return false;
      const message = error.message || 'Failed to fetch bank details';
      setIfscLookupState({ loading: false, error: message });
      if (!silent) toast.error(message);
      return false;
    } finally {
      if (requestId === ifscLookupRequestRef.current && isMountedRef.current) {
        setIfscLookupState((prev) => ({ ...prev, loading: false }));
      }
    }
  }, []);

  // Auto-lookup IFSC after debounce
  useEffect(() => {
    if (!showModal || !['savings', 'current'].includes(formData.account_type)) return undefined;

    const ifsc = String(formData.ifsc_code || '').trim().toUpperCase();
    if (ifsc.length !== 11 || ifsc === lastIfscLookupRef.current) return undefined;

    if (ifscLookupTimerRef.current) clearTimeout(ifscLookupTimerRef.current);
    ifscLookupTimerRef.current = setTimeout(() => {
      void applyIfscLookup(ifsc, { silent: true });
    }, 450);

    return () => {
      if (ifscLookupTimerRef.current) {
        clearTimeout(ifscLookupTimerRef.current);
        ifscLookupTimerRef.current = null;
      }
    };
  }, [applyIfscLookup, formData.account_type, formData.ifsc_code, showModal]);

  // ── Modal helpers ─────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setFormData({ ...EMPTY_FORM });
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

  useEffect(() => {
    if (!showModal && !viewModal.open) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (viewModal.open) { closeViewModal(); return; }
        closeModal();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeModal, closeViewModal, showModal, viewModal.open]);

  // ── Action ───────────────────────────────────────────────────────────────────

  const isBankType = ['savings', 'current'].includes(formData.account_type);
  const isUpiType = formData.account_type === 'upi';

  const handleAction = async () => {
    if (!formData.employee_id) { toast.error('Employee ID is required'); return; }
    if (!formData.account_holder_name.trim()) { toast.error('Account holder name is required'); return; }
    if (isBankType) {
      if (!formData.bank_name.trim()) { toast.error('Bank name is required'); return; }
      if (!formData.account_number.trim()) { toast.error('Account number is required'); return; }
      if (!formData.ifsc_code.trim()) { toast.error('IFSC code is required'); return; }
    }
    if (isUpiType) {
      if (!formData.upi_id.trim()) { toast.error('UPI ID is required'); return; }
    }

    setSaving(true);
    try {
      const companyId = getCompanyId();

      const payload = isBankType
        ? {
            bank_owner_type: 'employee',
            employee_id: Number(formData.employee_id),
            account_type: formData.account_type,
            bank_name: formData.bank_name,
            account_holder_name: formData.account_holder_name,
            account_number: formData.account_number,
            ifsc_code: formData.ifsc_code,
            branch_name: formData.branch_name,
            is_primary: formData.is_primary,
          }
        : {
            bank_owner_type: 'employee',
            employee_id: Number(formData.employee_id),
            account_type: 'upi',
            upi_id: formData.upi_id,
            is_primary: formData.is_primary,
          };

      const response = await apiCall('/bank-accounts/create', 'POST', payload, companyId);
      const result = await response.json();

      if (!response.ok || !result.success) throw new Error(result.message || 'Operation failed');

      toast.success(result.message || 'Account added successfully');
      setShowModal(false);
      await fetchData({ force: true });
    } catch (error) {
      toast.error(error.message || 'An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePageChange = useCallback((page) => { goToPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }, [goToPage]);

  // ── Table columns ─────────────────────────────────────────────────────────────

  const columns = [
    {
      key: 'employee',
      label: 'Employee',
      visible: visibleColumns.showEmployee,
      render: (account) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <FaUser size={14} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-800 text-sm truncate">{account.employee_name || account.account_holder_name}</div>
            {account.employee_code && (
              <div className="text-[10px] text-slate-400 font-mono italic">{account.employee_code}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'account',
      label: 'Account Details',
      visible: visibleColumns.showAccount,
      render: (account) => (
        <div className="min-w-0">
          <div className="font-semibold text-slate-700 text-sm truncate">{account.account_holder_name}</div>
          <div className="text-[10px] text-slate-400 font-mono italic truncate">
            {account.account_type === 'upi' ? (account.upi_id || 'UPI ID') : (account.bank_name || 'Cash Account')}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      visible: visibleColumns.showType,
      render: (account) => (
        <div className="flex flex-col gap-1 items-start">
          <AccountTypeBadge type={account.account_type} compact />
          {account.is_primary && <PrimaryBadge compact />}
        </div>
      ),
    },
    {
      key: 'account_number',
      label: 'Account No.',
      visible: visibleColumns.showAccountNumber,
      render: (account) => (
        <span className="font-mono text-sm text-slate-600">
          {account.account_type === 'upi'
            ? account.upi_id
            : (account.account_number_masked || (account.account_number ? maskAccount(account.account_number) : '—'))}
        </span>
      ),
    },
    {
      key: 'ifsc',
      label: 'IFSC / Branch',
      visible: visibleColumns.showIfscBranch,
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
      visible: visibleColumns.showStatus,
      render: (account) => <StatusBadge status={account.status} compact />,
    },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading && accounts.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <FaSpinner className="animate-spin text-blue-500 text-4xl" />
          <p className="text-slate-400 font-medium animate-pulse">Loading employee bank accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <ManagementHub
      eyebrow={<><FaUniversity size={11} /> Employees</>}
      title="Employee Bank Accounts"
      description="View and manage bank accounts added by employees."
      accent="blue"
      onRefresh={() => fetchData({ force: true })}
    >
      <div className="space-y-6 p-2 lg:p-0">
        {/* Stats */}
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

        {/* ─── Consolidated Filter & View Bar ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-2"
        >
          <div className="flex flex-col lg:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by employee, holder name, bank, account number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none shadow-sm transition-all text-sm font-medium min-h-[42px]"
              />
            </div>
            <div className="w-full lg:w-[250px]">
              <EmployeeSelect
                value={filterEmployee}
                onChange={(val) => { setFilterEmployee(val); goToPage(1); }}
                placeholder="All Employees"
                isClearable
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-[140px]">
                <SelectField
                  options={[{ value: '', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
                  value={filterStatus || { value: '', label: 'All Status' }}
                  onChange={opt => { setFilterStatus(opt.value ? opt : null); goToPage(1); }}
                />
              </div>
              <div className="w-[150px]">
                <SelectField
                  options={[
                    { value: '', label: 'All Types' },
                    { value: 'savings', label: 'Savings' },
                    { value: 'current', label: 'Current' },
                    { value: 'upi', label: 'UPI' },
                    { value: 'cash', label: 'Cash' },
                    { value: 'loan', label: 'Loan' },
                  ]}
                  value={filterAccountType || { value: '', label: 'All Types' }}
                  onChange={opt => { setFilterAccountType(opt.value ? opt : null); goToPage(1); }}
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
                  onChange={opt => { setFilterIsPrimary(opt.value ? opt : null); goToPage(1); }}
                />
              </div>
            </div>
            <div className="flex w-full lg:w-auto justify-end">
              <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="blue" />
            </div>

          </div>
        </motion.div>

        {totalItems === 0 && !loading ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-100">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><FaUser size={24} /></div>
            <p className="text-slate-500 font-bold">No employee accounts found</p>
            <p className="text-slate-400 text-sm mt-1 mx-auto max-w-xs">
              {searchTerm ? `No results matching "${searchTerm}"` : 'Employees have not added any bank accounts yet.'}
            </p>
          </motion.div>
        ) : viewMode === 'table' ? (
          <ManagementTable
            rows={paginatedData}
            columns={columns}
            rowKey={(row) => row.bank_account_id}
            onRowClick={(row) => setViewModal({ open: true, account: row })}
            getActions={(row) => [
              { label: 'View Details', icon: <FaEye size={13} />, onClick: () => setViewModal({ open: true, account: row }), className: 'text-green-600 hover:text-green-700 hover:bg-green-50' },
            ]}
            accent="blue"
          />
        ) : (
          <ManagementGrid viewMode={viewMode}>
            {paginatedData.map((account) => (
              <MobileEmployeeBankCard
                key={account.bank_account_id}
                account={account}
                onView={(r) => setViewModal({ open: true, account: r })}
              />
            ))}
          </ManagementGrid>
        )}

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

      {/* ── View Modal ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={viewModal.open && !!viewModal.account}
        onClose={closeViewModal}
        title={viewModal.account?.account_holder_name}
        subtitle={viewModal.account?.account_type === 'upi' ? viewModal.account?.upi_id : (viewModal.account?.bank_name || 'Cash Account')}
        icon={viewModal.account?.account_type === 'cash' ? <FaMoneyBillWave size={20} /> : viewModal.account?.account_type === 'upi' ? <FaQrcode size={20} /> : <FaUniversity size={20} />}
        size="lg"
        footer={(
          <button
            onClick={closeViewModal}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        )}
      >
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <AccountTypeBadge type={viewModal.account?.account_type} />
            <StatusBadge status={viewModal.account?.status} />
            {viewModal.account?.is_primary && <PrimaryBadge />}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 col-span-1 sm:col-span-2">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-blue-400">Employee Information</p>
              <p className="font-bold text-sm text-blue-700">{viewModal.account?.employee_name}</p>
              {viewModal.account?.employee_code && (
                <p className="font-mono text-xs font-semibold text-blue-600 mt-1">{viewModal.account.employee_code}</p>
              )}
            </div>

            {viewModal.account?.account_type === 'upi' ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 col-span-2">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">UPI ID</p>
                <p className="font-mono text-sm font-bold text-emerald-700">{viewModal.account?.upi_id}</p>
              </div>
            ) : (
              <>
                {[
                  { label: 'Account No.', value: viewModal.account?.account_number_masked || (viewModal.account?.account_number ? maskAccount(viewModal.account.account_number) : '—') },
                  { label: 'IFSC Code', value: viewModal.account?.ifsc_code || '—' },
                  { label: 'Branch', value: viewModal.account?.branch_name || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                    <p className="font-mono text-sm font-bold text-slate-700">{value}</p>
                  </div>
                ))}
              </>
            )}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Created</p>
              <p className="font-mono text-sm font-bold text-slate-700">
                {viewModal.account?.created_at ? new Date(viewModal.account.created_at).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <FaShieldAlt className="shrink-0 text-slate-400" size={16} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Owner Type</p>
              <p className="text-sm font-bold capitalize text-slate-700">{viewModal.account?.owner_type || 'Employee'}</p>
            </div>
          </div>
        </div>
      </Modal>

    </ManagementHub>
  );
};

export default EmployeeBankAccountManagement;