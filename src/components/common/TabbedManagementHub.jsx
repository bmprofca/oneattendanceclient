import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa";
import usePermissionAccess from "../../hooks/usePermissionAccess";
import { ManagementHub } from "./index";

const normalizeTab = (tab, fallback) => {
  if (!tab) return fallback;
  return tab;
};

export default function TabbedManagementHub({
  title,
  description,
  eyebrow,
  accent = "slate",
  routePath,
  defaultTab,
  tabs = [],
  accessDeniedTitle,
  accessDeniedDescription,
  accessDeniedIcon: AccessDeniedIcon,
}) {
  const { checkPageAccess } = usePermissionAccess();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const requestedTab = normalizeTab(searchParams.get("tab"), defaultTab);

  const resolvedTabs = useMemo(
    () =>
      tabs.map((tab) => {
        const allowed = tab.pageKey
          ? checkPageAccess(tab.pageKey).allowed
          : true;
        return { ...tab, access: { allowed } };
      }),
    [checkPageAccess, tabs],
  );

  const accessibleTabs = resolvedTabs.filter((tab) => tab.access.allowed);
  const fallbackTab =
    accessibleTabs[0]?.id || resolvedTabs[0]?.id || defaultTab;
  const activeTab =
    resolvedTabs.find((tab) => tab.id === requestedTab && tab.access.allowed)
      ?.id || fallbackTab;

  useEffect(() => {
    if (!routePath || !resolvedTabs.length) return;
    const nextSearchParams = new URLSearchParams(location.search);
    if (activeTab) nextSearchParams.set("tab", activeTab);

    const nextSearch = nextSearchParams.toString();
    if (`?${nextSearch}` !== location.search) {
      navigate(
        { pathname: routePath, search: nextSearch ? `?${nextSearch}` : "" },
        { replace: true },
      );
    }
  }, [activeTab, location.search, navigate, routePath, resolvedTabs.length]);

  const currentTab = resolvedTabs.find((tab) => tab.id === activeTab);
  const ActiveComponent = currentTab?.component;
  const CurrentIcon = currentTab?.icon;

  const handleTabChange = (tabId) => {
    if (tabId === activeTab) return;
    navigate(`${routePath}?tab=${tabId}`);
  };

  return (
    <ManagementHub
      eyebrow={eyebrow}
      title={title}
      description={description}
      accent={accent}
      summary={
        currentTab ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${currentTab.accent || "bg-slate-100 text-slate-600 border-slate-200"}`}
            >
              {CurrentIcon && <CurrentIcon size={12} />}
              {currentTab.shortLabel || currentTab.label}
            </span>
            <FaChevronRight className="text-slate-300" size={12} />
            <span className="text-xs text-slate-500">
              {currentTab.description}
            </span>
          </div>
        ) : null
      }
      tabs={resolvedTabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        icon: tab.icon,
        disabled: !tab.access.allowed,
        description: tab.description,
        title: tab.access.allowed
          ? tab.description
          : "You do not have access to this section",
      }))}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      {ActiveComponent ? (
        <ActiveComponent />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            {AccessDeniedIcon ? <AccessDeniedIcon size={20} /> : null}
          </div>
          <h2 className="text-lg font-bold text-slate-800">
            {accessDeniedTitle}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {accessDeniedDescription}
          </p>
        </div>
      )}
    </ManagementHub>
  );
}
