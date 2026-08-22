import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import apiCall from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import Skeleton from "../components/SkeletonComponent";
import { ManagementHub } from "../components/common";
import AdvancedDateFilter from "../components/AdvancedDateFilter";
import {
  FaMoneyBillWave,
  FaArrowUp,
  FaArrowDown,
  FaCalendarAlt,
  FaInfoCircle,
  FaChevronLeft,
  FaChevronRight,
  FaExclamationTriangle,
} from "react-icons/fa";

export default function MySalary() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salaryData, setSalaryData] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchSalary = useCallback(async (m, y) => {
    try {
      setLoading(true);
      const companyId = JSON.parse(localStorage.getItem("company"))?.id;
      if (!companyId) {
        toast.error("Company information not found");
        setSalaryData(null);
        return;
      }

      const res = await apiCall(
        `/salary/my-salary?month=${m}&year=${y}`,
        "GET",
        null,
        companyId
      );
      const data = await res.json();

      if (data.success) {
        setSalaryData(data.data);
      } else {
        setSalaryData(null);
        toast.error(data.message || "Failed to fetch salary details");
      }
    } catch (error) {
      setSalaryData(null);
      toast.error("Error fetching salary details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSalary(month, year);
  }, [month, year, fetchSalary]);

  const handleFilterChange = (filter) => {
    if (filter.month && filter.year) {
      setMonth(filter.month);
      setYear(filter.year);
    }
  };

  const navigateMonth = (dir) => {
    let newMonth = month + dir;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    setMonth(newMonth);
    setYear(newYear);
  };

  const monthName = new Date(year, month - 1, 1).toLocaleString("default", {
    month: "long",
  });

  const tabs = [
    { id: "overview", label: "Overview", icon: FaInfoCircle },
    { id: "earnings", label: "Earnings", icon: FaArrowUp },
    { id: "deductions", label: "Deductions", icon: FaArrowDown },
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <ManagementHub
      eyebrow={
        <>
          <FaMoneyBillWave size={11} /> My Salary
        </>
      }
      title="My Salary"
      description="View your salary breakdown and components for any month."
      accent="emerald"
      onRefresh={() => fetchSalary(month, year)}
      refreshing={loading}
    >
      <div className="max-w-screen-2xl mx-auto px-4 pb-12">
        {/* Month / Year selector - always visible */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateMonth(-1)}
              className="w-8 h-8 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all shadow-sm"
            >
              <FaChevronLeft size={11} />
            </button>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight min-w-[180px] text-center">
              {monthName} {year}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="w-8 h-8 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all shadow-sm"
            >
              <FaChevronRight size={11} />
            </button>
            <AdvancedDateFilter
              value={{ month, year }}
              onChange={handleFilterChange}
              tabOptions={["month"]}
              placeholder="Jump to month"
              buttonClassName="bg-white border border-gray-100 px-3 py-2 rounded-xl shadow-sm hover:bg-gray-50 transition-all font-bold text-gray-600 text-xs"
            />
          </div>
        </div>

        {/* Content area */}
        {loading ? (
          <Skeleton />
        ) : salaryData ? (
          <div className="space-y-6">
            {/* Main Info Card */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl p-4 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-xl blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-900/20 rounded-xl blur-3xl -ml-10 -mb-10 pointer-events-none"></div>

              <div className="relative z-10">
                <div className="text-emerald-100 text-sm font-medium mb-2 uppercase tracking-wider">
                  Net Salary (Monthly)
                </div>
                <div className="text-2xl sm:text-3xl font-black mb-4 tracking-tight">
                  {formatCurrency(salaryData.net_salary)}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-emerald-500/30">
                  <div>
                    <div className="text-emerald-200 text-xs uppercase tracking-wider mb-1">
                      Base Amount
                    </div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(salaryData.base_amount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-emerald-200 text-xs uppercase tracking-wider mb-1">
                      Total Earnings
                    </div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(salaryData.total_earnings)}
                    </div>
                  </div>
                  <div>
                    <div className="text-emerald-200 text-xs uppercase tracking-wider mb-1">
                      Total Deductions
                    </div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(salaryData.total_deductions)}
                    </div>
                  </div>
                  <div>
                    <div className="text-emerald-200 text-xs uppercase tracking-wider mb-1">
                      Effective Date
                    </div>
                    <div className="text-lg font-semibold flex items-center gap-2">
                      <FaCalendarAlt className="text-emerald-300" />
                      {salaryData.effective_from
                        ? new Date(salaryData.effective_from).toLocaleDateString(
                            "en-US",
                            { month: "short", year: "numeric" }
                          )
                        : "N/A"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2 custom-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-medium transition-all duration-200 border-b-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "text-emerald-600 border-emerald-600 bg-emerald-50/50"
                      : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <tab.icon
                    className={
                      activeTab === tab.id ? "text-emerald-500" : "text-slate-400"
                    }
                  />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 min-h-[300px]">
              <AnimatePresence mode="wait">
                {activeTab === "overview" && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid gap-6 sm:grid-cols-2"
                  >
                    <div className="p-5 rounded-xl border border-emerald-100 bg-emerald-50/30">
                      <h3 className="text-emerald-800 font-semibold mb-4 flex items-center gap-2">
                        <FaArrowUp className="text-emerald-500" /> Earnings Summary
                      </h3>
                      <div className="space-y-3">
                        {salaryData.earnings?.map((e) => (
                          <div
                            key={e.component_id}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-slate-600">{e.name}</span>
                            <span className="font-medium text-slate-800">
                              {formatCurrency(e.amount)}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-bold pt-3 border-t border-emerald-200 text-emerald-700">
                          <span>Total Earnings</span>
                          <span>{formatCurrency(salaryData.total_earnings)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 rounded-xl border border-rose-100 bg-rose-50/30">
                      <h3 className="text-rose-800 font-semibold mb-4 flex items-center gap-2">
                        <FaArrowDown className="text-rose-500" /> Deductions Summary
                      </h3>
                      {salaryData.deductions?.length > 0 ? (
                        <div className="space-y-3">
                          {salaryData.deductions.map((d) => (
                            <div
                              key={d.component_id}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-slate-600">{d.name}</span>
                              <span className="font-medium text-slate-800">
                                {formatCurrency(d.amount)}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between text-sm font-bold pt-3 border-t border-rose-200 text-rose-700">
                            <span>Total Deductions</span>
                            <span>{formatCurrency(salaryData.total_deductions)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500 italic">
                          No deductions applied.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === "earnings" && (
                  <motion.div
                    key="earnings"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {salaryData.earnings?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                          <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3 rounded-tl-lg">
                                Component Code
                              </th>
                              <th className="px-4 py-3">Name</th>
                              <th className="px-4 py-3">Calculation</th>
                              <th className="px-4 py-3 text-right rounded-tr-lg">
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {salaryData.earnings.map((e) => (
                              <tr
                                key={e.component_id}
                                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                              >
                                <td className="px-4 py-3 font-medium text-slate-800">
                                  <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs">
                                    {e.code}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-slate-800">
                                    {e.name}
                                  </div>
                                  {e.is_taxable && (
                                    <div className="text-[10px] text-slate-400">
                                      Taxable
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {e.calc_type === "percentage"
                                    ? `${e.calc_value}%`
                                    : "Flat Amount"}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                                  {formatCurrency(e.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        No earnings configured.
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "deductions" && (
                  <motion.div
                    key="deductions"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {salaryData.deductions?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                          <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3 rounded-tl-lg">
                                Component Code
                              </th>
                              <th className="px-4 py-3">Name</th>
                              <th className="px-4 py-3">Calculation</th>
                              <th className="px-4 py-3 text-right rounded-tr-lg">
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {salaryData.deductions.map((d) => (
                              <tr
                                key={d.component_id}
                                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                              >
                                <td className="px-4 py-3 font-medium text-slate-800">
                                  <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs">
                                    {d.code}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800">
                                  {d.name}
                                </td>
                                <td className="px-4 py-3">
                                  {d.calc_type === "percentage"
                                    ? `${d.calc_value}%`
                                    : "Flat Amount"}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-rose-600">
                                  {formatCurrency(d.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        No deductions applied.
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 bg-white rounded-xl shadow-xl border border-gray-100"
          >
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaExclamationTriangle className="text-3xl text-emerald-400" />
            </div>
            <p className="text-xl font-black text-gray-700">No salary data found</p>
            <p className="text-gray-400 mt-2 max-w-md mx-auto">
              Your salary structure for {monthName} {year} is not available.
              Try selecting another month or contact HR if you believe this is an error.
            </p>
            <button
              onClick={() => {
                const now = new Date();
                setMonth(now.getMonth() + 1);
                setYear(now.getFullYear());
              }}
              className="mt-4 px-5 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-xs uppercase tracking-widest border border-emerald-100 hover:bg-emerald-100 transition-all"
            >
              Go to Current Month
            </button>
          </motion.div>
        )}
      </div>
    </ManagementHub>
  );
}