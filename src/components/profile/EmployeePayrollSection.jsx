import React from "react";
import EmployeePayrollTab from "./EmployeePayrollTab";
import EmployeePayrollAdjustmentsTab from "./EmployeePayrollAdjustmentsTab";

export default function EmployeePayrollSection({ employee, employeeId, refreshKey = 0 }) {
  const targetEmployeeId = employee?.id || employeeId;
  const employeeName = employee?.name;

  return (
    <div className="space-y-6">
      <EmployeePayrollTab employeeId={targetEmployeeId} refreshKey={refreshKey} />
      <EmployeePayrollAdjustmentsTab
        employeeId={targetEmployeeId}
        employeeName={employeeName}
        refreshKey={refreshKey}
      />
    </div>
  );
}
