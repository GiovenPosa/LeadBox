"use client";

import styles from "./leadPageSkeleton.module.css";

export default function LeadPageSkeleton() {
  return (
    <div className={styles.layout} aria-hidden="true">
      {/* Lead Header Card Skeleton */}
      <div className={styles.card}>
        {/* Header Row: Name + Status */}
        <div className={styles.cardHeader}>
          <div className={styles.cardNameRow}>
            <div className={`${styles.skeleton} ${styles.nameSkeleton}`} />
            <div className={`${styles.skeleton} ${styles.statusSkeleton}`} />
          </div>
          <div className={`${styles.skeleton} ${styles.metaPillSkeleton}`} />
        </div>

        {/* Contact Links */}
        <div className={styles.contacts}>
          <div className={`${styles.skeleton} ${styles.contactSkeleton}`} />
          <div className={`${styles.skeleton} ${styles.contactSkeletonShort}`} />
        </div>

        {/* Message/Note Block */}
        <div className={styles.noteBlock}>
          <div className={`${styles.skeleton} ${styles.noteSkeleton}`} />
          <div className={`${styles.skeleton} ${styles.noteSkeletonShort}`} />
        </div>

        {/* Tags Row */}
        <div className={styles.tagsRow}>
          <div className={`${styles.skeleton} ${styles.tagSkeleton}`} />
          <div className={`${styles.skeleton} ${styles.tagSkeleton}`} />
          <div className={`${styles.skeleton} ${styles.tagSkeletonSmall}`} />
        </div>
      </div>

      {/* Action Buttons Skeleton */}
      <div className={`${styles.skeleton} ${styles.actionBtnSkeleton}`} />
      <div className={`${styles.skeleton} ${styles.actionBtnSkeleton}`} />
    </div>
  );
}