import React from "react";
import { Link } from "react-router-dom";
import { FaDatabase, FaEnvelope, FaGlobe, FaLock, FaShieldAlt, FaUserShield } from "react-icons/fa";
import LegalLayout, { LegalHeading } from "./LegalLayout";

const PrivacyPolicy = () => {
  const sections = [
    { id: "scope", label: "Scope" },
    { id: "collect", label: "Information we collect" },
    { id: "use", label: "How we use information" },
    { id: "sharing", label: "Service providers" },
    { id: "retention", label: "Retention and deletion" },
    { id: "security", label: "Security" },
    { id: "contact", label: "Contact" },
  ];

  return (
    <LegalLayout icon={FaShieldAlt} accent={{ tint: "bg-indigo-100", text: "text-indigo-600" }} title="Privacy Policy" description="How OneSaaS India Pvt. Ltd. handles information in OneAttendance." updated="September 21, 2026" sections={sections}>
      <section id="scope"><LegalHeading icon={FaGlobe}>1. Scope</LegalHeading><p>This policy applies to the OneAttendance web portal, mobile applications, and related services operated by OneSaaS India Pvt. Ltd. ("OneSaaS", "we", "us", or "our"). OneAttendance helps companies manage employees, attendance, leave, payroll, permissions, subscriptions, and related workforce records.</p></section>

      <section id="collect"><LegalHeading icon={FaDatabase}>2. Information we collect</LegalHeading><div className="space-y-3"><p><strong className="text-slate-900">Account and profile information.</strong> We store the name, email address, phone number, profile image, profession, WhatsApp number, authentication provider, and account status that you provide or that is returned by an enabled sign-in provider.</p><p><strong className="text-slate-900">Authentication and device information.</strong> Login sessions record the session token, sign-in provider, platform, device name, IP address, optional sign-in coordinates, expiry, and activity timestamps so sessions can be secured and managed.</p><p><strong className="text-slate-900">Company and workforce records.</strong> Company owners and authorized users may enter company details, employee profiles, roles, permissions, invitations, shift settings, leave records, salary and payroll information, ledger transactions, and bank-account details.</p><p><strong className="text-slate-900">Attendance and device signals.</strong> Depending on a company&apos;s configured attendance methods, the service may process attendance times, method information, IP address, GPS coordinates, QR or face/fingerprint-related enrollment data, and other attendance metadata.</p><p><strong className="text-slate-900">Files and communications.</strong> Uploaded profile images, company logos, and leave attachments are sent through the configured upload service. We use email, SMS, and WhatsApp providers for OTPs, account security, invitations, and service notifications where enabled.</p></div></section>

      <section id="use"><LegalHeading icon={FaUserShield}>3. How we use information</LegalHeading><p>We use information to authenticate users, maintain sessions, provide attendance and workforce features, calculate and display leave and payroll records, enforce company permissions, send requested security or service messages, process subscriptions, prevent misuse, troubleshoot the service, and respond to support requests.</p></section>

      <section id="sharing"><LegalHeading icon={FaGlobe}>4. Service providers and sharing</LegalHeading><p>We share information only as needed to operate the features you use: with configured authentication providers such as Google, Facebook, or Truecaller; communications providers that deliver OTPs and notifications; file-upload and media services; and payment or subscription services used for company plans. We may also disclose information when required by law, to protect the service and its users, or at your direction. We do not sell personal information.</p></section>

      <section id="retention"><LegalHeading icon={FaDatabase}>5. Retention and deletion</LegalHeading><p>We retain records while an account or company workspace needs them to provide the service. Account deletion is available from the <Link className="font-semibold text-blue-600 hover:underline" to="/data-deletion">Data Deletion</Link> page and requires an authenticated session, matching account email, and a one-time code. The current deletion workflow marks the user and employee memberships deleted, deactivates active sessions, and prevents deletion while the user owns an active company until ownership is transferred.</p></section>

      <section id="security"><LegalHeading icon={FaLock}>6. Security</LegalHeading><p>OneAttendance uses bearer sessions, expiry and forced-logout controls, rate-limited OTP flows, hashed OTP values, role-based company permissions, and database deletion markers. No internet transmission or storage system can be guaranteed completely secure, so keep your sign-in codes private and report suspicious activity promptly.</p></section>

      <section id="contact" className="rounded-xl border border-slate-200 bg-slate-50 p-5"><LegalHeading icon={FaEnvelope}>7. Contact us</LegalHeading><p>For privacy questions or a request about your information, contact <a className="font-semibold text-blue-600 hover:underline" href="mailto:support@onesaas.in">support@onesaas.in</a>. Please do not send OTPs or passwords by email.</p></section>
    </LegalLayout>
  );
};

export default PrivacyPolicy;
