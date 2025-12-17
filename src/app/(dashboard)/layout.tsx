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
        <TopBar
          title={pageTitle}
          breadcrumbs={breadcrumbs}
          email={email}
          onSignOut={signOut}
        />

        {/* Page content rendered here */}
        {children}
      </div>

      {/* Mobile Dock Bar */}
      <DockBar
        activePage={activePage === "lead" ? "inbox" : activePage}
        inboxUnseenCount={unseenCount}
      />
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