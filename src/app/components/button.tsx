import type { ComponentProps, ReactNode } from "react";
import styles from "./component-styles/button.module.css";

// The app's pill button. Every variant shares one base style and only swaps
// its colours (see button.module.css).

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "ghostDanger";
export type ButtonSize = "sm" | "md";

type ButtonProps = ComponentProps<"button"> & {
  /** primary: blue · secondary: grey · danger: red · ghost: no fill */
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  /** disables the button while something runs; pass the "…ing" label as children */
  busy?: boolean;
};

export default function Button({
  variant = "secondary",
  size = "md",
  icon,
  busy = false,
  type = "button",
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], icon ? styles.withIcon : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...props}
      type={type}
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children != null && children !== false && <span className={styles.label}>{children}</span>}
    </button>
  );
}

type LinkButtonProps = ComponentProps<"a"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

/** A link that looks like a Button, for mailto:, tel: and page links */
export function LinkButton({ variant = "secondary", size = "md", icon, className, children, ...props }: LinkButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], icon ? styles.withIcon : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <a {...props} className={classes}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children != null && children !== false && <span className={styles.label}>{children}</span>}
    </a>
  );
}

type IconButtonProps = Omit<ButtonProps, "children" | "icon"> & {
  icon: ReactNode;
  /** read out by screen readers and shown as the tooltip */
  label: string;
  /** a small dot in the corner, e.g. when a filter or sort is applied */
  indicator?: boolean;
};

/** A square Button with only an icon */
export function IconButton({ icon, label, indicator = false, className, ...props }: IconButtonProps) {
  return (
    <Button
      {...props}
      icon={icon}
      aria-label={label}
      title={label}
      className={[styles.iconOnly, indicator ? styles.indicator : "", className].filter(Boolean).join(" ")}
    />
  );
}
