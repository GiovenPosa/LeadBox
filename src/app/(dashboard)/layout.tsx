"use client";

import { ReactNode } from "react";
import { AuthProvider, useAuth } from "../context/authContext";
import { DashboardProvider, useDashboard } from "../context/dashboardContext";
import { useInbox } from "../context/inboxContext";
import { useSplashScreen } from "../hooks/useSpalshScreen";
import Sidebar from "../components/sidebar";
import TopBar from "../components/topbar";
import DockBar from "../components/dockbar";
import styles from "./homePage.module.css";

type NavActivePage = "inbox" | "contacts" | "projects" | "analytics";

function DashboardShell({ children }: { children: ReactNode }) {
  const { email, loading, signOut } = useAuth();
  const { activePage, breadcrumbs, pageTitle } = useDashboard();
  const { unseenCount } = useInbox();

  // Dismiss splash when auth is complete
  useSplashScreen(!loading && !!email);

  // Keep showing splash (it's in root layout) while loading
  if (loading || !email) {
    return null;
  }

  const isLeadPage = activePage === "lead";
  const navActivePage: NavActivePage = isLeadPage ? "inbox" : activePage;

  return (
    <div className={styles.workspace}>
      <Sidebar
        email={email}
        onSignOut={signOut}
        inboxUnseenCount={unseenCount}
        activePage={navActivePage}
      />

      <div className={styles.main}>
        <div className={isLeadPage ? styles.hideOnMobile : undefined}>
          <TopBar
            title={pageTitle}
            breadcrumbs={breadcrumbs}
            email={email}
            onSignOut={signOut}
          />
        </div>
        {children}
      </div>

      {!isLeadPage && (
        <DockBar
          activePage={navActivePage}
          inboxUnseenCount={unseenCount}
        />
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DashboardProvider>
        <DashboardShell>{children}</DashboardShell>
      </DashboardProvider>
    </AuthProvider>
  );
}