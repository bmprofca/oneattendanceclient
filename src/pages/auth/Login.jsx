import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaUserShield,
  FaArrowRight,
  FaShieldAlt,
  FaRocket,
  FaCheckCircle,
  FaRegClock,
  FaBuilding,
  FaSpinner,
  FaMobileAlt
} from "react-icons/fa";
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineUser, HiOutlinePhone } from "react-icons/hi";
import { BiReset } from "react-icons/bi";
import countryCodes from "../../utils/countryCodes.json";
import { CountryCodeModal, getFlagEmoji } from "../../components/common";
import { useAuth } from "../../context/AuthContext";
import apiCall from "../../utils/api";
import { toast } from "react-toastify";
import { getPreciseLocation } from "../../utils/geolocation";
import GoogleAuthButton from "../../components/GoogleAuthButton";
import FacebookAuthButton from "../../components/FacebookAuthButton";

const Login = () => {
  const { user, login, selectCompany, companies, mustSelectCompany, showCompanySelection, setShowCompanySelection } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("phone");
  const [isTabLocked, setIsTabLocked] = useState(false);
  const [countryCode, setCountryCode] = useState("91");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userCompanies, setUserCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const firstOtpInputRef = useRef(null);
  const isLoading = loadingAction !== null;

  // Check after login if company selection is needed
  useEffect(() => {
    if (user && mustSelectCompany && companies.length > 1) {
      setUserCompanies(companies);
      setShowCompanySelection(true);
    } else if (user && !mustSelectCompany) {
      navigate("/home", { replace: true });
    }
  }, [user, mustSelectCompany, companies, navigate, setShowCompanySelection]);

  // Prevent navigation away when company selection is needed
  useEffect(() => {
    if (showCompanySelection) {
      window.history.pushState(null, "", window.location.href);
      const handlePopState = (e) => {
        e.preventDefault();
        window.history.pushState(null, "", window.location.href);
        toast.warning("Please select a company to continue");
      };
      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
    }
  }, [showCompanySelection]);

  // Countdown timer for resend OTP
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    if (!otpSent || isLoading) return;
    const focusTimer = window.setTimeout(() => {
      firstOtpInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [otpSent, isLoading]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
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
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`).focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`).focus();
    }
    // Trigger verify on Enter
    if (e.key === "Enter" && !isLoading) {
      e.preventDefault();
      handleVerifyOtp();
    }
  };

  // Generic Enter handler for login fields
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !isLoading) {
      e.preventDefault();
      if (!otpSent) {
        handleRequestOtp();
      } else {
        handleVerifyOtp();
      }
    }
  };

  const handleRequestOtp = async () => {
    if (isLoading) return;
    if (activeTab === "phone") {
      if (!mobile || !password) {
        toast.error("Please enter both phone number and password");
        return;
      }
    } else {
      if (!email || !password) {
        toast.error("Please enter both email and password");
        return;
      }
    }

    try {
      setLoadingAction("request-otp");
      const payload = {
        login_type: activeTab === "phone" ? "mobile" : "email",
        phone: activeTab === "phone" ? (countryCode + mobile) : "",
        email: activeTab === "email" ? email : "",
        password: password
      };

      const res = await apiCall('/auth/login/request-otp', 'POST', payload);
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to send OTP");

      setOtpSent(true);
      setIsTabLocked(true);
      setResendTimer(60);
      setOtp(["", "", "", "", "", ""]);
      toast.success(
        activeTab === "phone"
          ? "OTP sent to your phone number 📱"
          : "OTP sent to your email 📧"
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleVerifyOtp = async () => {
    if (isLoading) return;

    const otpString = otp.join("");
    if (otpString.length !== 6) {
      toast.error("Please enter complete 6-digit OTP");
      return;
    }

    try {
      setLoadingAction("verify-otp");
      toast.info("Capturing precise location...", { autoClose: 1500 });

      let locationData = null;
      try {
        locationData = await getPreciseLocation();
      } catch (err) {
        console.warn("Precise location unavailable, continuing login without coordinates:", err);
      }

      const payload = {
        login_type: activeTab === "phone" ? "phone" : "email",
        phone: activeTab === "phone" ? (countryCode + mobile) : "",
        email: activeTab === "email" ? email : "",
        password: password,
        otp: otpString,
        platform: "web",
        latitude: locationData?.latitude ?? "",
        longitude: locationData?.longitude ?? ""
      };

      const res = await apiCall('/auth/login/verify-otp', 'POST', payload);
      const json = await res.json();

      if (!res.ok) throw new Error(json.message || "OTP verification failed");

      const token = json.data?.token || json.token;
      if (!token) throw new Error("Authentication did not return a login token.");

      await login(token);
      toast.success("Login successful 🎉");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || isLoading) return;
    if (activeTab === "phone") {
      if (!mobile || !password) {
        toast.error("Please enter both phone number and password");
        return;
      }
    } else {
      if (!email || !password) {
        toast.error("Please enter both email and password");
        return;
      }
    }

    try {
      setLoadingAction("resend-otp");
      const payload = {
        login_type: activeTab === "phone" ? "mobile" : "email",
        phone: activeTab === "phone" ? mobile : "",
        email: activeTab === "email" ? email : "",
        password: password
      };

      const res = await apiCall('/auth/login/request-otp', 'POST', payload);
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to send OTP");

      setResendTimer(60);
      setOtp(["", "", "", "", "", ""]);
      toast.success(
        activeTab === "phone"
          ? "OTP resent to your phone number 📱"
          : "OTP resent to your email 📧"
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCompanySelect = (company) => {
    setSelectedCompany(company);
  };

  const handleConfirmCompany = () => {
    if (selectedCompany) {
      selectCompany(selectedCompany);
      setShowCompanySelection(false);
      navigate("/home", { replace: true });
    } else {
      toast.error("Please select a company to continue");
    }
  };

  const animationStyles = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .animate-slideIn { animation: slideIn 0.3s ease-out; }
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #888; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
  `;

  return (
    <>
      <style>{animationStyles}</style>
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 flex items-center justify-center p-5 relative overflow-hidden">

        {/* Animated Background */}
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
              }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
              transition={{ duration: Math.random() * 5 + 3, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>

        {/* Floating Icons */}
        <motion.div variants={floatingIconsVariants} animate="animate" className="absolute top-20 left-20 text-white/20 text-6xl hidden lg:block">
          <FaRocket />
        </motion.div>
        <motion.div variants={floatingIconsVariants} animate="animate" className="absolute bottom-20 right-20 text-white/20 text-6xl hidden lg:block">
          <FaShieldAlt />
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={containerVariants} className="flex flex-col lg:flex-row items-center justify-between w-full lg:max-w-6xl max-w-xl relative z-10">

          {/* Left Content */}
          <motion.div variants={itemVariants} className="hidden lg:block lg:w-1/2 text-white px-4 lg:px-8">
            <motion.h1 initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, type: "spring" }} className="text-5xl lg:text-6xl font-bold leading-tight">
              Welcome to <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 to-pink-300">OneAttendance</span>
            </motion.h1>
            <motion.p variants={itemVariants} className="mt-6 text-xl text-white/90">
              Streamline your attendance management with our secure, modern platform. Experience the future of workforce tracking.
            </motion.p>
            <div className="mt-8 space-y-4">
              {["🔒 End-to-end encryption", "⚡ Real-time updates", "📱 Multi-device sync", "🎯 Intuitive interface"].map((f, i) => (
                <motion.div key={i} initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 + i * 0.1 }} className="flex items-center space-x-3">
                  <FaCheckCircle className="text-green-300 text-xl" />
                  <span className="text-white/90">{f}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right Card */}
          <motion.div variants={itemVariants} className="w-full max-w-[400px] lg:w-96">
            <div className="bg-white/95 backdrop-blur-lg p-6 rounded-xl shadow-2xl">
              <AnimatePresence mode="wait">
                {!showCompanySelection ? (
                  <motion.div key="login" initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 50, opacity: 0 }}>
                    <div className="flex flex-col items-center mb-3">
                      <motion.div whileHover={{ rotate: 360, scale: 1.1 }} className="bg-gradient-to-r from-blue-600 to-purple-600 p-2.5 rounded-xl text-white text-xl shadow-md">
                        <FaUserShield />
                      </motion.div>
                      <h2 className="text-lg font-bold text-gray-800 mt-1.5">{otpSent ? 'Verify OTP' : 'Secure Login'}</h2>
                      <p className="text-xs text-gray-500 text-center">{otpSent ? (activeTab === "phone" ? 'Enter the 6-digit code sent to your phone' : 'Enter the 6-digit code sent to your email') : 'Access your account securely'}</p>
                    </div>

                    {!otpSent ? (
                      <div className="space-y-3.5">
                        <GoogleAuthButton
                          mode="login"
                          disabled={isLoading}
                          onAuthenticated={login}
                        />

                        <FacebookAuthButton
                          mode="login"
                          disabled={isLoading}
                          onAuthenticated={login}
                        />

                        <div className="flex items-center gap-2">
                          <div className="h-px flex-1 bg-gray-200" />
                          <span className="text-[10px] font-bold uppercase text-gray-400">or</span>
                          <div className="h-px flex-1 bg-gray-200" />
                        </div>

                        {/* Tabs for choosing Phone vs Email */}
                        <div className="flex bg-gray-100 p-0.5 rounded-lg mb-1">
                          <button
                            type="button"
                            onClick={() => setActiveTab("phone")}
                            disabled={isLoading || isTabLocked}
                            className={`flex-1 py-1.5 text-center text-sm font-semibold rounded-md transition-all duration-200 ${activeTab === "phone"
                                ? "bg-white text-gray-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                              } ${isTabLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            Phone
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab("email")}
                            disabled={isLoading || isTabLocked}
                            className={`flex-1 py-1.5 text-center text-sm font-semibold rounded-md transition-all duration-200 ${activeTab === "email"
                                ? "bg-white text-gray-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                              } ${isTabLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            Email
                          </button>
                        </div>

                        {activeTab === "phone" ? (
                          <div className="flex gap-2">
                            <div className="relative w-20 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                disabled={isLoading || isTabLocked}
                                className="w-full flex items-center justify-between px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none bg-gray-50 text-sm font-semibold text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                              >
                                <span>
                                  {getFlagEmoji(countryCodes.find(c => c.dial_code === countryCode)?.code || "IN")} +{countryCode}
                                </span>
                                <span className="text-gray-400 text-xs">▼</span>
                              </button>
                            </div>
                            <div className="relative flex-grow">
                              <HiOutlinePhone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                              <input
                                type="tel"
                                placeholder="Phone number"
                                value={mobile}
                                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                onFocus={() => setFocusedField('phone')}
                                onBlur={() => setFocusedField(null)}
                                disabled={isLoading}
                                maxLength={10}
                                inputMode="numeric"
                                onKeyDown={handleKeyPress}
                                className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none bg-gray-50 text-sm disabled:opacity-60"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <HiOutlineMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                            <input
                              type="email"
                              placeholder="Email address"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              onFocus={() => setFocusedField('email')}
                              onBlur={() => setFocusedField(null)}
                              disabled={isLoading}
                              onKeyDown={handleKeyPress}
                              className="w-full pl-11 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none bg-gray-50 text-sm disabled:opacity-60"
                            />
                          </div>
                        )}

                        <div className="relative">
                          <HiOutlineLockClosed className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                          <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onFocus={() => setFocusedField('password')}
                            onBlur={() => setFocusedField(null)}
                            disabled={isLoading}
                            onKeyDown={handleKeyPress}
                            className="w-full pl-11 pr-11 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none bg-gray-50 text-sm disabled:opacity-60"
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={isLoading} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 disabled:opacity-50">{showPassword ? "👁️" : "👁️‍🗨️"}</button>
                        </div>
                        <div className="flex items-center justify-end -mt-1.5">
                          <Link
                            to="/forgot-password"
                            state={{ email }}
                            className="text-xs font-semibold text-blue-600 hover:underline"
                          >
                            Forgot password?
                          </Link>
                        </div>
                        <motion.button whileHover={{ scale: isLoading ? 1 : 1.02 }} whileTap={{ scale: isLoading ? 1 : 0.98 }} onClick={handleRequestOtp} disabled={isLoading} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 rounded-xl font-semibold shadow-lg text-sm disabled:opacity-60">
                          {loadingAction === "request-otp" ? <FaSpinner className="mx-auto h-5 w-5 animate-spin" /> : "Request OTP"}
                        </motion.button>
                      </div>
                    ) : (
                      <div className="space-y-4 p-1 lg:p-0">
                        <div className="flex justify-center gap-2">
                          {otp.map((digit, index) => (
                            <input
                              key={index}
                              ref={index === 0 ? firstOtpInputRef : null}
                              id={`otp-${index}`}
                              type="text"
                              maxLength="1"
                              value={digit}
                              onChange={(e) => handleOtpChange(index, e.target.value)}
                              onKeyDown={(e) => handleOtpKeyDown(index, e)}
                              disabled={isLoading}
                              className="w-10 h-12 text-center text-xl font-bold border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none bg-gray-50 disabled:opacity-60"
                            />
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-1.5 text-gray-600"><FaRegClock /><span>{resendTimer > 0 ? `Resend in ${resendTimer}s` : 'OTP expired?'}</span></div>
                          <button
                            onClick={handleResendOtp}
                            disabled={resendTimer > 0 || isLoading}
                            className="inline-flex items-center gap-1 text-blue-600 font-semibold disabled:opacity-50"
                          >
                            {loadingAction === "resend-otp" ? (
                              <>
                                <FaSpinner className="h-3 w-3 animate-spin" />
                                <span>Sending...</span>
                              </>
                            ) : (
                              "Resend OTP"
                            )}
                          </button>
                        </div>
                        <motion.button whileHover={{ scale: isLoading ? 1 : 1.02 }} whileTap={{ scale: isLoading ? 1 : 0.98 }} onClick={handleVerifyOtp} disabled={isLoading} className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white py-2.5 rounded-xl font-semibold shadow-lg text-sm disabled:opacity-60">
                          {loadingAction === "verify-otp" ? <FaSpinner className="mx-auto h-5 w-5 animate-spin" /> : "Verify OTP"}
                        </motion.button>
                        <button onClick={() => setOtpSent(false)} disabled={isLoading} className="w-full text-gray-600 text-xs disabled:opacity-50">← Back to login</button>
                      </div>
                    )}
                    <div className="mt-3 text-center text-xs text-gray-600">
                      Don't have an account? <Link to="/signup" className="text-blue-600 font-semibold hover:underline">Create Account</Link>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="company-selection" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }}>
                    <div className="flex flex-col items-center mb-4">
                      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-xl text-white mb-2"><FaBuilding size={20} /></div>
                      <h2 className="text-lg font-bold text-gray-800">Select Company</h2>
                      <p className="text-xs text-gray-500">{userCompanies.length} available</p>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar mb-4">
                      {userCompanies.map((c) => {
                        const companyName = c?.name || 'No name found';
                        const roleValue = c?.role || 'No role found';
                        const formattedRole = roleValue
                          .split('_')
                          .filter(Boolean)
                          .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
                          .join(' ') || 'Employee';
                        const isOwner = roleValue === 'company_owner';
                        const initial = companyName.charAt(0).toUpperCase() || 'C';
                        return (
                          <button key={c.id} onClick={() => handleCompanySelect(c)} className={`w-full text-left p-3 border rounded-xl transition-all ${selectedCompany?.id === c.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-blue-300'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{initial}</div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-900 text-sm truncate">{companyName}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isOwner ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                                      <FaUserShield size={8} />
                                      {formattedRole}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {selectedCompany?.id === c.id && <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0"><FaCheckCircle className="text-white text-[10px]" /></div>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleConfirmCompany} disabled={!selectedCompany} className={`w-full py-2.5 rounded-xl font-semibold shadow-md text-sm ${selectedCompany ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                      Continue to Dashboard
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="mt-3 flex items-center justify-center space-x-2 text-xs text-gray-500">
                <FaShieldAlt className="text-green-500" />
                <span>256-bit encrypted connection</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
        <CountryCodeModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSelect={(code) => setCountryCode(code)}
          selectedCode={countryCode}
        />
      </div>
    </>
  );
};

export default Login;