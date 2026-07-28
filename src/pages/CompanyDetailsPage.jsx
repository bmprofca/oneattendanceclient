import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import apiCall, { uploadFile } from '../utils/api';
import { getPreciseLocation } from '../utils/geolocation';
import SelectField from '../components/SelectField';
import { RefreshButton } from '../components/common';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FaArrowLeft, FaBuilding, FaGlobe, FaMapMarkerAlt, FaRoad, FaCity, FaEnvelope, FaCrosshairs,
  FaCheck, FaTimes, FaSpinner, FaMapPin, FaPlus, FaTrash, FaLink, FaWifi, FaLocationArrow,
  FaCamera, FaQrcode, FaFingerprint, FaUserCheck, FaChevronDown, FaChevronUp, FaSave,
  FaInfoCircle, FaUndo
} from 'react-icons/fa';

const GEOCODING_API = "https://nominatim.openstreetmap.org/search";

const COMPANY_TABS = [
  { key: 'basic', label: 'Basic Information', icon: <FaBuilding size={12} /> },
  { key: 'address', label: 'Address & Location', icon: <FaMapMarkerAlt size={12} /> },
  { key: 'attendance', label: 'Attendance Config', icon: <FaUserCheck size={12} /> },
];

const BASIC_UPDATE_FIELDS = [
  'name', 'legal_name', 'logo_url', 'address_line1', 'address_line2',
  'city', 'state', 'postal_code', 'country', 'transaction_currency', 'gst_no',
];

const ATTENDANCE_UPDATE_FIELDS = ['latitude', 'longitude', 'max_distance'];

const DEFAULT_CURRENCY_OPTIONS = [
  { value: "inr", label: "Indian Rupee (₹)" },
  { value: "usd", label: "US Dollar ($)" },
  { value: "eur", label: "Euro (€)" },
  { value: "jpy", label: "Japanese Yen (¥)" },
];

const normalizeCurrencyValue = (value) => {
  // Return null for null/undefined/empty so the field can be blank
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === "object") {
    return normalizeCurrencyValue(value.value || value.key);
  }
  return String(value).trim().toLowerCase();
};

const normalizeCurrencyOptions = (items = []) => {
  const options = items.map((item) => {
    const value = item?.value || {};
    const currencyValue = normalizeCurrencyValue(value.value || item?.key);
    const symbol = value.symbol ? ` (${value.symbol})` : "";
    return {
      value: currencyValue,
      label: `${value.label || item?.label || item?.key || currencyValue.toUpperCase()}${symbol}`,
    };
  }).filter((item) => item.value);
  return options.length > 0 ? options : DEFAULT_CURRENCY_OPTIONS;
};

const parseIPs = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') return String(item.ip_v4 || item.ip || item.value || '').trim();
        return '';
      })
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parseIPs(parsed);
    } catch {
      return [value.trim()].filter(Boolean);
    }
  }
  return [];
};

const parseMethods = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim().toLowerCase();
        if (item && typeof item === 'object') {
          return String(item.method || item.key || item.id || item.value || '').trim().toLowerCase();
        }
        return '';
      })
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parseMethods(parsed);
    } catch {
      return [value.trim().toLowerCase()].filter(Boolean);
    }
  }
  return [];
};

const normalizeMethodOptions = (items = []) =>
  items.map((item) => ({
    key: String(item.key || '').toLowerCase(),
    value: String(item.value?.value || item.value || '').toLowerCase(),
    label: item.value?.label || item.label || item.key,
    description: item.value?.description || '',
    requiresDevice: !!item.value?.requiresDevice,
    requiresLocation: !!item.value?.requiresLocation,
    requiresCamera: !!item.value?.requiresCamera,
    isAvailable: item.value?.is_available !== false,
  })).filter((item) => item.value);

const methodIcon = (value) => {
  switch (value) {
    case 'gps': return FaLocationArrow;
    case 'ip': return FaWifi;
    case 'face': return FaCamera;
    case 'qr': return FaQrcode;
    case 'fingerprint': return FaFingerprint;
    case 'manual': default: return FaUserCheck;
  }
};

function MethodTabButton({ tab, active, enabled, disabled, onClick, onExpand, onToggle }) {
  const Icon = methodIcon(tab.value);
  return (
    <div
      className={`relative flex items-center gap-3 px-4 py-3 sm:py-4 transition-all 
        ${active ? 'bg-indigo-50/50 rounded-t-xl' : !disabled ? 'hover:bg-slate-50 rounded-xl' : 'rounded-xl'} 
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`flex flex-1 items-center gap-4 text-left w-full overflow-hidden ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all 
            ${active ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-gray-100 text-gray-500'}`}
        >
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[15px] font-bold transition-colors 
              ${active ? 'text-indigo-900' : 'text-gray-800'}`}
          >
            {tab.label}
          </span>
          <span className="block text-xs font-medium opacity-80 truncate text-gray-500 mt-0.5">
            {tab.description || tab.value}
          </span>
        </span>
        {/* Chevron – no hover effect when disabled */}
        <span
          className={`flex-shrink-0 ml-1 mr-2 p-1.5 rounded-full transition-colors 
            ${disabled
              ? 'text-gray-400'
              : active
                ? 'bg-indigo-100 text-indigo-600'
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
        >
          {active ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
        </span>
      </button>

      {/* Checkbox – disabled cursor */}
      <div className="flex shrink-0 items-center justify-center pl-2 pr-1">
        <label
          className={`relative flex items-center ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <input
            type="checkbox"
            className="peer sr-only"
            checked={enabled}
            onChange={() => { onToggle(); if (!active && onExpand) onExpand(); }}
            disabled={disabled}
          />
          <div
            className={`h-6 w-6 rounded-lg border-2 transition-all flex items-center justify-center 
              ${enabled ? 'border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-200' : 'border-gray-300 bg-white'}`}
          >
            <FaCheck
              className={`text-white transition-all transform ${enabled ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
              size={12}
            />
          </div>
        </label>
      </div>
    </div>
  );
}

export default function CompanyDetailsPage() {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [isLoadingCompany, setIsLoadingCompany] = useState(true);
  const [isRefreshingCompany, setIsRefreshingCompany] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    name: "", legal_name: "", logo_url: "", address_line1: "", address_line2: "",
    city: "", state: "", postal_code: "", country: "India", latitude: "", longitude: "",
    transaction_currency: null, gst_no: "", max_distance: ""
  });
  const [originalData, setOriginalData] = useState({});
  const [currencyOptions, setCurrencyOptions] = useState(DEFAULT_CURRENCY_OPTIONS);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [addressMode, setAddressMode] = useState('manual');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isAddressAutoDetected, setIsAddressAutoDetected] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const companyDetailsRequestRef = useRef({ key: null, promise: null });
  const currencyConstantsRequestRef = useRef(null);
  const currencyConstantsLoadedRef = useRef(false);
  const attendanceMethodsRequestRef = useRef(new Map());
  const attendanceMethodsCacheRef = useRef(new Map());

  const [availableMethods, setAvailableMethods] = useState([]);
  const [activeMethod, setActiveMethod] = useState('manual');
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [enabledMethods, setEnabledMethods] = useState([]);
  const [ips, setIps] = useState([]);
  const [ipInput, setIpInput] = useState('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const fetchCompanyDetails = useCallback(async ({ showInitialLoader = false, showToast = false, force = false } = {}) => {
    if (!companyId) {
      setCompany(null);
      setIsLoadingCompany(false);
      return;
    }
    if (showInitialLoader) setIsLoadingCompany(true);
    else setIsRefreshingCompany(true);
    try {
      const requestKey = String(companyId);
      if (force || companyDetailsRequestRef.current.key !== requestKey || !companyDetailsRequestRef.current.promise) {
        companyDetailsRequestRef.current = {
          key: requestKey,
          promise: apiCall(`/company/details?company_id=${encodeURIComponent(companyId)}`, 'GET', null, companyId)
            .then(async (response) => ({ response, result: await response.json() })),
        };
      }
      const { response, result } = await companyDetailsRequestRef.current.promise;
      if (!response.ok || !result.success || !result.data) {
        companyDetailsRequestRef.current = { key: null, promise: null };
        throw new Error(result.message || 'Failed to load company details');
      }
      setCompany(result.data);
      if (showToast) toast.success('Company details refreshed');
    } catch (error) {
      companyDetailsRequestRef.current = { key: null, promise: null };
      toast.error(error.message || 'Failed to load company details');
      if (showInitialLoader) setCompany(null);
    } finally {
      if (showInitialLoader) setIsLoadingCompany(false);
      else setIsRefreshingCompany(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchCompanyDetails({ showInitialLoader: true });
  }, [fetchCompanyDetails]);

  const handleRefreshCompany = () => {
    fetchCompanyDetails({ showToast: true, force: true });
  };

  useEffect(() => {
    if (company) {
      const data = {
        name: company.name || "", legal_name: company.legal_name || "", logo_url: company.logo_url || "",
        address_line1: company.address_line1 || "", address_line2: company.address_line2 || "",
        city: company.city || "", state: company.state || "", postal_code: company.postal_code || "",
        country: company.country || "India", latitude: company.latitude || "", longitude: company.longitude || "",
        transaction_currency: normalizeCurrencyValue(company.transaction_currency),
        gst_no: company.gst_no || "",
        max_distance: company.max_distance ?? ""
      };
      setFormData(data);
      setOriginalData(data);
      setIps(parseIPs(company.company_ips || []));
      setEnabledMethods(parseMethods(company.attendance_methods || []));
      setAddressMode('manual');
      setIsAddressAutoDetected(false);
      setLogoPreview(null);
      setLogoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [company]);

  useEffect(() => {
    let ignore = false;
    const loadCurrencies = async () => {
      if (currencyConstantsLoadedRef.current) return;
      setLoadingCurrencies(true);
      try {
        if (!currencyConstantsRequestRef.current) {
          currencyConstantsRequestRef.current = apiCall('/constants/?type=currency', 'GET')
            .then(async (response) => ({ response, result: await response.json() }));
        }
        const { response, result } = await currencyConstantsRequestRef.current;
        if (response.ok && result.success) {
          const options = normalizeCurrencyOptions(result.data?.currency_types || []);
          currencyConstantsLoadedRef.current = true;
          if (!ignore) setCurrencyOptions(options);
        } else {
          currencyConstantsRequestRef.current = null;
        }
      } catch (error) {
        currencyConstantsRequestRef.current = null;
        if (!ignore) setCurrencyOptions(DEFAULT_CURRENCY_OPTIONS);
      } finally {
        if (!ignore) setLoadingCurrencies(false);
      }
    };
    loadCurrencies();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (!company?.id) return;
    let ignore = false;
    const loadAttendanceMethods = async () => {
      const cacheKey = String(company.id);
      const cachedOptions = attendanceMethodsCacheRef.current.get(cacheKey);
      if (cachedOptions) {
        setAvailableMethods(cachedOptions);
        const preferred = cachedOptions.find((option) => option.value === 'manual') || cachedOptions[0];
        if (preferred) setActiveMethod((current) => (current && cachedOptions.some((option) => option.value === current) ? current : preferred.value));
        return;
      }

      setLoadingMethods(true);
      try {
        if (!attendanceMethodsRequestRef.current.has(cacheKey)) {
          attendanceMethodsRequestRef.current.set(
            cacheKey,
            apiCall('/constants/?type=attendance_method', 'GET', null, company.id)
              .then(async (response) => ({ response, result: await response.json() }))
          );
        }
        const { response, result } = await attendanceMethodsRequestRef.current.get(cacheKey);
        if (response.ok && result.success && !ignore) {
          const options = normalizeMethodOptions(result.data?.attendance_methods || []);
          attendanceMethodsCacheRef.current.set(cacheKey, options);
          setAvailableMethods(options);
          const preferred = options.find((option) => option.value === 'manual') || options[0];
          if (preferred) setActiveMethod((current) => (current && options.some((option) => option.value === current) ? current : preferred.value));
        } else if (!response.ok || !result.success) {
          attendanceMethodsRequestRef.current.delete(cacheKey);
        }
      } catch (error) {
        attendanceMethodsRequestRef.current.delete(cacheKey);
        if (!ignore) toast.error(error.message || 'Failed to load attendance methods');
      } finally {
        if (!ignore) setLoadingMethods(false);
      }
    };
    loadAttendanceMethods();
    return () => { ignore = true; };
  }, [company?.id]);

  useEffect(() => {
    return () => { if (logoPreview) URL.revokeObjectURL(logoPreview); };
  }, [logoPreview]);

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploadingLogo(true);
      try {
        const url = await uploadFile(file);
        setFormData(prev => ({ ...prev, logo_url: url }));
        setLogoFile(file);
        setLogoPreview(url);
        toast.success("Logo uploaded successfully!");
      } catch (error) {
        toast.error(error.message || "Failed to upload logo");
      } finally {
        setIsUploadingLogo(false);
      }
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    if (logoPreview) { URL.revokeObjectURL(logoPreview); setLogoPreview(null); }
    setFormData(prev => ({ ...prev, logo_url: "" }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (addressMode === 'auto' && !isAddressAutoDetected) {
      setAddressMode('manual');
      setIsAddressAutoDetected(false);
    }
  };

  const handleCurrencyChange = (option) => {
    setFormData(prev => ({ ...prev, transaction_currency: normalizeCurrencyValue(option?.value) }));
  };

  const handleAddressModeChange = async (mode) => {
    if (mode === 'manual') { setAddressMode('manual'); setIsAddressAutoDetected(false); return; }
    setIsGeocoding(true);
    try {
      const position = await getPreciseLocation({ fetchAddress: true });
      setAddressMode('auto');
      const formUpdate = { latitude: position.latitude.toString(), longitude: position.longitude.toString() };
      if (position.address) {
        formUpdate.address_line1 = position.address.line1;
        formUpdate.address_line2 = position.address.line2;
        formUpdate.city = position.address.city;
        formUpdate.state = position.address.state;
        formUpdate.postal_code = position.address.postal_code;
        formUpdate.country = position.address.country;
        setIsAddressAutoDetected(true);
        toast.success("📍 Location and address auto-detected successfully!");
      } else {
        toast.info("📍 Coordinates detected, but could not resolve full address.");
      }
      setFormData(prev => ({ ...prev, ...formUpdate }));
    } catch (error) {
      setAddressMode('manual');
      toast.info((error.message || "Unable to get current location.") + " Please use manual address entry.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleManualGeocode = async () => {
    const addressString = [formData.address_line1, formData.city, formData.state, formData.postal_code, formData.country].filter(Boolean).join(", ");
    if (addressString.split(", ").length < 2) { toast.warning("Please enter at least address line and city to get coordinates"); return; }
    setIsGeocoding(true);
    try {
      const params = new URLSearchParams({ q: addressString, format: 'json', limit: 1, addressdetails: 1 });
      const response = await fetch(`${GEOCODING_API}?${params}`, { headers: { 'Accept': 'application/json', 'User-Agent': 'AttendanceApp/1.0' } });
      const data = await response.json();
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, latitude: data[0].lat, longitude: data[0].lon }));
        toast.success("📍 Location coordinates found!");
      } else {
        toast.warning("Could not find coordinates for this address");
      }
    } catch (error) { toast.error("Failed to get coordinates"); }
    finally { setIsGeocoding(false); }
  };

  const toggleMethod = (methodValue) => setEnabledMethods((prev) => prev.includes(methodValue) ? prev.filter((item) => item !== methodValue) : [...prev, methodValue]);

  const addIp = () => {
    const next = ipInput.trim();
    if (!next) return;
    if (ips.includes(next)) { toast.info('IP already added'); return; }
    setIps((prev) => [...prev, next]);
    setIpInput('');
  };

  const removeIp = (value) => setIps((prev) => prev.filter((ip) => ip !== value));

  const handleAutoDetectIps = async () => {
    setIsSubmitting(true);
    try {
      const payload = { id: company.id, company_ips: [] };
      const response = await apiCall('/company/update-attendance-settings', 'PUT', payload, company.id);
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Failed to update company');
      toast.success('Company IP auto-detected successfully');
      setCompany(prev => ({ ...prev, company_ips: payload.company_ips }));
    } catch (error) { toast.error(error.message || 'Failed to auto-detect IP'); }
    finally { setIsSubmitting(false); }
  };

  const hasChanges = useMemo(() => {
    let changed = false;
    Object.keys(formData).forEach(key => {
      if (key !== 'logo_url' && formData[key] !== originalData[key]) {
        if (formData[key] || originalData[key]) {
          const val1 = String(formData[key] || '').trim();
          const val2 = String(originalData[key] || '').trim();
          if (val1 !== val2) changed = true;
        }
      }
    });
    if (logoFile) changed = true;

    const originalIps = parseIPs(company?.company_ips || []);
    if (ips.length !== originalIps.length) changed = true;
    else if (ips.some(ip => !originalIps.includes(ip))) changed = true;

    const originalMethods = parseMethods(company?.attendance_methods || []);
    if (enabledMethods.length !== originalMethods.length) changed = true;
    else if (enabledMethods.some(m => !originalMethods.includes(m))) changed = true;

    return changed;
  }, [formData, originalData, logoFile, ips, enabledMethods, company]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const basicPayload = { id: company.id };
      const attendancePayload = { id: company.id };

      BASIC_UPDATE_FIELDS.forEach((key) => {
        const hasLogoChange = key === 'logo_url' && logoFile;
        if (hasLogoChange || formData[key] !== originalData[key]) {
          if (formData[key] || originalData[key] || hasLogoChange) {
            basicPayload[key] = formData[key];
          }
        }
      });

      ATTENDANCE_UPDATE_FIELDS.forEach((key) => {
        if (formData[key] !== originalData[key]) {
          if (formData[key] || originalData[key]) {
            attendancePayload[key] = key === 'max_distance' && formData[key] !== '' ? Number(formData[key]) : formData[key];
          }
        }
      });

      const normalizedIps = ips.map((ip) => ip.trim()).filter(Boolean);
      const normalizedMethods = enabledMethods.map((method) => method.trim().toLowerCase()).filter(Boolean);

      const originalIps = parseIPs(company?.company_ips || []);
      const ipsChanged = ips.length !== originalIps.length || ips.some((ip) => !originalIps.includes(ip));
      if (ipsChanged) {
        attendancePayload.company_ips = normalizedIps;
        if (normalizedIps.length === 0) attendancePayload.clear_ips = true;
      }

      const originalMethods = parseMethods(company?.attendance_methods || []);
      const methodsChanged = enabledMethods.length !== originalMethods.length || enabledMethods.some((method) => !originalMethods.includes(method));
      if (methodsChanged) attendancePayload.attendance_methods = normalizedMethods;

      const shouldUpdateBasic = Object.keys(basicPayload).length > 1;
      const shouldUpdateAttendance = Object.keys(attendancePayload).length > 1;
      if (!shouldUpdateBasic && !shouldUpdateAttendance) return;

      const updatedCompany = {};

      if (shouldUpdateBasic) {
        const response = await apiCall('/company/update-basic', 'PUT', basicPayload, company.id);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Basic information update failed');
        Object.assign(updatedCompany, basicPayload);
      }

      if (shouldUpdateAttendance) {
        const response = await apiCall('/company/update-attendance-settings', 'PUT', attendancePayload, company.id);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Attendance settings update failed');
        Object.assign(updatedCompany, attendancePayload);
        if (attendancePayload.clear_ips) updatedCompany.company_ips = [];
      }

      toast.success('Company updated successfully!');
      setCompany(prev => ({ ...prev, ...updatedCompany }));
      setOriginalData(prev => ({ ...prev, ...formData }));
      setLogoFile(null);
    } catch (error) {
      toast.error(error.message || 'Failed to update company');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndo = () => {
    setFormData({ ...originalData });
    setIps(parseIPs(company?.company_ips || []));
    setEnabledMethods(parseMethods(company?.attendance_methods || []));
    setLogoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
      setLogoPreview(null);
    }
  };

  const inputClass = "w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm";
  const disabledClass = "bg-gray-50 text-gray-400 cursor-not-allowed";

  // ---------- Method body with GPS max distance ----------
  const renderMethodBody = (methodItem) => {
    if (!methodItem) return null;
    const methodEnabled = enabledMethods.includes(methodItem.value);

    if (methodItem.value === 'ip') {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {ips.length > 0 ? ips.map((ip) => (
              <span key={ip} className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                {ip}
                <button type="button" onClick={() => removeIp(ip)} className="rounded-full p-0.5 text-indigo-400 transition hover:bg-indigo-100 hover:text-indigo-700">
                  <FaTimes size={10} />
                </button>
              </span>
            )) : <span className="text-sm text-gray-400">No IP restrictions configured</span>}
          </div>
          <div className="flex gap-3">
            <input value={ipInput} onChange={(e) => setIpInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIp(); } }} placeholder="Enter IP address" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
            <button type="button" onClick={addIp} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700">
              <FaPlus size={12} /> Add
            </button>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">Auto detect or clear IPs</p>
              <p className="text-xs text-gray-400">Auto detect stores the current request IP.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleAutoDetectIps} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100">Auto Detect</button>
              <button type="button" onClick={() => setIps([])} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50"><FaTrash className="mr-2 inline" size={10} />Clear</button>
            </div>
          </div>
        </div>
      );
    }

    if (methodItem.value === 'gps') {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">GPS attendance settings</p>
            <p className="mt-1 text-xs text-blue-700">
              Coordinates are managed in the <button onClick={() => setActiveTab('address')} className="underline font-medium">Address & Location</button> tab.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Max Distance (meters)</label>
            <input name="max_distance" value={formData.max_distance} onChange={handleChange} className={inputClass} placeholder="e.g., 50" />
            <p className="text-xs text-gray-400">Allowed radius from the company coordinates.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{methodItem.label}</p>
              <p className="mt-1 text-xs text-slate-600">{methodItem.description}</p>
            </div>
            <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${methodItem.isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
              {methodItem.isAvailable ? 'Available' : 'Unavailable'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoadingCompany) {
    return <div className="p-12 flex justify-center"><FaSpinner className="animate-spin text-indigo-500 text-3xl" /></div>;
  }

  if (!company) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-xl font-bold text-gray-800">Company not found</h2>
        <button onClick={() => navigate('/company-settings')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl">Back to Companies</button>
      </div>
    );
  }

  const fullAddress = [formData.address_line1, formData.address_line2, formData.city, formData.state, formData.postal_code, formData.country].filter(Boolean).join(', ');

  // ---------- Basic Information with improved logo upload ----------
  const renderBasicInformation = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
        <div className="p-2 bg-blue-50 text-blue-500 rounded-lg"><FaBuilding /></div>
        <h3 className="text-base font-bold text-gray-800">Basic Information</h3>
      </div>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Company Name</label>
          <input name="name" value={formData.name} onChange={handleChange} className={inputClass} placeholder="Company Name" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Legal Name</label>
          <input name="legal_name" value={formData.legal_name} onChange={handleChange} className={inputClass} placeholder="Legal Name" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">GST Number</label>
          <input name="gst_no" value={formData.gst_no} onChange={handleChange} className={inputClass} placeholder="GST Number" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Transaction Currency</label>
          <SelectField isLoading={loadingCurrencies} options={currencyOptions} value={currencyOptions.find(o => o.value === formData.transaction_currency) || null} onChange={handleCurrencyChange} placeholder="Select currency" />
        </div>

        {/* Logo section with custom upload button and larger preview */}
        <div className="md:col-span-2 space-y-2 pt-2">
          <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <FaLink className="text-indigo-400" /> Company Logo
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
            {/* Hidden real file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isUploadingLogo}
              className="hidden"
              id="logo-upload"
            />
            {/* Styled label as upload button */}
            <label
              htmlFor="logo-upload"
              className={`inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition cursor-pointer ${isUploadingLogo ? 'pointer-events-none opacity-60' : ''}`}
            >
              {isUploadingLogo ? <FaSpinner className="animate-spin" /> : <FaCamera size={14} />}
              {isUploadingLogo ? 'Uploading...' : (logoPreview || formData.logo_url) ? 'Change Logo' : 'Upload Logo'}
            </label>

            {/* Large preview image */}
            {(logoPreview || formData.logo_url) && (
              <div className="flex items-center gap-3">
                <img
                  src={logoPreview || formData.logo_url}
                  alt="Logo"
                  className="w-20 h-20 rounded-xl object-contain bg-white border border-gray-200 shadow-sm"
                />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
                  title="Remove Logo"
                >
                  <FaTrash size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ---------- Address section (unchanged) ----------
  const renderAddress = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
        <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg"><FaMapMarkerAlt /></div>
        <h3 className="text-base font-bold text-gray-800">Address & Location Details</h3>
      </div>
      <div className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="addressMode" value="auto" checked={addressMode === 'auto'} onChange={() => handleAddressModeChange('auto')} className="text-indigo-600 w-4 h-4" />
              <span className="text-sm text-indigo-900 font-semibold">Auto-detect Location</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="addressMode" value="manual" checked={addressMode === 'manual'} onChange={() => handleAddressModeChange('manual')} className="text-indigo-600 w-4 h-4" />
              <span className="text-sm text-indigo-900 font-semibold">Manual Entry</span>
            </label>
          </div>
          {isGeocoding && <span className="text-xs font-bold text-indigo-600 bg-white px-3 py-1.5 rounded-full shadow-sm flex items-center gap-2"><FaSpinner className="animate-spin" /> Detecting...</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><FaRoad className="text-gray-400" /> Address Line 1</label>
            <input name="address_line1" value={formData.address_line1} onChange={handleChange} disabled={addressMode === 'auto' && !isAddressAutoDetected} className={`${inputClass} ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} placeholder="Street, building, etc." />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><FaRoad className="text-gray-400" /> Address Line 2</label>
            <input name="address_line2" value={formData.address_line2} onChange={handleChange} disabled={addressMode === 'auto' && !isAddressAutoDetected} className={`${inputClass} ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} placeholder="Suite, apartment, etc." />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><FaCity className="text-gray-400" /> City</label>
            <input name="city" value={formData.city} onChange={handleChange} disabled={addressMode === 'auto' && !isAddressAutoDetected} className={`${inputClass} ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} placeholder="City" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><FaGlobe className="text-gray-400" /> State</label>
            <input name="state" value={formData.state} onChange={handleChange} disabled={addressMode === 'auto' && !isAddressAutoDetected} className={`${inputClass} ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} placeholder="State" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><FaEnvelope className="text-gray-400" /> Postal Code</label>
            <input name="postal_code" value={formData.postal_code} onChange={handleChange} disabled={addressMode === 'auto' && !isAddressAutoDetected} className={`${inputClass} ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} placeholder="Postal Code" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><FaGlobe className="text-gray-400" /> Country</label>
            <input name="country" value={formData.country} onChange={handleChange} disabled={addressMode === 'auto' && !isAddressAutoDetected} className={`${inputClass} ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} placeholder="Country" />
          </div>
          <div className="md:col-span-2 pt-4 mt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-800 flex items-center gap-2"><FaCrosshairs className="text-indigo-500" /> GPS Coordinates</p>
              {addressMode === 'manual' && (
                <button type="button" onClick={handleManualGeocode} disabled={isGeocoding} className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                  {isGeocoding ? <FaSpinner className="animate-spin" /> : <FaMapPin />} Get from Address
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Latitude</label>
                <input name="latitude" value={formData.latitude} onChange={handleChange} disabled={addressMode === 'auto' && !isAddressAutoDetected} className={`${inputClass} font-mono text-xs ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} placeholder="Latitude" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Longitude</label>
                <input name="longitude" value={formData.longitude} onChange={handleChange} disabled={addressMode === 'auto' && !isAddressAutoDetected} className={`${inputClass} font-mono text-xs ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} placeholder="Longitude" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ---------- Attendance section (unchanged) ----------
  const renderAttendance = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 text-purple-500 rounded-lg"><FaUserCheck /></div>
          <h3 className="text-base font-bold text-gray-800">Attendance Config</h3>
        </div>
        <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-lg">{enabledMethods.length} Active</span>
      </div>
      <div className="p-0">
        {loadingMethods ? (
          <div className="p-8 flex justify-center"><FaSpinner className="animate-spin text-purple-500 text-2xl" /></div>
        ) : (
          <div className="flex flex-col">
            {availableMethods.map((tab) => {
              const isActive = activeMethod === tab.value;
              const isEnabled = enabledMethods.includes(tab.value);
              return (
                <div key={tab.value} className="border-b border-gray-100 last:border-0">
                  <MethodTabButton tab={tab} active={isActive} enabled={isEnabled} disabled={!tab.isAvailable} onClick={() => setActiveMethod(isActive ? null : tab.value)} onExpand={() => setActiveMethod(tab.value)} onToggle={() => toggleMethod(tab.value)} />
                  <AnimatePresence initial={false}>
                    {isActive && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="bg-gray-50/50 p-4 border-t border-gray-100">
                          {renderMethodBody(tab)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 relative pb-20">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-4 px-5 pt-4 pb-3">
          <div className="h-14 w-14 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
            {formData.logo_url ? (
              <img src={formData.logo_url} alt="Logo" className="h-full w-full object-contain bg-white" />
            ) : (
              <FaBuilding className="text-2xl text-indigo-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-slate-900 truncate">{formData.name || company.name || 'Company'}</h1>
            <p className="text-xs text-slate-500 truncate">{formData.legal_name || company.legal_name || 'No legal name'}</p>
          </div>
          <RefreshButton loading={isRefreshingCompany} onClick={handleRefreshCompany} className="hidden sm:inline-flex text-xs" />
          <button onClick={handleRefreshCompany} disabled={isRefreshingCompany} className="sm:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            {isRefreshingCompany ? <FaSpinner className="animate-spin" /> : <FaUndo size={14} />}
          </button>
        </div>

        <div className="px-5 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-500 min-w-0">
            <p className="flex items-center gap-1.5 min-w-0">
              <FaMapMarkerAlt size={10} className="shrink-0 text-indigo-400" />
              <span className="truncate">{fullAddress || 'Address not provided'}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <FaGlobe size={10} className="shrink-0 text-emerald-400" />
              <span className="font-semibold">
                {formData.transaction_currency ? (
                  <span className="uppercase">{formData.transaction_currency}</span>
                ) : (
                  'Not set'
                )}
              </span>
            </p>
            <p className="flex items-center gap-1.5">
              <FaUserCheck size={10} className="shrink-0 text-purple-400" />
              <span>{enabledMethods.length} attendance methods</span>
            </p>
          </div>
          <RefreshButton loading={isRefreshingCompany} onClick={handleRefreshCompany} className="sm:hidden w-full text-xs" />
        </div>

        <div className="flex items-center gap-1 px-4 overflow-x-auto scrollbar-none">
          {COMPANY_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "inline-flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium",
                  "border-b-2 whitespace-nowrap transition-colors duration-150 -mb-px",
                  isActive ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300",
                ].join(" ")}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </motion.div>

      <div className="px-1 lg:px-0">
        {activeTab === 'basic' && renderBasicInformation()}
        {activeTab === 'address' && renderAddress()}
        {activeTab === 'attendance' && renderAttendance()}
      </div>

      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed bottom-4 left-4 right-4 sm:bottom-8 sm:left-auto sm:right-8 z-50 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 bg-white p-3 sm:p-4 rounded-2xl shadow-2xl border border-indigo-100"
          >
            <div className="hidden md:block pr-2 border-r border-gray-100">
              <p className="text-sm font-bold text-gray-800">Unsaved Changes</p>
              <p className="text-xs text-gray-500">You have modified company details</p>
            </div>
            <div className="flex w-full sm:w-auto gap-2 sm:gap-3">
              <button
                onClick={handleUndo}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm"
              >
                <FaUndo />
                <span>Undo</span>
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 text-sm"
              >
                {isSubmitting ? <FaSpinner className="animate-spin" /> : <FaSave />}
                <span>Save</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}