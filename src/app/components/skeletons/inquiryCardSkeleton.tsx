"use client";

import styles from "./skeleton-styles/inquiryCardSkeleton.module.css";

export default function InquiryCardSkeleton() {
  return (
    <article className={styles.card} aria-hidden="true">
      <div className={styles.cardContent}>
        {/* Main Row */}
        <div className={styles.mainRow}>
          <div className={styles.primaryInfo}>
            {/* Name */}
            <div className={styles.nameSkeleton} />

            {/* Status badge */}
            <div className={styles.statusSkeleton} />
          </div>

          {/* Timestamp */}
          <div className={styles.timestampSkeleton} />
        </div>

        {/* Contact row */}
        <div className={styles.contact}>
          <div className={styles.contactSkeleton} />
          <div className={styles.contactSkeletonShort} />
        </div>

        {/* Message */}
        <div className={styles.messageSkeleton} />
        <div className={styles.messageSkeletonShort} />

        {/* Tags */}
        <div className={styles.tagsRow}>
          <div className={styles.tagSkeleton} />
          <div className={styles.tagSkeleton} />
          <div className={styles.tagSkeletonSmall} />
        </div>
      </div>
    </article>
  );
}