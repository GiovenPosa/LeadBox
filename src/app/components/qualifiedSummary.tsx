"use client";

import styles from "./component-styles/qualifiedSummary.module.css";
import {
  HiCheck,
  HiOutlineGlobeAlt,
  HiOutlineLink,
  HiOutlineCalendarDays,
  HiOutlineBuildingOffice2,
  HiOutlineUserGroup,
  HiOutlineShoppingBag,
  HiOutlineDocumentText,
  HiOutlinePuzzlePiece,
  HiOutlineRectangleStack,
  HiOutlineMagnifyingGlass,
  HiOutlineExclamationTriangle,
  HiOutlineArrowRightCircle,
  HiOutlineRocketLaunch,
  HiOutlinePencilSquare,
  HiOutlinePaperClip,
  HiOutlineIdentification
} from "react-icons/hi2";

/* =========================================================
   Types
========================================================= */

export type Timeline =
  | "ASAP"
  | "1-2 weeks"
  | "2-4 weeks"
  | "1-2 months"
  | "3+ months"
  | "Not sure";

export type Goal =
  | "More leads"
  | "Look premium"
  | "Improve conversion"
  | "Showcase work"
  | "Rank on Google"
  | "Faster site"
  | "Clear pricing"
  | "Launch MVP"
  | "Build credibility"
  | "User signups"
  | "Book demos"
  | "Local visibility"
  | "Stand out"
  | "Mobile-first"
  | "Refresh brand"
  | "Other";

export type SelectedPackage = "Starter" | "Redesign" | "Lead System";
export type ContentStatus =
  | "Ready"
  | "Partly ready"
  | "Need help"
  | "Brand assets ready"
  | "Unknown";

export type FormState = {
  timeline: Timeline;
  goals: Goal[];
  challenges: string;
  selected_package: SelectedPackage;
  websiteUrl: string;
  businessName: string;
  targetAudience: string;
  products: string;
  contentStatus: ContentStatus;
  pagesNeeded: string;
  seoPriority: "Low" | "Medium" | "High";
  integrations: string;
  nextSteps: string;
  meetingNotes: string;
};

/* =========================================================
   Helpers
========================================================= */

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================================================
   SummaryItem Component
========================================================= */

type SummaryItemProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  isLink?: boolean;
};

export function SummaryItem({ icon, label, value, isLink }: SummaryItemProps) {
  return (
    <div className={styles.summaryItem}>
      <div className={styles.summaryItemIcon}>{icon}</div>
      <div className={styles.summaryItemContent}>
        <span className={styles.summaryItemLabel}>{label}</span>
        {isLink ? (
          <a
            href={value.startsWith("http") ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.summaryItemLink}
          >
            {value}
          </a>
        ) : (
          <span className={styles.summaryItemValue}>{value}</span>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   QualifiedSummary Component
========================================================= */

type QualifiedSummaryProps = {
  form: FormState;
  qualifiedAt: string | null;
  onEdit: () => void;
};

export default function QualifiedSummary({ form, qualifiedAt, onEdit }: QualifiedSummaryProps) {
  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryHeader}>
        <div className={styles.summaryHeaderLeft}>
          <HiCheck size={18} className={styles.summaryCheckIcon} />
          <h2 className={styles.summaryTitle}>Qualification Complete</h2>
        </div>
        {qualifiedAt && (
          <span className={styles.summaryDate}>
            {formatDateTime(qualifiedAt)}
          </span>
        )}
      </div>
      <div className={styles.summarySectionHeader}>
        <HiOutlineIdentification size={20} />
        <span>Summary</span>
      </div>

      <div className={styles.summaryGrid}>
        {/* Business Info */}
        {form.businessName && (
          <SummaryItem
            icon={<HiOutlineBuildingOffice2 size={20} />}
            label="Business"
            value={form.businessName}
          />
        )}

        {form.websiteUrl && (
          <SummaryItem
            icon={<HiOutlineLink size={20} />}
            label="Website"
            value={form.websiteUrl}
            isLink
          />
        )}

        <SummaryItem
          icon={<HiOutlineGlobeAlt size={20} />}
          label="Package"
          value={form.selected_package}
        />

        <SummaryItem
          icon={<HiOutlineCalendarDays size={20} />}
          label="Timeline"
          value={form.timeline}
        />

        {form.products && (
          <SummaryItem
            icon={<HiOutlineShoppingBag size={20} />}
            label="Products"
            value={form.products}
          />
        )}

        {form.targetAudience && (
          <SummaryItem
            icon={<HiOutlineUserGroup size={20} />}
            label="Target Audience"
            value={form.targetAudience}
          />
        )}

        <SummaryItem
          icon={<HiOutlineDocumentText size={20} />}
          label="Content Status"
          value={form.contentStatus}
        />

        <SummaryItem
          icon={<HiOutlineMagnifyingGlass size={20} />}
          label="SEO Priority"
          value={form.seoPriority}
        />

        {form.pagesNeeded && (
          <SummaryItem
            icon={<HiOutlineRectangleStack size={20} />}
            label="Pages Needed"
            value={form.pagesNeeded}
          />
        )}

        {form.integrations && (
          <SummaryItem
            icon={<HiOutlinePuzzlePiece size={20} />}
            label="Integrations"
            value={form.integrations}
          />
        )}
      </div>

      {/* Goals */}
      {form.goals.length > 0 && (
        <div className={styles.summarySection}>
          <div className={styles.summarySectionHeader}>
            <HiOutlineRocketLaunch size={20} />
            <span>Goals</span>
          </div>
          <div className={styles.summaryGoals}>
            {form.goals.map((goal) => (
              <span key={goal} className={styles.summaryGoalChip}>
                {goal}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Challenges */}
      {form.challenges && (
        <div className={styles.summarySection}>
          <div className={styles.summarySectionHeader}>
            <HiOutlineExclamationTriangle size={20} />
            <span>Challenges</span>
          </div>
          <p className={styles.summaryText}>{form.challenges}</p>
        </div>
      )}

      {/* Next Steps */}
      {form.nextSteps && (
        <div className={styles.summarySection}>
          <div className={styles.summarySectionHeader}>
            <HiOutlineArrowRightCircle size={20} />
            <span>Next Steps</span>
          </div>
          <p className={styles.summaryText}>{form.nextSteps}</p>
        </div>
      )}

      {/* Meeting Notes */}
      {form.meetingNotes && (
        <div className={styles.summarySection}>
          <div className={styles.summarySectionHeader}>
            <HiOutlinePaperClip size={20} />
            <span>Meeting Notes</span>
          </div>
          <p className={styles.summaryText}>{form.meetingNotes}</p>
        </div>
      )}

      <button className={styles.editQualificationBtn} onClick={onEdit}>
        <HiOutlinePencilSquare size={18} />
        Edit
      </button>
    </div>
  );
}