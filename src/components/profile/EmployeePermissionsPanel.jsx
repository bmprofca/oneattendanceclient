import React, { useCallback, useEffect, useState } from 'react';
import { FaShieldAlt, FaSpinner, FaSave, FaExchangeAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import apiCall from '../../utils/api';
import { runDedupedRequest } from '../../utils/requestDeduper';
import CategoryPermissionSelector from '../common/CategoryPermissionSelector';
import Modal from '../Modal';
import SelectField from '../SelectField';

const EMPLOYEE_PERMISSION_CACHE_TTL = 1000;
const employeePermissionCache = new Map();

/**
 * Props:
 *  - employeeId: number
 *  - canEdit: boolean   (if true, show save/cancel and allow selection)
 */
const EmployeePermissionsPanel = ({ employeeId, canEdit = false, refreshKey = 0 }) => {
  const [loading, setLoading] = useState(true);
  const [packageData, setPackageData] = useState(null);
  const [allPermissions, setAllPermissions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const getCompanyId = () => {
    const company = localStorage.getItem('company');
    return company ? JSON.parse(company)?.id : null;
  };

  const loadPermissions = useCallback(async () => {
    if (!employeeId) return;
    const cacheKey = `${getCompanyId() ?? 'none'}:${employeeId}`;
    const cached = employeePermissionCache.get(cacheKey);

    if (cached?.data && cached.expiresAt > Date.now()) {
      const permissions = Array.isArray(cached.data.data?.permissions) ? cached.data.data.permissions : [];
      setPackageData(cached.data.data?.package || null);
      setAllPermissions(permissions);
      setSelectedIds(permissions.map((permission) => permission.id));
      return cached.data;
    }

    try {
      const json = await runDedupedRequest(`permission-panel:${cacheKey}`, async () => {
        const response = await apiCall(`/permissions/employee-package/${employeeId}`, 'GET', null, getCompanyId());
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Failed to load permissions');
        employeePermissionCache.set(cacheKey, { data: result, expiresAt: Date.now() + EMPLOYEE_PERMISSION_CACHE_TTL });
        return result;
      });

      const permissions = Array.isArray(json.data?.permissions) ? json.data.permissions : [];
      setPackageData(json.data?.package || null);
      setAllPermissions(permissions);
      setSelectedIds(permissions.map((permission) => permission.id));
      return json;
    } catch (error) {
      employeePermissionCache.delete(cacheKey);
      throw error;
    }
  }, [employeeId]);

  useEffect(() => {
    setLoading(true);
    loadPermissions()
      .catch((err) => {
        console.error(err);
        toast.error(err.message || 'Network error while loading permissions');
      })
      .finally(() => setLoading(false));
  }, [employeeId, refreshKey, loadPermissions]);

  const loadPackages = async () => {
    setLoadingPackages(true);
    try {
      const response = await apiCall('/permissions/permission-packages?page=1&limit=1000', 'GET', null, getCompanyId());
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || 'Failed to load permission packages');
      setPackages(Array.isArray(json.data) ? json.data : (json.data?.packages || []));
    } catch (err) {
      toast.error(err.message || 'Failed to load permission packages');
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleTransferPackage = async () => {
    if (!selectedPackageId) {
      toast.warning('Please select a permission package');
      return;
    }
    setTransferring(true);
    const company = localStorage.getItem('company');
    const companyId = company ? JSON.parse(company)?.id : null;
    try {
      const response = await apiCall(
        '/permissions/transfer-packages',
        'PUT',
        { assignments: [{ employee_id: Number(employeeId), package_id: Number(selectedPackageId) }] },
        companyId
      );
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || 'Failed to assign package');
      toast.success(json.message || 'Permission package assigned successfully');
      setShowTransferModal(false);
      setSelectedPackageId('');
      employeePermissionCache.delete(`${getCompanyId() ?? 'none'}:${employeeId}`);
      await loadPermissions();
    } catch (err) {
      toast.error(err.message || 'Failed to assign package');
    } finally {
      setTransferring(false);
    }
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    const company = localStorage.getItem('company');
    const companyId = company ? JSON.parse(company)?.id : null;

    try {
      const response = await apiCall(
        `/employee/permissions`,
        'POST',
        { employee_id: employeeId, permission_ids: selectedIds },
        companyId
      );
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || 'Failed to save');
      toast.success('Permissions updated');
    } catch (err) {
      toast.error(err.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <FaSpinner className="animate-spin text-indigo-600 text-2xl" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header with package info */}
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
          <FaShieldAlt size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-800 truncate">
            {packageData?.package_name || 'Permission Package'}
          </h2>
          <p className="text-xs text-slate-500 truncate">
            {packageData?.description || 'No description'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowTransferModal(true); loadPackages(); }}
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
        >
          <FaExchangeAlt size={11} />Transfer Package
        </button>
        {canEdit && (
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Editable
          </span>
        )}
      </div>

      {/* Category selector with responsive height */}
      <div className="p-4">
        <CategoryPermissionSelector
          allPermissions={allPermissions}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          readOnly={!canEdit}
          listHeightClass="max-h-[55vh]"
        />
      </div>

      {/* Footer actions (only when editable) */}
      {canEdit && (
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setSelectedIds(allPermissions.map((p) => p.id))}
            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-black uppercase tracking-widest shadow-md shadow-indigo-200 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? <FaSpinner className="animate-spin" size={12} /> : <FaSave size={12} />}
            {saving ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      )}

      <Modal
        isOpen={showTransferModal}
        onClose={() => !transferring && setShowTransferModal(false)}
        title="Transfer Permission Package"
        subtitle="Assign a new permission package to this employee"
        icon={<FaShieldAlt className="text-indigo-600" />}
        size="md"
        footer={(
          <>
            <button
              type="button"
              onClick={() => setShowTransferModal(false)}
              disabled={transferring}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTransferPackage}
              disabled={transferring || loadingPackages || !selectedPackageId}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {transferring ? <FaSpinner className="animate-spin" size={12} /> : <FaExchangeAlt size={12} />}
              {transferring ? 'Assigning...' : 'Assign Package'}
            </button>
          </>
        )}
      >
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Permission Package
        </label>
        <SelectField
          value={packages
            .map((permissionPackage) => ({
              value: permissionPackage.id,
              label: `${permissionPackage.package_name || permissionPackage.name} (${permissionPackage.group_code || 'Code'})`,
            }))
            .find((option) => String(option.value) === String(selectedPackageId)) || null}
          onChange={(option) => setSelectedPackageId(option?.value || '')}
          options={packages.map((permissionPackage) => ({
            value: permissionPackage.id,
            label: `${permissionPackage.package_name || permissionPackage.name} (${permissionPackage.group_code || 'Code'})`,
          }))}
          isLoading={loadingPackages}
          isDisabled={transferring}
          placeholder={loadingPackages ? 'Loading packages...' : 'Select permission package'}
          menuPortalTarget={document.body}
          classNamePrefix="react-select"
        />
      </Modal>
    </div>
  );
};

export default EmployeePermissionsPanel;