import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaCheckCircle,
  FaLock,
  FaRocket,
  FaShieldAlt,
  FaSpinner,
  FaUserShield,
  FaRegClock,
} from "react-icons/fa";
import { HiOutlineMail, HiOutlineLockClosed, HiOutlinePhone } from "react-icons/hi";
import apiCall from "../../utils/api";
import { toast } from "react-toastify";
import { usePasswordValidation } from "../../hooks/usePasswordValidation";

const OTP_LENGTH = 6;

const ForgotPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { validatePassword } = usePasswordValidation();

  const [forgotType, setForgotType] = useState(location.state?.email ? "email" : "phone");
  const [identifier, setIdentifier] = useState(location.state?.email || location.state?.phone || "");
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState("request");
  const [loadingAction, setLoadingAction] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const isLoading = loadingAction !== null;
  const pwdValidation = validatePassword(newPassword);

  useEffect(() => {
    if (location.state?.email) setIdentifier(location.state.email);
    else if (location.state?.phone) setIdentifier(location.state.phone);
  }, [location.state]);

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } },
  };

  const floatingIconsVariants = {
    animate: {
      y: [0, -15, 0],
      transition: { duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" },
    },
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < OTP_LENGTH - 1) {
      document.getElementById(`reset-otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`reset-otp-${index - 1}`)?.focus();
    }
  };

  // Build payload with country code prepended to phone number
  const getPayload = () => {
    if (forgotType === "email") {
      return { forgot_type: "email", email: identifier };
    }
    // Remove any non-digit characters and prepend +91 (the static country code shown in UI)
    const cleanPhone = identifier.replace(/\D/g, "");
    return { forgot_type: "phone", phone: `+91${cleanPhone}` };
  };

  const handleRequestOtp = async () => {
    if (isLoading) return;
    if (!identifier) {
      toast.error("Please enter your email or phone number");
      return;
    }

    try {
      setLoadingAction("request");
      const res = await apiCall("/auth/forgot-password/request-otp", "POST", getPayload());
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send OTP");

      toast.success(data.message || "OTP sent successfully");
      setStep("verify");
      setResendTimer(60);
      setOtp(Array(OTP_LENGTH).fill(""));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleVerifyOtp = async () => {
    if (isLoading) return;
    const otpString = otp.join("");
    if (otpString.length !== OTP_LENGTH) {
      toast.error("Please enter the 6-digit OTP");
      return;
    }

    try {
      setLoadingAction("verify");
      const res = await apiCall("/auth/forgot-password/verify-otp", "POST", {
        ...getPayload(),
        otp: otpString,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "OTP verification failed");

      toast.success(data.message || "OTP verified");
      setStep("reset");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResetPassword = async () => {
    if (isLoading) return;
    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      toast.error("Password does not meet the security requirements");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setLoadingAction("reset");
      const res = await apiCall("/auth/forgot-password/reset", "POST", {
        ...getPayload(),
        new_password: newPassword,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Password reset failed");

      toast.success(data.message || "Password reset successfully");
      navigate("/login", { replace: true, state: getPayload().forgot_type === 'email' ? { email: identifier } : { phone: identifier } });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <>
      <style>{`
        @keyframes floatSoft {
          0%, 100% { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.12; }
          50% { transform: translateY(-18px) translateX(8px) scale(1.04); opacity: 0.2; }
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 flex items-center justify-center p-5 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute bg-white/10 rounded-full"
              style={{
                width: Math.random() * 300 + 50,
                height: Math.random() * 300 + 50,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `floatSoft ${6 + (i % 5)}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>

        <motion.div variants={floatingIconsVariants} animate="animate" className="absolute top-20 left-20 text-white/20 text-6xl hidden lg:block">
          <FaRocket />
        </motion.div>
        <motion.div variants={floatingIconsVariants} animate="animate" className="absolute bottom-20 right-20 text-white/20 text-6xl hidden lg:block">
          <FaShieldAlt />
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={containerVariants} className="flex flex-col lg:flex-row items-center justify-between w-full lg:max-w-6xl max-w-xl relative z-10">
          <motion.div variants={itemVariants} className="hidden lg:block lg:w-1/2 text-white px-4 lg:px-8">
            <motion.h1
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
              className="text-5xl lg:text-6xl font-bold leading-tight"
            >
              Recover access to <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 to-pink-300">OneAttendance</span>
            </motion.h1>
            <motion.p variants={itemVariants} className="mt-6 text-xl text-white/90">
              Verify your identity and set a new password using the same secure experience as login.
            </motion.p>
            <div className="mt-8 space-y-4">
              {["OTP verification", "Fast password reset", "Email/Phone recovery", "Same secure interface"].map((text, i) => (
                <motion.div
                  key={text}
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="flex items-center space-x-3"
                >
                  <FaCheckCircle className="text-green-300 text-xl" />
                  <span className="text-white/90">{text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="w-full max-w-[400px] lg:w-96">
            <div className="bg-white/95 backdrop-blur-lg p-6 rounded-xl shadow-2xl">
              <div className="flex flex-col items-center mb-3">
                <motion.div whileHover={{ rotate: 360, scale: 1.1 }} className="bg-gradient-to-r from-blue-600 to-purple-600 p-2.5 rounded-xl text-white text-xl shadow-md">
                  <FaUserShield />
                </motion.div>
                <h2 className="text-lg font-bold text-gray-800 mt-1.5">
                  {step === "request" ? "Forgot Password" : step === "verify" ? "Verify OTP" : "Reset Password"}
                </h2>
                <p className="text-xs text-gray-500 text-center">
                  {step === "request"
                    ? `Enter your ${forgotType} to receive an OTP`
                    : step === "verify"
                    ? `Enter the OTP sent to your ${forgotType}`
                    : "Create your new password"}
                </p>
              </div>

              {step === "request" && (
                <div className="space-y-4">
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => { setForgotType("phone"); setIdentifier(""); }}
                      className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                        forgotType === "phone" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Phone
                    </button>
                    <button
                      type="button"
                      onClick={() => { setForgotType("email"); setIdentifier(""); }}
                      className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                        forgotType === "email" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Email
                    </button>
                  </div>

                  {forgotType === "email" ? (
                    <div className="relative">
                      <HiOutlineMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                      <input
                        type="email"
                        placeholder="Email address"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        disabled={isLoading}
                        className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none bg-gray-50 text-sm disabled:opacity-60 transition-colors"
                      />
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex items-center justify-center px-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-sm font-semibold text-gray-700">
                        IN +91
                      </div>
                      <div className="relative flex-1">
                        <HiOutlinePhone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                        <input
                          type="text"
                          placeholder="Phone number"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          disabled={isLoading}
                          className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none bg-gray-50 text-sm disabled:opacity-60 transition-colors"
                        />
                      </div>
                    </div>
                  )}
                  <motion.button
                    whileHover={{ scale: isLoading ? 1 : 1.02 }}
                    whileTap={{ scale: isLoading ? 1 : 0.98 }}
                    onClick={handleRequestOtp}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 rounded-xl font-semibold shadow-lg text-sm disabled:opacity-60"
                  >
                    {loadingAction === "request" ? <FaSpinner className="mx-auto h-5 w-5 animate-spin" /> : "Request OTP"}
                  </motion.button>
                </div>
              )}

              {step === "verify" && (
                <div className="space-y-3.5">
                  <div className="relative">
                    {forgotType === "email" ? (
                      <HiOutlineMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                    ) : (
                      <HiOutlinePhone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                    )}
                    <input
                      type="text"
                      value={identifier}
                      disabled
                      className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-200 rounded-xl bg-gray-100 text-gray-500 text-sm"
                    />
                  </div>

                  <div className="flex justify-center gap-2">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`reset-otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        maxLength="1"
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value.replace(/\D/g, ""))}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        disabled={isLoading}
                        className="w-10 h-12 text-center text-xl font-bold border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none bg-gray-50 disabled:opacity-60"
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1.5 text-gray-600">
                      <FaRegClock />
                      <span>{resendTimer > 0 ? `Resend in ${resendTimer}s` : "OTP expired?"}</span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: isLoading ? 1 : 1.02 }}
                    whileTap={{ scale: isLoading ? 1 : 0.98 }}
                    onClick={handleRequestOtp}
                    disabled={resendTimer > 0 || isLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 rounded-xl font-semibold shadow-lg text-sm disabled:opacity-60"
                  >
                    {loadingAction === "request" ? (
                      <span className="inline-flex items-center justify-center gap-2 text-sm">
                        <FaSpinner className="h-4 w-4 animate-spin" />
                        Sending OTP
                      </span>
                    ) : (
                      "Resend OTP"
                    )}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: isLoading ? 1 : 1.02 }}
                    whileTap={{ scale: isLoading ? 1 : 0.98 }}
                    onClick={handleVerifyOtp}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white py-2.5 rounded-xl font-semibold shadow-lg text-sm disabled:opacity-60"
                  >
                    {loadingAction === "verify" ? <FaSpinner className="mx-auto h-5 w-5 animate-spin" /> : "Verify OTP"}
                  </motion.button>
                </div>
              )}

              {step === "reset" && (
                <div className="space-y-3.5">
                  <div className="relative">
                    {forgotType === "email" ? (
                      <HiOutlineMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                    ) : (
                      <HiOutlinePhone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                    )}
                    <input
                      type="text"
                      value={identifier}
                      disabled
                      className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-200 rounded-xl bg-gray-100 text-gray-500 text-sm"
                    />
                  </div>

                  <div className="relative">
                    <HiOutlineLockClosed className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isLoading}
                      className="w-full pl-11 pr-11 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none bg-gray-50 text-sm disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 disabled:opacity-50 text-sm"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  {newPassword && (
                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1.5 text-xs">
                      <p className="font-semibold text-gray-700">Password must contain:</p>
                      <div className="grid grid-cols-1 gap-1">
                        <div className={`flex items-center gap-1.5 ${pwdValidation.minLength ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                          <span>{pwdValidation.minLength ? '✓' : '•'}</span>
                          <span>At least 8 characters</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${pwdValidation.hasUpper ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                          <span>{pwdValidation.hasUpper ? '✓' : '•'}</span>
                          <span>At least 1 uppercase letter</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${pwdValidation.hasNumber ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                          <span>{pwdValidation.hasNumber ? '✓' : '•'}</span>
                          <span>At least 1 number</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${pwdValidation.hasSpecial ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                          <span>{pwdValidation.hasSpecial ? '✓' : '•'}</span>
                          <span>At least 1 special character</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <FaLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none bg-gray-50 text-sm disabled:opacity-60"
                    />
                  </div>

                  <motion.button
                    whileHover={{ scale: isLoading ? 1 : 1.02 }}
                    whileTap={{ scale: isLoading ? 1 : 0.98 }}
                    onClick={handleResetPassword}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 rounded-xl font-semibold shadow-lg text-sm disabled:opacity-60"
                  >
                    {loadingAction === "reset" ? <FaSpinner className="mx-auto h-5 w-5 animate-spin" /> : "Reset Password"}
                  </motion.button>
                </div>
              )}

              <div className="mt-4 text-center text-xs text-gray-600">
                Remembered it? <Link to="/login" className="text-blue-600 font-semibold hover:underline">Back to Login</Link>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
};

export default ForgotPassword;