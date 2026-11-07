// Server-only: a direct Postgres connection, for work that has to happen as
// one transaction (Supabase's JS client can't do that). Never import this from
// a "use client" file.
//
// SUPABASE_DB_URL is the Transaction pooler connection string from the
// Supabase dashboard (Connect → Transaction pooler), e.g.
// postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres

import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

// One pool per server process; kept on globalThis so dev hot reloads don't open new ones
const globalForDb = globalThis as unknown as { leadboxSql?: Sql };

export function getDb(): Sql | null {
  const url = process.env.SUPABASE_DB_URL?.trim();
  if (!url || !/^postgres(ql)?:\/\//.test(url)) return null;

  if (!globalForDb.leadboxSql) {
    globalForDb.leadboxSql = postgres(url, {
      // the transaction pooler doesn't support prepared statements
      prepare: false,
      max: 5,
      idle_timeout: 20,
    });
  }
  return globalForDb.leadboxSql;
}
