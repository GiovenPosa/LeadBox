// app/components/splashScreen.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./component-styles/splashScreen.module.css";

export default function SplashScreen({ onFinish }: { onFinish?: () => void }) {
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");

  useEffect(() => {
    // Brief moment to show the animation
    const visibleTimer = setTimeout(() => setPhase("visible"), 1000);
    
    return () => clearTimeout(visibleTimer);
  }, []);

  // Call this when ready to dismiss
  useEffect(() => {
    if (phase === "exit") {
      const exitTimer = setTimeout(() => {
        onFinish?.();
      }, 400); // Match CSS transition
      return () => clearTimeout(exitTimer);
    }
  }, [phase, onFinish]);

  return (
    <div className={`${styles.splash} ${styles[phase]}`}>
      <div className={styles.content}>
        <div className={styles.logoWrap}>
          <Image
            src="/icons/icon-512.png"
            alt="LeadBox"
            width={200}
            height={200}
            className={styles.logo}
            priority
          />
        </div>
        <span className={styles.appName}>LeadBox</span>
      </div>
    </div>
  );
}