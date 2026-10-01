import React from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { FaArrowRight } from "react-icons/fa";
import BrandLogo from "../../components/BrandLogo";

const LegalLayout = ({ icon: Icon, accent, title, description, updated, children }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

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
          <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900" aria-label="OneAttendance home">
            <BrandLogo className="h-9 w-9" />
            One<span className="text-blue-600">Attendance</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/pricing" className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 sm:inline-flex">View Pricing</Link>
            {headerAction()}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
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
            <Link to="/pricing" className="transition-colors hover:text-white">Pricing</Link>
            <Link to="/privacy-policy" className="transition-colors hover:text-white">Privacy Policy</Link>
            <Link to="/terms" className="transition-colors hover:text-white">Terms of Service</Link>
            <Link to="/refund-policy" className="transition-colors hover:text-white">Refund Policy</Link>
            <Link to="/disclaimer" className="transition-colors hover:text-white">Disclaimer</Link>
            <Link to="/cookie-policy" className="transition-colors hover:text-white">Cookie Policy</Link>
            <Link to="/shipping-policy" className="transition-colors hover:text-white">Shipping Policy</Link>
            <Link to="/data-deletion" className="transition-colors hover:text-white">Data Deletion</Link>
            <Link to="/grievance" className="transition-colors hover:text-white">Grievance</Link>
            <Link to="/contact" className="transition-colors hover:text-white">Contact</Link>
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