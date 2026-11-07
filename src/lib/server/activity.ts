// Server-only: logging to the activity table inside an API route's transaction,
// so the log line is saved with the change or not at all.

import type postgres from "postgres";
import type { ActivityKind } from "../activity";

type Tx = postgres.TransactionSql;

export async function logActivityTx(
  tx: Tx,
  actorId: string,
  kind: ActivityKind,
  summary: string,
  refs: { contact_id?: string | null; inquiry_id?: string | null; outreach_id?: string | null; lead_id?: string | null } = {}
) {
  await tx`
    insert into public.activity (actor_id, kind, summary, contact_id, inquiry_id, outreach_id, lead_id)
    values (
      ${actorId}, ${kind}, ${summary},
      ${refs.contact_id ?? null}, ${refs.inquiry_id ?? null}, ${refs.outreach_id ?? null}, ${refs.lead_id ?? null}
    )
  `;
}
