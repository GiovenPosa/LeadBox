// app/(dashboard)/layout.tsx
"use client";

import { ReactNode, useState, useEffect } from "react";
import { AuthProvider, useAuth } from "../context/authContext";
import { DashboardProvider, useDashboard } from "../context/dashboardContext";
import { useInbox } from "../context/inboxContext";
import Sidebar from "../components/sidebar";
import TopBar from "../components/topbar";
import DockBar from "../components/dockbar";
import SplashScreen from "../components/splashScreen";
import styles from "./homePage.module.css";

type NavActivePage = "inbox" | "contacts" | "projects" | "analytics";

function DashboardShell({ children }: { children: ReactNode }) {
  const { email, loading, signOut } = useAuth();
  const { activePage, breadcrumbs, pageTitle } = useDashboard();
  const { unseenCount } = useInbox();
  const [showSplash, setShowSplash] = useState(true);

  // Hide splash when auth is done
  useEffect(() => {
    if (!loading && email) {
      // Small delay so content has time to render
      const timer = setTimeout(() => setShowSplash(false), 300);
      return () => clearTimeout(timer);
    }
  }, [loading, email]);

  // Show splash while loading OR if not authenticated yet
  if (loading || !email) {
    return <SplashScreen />;
  }

  const isLeadPage = activePage === "lead";
  const navActivePage: NavActivePage = isLeadPage ? "inbox" : activePage;

  return (
    <>
      {showSplash && <SplashScreen />}
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
    </>
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