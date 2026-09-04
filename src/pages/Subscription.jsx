import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaUsers, FaCheckCircle, FaArrowRight, FaSpinner,
  FaExclamationTriangle, FaRocket, FaShieldAlt, FaClock,
  FaCalculator, FaCreditCard, FaBuilding, FaCalendarAlt,
  FaCalendarCheck, FaInfoCircle, FaLock, FaChevronDown
} from 'react-icons/fa';
import apiCall from '../utils/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { initiateLayerPayment } from '../utils/layerPayment';
import { loadLayerScript } from '../utils/loadLayer';

// ─── Constants ───────────────────────────────────────────────
const DURATION_OPTIONS = [
  { key: 'monthly_price', label: 'Monthly', suffix: '/mo', billedLabel: 'billed monthly', months: 1 },
  { key: 'quarterly_price', label: 'Quarterly', suffix: '/qtr', billedLabel: 'billed quarterly', months: 3 },
  { key: 'half_yearly_price', label: 'Half-yearly', suffix: '/6 mo', billedLabel: 'billed every 6 months', months: 6 },
  { key: 'yearly_price', label: 'Yearly', suffix: '/yr', billedLabel: 'billed yearly', months: 12 },
];

const PERIOD_MAP = {
  monthly_price: 'monthly',
  quarterly_price: 'quarterly',
  half_yearly_price: 'half_yearly',
  yearly_price: 'yearly',
};

// ─── Helpers ─────────────────────────────────────────────────
const fmt = (value) => {
  if (!value && value !== 0) return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(num);
};

const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

// ─── Sub-components ──────────────────────────────────────────

/** Single stat cell used in the top stats strip */
const StatCell = ({ label, value, sub }) => (
  <div className="px-4 py-3 sm:px-5 sm:py-4 flex flex-col justify-center bg-white h-full w-full">
    <p className="text-[10px] sm:text-[11px] uppercase tracking-widest text-gray-400 mb-1">{label}</p>
    <p className="text-[20px] sm:text-[22px] font-semibold text-gray-800 leading-none">{value ?? '—'}</p>
    {sub && <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1">{sub}</p>}
  </div>
);

/** Compact subscription plan card (current or upcoming) */
const PlanCard = ({ plan, variant }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isCurrent = variant === 'current';
  const progressPct = isCurrent && plan.days_remaining != null
    ? Math.max(0, Math.min(100, Math.round(((30 - plan.days_remaining) / 30) * 100)))
    : 0;

  return (
    <div className={`rounded-xl p-3 bg-white transition-all ${isCurrent
        ? 'border-2 border-blue-500'
        : 'border border-gray-200'
      }`}>
      {/* Top Section (Always Visible) - Clickable to expand */}
      <div 
        className="cursor-pointer group select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${isCurrent
                ? 'bg-blue-50 text-blue-700'
                : 'bg-amber-50 text-amber-700'
              }`}>
              {isCurrent ? 'Current' : 'Upcoming'}
            </span>
            <span className="text-[11px] text-gray-400 capitalize bg-gray-50 px-2.5 py-1 rounded-full">
              {plan.subscription_type} billing
            </span>
          </div>
          <div className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <FaChevronDown className="text-xs" />
          </div>
        </div>

        <p className="mt-2 text-sm font-semibold text-gray-800 truncate group-hover:text-blue-600 transition-colors">{plan.package_name}</p>
        
        {/* Short info when collapsed */}
        {!isExpanded && (
          <p className="mt-1 text-[11px] text-gray-500 truncate">
            {plan.employee_limit} employees • {isCurrent ? `${plan.days_remaining ?? '—'} days left` : `Starts in ${plan.until_start ?? '—'} days`}
          </p>
        )}
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Detail rows */}
            <div className="mt-3 text-[12px] text-gray-600 space-y-1.5 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
              <p className="flex items-center gap-2">
                <span className="w-4 flex justify-center"><FaUsers className={isCurrent ? 'text-blue-400' : 'text-amber-400'} /></span>
                <span><strong className="text-gray-800">{plan.employee_limit}</strong> employees limit</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="w-4 flex justify-center"><FaCalendarCheck className={isCurrent ? 'text-blue-400' : 'text-amber-400'} /></span>
                <span>Expires: <strong className="text-gray-800">{fmtDate(plan.expires_at)}</strong></span>
              </p>
              <p className="flex items-center gap-2">
                <span className="w-4 flex justify-center"><FaCalendarAlt className={isCurrent ? 'text-blue-400' : 'text-amber-400'} /></span>
                <span>{isCurrent ? 'Time left' : 'Starts in'}: <strong className="text-gray-800">{isCurrent ? `${plan.days_remaining ?? '—'} days` : `${plan.until_start ?? '—'} days`}</strong></span>
              </p>
              <p className="flex items-center gap-2">
                <span className="w-4 flex justify-center"><FaCreditCard className={isCurrent ? 'text-blue-400' : 'text-amber-400'} /></span>
                <span>Paid amount: <strong className="text-gray-800">{fmt(plan.amount_paid)}</strong></span>
              </p>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
                <span>{isCurrent ? 'Period progress' : 'Starts in'}</span>
                <span>{isCurrent ? `${plan.days_remaining} days left` : `${plan.until_start} days`}</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${isCurrent ? 'bg-blue-500' : 'bg-amber-400'}`}
                  style={{ width: isCurrent ? `${progressPct}%` : '0%' }}
                />
              </div>
            </div>

            <p className="text-[10px] text-gray-300 font-mono mt-2 truncate"># {plan.payment_reference}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Top section showing company info + current/upcoming subscriptions */
const SubscriptionDetailsCard = ({ details, detailsLoading, detailsError }) => {
  if (detailsLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5 flex items-center gap-3 text-gray-400 text-sm">
        <FaSpinner className="animate-spin text-gray-400" />
        Loading subscription details…
      </div>
    );
  }
  if (detailsError || !details) return null;

  const { company, subscriptions } = details;
  const current = subscriptions?.find(s => s.type === 'current');
  const upcoming = subscriptions?.find(s => s.type === 'upcoming');

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5 shadow-sm"
    >
      {/* Company header */}
      <div className="flex items-center justify-between px-4 py-4 sm:px-5 border-b border-gray-100 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.name} className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
          ) : (
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
              <FaBuilding className="text-sm" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[13px] sm:text-sm font-semibold text-gray-800 leading-tight truncate">{company.name}</p>
            <p className="text-[10px] sm:text-[11px] text-gray-400 truncate">{company.legal_name}</p>
          </div>
        </div>
        {company.active_subscription && (
          <span className="shrink-0 flex items-center gap-1.5 bg-green-50 text-green-700 text-[10px] sm:text-[11px] font-semibold px-2 py-1 sm:px-2.5 rounded-full border border-green-100">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Active
          </span>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 bg-gray-100 gap-[1px] border-b border-gray-100">
        <StatCell label="Employees" value={company.employee_count} sub={`of ${current?.employee_limit ?? '—'} in plan`} />
        <StatCell label="Seats free" value={company.employee_available} sub="remaining" />
        <StatCell label="Days left" value={current?.days_remaining ?? '—'} sub="in current plan" />
        <StatCell label="Queued" value={company.queued_subscriptions} sub="plans" />
      </div>

      {/* Plan cards */}
      <div className="p-5">
        {(current || upcoming) && (
          <div className={`grid gap-4 ${current && upcoming ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'}`}>
            {current && <PlanCard plan={current} variant="current" />}
            {upcoming && <PlanCard plan={upcoming} variant="upcoming" />}
          </div>
        )}

        {/* Queued notice */}
        {company.queued_subscriptions > 0 && upcoming && (
          <div className="mt-4 flex items-start gap-2.5 text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
            <FaInfoCircle className="mt-0.5 flex-shrink-0 text-amber-500" />
            <span>
              <strong>{upcoming.package_name}</strong> activates automatically when your current plan expires.
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/** Duration tab button */
const DurButton = ({ duration, isSelected, price, monthlyPrice, employees, onClick }) => {
  const priceNum = price != null ? parseFloat(price) : null;
  const basePrice = monthlyPrice != null ? parseFloat(monthlyPrice) * duration.months : null;
  let discount = 0;
  if (basePrice > 0 && priceNum != null && basePrice > priceNum) {
    discount = Math.round(((basePrice - priceNum) / basePrice) * 100);
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`relative flex-1 cursor-pointer rounded-xl p-3 sm:p-4 text-center transition-all duration-200 select-none ${isSelected
          ? 'bg-white border-2 border-blue-500 shadow-sm'
          : 'bg-white border border-gray-200 hover:border-gray-300'
        }`}
    >
      {discount > 0 && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold bg-green-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">
          Save {discount}%
        </span>
      )}
      <p className={`text-[12px] font-semibold mb-1 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
        {duration.label}
      </p>
      <p className="text-[17px] font-semibold text-gray-800">
        {priceNum != null && !isNaN(priceNum) ? fmt(priceNum) : '—'}
      </p>
      {priceNum != null && !isNaN(priceNum) && employees > 0 && (
        <p className="text-[11px] text-gray-400 mt-0.5">
          {fmt(priceNum / employees)}{duration.suffix}
        </p>
      )}
    </motion.div>
  );
};

// ─── Main Page ────────────────────────────────────────────────
const SubscriptionPage = ({ publicView = false, defaultCompanyId = null, defaultToken = null }) => {
  const navigate = useNavigate();

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState(25);
  const [selectedDur, setSelectedDur] = useState(DURATION_OPTIONS[0]);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(!publicView);
  const [detailsError, setDetailsError] = useState(null);

  const hasFetched = useRef(false);
  const hasFetchedDetails = useRef(false);

  // Load payment gateway script
  useEffect(() => {
    loadLayerScript().catch((err) => {
      console.error(err);
      toast.error('Unable to load payment gateway');
    });
  }, []);

  // Fetch subscription details
  useEffect(() => {
    if (hasFetchedDetails.current) return;
    hasFetchedDetails.current = true;

    (async () => {
      try {
        setDetailsLoading(true);
        const company = publicView
          ? { id: defaultCompanyId }
          : JSON.parse(localStorage.getItem('company'));
        const response = await apiCall(
          '/subscriptions/details',
          'GET',
          null,
          company?.id,
          publicView ? { token: defaultToken, skipUnauthorizedRedirect: true } : {},
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (result.success && result.data) setDetails(result.data);
        else throw new Error(result.message || 'Invalid response');
      } catch (err) {
        console.error('Details fetch error:', err);
        setDetailsError(err.message);
      } finally {
        setDetailsLoading(false);
      }
    })();
  }, [publicView, defaultCompanyId, defaultToken]);

  // Fetch packages
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    (async () => {
      try {
        setLoading(true);
        const response = await apiCall(
          '/subscriptions/packages',
          'GET',
          null,
          null,
          publicView ? { token: defaultToken, skipUnauthorizedRedirect: true } : {},
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) setPackages(result.data);
        else throw new Error(result.message || 'Invalid API response');
      } catch (err) {
        console.error('API Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [publicView, defaultToken]);

  // Derived values
  const sortedPackages = useMemo(
    () => [...packages].sort((a, b) => (a.min_employee_count || 0) - (b.min_employee_count || 0)),
    [packages]
  );

  const sliderStops = useMemo(() => {
    const stops = sortedPackages
      .flatMap((pkg, index) => [
        index === 0 ? Number(pkg.min_employee_count) : null,
        Number(pkg.max_employee_count),
      ])
      .filter((value) => Number.isFinite(value));
    return [...new Set(stops)].sort((a, b) => a - b);
  }, [sortedPackages]);

  const snapEmployeesToPackageLimit = (value) => {
    if (!sliderStops.length) return Number(value) || 1;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return sliderStops[0];
    return sliderStops.reduce((closest, stop) => {
      const currentDistance = Math.abs(stop - numericValue);
      const closestDistance = Math.abs(closest - numericValue);
      if (currentDistance < closestDistance) return stop;
      if (currentDistance === closestDistance && stop > closest) return stop;
      return closest;
    }, sliderStops[0]);
  };

  const sliderMin = sliderStops[0] ?? 1;
  const sliderMax = sliderStops[sliderStops.length - 1] ?? 200;

  const currentPackage = sortedPackages.find(
    (pkg) => employees >= pkg.min_employee_count && employees <= pkg.max_employee_count
  ) ?? null;

  const selectedPackagePrice = currentPackage ? parseFloat(currentPackage[selectedDur.key]) : null;
  const currentPrice = Number.isFinite(selectedPackagePrice) ? selectedPackagePrice : null;

  const currentMonthlyPrice = currentPackage ? parseFloat(currentPackage.monthly_price) : null;
  const basePrice = currentMonthlyPrice != null ? currentMonthlyPrice * selectedDur.months : null;

  let calculatedDiscountPct = 0;
  if (basePrice > 0 && currentPrice != null && basePrice > currentPrice) {
    calculatedDiscountPct = Math.round(((basePrice - currentPrice) / basePrice) * 100);
  }

  const pricePerUser = currentPrice != null && employees > 0
    ? currentPrice / employees
    : null;

  useEffect(() => {
    if (!sliderStops.length) return;
    setEmployees((current) => snapEmployeesToPackageLimit(current));
  }, [sliderStops]);

  const handlePurchase = async () => {
    if (!currentPackage || purchaseLoading) return;
    try {
      setPurchaseLoading(true);
      const company = publicView
        ? { id: defaultCompanyId }
        : JSON.parse(localStorage.getItem('company') || 'null');
      const response = await apiCall(
        '/subscriptions/purchase-subscription', 'POST',
        { package_id: currentPackage.id, package_period: PERIOD_MAP[selectedDur.key] },
        company?.id,
        publicView ? { token: defaultToken, skipUnauthorizedRedirect: true } : {},
      );
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Purchase failed');

      if (result.message === 'Subscription purchased successfully.') {
        toast.success(result.message);
        setTimeout(() => navigate('/home'), 1500);
        return;
      }
      if (result.data?.payment_token) {
        toast.info('Redirecting to payment gateway…');
        await initiateLayerPayment(result.data.payment_token, navigate);
        return;
      }
      toast.success(result.message);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Something went wrong');
    } finally {
      setPurchaseLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sticky top bar ── */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="w-full mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-[16px] font-semibold text-gray-800">Subscription plans</h1>
            <p className="text-[12px] text-gray-400 mt-0.5">Choose the perfect plan for your team</p>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
            <FaShieldAlt className="text-green-500" />
            Secure payment
          </div>
        </div>
      </header>

      <div className="w-full mx-auto px-4 sm:px-6 py-6">

        {/* ── Subscription details ── */}
        <SubscriptionDetailsCard
          details={details}
          detailsLoading={detailsLoading}
          detailsError={detailsError}
        />

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <FaSpinner className="animate-spin text-3xl text-blue-400" />
            <p className="text-sm">Loading subscription packages…</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <FaExclamationTriangle className="text-3xl text-red-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-red-600 mb-1">Failed to load packages</p>
            <p className="text-xs text-red-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Main content ── */}
        {!loading && !error && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
            >
              {/* ── Duration selector ── */}
              <div className="p-4 sm:p-5 border-b border-gray-100">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Billing period</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  {DURATION_OPTIONS.map((dur) => (
                    <DurButton
                      key={dur.key}
                      duration={dur}
                      isSelected={selectedDur.key === dur.key}
                      price={currentPackage ? currentPackage[dur.key] : null}
                      monthlyPrice={currentPackage ? currentPackage.monthly_price : null}
                      employees={employees}
                      onClick={() => setSelectedDur(dur)}
                    />
                  ))}
                </div>
              </div>

              {/* ── Price calculator ── */}
              <div className="p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-4">Price calculator</p>

                {/* Employees slider */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[13px] text-gray-600 flex items-center gap-1.5">
                      <FaUsers className="text-blue-400 text-[11px]" />
                      Employees
                    </label>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={employees}
                        initial={{ scale: 1.15, color: '#3b82f6' }}
                        animate={{ scale: 1, color: '#1f2937' }}
                        transition={{ duration: 0.2 }}
                        className="text-[18px] font-semibold text-gray-800"
                      >
                        {employees}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  <input
                    type="range"
                    min={sliderMin}
                    max={sliderMax}
                    value={employees}
                    step={1}
                    onChange={(e) => setEmployees(snapEmployeesToPackageLimit(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-gray-500">
                    {sortedPackages.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setEmployees(Number(pkg.max_employee_count))}
                        className={`rounded-md px-2 py-1 transition-all border ${currentPackage?.id === pkg.id
                            ? 'bg-blue-50 border-blue-200 font-bold text-blue-700 shadow-sm'
                            : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 font-medium'
                          }`}
                        title={`${pkg.min_employee_count}-${pkg.max_employee_count} employees`}
                      >
                        {pkg.min_employee_count}-{pkg.max_employee_count}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Package badge */}
                <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3 mb-5 text-[13px]">
                  <span className="text-gray-500">Your package</span>
                  <AnimatePresence mode="wait">
                    {currentPackage ? (
                      <motion.span
                        key={currentPackage.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-blue-50 text-blue-700 text-[12px] font-semibold px-3 py-1 rounded-full"
                      >
                        {currentPackage.name}
                      </motion.span>
                    ) : (
                      <span className="text-gray-400 text-[12px]">Select employee range</span>
                    )}
                  </AnimatePresence>
                </div>

                {/* Breakdown */}
                <div className="space-y-0 border-y border-gray-100 mb-5">
                  {[
                    {
                      label: 'Base price',
                      value: currentPrice != null ? fmt(basePrice != null && basePrice > currentPrice ? basePrice : currentPrice) : '—',
                      valueClass: 'text-gray-800 font-medium',
                    },
                    {
                      label: 'Per employee',
                      value: pricePerUser ? `${fmt(pricePerUser)}${selectedDur.suffix}` : '—',
                      valueClass: 'text-gray-600',
                    },
                    ...(basePrice != null && basePrice > currentPrice && currentPrice != null ? [{
                      label: (
                        <span className="flex items-center gap-1 text-green-600">
                          <FaRocket className="text-[10px]" /> You save ({calculatedDiscountPct}%)
                        </span>
                      ),
                      value: `-${fmt(basePrice - currentPrice)}`,
                      valueClass: 'text-green-600 font-medium',
                    }] : []),
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0 text-[13px]">
                      <span className="text-gray-500">{row.label}</span>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={String(row.value)}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={row.valueClass}
                        >
                          {row.value}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="flex justify-between items-baseline bg-gray-50 rounded-xl px-4 py-4 mb-5">
                  <div>
                    <p className="text-[13px] text-gray-500 font-medium">Estimated total</p>
                    {currentPrice != null && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{selectedDur.billedLabel}</p>
                    )}
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={currentPrice}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-[24px] sm:text-[28px] font-semibold text-gray-800"
                    >
                      {currentPrice != null ? fmt(currentPrice) : '—'}
                    </motion.span>
                  </AnimatePresence>
                </div>

                {/* Buy button */}
                <motion.button
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={!currentPackage || purchaseLoading}
                  onClick={handlePurchase}
                  className={`w-full py-3 rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2 transition-all ${currentPackage && !purchaseLoading
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  {purchaseLoading
                    ? <><FaSpinner className="animate-spin" /> Processing…</>
                    : <><FaCreditCard /> Buy now <FaArrowRight className="text-[11px]" /></>
                  }
                </motion.button>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-5 mt-4 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1"><FaShieldAlt /> Secure checkout</span>
                  <span className="flex items-center gap-1"><FaLock /> 256-bit SSL</span>
                  <span className="flex items-center gap-1"><FaClock /> Cancel anytime</span>
                </div>
              </div>
            </motion.div>

            {/* Enterprise / Custom Plan Contact Card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mt-5 sm:mt-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-5 sm:p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-6 relative overflow-hidden"
            >
              {/* Background accent */}
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500 rounded-full blur-3xl opacity-20 pointer-events-none"></div>

              <div className="relative z-10 text-center md:text-left">
                <h3 className="text-xl font-bold flex items-center justify-center md:justify-start gap-2.5">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-blue-400">
                    <FaBuilding size={16} />
                  </span>
                  Enterprise & Custom Plans
                </h3>
                <p className="text-slate-300 text-[14px] mt-2 max-w-xl leading-relaxed">
                  Need a custom offer or want to manage more employees? Contact our sales team for a tailored solution designed for your business scale.
                </p>
              </div>
              <button
                onClick={() => {
                  const subject = "Enterprise and custom plan enquiry";
                  const body = [
                    "Hello OneAttendance Sales Team,",
                    "",
                    "I would like to learn more about your enterprise and custom plans.",
                    "",
                    "Organisation:",
                    "Number of employees:",
                    "Requirements:",
                    "",
                    "Thank you.",
                  ].join("\n");
                  window.location.href = `mailto:support@oneattendance.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                }}
                className="relative z-10 shrink-0 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-8 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95 whitespace-nowrap flex items-center gap-2"
              >
                Contact Sales
                <FaArrowRight size={12} />
              </button>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPage;
