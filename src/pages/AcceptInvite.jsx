import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaCheckCircle,
  FaEnvelopeOpenText,
  FaExclamationCircle,
  FaHome,
  FaShieldAlt,
  FaSignInAlt,
  FaSpinner,
  FaTimes,
  FaUserCheck,
} from "react-icons/fa";
import { toast } from "react-toastify";

import { API_BASE } from "../utils/api";

const STATUS_CONTENT = {
  pending: {
    icon: FaEnvelopeOpenText,
    iconClass: "text-blue-600 bg-blue-50",
    badgeClass: "border-blue-100 bg-blue-50 text-blue-700",
    badge: "Invite ready",
    title: "Confirm your invitation",
    description: "Review this invitation link and confirm when you are ready to accept it.",
  },
  loading: {
    icon: FaSpinner,
    iconClass: "text-blue-600 animate-spin bg-blue-50",
    badgeClass: "border-blue-100 bg-blue-50 text-blue-700",
    badge: "Processing invite",
    title: "Accepting your invitation",
    description: "Please wait while we verify your invitation link.",
  },
  success: {
    icon: FaCheckCircle,
    iconClass: "text-emerald-600 bg-emerald-50",
    badgeClass: "border-emerald-100 bg-emerald-50 text-emerald-700",
    badge: "Invitation accepted",
    title: "You're all set",
    description: "Your invitation has been accepted successfully. You can now sign in and continue.",
  },
  error: {
    icon: FaExclamationCircle,
    iconClass: "text-red-600 bg-red-50",
    badgeClass: "border-red-100 bg-red-50 text-red-700",
    badge: "Unable to accept",
    title: "Invitation could not be accepted",
    description: "This invitation link may be invalid, expired, cancelled, or already used.",
  },
};

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim();
  const requestStarted = useRef(false);
  const toastId = useRef(null);
  const [status, setStatus] = useState(token ? "pending" : "error");
  const [showConfirmModal, setShowConfirmModal] = useState(!!token);
  const [message, setMessage] = useState(
    token ? "" : "Invitation token is missing from the link."
  );

  useEffect(() => {
    if (!token) {
      if (!requestStarted.current) {
        requestStarted.current = true;
        toast.error("Invitation token is missing from the link.");
      }
      return;
    }
  }, [token]);

  const handleAcceptInvite = async () => {
    if (requestStarted.current) return;

    requestStarted.current = true;
    setShowConfirmModal(false);
    setStatus("loading");
    setMessage("");

    toastId.current = toast.loading("Accepting invitation...");

    try {
      const response = await fetch(
        `${API_BASE}/company/invites/accept-invite?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
        }
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Failed to accept invitation.");
      }

      const successMessage = result.message || "Invitation accepted successfully.";
      setStatus("success");
      setMessage(successMessage);
      toast.update(toastId.current, {
        render: successMessage,
        type: "success",
        isLoading: false,
        autoClose: 3000,
        closeOnClick: true,
      });
    } catch (error) {
      const errorMessage = error.message || "Failed to accept invitation.";
      setStatus("error");
      setMessage(errorMessage);
      toast.update(toastId.current, {
        render: errorMessage,
        type: "error",
        isLoading: false,
        autoClose: 4000,
        closeOnClick: true,
      });
    }
  };

  const content = STATUS_CONTENT[status];
  const StatusIcon = content.icon;
  const isLoading = status === "loading";
  const canAccept = !!token && status === "pending";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-8 font-sans">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl"
        >
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-5 text-white sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white shadow-sm ring-1 ring-white/20">
                  <FaEnvelopeOpenText size={22} />
                </div>
                <div>
                  <p className="text-lg font-black leading-tight">OneAttendance</p>
                  <p className="text-sm text-blue-50">Company invitation</p>
                </div>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
                <FaShieldAlt size={12} />
                Secure invite
              </div>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="border-b border-gray-100 bg-gradient-to-br from-gray-50 to-blue-50/60 p-6 lg:border-b-0 lg:border-r sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <FaUserCheck size={11} />
                Invite access
              </div>
              <h1 className="mt-4 text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
                Accept your company invitation
              </h1>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                This public link verifies your invite token and connects your account to the invited company.
              </p>

              {token && (
                <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Invite token
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-600">{token}</p>
                </div>
              )}
            </div>

            <div className="p-6 text-center sm:p-10">
              <motion.div
                key={status}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className={`mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl ${content.iconClass}`}
              >
                <StatusIcon size={48} />
              </motion.div>

              <div
                className={`mb-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${content.badgeClass}`}
              >
                {content.badge}
              </div>

              <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">
                {content.title}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
                {message || content.description}
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                {canAccept && (
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-100 transition hover:shadow-xl sm:w-auto"
                  >
                    <FaCheckCircle size={14} />
                    Accept invitation
                  </button>
                )}
                <Link
                  to="/login"
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg transition sm:w-auto ${
                    isLoading
                      ? "pointer-events-none bg-slate-400 shadow-slate-100"
                      : "bg-gradient-to-r from-blue-600 to-purple-600 shadow-blue-100 hover:shadow-xl"
                  }`}
                >
                  <FaSignInAlt size={14} />
                  Sign in
                </Link>
                <Link
                  to="/"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                >
                  <FaHome size={14} />
                  Go home
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showConfirmModal && token && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
            onClick={() => !isLoading && setShowConfirmModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <FaEnvelopeOpenText size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Accept invitation?</h3>
                    <p className="text-xs text-slate-500">This will connect your account to the invited company.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 text-slate-500 transition hover:bg-slate-50"
                >
                  <FaTimes size={14} />
                </button>
              </div>

              <div className="p-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Invite token
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-600">{token}</p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAcceptInvite}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-100 transition hover:shadow-xl"
                >
                  <FaCheckCircle size={14} />
                  Confirm accept
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
