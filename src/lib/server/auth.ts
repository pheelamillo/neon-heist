import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { GameError } from "@/lib/game/engine";
import { db, enforceLimit } from "./db";

export const SESSION_COOKIE = "neon_session";

export function localAuthEnabled() {
  const mode = process.env.NEON_AUTH_MODE ?? "supabase";
  if (mode !== "local") return false;
  if (process.env.VERCEL) throw new Error("Local authentication cannot run on Vercel. Set both auth modes to supabase.");
  const databaseHost = new URL(process.env.DATABASE_URL ?? "postgresql://127.0.0.1").hostname;
  if (!["127.0.0.1", "localhost", "[::1]"].includes(databaseHost)) throw new Error("Local authentication requires a loopback database.");
  return true;
}

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }

export async function getIdentity(request: NextRequest) {
  if (localAuthEnabled()) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new GameError("Reconnect to continue.", 401);
    const result = await db().query<{ user_id: string }>(
      "select user_id from heist_private.local_sessions where token_hash=$1 and expires_at > clock_timestamp()", [hash(token)],
    );
    if (!result.rows.length) throw new GameError("Your session has expired. Create a new room or rejoin.", 401);
    return result.rows[0].user_id;
  }
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new GameError("Reconnect to continue.", 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase authentication is not configured.");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new GameError("Your session has expired. Reconnect to continue.", 401);
  return data.user.id;
}

export async function localSession(request: NextRequest) {
  if (!localAuthEnabled()) throw new GameError("Local sessions are disabled.", 404);
  try {
    const userId = await getIdentity(request);
    return { userId, token: null };
  } catch (error) { if (!(error instanceof GameError)) throw error; }
  // Native development only; in production Supabase enforces sign-in limits.
  const ip = process.env.VERCEL ? request.headers.get("x-forwarded-for")?.split(",")[0] : "local";
  if (!await enforceLimit(`session:${hash(ip ?? "unknown")}`, 100, 3600)) throw new GameError("Too many sessions. Try again later.", 429);
  const token = randomBytes(32).toString("hex");
  const userId = randomUUID();
  await db().query("insert into heist_private.local_sessions(token_hash, user_id, expires_at) values($1,$2,clock_timestamp() + interval '7 days')", [hash(token), userId]);
  return { userId, token };
}
