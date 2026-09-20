import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  FaArrowRight,
  FaSearch,
} from "react-icons/fa";

const LegalLayout = ({ icon: Icon, accent, title, description, updated, sections, children }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSection, setActiveSection] = useState(sections[0]?.id || "");

  const visibleSections = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return sections;
    return sections.filter((section) => section.label.toLowerCase().includes(normalizedSearch));
  }, [searchTerm, sections]);

  useEffect(() => {
    const targets = sections
      .map((section) => document.getElementById(section.id))
      .filter(Boolean);

    if (!targets.length) return undefined;

    const updateActiveSection = () => {
      const headerOffset = 112;
      const currentTarget = targets.reduce((selected, target) => {
        return target.getBoundingClientRect().top <= headerOffset ? target : selected;
      }, targets[0]);
      setActiveSection(currentTarget.id);
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [sections]);

  const headerAction = () => {
    if (isAuthenticated) {
      return (
        <button
          type="button"
          onClick={() => navigate("/home")}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-blue-700 hover:to-indigo-700"
        >
          Go to Dashboard <FaArrowRight className="text-xs" />
        </button>
      );
    }

    return (
      <div className="flex items-center gap-1 sm:gap-2">
        <button type="button" onClick={() => navigate("/login")} className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50">Login</button>
        <button type="button" onClick={() => navigate("/signup")} className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-blue-700 hover:to-indigo-700 sm:px-4"> <span className="hidden xsm:inline">Free</span><span className="xsm:hidden">Get Started Free</span></button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 text-slate-800">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 shadow-lg backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-xl font-bold tracking-tight text-slate-900" aria-label="OneAttendance home">
            One<span className="text-blue-600">Attendance</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/public-subscription" className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 sm:inline-flex">View Pricing</Link>
            {headerAction()}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="lg:sticky lg:top-24 lg:h-fit" aria-label="Document navigation">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">On this page</p>
            <label htmlFor={`${title.replace(/\s+/g, "-").toLowerCase()}-search`} className="sr-only">Search terms</label>
            <div className="relative mb-3">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true" />
              <input
                id={`${title.replace(/\s+/g, "-").toLowerCase()}-search`}
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search terms..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <nav className="space-y-1" aria-label={`${title} sections`}>
              {visibleSections.length ? visibleSections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  aria-current={activeSection === section.id ? "location" : undefined}
                  className={`block rounded-r-lg border-l-2 px-3 py-2 text-sm transition ${activeSection === section.id ? "border-blue-600 bg-blue-50 font-semibold text-blue-700" : "border-transparent text-slate-600 hover:border-blue-200 hover:bg-slate-50 hover:text-blue-700"}`}
                >
                  {section.label}
                </a>
              )) : <p className="px-3 py-2 text-xs text-slate-400">No matching sections.</p>}
            </nav>
          </div>
        </aside>

        <motion.article initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 lg:p-10">
          <div className="flex items-start gap-4 border-b border-slate-200 pb-7">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accent.tint} ${accent.text}`}><Icon className="text-xl" aria-hidden="true" /></div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${accent.text}`}>OneAttendance legal</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
              <p className="mt-2 text-sm text-slate-500">{description}</p>
              <p className="mt-1 text-xs text-slate-400">Last updated: {updated}</p>
            </div>
          </div>
          <div className="mt-8 max-w-prose space-y-8 text-sm leading-[1.65] text-slate-600 sm:text-base">{children}</div>
        </motion.article>
      </main>

      <footer className="bg-slate-950 text-slate-300">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-sm">© 2026 OneAttendance. All rights reserved.</p>
          <nav aria-label="Legal and product links" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            <Link to="/public-subscription" className="transition-colors hover:text-white">Pricing</Link>
            <Link to="/privacy-policy" className="transition-colors hover:text-white">Privacy Policy</Link>
            <Link to="/data-deletion" className="transition-colors hover:text-white">Data Deletion</Link>
            <Link to="/terms" className="transition-colors hover:text-white">Terms of Service</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export const LegalHeading = ({ icon: Icon, children }) => (
  <h2 className="mb-3 flex items-center gap-3 text-xl font-semibold leading-7 text-slate-900">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
      <Icon className="text-sm" aria-hidden="true" />
    </span>
    {children}
  </h2>
);

export default LegalLayout;