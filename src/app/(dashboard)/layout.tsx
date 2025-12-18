"use client";

import { ReactNode } from "react";
import { AuthProvider, useAuth } from "../context/authContext";
import { DashboardProvider, useDashboard } from "../context/dashboardContext";
import { useInbox } from "../context/inboxContext";
import Sidebar from "../components/sidebar";
import TopBar from "../components/topbar";
import DockBar from "../components/dockbar";
import styles from "./homePage.module.css";

function DashboardShell({ children }: { children: ReactNode }) {
  const { email, loading, signOut } = useAuth();
  const { activePage, breadcrumbs, pageTitle } = useDashboard();
  const { unseenCount } = useInbox();

  // Show nothing while checking auth
  if (loading || !email) {
    return null;
  }

  // Check if we're on a lead page (hide topbar/dockbar on mobile)
  const isLeadPage = activePage === "lead";

  return (
    <div className={styles.workspace}>
      {/* Sidebar - Desktop only */}
      <Sidebar
        email={email}
        onSignOut={signOut}
        inboxUnseenCount={unseenCount}
        activePage={activePage === "lead" ? "inbox" : activePage}
      />

      {/* Main Area */}
      <div className={styles.main}>
        {/* TopBar - Hidden on mobile for lead pages */}
        <div className={isLeadPage ? styles.hideOnMobile : undefined}>
          <TopBar
            title={pageTitle}
            breadcrumbs={breadcrumbs}
            email={email}
            onSignOut={signOut}
          />
        </div>

        {/* Page content rendered here */}
        {children}
      </div>

      {/* Mobile Dock Bar - Hidden on lead pages */}
      {!isLeadPage && (
        <DockBar
          activePage={activePage === "lead" ? "inbox" : activePage}
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