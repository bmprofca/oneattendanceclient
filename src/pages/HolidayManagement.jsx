import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import apiCall from '../utils/api';
import usePermissionAccess from '../hooks/usePermissionAccess';
import { FaUmbrellaBeach } from 'react-icons/fa';
import { ManagementHub } from '../components/common';
import Modal from '../components/Modal';

// ==================== ICONS ====================
const Icon = {
  ChevronLeft: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-4 h-4">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  ),
  Spinner: () => (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  ),
  Dots: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Star: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  ),
  Info: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  Eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Building: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  ),
};

// ==================== CACHE ====================
const MASTER_HOLIDAY_CACHE_TTL = 5 * 60 * 1000;
const COMPANY_HOLIDAY_CACHE_TTL = 30 * 1000;
const masterHolidayRequestCache = new Map();
const companyHolidayRequestCache = new Map();

const getMasterHolidayCacheKey = (year, month) => `${year}-${month}`;
const getCompanyHolidayCacheKey = (companyId) => `${companyId ?? 'none'}`;

const getCachedHolidayRequest = (cache, key) => {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.data && cached.expiresAt > Date.now()) return { type: 'data', value: cached.data };
  if (cached.promise) return { type: 'promise', value: cached.promise };
  cache.delete(key);
  return null;
};

const clearCompanyHolidayRequestCache = () => { companyHolidayRequestCache.clear(); };
const clearAllHolidayCaches = () => { masterHolidayRequestCache.clear(); companyHolidayRequestCache.clear(); };

// ==================== API SERVICE ====================
const holidayService = {
  getMasterHolidays: async (year, month) => {
    const cacheKey = getMasterHolidayCacheKey(year, month);
    const cached = getCachedHolidayRequest(masterHolidayRequestCache, cacheKey);
    if (cached?.type === 'data') return cached.value;
    if (cached?.type === 'promise') return cached.value;
    try {
      const requestPromise = (async () => {
        const response = await apiCall(`/holiday/master-holidays?year=${year}&month=${month}`, 'GET');
        const data = await response.json();
        const holidays = data.success ? data.data : [];
        masterHolidayRequestCache.set(cacheKey, { data: holidays, expiresAt: Date.now() + MASTER_HOLIDAY_CACHE_TTL });
        return holidays;
      })().catch((error) => { masterHolidayRequestCache.delete(cacheKey); throw error; });
      masterHolidayRequestCache.set(cacheKey, { promise: requestPromise });
      return await requestPromise;
    } catch (error) { console.error('Failed to fetch master holidays:', error); return []; }
  },
  getCompanyHolidays: async (companyId) => {
    if (!companyId) return [];
    const cacheKey = getCompanyHolidayCacheKey(companyId);
    const cached = getCachedHolidayRequest(companyHolidayRequestCache, cacheKey);
    if (cached?.type === 'data') return cached.value;
    if (cached?.type === 'promise') return cached.value;
    try {
      const requestPromise = (async () => {
        const response = await apiCall('/holiday/company/list', 'GET', null, companyId);
        const data = await response.json();
        const holidays = data.success ? data.data : [];
        companyHolidayRequestCache.set(cacheKey, { data: holidays, expiresAt: Date.now() + COMPANY_HOLIDAY_CACHE_TTL });
        return holidays;
      })().catch((error) => { companyHolidayRequestCache.delete(cacheKey); throw error; });
      companyHolidayRequestCache.set(cacheKey, { promise: requestPromise });
      return await requestPromise;
    } catch (error) { console.error('Failed to fetch company holidays:', error); return []; }
  },
  createHoliday: async (payload, companyId) => {
    try {
      const response = await apiCall('/holiday/create', 'POST', payload, companyId);
      clearCompanyHolidayRequestCache();
      return await response.json();
    } catch (error) { return { success: false, error: 'Internal Server Error' }; }
  },
  updateHoliday: async (payload, companyId) => {
    try {
      const response = await apiCall('/holiday/update', 'PUT', payload, companyId);
      clearCompanyHolidayRequestCache();
      return await response.json();
    } catch (error) { return { success: false, error: 'Internal Server Error' }; }
  },
  deleteHoliday: async (id, companyId) => {
    try {
      const response = await apiCall('/holiday/delete', 'DELETE', { id }, companyId);
      clearCompanyHolidayRequestCache();
      return await response.json();
    } catch (error) { return { success: false, error: 'Internal Server Error' }; }
  }
};

// ==================== HELPERS ====================
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const toCalendarDate = (value) => {
  if (value instanceof Date && !isNaN(value.getTime())) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return null;
};

const formatDate = (date) => {
  const d = toCalendarDate(date);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isSameDay = (a, b) => {
  const left = toCalendarDate(a);
  const right = toCalendarDate(b);
  if (!left || !right) return false;
  return left.getTime() === right.getTime();
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Holiday display configs ───────────────────────────────────────────────
const COMPANY_HOLIDAY_CONFIG = {
  mandatory: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-500',
    text: 'text-red-700',
    badgeBg: 'bg-red-100 text-red-700',
    badge: 'Mandatory',
  },
  optional: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    dot: 'bg-yellow-500',
    text: 'text-yellow-700',
    badgeBg: 'bg-yellow-100 text-yellow-800',
    badge: 'Optional',
  },
};

const getCompanyHolidayConfig = (holiday) => {
  if (!holiday || holiday.source !== 'company') return null;
  return holiday.is_optional === 1 ? COMPANY_HOLIDAY_CONFIG.optional : COMPANY_HOLIDAY_CONFIG.mandatory;
};

// ==================== CREATE HOLIDAY MODAL ====================
const CreateHolidayModal = ({ selectedDates, onClose, onCreateSuccess, initialName, masterHolidays = [], submitDisabled = false, submitTitle = '' }) => {
  const [name, setName] = useState(initialName || '');
  const [isOptional, setIsOptional] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    setTimeout(() => inputRef.current?.focus(), 300);
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Holiday name is required'); return; }
    setLoading(true);
    const company = JSON.parse(localStorage.getItem('company') || '{}');
    const results = await Promise.all(selectedDates.map(date =>
      holidayService.createHoliday({ name: name.trim(), date: formatDate(date), is_optional: isOptional ? 1 : 0, company_id: company?.id }, company?.id)
    ));
    const ok = results.filter(r => r.success).length;
    if (ok > 0) { toast.success(`${ok} holiday${ok > 1 ? 's' : ''} added!`); onCreateSuccess(); onClose(); }
    else toast.error('Failed to add holiday');
    setLoading(false);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Add Holiday"
      subtitle={selectedDates.length === 1 ? formatDate(selectedDates[0]) : `${selectedDates.length} dates selected`}
      icon={<Icon.Calendar />}
      size="md"
      footer={
        <button
          type="submit"
          form="create-holiday-form"
          disabled={loading || submitDisabled}
          title={submitDisabled ? submitTitle : ''}
          className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-violet-600 hover:bg-violet-700 active:scale-[0.98] transition-all shadow-lg shadow-violet-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? <><Icon.Spinner /> Adding…</> : <><Icon.Plus /> Add Holiday{selectedDates.length > 1 ? 's' : ''}</>}
        </button>
      }
    >
      <form id="create-holiday-form" onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Holiday Name</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Diwali, Republic Day…"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent focus:bg-white transition-all"
          />
        </div>

        {/* Quick‑fill pills – now below the input */}
        {masterHolidays.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              Quick Fill (National Holidays)
            </label>
            <div className="flex flex-wrap gap-2">
              {masterHolidays.map((mh, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setName(mh.name)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                  title={`${mh.name}${mh.type ? ' – ' + mh.type : ''}`}
                >
                  {mh.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50 cursor-pointer hover:bg-yellow-50 hover:border-yellow-200 transition-all group">
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${isOptional ? 'bg-yellow-400 border-yellow-400' : 'border-gray-300 group-hover:border-yellow-400'}`}>
            {isOptional && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><polyline points="20 6 9 17 4 12" /></svg>}
          </div>
          <input type="checkbox" checked={isOptional} onChange={e => setIsOptional(e.target.checked)} className="sr-only" />
          <div>
            <p className="text-sm font-semibold text-gray-800">Mark as Optional</p>
            <p className="text-xs text-gray-500 mt-0.5">Employees can choose whether to observe this day</p>
          </div>
          {isOptional && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-bold uppercase tracking-wide">
              Optional
            </span>
          )}
        </label>
      </form>
    </Modal>
  );
};

// ==================== UPDATE HOLIDAY MODAL ====================
const UpdateHolidayModal = ({ holiday, onClose, onUpdateSuccess, submitDisabled = false, submitTitle = '' }) => {
  const [name, setName] = useState(holiday.name || '');
  const [isOptional, setIsOptional] = useState(holiday.is_optional === 1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Holiday name is required'); return; }
    setLoading(true);
    const company = JSON.parse(localStorage.getItem('company') || '{}');
    const result = await holidayService.updateHoliday({ id: holiday.id, name: name.trim(), date: holiday.date, is_optional: isOptional ? 1 : 0 }, company?.id);
    if (result.success) { toast.success('Holiday updated!'); onUpdateSuccess(); onClose(); }
    else toast.error(result.error || 'Failed to update holiday');
    setLoading(false);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Edit Holiday"
      subtitle={holiday.date}
      icon={<Icon.Edit />}
      size="md"
      footer={
        <button
          type="submit"
          form="update-holiday-form"
          disabled={loading || submitDisabled}
          title={submitDisabled ? submitTitle : ''}
          className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-violet-600 hover:bg-violet-700 active:scale-[0.98] transition-all shadow-lg shadow-violet-200 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? <><Icon.Spinner /> Saving…</> : <><Icon.Check /> Save Changes</>}
        </button>
      }
    >
      <form id="update-holiday-form" onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Holiday Name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent focus:bg-white transition-all"
          />
        </div>

        <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50 cursor-pointer hover:bg-yellow-50 hover:border-yellow-200 transition-all group">
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${isOptional ? 'bg-yellow-400 border-yellow-400' : 'border-gray-300 group-hover:border-yellow-400'}`}>
            {isOptional && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><polyline points="20 6 9 17 4 12" /></svg>}
          </div>
          <input type="checkbox" checked={isOptional} onChange={e => setIsOptional(e.target.checked)} className="sr-only" />
          <div>
            <p className="text-sm font-semibold text-gray-800">Mark as Optional</p>
            <p className="text-xs text-gray-500 mt-0.5">Employees can choose whether to observe this day</p>
          </div>
          {isOptional && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-bold uppercase tracking-wide">
              Optional
            </span>
          )}
        </label>
      </form>
    </Modal>
  );
};

// ==================== DELETE CONFIRMATION MODAL ====================
const DeleteModal = ({ holiday, onClose, onDeleteSuccess, submitDisabled = false, submitTitle = '' }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleDelete = async () => {
    setLoading(true);
    const company = JSON.parse(localStorage.getItem('company') || '{}');
    const result = await holidayService.deleteHoliday(holiday.id, company?.id);
    if (result.success) { toast.success('Holiday removed'); onDeleteSuccess(); onClose(); }
    else toast.error(result.error || 'Failed to delete');
    setLoading(false);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Remove Holiday?"
      subtitle={`${holiday.name} · ${holiday.date}`}
      icon={<Icon.Trash />}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-semibold text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading || submitDisabled}
            title={submitDisabled ? submitTitle : ''}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-red-500 hover:bg-red-600 active:scale-[0.98] transition-all shadow-lg shadow-red-100 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <><Icon.Spinner /> Removing…</> : 'Remove'}
          </button>
        </>
      }
    >
      <div className="text-center space-y-4">
        <p className="text-sm text-gray-500 leading-relaxed">
          You're about to remove <span className="font-bold text-gray-800">"{holiday.name}"</span> from the calendar. This cannot be undone.
        </p>
      </div>
    </Modal>
  );
};

// ==================== VIEW DATE HOLIDAYS MODAL ====================
const ViewDateHolidaysModal = ({ date, holidays, onClose, onEdit, onDelete, editDisabled, deleteDisabled, editMessage, deleteMessage }) => {
  const companyHolidays = holidays.filter(h => h.source === 'company');
  const masterHolidays = holidays.filter(h => h.source === 'master');

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={formatDate(date)}
      subtitle={`${holidays.length} holiday${holidays.length !== 1 ? 's' : ''}`}
      icon={<Icon.Eye />}
      size="md"
      footer={
        <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-semibold text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all">
          Close
        </button>
      }
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {companyHolidays.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
              <Icon.Building /> Company Holidays
            </h4>
            {companyHolidays.map(hol => {
              const config = getCompanyHolidayConfig(hol);
              return (
                <div key={hol.id} className={`flex items-center gap-3 p-3 rounded-xl border mb-2 ${config.bg} ${config.border}`}>
                  <div className={`w-2 h-2 rounded-full ${config.dot} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${config.text}`}>{hol.name}</p>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${config.badgeBg}`}>{config.badge}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { onClose(); onEdit(hol); }}
                      disabled={editDisabled}
                      title={editDisabled ? editMessage : 'Edit'}
                      className="p-1.5 rounded-lg hover:bg-white/60 text-gray-500 disabled:opacity-40"
                    >
                      <Icon.Edit />
                    </button>
                    <button
                      onClick={() => { onClose(); onDelete(hol); }}
                      disabled={deleteDisabled}
                      title={deleteDisabled ? deleteMessage : 'Delete'}
                      className="p-1.5 rounded-lg hover:bg-white/60 text-red-500 disabled:opacity-40"
                    >
                      <Icon.Trash />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {masterHolidays.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
              <Icon.Star /> National Holidays
            </h4>
            {masterHolidays.map((hol, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-blue-50/50 mb-1">
                <Icon.Star />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-blue-800">{hol.name}</p>
                  {hol.type && <p className="text-[10px] text-blue-500">{hol.type}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

// ==================== ACTION MENU ====================
const ActionMenu = ({ date, holidays, companyHoliday, onAction, onClose, onView, createDisabled, updateDisabled, deleteDisabled, createMessage, updateMessage, deleteMessage }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const canCreate = !companyHoliday;
  const isCompany = !!companyHoliday;

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.92, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -4 }}
      transition={{ duration: 0.12 }}
      className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden py-1"
      onClick={e => e.stopPropagation()}
    >
      {holidays.length > 0 && (
        <button
          onClick={() => { onView(date, holidays); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors"
        >
          <span className="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0">
            <Icon.Eye />
          </span>
          View Details
        </button>
      )}
      {canCreate && (
        <button
          onClick={() => { onAction(date, holidays, 'create'); onClose(); }}
          disabled={createDisabled}
          title={createDisabled ? createMessage : ''}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0">
            <Icon.Plus />
          </span>
          Add Holiday
        </button>
      )}
      {isCompany && (
        <>
          <button
            onClick={() => { onAction(date, companyHoliday, 'update'); onClose(); }}
            disabled={updateDisabled}
            title={updateDisabled ? updateMessage : ''}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Icon.Edit />
            </span>
            Edit Holiday
          </button>
          <div className="mx-3 h-px bg-gray-100" />
          <button
            onClick={() => { onAction(date, companyHoliday, 'delete'); onClose(); }}
            disabled={deleteDisabled}
            title={deleteDisabled ? deleteMessage : ''}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="w-7 h-7 rounded-lg bg-red-100 text-red-500 flex items-center justify-center flex-shrink-0">
              <Icon.Trash />
            </span>
            Remove Holiday
          </button>
        </>
      )}
    </motion.div>
  );
};

// ==================== MASTER HOLIDAY INDICATOR ====================
const MasterHolidayIndicator = ({ holiday }) => {
  const isObservance = holiday.type === 'Observance';
  const color = isObservance ? 'text-amber-500' : 'text-blue-400';

  return (
    <div className={`flex items-center gap-1 mt-1 ${color}`} title={`${holiday.name}${isObservance ? ' (Observance)' : ''}`}>
      <Icon.Star />
      <span className="text-[9px] sm:text-[10px] font-medium truncate leading-tight opacity-80">
        {holiday.name}
      </span>
    </div>
  );
};

// ==================== CALENDAR CELL ====================
const CalendarCell = ({
  date, dayNumber, isCurrentMonth, isToday,
  holidays, onAction, onMonthNavigate, onViewDate,
  createDisabled, updateDisabled, deleteDisabled,
  createMessage, updateMessage, deleteMessage,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const companyHoliday = holidays.find(h => h.source === 'company') || null;
  const primaryHoliday = companyHoliday || holidays[0]; // company first
  const config = companyHoliday ? getCompanyHolidayConfig(companyHoliday) : null;
  const extraCount = holidays.length - 1;

  const handleCellClick = () => {
    if (isCurrentMonth && holidays.length > 0) {
      onViewDate(date, holidays);
    } else if (!isCurrentMonth) {
      onMonthNavigate(date);
    }
  };

  return (
    <div
      onClick={handleCellClick}
      className={[
        'relative min-h-[80px] sm:min-h-[100px] p-2 sm:p-2.5 flex flex-col border-r border-b border-gray-100 transition-colors cursor-pointer group',
        !isCurrentMonth ? 'bg-gray-50/60' : 'bg-white',
        isToday ? 'ring-2 ring-inset ring-violet-400 z-10' : '',
        companyHoliday && isCurrentMonth ? config.bg : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Row: day number + action trigger */}
      <div className="flex items-center justify-between">
        <span className={[
          'text-xs sm:text-sm font-semibold leading-none',
          !isCurrentMonth ? 'text-gray-300' : isToday ? 'text-white' : 'text-gray-700',
          isToday ? 'w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold' : '',
        ].filter(Boolean).join(' ')}>
          {dayNumber}
        </span>

        {isCurrentMonth && (
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(p => !p); }}
              className={`p-1 rounded-lg transition-colors text-gray-400 hover:text-gray-600 hover:bg-gray-100/80
                ${menuOpen ? 'opacity-100 bg-gray-200' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
            >
              <Icon.Dots />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <ActionMenu
                  date={date}
                  holidays={holidays}
                  companyHoliday={companyHoliday}
                  onAction={onAction}
                  onView={onViewDate}
                  onClose={() => setMenuOpen(false)}
                  createDisabled={createDisabled}
                  updateDisabled={updateDisabled}
                  deleteDisabled={deleteDisabled}
                  createMessage={createMessage}
                  updateMessage={updateMessage}
                  deleteMessage={deleteMessage}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Primary holiday display ── */}
      {primaryHoliday && isCurrentMonth && (
        <>
          {companyHoliday ? (
            <div className="flex-1 mt-1.5">
              <div className="flex items-start gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[3px] ${config.dot}`} />
                <div className="min-w-0">
                  <p className={`text-[10px] sm:text-xs font-bold leading-snug truncate ${config.text}`}>
                    {primaryHoliday.name}
                  </p>
                  <span className={`inline-block text-[9px] font-bold uppercase tracking-wider mt-0.5 px-1.5 py-0.5 rounded-full ${config.badgeBg}`}>
                    {config.badge}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <MasterHolidayIndicator holiday={primaryHoliday} />
          )}
        </>
      )}

      {/* ── Extra holidays indicator ── */}
      {extraCount > 0 && isCurrentMonth && (
        <div
          className="mt-1 text-[9px] font-bold text-violet-600 bg-violet-50 rounded-full px-2 py-0.5 inline-flex items-center gap-1 w-fit hover:bg-violet-100 transition-colors"
          onClick={e => { e.stopPropagation(); onViewDate(date, holidays); }}
        >
          +{extraCount} more
        </div>
      )}

      {/* Dim dot for out-of-month holidays */}
      {holidays.length > 0 && !isCurrentMonth && (
        <div className="w-1 h-1 rounded-full bg-gray-300 mt-1" />
      )}
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
const HolidayManagementCalendar = () => {
  const { checkActionAccess, getAccessMessage } = usePermissionAccess();
  const [currentDate, setCurrentDate] = useState(() => toCalendarDate(new Date()) || new Date());
  const [allHolidays, setAllHolidays] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'update' | 'delete' | 'view'
  const [modalData, setModalData] = useState(null);
  const [viewModalData, setViewModalData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const fetchLock = useRef(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const today = useMemo(() => toCalendarDate(new Date()) || new Date(), []);

  const createAccess = checkActionAccess('holidayManagement', 'create');
  const updateAccess = checkActionAccess('holidayManagement', 'update');
  const deleteAccess = checkActionAccess('holidayManagement', 'delete');
  const createMessage = getAccessMessage(createAccess);
  const updateMessage = getAccessMessage(updateAccess);
  const deleteMessage = getAccessMessage(deleteAccess);

  // Fetch holidays for current month
  useEffect(() => {
    let active = true;
    const key = `${currentYear}-${currentMonth}`;

    const fetchHolidays = async () => {
      if (allHolidays[key] && refreshKey === 0) { setIsLoading(false); return; }
      fetchLock.current = null;
      setIsLoading(true);
      const company = JSON.parse(localStorage.getItem('company') || '{}');
      const activePromise = (async () => {
        const [masterData, companyData] = await Promise.all([
          holidayService.getMasterHolidays(currentYear, currentMonth + 1),
          holidayService.getCompanyHolidays(company?.id)
        ]);
        const map = {};
        masterData.forEach(h => {
          if (!map[h.date]) map[h.date] = [];
          map[h.date].push({ ...h, source: 'master' });
        });
        companyData.forEach(h => {
          const d = new Date(h.date);
          if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
            const dateStr = formatDate(d);
            if (!map[dateStr]) map[dateStr] = [];
            map[dateStr].push({ ...h, source: 'company' });
          }
        });
        Object.values(map).forEach(arr => arr.sort((a, b) => a.source === 'company' ? -1 : b.source === 'company' ? 1 : 0));
        return map;
      })();
      fetchLock.current = { key, promise: activePromise };
      try {
        const data = await activePromise;
        if (active) setAllHolidays(prev => ({ ...prev, [key]: data }));
      } catch (e) { console.error(e); fetchLock.current = null; }
      finally { if (active) setIsLoading(false); }
    };

    fetchHolidays();
    return () => { active = false; };
  }, [currentYear, currentMonth, refreshKey]);

  const getHolidaysForDate = useCallback((date) => {
    const key = `${currentYear}-${currentMonth}`;
    return (allHolidays[key] || {})[formatDate(date)] || [];
  }, [allHolidays, currentYear, currentMonth]);

  // Updated handleAction: for 'create' we receive the full holidays array
  const handleAction = useCallback((date, data, action) => {
    if (action === 'create' && createAccess.disabled) return;
    if (action === 'update' && updateAccess.disabled) return;
    if (action === 'delete' && deleteAccess.disabled) return;

    if (action === 'create') {
      // data is the full holidays array
      const masterHolidays = Array.isArray(data) ? data.filter(h => h.source === 'master') : [];
      setModalData({ dates: [date], initialName: '', masterHolidays });
      setActiveModal('create');
    } else if (action === 'update') {
      // data is the company holiday object
      setModalData(data);
      setActiveModal('update');
    } else if (action === 'delete') {
      setModalData(data);
      setActiveModal('delete');
    }
  }, [createAccess.disabled, updateAccess.disabled, deleteAccess.disabled]);

  const handleViewDate = useCallback((date, holidays) => {
    setViewModalData({ date, holidays });
    setActiveModal('view');
  }, []);

  const closeModal = useCallback(() => { setActiveModal(null); setModalData(null); setViewModalData(null); }, []);

  const handleRefresh = useCallback(() => {
    clearAllHolidayCaches();
    setAllHolidays({});
    setRefreshKey(k => k + 1);
  }, []);

  const changeMonth = (delta) => {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  const grid = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const prevMonthDays = getDaysInMonth(currentYear, currentMonth - 1);
    const cells = [];
    const total = Math.ceil((firstDay + daysInMonth) / 7) * 7;

    for (let i = 0; i < total; i++) {
      let date, dayNumber, isCurrentMonth;
      if (i < firstDay) {
        dayNumber = prevMonthDays - (firstDay - i - 1);
        date = new Date(currentYear, currentMonth - 1, dayNumber);
        isCurrentMonth = false;
      } else if (i >= firstDay + daysInMonth) {
        dayNumber = i - (firstDay + daysInMonth) + 1;
        date = new Date(currentYear, currentMonth + 1, dayNumber);
        isCurrentMonth = false;
      } else {
        dayNumber = i - firstDay + 1;
        date = new Date(currentYear, currentMonth, dayNumber);
        isCurrentMonth = true;
      }
      cells.push({ date, dayNumber, isCurrentMonth, isToday: isSameDay(date, today), holidays: getHolidaysForDate(date) });
    }
    return cells;
  }, [currentYear, currentMonth, today, getHolidaysForDate]);

  const handleMonthNavigate = useCallback((date) => {
    const d = toCalendarDate(date);
    if (d) setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
  }, []);

  const stats = useMemo(() => {
    const key = `${currentYear}-${currentMonth}`;
    const map = allHolidays[key] || {};
    let companyCount = 0, mandatoryCount = 0, optionalCount = 0, nationalCount = 0;
    Object.values(map).flat().forEach(h => {
      if (h.source === 'company') {
        companyCount++;
        if (h.is_optional === 1) optionalCount++;
        else mandatoryCount++;
      } else if (h.source === 'master') {
        nationalCount++;
      }
    });
    return { total: companyCount, mandatory: mandatoryCount, optional: optionalCount, national: nationalCount };
  }, [allHolidays, currentYear, currentMonth]);

  const isCurrentMonthToday = currentYear === today.getFullYear() && currentMonth === today.getMonth();

  return (
    <ManagementHub
      eyebrow={<><FaUmbrellaBeach size={11} /> Holiday Management</>}
      title="Holiday Calendar"
      description="Manage your company's holidays. National holidays are shown as reference markers (★)."
      accent="indigo"
      onRefresh={handleRefresh}
    >
      <div className="space-y-4 p-2 lg:p-0">

        {/* ── Stats Row (enhanced with icons) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: 'Total Added', value: stats.total, icon: <Icon.Calendar />, color: 'text-gray-700', bg: 'bg-white', border: 'border-gray-200' },
            { label: 'Mandatory', value: stats.mandatory, icon: <Icon.Check />, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
            { label: 'Optional', value: stats.optional, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" /></svg>, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100' },
            { label: 'National (★)', value: stats.national, icon: <Icon.Star />, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-2.5 sm:p-4 border ${s.border} shadow-sm`}>
              <div className="flex items-center gap-2">
                <span className={s.color}>{s.icon}</span>
                <p className={`text-lg sm:text-2xl font-bold ${s.color} leading-none`}>{s.value}</p>
              </div>
              <p className="text-[9px] sm:text-xs text-gray-500 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Month Navigation Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col lg:flex-row lg:items-center md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between lg:justify-start gap-4 flex-1">
            <button
              onClick={() => changeMonth(-1)}
              className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-violet-600 hover:border-violet-200 hover:bg-violet-50 transition-colors"
            >
              <Icon.ChevronLeft />
            </button>
            <div className="text-center min-w-[140px]">
              <h2 className="text-lg font-bold text-slate-800">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </h2>
            </div>
            <button
              onClick={() => changeMonth(1)}
              className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-violet-600 hover:border-violet-200 hover:bg-violet-50 transition-colors"
            >
              <Icon.ChevronRight />
            </button>
          </div>

          <div className="flex items-center gap-3 justify-end">
            {!isCurrentMonthToday && (
              <button
                onClick={() => setCurrentDate(toCalendarDate(new Date()) || new Date())}
                className="px-4 py-2.5 text-sm font-bold text-violet-600 bg-white rounded-xl border border-violet-200 hover:bg-violet-50 transition-all shadow-sm active:scale-95"
              >
                Today
              </button>
            )}
          </div>
        </motion.div>

        {/* ── Calendar Grid ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100">
            {WEEK_DAYS.map(d => (
              <div key={d} className="py-2.5 text-center text-[11px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <span className="hidden sm:inline">{d}</span>
                <span className="sm:hidden">{d[0]}</span>
              </div>
            ))}
          </div>

          <div className="relative">
            {/* NO group on the grid container */}
            <div className="grid grid-cols-7">
              {grid.map((cell, i) => (
                <CalendarCell
                  key={i}
                  {...cell}
                  onAction={handleAction}
                  onMonthNavigate={handleMonthNavigate}
                  onViewDate={handleViewDate}
                  createDisabled={createAccess.disabled}
                  updateDisabled={updateAccess.disabled}
                  deleteDisabled={deleteAccess.disabled}
                  createMessage={createMessage}
                  updateMessage={updateMessage}
                  deleteMessage={deleteMessage}
                />
              ))}
            </div>

            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex items-center justify-center z-20 rounded-b-2xl"
                >
                  <div className="flex items-center gap-2.5 bg-white px-5 py-3 rounded-xl shadow-lg border border-gray-100">
                    <Icon.Spinner />
                    <span className="text-xs font-semibold text-gray-600">Loading…</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 justify-center pb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs text-gray-500">Mandatory Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-xs text-gray-500">Optional Holiday</span>
          </div>
          <div className="flex items-center gap-1.5 text-blue-400">
            <Icon.Star />
            <span className="text-xs text-gray-500">National / Observance (reference only)</span>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {activeModal === 'create' && modalData && (
        <CreateHolidayModal
          selectedDates={modalData.dates}
          initialName={modalData.initialName}
          masterHolidays={modalData.masterHolidays || []}
          onClose={closeModal}
          onCreateSuccess={handleRefresh}
          submitDisabled={createAccess.disabled}
          submitTitle={createAccess.disabled ? createMessage : ''}
        />
      )}
      {activeModal === 'update' && modalData && (
        <UpdateHolidayModal
          holiday={modalData}
          onClose={closeModal}
          onUpdateSuccess={handleRefresh}
          submitDisabled={updateAccess.disabled}
          submitTitle={updateAccess.disabled ? updateMessage : ''}
        />
      )}
      {activeModal === 'delete' && modalData && (
        <DeleteModal
          holiday={modalData}
          onClose={closeModal}
          onDeleteSuccess={handleRefresh}
          submitDisabled={deleteAccess.disabled}
          submitTitle={deleteAccess.disabled ? deleteMessage : ''}
        />
      )}
      {activeModal === 'view' && viewModalData && (
        <ViewDateHolidaysModal
          date={viewModalData.date}
          holidays={viewModalData.holidays}
          onClose={closeModal}
          onEdit={(holiday) => { setModalData(holiday); setActiveModal('update'); }}
          onDelete={(holiday) => { setModalData(holiday); setActiveModal('delete'); }}
          editDisabled={updateAccess.disabled}
          deleteDisabled={deleteAccess.disabled}
          editMessage={updateMessage}
          deleteMessage={deleteMessage}
        />
      )}
    </ManagementHub>
  );
};

export default HolidayManagementCalendar;