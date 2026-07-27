import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  FaClock,
  FaUsers,
  FaShieldAlt,
  FaMobileAlt,
  FaChartBar,
  FaArrowRight,
  FaPlayCircle,
  FaCheckCircle,
  FaStar,
  FaRocket
} from 'react-icons/fa';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Animation variants
  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const scaleOnHover = {
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 }
  };

  const featureCards = [
    {
      icon: FaClock,
      title: "Real-Time Tracking",
      description: "Live clock-ins/outs with GPS & biometrics",
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600"
    },
    {
      icon: FaUsers,
      title: "Multi-User Access",
      description: "Admin, manager, employee dashboards",
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-50",
      iconColor: "text-green-600"
    },
    {
      icon: FaShieldAlt,
      title: "Secure Data",
      description: "JWT auth, encrypted reports, GDPR ready",
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600"
    },
    {
      icon: FaMobileAlt,
      title: "Mobile App",
      description: "Punch in from anywhere, anytime",
      color: "from-orange-500 to-red-500",
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600"
    },
    {
      icon: FaChartBar,
      title: "Analytics",
      description: "Custom reports & productivity insights",
      color: "from-indigo-500 to-purple-500",
      bgColor: "bg-indigo-50",
      iconColor: "text-indigo-600"
    }
  ];

  const stats = [
    { number: "10K+", label: "Active Teams", icon: FaUsers },
    { number: "98%", label: "Customer Satisfaction", icon: FaStar },
    { number: "24/7", label: "Support Available", icon: FaRocket }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100"
    >
      {/* Navbar with animation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
        className="bg-white/80 backdrop-blur-md shadow-lg sticky top-0 z-50"
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <motion.div
              className="flex items-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                OneAttendance
              </h1>
            </motion.div>
            <div className="flex space-x-4 xsm:space-x-0 items-center">
              {isAuthenticated ? (
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/home')}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg shadow-lg relative overflow-hidden group flex items-center gap-2"
                >
                  <span className="relative z-10">Go to Dashboard</span>
                  <FaArrowRight className="relative z-10 text-sm group-hover:translate-x-1 transition-transform" />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-blue-700 to-indigo-700"
                    initial={{ x: "100%" }}
                    whileHover={{ x: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.button>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/login')}
                    className="px-6 py-2 text-blue-600 font-semibold hover:bg-blue-50 rounded-lg transition-all duration-200 relative overflow-hidden group"
                  >
                    <span className="relative z-10">Login</span>
                    <motion.div
                      className="absolute inset-0 bg-blue-100"
                      initial={{ scale: 0, opacity: 0 }}
                      whileHover={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/signup')}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg shadow-lg relative overflow-hidden group"
                  >
                    <span className="hidden xsm:inline">Free</span>
                    <span className="xsm:hidden">Get Started Free</span>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-blue-700 to-indigo-700"
                      initial={{ x: "100%" }}
                      whileHover={{ x: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  </motion.button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="py-20 lg:py-32 overflow-hidden">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <motion.h1
              className="text-5xl lg:text-7xl font-bold mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Simplify Attendance
              </span>
              <motion.span
                className="block bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent"
                animate={{
                  backgroundPosition: ["0%", "100%", "0%"],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "linear"
                }}
                style={{ backgroundSize: "200% auto" }}
              >
                Management
              </motion.span>
            </motion.h1>

            <motion.p
              className="text-xl lg:text-2xl text-gray-600 max-w-3xl mx-auto mb-10 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Track employee attendance effortlessly with real-time insights, biometric integration, and automated reports.
              Focus on growth, not clock-watching.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {isAuthenticated ? (
                <motion.button
                  variants={fadeInUp}
                  whileHover={{ scale: 1.05, boxShadow: "0 25px 30px -12px rgba(0, 0, 0, 0.25)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/home')}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-lg rounded-xl shadow-2xl flex items-center gap-2 group relative overflow-hidden"
                >
                  <span className="relative z-10">Go to Dashboard</span>
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="relative z-10"
                  >
                    <FaArrowRight />
                  </motion.div>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-blue-700 to-indigo-700"
                    initial={{ x: "100%" }}
                    whileHover={{ x: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.button>
              ) : (
                <motion.button
                  variants={fadeInUp}
                  whileHover={{ scale: 1.05, boxShadow: "0 25px 30px -12px rgba(0, 0, 0, 0.25)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-lg rounded-xl shadow-2xl flex items-center gap-2 group relative overflow-hidden"
                >
                  <span className="relative z-10">Start Free Trial</span>
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="relative z-10"
                  >
                    <FaArrowRight />
                  </motion.div>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-blue-700 to-indigo-700"
                    initial={{ x: "100%" }}
                    whileHover={{ x: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.button>
              )}

              <motion.button
                variants={fadeInUp}
                whileHover={{ scale: 1.05, backgroundColor: "#f9fafb" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/demo')}
                className="px-8 py-4 border-2 border-gray-200 text-gray-800 font-semibold text-lg rounded-xl hover:bg-gray-50 transition-all duration-200 flex items-center gap-2 group"
              >
                <FaPlayCircle className="text-blue-600 group-hover:scale-110 transition-transform" />
                Watch Demo
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-5 gap-8"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
          >
            {featureCards.map((feature, index) => (
              <motion.div
                key={index}
                variants={{
                  initial: { opacity: 0, y: 50 },
                  animate: { opacity: 1, y: 0 }
                }}
                whileHover={{
                  y: -10,
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                }}
                className="group relative p-6 rounded-xl bg-white shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer"
              >
                <motion.div
                  className="absolute inset-0 rounded-xl bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${feature.color})`,
                    filter: "blur(20px)",
                    zIndex: -1
                  }}
                />
                <div className={`w-20 h-20 mx-auto ${feature.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`w-10 h-10 ${feature.iconColor}`} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
                <motion.div
                  className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  whileHover={{ x: 5 }}
                >
                  <FaArrowRight className="text-blue-600" />
                </motion.div>
              </motion.div>
            ))}
          </motion.div>

          {/* Stats Section */}
          <motion.div
            className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8 text-center"
                whileHover={{ scale: 1.05 }}
              >
                <stat.icon className="w-12 h-12 mx-auto text-blue-600 mb-4" />
                <motion.div
                  className="text-4xl font-bold text-gray-900 mb-2"
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                >
                  {stat.number}
                </motion.div>
                <p className="text-gray-600">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Footer */}
      <motion.section
        className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center relative overflow-hidden"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        {/* Animated background elements */}
        <motion.div
          className="absolute inset-0 opacity-10"
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%"],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: "reverse"
          }}
          style={{
            backgroundImage: "radial-gradient(circle at 30% 50%, white 0%, transparent 50%)",
            backgroundSize: "100% 100%"
          }}
        />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.h2
            className="text-4xl lg:text-5xl font-bold mb-6"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Ready to Transform Attendance?
          </motion.h2>

          <motion.p
            className="text-xl mb-10 opacity-90"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.9 }}
            transition={{ delay: 0.2 }}
          >
            Join 10,000+ teams saving hours weekly.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
          >
            {isAuthenticated ? (
              <motion.button
                variants={fadeInUp}
                whileHover={{ scale: 1.05, boxShadow: "0 30px 30px -15px rgba(0, 0, 0, 0.3)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/home')}
                className="px-10 py-4 bg-white text-blue-600 font-bold text-lg rounded-xl shadow-2xl flex items-center justify-center gap-2 group"
              >
                Go to Dashboard
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <FaArrowRight className="text-blue-600" />
                </motion.div>
              </motion.button>
            ) : (
              <>
                <motion.button
                  variants={fadeInUp}
                  whileHover={{ scale: 1.05, boxShadow: "0 30px 30px -15px rgba(0, 0, 0, 0.3)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/signup')}
                  className="px-10 py-4 bg-white text-blue-600 font-bold text-lg rounded-xl shadow-2xl flex items-center justify-center gap-2 group"
                >
                  Create Free Account
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <FaCheckCircle className="text-green-500" />
                  </motion.div>
                </motion.button>

                <motion.button
                  variants={fadeInUp}
                  whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.2)" }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => navigate('/login')}
                  className="px-10 py-4 font-semibold text-lg rounded-xl border-2 border-white"
                >
                  Login Now
                </motion.button>
              </>
            )}
          </motion.div>
        </div>
      </motion.section>
    </motion.div>
  );
}