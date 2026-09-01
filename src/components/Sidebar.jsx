import React, { useState, useEffect } from 'react';
import {
  FaHome,
  FaLifeRing,
  FaChevronRight,
  FaUsers,
  FaChevronDown,
  FaCommentDots,
  FaCog,
  FaUserShield,
  FaUmbrellaBeach,
  FaFileInvoiceDollar,
  FaEnvelope,
  FaBuilding,
  FaBriefcase,
  FaCalculator,
  FaTasks,
  FaClock,
  FaCalendarAlt,
  FaUniversity,
  FaIdCard,
  FaChartBar,
  FaCreditCard,
} from 'react-icons/fa';
import { useLocation, Link } from 'react-router-dom';
import usePermissionAccess from "../hooks/usePermissionAccess";

const Sidebar = ({ isMobile, sidebarOpen, toggleSidebar, onHover, isExpanded }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [openSections, setOpenSections] = useState({});
  const location = useLocation();
  const currentPath = location.pathname;

  const { checkPageAccess, isCompanyOwnerForCurrentCompany } = usePermissionAccess();

  // Toggle section
  const toggleSection = (sectionName) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const menuItems = [
    {
      icon: FaHome,
      label: 'Home',
      path: '/home',
      pageKey: 'home'
    },
    {
      icon: FaClock,
      label: 'My Attendance',
      path: '/attendance',
      pageKey: 'attendance'
    },
    {
      icon: FaUmbrellaBeach,
      label: 'My Leaves',
      path: '/my-leaves',
      pageKey: 'myLeaves'
    },
    {
      icon: FaFileInvoiceDollar,
      label: 'My Salary',
      path: '/my-salary',
      pageKey: 'mySalary'
    },
    {
      icon: FaChartBar,
      label: 'My Ledger',
      path: '/my-ledger',
      pageKey: 'myLedger'
    },
    {
      icon: FaIdCard,
      label: 'My Accounts',
      path: '/my-accounts',
      pageKey: 'employeeBankAccount'
    },
    {
      icon: FaEnvelope,
      label: 'My Invites',
      path: '/my-invites',
      pageKey: 'myInvites'
    },
    {
      icon: FaCalendarAlt,
      label: 'My Calendar',
      path: '/my-calendar',
      pageKey: 'holidays'
    },
    {
      icon: FaBriefcase,
      label: 'Management',
      isSection: true,
      children: [
        {
          icon: FaClock,
          label: 'Attendance',
          path: '/attendance-management',
          pageKey: 'attendanceManagement'
        },
        {
          icon: FaUsers,
          label: 'Employees',
          path: '/employee-management',
          pageKey: 'employeeManagement'
        },
        {
          icon: FaUserShield,
          label: 'Permissions',
          path: '/permission-management',
          pageKey: 'permissionManagement'
        },

        {
          icon: FaFileInvoiceDollar,
          label: 'Salary',
          path: '/salary-management',
          pageKey: 'salaryManagement'
        },
        {
          icon: FaCalculator,
          label: 'Payroll',
          path: '/payroll-management',
          pageKey: 'payrollManagement'
        },
        {
          icon: FaChartBar,
          label: 'Company Ledger',
          path: '/company-ledger',
          pageKey: 'companyLedger'
        },
        {
          icon: FaUniversity,
          label: 'Bank Accounts',
          path: '/bank-account-management',
          pageKey: 'bankAccountManagement'
        },

        {
          icon: FaUmbrellaBeach,
          label: 'Leaves',
          path: '/leave-management',
          pageKey: 'leaveManagement'
        },
        {
          icon: FaCog,
          label: 'Companies',
          path: '/company-settings',
          pageKey: 'companySettings'
        },

        {
          icon: FaCalendarAlt,
          label: 'Holidays',
          path: '/holiday-management',
          pageKey: 'holidayManagement'
        }
      ]
    },
    {
      icon: FaCreditCard,
      label: 'Subscription',
      path: '/subscription',
      ownerOnly: true
    },
    {
      icon: FaCommentDots,
      label: 'Help',
      path: '/help',
      pageKey: 'help'
    }
  ];

  const isActiveRoute = (itemPath) => {
    return currentPath === itemPath || currentPath.startsWith(itemPath + '/');
  };

  const getItemAccess = (item) => item.pageKey ? checkPageAccess(item.pageKey) : { allowed: true, disabled: false };

  const getVisibleChildren = (children) =>
    children.filter((child) => {
      if (child.ownerOnly && !isCompanyOwnerForCurrentCompany) return false;
      return getItemAccess(child).allowed;
    });

  const isSectionActive = (children) => getVisibleChildren(children).some((child) => isActiveRoute(child.path));

  useEffect(() => {
    if (onHover && !isMobile) {
      onHover(isHovered);
    }
  }, [isHovered, onHover, isMobile]);

  // ================= MOBILE SIDEBAR =================
  if (isMobile) {
    return (
      <>
        {/* Mobile Sidebar */}
        <div className={`
          fixed left-0 top-16 z-30 w-72 h-[calc(100vh-4rem)]
          bg-white transform transition-transform duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          overflow-y-auto overflow-x-hidden
        `}>
          <div className="p-4">
            <nav className="space-y-1">
              {menuItems.map((item) => {
                if (item.isSection) {
                  const isOpen = openSections[item.label];
                  const authorizedChildren = getVisibleChildren(item.children);
                  const isActive = isSectionActive(item.children);

                  if (authorizedChildren.length === 0) {
                    return null;
                  }

                  return (
                    <div key={item.label} className="mb-2">
                      {/* Section Header */}
                      <button
                        onClick={() => toggleSection(item.label)}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                            <item.icon className="w-4 h-4" />
                          </div>
                          <span className={`text-sm font-medium ${isActive ? 'text-blue-700 font-semibold' : 'text-gray-700'}`}>{item.label}</span>
                        </div>
                        {isOpen ? (
                          <FaChevronDown className={`w-3.5 h-3.5 ${isActive ? 'text-blue-500' : 'text-gray-400'}`} />
                        ) : (
                          <FaChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-blue-500' : 'text-gray-400'}`} />
                        )}
                      </button>

                      {/* Section Children */}
                      {isOpen && (
                        <div className="ml-8 mt-1 space-y-1">
                          {authorizedChildren.map((child) => {
                            const isActive = isActiveRoute(child.path);
                            return (
                              <Link
                                key={child.label}
                                to={child.path}
                                onClick={() => toggleSidebar()}
                                className={`
                                  flex items-center px-3 py-2 rounded-xl transition-all duration-200
                                  ${isActive
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600'
                                  }
                                `}
                              >
                                <div className={`
                                  p-2 rounded-lg mr-3
                                  ${isActive
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-600'
                                  }
                                `}>
                                  <child.icon className="w-3 h-3" />
                                </div>
                                <span className="text-xs font-medium">{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // Regular menu item
                const isActive = isActiveRoute(item.path);

                if (item.ownerOnly && !isCompanyOwnerForCurrentCompany) {
                  return null;
                }

                const access = getItemAccess(item);
                const Icon = item.icon;

                if (access.disabled) {
                  return null;
                }

                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={() => toggleSidebar()}
                    className={`
                      flex items-center px-3 py-3 rounded-xl transition-all duration-200 mb-1
                      ${isActive
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600'
                      }
                    `}
                  >
                    <div className={`
                      p-2 rounded-lg mr-3
                      ${isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                      }
                    `}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Help Section */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
                <FaLifeRing className="text-blue-600 mb-2" size={20} />
                <p className="text-xs font-semibold text-gray-700 mb-1">Need Help?</p>
                <p className="text-xs text-gray-500">Contact our support team</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ================= DESKTOP SIDEBAR =================
  const isSidebarExpanded = isExpanded;

  const renderMenuItem = (item, isExpandedState) => {
    if (item.ownerOnly && !isCompanyOwnerForCurrentCompany) {
      return null;
    }

    const isActive = isActiveRoute(item.path);
    const access = getItemAccess(item);
    const Icon = item.icon;

    if (access.disabled) {
      return null;
    }

    return (
      <Link
        key={item.label}
        to={item.path}
        className={`
          flex items-center rounded-xl transition-all duration-200 group
          ${isExpandedState ? 'px-3 py-2.5 gap-3' : 'px-0 py-2.5 justify-center'}
          ${isActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600'
          }
        `}
        title={!isExpandedState ? item.label : ''}
      >
        <div className={`
          p-2 rounded-lg transition-all duration-200
          ${isExpandedState ? '' : 'mx-auto'}
          ${isActive
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-600 group-hover:bg-blue-50 group-hover:text-blue-600'
          }
        `}>
          <Icon className="w-4 h-4" />
        </div>
        {isExpandedState && (
          <>
            <span className={`flex-1 text-sm font-medium ${isActive ? 'font-semibold' : ''}`}>
              {item.label}
            </span>
            {isActive && (
              <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
            )}
          </>
        )}
        {!isExpandedState && isActive && (
          <span className="absolute left-0 w-1 h-8 bg-blue-600 rounded-r-full"></span>
        )}
      </Link>
    );
  };

  const renderSection = (item, isExpandedState) => {
    const isOpen = openSections[item.label];
    const Icon = item.icon;
    const authorizedChildren = getVisibleChildren(item.children);
    const isActive = isSectionActive(item.children);

    if (authorizedChildren.length === 0) {
      return null;
    }

    return (
      <div key={item.label} className="mb-1">
        {/* Section Header */}
        <button
          onClick={() => toggleSection(item.label)}
          className={`
            w-full flex items-center rounded-xl transition-all duration-200
            ${isExpandedState ? 'px-3 py-2.5 gap-3' : 'px-0 py-2.5 justify-center'}
            ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600'}
          `}
          title={!isExpandedState ? item.label : ''}
        >
          <div className={`
            p-2 rounded-lg transition-all duration-200
            ${isExpandedState ? '' : 'mx-auto'}
            ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
          `}>
            <Icon className="w-4 h-4" />
          </div>
          {isExpandedState && (
            <>
              <span className={`flex-1 text-sm font-medium text-left ${isActive ? 'font-semibold text-blue-700' : 'text-gray-700'}`}>
                {item.label}
              </span>
              {isOpen ? (
                <FaChevronDown className={`w-3.5 h-3.5 ${isActive ? 'text-blue-500' : 'text-gray-400'}`} />
              ) : (
                <FaChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-blue-500' : 'text-gray-400'}`} />
              )}
            </>
          )}
        </button>

        {/* Section Children */}
        {isExpandedState && isOpen && (
          <div className="ml-8 mt-1 space-y-1">
            {authorizedChildren.map((child) => {
              const isActive = isActiveRoute(child.path);
              const ChildIcon = child.icon;

              return (
                <Link
                  key={child.label}
                  to={child.path}
                  className={`
                    flex items-center rounded-xl transition-all duration-200 group
                    px-3 py-2 gap-3
                    ${isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600'
                    }
                  `}
                >
                  <div className={`
                    p-2 rounded-lg transition-all duration-200
                    ${isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 group-hover:bg-blue-50 group-hover:text-blue-600'
                    }
                  `}>
                    <ChildIcon className="w-3 h-3" />
                  </div>
                  <span className={`flex-1 text-xs font-medium ${isActive ? 'font-semibold' : ''}`}>
                    {child.label}
                  </span>
                  {isActive && (
                    <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // FIXED: Proper hover handling for desktop sidebar
  const handleMouseEnter = () => {
    // Only trigger hover if sidebar is NOT already expanded by toggle
    if (!isSidebarExpanded) {
      setIsHovered(true);
      if (onHover) onHover(true);
    }
  };

  const handleMouseLeave = () => {
    // Always reset hover state on mouse leave
    setIsHovered(false);
    if (onHover) onHover(false);
  };

  return (
    <div
      className={`
        fixed left-0 top-16 z-20 bg-white
        transition-all duration-300 ease-out
        ${isSidebarExpanded ? 'w-64' : 'w-16'}
        h-[calc(100vh-4rem)]
        shadow-lg border-r border-gray-200
        overflow-y-auto overflow-x-hidden
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex flex-col h-full">
        <nav className="flex-1 py-6 px-2">
          {menuItems.map((item) => {
            if (item.isSection) {
              return renderSection(item, isSidebarExpanded);
            }
            return renderMenuItem(item, isSidebarExpanded);
          })}
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;


