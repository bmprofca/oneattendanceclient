import { useCallback, useEffect, useState } from "react";
import { FaCheckCircle, FaEdit, FaExchangeAlt, FaEye, FaMoneyBillWave, FaPlus, FaSpinner, FaTimesCircle, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import apiCall from "../../utils/api";
import ManagementGrid from "../ManagementGrid";
import ManagementViewSwitcher from "../ManagementViewSwitcher";
import { ManagementCard, ManagementTable } from "../common";
import Modal from "../Modal";
import { AssignSalaryModal, DeleteConfirmModal, EditSalaryModal, ReviseSalaryModal } from "../../pages/SalaryManagement";

const getCompanyId = () => {
  const company = localStorage.getItem("company");
  return company ? JSON.parse(company)?.id : null;
};

const formatDate = (value) => value
  ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  : "—";

const money = (value) => value == null ? "—" : `₹${Number(value).toLocaleString()}`;
const COMPONENT_STYLES = {
  emerald: { label: "text-emerald-600", row: "border-emerald-100 bg-emerald-50", value: "text-emerald-700" },
  rose: { label: "text-rose-600", row: "border-rose-100 bg-rose-50", value: "text-rose-700" },
};

function SalaryDetailModal({ salary, onClose }) {
  if (!salary) return null;
  const earnings = (salary.components || []).filter((component) => component.type === "earning");
  const deductions = (salary.components || []).filter((component) => component.type === "deduction");

  return (
    <Modal isOpen={!!salary} onClose={onClose} title="Salary Details" subtitle={`Salary #${salary.salary_id}`} size="4xl" footer={<button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Close</button>}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {["base_amount", "ctc", "net_salary", "total_deductions"].map((key) => (
            <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{key.replaceAll("_", " ")}</p>
              <p className="mt-1 text-base font-black text-slate-800">{money(salary[key])}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Effective From</p><p className="text-sm font-semibold text-slate-700">{formatDate(salary.effective_from)}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Effective To</p><p className="text-sm font-semibold text-slate-700">{salary.effective_to ? formatDate(salary.effective_to) : "Ongoing"}</p></div>
        </div>
        {[{ label: "Earnings", items: earnings, color: "emerald" }, { label: "Deductions", items: deductions, color: "rose" }].map((group) => group.items.length > 0 && (
          <div key={group.label}>
            <p className={`mb-2 text-[10px] font-black uppercase tracking-widest ${COMPONENT_STYLES[group.color].label}`}>{group.label}</p>
            <div className="space-y-2">
              {group.items.map((component) => (
                <div key={component.id} className={`flex items-center justify-between rounded-xl border p-3 ${COMPONENT_STYLES[group.color].row}`}>
                  <span className="text-sm font-semibold text-slate-700">{component.name} <span className="text-xs text-slate-400">({component.calc_type})</span></span>
                  <span className={`font-black ${COMPONENT_STYLES[group.color].value}`}>{money(component.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function EmployeeSalaryTab({ employeeId, refreshKey = 0 }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSalary, setSelectedSalary] = useState(null);
  const [salaryToEdit, setSalaryToEdit] = useState(null);
  const [salaryToRevise, setSalaryToRevise] = useState(null);
  const [salaryToDelete, setSalaryToDelete] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState("table");
  const fetchSalaries = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const response = await apiCall(`/salary/employee-salaries/${employeeId}`, "GET", null, getCompanyId());
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to load salary records");
      const data = Array.isArray(result.data) ? result.data : [];
      setRows(data);
    } catch (error) {
      setRows([]);
      toast.error(error.message || "Failed to load salary records");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { fetchSalaries(); }, [fetchSalaries, refreshKey]);

  const refresh = () => fetchSalaries();
  const closeSalaryModal = (setter) => { setter(null); };
  const handleDelete = async () => {
    if (!salaryToDelete) return;
    setDeleting(true);
    try {
      const response = await apiCall("/salary/delete-salary", "DELETE", { salary_id: salaryToDelete.salary_id }, getCompanyId());
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to delete salary");
      toast.success(result.message || "Salary deleted successfully");
      setSalaryToDelete(null);
      refresh();
    } catch (error) {
      toast.error(error.message || "Failed to delete salary");
    } finally {
      setDeleting(false);
    }
  };

  const actions = (salary) => [
    { label: "View Details", icon: <FaEye size={12} />, onClick: () => setSelectedSalary(salary), className: "text-blue-600 hover:bg-blue-50" },
    salary.payroll_used
      ? { label: "Revise Salary", icon: <FaExchangeAlt size={12} />, onClick: () => setSalaryToRevise(salary), className: "text-purple-600 hover:bg-purple-50" }
      : { label: "Edit Salary", icon: <FaEdit size={12} />, onClick: () => setSalaryToEdit(salary), className: "text-indigo-600 hover:bg-indigo-50" },
    { label: "Delete", icon: <FaTrash size={12} />, onClick: () => setSalaryToDelete(salary), className: "text-red-600 hover:bg-red-50" },
  ];

  const columns = [
    { key: "salary_id", label: "Salary ID", render: (salary) => <span className="font-mono text-xs text-purple-700">#{salary.salary_id}</span> },
    { key: "base_amount", label: "Base / Net", render: (salary) => <div><p className="text-sm font-semibold text-slate-800">{money(salary.base_amount)}</p><p className="text-[10px] font-bold text-emerald-600">Net {money(salary.net_salary)}</p></div> },
    { key: "ctc", label: "CTC", render: (salary) => <span className="text-sm font-semibold text-indigo-600">{money(salary.ctc)}</span> },
    { key: "effective_from", label: "Effective From", render: (salary) => formatDate(salary.effective_from) },
    { key: "status", label: "Status", render: (salary) => <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${salary.status === "current" ? "bg-green-100 text-green-800" : salary.status === "future" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}><FaCheckCircle size={10} />{salary.status || "past"}</span> },
  ];

  const cardRenderer = (salary, index) => (
    <ManagementCard key={salary.salary_id} accent="green" delay={index * 0.04} onClick={() => setSelectedSalary(salary)} actions={actions(salary)} hoverable title={`Salary #${salary.salary_id}`} subtitle={`${formatDate(salary.effective_from)} → ${salary.effective_to ? formatDate(salary.effective_to) : "Ongoing"}`} eyebrow="Salary Record" badge={<span className="text-xs font-bold text-emerald-700">{salary.status || "current"}</span>} footer={<div className="flex w-full justify-between text-xs text-slate-400"><span>CTC: {money(salary.ctc)}</span><span>Net: {money(salary.net_salary)}</span></div>}>
      <div className="grid grid-cols-3 gap-2"><div className="rounded-lg bg-blue-50 p-2 text-center"><p className="text-[9px] font-bold uppercase text-blue-500">Base</p><p className="text-xs font-black text-blue-700">{money(salary.base_amount)}</p></div><div className="rounded-lg bg-emerald-50 p-2 text-center"><p className="text-[9px] font-bold uppercase text-emerald-500">Net</p><p className="text-xs font-black text-emerald-700">{money(salary.net_salary)}</p></div><div className="rounded-lg bg-rose-50 p-2 text-center"><p className="text-[9px] font-bold uppercase text-rose-500">Deductions</p><p className="text-xs font-black text-rose-700">{money(salary.total_deductions)}</p></div></div>
    </ManagementCard>
  );

  return <div className="space-y-4">
    <div className="flex items-center justify-between rounded-xl bg-white p-2 shadow-lg"><p className="flex items-center gap-2 px-4 text-md font-semibold text-green-700"><FaMoneyBillWave size={12} />Salary</p><div className="flex items-center gap-2"><button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100"><FaPlus size={10} />Create</button>{rows.length > 0 && <ManagementViewSwitcher viewMode={viewMode} onChange={setViewMode} accent="green" />}</div></div>
    {loading ? <div className="flex flex-col items-center gap-2 py-10 text-slate-400"><FaSpinner className="animate-spin text-green-600" /><span className="text-sm">Loading salary records...</span></div> : rows.length === 0 ? <div className="py-12 text-center text-sm text-slate-400">No salary records found</div> : viewMode === "table" ? <ManagementTable rows={rows} columns={columns} rowKey="salary_id" onRowClick={setSelectedSalary} getActions={actions} accent="green" /> : <ManagementGrid viewMode={viewMode}>{rows.map(cardRenderer)}</ManagementGrid>}
    <SalaryDetailModal salary={selectedSalary} onClose={() => setSelectedSalary(null)} />
    <AssignSalaryModal isOpen={showCreate} onClose={() => setShowCreate(false)} onSuccess={refresh} initialEmployeeId={employeeId} companyCurrency="INR" />
    <EditSalaryModal isOpen={!!salaryToEdit} onClose={() => closeSalaryModal(setSalaryToEdit)} onSuccess={() => { closeSalaryModal(setSalaryToEdit); refresh(); }} salary={salaryToEdit} companyCurrency="INR" />
    <ReviseSalaryModal isOpen={!!salaryToRevise} onClose={() => closeSalaryModal(setSalaryToRevise)} onSuccess={() => { closeSalaryModal(setSalaryToRevise); fetchSalaries(); }} salary={salaryToRevise} companyCurrency="INR" />
    <DeleteConfirmModal isOpen={!!salaryToDelete} onClose={() => setSalaryToDelete(null)} onConfirm={handleDelete} salary={salaryToDelete} processingId={deleting ? salaryToDelete?.salary_id : null} />
  </div>;
}