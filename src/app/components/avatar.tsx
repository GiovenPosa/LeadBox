import styles from "./component-styles/avatar.module.css";

// A person's initials in a circle, tinted with one of the app's status
// colours. The colour comes from their email, so the same person looks the
// same everywhere (the Contacts list, the lead page).

const TONES = ["new", "contacted", "qualified", "won"] as const;

function toneFor(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

function initials(name: string | null, email: string | null) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email?.slice(0, 2) || "?").toUpperCase();
}

type AvatarProps = {
  name: string | null;
  email: string | null;
  /** xs: inside a dropdown option · sm: list rows · lg: page headers */
  size?: "xs" | "sm" | "lg";
};

export default function Avatar({ name, email, size = "sm" }: AvatarProps) {
  return (
    <span className={`${styles.avatar} ${styles[size]} ${styles[toneFor(email || name || "")]}`} aria-hidden="true">
      {initials(name, email)}
    </span>
  );
}
