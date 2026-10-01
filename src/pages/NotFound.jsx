import { motion } from "framer-motion";
import BrandLogo from "../components/BrandLogo";
import { Link } from "react-router-dom";
import { 
  FaHome, 
  FaUsers, 
  FaArrowLeft, 
  FaCompass,
  FaBriefcase,
  FaChartLine,
  FaCog
} from "react-icons/fa";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full text-center">
        <div className="mb-6 flex justify-center">
          <BrandLogo className="h-16 w-16" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="relative mb-8"
        >
          <h1 className="text-[150px] sm:text-[200px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 leading-none">
            404
          </h1>
          
          {/* Floating Elements */}
          <motion.div
            animate={{ 
              y: [0, -20, 0],
              rotate: [0, 10, -10, 0]
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              repeatType: "reverse"
            }}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          >
            <FaCompass className="w-24 h-24 text-purple-200 opacity-30" />
          </motion.div>
        </motion.div>

        {/* Error Message */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="space-y-4 mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-800">
            Oops! Page Not Found
          </h2>
          
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            The page you're looking for seems to have wandered off into the digital wilderness. 
            Let's get you back on track!
          </p>

          {/* Fun Facts or Suggestions */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500">
            <span className="px-3 py-1 bg-slate-100 rounded-full">🔍 Check the URL</span>
            <span className="px-3 py-1 bg-slate-100 rounded-full">🏠 Go Home</span>
            <span className="px-3 py-1 bg-slate-100 rounded-full">📞 Contact Support</span>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/home">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-3 group"
            >
              <FaHome className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              <span>Back to Home</span>
            </motion.button>
          </Link>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.history.back()}
            className="px-8 py-4 bg-white text-slate-700 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all border border-slate-200 flex items-center gap-3 group"
          >
            <FaArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Go Back</span>
          </motion.button>
        </motion.div>

        {/* Helpful Links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="mt-12 pt-8 border-t border-slate-200"
        >
          <p className="text-sm text-slate-500 mb-4">You might be looking for:</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {[
              { icon: FaUsers, label: "Employees", path: "/admin/employees" },
              { icon: FaBriefcase, label: "Projects", path: "/projects" },
              { icon: FaChartLine, label: "Reports", path: "/reports" },
              { icon: FaCog, label: "Settings", path: "/settings" }
            ].map((link, index) => (
              <Link key={index} to={link.path}>
                <motion.button
                  whileHover={{ y: -2 }}
                  className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors flex items-center gap-2"
                >
                  <link.icon className="w-4 h-4" />
                  <span className="text-sm">{link.label}</span>
                </motion.button>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Easter Egg */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="mt-8"
        >
          <p className="text-xs text-slate-400">
            Lost in space? Don't worry, even astronauts get lost sometimes! 🚀
          </p>
        </motion.div>
      </div>
    </div>
  );
}