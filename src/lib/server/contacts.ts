// Server-only: finding and filling in contacts, inside a transaction.

import type postgres from "postgres";
import { ApiError } from "./route";

type Tx = postgres.TransactionSql;

export type ContactDetails = {
  name: string | null;
  email: string | null;
  phone: string | null;
  business: string | null;
  industry: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The contact with this email, or a new one. An existing contact only has its
 * blanks filled in (and a new phone number added), so nothing typed in the app
 * is overwritten. A new contact needs an email or a phone number.
 */
export async function findOrCreateContact(tx: Tx, details: ContactDetails): Promise<string> {
  if (details.email && !EMAIL_PATTERN.test(details.email)) {
    throw new ApiError(400, "That email doesn't look right.");
  }

  if (details.email) {
    const [existing] = await tx`
      select id from public.contacts where email = ${details.email}::citext limit 1
    `;
    if (existing) {
      await fillContactGaps(tx, existing.id, details);
      return existing.id;
    }
  }

  if (!details.email && !details.phone) {
    throw new ApiError(400, "Add an email or a phone number for the contact.");
  }

  const [created] = await tx`
    insert into public.contacts (email, name, phone_numbers, business_name, industry)
    values (
      ${details.email},
      ${details.name},
      ${details.phone ? [details.phone] : []}::text[],
      ${details.business},
      ${details.industry}
    )
    returning id
  `;
  return created.id;
}

/** Fill a contact's blank name, business and industry, and add a new phone number */
export async function fillContactGaps(tx: Tx, contactId: string, details: Partial<ContactDetails>) {
  await tx`
    update public.contacts
    set
      name = coalesce(nullif(trim(name), ''), ${details.name ?? null}),
      business_name = coalesce(nullif(trim(business_name), ''), ${details.business ?? null}),
      industry = coalesce(nullif(trim(industry), ''), ${details.industry ?? null}),
      phone_numbers = case
        when ${details.phone ?? null}::text is null or ${details.phone ?? null}::text = any (phone_numbers)
          then phone_numbers
        else array_append(phone_numbers, ${details.phone ?? null}::text)
      end
    where id = ${contactId}
  `;
}
