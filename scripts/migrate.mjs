import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export async function migrate(connectionString, ssl = false) {
  const parsed = new URL(connectionString);
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) parsed.searchParams.delete(key);
  const client = new pg.Client({ connectionString: parsed.toString(), ssl: ssl ? { rejectUnauthorized: true,
    ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, "\n") } : {}),
  } : false });
  await client.connect();
  try {
    // Transaction pooling can change backends between transactions. Keep the
    // lock and all migration statements in one transaction on one backend.
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(78234721)");
    await client.query("create schema if not exists heist_private");
    await client.query("revoke all on schema heist_private from public");
    await client.query("create table if not exists heist_private.migrations (name text primary key, applied_at timestamptz default now())");
    const migrationsPath = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));
    const applied = [];
    for (const file of (await readdir(migrationsPath)).filter((name) => name.endsWith(".sql")).sort()) {
      if ((await client.query("select 1 from heist_private.migrations where name=$1", [file])).rowCount) continue;
      const sql = (await readFile(path.join(migrationsPath, file), "utf8")).replace(/^begin;\s*/i, "").replace(/commit;\s*$/i, "");
      await client.query(sql);
      await client.query("insert into heist_private.migrations(name) values($1)", [file]);
      applied.push(file);
    }
    await client.query("commit");
    for (const file of applied) console.log(`Applied ${file}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { await client.end(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before running migrations.");
  await migrate(process.env.DATABASE_URL, process.env.DATABASE_SSL !== "false");
}
