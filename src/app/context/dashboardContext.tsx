"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type ActivePage = "inbox" | "contacts" | "projects" | "analytics" | "lead";

type Breadcrumb = {
  label: string;
  href?: string;
};

type DashboardContextType = {
  activePage: ActivePage;
  setActivePage: (page: ActivePage) => void;
  pageTitle: string;
  setPageTitle: (title: string) => void;
  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
};

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [activePage, setActivePage] = useState<ActivePage>("inbox");
  const [pageTitle, setPageTitle] = useState("Inbox");
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
    { label: "gios.build", href: "#" },
    { label: "Inbox" },
  ]);

  return (
    <DashboardContext.Provider
      value={{
        activePage,
        setActivePage,
        pageTitle,
        setPageTitle,
        breadcrumbs,
        setBreadcrumbs,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}

// Hook to set page config on mount
export function usePageConfig(config: {
  activePage: ActivePage;
  title: string;
  breadcrumbs: Breadcrumb[];
}) {
  const { setActivePage, setPageTitle, setBreadcrumbs } = useDashboard();

  // Use useCallback to memoize the setter
  const setConfig = useCallback(() => {
    setActivePage(config.activePage);
    setPageTitle(config.title);
    setBreadcrumbs(config.breadcrumbs);
  }, [config.activePage, config.title, config.breadcrumbs, setActivePage, setPageTitle, setBreadcrumbs]);

  return setConfig;
}