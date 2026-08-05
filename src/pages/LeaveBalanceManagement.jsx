import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FaPlus, FaEdit, FaTrash, FaSyncAlt, FaSearch, FaTimes, FaCheck,
  FaExclamationTriangle, FaUser, FaCalendarAlt, FaClock,
  FaToggleOn, FaEye, FaSpinner, FaChevronDown, FaTh, FaListUl, FaCog,
  FaEnvelope, FaIdCard, FaChartBar
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import apiCall from '../utils/api';
import Pagination, { usePagination } from '../components/PaginationComponent';
import ModalScrollLock from '../components/ModalScrollLock';
import { ManagementButton, ManagementCard, ManagementHub, ManagementTable } from '../components/common';
import usePermissionAccess from '../hooks/usePermissionAccess';
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import SelectField from '../components/SelectField';
import EmployeeSelect from '../components/common/EmployeeSelect';
import ProfileAvatar from '../components/common/ProfileAvatar';
import CurrencyIcon from "../components/common/CurrencyIcon";
import ActionMenu from '../components/ActionMenu';

const ITEMS_PER_PAGE = 10;
const FETCH_BATCH_SIZE = 100;
const employeeBalanceRequests = new Map();

const getCompanyId = () => {
  try {
    return JSON.parse(localStorage.getItem('company'))?.id ?? null;
  } catch {
    return null;
  }
};

const STAT_STYLES = {
  violet: { iconWrap: 'bg-violet-50 text-violet-600', glow: 'bg-violet-100/70' },
  orange: { iconWrap: 'bg-orange-50 text-orange-600', glow: 'bg-orange-100/70' },
  emerald: { iconWrap: 'bg-emerald-50 text-emerald-600', glow: 'bg-emerald-100/70' },
  indigo: { iconWrap: 'bg-indigo-50 text-indigo-600', glow: 'bg-indigo-100/70' },
};

const formatDays = (value) => {
  const numericValue = Number.parseFloat(value ?? 0);
  if (!Number.isFinite(numericValue)) return '0';
  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(1);
};

const getRemainingPercentage = (remaining, total) => {
  const remainingNum = Number.parseFloat(remaining ?? 0);
  const totalNum = Number.parseFloat(total ?? 0);
  if (!Number.isFinite(remainingNum) || !Number.isFinite(totalNum) || totalNum <= 0) return 0;
  return Math.min(100, (remainingNum / totalNum) * 100);
};

const isLowBalance = (remaining) => Number.parseFloat(remaining ?? 0) <= 1;

const normalizeEmployeeBalances = (data, year) => {
  if (!data || !Array.isArray(data)) return [];
  return data.map((employee) => ({
    employee_id: employee.employee_id || employee.employee?.id || employee.id,
    employee_name: employee.employee_name || employee.employee?.name || employee.name || 'N/A',
    email: employee.email || employee.employee?.email,
    employee_code: employee.employee_code || employee.employee?.employee_code,
    leaves: (employee.leaves || []).map(leave => ({
      leave_config_id: leave.leave_config_id || leave.leave_config?.id,
      type: leave.type || leave.code || leave.leave_config?.code || 'N/A',
      code: leave.code || leave.type || leave.leave_config?.code || 'N/A',
      name: leave.name || leave.leave_config?.name || 'N/A',
      year: leave.year || year,
      total_allocated: leave.total_allocated ?? 0,
      used: leave.used ?? 0,
      remaining: leave.remaining ?? ((leave.total_allocated ?? 0) - (leave.used ?? 0)),
      is_paid: leave.is_paid ?? leave.leave_config?.is_paid ?? true,
      allow_half_day: leave.allow_half_day ?? leave.leave_config?.allow_half_day ?? false,
      accrual_type: leave.accrual_type || leave.leave_config?.accrual_type || 'none',
      accrual_rate: leave.accrual_rate ?? leave.leave_config?.accrual_rate ?? 0,
      max_balance: leave.max_balance ?? leave.leave_config?.max_balance ?? 0,
      carry_forward_limit: leave.carry_forward_limit ?? leave.leave_config?.carry_forward_limit ?? 0,
      allow_negative_balance: leave.allow_negative_balance ?? leave.leave_config?.allow_negative_balance ?? false,
      exclude_weekends: leave.exclude_weekends ?? leave.leave_config?.exclude_weekends ?? true,
      is_comp_off: leave.is_comp_off ?? leave.leave_config?.is_comp_off ?? false,
    }))
  }));
};

const fetchEmployeeBalanceRows = async (year, companyId) => {
  const requestKey = `${companyId ?? 'no-company'}-${year}`;
  if (employeeBalanceRequests.has(requestKey)) return employeeBalanceRequests.get(requestKey);

  const requestPromise = (async () => {
    let allBalances = [];
    let currentPage = 1;
    let totalPages = 1;
    do {
      const params = new URLSearchParams({
        year: String(year),
        page: String(currentPage),
        limit: String(FETCH_BATCH_SIZE),
      });
      const response = await apiCall(`/leave/emp-balances?${params.toString()}`, 'GET', null, companyId);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to fetch balances');
      allBalances = allBalances.concat(normalizeEmployeeBalances(result.data, year));
      totalPages = Number(result.meta?.total_pages ?? 1);
      currentPage += 1;
    } while (currentPage <= totalPages);
    return allBalances;
  })();

  employeeBalanceRequests.set(requestKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    employeeBalanceRequests.delete(requestKey);
  }
};

// ─── SearchableSelect ──────────────────────────────────────────────────────────
const SearchableSelect = ({
  value, onChange, options, onSearch, placeholder, label,
  loading = false, disabled = false, renderOption, getOptionLabel, getOptionValue,
  allOptions,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const lookupList = allOptions || options;
  const selectedOption = lookupList.find(opt => String(getOptionValue(opt)) === String(value));

  useEffect(() => {
    const handler = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    if (onSearch) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => { onSearch(searchTerm); }, 300);
      return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
    }
  }, [isOpen, searchTerm, onSearch]);

  const displayedOptions = useMemo(() => {
    if (onSearch) return options;
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase().trim();
    return options.filter(opt => {
      const labelText = getOptionLabel ? getOptionLabel(opt) : String(opt);
      return labelText.toLowerCase().includes(term);
    });
  }, [options, searchTerm, onSearch, getOptionLabel]);

  const handleSelect = (option) => {
    onChange(getOptionValue(option));
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">{label}</label>
      <div
        className={`relative cursor-pointer rounded-xl border border-slate-200 bg-slate-50/50 transition focus-within:border-violet-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-50 ${disabled ? 'pointer-events-none' : ''}`}
        onClick={() => { if (disabled) return; setIsOpen(!isOpen); if (!isOpen) setTimeout(() => inputRef.current?.focus(), 100); }}
      >
        <div className={`flex items-center justify-between px-4 py-3 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <span className={selectedOption ? 'text-slate-700' : 'text-slate-400'}>
            {selectedOption ? getOptionLabel(selectedOption) : placeholder}
          </span>
          <FaChevronDown className={`text-slate-400 transition-transform duration-200 ${isOpen && !disabled ? 'rotate-180' : ''}`} size={12} />
        </div>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="absolute left-0 right-0 top-full z-[100] mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="border-b border-slate-100 p-3">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  ref={inputRef} type="text" placeholder="Search..." value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-violet-400 focus:bg-white min-h-[42px]"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8"><FaSpinner className="text-violet-500 animate-spin" size={20} /></div>
              ) : displayedOptions.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">No results found</div>
              ) : (
                displayedOptions.map((option) => (
                  <button key={getOptionValue(option)} type="button" onClick={() => handleSelect(option)}
                    className="w-full px-4 py-3 text-left transition hover:bg-slate-50">
                    {renderOption ? renderOption(option) : getOptionLabel(option)}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── PaidBadge ─────────────────────────────────────────────────────────────────
const PaidBadge = ({ isPaid, compact = false }) => (
  isPaid ? (
    <span className={`inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 text-emerald-700 ${compact ? 'px-2 py-0.5 text-[10px] font-bold' : 'px-2.5 py-1 text-xs font-semibold'}`}>
      <CurrencyIcon className="text-emerald-500" size={12} /> PAID
    </span>
  ) : (
    <span className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 text-slate-500 ${compact ? 'px-2 py-0.5 text-[10px] font-bold' : 'px-2.5 py-1 text-xs font-semibold'}`}>
      UNPAID
    </span>
  )
);

// ─── API helper for employee leave configs ───────────────────────────────────
const fetchEmployeeAvailableConfigsAsync = async (employeeId, year) => {
  const companyId = getCompanyId();
  const response = await apiCall(`/leave/employee/${employeeId}?year=${year}`, 'GET', null, companyId);
  const result = await response.json();
  if (!result.success || !Array.isArray(result.data)) return [];
  return result.data.map(c => ({
    id: c.leave_config_id,
    leave_config_id: c.leave_config_id,
    code: c.code,
    name: c.name,
    is_paid: c.is_paid,
    allow_half_day: c.allow_half_day,
    max_balance: Number(c.max_balance),
    carry_forward_limit: Number(c.carry_forward_limit),
    exclude_weekends: c.exclude_weekends,
    allocated: !!c.allocated,
    used: c.balance ? Number(c.balance.used || 0) : 0,
    total_allocated: c.balance ? Number(c.balance.total_allocated || 0) : 0,
    remaining: c.balance ? Number(c.balance.remaining || 0) : 0,
  }));
};

// ─── LeaveBalanceManagement ────────────────────────────────────────────────────
const LeaveBalanceManagement = () => {
  const { checkActionAccess, getAccessMessage } = usePermissionAccess();
  const [balances, setBalances] = useState([]);
  const [filteredBalances, setFilteredBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewModal, setViewModal] = useState({ open: false, balance: null });
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('assign');
  const [selectedBalance, setSelectedBalance] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('table');

  const [leaveConfigs, setLeaveConfigs] = useState([]);
  const [leaveConfigsLoading, setLeaveConfigsLoading] = useState(false);

  const { pagination, goToPage, changeLimit } = usePagination(1, ITEMS_PER_PAGE);
  const createAccess = checkActionAccess('leaveBalance', 'create');
  const updateAccess = checkActionAccess('leaveBalance', 'update');
  const deleteAccess = checkActionAccess('leaveBalance', 'delete');
  const createMessage = getAccessMessage(createAccess);
  const updateMessage = getAccessMessage(updateAccess);
  const deleteMessage = getAccessMessage(deleteAccess);

  const [formData, setFormData] = useState({
    employee_id: '',
    delete_leave_config_ids: [],
    leaves: [{ leave_config_id: '', total_allocated: '' }],
  });

  // ─── Leave configs map for validation ──────────────────────────────────────
  const configMap = useMemo(() => {
    const map = new Map();
    leaveConfigs.forEach(c => {
      const max = parseFloat(c.max_balance);
      const used = parseFloat(c.used);
      map.set(c.id, {
        maxBalance: isNaN(max) ? null : max,
        used: isNaN(used) ? 0 : used,
        name: c.name,
        code: c.code,
      });
    });
    return map;
  }, [leaveConfigs]);

  const assignableConfigs = useMemo(() => {
    if (modalMode === 'assign') {
      return leaveConfigs.filter(c => !c.allocated);
    }
    return leaveConfigs;
  }, [leaveConfigs, modalMode]);

  // ─── Validate a single leave row ──────────────────────────────────────────
  const isLeaveRowValid = useCallback((row) => {
    if (!row.leave_config_id) return false;
    const value = parseFloat(row.total_allocated);
    if (isNaN(value) || value <= 0) return false;
    const config = configMap.get(row.leave_config_id);
    if (config) {
      if (config.maxBalance !== null && config.maxBalance !== undefined && value > config.maxBalance) return false;
      if (config.used > 0 && value < config.used) return false;
    }
    return true;
  }, [configMap]);

  // ─── Overall form validity ─────────────────────────────────────────────────
  const isFormValid = useMemo(() => {
    if (!formData.employee_id) return false;
    if (modalMode === 'delete') {
      return formData.delete_leave_config_ids.length > 0;
    }
    if (formData.leaves.length === 0) return false;
    return formData.leaves.every(row => isLeaveRowValid(row));
  }, [formData, modalMode, isLeaveRowValid]);

  // Fetch leave configs for the selected employee
  const fetchEmployeeAvailableConfigs = useCallback(async (employeeId) => {
    if (!employeeId) {
      setLeaveConfigs([]);
      return;
    }
    setLeaveConfigsLoading(true);
    try {
      const configs = await fetchEmployeeAvailableConfigsAsync(employeeId, selectedYear);
      setLeaveConfigs(configs);
    } catch (err) {
      console.error('Failed to fetch available configs for employee', err);
      setLeaveConfigs([]);
    } finally {
      setLeaveConfigsLoading(false);
    }
  }, [selectedYear]);

  // Load configs when the modal opens or employee changes
  useEffect(() => {
    if (!showModal || modalMode === 'delete') return;

    if (formData.employee_id) {
      fetchEmployeeAvailableConfigs(formData.employee_id);
    } else {
      setLeaveConfigs([]);
    }
  }, [showModal, modalMode, formData.employee_id, fetchEmployeeAvailableConfigs]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = getCompanyId();
      const allBalances = await fetchEmployeeBalanceRows(selectedYear, companyId);
      setBalances(allBalances);
    } catch (error) {
      toast.error(error.message || 'Connection error while fetching balances');
      setBalances([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  const parseActionResponse = async (response, fallbackMessage) => {
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || fallbackMessage);
    return result;
  };

  const handleAction = async () => {
    if (modalMode === 'assign') {
      if (!formData.employee_id) return toast.error('Please select an employee');
      if (!formData.leaves.some(l => l.leave_config_id)) return toast.error('Please select at least one leave type');
    } else if (modalMode === 'edit') {
      if (!formData.employee_id) return toast.error('Please select an employee');
      if (!formData.leaves.some(l => l.leave_config_id)) return toast.error('Please keep at least one leave type');
    } else if (modalMode === 'delete') {
      if (!formData.employee_id) return toast.error('Please select an employee');
      if (!formData.delete_leave_config_ids.length) return toast.error('Please select at least one leave type to delete');
    }

    setSaving(true);
    try {
      let response;
      if (modalMode === 'assign' || modalMode === 'edit') {
        response = await apiCall('/leave/upsert-balance', 'PUT', {
          employee_id: formData.employee_id,
          leaves: formData.leaves.map(l => ({ leave_config_id: l.leave_config_id, total_allocated: Number(l.total_allocated) || 0 }))
        }, getCompanyId());
      } else if (modalMode === 'delete') {
        response = await apiCall('/leave/delete-balance', 'DELETE', {
          employee_id: formData.employee_id,
          leave_config_ids: formData.delete_leave_config_ids
        }, getCompanyId());
      }

      const result = await parseActionResponse(response, 'Operation failed');
      if (result.success) {
        toast.success(result.message || `Balance ${modalMode === 'assign' ? 'assigned' : modalMode === 'edit' ? 'updated' : 'deleted'} successfully`);
        setShowModal(false);
        await fetchData();
      }
    } catch (error) {
      toast.error(error.message || 'An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) { setFilteredBalances(balances); return; }
    setFilteredBalances(balances.filter((employee) =>
      employee.employee_name?.toLowerCase().includes(normalizedSearch) ||
      employee.employee_code?.toLowerCase().includes(normalizedSearch) ||
      employee.email?.toLowerCase().includes(normalizedSearch) ||
      employee.leaves.some(leave =>
        leave.name?.toLowerCase().includes(normalizedSearch) ||
        leave.type?.toLowerCase().includes(normalizedSearch) ||
        leave.code?.toLowerCase().includes(normalizedSearch)
      ) ||
      String(employee.employee_id ?? '').includes(searchTerm.trim())
    ));
  }, [balances, searchTerm]);

  useEffect(() => { goToPage(1); }, [searchTerm, selectedYear, goToPage]);

  const totalItems = filteredBalances.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pagination.limit));

  useEffect(() => {
    if (pagination.page > totalPages) goToPage(totalPages);
  }, [goToPage, pagination.page, totalPages]);

  const openModal = (mode, balance = null) => {
    if (mode === 'assign' && createAccess.disabled) return;
    if (mode === 'edit' && updateAccess.disabled) return;
    if (mode === 'delete' && deleteAccess.disabled) return;
    setModalMode(mode);
    if (balance) {
      setSelectedBalance(balance);
      if (mode === 'delete') {
        setFormData({
          employee_id: balance.employee_id,
          delete_leave_config_ids: [],
          leaves: []
        });
      } else {
        setFormData({
          employee_id: balance.employee_id,
          leaves: (balance.leaves || []).map(l => ({ leave_config_id: l.leave_config_id, total_allocated: l.total_allocated })),
          delete_leave_config_ids: []
        });
        const existingConfigs = balance.leaves.map(l => ({
          id: l.leave_config_id,
          leave_config_id: l.leave_config_id,
          code: l.code,
          name: l.name,
          is_paid: l.is_paid,
          max_balance: l.max_balance,
        }));
        setLeaveConfigs(existingConfigs);
      }
    } else {
      setSelectedBalance(null);
      setFormData({ employee_id: '', delete_leave_config_ids: [], leaves: [{ leave_config_id: '', total_allocated: '' }] });
      setLeaveConfigs([]);
    }
    setShowModal(true);
  };

  const handlePageChange = useCallback((page) => { goToPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }, [goToPage]);

  const closeModal = useCallback(() => { if (saving) return; setShowModal(false); }, [saving]);
  const closeViewModal = useCallback(() => { setViewModal({ open: false, balance: null }); }, []);

  useEffect(() => {
    if (!showModal && !viewModal.open) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') { if (viewModal.open) { closeViewModal(); return; } closeModal(); }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeModal, closeViewModal, showModal, viewModal.open]);

  const paginatedData = useMemo(
    () => filteredBalances.slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit),
    [filteredBalances, pagination.page, pagination.limit]
  );

  const stats = useMemo(() => [
    {
      label: 'Total Allocated',
      value: balances.reduce((sum, b) => sum + b.leaves.reduce((s, l) => s + Number.parseFloat(l.total_allocated ?? 0), 0), 0),
      icon: FaCalendarAlt, color: 'violet',
    },
    {
      label: 'Total Used',
      value: balances.reduce((sum, b) => sum + b.leaves.reduce((s, l) => s + Number.parseFloat(l.used ?? 0), 0), 0),
      icon: FaClock, color: 'orange',
    },
    {
      label: 'Total Remaining',
      value: balances.reduce((sum, b) => sum + b.leaves.reduce((s, l) => s + Number.parseFloat(l.remaining ?? 0), 0), 0),
      icon: FaCheck, color: 'emerald',
    },
    {
      label: 'Employees',
      value: new Set(balances.map((b) => b.employee_id)).size,
      icon: FaToggleOn, color: 'indigo', isCount: true,
    },
  ], [balances]);

  const getActionButtons = (employee) => [
    {
      label: 'View Details',
      icon: <FaEye size={13} />,
      onClick: () => setViewModal({ open: true, balance: employee }),
      className: 'text-green-600 hover:text-green-700 hover:bg-green-50'
    },
    {
      label: 'Edit Balance',
      icon: <FaEdit size={13} />,
      onClick: () => openModal('edit', employee),
      disabled: updateAccess.disabled,
      title: updateAccess.disabled ? updateMessage : '',
      className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
    },
    {
      label: 'Delete',
      icon: <FaTrash size={13} />,
      onClick: () => openModal('delete', employee),
      disabled: deleteAccess.disabled,
      title: deleteAccess.disabled ? deleteMessage : '',
      className: 'text-red-600 hover:text-red-700 hover:bg-red-50'
    }
  ];

  const columns = [
    {
      key: 'employee',
      label: 'Employee',
      render: (employee) => (
        <div className="flex items-center gap-3">
          <ProfileAvatar
            record={employee}
            name={employee.employee_name}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden"
          >
            {employee.employee_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </ProfileAvatar>
          <div className="min-w-0">
            <div className="font-semibold text-slate-800 text-sm truncate">{employee.employee_name}</div>
            <div className="text-[10px] text-slate-400 font-mono italic">{employee.employee_code}</div>
          </div>
        </div>
      )
    },
    {
      key: 'leaves_summary',
      label: 'Assigned Leaves',
      render: (employee) => (
        <div className="flex flex-wrap gap-1.5 max-w-[300px]">
          {employee.leaves.length > 0 ? employee.leaves.map((leave, idx) => (
            <div
              key={idx}
              className="group relative flex items-center gap-1.5 px-2 py-1 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-violet-200 hover:shadow-sm transition-all"
              title={`${leave.name}: ${formatDays(leave.remaining)}/${formatDays(leave.total_allocated)} remaining`}
            >
              <span className="text-[10px] font-bold text-violet-700">{leave.code}</span>
              <span className={`text-[9px] font-bold ${isLowBalance(leave.remaining) ? 'text-rose-500' : 'text-emerald-500'}`}>
                {formatDays(leave.remaining)}d
              </span>
            </div>
          )) : (
            <span className="text-[10px] text-slate-400 italic">No leaves assigned</span>
          )}
        </div>
      )
    },
    {
      key: 'total_allocation',
      label: 'Total Quota',
      render: (employee) => {
        const total = employee.leaves.reduce((sum, l) => sum + (Number(l.total_allocated) || 0), 0);
        return (
          <div className="flex flex-col">
            <span className="font-bold text-slate-700 text-sm">{formatDays(total)} <span className="text-[10px] text-slate-400">DAYS</span></span>
            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">{employee.leaves.length} TYPES</span>
          </div>
        );
      }
    },
    {
      key: 'remaining',
      label: 'Remaining',
      render: (employee) => {
        const total = employee.leaves.reduce((sum, l) => sum + (Number(l.total_allocated) || 0), 0);
        const remaining = employee.leaves.reduce((sum, l) => sum + (Number(l.remaining) || 0), 0);
        const pct = total > 0 ? Math.min(100, (remaining / total) * 100) : 0;
        return (
          <div className="flex flex-col gap-1 min-w-[80px]">
            <span className={`font-bold text-sm ${remaining <= 2 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {formatDays(remaining)} <span className="text-[10px] font-normal text-slate-400">DAYS</span>
            </span>
            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${remaining <= 2 ? 'bg-rose-400' : 'bg-emerald-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      }
    },
    {
      key: 'year',
      label: 'Year',
      render: (employee) => (
        <span className="text-sm font-medium text-slate-500">{employee.leaves[0]?.year || selectedYear}</span>
      )
    }
  ];

  if (loading && balances.length === 0) return (
    <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <FaSpinner className="animate-spin text-violet-500 text-4xl" />
        <p className="text-slate-400 font-medium animate-pulse">Initializing leave manager...</p>
      </div>
    </div>
  );

  return (
    <ManagementHub
      eyebrow={<><FaChartBar size={11} /> Leave allocation</>}
      title="Leave Balance Management"
      description="Monitor and adjust employee leave quotas and remaining balances."
      accent="violet"
      onRefresh={fetchData}
      actions={
        <ManagementButton
          tone="violet"
          variant="solid"
          leftIcon={<FaPlus />}
          onClick={() => openModal('assign')}
        >
          Assign Balance
        </ManagementButton>
      }
    >
      <div className="space-y-6 p-2 lg:p-0">

        {/* ─── Stats ─── */}
        {!loading && balances.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-500 transition-colors">{stat.label}</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">
                    {stat.isCount ? stat.value : formatDays(stat.value)}
                    {!stat.isCount && <span className="ml-1 text-xs font-bold uppercase text-slate-300">d</span>}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${STAT_STYLES[stat.color].iconWrap}`}>
                  <stat.icon size={18} />
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* ─── Filter & View Bar ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-2 md:flex-row md:items-center md:justify-between"
        >
          {/* Search */}
          <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1 w-full">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                placeholder="Search by name, code, or leave type..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 outline-none transition-all text-sm font-medium min-h-[42px]"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                  <FaTimes size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Year + View Switcher */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-[120px]">
              <SelectField
                value={Array.from({ length: 11 }, (_, i) => { const y = new Date().getFullYear() - 5 + i; return { label: y.toString(), value: y }; }).find(opt => opt.value === selectedYear) || { label: selectedYear.toString(), value: selectedYear }}
                onChange={(opt) => setSelectedYear(opt ? opt.value : new Date().getFullYear())}
                options={Array.from({ length: 11 }, (_, i) => { const y = new Date().getFullYear() - 5 + i; return { label: y.toString(), value: y }; })}
                isClearable={false}
                isSearchable={false}
                placeholder="Year"
              />
            </div>
            <div className="hidden lg:block h-8 w-px bg-gray-200 mx-1" />
            <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="violet" />
          </div>
        </motion.div>

        {/* ─── Empty State ─── */}
        {totalItems === 0 && !loading ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-100">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><FaCalendarAlt size={24} /></div>
            <p className="text-slate-500 font-bold">No leave balances found</p>
            <p className="text-slate-400 text-sm mt-1 mx-auto max-w-xs">
              {searchTerm ? `We couldn't find anything matching "${searchTerm}"` : 'Employee leave balances will appear here.'}
            </p>
          </motion.div>

        ) : viewMode === 'table' ? (
          /* ─── Table View ─── */
          <ManagementTable
            rows={paginatedData}
            columns={columns}
            rowKey={(row) => row.employee_id}
            onRowClick={(row) => setViewModal({ open: true, balance: row })}
            getActions={(row) => getActionButtons(row)}
            accent="violet"
          />

        ) : (
          /* ─── Card / Grid View ─── */
          <ManagementGrid viewMode={viewMode}>
            {paginatedData.map((employee) => {
              const totalAllocated = employee.leaves.reduce((sum, l) => sum + (Number(l.total_allocated) || 0), 0);
              const totalRemaining = employee.leaves.reduce((sum, l) => sum + (Number(l.remaining) || 0), 0);

              return (
                <ManagementCard
                  key={employee.employee_id}
                  eyebrow={
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400">{employee.leaves.length} Leave Types</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="text-[10px] font-bold text-slate-400">{employee.leaves[0]?.year || selectedYear}</span>
                    </div>
                  }
                  title={employee.employee_name}
                  subtitle={<span className="font-mono text-[10px] text-slate-400">{employee.employee_code}</span>}
                  actions={getActionButtons(employee)}
                  onClick={() => setViewModal({ open: true, balance: employee })}
                >
                  <div className="space-y-4 pt-2">
                    {/* Leave type pills */}
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Leaves</p>
                      <div className="grid gap-2">
                        {employee.leaves.slice(0, 3).map((leave, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                              <span className="text-xs font-bold text-slate-700">{leave.code}</span>
                              <span className="text-[10px] text-slate-400 truncate hidden sm:block">{leave.name}</span>
                            </div>
                            <span className={`text-xs font-black ${isLowBalance(leave.remaining) ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {formatDays(leave.remaining)}d
                            </span>
                          </div>
                        ))}
                        {employee.leaves.length > 3 && (
                          <p className="text-center text-[10px] font-bold text-slate-400 uppercase py-0.5">
                            +{employee.leaves.length - 3} more
                          </p>
                        )}
                        {employee.leaves.length === 0 && (
                          <p className="text-[10px] text-slate-400 italic text-center py-2">No leaves assigned</p>
                        )}
                      </div>
                    </div>

                    {/* Totals footer */}
                    <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Total Quota</p>
                        <p className="text-lg font-black text-slate-800">
                          {formatDays(totalAllocated)}<span className="text-[10px] ml-1 text-slate-400">DAYS</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Remaining</p>
                        <p className="text-lg font-black text-emerald-600">
                          {formatDays(totalRemaining)}<span className="text-[10px] ml-1 text-emerald-400">DAYS</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </ManagementCard>
              );
            })}
          </ManagementGrid>
        )}

        {/* ─── Pagination ─── */}
        {totalItems > 0 && (
          <div className="mt-8">
            <Pagination
              currentPage={pagination.page}
              totalItems={totalItems}
              itemsPerPage={pagination.limit}
              onPageChange={handlePageChange}
              onLimitChange={changeLimit}
              showInfo={true}
            />
          </div>
        )}
      </div>

      {/* ─── View Detail Modal ─── */}
      <AnimatePresence>
        {viewModal.open && viewModal.balance && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 overflow-y-auto"
            onMouseDown={(e) => e.target === e.currentTarget && closeViewModal()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-4xl max-h-[80vh] rounded-xl shadow-2xl border border-gray-100 m-auto flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 sm:px-8 py-5 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-indigo-200">
                    <FaUser className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{viewModal.balance.employee_name}</h2>
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                      <span className="font-mono">{viewModal.balance.employee_code}</span>
                      <span>•</span>
                      <span>{selectedYear} Balance</span>
                    </p>
                  </div>
                </div>
                <button onClick={closeViewModal} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-100">
                  <FaTimes size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                    <p className="text-sm font-bold text-emerald-600">Active Employment</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Year</p>
                    <p className="text-sm font-bold text-slate-700">{viewModal.balance.leaves[0]?.year || selectedYear}</p>
                  </div>
                  <div className="col-span-2 sm:col-span-1 bg-slate-50 border border-slate-100 p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Leaves</p>
                    <p className="text-sm font-bold text-slate-700">{viewModal.balance.leaves.length} Assigned Types</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <FaIdCard className="text-violet-500" /> Allocated Balances
                    </h3>
                    <span className="px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-[10px] font-black uppercase">Summary</span>
                  </div>
                  <div className="grid gap-3">
                    {viewModal.balance.leaves.map((leave, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                        className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-violet-200 hover:shadow-md transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-xl text-[10px] font-bold">{leave.code}</span>
                            <h4 className="font-bold text-slate-800 text-sm truncate">{leave.name}</h4>
                            <PaidBadge isPaid={leave.is_paid} compact />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-slate-50/50 rounded-xl p-2">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Total</p>
                              <p className="text-xs font-bold text-slate-700">{formatDays(leave.total_allocated)}d</p>
                            </div>
                            <div className="bg-slate-50/50 rounded-xl p-2">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Used</p>
                              <p className="text-xs font-bold text-orange-600">{formatDays(leave.used)}d</p>
                            </div>
                            <div className="bg-slate-50/50 rounded-xl p-2">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Rem.</p>
                              <p className={`text-xs font-black ${isLowBalance(leave.remaining) ? 'text-rose-600' : 'text-emerald-600'}`}>{formatDays(leave.remaining)}d</p>
                            </div>
                          </div>
                        </div>
                        <div className="w-full sm:w-24 shrink-0">
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-1.5">
                            <div
                              className={`h-full rounded-full ${isLowBalance(leave.remaining) ? 'bg-rose-500' : 'bg-emerald-500'}`}
                              style={{ width: `${getRemainingPercentage(leave.remaining, leave.total_allocated)}%` }}
                            />
                          </div>
                          <p className="text-[9px] font-black text-slate-400 text-center uppercase">{getRemainingPercentage(leave.remaining, leave.total_allocated).toFixed(0)}% Left</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-4 flex justify-end gap-2.5">
                <button onClick={closeViewModal} className="px-5 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-semibold text-[13px] hover:bg-slate-100 transition-all shadow-sm">
                  Close
                </button>
                <button
                  onClick={() => { closeViewModal(); openModal('delete', viewModal.balance); }}
                  disabled={deleteAccess.disabled}
                  title={deleteAccess.disabled ? deleteMessage : ''}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-bold text-[13px] hover:from-red-600 hover:to-rose-700 transition-all shadow-lg shadow-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaTrash size={12} /> Delete
                </button>
                <button
                  onClick={() => { closeViewModal(); openModal('edit', viewModal.balance); }}
                  disabled={updateAccess.disabled}
                  title={updateAccess.disabled ? updateMessage : ''}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-bold text-[13px] hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-violet-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaEdit size={12} /> Edit Balances
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Assign / Edit / Delete Modal ─── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <ModalScrollLock />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`relative bg-white w-full max-h-[80vh] rounded-xl shadow-2xl border border-gray-100 m-auto flex flex-col overflow-hidden ${modalMode === 'delete' ? 'max-w-2xl' : 'max-w-4xl'}`}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {modalMode === 'delete' ? (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 sm:px-8 py-5 sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-rose-200">
                        <FaTrash className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">Delete Leave Balances</h2>
                        <p className="text-sm text-slate-500">
                          {selectedBalance?.employee_name} – {selectedBalance?.leaves[0]?.year || selectedYear}
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={closeModal} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-100">
                      <FaTimes className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Body – checkbox list */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 space-y-4">
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Select the leave types you want to permanently delete. This cannot be undone and will fail if any selected type has already been used.
                    </p>

                    <div className="space-y-2">
                      {selectedBalance?.leaves?.map((leave) => {
                        const isChecked = formData.delete_leave_config_ids.includes(leave.leave_config_id);
                        const toggle = () => {
                          setFormData(prev => ({
                            ...prev,
                            delete_leave_config_ids: isChecked
                              ? prev.delete_leave_config_ids.filter(id => id !== leave.leave_config_id)
                              : [...prev.delete_leave_config_ids, leave.leave_config_id]
                          }));
                        };
                        const isUsed = Number(leave.used || 0) > 0;

                        return (
                          <label
                            key={leave.leave_config_id}
                            className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${isChecked
                                ? 'border-red-300 bg-red-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={toggle}
                              className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                              disabled={isUsed}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-xl text-[10px] font-bold">{leave.code}</span>
                                <span className="font-bold text-slate-800 text-sm">{leave.name}</span>
                                <PaidBadge isPaid={leave.is_paid} compact />
                              </div>
                              <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
                                <span>Allocated: <strong>{formatDays(leave.total_allocated)}d</strong></span>
                                <span>Used: <strong className={isUsed ? 'text-orange-600' : ''}>{formatDays(leave.used)}d</strong></span>
                                <span>Remaining: <strong className={isLowBalance(leave.remaining) ? 'text-rose-600' : 'text-emerald-600'}>{formatDays(leave.remaining)}d</strong></span>
                              </div>
                              {isUsed && (
                                <p className="mt-1 text-[10px] text-rose-600 font-semibold">⚠️ This leave has been used – cannot be deleted</p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    {selectedBalance?.leaves?.length === 0 && (
                      <div className="text-center py-8 text-slate-400">No leave types assigned to this employee.</div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end gap-3 px-6 py-5 border-t border-gray-100">
                    <button type="button" onClick={closeModal} disabled={saving}
                      className="flex px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all disabled:opacity-60">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAction}
                      disabled={
                        saving ||
                        formData.delete_leave_config_ids.length === 0 ||
                        deleteAccess.disabled
                      }
                      title={deleteAccess.disabled ? deleteMessage : ''}
                      className="flex px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-medium hover:from-red-700 hover:to-rose-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Deleting...' : `Delete Selected (${formData.delete_leave_config_ids.length})`}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 sm:px-8 py-5 sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-indigo-200">
                        {modalMode === 'assign' ? <FaPlus className="h-6 w-6 text-white" /> : <FaEdit className="h-6 w-6 text-white" />}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">
                          {modalMode === 'assign' ? 'Assign Leave Balance' : 'Edit Leave Balance'}
                        </h2>
                        <p className="text-sm text-slate-500">
                          {modalMode === 'assign' ? 'Allocate new leave balances to employees' : `Updating balance for ${selectedBalance?.employee_name}`}
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={closeModal} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-100">
                      <FaTimes className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 space-y-6">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Select Employee</label>
                      <EmployeeSelect
                        value={formData.employee_id}
                        onChange={(id) => setFormData(prev => ({
                          ...prev,
                          employee_id: id,
                          leaves: [{ leave_config_id: '', total_allocated: '' }]
                        }))}
                        disabled={modalMode === 'edit'}
                        placeholder="Choose an employee..."
                        initialEmployee={selectedBalance ? { id: selectedBalance.employee_id, name: selectedBalance.employee_name, employee_code: selectedBalance.employee_code } : null}
                      />
                    </div>

                    {!formData.employee_id && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                        <p className="text-xs font-bold text-amber-700">Please select an employee above to configure leave balances.</p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          {modalMode === 'assign' ? 'Leave Allocations' : 'Adjust Balances'}
                        </label>
                        {/* Only show Add More button in assign mode */}
                        {modalMode === 'assign' && (
                          <button
                            type="button"
                            disabled={!formData.employee_id || (assignableConfigs.length > 0 && formData.leaves.length >= assignableConfigs.length)}
                            onClick={() => setFormData(prev => ({ ...prev, leaves: [...prev.leaves, { leave_config_id: '', total_allocated: '' }] }))}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!formData.employee_id ? 'Please select an employee first' : (assignableConfigs.length > 0 && formData.leaves.length >= assignableConfigs.length ? 'All available leave types have been added' : '')}
                          >
                            <FaPlus size={10} /> Add More
                          </button>
                        )}
                      </div>

                      <div className="grid gap-4">
                        {formData.leaves.map((row, idx) => {
                          const selectedInOtherRows = new Set(
                            formData.leaves
                              .filter((_, i) => i !== idx)
                              .map(l => l.leave_config_id)
                              .filter(Boolean)
                          );

                          const availableConfigs = assignableConfigs.filter(config => !selectedInOtherRows.has(config.id));

                          const config = configMap.get(row.leave_config_id);
                          const val = parseFloat(row.total_allocated);
                          let errorMessage = null;
                          if (row.total_allocated !== '') {
                            if (isNaN(val) || val <= 0) {
                              errorMessage = 'Enter a valid positive number';
                            } else if (config) {
                              if (config.maxBalance !== null && config.maxBalance !== undefined && val > config.maxBalance) {
                                errorMessage = `Cannot exceed max limit of ${config.maxBalance} days`;
                              } else if (config.used > 0 && val < config.used) {
                                errorMessage = `Cannot be less than used leave (${config.used} days used)`;
                              }
                            }
                          }
                          const showError = !!errorMessage;

                          return (
                            <motion.div
                              key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              className={`relative rounded-xl border p-4 transition-all ${!formData.employee_id
                                  ? 'border-slate-100 bg-slate-100/50 opacity-60 pointer-events-none'
                                  : 'border-slate-100 bg-slate-50/60'
                                }`}
                            >
                              <div className="mb-3 flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">
                                  {modalMode === 'assign' ? `Leave #${idx + 1}` : 'Leave Type'}
                                </span>
                                {/* Remove the X button in edit mode to avoid confusion */}
                                {formData.leaves.length > 1 && modalMode !== 'edit' && (
                                  <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, leaves: prev.leaves.filter((_, i) => i !== idx) }))}
                                    className="rounded-lg p-1.5 text-rose-400 transition hover:bg-rose-50 hover:text-rose-600"
                                  >
                                    <FaTimes size={12} />
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <SearchableSelect
                                  label="Leave Type"
                                  placeholder={!formData.employee_id ? "Select an employee first..." : "Choose..."}
                                  value={row.leave_config_id}
                                  // Disable the dropdown entirely in edit mode
                                  disabled={!formData.employee_id || modalMode === 'edit'}
                                  onChange={(value) => setFormData(prev => ({
                                    ...prev,
                                    leaves: prev.leaves.map((l, i) => i === idx ? { ...l, leave_config_id: value } : l)
                                  }))}
                                  options={availableConfigs}
                                  allOptions={assignableConfigs}
                                  loading={leaveConfigsLoading}
                                  getOptionLabel={(cfg) => `${cfg.name} (${cfg.code})`}
                                  getOptionValue={(cfg) => cfg.id}
                                  renderOption={(cfg) => (
                                    <div className="flex items-center justify-between gap-3 w-full">
                                      <div className="min-w-0">
                                        <p className="font-semibold text-slate-800 text-sm truncate">{cfg.name}</p>
                                        <p className="text-[10px] text-slate-400 font-mono italic">
                                          Code: {cfg.code}
                                          {cfg.max_balance ? ` • Max: ${cfg.max_balance}d` : ''}
                                          {cfg.used > 0 ? ` • Used: ${cfg.used}d` : ''}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {cfg.allocated && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                                            Allocated ({cfg.total_allocated}d)
                                          </span>
                                        )}
                                        <PaidBadge isPaid={cfg.is_paid} compact />
                                      </div>
                                    </div>
                                  )}
                                />
                                <div className="space-y-2">
                                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Total Days</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. 10"
                                    disabled={!formData.employee_id}
                                    value={row.total_allocated}
                                    onChange={(e) => {
                                      const valStr = e.target.value;
                                      if (/^\d*\.?\d*$/.test(valStr)) {
                                        setFormData(prev => ({
                                          ...prev,
                                          leaves: prev.leaves.map((l, i) => i === idx ? { ...l, total_allocated: valStr } : l)
                                        }));
                                      }
                                    }}
                                    className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition ${showError
                                        ? 'border-red-300 bg-red-50 focus:ring-red-500/20'
                                        : 'border-slate-200 bg-white focus:border-violet-400 focus:ring-4 focus:ring-violet-500/5'
                                      } ${!formData.employee_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  />
                                  {showError && (
                                    <p className="text-[10px] text-red-500 font-semibold mt-1">
                                      {errorMessage}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 px-6 sm:px-8 pb-6 pt-4 border-t border-gray-100">
                    <button type="button" onClick={closeModal} disabled={saving}
                      className="w-full rounded-xl border border-slate-200 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
                      Discard
                    </button>
                    <button
                      type="button"
                      onClick={handleAction}
                      disabled={
                        saving ||
                        !isFormValid ||
                        (modalMode === 'assign' ? createAccess.disabled : updateAccess.disabled)
                      }
                      title={modalMode === 'assign' ? (createAccess.disabled ? createMessage : '') : (updateAccess.disabled ? updateMessage : '')}
                      className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <div className="flex items-center justify-center gap-2">
                          <FaSpinner className="animate-spin" />
                          <span>Processing...</span>
                        </div>
                      ) : modalMode === 'assign' ? 'Add Balance' : 'Save Changes'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ManagementHub>
  );
};

export default LeaveBalanceManagement;