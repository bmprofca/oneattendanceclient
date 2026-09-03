import { useCallback, useEffect, useMemo, useState } from "react";
import { FaCalendarAlt, FaCheckCircle, FaChevronDown, FaEye, FaMoneyBillWave, FaSpinner, FaHistory, FaCalculator } from "react-icons/fa";
import { toast } from "react-toastify";
import apiCall from "../../utils/api";
import AdvancedDateFilter from "../AdvancedDateFilter";
import ManagementGrid from "../ManagementGrid";
import ManagementViewSwitcher from "../ManagementViewSwitcher";
import Pagination, { usePagination } from "../PaginationComponent";
import { ManagementCard, ManagementTable } from "../common";
import Modal from "../Modal";

const inFlightRequests = new Map();
function runDedupedRequest(key, requestFn) {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const promise = requestFn().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);
  return promise;
}

const getCompanyId = () => {
  const company = localStorage.getItem("company");
  return company ? JSON.parse(company)?.id : null;
};

const formatCurrency = (value) => value == null ? "—" : `₹${Number(value).toLocaleString("en-IN")}`;
const formatPayrollPeriod = ({ month, year }) =>
  new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
const formatRecordPeriod = (payroll) => {
  if (payroll?.month && payroll?.year) {
    return formatPayrollPeriod({ month: Number(payroll.month), year: Number(payroll.year) });
  }
  return payroll?.payroll_period
    ? new Date(payroll.payroll_period).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    })
    : "—";
};
const getStatusClasses = (status) => ({
  current: "border-emerald-200 bg-emerald-50 text-emerald-700",
  past: "border-slate-200 bg-slate-50 text-slate-600",
  future: "border-violet-200 bg-violet-50 text-violet-700",
  preview: "border-blue-200 bg-blue-50 text-blue-700",
}[status] || "border-slate-200 bg-slate-50 text-slate-600");
const formatMinutes = (value) => {
  if (value === undefined) return "—";
  if (value === null || value === "") return "0h 0m";
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return "—";
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
};
const formatMetric = (value) => {
  if (value === undefined) return "—";
  if (value === null || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : "—";
};

function PayrollDetailModal({ record, onClose }) {
  if (!record) return null;
  const payroll = record.payroll || {};
  const employee = record.employee || {};
  const attendance = payroll.attendance || {};
  const work = payroll.work || {};
  const components = payroll.components_breakdown || {};
  const adjustments = payroll.adjustments || [];

  return (
    <Modal
      isOpen={!!record}
      onClose={onClose}
      title="Payroll Details"
      subtitle={`${employee.name || "Employee"} · ${employee.employee_code || "N/A"}`}
      icon={<FaMoneyBillWave className="text-emerald-600" />}
      size="4xl"
      footer={<button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50">Close</button>}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
          <FaCalendarAlt className="text-indigo-500" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Payroll Period</p>
            <p className="text-base font-black text-indigo-800">{formatRecordPeriod(payroll)}</p>
          </div>
          <span className={`ml-auto rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${getStatusClasses(record.status)}`}>{record.status || "current"}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[{ label: "Earnings", value: payroll.total_earnings, color: "emerald" }, { label: "Deductions", value: payroll.total_deductions, color: "rose" }, { label: "Net Salary", value: payroll.net_salary, color: "indigo" }].map((item) => (
            <div key={item.label} className={`rounded-xl border border-${item.color}-100 bg-${item.color}-50 p-3 text-center`}>
              <p className={`text-[9px] font-bold uppercase tracking-widest text-${item.color}-500`}>{item.label}</p>
              <p className={`mt-1 text-base font-black text-${item.color}-700`}>{formatCurrency(item.value)}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {["working_days", "present_days", "absent_days", "paid_leave_days", "unpaid_leave_days"].map((key) => (
            <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{key.replaceAll("_", " ")}</p>
              <p className="mt-1 text-sm font-black text-slate-700">{formatMetric(attendance[key] !== undefined ? attendance[key] : payroll[key])}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[{ label: "Worked", value: work.worked_minutes !== undefined ? work.worked_minutes : payroll.worked_minutes }, { label: "Overtime", value: work.overtime_minutes !== undefined ? work.overtime_minutes : payroll.overtime_minutes }, { label: "Deduction", value: work.deduction_minutes !== undefined ? work.deduction_minutes : payroll.deduction_minutes }].map((item) => (
            <div key={item.label} className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-blue-500">{item.label}</p>
              <p className="mt-1 text-sm font-black text-blue-700">{formatMinutes(item.value)}</p>
            </div>
          ))}
        </div>

        {[{ label: "Earnings Breakdown", items: components.earnings, color: "emerald" }, { label: "Deductions Breakdown", items: components.deductions, color: "rose" }, { label: "Adjustments", items: adjustments, color: "amber" }].map((group) => group.items?.length > 0 && (
          <div key={group.label}>
            <p className={`mb-2 text-[10px] font-black uppercase tracking-widest text-${group.color}-600`}>{group.label}</p>
            <div className="space-y-2">
              {group.items.map((item, index) => (
                <div key={item.id || index} className={`flex items-center justify-between rounded-xl border border-${group.color}-100 bg-${group.color}-50 p-3`}>
                  <span className="text-sm font-semibold text-slate-700">{item.name || item.label || "Adjustment"}</span>
                  <span className={`font-black text-${group.color}-700`}>{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function EmployeePayrollTab({ employeeId, refreshKey = 0, filterType = "generated" }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [viewMode, setViewMode] = useState("table");
  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  const [showGeneratePicker, setShowGeneratePicker] = useState(false);
  const [selectedPayrollPeriod, setSelectedPayrollPeriod] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });
  const { pagination, updatePagination, goToPage, changeLimit } = usePagination(1, 10);

  const fetchPayroll = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const requestKey = `employee-payroll:${employeeId}`;
      const { res, json } = await runDedupedRequest(requestKey, async () => {
        const response = await apiCall(`/payroll/${employeeId}`, "GET", null, getCompanyId());
        const data = await response.json();
        return { res: response, json: data };
      });

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load payroll records");
      }

      const data = json.data || {};
      const generated = Array.isArray(data.generated_payrolls) ? data.generated_payrolls : [];
      const previews = Array.isArray(data.preview_payrolls) ? data.preview_payrolls : [];
      const nextRecords = [...generated, ...previews];
      setRecords(nextRecords);
      updatePagination({ page: 1, total: nextRecords.length });
    } catch (error) {
      setRecords([]);
      toast.error(error.message || "Failed to load payroll records");
    } finally {
      setLoading(false);
    }
  }, [employeeId, updatePagination]);

  const handleGenerateCurrentEmployeePayroll = useCallback(async () => {
    if (!employeeId) {
      toast.error("Employee not selected");
      return;
    }

    setGeneratingPayroll(true);
    try {
      const companyId = getCompanyId();
      const response = await apiCall(
        "/payroll/generate-payroll",
        "POST",
        {
          employee_id: [Number(employeeId)],
          month: selectedPayrollPeriod.month,
          year: selectedPayrollPeriod.year,
          send_pdf: false,
        },
        companyId
      );

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to generate payroll for the current employee");
      }

      toast.success(`Payroll generated for ${formatPayrollPeriod(selectedPayrollPeriod)}`);
      setShowGeneratePicker(false);
      await fetchPayroll();
    } catch (error) {
      toast.error(error.message || "Failed to generate payroll");
    } finally {
      setGeneratingPayroll(false);
    }
  }, [employeeId, fetchPayroll, selectedPayrollPeriod]);

  useEffect(() => { fetchPayroll(); }, [fetchPayroll, refreshKey]);

  const filteredRecords = useMemo(() => {
    if (filterType === "generated") {
      return records.filter(r => r.payroll?.id); // generated payrolls have id
    } else {
      return records.filter(r => !r.payroll?.id); // preview payrolls don't have id
    }
  }, [records, filterType]);

  const visibleRecords = useMemo(() => {
    const start = (pagination.page - 1) * pagination.limit;
    return filteredRecords.slice(start, start + pagination.limit);
  }, [pagination.page, pagination.limit, filteredRecords]);
  const columns = [
    { key: "period", label: "Period", render: (record) => <span className="font-semibold text-slate-800">{formatRecordPeriod(record.payroll)}</span> },
    { key: "earnings", label: "Earnings", render: (record) => <span className="font-semibold text-emerald-700">{formatCurrency(record.payroll?.total_earnings)}</span> },
    { key: "deductions", label: "Deductions", render: (record) => <span className="font-semibold text-rose-600">{formatCurrency(record.payroll?.total_deductions)}</span> },
    { key: "net_salary", label: "Net Salary", render: (record) => <span className="inline-flex rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{formatCurrency(record.payroll?.net_salary)}</span> },
    { key: "status", label: "Status", render: (record) => <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getStatusClasses(record.status)}`}><FaCheckCircle size={10} />{record.status || "current"}</span> },
  ];

  const actions = (record) => [{ label: "View Details", icon: <FaEye size={12} />, onClick: () => setSelectedRecord(record), className: "text-blue-600 hover:bg-blue-50" }];
  const cardRenderer = (record, index) => {
    const payroll = record.payroll || {};
    const accentColor = filterType === "generated" ? "emerald" : "blue";
    const accentClasses = filterType === "generated" ? { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100", label: "text-emerald-500" } : { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-100", label: "text-blue-500" };
    
    return (
      <ManagementCard key={`${payroll.id || payroll.payroll_period || index}`} accent={accentColor} delay={index * 0.04} onClick={() => setSelectedRecord(record)} activeId={activeActionMenu} onToggle={(event, id) => setActiveActionMenu((current) => current === id ? null : id)} menuId={`payroll-${payroll.id || index}`} actions={actions(record)} hoverable title={formatRecordPeriod(payroll)} subtitle={`${record.status || "current"} payroll`} eyebrow="Payroll Record" badge={<span className={`text-xs font-bold ${accentClasses.text}`}>#{payroll.id || "Preview"}</span>} footer={<div className="flex w-full justify-between text-xs text-slate-400"><span>Net: {formatCurrency(payroll.net_salary)}</span><span>Worked: {formatMinutes(payroll.work?.worked_minutes)}</span></div>}>
        <div className="grid grid-cols-3 gap-2">
         <div className={`rounded-lg border ${accentClasses.border} ${accentClasses.bg} p-2 text-center`}><p className={`text-[9px] font-bold uppercase ${accentClasses.label}`}>Earnings</p><p className={`text-xs font-black ${accentClasses.text}`}>{formatCurrency(payroll.total_earnings)}</p></div>
         <div className="rounded-lg border border-rose-100 bg-rose-50 p-2 text-center"><p className="text-[9px] font-bold uppercase text-rose-500">Deductions</p><p className="text-xs font-black text-rose-700">{formatCurrency(payroll.total_deductions)}</p></div>
         <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-2 text-center"><p className="text-[9px] font-bold uppercase text-indigo-500">Net</p><p className="text-xs font-black text-indigo-700">{formatCurrency(payroll.net_salary)}</p></div>
        </div>
      </ManagementCard>
    );
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
          <FaSpinner className="animate-spin text-emerald-600" />
          <span className="text-sm">Loading payroll records...</span>
        </div>
      ) : visibleRecords.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">
          No {filterType === "generated" ? "generated" : "preview"} payroll records found
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              {filterType === "generated" ? (
                <>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <FaMoneyBillWave size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Generated Payrolls</p>
                  </div>
                </>
              ) : (
                <>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <FaHistory size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Preview Payrolls</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setShowGeneratePicker(true)}
                disabled={generatingPayroll || loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generatingPayroll ? <FaSpinner className="animate-spin" size={10} /> : <FaCalculator size={10} />}
                {generatingPayroll ? "Generating..." : "Generate Payroll"}
              </button>
              <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent={filterType === "generated" ? "emerald" : "blue"} />
            </div>
          </div>
          {viewMode === "table" ? (
            <ManagementTable 
              rows={visibleRecords} 
              columns={columns} 
              rowKey={(record, index) => record.payroll?.id || `${record.status}-${index}`} 
              onRowClick={setSelectedRecord} 
              activeId={activeActionMenu} 
              onToggleAction={(event, id) => setActiveActionMenu((current) => current === id ? null : id)} 
              getActions={actions} 
              accent={filterType === "generated" ? "emerald" : "blue"} 
            />
          ) : (
            <ManagementGrid viewMode={viewMode}>{visibleRecords.map(cardRenderer)}</ManagementGrid>
          )}
          <Pagination 
            currentPage={pagination.page} 
            totalItems={filteredRecords.length} 
            itemsPerPage={pagination.limit} 
            onPageChange={goToPage} 
            onLimitChange={changeLimit} 
            showInfo 
          />
        </div>
      )}
      <PayrollDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      <Modal
        isOpen={showGeneratePicker}
        onClose={() => setShowGeneratePicker(false)}
        title="Generate Payroll"
        subtitle={`Select the payroll period for this employee`}
        icon={<FaCalculator className="text-emerald-600" />}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowGeneratePicker(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerateCurrentEmployeePayroll}
              disabled={generatingPayroll}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingPayroll && <FaSpinner className="animate-spin" size={12} />}
              {generatingPayroll ? "Generating..." : "Generate Payroll"}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Payroll will be generated for <span className="font-bold text-slate-700">{formatPayrollPeriod(selectedPayrollPeriod)}</span>.
          </p>
          <AdvancedDateFilter
            value={{ month: selectedPayrollPeriod.month, year: selectedPayrollPeriod.year }}
            onChange={(value) => {
              if (value?.month && value?.year) {
                setSelectedPayrollPeriod({
                  month: Number(value.month),
                  year: Number(value.year),
                });
              }
            }}
            tabOptions={["month"]}
            placeholder="Select payroll month"
            buttonClassName="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
          />
        </div>
      </Modal>
    </div>
  );
}
