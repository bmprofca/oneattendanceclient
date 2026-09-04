import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBook,
  FaCheckCircle,
  FaChevronDown,
  FaChevronUp,
  FaClipboardCheck,
  FaEnvelope,
  FaQuestionCircle,
  FaSearch,
  FaShieldAlt,
  FaUsers,
} from "react-icons/fa";

const faqs = [
  {
    id: 1,
    category: "Getting started",
    question: "How do I mark attendance for a class?",
    answer:
      "Open Attendance from the main navigation, select the class and date, then choose Present, Absent, or Late for each student. Select Save attendance when you are finished. You can return to the same date later to make an update.",
  },
  {
    id: 2,
    category: "Getting started",
    question: "How do I add a student or teacher?",
    answer:
      "Open the relevant Students or Teachers section and select Add new. Enter the required details, review them, and save. New users will appear in the list immediately and can be assigned to classes from the class management screen.",
  },
  {
    id: 3,
    category: "Attendance",
    question: "Can I correct attendance after it has been saved?",
    answer:
      "Yes. Select the class and the original attendance date, change the student's status, and save again. The latest saved status is used in attendance reports.",
  },
  {
    id: 4,
    category: "Attendance",
    question: "Why is a student missing from the attendance list?",
    answer:
      "Check that the student is active and assigned to the selected class. If the student was added recently, refresh the page and confirm that you are viewing the correct class and date.",
  },
  {
    id: 5,
    category: "Reports",
    question: "How do I view attendance for a specific date range?",
    answer:
      "Go to Reports and choose the class, start date, and end date. The summary shows attendance totals and percentages for the selected period. Adjust the filters and select Apply to refresh the results.",
  },
  {
    id: 6,
    category: "Account",
    question: "What should I do if I forget my password?",
    answer:
      "Select Forgot password on the sign-in page and enter your registered email address. Follow the link in the email to create a new password. If you do not receive it, check your spam folder or contact support.",
  },
  {
    id: 7,
    category: "Account",
    question: "How can I keep attendance data secure?",
    answer:
      "Use a unique password, sign out on shared devices, and only give staff the access they need. Avoid sharing account credentials. Contact an administrator if you notice an unfamiliar change in your data.",
  },
];

const categories = ["All topics", ...new Set(faqs.map((faq) => faq.category))];

const HelpPage = () => {
  const [openFaq, setOpenFaq] = useState(null);
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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3" aria-label="OneAttendance home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <FaClipboardCheck className="text-xl" />
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              OneAttendance
            </span>
          </a>
          <a
            href="/"
            className="text-sm font-medium text-indigo-600 transition hover:text-indigo-800"
          >
            Back to dashboard
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-indigo-700 px-6 py-12 text-center text-white shadow-lg sm:px-10"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-indigo-200">
            OneAttendance support
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">How can we help?</h1>
          <p className="mx-auto mt-3 max-w-2xl text-indigo-100">
            Find clear answers about recording attendance, managing people, and
            understanding your reports.
          </p>
          <div className="relative mx-auto mt-8 max-w-2xl">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <label htmlFor="help-search" className="sr-only">
              Search help articles
            </label>
            <input
              id="help-search"
              type="search"
              placeholder="Search attendance help..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-xl border-0 py-4 pl-12 pr-4 text-slate-800 shadow-sm outline-none ring-indigo-300 transition focus:ring-4"
            />
          </div>
        </motion.section>

        <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Help shortcuts">
          <a href="#faq" className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
            <FaBook className="mb-4 text-2xl text-indigo-600" />
            <h2 className="font-semibold text-slate-900">Browse help articles</h2>
            <p className="mt-1 text-sm text-slate-500">Find answers to common attendance questions.</p>
          </a>
          <a href="#getting-started" className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
            <FaUsers className="mb-4 text-2xl text-indigo-600" />
            <h2 className="font-semibold text-slate-900">Start with the basics</h2>
            <p className="mt-1 text-sm text-slate-500">Learn the essential steps for your first day.</p>
          </a>
          <a href="mailto:support@oneattendance.com" className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
            <FaEnvelope className="mb-4 text-2xl text-indigo-600" />
            <h2 className="font-semibold text-slate-900">Contact support</h2>
            <p className="mt-1 text-sm text-slate-500">Email support@oneattendance.com for help.</p>
          </a>
        </section>

        <section id="getting-started" className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            <FaCheckCircle className="mt-1 shrink-0 text-xl text-emerald-500" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">A simple attendance workflow</h2>
              <p className="mt-2 text-slate-600">
                Set up your people and classes first, then record attendance daily and use Reports to spot trends.
              </p>
              <ol className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                <li><strong className="text-slate-900">1. Set up:</strong> Add teachers, students, and classes.</li>
                <li><strong className="text-slate-900">2. Record:</strong> Mark each student&apos;s status.</li>
                <li><strong className="text-slate-900">3. Review:</strong> Filter reports by class and date.</li>
              </ol>
            </div>
          </div>
        </section>

        <section id="faq" className="mt-10">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Knowledge base</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Frequently asked questions</h2>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Filter by topic">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    activeCategory === category
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {filteredFaqs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <FaQuestionCircle className="mx-auto text-3xl text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">No help articles match your search.</p>
              <button type="button" onClick={() => { setSearchTerm(""); setActiveCategory("All topics"); }} className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-800">
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFaqs.map((faq) => (
                <div key={faq.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleFaq(faq.id)}
                    aria-expanded={openFaq === faq.id}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-slate-50"
                  >
                    <span>
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-indigo-600">{faq.category}</span>
                      <span className="font-semibold text-slate-900">{faq.question}</span>
                    </span>
                    {openFaq === faq.id ? <FaChevronUp className="shrink-0 text-slate-400" /> : <FaChevronDown className="shrink-0 text-slate-400" />}
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaq === faq.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                        <p className="border-t border-slate-100 px-5 pb-5 pt-4 leading-relaxed text-slate-600">{faq.answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-start gap-4">
            <FaShieldAlt className="mt-1 text-xl text-indigo-300" />
            <div>
              <h2 className="font-semibold">Still need help?</h2>
              <p className="mt-1 text-sm text-slate-300">Tell us what happened and include the class or date you were working with.</p>
            </div>
          </div>
          <a href="mailto:support@oneattendance.com?subject=OneAttendance%20support%20request" className="shrink-0 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-indigo-100">
            Email support
          </a>
        </section>
      </main>
    </div>
  );
};

export default HelpPage;
