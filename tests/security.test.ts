import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

loadEnvFile(".env.local");
const configured = new URL(process.env.DATABASE_URL!);
if (process.env.NEON_AUTH_MODE !== "local" || !["127.0.0.1", "localhost"].includes(configured.hostname)) {
  throw new Error("Security fixtures may only run on the dedicated native local database.");
}

test("Supabase RLS permits only members to read signals and denies all client game writes", async () => {
  const admin = new pg.Client({ connectionString: configured.toString() });
  await admin.connect();
  const name = `neon_security_${randomUUID().replaceAll("-", "")}`;
  // Only a test-created database is removed; application data is never changed.
  await admin.query(`create database "${name}"`);
  const isolated = new URL(configured); isolated.pathname = `/${name}`;
  const client = new pg.Client({ connectionString: isolated.toString() });
  try {
    await client.connect();
    await client.query(`do $$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    end $$;`);
    // Same JWT claim contract as Supabase's auth.uid(), without a hosted service.
    await client.query(`create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create publication supabase_realtime;`);
    for (const migration of (await readdir("supabase/migrations")).filter((file) => file.endsWith(".sql")).sort()) {
      await client.query(await readFile(`supabase/migrations/${migration}`, "utf8"));
    }
    const roomId = randomUUID(); const member = randomUUID(); const outsider = randomUUID();
    await client.query("insert into heist_private.rooms(id,code,state) values($1,'ABC234','{}')", [roomId]);
    await client.query("insert into heist_private.members(room_id,user_id) values($1,$2)", [roomId, member]);
    await client.query("insert into public.room_updates(room_id,version) values($1,1)", [roomId]);
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub',$1,false)", [member]);
    assert.equal((await client.query("select * from public.room_updates")).rows.length, 1);
    await assert.rejects(client.query("update public.room_updates set version=999"), /permission denied/);
    await assert.rejects(client.query("insert into public.room_updates(room_id,version) values($1,999)", [randomUUID()]), /permission denied/);
    await assert.rejects(client.query("select state from heist_private.rooms"), /permission denied/);
    await assert.rejects(client.query("insert into heist_private.members(room_id,user_id) values($1,$2)", [roomId, outsider]), /permission denied/);
    await client.query("select set_config('request.jwt.claim.sub',$1,false)", [outsider]);
    assert.equal((await client.query("select * from public.room_updates")).rows.length, 0);
    await client.query("select set_config('request.jwt.claim.sub','',false)");
    assert.equal((await client.query("select * from public.room_updates")).rows.length, 0);
    await client.query("reset role");
    await client.query("set role anon");
    await assert.rejects(client.query("select * from public.room_updates"), /permission denied/);
    await assert.rejects(client.query("select public.neon_is_member($1)", [roomId]), /permission denied/);
    await client.query("reset role");
    const publication = await client.query("select tablename from pg_publication_tables where pubname='supabase_realtime'");
    assert.deepEqual(publication.rows.map((row) => row.tablename), ["room_updates"]);
  } finally {
    await client.end();
    await admin.query(`drop database "${name}"`);
    await admin.end();
  }
});
