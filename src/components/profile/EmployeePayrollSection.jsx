import React, { useEffect, useState } from "react";
import { FaCoins, FaMoneyBillWave, FaHistory } from "react-icons/fa";
import EmployeePayrollTab from "./EmployeePayrollTab";
import EmployeePayrollAdjustmentsTab from "./EmployeePayrollAdjustmentsTab";

const PAYROLL_TABS = [
  { key: "generated", label: "Generated Payrolls", icon: FaMoneyBillWave },
  { key: "preview", label: "Preview Payrolls", icon: FaHistory },
  { key: "adjustments", label: "Adjustments", icon: FaCoins },
];

export default function EmployeePayrollSection({ employee, employeeId, refreshKey = 0 }) {
  const targetEmployeeId = employee?.id || employeeId;
  const employeeName = employee?.name;
  const [activeTab, setActiveTab] = useState("generated");

  useEffect(() => {
    setActiveTab("generated");
  }, [targetEmployeeId]);

  const tabConfig = {
    generated: { activeClass: "bg-emerald-500", hoverClass: "hover:text-emerald-700 hover:bg-emerald-50" },
    preview: { activeClass: "bg-blue-600", hoverClass: "hover:text-blue-700 hover:bg-blue-50" },
    adjustments: { activeClass: "bg-amber-500", hoverClass: "hover:text-amber-700 hover:bg-amber-50" },
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm">
        {PAYROLL_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          const config = tabConfig[tab.key];

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all ${
                isActive
                  ? `${config.activeClass} text-white shadow-sm`
                  : `text-gray-600 ${config.hoverClass}`
              }`}
            >
              <Icon size={12} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "generated" || activeTab === "preview" ? (
          <EmployeePayrollTab 
            employeeId={targetEmployeeId} 
            refreshKey={refreshKey}
            filterType={activeTab}
          />
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
