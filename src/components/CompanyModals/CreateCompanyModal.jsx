import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import apiCall, { uploadFile } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { getPreciseLocation } from "../../utils/geolocation";

import {
  FaBuilding, FaTimes, FaCheck, FaSpinner,
  FaMapMarkerAlt, FaGlobe, FaCity, FaRoad,
  FaEnvelope, FaLink, FaMapPin, FaCrosshairs,
  FaEye, FaTrash, FaChevronDown
} from "react-icons/fa";
import ModalScrollLock from "../ModalScrollLock";

const GEOCODING_API = "https://nominatim.openstreetmap.org/search";

const INITIAL_FORM = (userId) => ({
  owner_user_id: userId,
  name: "",
  legal_name: "",
  logo_url: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "India",
  latitude: "",
  longitude: ""
});


// Collapsible Section Component
function CollapsibleSection({ title, icon, children, defaultOpen = false, badge = null }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="md:col-span-2 border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-indigo-500">{icon}</span>
          <span className="text-sm font-semibold text-gray-700">{title}</span>
          {badge && (
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700 font-medium">
              {badge}
            </span>
          )}
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <FaChevronDown className="w-4 h-4 text-gray-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="p-4 bg-white space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateCompanyModal({ isOpen, onClose, onSuccess, userId, onCompanyCreated }) {
  const { refreshUser, selectCompany } = useAuth();
  const [companyForm, setCompanyForm] = useState(INITIAL_FORM(userId));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [addressMode, setAddressMode] = useState('manual');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isAddressAutoDetected, setIsAddressAutoDetected] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);


  // Reset entire form whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setCompanyForm(INITIAL_FORM(userId));
      setAddressMode('manual');
      setIsGeocoding(false);
      setShowPreview(false);
      setLogoFile(null);
      setLogoPreview(null);
      setIsAddressAutoDetected(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (userId) setCompanyForm(prev => ({ ...prev, owner_user_id: userId }));
  }, [userId]);

  useEffect(() => {
    return () => { if (logoPreview) URL.revokeObjectURL(logoPreview); };
  }, [logoPreview]);

  const handleAddressModeChange = async (mode) => {
    if (mode === 'manual') {
      setAddressMode('manual');
      setIsAddressAutoDetected(false);
      return;
    }
    setIsGeocoding(true);
    try {
      const position = await getPreciseLocation({ fetchAddress: true });
      setAddressMode('auto');
      const formUpdate = {
        latitude: position.latitude.toString(),
        longitude: position.longitude.toString()
      };
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
      setCompanyForm(prev => ({ ...prev, ...formUpdate }));
    } catch (error) {
      setAddressMode('manual');
      toast.info((error.message || "Unable to get current location.") + " Please use manual address entry.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleManualGeocode = async () => {
    const addressString = [
      companyForm.address_line1, companyForm.city,
      companyForm.state, companyForm.postal_code, companyForm.country
    ].filter(Boolean).join(", ");
    if (addressString.split(", ").length < 2) {
      toast.warning("Please enter at least address line and city to get coordinates");
      return;
    }
    setIsGeocoding(true);
    try {
      const params = new URLSearchParams({ q: addressString, format: 'json', limit: 1, addressdetails: 1 });
      const response = await fetch(`${GEOCODING_API}?${params}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'AttendanceApp/1.0' }
      });
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setCompanyForm(prev => ({ ...prev, latitude: lat, longitude: lon }));
        toast.success("📍 Location coordinates found!");
      } else {
        toast.warning("Could not find coordinates for this address");
      }
    } catch (error) {
      toast.error("Failed to get coordinates");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploadingLogo(true);
      try {
        const url = await uploadFile(file);
        setCompanyForm(prev => ({ ...prev, logo_url: url }));
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
    setLogoPreview(null);
    setCompanyForm(prev => ({ ...prev, logo_url: "" }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCompanyForm(prev => ({ ...prev, [name]: value }));
    if (addressMode === 'auto' && !isAddressAutoDetected) {
      setAddressMode('manual');
      setIsAddressAutoDetected(false);
    }
  };

  const handleSubmit = async () => {
    if (!companyForm.name || !companyForm.legal_name) {
      toast.error("Company name and legal name are required");
      return;
    }
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) { toast.error("Authentication expired. Please login again."); return; }
      const payload = { ...companyForm };
      const res = await apiCall('/company/create', 'POST', payload);
      const result = await res.json();
      if (!result.success) { toast.error(result.message || "Failed to create company"); return; }
      const createdCompany = result.data?.company || result.company || result.data;
      if (createdCompany?.id) {
        selectCompany?.(createdCompany);
      } else {
        localStorage.removeItem("company");
      }
      await refreshUser?.();
      if (onCompanyCreated) await onCompanyCreated();
      toast.success(result.message || "Company created successfully 🎉");
      onSuccess?.(createdCompany);
      handleClose();
    } catch (error) {
      toast.error("Network error. Please check your internet connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCompanyForm(INITIAL_FORM(userId));
    setAddressMode('manual');
    setIsGeocoding(false);
    setShowPreview(false);
    setLogoFile(null);
    setLogoPreview(null);
    setIsAddressAutoDetected(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const inputClass = "w-full border border-gray-200 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm";
  const disabledClass = "bg-gray-50 text-gray-400 cursor-not-allowed";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 px-4 sm:px-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <ModalScrollLock />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white relative w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl border border-gray-100 m-auto flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {isGeocoding && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/75 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-indigo-100 bg-white px-6 py-5 shadow-xl">
                  <FaSpinner className="h-7 w-7 animate-spin text-indigo-600" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-800">Fetching geo location...</p>
                    <p className="mt-1 text-xs text-gray-400">Please wait until the location request finishes.</p>
                  </div>
                </div>
              </div>
            )}
            {/* Sticky Header */}
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-gray-100 bg-white z-10 flex-shrink-0">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <FaBuilding className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Create New Company</h2>
                <p className="text-xs text-gray-400 mt-0.5">Fill in the details to register your company</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ml-auto w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* ── Basic Information ── */}
                <div className="md:col-span-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <FaBuilding className="w-3 h-3" /> Basic Information
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="name"
                    placeholder="e.g., Tech Corp"
                    value={companyForm.name}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    Legal Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="legal_name"
                    placeholder="e.g., Tech Corporation Pvt Ltd"
                    value={companyForm.legal_name}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                {/* Company Logo */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <FaLink className="w-3 h-3 text-indigo-500" /> Company Logo
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={isUploadingLogo}
                      className="flex-1 border border-gray-200 p-2 rounded-xl text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
                    />
                    {isUploadingLogo && <FaSpinner className="w-5 h-5 text-indigo-600 animate-spin flex-shrink-0" />}
                    {logoPreview && !isUploadingLogo && (
                      <>
                        <button type="button" onClick={() => setShowPreview(!showPreview)}
                          className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors" title="Preview">
                          <FaEye className="w-4 h-4 text-gray-600" />
                        </button>
                        <button type="button" onClick={handleRemoveLogo}
                          className="p-2 rounded-xl bg-red-50 hover:bg-red-100 transition-colors" title="Remove">
                          <FaTrash className="w-4 h-4 text-red-500" />
                        </button>
                      </>
                    )}
                  </div>
                  {logoPreview && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <img src={logoPreview} alt="Logo" className="w-14 h-14 rounded-lg object-cover bg-white border border-gray-200" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{logoFile?.name}</p>
                        {logoFile?.size && <p className="text-xs text-gray-400">{(logoFile.size / 1024).toFixed(2)} KB</p>}
                      </div>
                    </div>
                  )}
                </div>


                {/* ── Address Information (Collapsible) ── */}
                <CollapsibleSection
                  title="Address Information"
                  icon={<FaMapMarkerAlt className="w-4 h-4" />}
                >
                  {/* Mode Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="addressMode" value="auto"
                          checked={addressMode === 'auto'} onChange={() => handleAddressModeChange('auto')}
                          className="text-indigo-600 w-3.5 h-3.5" />
                        <span className="text-xs text-gray-700 font-medium">Auto-detect</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="addressMode" value="manual"
                          checked={addressMode === 'manual'} onChange={() => handleAddressModeChange('manual')}
                          className="text-indigo-600 w-3.5 h-3.5" />
                        <span className="text-xs text-gray-700 font-medium">Manual Entry</span>
                      </label>
                    </div>
                    {isGeocoding && (
                      <span className="text-xs text-indigo-500 flex items-center gap-1">
                        <FaSpinner className="w-3 h-3 animate-spin" /> Detecting...
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <FaRoad className="w-3 h-3 text-indigo-400" /> Address Line 1
                      </label>
                      <input name="address_line1" placeholder="Street address, P.O. box"
                        value={companyForm.address_line1} onChange={handleChange}
                        disabled={addressMode === 'auto' && !isAddressAutoDetected}
                        className={`${inputClass} ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <FaRoad className="w-3 h-3 text-indigo-400" /> Address Line 2
                      </label>
                      <input name="address_line2" placeholder="Apartment, suite, unit, etc."
                        value={companyForm.address_line2} onChange={handleChange}
                        disabled={addressMode === 'auto' && !isAddressAutoDetected}
                        className={`${inputClass} ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <FaCity className="w-3 h-3 text-indigo-400" /> City
                      </label>
                      <input name="city" placeholder="City" value={companyForm.city} onChange={handleChange}
                        disabled={addressMode === 'auto' && !isAddressAutoDetected}
                        className={`${inputClass} ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <FaGlobe className="w-3 h-3 text-indigo-400" /> State
                      </label>
                      <input name="state" placeholder="State" value={companyForm.state} onChange={handleChange}
                        disabled={addressMode === 'auto' && !isAddressAutoDetected}
                        className={`${inputClass} ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <FaEnvelope className="w-3 h-3 text-indigo-400" /> Postal Code
                      </label>
                      <input name="postal_code" placeholder="Postal Code" value={companyForm.postal_code} onChange={handleChange}
                        disabled={addressMode === 'auto' && !isAddressAutoDetected}
                        className={`${inputClass} ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <FaGlobe className="w-3 h-3 text-indigo-400" /> Country
                      </label>
                      <input name="country" value={companyForm.country} onChange={handleChange}
                        disabled={addressMode === 'auto' && !isAddressAutoDetected}
                        className={`${inputClass} ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} />
                    </div>
                  </div>

                  {/* Coordinates */}
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <FaMapPin className="w-3 h-3" /> Coordinates
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                          <FaCrosshairs className="w-3 h-3 text-indigo-400" /> Latitude
                        </label>
                        <div className="relative">
                          <input name="latitude" placeholder="Latitude" value={companyForm.latitude} onChange={handleChange}
                            disabled={addressMode === 'auto' && !isAddressAutoDetected}
                            className={`${inputClass} pr-8 ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} />
                          {companyForm.latitude && <FaCheck className="absolute right-3 top-3 w-3.5 h-3.5 text-green-500" />}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                          <FaCrosshairs className="w-3 h-3 text-indigo-400" /> Longitude
                        </label>
                        <div className="relative">
                          <input name="longitude" placeholder="Longitude" value={companyForm.longitude} onChange={handleChange}
                            disabled={addressMode === 'auto' && !isAddressAutoDetected}
                            className={`${inputClass} pr-8 ${(addressMode === 'auto' && !isAddressAutoDetected) ? disabledClass : ''}`} />
                          {companyForm.longitude && <FaCheck className="absolute right-3 top-3 w-3.5 h-3.5 text-green-500" />}
                        </div>
                      </div>
                    </div>
                    {addressMode === 'manual' && (
                      <button type="button" onClick={handleManualGeocode} disabled={isGeocoding}
                        className="mt-3 w-full py-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                        {isGeocoding
                          ? <><FaSpinner className="w-4 h-4 animate-spin" /> Getting Coordinates...</>
                          : <><FaMapPin className="w-4 h-4" /> Get Coordinates from Address</>}
                      </button>
                    )}
                  </div>
                </CollapsibleSection>

              </div>
            </div>

            {/* Sticky Footer */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-white flex-shrink-0">
              <button onClick={handleClose} disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isSubmitting
                  ? <><FaSpinner className="w-4 h-4 animate-spin" /> Creating...</>
                  : <><FaCheck className="w-4 h-4" /> Create Company</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Logo Preview Overlay */}
      {showPreview && logoPreview && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
          onClick={() => setShowPreview(false)}
        >
          <div className="relative bg-white rounded-xl p-4 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowPreview(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100">
              <FaTimes className="w-4 h-4 text-gray-600" />
            </button>
            <img src={logoPreview} alt="Logo Preview" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CreateCompanyModal;
