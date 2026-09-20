import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaBook,
  FaChartBar,
  FaCheckCircle,
  FaChevronDown,
  FaChevronUp,
  FaClipboardCheck,
  FaClock,
  FaEnvelope,
  FaLifeRing,
  FaQuestionCircle,
  FaSearch,
  FaShieldAlt,
  FaStar,
  FaUserCheck,
  FaUsers,
} from "react-icons/fa";

const faqs = [
  {
    id: 1,
    category: "Getting started",
    question: "How do I mark employee attendance in OneAttendance?",
    answer:
      "Go to Attendance, select the relevant date and employee or team, then mark the status such as Present, Absent, or Late. Save your changes and the updated record will appear in the attendance dashboard and reports.",
  },
  {
    id: 2,
    category: "Getting started",
    question: "How do I add a new employee or invite someone to the workspace?",
    answer:
      "From Employee Management or the onboarding section, choose Add Staff or Invite Employee. Enter the team member details, assign the correct role, and send the invite. Once accepted, the user will appear in the employee list and can access their assigned features.",
  },
  {
    id: 3,
    category: "Attendance",
    question: "Can I correct a previously saved attendance entry?",
    answer:
      "Yes. Open Attendance History or the daily attendance screen, select the original date, update the employee status, and save again. The latest saved value is the one used in reports and summaries.",
  },
  {
    id: 4,
    category: "Attendance",
    question: "Why is an employee missing from the attendance list?",
    answer:
      "Check whether the employee is active, assigned to the correct company or team, and included in the selected filter. If they were added recently, refresh the page and confirm that the date and attendance view match the employee's schedule.",
  },
  {
    id: 5,
    category: "Leave & payroll",
    question: "How do I review and approve leave requests?",
    answer:
      "Open Leave Management, review each request from the list, and approve or reject it based on leave balance and policy. Approved leave updates the employee's leave summary and attendance calculations.",
  },
  {
    id: 6,
    category: "Leave & payroll",
    question: "How do payroll and salary records get generated?",
    answer:
      "Use Salary Management and Payroll Management to define salary packages, salary components, and payroll runs. You can review employee earnings, deductions, and adjustments before finalizing payouts.",
  },
  {
    id: 7,
    category: "Reports",
    question: "How do I view attendance or payroll trends for a date range?",
    answer:
      "Open the relevant report or analytics section, choose the company, employee or team, and the start and end dates. Filter by attendance, leave, or payroll to compare changes and identify patterns across the selected period.",
  },
  {
    id: 8,
    category: "Account & security",
    question: "What should I do if I cannot access my account or reset my password?",
    answer:
      "Use the login or reset flow available on the app and request a one-time code or password reset through your registered email. If the issue continues, contact your company admin or the OneAttendance support team with your registered email and company name.",
  },
  {
    id: 9,
    category: "Account & security",
    question: "How can I protect employee and company data in OneAttendance?",
    answer:
      "Only share access with the correct team members, assign roles carefully, and review permissions regularly. Sign out from shared devices, keep credentials private, and contact your admin if you notice unexpected activity in company settings or employee profiles.",
  },
];

const categories = ["All topics", ...new Set(faqs.map((faq) => faq.category))];

const quickTopics = [
  {
    title: "Attendance basics",
    description: "Track check-ins, review updates, and keep workforce records accurate.",
    icon: FaClipboardCheck,
    accent: "from-indigo-500 to-violet-500",
  },
  {
    title: "People & roles",
    description: "Add employees, assign responsibilities, and manage access across the company.",
    icon: FaUsers,
    accent: "from-cyan-500 to-sky-500",
  },
  {
    title: "Reports & insights",
    description: "Filter by date, team, and attendance trends for faster decision-making.",
    icon: FaChartBar,
    accent: "from-emerald-500 to-teal-500",
  },
];

const supportStats = [
  { value: "24/7", label: "Help coverage" },
  { value: "98%", label: "Satisfaction" },
  { value: "< 4 min", label: "Avg. response" },
];

const HelpPage = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All topics");

  const filteredFaqs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return faqs.filter((faq) => {
      const matchesCategory =
        activeCategory === "All topics" || faq.category === activeCategory;
      const matchesSearch =
        !query ||
        `${faq.question} ${faq.answer} ${faq.category}`
          .toLowerCase()
          .includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchTerm]);

  const toggleFaq = (id) => {
    setOpenFaq((currentId) => (currentId === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <main className="relative z-10 w-full pb-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full overflow-hidden bg-gradient-to-br from-indigo-700 via-violet-700 to-sky-700 text-white"
        >
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-12 left-8 h-32 w-32 rounded-full bg-cyan-300/15 blur-2xl" />

          <div className="relative mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-900/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-100">
                <FaStar className="text-[10px]" />
                OneAttendance support
              </div>

              <button
                type="button"
                onClick={() => navigate("/home")}
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                <FaArrowLeft className="text-[10px]" />
                Back to dashboard
              </button>
            </div>

            <div className="max-w-3xl">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                How can we help today?
              </h1>
              <p className="mt-3 max-w-2xl text-base text-indigo-100 sm:text-lg">
                Find the right guidance for attendance, onboarding, reporting, and security—without leaving your dashboard.
              </p>
            </div>

            <div className="relative mx-auto mt-8 max-w-2xl">
              <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-slate-400" />
              <label htmlFor="help-search" className="sr-only">
                Search help articles
              </label>
              <input
                id="help-search"
                type="search"
                placeholder="Search attendance help..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-2xl border border-white/20 bg-white py-4 pl-12 pr-4 text-slate-800 shadow-lg shadow-indigo-900/10 outline-none ring-0 transition focus:border-white focus:ring-4 focus:ring-white/20"
              />
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {supportStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"
                >
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="mt-1 text-sm text-indigo-100">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <div className="mx-auto mt-8 max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <section className="grid gap-4 md:grid-cols-3" aria-label="Help shortcuts">
            {quickTopics.map(({ title, description, icon: Icon, accent }) => (
              <motion.div
                key={title}
                whileHover={{ y: -4 }}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40"
              >
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-xl text-white`}>
                  <Icon />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </motion.div>
            ))}
          </section>

          <section
            id="getting-started"
            className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/30 sm:p-6 lg:p-7"
          >
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <FaCheckCircle className="text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">A simple workforce attendance workflow</h2>
                <p className="mt-2 max-w-2xl text-slate-600">
                  Set up your company structure first, then record attendance daily and use the reports dashboard to catch issues early.
                </p>
                <ol className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                  <li>
                    <span className="font-semibold text-slate-900">1. Set up:</span> Add employees, teams, and shift schedules.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-900">2. Record:</span> Mark each employee&apos;s attendance status.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-900">3. Review:</span> Filter reports by team, date, and attendance type.
                  </li>
                </ol>
              </div>
            </div>
          </section>

          <section id="faq" className="mt-8">
            <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
                  Knowledge base
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">Frequently asked questions</h2>
              </div>

              <div className="flex flex-wrap gap-2" aria-label="Filter by topic">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                      activeCategory === category
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {filteredFaqs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
                <FaQuestionCircle className="mx-auto text-3xl text-slate-300" />
                <p className="mt-3 text-lg font-medium text-slate-700">No help articles match your search.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setActiveCategory("All topics");
                  }}
                  className="mt-3 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFaqs.map((faq) => (
                  <motion.div
                    key={faq.id}
                    layout
                    className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(faq.id)}
                      aria-expanded={openFaq === faq.id}
                      className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-600">
                          {faq.category.slice(0, 2).toUpperCase()}
                        </span>
                        <span>
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600">
                            {faq.category}
                          </span>
                          <span className="block text-base font-semibold text-slate-900">{faq.question}</span>
                        </span>
                      </div>

                      {openFaq === faq.id ? (
                        <FaChevronUp className="shrink-0 text-slate-400" />
                      ) : (
                        <FaChevronDown className="shrink-0 text-slate-400" />
                      )}
                    </button>

                    <AnimatePresence initial={false}>
                      {openFaq === faq.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <p className="border-t border-slate-100 px-5 pb-5 pt-4 leading-7 text-slate-600">
                            {faq.answer}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8 rounded-2xl bg-slate-900 p-6 text-white shadow-sm shadow-slate-300/50 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200">
                  <FaLifeRing className="text-xl" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Still need help?</h2>
                  <p className="mt-1 max-w-lg text-sm text-slate-300">
                    Tell us what happened and include the date, team, or employee involved so we can help faster.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="mailto:support@oneattendance.com?subject=OneAttendance%20support%20request"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-indigo-100"
                >
                  <FaEnvelope className="mr-2 text-xs" />
                  Email support
                </a>
                <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                  <FaUserCheck className="text-indigo-300" />
                  Response within 1 business day
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default HelpPage;
