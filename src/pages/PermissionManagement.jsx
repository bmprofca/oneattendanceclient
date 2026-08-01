import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FaEdit, FaTrash, FaEye, FaTimes, FaCheck, FaSearch, FaSpinner,
  FaShieldAlt, FaPlus, FaInfoCircle, FaCode,
  FaLayerGroup, FaTag, FaAlignLeft, FaBan, FaChevronLeft, FaChevronRight,
  FaTh, FaListUl, FaCog
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import apiCall from '../utils/api';
import Pagination, { usePagination } from '../components/PaginationComponent';
import ModalScrollLock from '../components/ModalScrollLock';
import ActionMenu from '../components/ActionMenu';
import usePermissionAccess from '../hooks/usePermissionAccess';
import ManagementGrid from '../components/ManagementGrid';
import ManagementViewSwitcher from '../components/ManagementViewSwitcher';
import { ManagementButton, RefreshButton } from '../components/common';
import SelectField from '../components/SelectField';
import CategoryPermissionSelector from '../components/common/CategoryPermissionSelector';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODAL_TYPES = {
  NONE: 'NONE',
  CREATE: 'CREATE',
  EDIT: 'EDIT',
  VIEW: 'VIEW',
  DELETE_CONFIRM: 'DELETE_CONFIRM',
  PERM_LIST: 'PERM_LIST',
  EMPLOYEE_LIST: 'EMPLOYEE_LIST'
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", duration: 0.5 } },
  exit: { opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.3 } }
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 }
};

const GROUP_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-green-50 text-green-700 border-green-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-cyan-50 text-cyan-700 border-cyan-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
];

const PACKAGE_REQUEST_CACHE_TTL = 5000;
let permissionListRequestCache = { companyId: null, promise: null, data: null };
const permissionPackagesRequestCache = new Map();
let permissionPackageOptionsRequestCache = { companyId: null, promise: null, data: null };

const getPermissionPackagesCacheKey = ({ companyId, page, limit, search }) =>
  `${companyId ?? 'none'}|${page}|${limit}|${search ?? ''}`;

const getPermissionPackageOptionsCacheKey = ({ companyId, search }) =>
  `${companyId ?? 'none'}|${search ?? ''}`;

const readApiResponse = async (res, fallbackMessage) => {
  try {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    return text ? { message: text } : { message: fallbackMessage };
  } catch {
    return { message: fallbackMessage };
  }
};

// ─── Package Form ─────────────────────────────────────────────────────────────
const PackageFormBody = ({
  formData, setFormData,
  allPermissions, permsLoading, packageUsage, onOpenEmployeeList, onInputChange
}) => {

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {permsLoading ? (
        <div className="flex justify-center py-12 text-center">
          <div>
            <FaSpinner className="animate-spin text-4xl text-indigo-600 mx-auto mb-3" />
            <p className="text-slate-500">Loading permissions...</p>
          </div>
        </div>
      ) : (
        <>
          {packageUsage && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">Package usage</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-950">
                    Assigned to {packageUsage.totalUsed} employee{packageUsage.totalUsed === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenEmployeeList}
                  disabled={packageUsage.totalUsed === 0}
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  View employees
                </button>
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                <FaLayerGroup className="text-indigo-500" /> Package Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="package_name"
                value={formData.package_name}
                onChange={onInputChange}
                required
                placeholder="e.g. HR Manager Package"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                <FaCode className="text-purple-500" /> Group Code <span className="text-xs text-slate-400 font-normal">(optional, auto‑generated if empty)</span>
              </label>
              <input
                type="text"
                name="group_code"
                value={formData.group_code}
                onChange={onInputChange}
                placeholder="Leave blank to auto‑generate"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all bg-white text-sm uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                <FaAlignLeft className="text-emerald-500" /> Description
              </label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={onInputChange}
                placeholder="Brief description..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all bg-white text-sm"
              />
            </div>
          </div>

          {/* Permissions Selection */}
          <CategoryPermissionSelector
            allPermissions={allPermissions}
            selectedIds={formData.permissions}
            onChange={(newIds) => setFormData(prev => ({ ...prev, permissions: newIds }))}
          />
        </>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const PermissionManagement = () => {
  const { checkActionAccess, getAccessMessage } = usePermissionAccess();
  const [packages, setPackages] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [allPermissionPackages, setAllPermissionPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [permsLoading, setPermsLoading] = useState(false);
  const [packageOptionsLoading, setPackageOptionsLoading] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  // ✅ No error state — all errors go to toast only
  const [modalType, setModalType] = useState(MODAL_TYPES.NONE);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const [bulkTargetPackage, setBulkTargetPackage] = useState(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [employeePackageSelections, setEmployeePackageSelections] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState('table');

  const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 6);
  const permsFetched = useRef(false);
  const isInitialLoad = useRef(true);
  const fetchInProgress = useRef(false);

  const emptyForm = { package_name: '', group_code: '', description: '', permissions: [] };
  const [formData, setFormData] = useState(emptyForm);
  const createAccess = checkActionAccess('permissionManagement', 'create');
  const updateAccess = checkActionAccess('permissionManagement', 'update');
  const deleteAccess = checkActionAccess('permissionManagement', 'delete');
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const showGroupCode = windowWidth >= 540;
  const showDescription = windowWidth >= 1024;
  const showPermissionCount = windowWidth >= 768;
  const showUsageCount = windowWidth >= 768;

  // ─── API Calls ────────────────────────────────────────────────────────────
  const fetchAllPermissions = useCallback(async () => {
    if (permsFetched.current) return;
    setPermsLoading(true);
    try {
      const company = JSON.parse(localStorage.getItem('company'));
      const companyId = company?.id ?? null;

      if (permissionListRequestCache.companyId === companyId && permissionListRequestCache.data) {
        setAllPermissions(permissionListRequestCache.data);
        permsFetched.current = true;
        return;
      }

      if (permissionListRequestCache.companyId !== companyId) {
        permissionListRequestCache = { companyId, promise: null, data: null };
      }

      if (!permissionListRequestCache.promise) {
        permissionListRequestCache.promise = (async () => {
          const res = await apiCall('/permissions/list', 'GET', null, companyId);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const result = await res.json();
          if (!result.success) throw new Error(result.message || 'Failed to fetch permissions');

          permissionListRequestCache = {
            companyId,
            promise: null,
            data: result.data
          };

          return result.data;
        })().catch((error) => {
          permissionListRequestCache = { companyId, promise: null, data: null };
          throw error;
        });
      }

      const permissions = await permissionListRequestCache.promise;
      setAllPermissions(permissions);
      permsFetched.current = true;
    } catch (e) {
      console.error('fetchAllPermissions:', e);
      toast.error('Failed to load permissions list');
    } finally {
      setPermsLoading(false);
    }
  }, []);

  const fetchPackages = useCallback(async (page = pagination.page, resetLoading = true) => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    if (resetLoading) setLoading(true);
    try {
      const company = JSON.parse(localStorage.getItem('company'));
      const companyId = company?.id ?? null;
      const params = new URLSearchParams({ page: page.toString(), limit: pagination.limit.toString() });
      if (debouncedSearch) params.append('search', debouncedSearch);

      const requestKey = getPermissionPackagesCacheKey({
        companyId,
        page,
        limit: pagination.limit,
        search: debouncedSearch
      });
      const cachedEntry = permissionPackagesRequestCache.get(requestKey);
      let result;

      if (cachedEntry?.data && cachedEntry.expiresAt > Date.now()) {
        result = cachedEntry.data;
      } else if (cachedEntry?.promise) {
        result = await cachedEntry.promise;
      } else {
        const requestPromise = (async () => {
          const res = await apiCall(`/permissions/permission-packages?${params}`, 'GET', null, companyId);
          const json = await readApiResponse(res, `HTTP ${res.status}`);
          if (!json.success) throw new Error(json.message || 'Failed to fetch packages');

          permissionPackagesRequestCache.set(requestKey, {
            data: json,
            expiresAt: Date.now() + PACKAGE_REQUEST_CACHE_TTL
          });

          return json;
        })().catch((error) => {
          permissionPackagesRequestCache.delete(requestKey);
          throw error;
        });

        permissionPackagesRequestCache.set(requestKey, { promise: requestPromise });
        result = await requestPromise;
      }

      if (result.success) {
        const d = result.data;
        const list = d?.packages ?? d ?? [];
        const total = d?.total ?? list.length;
        const total_pages = (d?.totalPages ?? d?.total_pages ?? Math.ceil(total / pagination.limit)) || 1;
        const cur_page = d?.page ?? page;
        const cur_limit = d?.limit ?? pagination.limit;
        setPackages(list);
        updatePagination({ page: cur_page, limit: cur_limit, total, total_pages, is_last_page: cur_page >= total_pages });
        return list;
      } else throw new Error(result.message || 'Failed to fetch packages');
    } catch (e) {
      console.error('fetchPackages:', e);
      toast.error(e.message || 'Failed to fetch packages');
    } finally {
      setLoading(false);
      fetchInProgress.current = false;
      isInitialLoad.current = false;
    }
    return [];
  }, [pagination.page, pagination.limit, debouncedSearch, updatePagination]);

  const fetchAllPermissionPackageOptions = useCallback(async () => {
    setPackageOptionsLoading(true);
    try {
      const company = JSON.parse(localStorage.getItem('company'));
      const companyId = company?.id ?? null;

      if (permissionPackageOptionsRequestCache.companyId === companyId && permissionPackageOptionsRequestCache.data) {
        setAllPermissionPackages(permissionPackageOptionsRequestCache.data);
        return permissionPackageOptionsRequestCache.data;
      }

      if (permissionPackageOptionsRequestCache.companyId !== companyId) {
        permissionPackageOptionsRequestCache = { companyId, promise: null, data: null };
      }

      if (!permissionPackageOptionsRequestCache.promise) {
        permissionPackageOptionsRequestCache.promise = (async () => {
          const params = new URLSearchParams({ page: '1', limit: '1000' });
          const res = await apiCall(`/permissions/permission-packages?${params}`, 'GET', null, companyId);
          const result = await readApiResponse(res, `HTTP ${res.status}`);
          if (!result.success) throw new Error(result.message || 'Failed to fetch permission packages');

          const packages = (result.data?.packages || []).map((pkg) => ({
            value: pkg.id,
            label: pkg.package_name,
            description: pkg.description,
            groupCode: pkg.group_code,
            permissions: pkg.permissions?.filter((p) => p.is_active === 1) || [],
            isActive: pkg.is_active === 1
          }));

          permissionPackageOptionsRequestCache = {
            companyId,
            promise: null,
            data: packages
          };

          return packages;
        })().catch((error) => {
          permissionPackageOptionsRequestCache = { companyId, promise: null, data: null };
          throw error;
        });
      }

      const packages = await permissionPackageOptionsRequestCache.promise;
      setAllPermissionPackages(packages);
      return packages;
    } catch (e) {
      console.error('fetchAllPermissionPackageOptions:', e);
      toast.error(e.message || 'Failed to fetch permission packages');
      return [];
    } finally {
      setPackageOptionsLoading(false);
    }
  }, []);

  // ─── API Triggers ────────────────────────────────────────────────────────
  // Single unified useEffect to handle initial load, page changes, and search changes
  useEffect(() => {
    fetchPackages(pagination.page, true);
  }, [pagination.page, pagination.limit, debouncedSearch, fetchPackages]);

  // Reset page to 1 when search changes
  useEffect(() => {
    if (!isInitialLoad.current && pagination.page !== 1) {
      goToPage(1);
    }
  }, [debouncedSearch, goToPage]);

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  const createPackage = async (data) => {
    setLoading(true);
    try {
      const company = JSON.parse(localStorage.getItem('company'));
      const res = await apiCall('/permissions/create-package', 'POST', {
        package_name: data.package_name,
        ...(data.group_code ? { group_code: data.group_code } : {}),
        description: data.description,
        permissions: data.permissions
      }, company?.id);

      const result = await readApiResponse(res, `HTTP ${res.status}`);
      if (!res.ok) throw new Error(result.message || result.error || `HTTP ${res.status}`);
      if (result.success) return { success: true };
      throw new Error(result.message || 'Create failed');
    } catch (e) { return { success: false, error: e.message }; }
    finally { setLoading(false); }
  };

  const updatePackage = async (data) => {
    setLoading(true);
    try {
      const company = JSON.parse(localStorage.getItem('company'));
      const res = await apiCall('/permissions/update-package', 'PUT', {
        id: data.id,
        package_name: data.package_name,
        group_code: data.group_code,
        description: data.description,
        permissions: data.permissions
      }, company?.id);

      const result = await readApiResponse(res, `HTTP ${res.status}`);
      if (!res.ok) throw new Error(result.message || result.error || `HTTP ${res.status}`);
      if (result.success) return { success: true };
      throw new Error(result.message || 'Update failed');
    } catch (e) { return { success: false, error: e.message }; }
    finally { setLoading(false); }
  };

  const assignPermissionPackages = async (assignments) => {
    try {
      const company = JSON.parse(localStorage.getItem('company'));
      const payload = { assignments };

      const res = await apiCall('/permissions/transfer-packages', 'PUT', payload, company?.id);
      const result = await readApiResponse(res, `HTTP ${res.status}`);
      if (!res.ok) throw new Error(result.message || result.error || `HTTP ${res.status}`);
      if (result.success) return { success: true };
      throw new Error(result.message || 'Failed to assign packages');
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const deletePackage = async (packageId) => {
    setLoading(true);
    try {
      const company = JSON.parse(localStorage.getItem('company'));
      const res = await apiCall('/permissions/delete-package', 'DELETE', {
        "packageId": packageId
      }, company?.id);

      const result = await readApiResponse(res, `HTTP ${res.status}`);
      if (!res.ok) throw new Error(result.message || result.error || `HTTP ${res.status}`);
      if (result.success) return { success: true };
      throw new Error(result.message || 'Delete failed');
    } catch (e) { return { success: false, error: e.message }; }
    finally { setLoading(false); }
  };

  // ─── Modal handlers ───────────────────────────────────────────────────────
  const openCreateModal = () => {
    if (createAccess.disabled) return;
    fetchAllPermissions(); // Fetch permissions only when opening modal
    setFormData(emptyForm);
    setModalType(MODAL_TYPES.CREATE);
    setActiveActionMenu(null);
  };
  const openEditModal = (pkg) => {
    if (updateAccess.disabled) return;
    fetchAllPermissions(); // Fetch permissions only when opening modal
    setSelectedPackage(pkg);
    const permIds = (pkg.permissions || []).map(p => typeof p === 'object' ? (p.permission_id ?? p.id) : p);
    setFormData({ package_name: pkg.package_name, group_code: pkg.group_code, description: pkg.description || '', permissions: permIds });
    setModalType(MODAL_TYPES.EDIT);
    setActiveActionMenu(null);
  };
  const openViewModal = (pkg) => {
    fetchAllPermissions();
    setSelectedPackage(pkg);
    setModalType(MODAL_TYPES.VIEW);
    setActiveActionMenu(null);
  };
  const openDeleteModal = (pkg) => {
    if (deleteAccess.disabled) return;
    setSelectedPackage(pkg);
    setModalType(MODAL_TYPES.DELETE_CONFIRM);
    setActiveActionMenu(null);
  };
  const openPermListModal = (pkg) => {
    fetchAllPermissions();
    setSelectedPackage(pkg);
    setModalType(MODAL_TYPES.PERM_LIST);
    setActiveActionMenu(null);
  };
  const openEmployeeListModal = (pkg) => {
    fetchAllPermissionPackageOptions(); // Fetch options only when opening modal
    setSelectedPackage(pkg);
    setModalType(MODAL_TYPES.EMPLOYEE_LIST);
    setBulkTargetPackage(null);
    setSelectedEmployeeIds([]);
    setEmployeePackageSelections({});
    setActiveActionMenu(null);
  };
  const closeModal = () => {
    setModalType(MODAL_TYPES.NONE);
    setSelectedPackage(null);
    setFormData(emptyForm);
    setBulkTargetPackage(null);
    setSelectedEmployeeIds([]);
    setEmployeePackageSelections({});
  };

  // ─── Form handlers ────────────────────────────────────────────────────────
  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleCreate = async (e) => {
    e.preventDefault();
    const result = await createPackage(formData);
    if (result.success) { permissionPackagesRequestCache.clear(); toast.success('Package created successfully!'); closeModal(); fetchPackages(1); }
    else toast.error(result.error || 'Failed to create package');
  };
  const handleEdit = async (e) => {
    e.preventDefault();
    const result = await updatePackage({ id: selectedPackage.id, ...formData });
    if (result.success) { permissionPackagesRequestCache.clear(); toast.success('Package updated successfully!'); closeModal(); fetchPackages(pagination.page, false); }
    else toast.error(result.error || 'Failed to update package');
  };
  const handleDelete = async () => {
    const result = await deletePackage(selectedPackage.id);
    if (result.success) { permissionPackagesRequestCache.clear(); toast.success('Package deleted successfully!'); closeModal(); fetchPackages(pagination.page, false); }
    else toast.error(result.error || 'Failed to delete package');
  };

  const normalizePackageOption = useCallback((pkg) => ({
    value: pkg.value ?? pkg.id,
    label: pkg.label ?? pkg.package_name ?? 'Unnamed package',
    description: pkg.description ?? null,
    groupCode: pkg.groupCode ?? pkg.group_code ?? '',
    isActive: pkg.isActive ?? (pkg.is_active === 1),
  }), []);

  const getAssignablePackageOptions = useCallback((currentPackageId) => {
    return allPermissionPackages
      .map(normalizePackageOption)
      .filter((pkg) => String(pkg.value) !== String(currentPackageId));
  }, [allPermissionPackages, normalizePackageOption]);

  const handleBulkApplyPackage = async () => {
    if (!selectedPackage) return;
    if (!bulkTargetPackage?.value) {
      toast.warning('Select a target permission package');
      return;
    }
    if (selectedEmployeeIds.length === 0) {
      toast.warning('Select at least one employee');
      return;
    }

    const assignments = selectedEmployeeIds
      .map((employeeId) => {
        const chosenPackage = employeePackageSelections[employeeId] || bulkTargetPackage;
        const packageId = chosenPackage?.value;
        if (!packageId) return null;
        return {
          employee_id: employeeId,
          package_id: packageId
        };
      })
      .filter(Boolean);

    if (assignments.length === 0) {
      toast.warning('Select a target package for at least one employee');
      return;
    }

    setAssignmentLoading(true);
    try {
      const result = await assignPermissionPackages(assignments);
      if (result.success) {
        permissionPackagesRequestCache.clear();
        permissionPackageOptionsRequestCache = { companyId: null, promise: null, data: null };
        const refreshedPackages = await fetchPackages(pagination.page, false);
        const refreshedSelected = refreshedPackages.find((pkg) => String(pkg.id) === String(selectedPackage.id));
        if (refreshedSelected) setSelectedPackage(refreshedSelected);
        await fetchAllPermissionPackageOptions();
        setSelectedEmployeeIds([]);
        setBulkTargetPackage(null);
        toast.success(`Updated ${assignments.length} employee${assignments.length === 1 ? '' : 's'} successfully`);
      } else {
        toast.error(result.error || 'Failed to assign packages');
      }
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleSingleEmployeeApply = async (employeeId, targetPackage) => {
    if (!targetPackage?.value) {
      toast.warning('Select a target permission package');
      return;
    }

    setAssignmentLoading(true);
    try {
      const result = await assignPermissionPackages([{
        employee_id: employeeId,
        package_id: targetPackage.value
      }]);
      if (result.success) {
        permissionPackagesRequestCache.clear();
        permissionPackageOptionsRequestCache = { companyId: null, promise: null, data: null };
        const refreshedPackages = await fetchPackages(pagination.page, false);
        const refreshedSelected = refreshedPackages.find((pkg) => String(pkg.id) === String(selectedPackage.id));
        if (refreshedSelected) setSelectedPackage(refreshedSelected);
        await fetchAllPermissionPackageOptions();
        toast.success('Employee package updated successfully');
      } else {
        toast.error(result.error || 'Failed to update employee package');
      }
    } finally {
      setAssignmentLoading(false);
    }
  };

  const toggleEmployeeSelection = (employeeId) => {
    setSelectedEmployeeIds((prev) => (
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    ));
  };

  const toggleSelectAllEmployees = () => {
    const employeeIds = getUsedByEmployees(selectedPackage).map((employee) => employee.employee_id ?? employee.id).filter(Boolean);
    const allSelected = selectedEmployeeIds.length === employeeIds.length && employeeIds.length > 0;
    if (allSelected) {
      setSelectedEmployeeIds([]);
      setBulkTargetPackage(null);
      setEmployeePackageSelections({});
      return;
    }

    const nextSelections = {};
    const bulkOption = bulkTargetPackage || null;
    getUsedByEmployees(selectedPackage).forEach((employee) => {
      const employeeId = employee.employee_id ?? employee.id;
      if (employeeId) nextSelections[employeeId] = bulkOption;
    });

    setSelectedEmployeeIds(employeeIds);
    setEmployeePackageSelections(nextSelections);
  };

  const handleClearEmployeeSelection = () => {
    setSelectedEmployeeIds([]);
    setBulkTargetPackage(null);
  };

  const employeeOptionsForModal = getAssignablePackageOptions(selectedPackage?.id);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const normalisePermission = useCallback((permEntry) => {
    if (permEntry === null || permEntry === undefined) return null;
    if (typeof permEntry === 'object') {
      return {
        id: permEntry.permission_id ?? permEntry.id,
        code: permEntry.permission_code ?? permEntry.code ?? '',
        name: permEntry.permission_name ?? permEntry.name ?? 'Unknown Permission',
        action: permEntry.permission_action ?? permEntry.action ?? '',
      };
    }
    const found = allPermissions.find(p => p.id === permEntry || p.id === Number(permEntry));
    return found ? { id: found.id, code: found.code, name: found.name, action: found.action } : null;
  }, [allPermissions]);

  const getUsedByEmployees = useCallback((pkg) => {
    if (!pkg) return [];
    return Array.isArray(pkg.used_by) ? pkg.used_by : [];
  }, []);

  const getPackageUsageCount = useCallback((pkg) => {
    if (!pkg) return 0;
    if (typeof pkg.total_used === 'number') return pkg.total_used;
    return getUsedByEmployees(pkg).length;
  }, [getUsedByEmployees]);

  const hasAssignedEmployees = useCallback((pkg) => getUsedByEmployees(pkg).length > 0, [getUsedByEmployees]);

  const getGroupColor = (idx) => GROUP_COLORS[idx % GROUP_COLORS.length];

  useEffect(() => {
    const handler = () => setActiveActionMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handlePageChange = useCallback((newPage) => {
    if (newPage !== pagination.page) goToPage(newPage);
  }, [pagination.page, goToPage]);

  const selectedPackageUsage = selectedPackage
    ? {
      totalUsed: getPackageUsageCount(selectedPackage),
      employees: getUsedByEmployees(selectedPackage)
    }
    : null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-xl border border-slate-200 bg-white/90 p-5 shadow-xl shadow-slate-200/60 backdrop-blur md:p-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-green-700">
              <FaShieldAlt size={11} />
              Access control
            </div>
            <h1 className="mt-1 text-lg font-bold text-slate-900 md:text-xl">
              Permission Management
            </h1>
            <p className="mt-2 text-sm text-slate-500 md:text-base">
              Create and manage access packages for different employee roles.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <RefreshButton loading={loading} onClick={() => {
              fetchAllPermissions();
              fetchAllPermissionPackageOptions();
              fetchPackages(1, true);
            }}>
              Refresh
            </RefreshButton>
            <ManagementButton
              tone="blue"
              variant="solid"
              leftIcon={<FaPlus />}
              onClick={openCreateModal}
              disabled={createAccess.disabled}
              title={createAccess.disabled ? getAccessMessage(createAccess) : ''}
            >
              New Package
            </ManagementButton>
          </div>
        </div>
      </motion.div>

      {/* ─── Consolidated Filter & View Bar ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6"
      >
        {/* Left Section: Search & Result Info */}
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 w-full">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              placeholder="Search packages by name, code, or description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-green-500/10 focus:border-green-500 outline-none transition-all text-sm min-h-[42px]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <FaTimes size={14} />
              </button>
            )}
          </div>

          {!loading && packages.length > 0 && (
            <p className="text-sm text-gray-500 hidden xl:block">
              <span className="font-semibold text-gray-800">{packages.length}</span> of <span className="font-semibold text-gray-800">{pagination.total}</span> packages
            </p>
          )}
        </div>

        {/* Right Section: Controls */}
        <div className="flex w-full lg:w-auto items-center justify-between lg:justify-end gap-4">
          {/* Vertical Separator */}
          <div className="h-8 w-px bg-gray-200 hidden lg:block"></div>

          {/* View Switcher */}
          <div className="flex w-full lg:w-auto justify-end">
            <ManagementViewSwitcher
              viewMode={viewMode}
              onChange={setViewMode}
              accent="green"
            />
          </div>
        </div>
      </motion.div>

      {/* Loading skeleton */}
      {loading && packages.length === 0 && (
        <>
          <div className="hidden md:block bg-white rounded-xl shadow-xl overflow-hidden animate-pulse">
            <div className="h-12 bg-gradient-to-r from-gray-100 to-gray-200" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
                <div className="h-4 bg-gray-200 rounded w-1/5" />
                <div className="h-4 bg-gray-100 rounded w-1/6" />
                <div className="h-4 bg-gray-100 rounded w-2/5" />
                <div className="flex gap-1.5 flex-1">
                  <div className="h-6 w-14 bg-gray-100 rounded-lg" />
                  <div className="h-6 w-14 bg-gray-100 rounded-lg" />
                </div>
                <div className="h-6 w-16 bg-gray-200 rounded-full ml-auto" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-lg p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-xl flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 bg-gray-100 rounded w-full mb-3" />
                <div className="flex gap-2 flex-wrap">
                  {[...Array(3)].map((_, j) => <div key={j} className="h-6 w-16 bg-gray-100 rounded-lg" />)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && packages.length === 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12 sm:py-16 bg-white rounded-xl shadow-xl">
          <FaShieldAlt className="text-6xl sm:text-8xl text-gray-300 mx-auto mb-4" />
          <p className="text-lg sm:text-xl text-gray-500">No permission packages found</p>
          <p className="text-gray-400 mt-2 text-sm">Try adjusting your search or create a new package</p>
          <button onClick={openCreateModal} disabled={createAccess.disabled} title={createAccess.disabled ? getAccessMessage(createAccess) : ''}
            className="mt-6 inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            <FaPlus size={12} /> Create Package
          </button>
        </motion.div>
      )}

      {!loading && packages.length > 0 && (
        <>
          {viewMode === 'table' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-xl overflow-visible">
              <div className="overflow-x-auto overflow-y-visible">
                <table className="w-full text-sm text-left text-gray-700">
                  <thead className="xsm:hidden bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4">Package Name</th>
                      {showGroupCode && <th className="px-6 py-4">Group Code</th>}
                      {showDescription && <th className="px-6 py-4">Description</th>}
                      {showPermissionCount && <th className="px-6 py-4 text-center">Permissions</th>}
                      {showUsageCount && <th className="px-6 py-4 text-center">Used By</th>}
                      <th className="px-6 py-4 text-right"><FaCog className="w-4 h-4 ml-auto" /></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {packages.map((pkg, index) => (
                      <motion.tr key={pkg.id}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
                        onClick={() => openViewModal(pkg)}
                        className="cursor-pointer hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-300"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl flex-shrink-0 shadow-sm"><FaShieldAlt className="text-white text-xs" /></div>
                            <div className="min-w-0">
                              <span className="font-semibold text-gray-800 truncate max-w-[160px] block">{pkg.package_name}</span>
                              <span className="text-[11px] text-gray-400">Permission package</span>
                            </div>
                          </div>
                        </td>
                        {showGroupCode && (
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium border border-purple-200">
                              <FaCode size={9} />{pkg.group_code}
                            </span>
                          </td>
                        )}
                        {showDescription && (
                          <td className="px-6 py-4">
                            <span className="text-gray-500 text-xs line-clamp-2 max-w-[220px] block">
                              {pkg.description || <span className="italic text-gray-300">—</span>}
                            </span>
                          </td>
                        )}
                        {showPermissionCount && (
                          <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            {(pkg.permissions?.length || 0) > 0 ? (
                              <button type="button" onClick={() => openPermListModal(pkg)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 text-blue-700 text-xs font-bold hover:from-blue-100 hover:to-purple-100 hover:border-blue-400 hover:shadow-md transition-all duration-200 group">
                                <FaShieldAlt size={10} className="text-purple-500 group-hover:scale-110 transition-transform" />
                                {pkg.permissions.length} permission{pkg.permissions.length !== 1 ? 's' : ''}
                              </button>
                            ) : <span className="text-xs text-gray-400 italic">None</span>}
                          </td>
                        )}
                        {showUsageCount && (
                          <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            {getPackageUsageCount(pkg) > 0 ? (
                              <button type="button" onClick={() => openEmployeeListModal(pkg)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:from-emerald-100 hover:to-teal-100 hover:border-emerald-400 hover:shadow-md transition-all duration-200 group">
                                <FaLayerGroup size={10} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                                {getPackageUsageCount(pkg)} employee{getPackageUsageCount(pkg) !== 1 ? 's' : ''}
                              </button>
                            ) : <span className="text-xs text-gray-400 italic">0</span>}
                          </td>
                        )}
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <ActionMenu
                            menuId={pkg.id}
                            activeId={activeActionMenu}
                            onToggle={(e, id) => {
                              setActiveActionMenu((current) => (current === id ? null : id));
                            }}
                            actions={[
                              {
                                label: 'View Details',
                                icon: <FaEye size={12} />,
                                onClick: () => openViewModal(pkg),
                                className: 'text-green-600 hover:text-green-700 hover:bg-green-50'
                              },
                              {
                                label: 'Edit',
                                icon: <FaEdit size={12} />,
                                onClick: () => openEditModal(pkg),
                                disabled: updateAccess.disabled,
                                title: updateAccess.disabled ? getAccessMessage(updateAccess) : '',
                                className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                              },
                              {
                                label: 'Delete',
                                icon: <FaTrash size={12} />,
                                onClick: () => openDeleteModal(pkg),
                                disabled: deleteAccess.disabled || hasAssignedEmployees(pkg),
                                title: deleteAccess.disabled
                                  ? getAccessMessage(deleteAccess)
                                  : hasAssignedEmployees(pkg)
                                    ? `Cannot delete package. It is assigned to ${getUsedByEmployees(pkg).length} employee(s)`
                                    : '',
                                className: 'text-red-600 hover:text-red-700 hover:bg-red-50'
                              }
                            ]}
                          />
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {viewMode === 'card' && (
            <ManagementGrid viewMode={viewMode}>
              {packages.map((pkg, index) => (
                <motion.div key={pkg.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                  onClick={() => openViewModal(pkg)}
                  className="bg-white rounded-xl shadow-md border border-gray-100 p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-xl flex-shrink-0"><FaShieldAlt className="text-white text-xl" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-base text-gray-800 truncate">{pkg.package_name}</h3>
                        <div className="flex flex-shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium border border-purple-200">
                            <FaCode size={8} />{pkg.group_code}
                          </span>
                          <ActionMenu
                            menuId={`card-${pkg.id}`}
                            activeId={activeActionMenu}
                            onToggle={(e, id) => {
                              setActiveActionMenu((current) => (current === id ? null : id));
                            }}
                            actions={[
                              {
                                label: 'View Details',
                                icon: <FaEye size={12} />,
                                onClick: () => openViewModal(pkg),
                                className: 'text-green-600 hover:text-green-700 hover:bg-green-50'
                              },
                              {
                                label: 'Edit',
                                icon: <FaEdit size={12} />,
                                onClick: () => openEditModal(pkg),
                                disabled: updateAccess.disabled,
                                title: updateAccess.disabled ? getAccessMessage(updateAccess) : '',
                                className: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                              },
                              {
                                label: 'Delete',
                                icon: <FaTrash size={12} />,
                                onClick: () => openDeleteModal(pkg),
                                disabled: deleteAccess.disabled || hasAssignedEmployees(pkg),
                                title: deleteAccess.disabled
                                  ? getAccessMessage(deleteAccess)
                                  : hasAssignedEmployees(pkg)
                                    ? `Cannot delete package. It is assigned to ${getUsedByEmployees(pkg).length} employee(s)`
                                    : '',
                                className: 'text-red-600 hover:text-red-700 hover:bg-red-50'
                              }
                            ]}
                          />
                        </div>
                      </div>
                      {pkg.description && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{pkg.description}</p>}
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs font-medium text-gray-400 flex items-center gap-1"><FaTag size={9} /> Permissions</p>
                        {(pkg.permissions?.length || 0) > 0 ? (
                          <button type="button" onClick={(e) => { e.stopPropagation(); openPermListModal(pkg); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 text-blue-700 text-xs font-bold hover:from-blue-100 hover:to-purple-100 hover:border-blue-400 hover:shadow-md transition-all duration-200">
                            <FaShieldAlt size={10} className="text-purple-500" />
                            {pkg.permissions.length} permission{pkg.permissions.length !== 1 ? 's' : ''}
                          </button>
                        ) : <span className="text-xs text-gray-400 italic">No permissions</span>}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs font-medium text-gray-400 flex items-center gap-1"><FaLayerGroup size={9} /> Used by</p>
                        {getPackageUsageCount(pkg) > 0 ? (
                          <button type="button" onClick={(e) => { e.stopPropagation(); openEmployeeListModal(pkg); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:from-emerald-100 hover:to-teal-100 hover:border-emerald-400 hover:shadow-md transition-all duration-200">
                            <FaLayerGroup size={10} className="text-emerald-500" />
                            {getPackageUsageCount(pkg)} employee{getPackageUsageCount(pkg) !== 1 ? 's' : ''}
                          </button>
                        ) : <span className="text-xs text-gray-400 italic">No employees</span>}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </ManagementGrid>
          )}

          <Pagination
            currentPage={pagination.page} totalItems={pagination.total}
            itemsPerPage={pagination.limit} onPageChange={handlePageChange}
            showInfo={true} onLimitChange={changeLimit}
          />
        </>
      )}

      {/* Modals */}
      <AnimatePresence mode="wait">
        {modalType !== MODAL_TYPES.NONE && (
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <ModalScrollLock />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 18 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 18 }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className={`relative w-full ${modalType === MODAL_TYPES.DELETE_CONFIRM ? 'max-w-md' : modalType === MODAL_TYPES.EMPLOYEE_LIST ? 'max-w-6xl' : 'max-w-4xl'} max-h-[92vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200`}
              onClick={e => e.stopPropagation()}
            >
              {/* CREATE & EDIT Modals */}
              {(modalType === MODAL_TYPES.CREATE || modalType === MODAL_TYPES.EDIT) && (
                <form onSubmit={modalType === MODAL_TYPES.CREATE ? handleCreate : handleEdit} className="flex flex-col h-full overflow-hidden">
                  {/* Header */}
                  <div className="shrink-0 border-b border-slate-100 bg-white p-4 sm:px-6 sm:py-4 z-10">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-100">
                          {modalType === MODAL_TYPES.CREATE ? <FaPlus className="h-5 w-5 text-white" /> : <FaEdit className="h-5 w-5 text-white" />}
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">
                            {modalType === MODAL_TYPES.CREATE ? 'Create Permission Package' : 'Edit Package'}
                          </h2>
                          <p className="text-[11px] text-slate-500">
                            {modalType === MODAL_TYPES.CREATE ? 'Configure a new permission package' : `Editing ${selectedPackage?.package_name}`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={closeModal}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500  transition-all "
                      >
                        <FaTimes className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <PackageFormBody
                      formData={formData}
                      setFormData={setFormData}
                      onInputChange={handleInputChange}
                      allPermissions={allPermissions}
                      permsLoading={permsLoading}
                      packageUsage={modalType === MODAL_TYPES.EDIT && selectedPackageUsage ? selectedPackageUsage : null}
                      onOpenEmployeeList={selectedPackage ? () => openEmployeeListModal(selectedPackage) : undefined}
                    />
                  </div>

                  {/* Footer */}
                  <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-3.5 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-semibold text-[13px] hover:bg-slate-100 transition-all shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || (modalType === MODAL_TYPES.CREATE ? createAccess.disabled : updateAccess.disabled)}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-[13px] hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaCheck className="h-4 w-4" />}
                      {modalType === MODAL_TYPES.CREATE ? 'Create Package' : 'Update Package'}
                    </button>
                  </div>
                </form>
              )}

              {/* VIEW, PERM_LIST & EMPLOYEE_LIST Modals */}
              {(modalType === MODAL_TYPES.VIEW || modalType === MODAL_TYPES.PERM_LIST || modalType === MODAL_TYPES.EMPLOYEE_LIST) && selectedPackage && (
                <>
                  {/* Header */}
                  <div className="shrink-0 border-b border-slate-100 bg-white p-4 sm:px-6 sm:py-4 z-10">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-100">
                          <FaShieldAlt className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">{selectedPackage.package_name}</h2>
                          <p className="text-[11px] text-slate-500">
                            {modalType === MODAL_TYPES.EMPLOYEE_LIST ? 'Assigned employees' : 'Package Details & Permissions'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={closeModal}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500  transition-all "
                      >
                        <FaTimes className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar bg-slate-50/40">
                    {/* Profile Card */}
                    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden ${modalType === MODAL_TYPES.EMPLOYEE_LIST ? 'lg:grid lg:grid-cols-[360px_minmax(0,1fr)]' : ''}`}>
                      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white p-4 sm:p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-100">
                              <FaShieldAlt size={20} />
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate text-lg font-black text-slate-900">{selectedPackage.package_name}</h3>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                                  {selectedPackage.group_code}
                                </span>
                                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                  {selectedPackageUsage?.totalUsed || 0} employees
                                </span>
                                <span className="rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                  {selectedPackage.permissions?.length || 0} permissions
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {selectedPackage.description && (
                          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-500">
                            {selectedPackage.description}
                          </p>
                        )}
                      </div>

                      <div className={modalType === MODAL_TYPES.EMPLOYEE_LIST ? 'lg:border-r lg:border-slate-100' : ''}>
                        {modalType === MODAL_TYPES.EMPLOYEE_LIST ? (
                          <div className="p-4 sm:p-5 space-y-4">
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Bulk transfer</p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    Move selected employees to another permission package.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={toggleSelectAllEmployees}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
                                  >
                                    {selectedEmployeeIds.length === getUsedByEmployees(selectedPackage).length ? 'Clear' : 'Select all'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleClearEmployeeSelection}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
                                  >
                                    Reset
                                  </button>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                                <div>
                                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                    Target package
                                  </label>
                                  <SelectField
                                    isClearable
                                    isSearchable
                                    isDisabled={assignmentLoading || packageOptionsLoading}
                                    options={employeeOptionsForModal}
                                    value={bulkTargetPackage}
                                    onChange={(option) => {
                                      setBulkTargetPackage(option);
                                      if (selectedEmployeeIds.length > 0) {
                                        setEmployeePackageSelections((prev) => {
                                          const next = { ...prev };
                                          selectedEmployeeIds.forEach((employeeId) => {
                                            next[employeeId] = option;
                                          });
                                          return next;
                                        });
                                      }
                                    }}
                                    placeholder={packageOptionsLoading ? 'Loading packages...' : 'Select new package'}
                                    classNamePrefix="react-select"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={handleBulkApplyPackage}
                                  disabled={assignmentLoading || selectedEmployeeIds.length === 0 || !bulkTargetPackage}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition hover:from-indigo-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {assignmentLoading ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaCheck className="h-4 w-4" />}
                                  Apply
                                </button>
                              </div>
                            </div>

                            <div className="space-y-3">
                              {selectedPackageUsage?.employees?.length > 0 ? (
                                selectedPackageUsage.employees.map((employee, idx) => {
                                  const employeeId = employee.employee_id ?? employee.id;
                                  const selectedOption = employeePackageSelections[employeeId] || null;
                                  const isSelected = selectedEmployeeIds.includes(employeeId);

                                  return (
                                    <div
                                      key={employeeId ?? idx}
                                      className={`rounded-2xl border bg-white p-4 shadow-sm transition-all ${isSelected ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-100 hover:border-slate-200'}`}
                                    >
                                      <div className="flex items-start gap-3">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleEmployeeSelection(employeeId)}
                                          className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="min-w-0">
                                              <div className="flex items-center gap-3">
                                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-xs font-black text-indigo-700">
                                                  {idx + 1}
                                                </span>
                                                <div className="min-w-0">
                                                  <p className="truncate text-sm font-bold text-slate-900">{employee.name || 'Unknown Employee'}</p>
                                                  <p className="truncate text-[11px] text-slate-500">{employee.employee_code || employee.email || 'No employee code'}</p>
                                                  <p className="mt-1 text-[11px] text-slate-400">{employee.designation || 'No designation'}</p>
                                                </div>
                                              </div>
                                            </div>

                                            <div className="grid gap-3 lg:min-w-[330px]">
                                              <SelectField
                                                isClearable
                                                isSearchable
                                                isDisabled={assignmentLoading || packageOptionsLoading}
                                                options={employeeOptionsForModal}
                                                value={selectedOption}
                                                onChange={(option) => {
                                                  setEmployeePackageSelections((prev) => ({ ...prev, [employeeId]: option }));
                                                  if (option && selectedEmployeeIds.includes(employeeId) && selectedEmployeeIds.length > 0) {
                                                    setBulkTargetPackage(option);
                                                  }
                                                }}
                                                placeholder="Select new package"
                                                classNamePrefix="react-select"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => handleSingleEmployeeApply(employeeId, selectedOption)}
                                                disabled={assignmentLoading || !selectedOption}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                              >
                                                {assignmentLoading ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaCheck className="h-4 w-4" />}
                                                Update employee
                                              </button>
                                            </div>
                                          </div>

                                          <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                              Current
                                            </span>
                                            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                                              {selectedPackage.package_name}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
                                  <FaBan className="mx-auto mb-2 text-2xl text-slate-300" />
                                  <p className="text-sm font-semibold text-slate-500">No employees assigned</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 sm:p-5">
                            <CategoryPermissionSelector
                              allPermissions={allPermissions.filter(p => (selectedPackage.permissions || []).some(sp => (sp.permission_id ?? sp.id) === p.id))}
                              selectedIds={(selectedPackage.permissions || []).map(p => (p.permission_id ?? p.id))}
                              readOnly={true}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-3.5 flex justify-end gap-2.5">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-semibold text-[13px] hover:bg-slate-100 transition-all shadow-sm"
                    >
                      Close
                    </button>
                    {modalType !== MODAL_TYPES.EMPLOYEE_LIST && (
                      <button
                        onClick={() => openEditModal(selectedPackage)}
                        disabled={updateAccess.disabled}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-[13px] hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FaEdit size={12} /> Edit Package
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* DELETE CONFIRM Modal */}
              {modalType === MODAL_TYPES.DELETE_CONFIRM && selectedPackage && (
                <>
                  {/* Header */}
                  <div className="shrink-0 border-b border-slate-100 bg-white p-4 sm:px-6 sm:py-4 z-10">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-rose-100">
                          <FaTrash className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">Delete Package</h2>
                          <p className="text-[11px] text-slate-500">Confirm permanent removal</p>
                        </div>
                      </div>
                      <button
                        onClick={closeModal}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500  transition-all "
                      >
                        <FaTimes className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto p-5 text-center space-y-3">
                    <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner border border-rose-100">
                      <FaTrash size={28} />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[13px] text-slate-600 font-medium">
                        Are you sure you want to delete <span className="font-bold text-slate-900">{selectedPackage.package_name}</span>?
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed px-4">
                        This action will permanently remove this permission package. Any employees assigned to this package will lose their current access settings.
                      </p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-3.5 flex gap-2.5">
                    <button
                      onClick={closeModal}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-[13px] hover:bg-slate-100 transition-all shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={loading || deleteAccess.disabled}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-bold text-[13px] hover:from-red-700 hover:to-rose-700 transition-all shadow-lg shadow-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaTrash size={12} />}
                      Delete Now
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PermissionManagement;