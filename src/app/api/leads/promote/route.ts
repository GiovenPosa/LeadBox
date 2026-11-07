import { adminRoute, ApiError, textField, uuidField } from "../../../../lib/server/route";
import { fillContactGaps, findOrCreateContact } from "../../../../lib/server/contacts";
import { industryLabel, type Industry } from "../../../../lib/outreach";
import { logActivityTx } from "../../../../lib/server/activity";

// POST /api/leads/promote
//   { outreachId, contactId }                              use an existing contact
//   { outreachId, contact: { name, email, phone, business } }  find by email or create
// Makes an outreach business a lead and moves it to the converted stage.
// Promoting the same business again returns its lead.

export const POST = adminRoute(async ({ sql, userId, body }) => {
  const outreachId = uuidField(body, "outreachId");
  const existingContactId = body.contactId != null ? uuidField(body, "contactId") : null;
  const details = (body.contact ?? {}) as Record<string, unknown>;

  return sql.begin(async (tx) => {
    const [already] = await tx`select id, stage from public.leads where outreach_id = ${outreachId}`;
    if (already) return { lead: already };

    const [outreach] = await tx`
      select id, business_name, industry from public.outreach where id = ${outreachId} for update
    `;
    if (!outreach) throw new ApiError(404, "That business no longer exists in Outreach.");
    const industry = industryLabel(outreach.industry as Industry);

    let contactId: string;
    if (existingContactId) {
      const [contact] = await tx`select id from public.contacts where id = ${existingContactId}`;
      if (!contact) throw new ApiError(404, "That contact no longer exists.");
      contactId = contact.id;
      await fillContactGaps(tx, contactId, { industry });
    } else {
      contactId = await findOrCreateContact(tx, {
        name: textField(details, "name"),
        email: textField(details, "email"),
        phone: textField(details, "phone", 50),
        business: textField(details, "business") ?? outreach.business_name,
        industry,
      });
    }

    const [lead] = await tx`
      insert into public.leads (outreach_id, contact_id)
      values (${outreachId}, ${contactId})
      returning id, stage
    `;
    await tx`update public.outreach set stage = 'converted' where id = ${outreachId}`;
    await logActivityTx(tx, userId, "outreach.promoted", `${outreach.business_name} became a lead`, {
      outreach_id: outreachId,
      lead_id: lead.id,
      contact_id: contactId,
    });
    return { lead };
  });
});
