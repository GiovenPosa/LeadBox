import type { ComponentProps, ReactNode } from "react";
import styles from "./component-styles/formFields.module.css";

// The app's form controls: a labelled field (with an optional icon) and the
// inputs that go in it. Used by the lead qualification form and the outreach
// editor, so both look and focus the same way.

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

type FieldProps = {
  label: string;
  icon?: ReactNode;
  /** the control's id; leave it out for a group of buttons, like chips */
  htmlFor?: string;
  className?: string;
  children: ReactNode;
};

export function Field({ label, icon, htmlFor, className, children }: FieldProps) {
  const LabelTag = htmlFor ? "label" : "span";
  return (
    <div className={cx(styles.field, className)}>
      <LabelTag className={styles.label} htmlFor={htmlFor}>
        {icon}
        {label}
      </LabelTag>
      {children}
    </div>
  );
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cx(styles.control, className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cx(styles.control, styles.select, className)} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(styles.control, styles.textarea, className)} />;
}
