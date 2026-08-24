import React, { useState } from "react";
import { FaUmbrellaBeach, FaCalendarPlus } from "react-icons/fa";
import EmployeeLeaveRequestsTab from "./EmployeeLeaveRequestsTab";
import EmployeeLeaveBalancesTab from "./EmployeeLeaveBalancesTab";

export default function EmployeeLeavesTab({ employee, employeeId, refreshKey = 0 }) {
  const [subTab, setSubTab] = useState("requests"); // "requests" | "balances"
  const targetEmployeeId = employee?.id || employeeId;
  const employeeName = employee?.name;

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => setSubTab("requests")}
          className={`inline-flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all ${
            subTab === "requests"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-gray-600 hover:text-amber-700 hover:bg-amber-50"
          }`}
        >
          <FaUmbrellaBeach size={12} />
          <span>Leave Requests</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab("balances")}
          className={`inline-flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all ${
            subTab === "balances"
              ? "bg-violet-600 text-white shadow-sm"
              : "text-gray-600 hover:text-violet-700 hover:bg-violet-50"
          }`}
        >
          <FaCalendarPlus size={12} />
          <span>Leave Balances & Quotas</span>
        </button>
      </div>

      {/* Sub-tab Content */}
      {subTab === "requests" ? (
        <EmployeeLeaveRequestsTab
          key={`leaves-req-${targetEmployeeId}-${refreshKey}`}
          employeeId={targetEmployeeId}
          employeeName={employeeName}
        />
      ) : (
        <EmployeeLeaveBalancesTab
          key={`leaves-bal-${targetEmployeeId}-${refreshKey}`}
          employeeId={targetEmployeeId}
          employeeName={employeeName}
        />
      )}
    </div>
  );
}
