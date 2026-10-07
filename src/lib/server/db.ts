import { Pool } from "pg";

const globalDb = globalThis as unknown as { neonPool?: Pool };

export function db() {
  if (globalDb.neonPool) return globalDb.neonPool;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing. Run npm run local:setup or configure Supabase.");
  const url = new URL(process.env.DATABASE_URL);
  // node-postgres URL SSL options can override the explicit verification policy.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
  const useSsl = process.env.DATABASE_SSL !== "false";
  if (process.env.VERCEL && !useSsl) throw new Error("TLS is required for the production database.");
  globalDb.neonPool = new Pool({
    connectionString: url.toString(),
    ssl: useSsl ? { rejectUnauthorized: true, ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, "\n") } : {}) } : false,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
    application_name: "neon-heist",
  });
  globalDb.neonPool.on("error", () => console.error("An idle database connection failed."));
  return globalDb.neonPool;
}

export async function enforceLimit(key: string, limit: number, seconds: number) {
  const result = await db().query<{ count: number }>(`
    insert into heist_private.rate_limits(key, count, reset_at)
    values ($1, 1, clock_timestamp() + $2 * interval '1 second')
    on conflict (key) do update set
      count = case when heist_private.rate_limits.reset_at <= clock_timestamp() then 1 else heist_private.rate_limits.count + 1 end,
      reset_at = case when heist_private.rate_limits.reset_at <= clock_timestamp() then clock_timestamp() + $2 * interval '1 second' else heist_private.rate_limits.reset_at end
    returning count
  `, [key, seconds]);
  return result.rows[0].count <= limit;
}
