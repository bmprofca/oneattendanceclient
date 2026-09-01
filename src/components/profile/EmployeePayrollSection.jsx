import React, { useEffect, useState } from "react";
import { FaCoins, FaMoneyBillWave } from "react-icons/fa";
import EmployeePayrollTab from "./EmployeePayrollTab";
import EmployeePayrollAdjustmentsTab from "./EmployeePayrollAdjustmentsTab";

const PAYROLL_SUB_TABS = [
  { key: "payroll", label: "Payroll", icon: FaMoneyBillWave },
  { key: "adjustments", label: "Adjustments", icon: FaCoins },
];

export default function EmployeePayrollSection({ employee, employeeId, refreshKey = 0 }) {
  const targetEmployeeId = employee?.id || employeeId;
  const employeeName = employee?.name;
  const [activeSubTab, setActiveSubTab] = useState("payroll");

  useEffect(() => {
    setActiveSubTab("payroll");
  }, [targetEmployeeId]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {PAYROLL_SUB_TABS.map((tab) => {
            const isActive = activeSubTab === tab.key;
            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveSubTab(tab.key)}
                className={[
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-200",
                  isActive
                    ? "border-indigo-200 bg-indigo-600 text-white shadow-sm"
                    : "border-transparent bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-100",
                ].join(" ")}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-3">
        {activeSubTab === "payroll" ? (
          <EmployeePayrollTab employeeId={targetEmployeeId} refreshKey={refreshKey} />
        ) : (
          <EmployeePayrollAdjustmentsTab
            employeeId={targetEmployeeId}
            employeeName={employeeName}
            refreshKey={refreshKey}
          />
        )}
      </div>
    </div>
  );
}
