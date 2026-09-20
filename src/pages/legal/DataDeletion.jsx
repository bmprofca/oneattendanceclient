import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaCheckCircle, FaEnvelope, FaInfoCircle, FaSpinner, FaTrashAlt, FaUserSlash } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import apiCall from "../../utils/api";
import LegalLayout, { LegalHeading } from "./LegalLayout";

const DataDeletion = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState("confirm");
  const [confirmation, setConfirmation] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => { if (user?.email) setEmail(user.email); }, [user?.email]);

  const requestOtp = async () => {
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || normalizedEmail !== user?.email?.trim().toLowerCase()) { setError("Enter the email address currently linked to your account."); return; }
    setBusy(true);
    try {
      const response = await apiCall("/users/delete/request-otp", "POST", { email: normalizedEmail });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to send the deletion code.");
      setStep("otp");
    } catch (requestError) { setError(requestError.message || "Unable to send the deletion code. Try again."); }
    finally { setBusy(false); }
  };

  const confirmDeletion = async () => {
    setError("");
    if (otp.length !== 6) { setError("Enter the six-digit code sent to your email."); return; }
    setBusy(true);
    try {
      const response = await apiCall("/users/delete/confirm", "DELETE", { email: email.trim().toLowerCase(), otp });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to delete the account.");
      localStorage.removeItem("token");
      localStorage.removeItem("company");
      setSuccess(true);
    } catch (requestError) { setError(requestError.message || "Unable to delete the account. Try again."); }
    finally { setBusy(false); }
  };

  const sections = [{ id: "overview", label: "Overview" }, { id: "signed-in", label: "Signed-in deletion" }, { id: "social", label: "Connected accounts" }, { id: "contact", label: "Need help" }];

  return (
    <LegalLayout icon={FaTrashAlt} accent={{ tint: "bg-red-100", text: "text-red-600" }} title="Data Deletion" description="Delete your OneAttendance account through a verified, authenticated request." updated="September 21, 2026" sections={sections}>
      <section id="overview" className="rounded-xl border border-blue-100 bg-blue-50 p-5"><LegalHeading icon={FaInfoCircle}>What deletion does</LegalHeading><p className="text-blue-900">The account deletion workflow deactivates your user account and active sessions, marks your employee memberships deleted, and removes your access to OneAttendance. It is irreversible. Users who own an active company must transfer ownership first because company records and other members depend on that workspace.</p></section>

      <section id="signed-in"><LegalHeading icon={FaUserSlash}>Delete while signed in</LegalHeading>{!user ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-5"><p>You must be signed in to start an account deletion request. After signing in, return to this page to verify your email and request the one-time code.</p><Link to="/login" className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700">Sign in to delete your account</Link></div> : success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900" role="status"><FaCheckCircle className="mb-3 text-2xl text-emerald-600" /><h3 className="font-bold">Account deletion completed</h3><p className="mt-1">Your account and active sessions have been deactivated. You can return to the sign-in page.</p><button type="button" onClick={() => navigate("/login", { replace: true })} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800">Continue to sign in</button></div> : <div className="rounded-xl border border-red-100 bg-red-50/50 p-5"><div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-bold text-red-700" aria-label={`Deletion step ${step === "confirm" ? "1" : step === "email" ? "2" : "3"} of 3`}><span className={step === "confirm" ? "rounded-full bg-red-600 px-2 py-1 text-white" : "rounded-full bg-red-100 px-2 py-1"}>1 Confirm</span><span className="text-red-300">/</span><span className={step === "email" ? "rounded-full bg-red-600 px-2 py-1 text-white" : "rounded-full bg-red-100 px-2 py-1"}>2 Email</span><span className="text-red-300">/</span><span className={step === "otp" ? "rounded-full bg-red-600 px-2 py-1 text-white" : "rounded-full bg-red-100 px-2 py-1"}>3 OTP</span></div>{error && <p className="mb-4 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}{step === "confirm" && <form onSubmit={(event) => { event.preventDefault(); if (confirmation === "DELETE") setStep("email"); }} className="space-y-4"><p className="text-sm text-red-900">This permanently removes access and cannot be undone. Type <strong>DELETE</strong> to continue.</p><label className="block text-sm font-semibold text-slate-700" htmlFor="delete-confirmation">Confirmation</label><input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} className="w-full rounded-lg border border-red-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-400" autoComplete="off" /><button type="submit" disabled={confirmation !== "DELETE"} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">Continue</button></form>}{step === "email" && <form onSubmit={(event) => { event.preventDefault(); requestOtp(); }} className="space-y-4"><label className="block text-sm font-semibold text-slate-700" htmlFor="delete-email">Confirm your account email</label><input id="delete-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-red-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-400" autoComplete="email" required /><div className="flex flex-wrap gap-3"><button type="button" onClick={() => setStep("confirm")} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Back</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50">{busy && <FaSpinner className="animate-spin" />} {busy ? "Sending code..." : "Send deletion code"}</button></div></form>}{step === "otp" && <form onSubmit={(event) => { event.preventDefault(); confirmDeletion(); }} className="space-y-4"><p className="text-sm text-slate-600">Enter the six-digit code sent to <strong>{email}</strong>.</p><label className="block text-sm font-semibold text-slate-700" htmlFor="delete-otp">One-time code</label><input id="delete-otp" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} className="w-full rounded-lg border border-red-200 bg-white px-3 py-3 text-center font-mono text-xl tracking-[0.45em] outline-none focus:ring-2 focus:ring-red-400" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /><div className="flex flex-wrap gap-3"><button type="button" onClick={() => { setStep("email"); setOtp(""); setError(""); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Change email</button><button type="submit" disabled={busy || otp.length !== 6} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-50">{busy && <FaSpinner className="animate-spin" />} {busy ? "Deleting account..." : "Delete my account"}</button></div><button type="button" onClick={requestOtp} disabled={busy} className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-50">Resend code</button></form>}</div>}</section>

      <section id="social"><LegalHeading icon={FaInfoCircle}>Connected sign-in accounts</LegalHeading><p>If you used a supported social sign-in provider, you can also remove OneAttendance from that provider&apos;s connected-app settings. That revokes the provider connection; to delete the OneAttendance account and its server-side records, complete the authenticated workflow above.</p></section>
      <section id="contact" className="rounded-xl border border-slate-200 bg-slate-50 p-5"><LegalHeading icon={FaEnvelope}>Need help?</LegalHeading><p>Contact <a className="font-semibold text-blue-600 hover:underline" href="mailto:support@onesaas.in">support@onesaas.in</a> from your registered email. Never include an OTP or password in your message.</p></section>
    </LegalLayout>
  );
};

export default DataDeletion;
