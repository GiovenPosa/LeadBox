import type { ReactNode } from "react";
import styles from "./component-styles/pill.module.css";

// A small coloured label for a status or stage. The tones are the app's
// status colours, so a "won" deal looks the same on every page.

export type PillTone = "new" | "contacted" | "qualified" | "won" | "lost" | "bad" | "neutral";

export default function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return <span className={`${styles.pill} ${styles[tone]}`}>{children}</span>;
}
