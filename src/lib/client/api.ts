"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Command, RoomView } from "@/lib/game/types";

export const isLocal = process.env.NEXT_PUBLIC_NEON_AUTH_MODE === "local";
let supabase: SupabaseClient | null = null;
let identity: Promise<void> | null = null;

export function getSupabase() {
  if (isLocal) return null;
  if (supabase) return supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("The game service is not configured yet.");
  supabase = createClient(url, key);
  return supabase;
}

export function ensureIdentity() {
  if (!identity) identity = (async () => {
    if (isLocal) {
      const response = await fetch("/api/session", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error((await response.json()).error ?? "Unable to connect.");
    } else {
      const client = getSupabase()!;
      const { data } = await client.auth.getSession();
      if (!data.session) {
        const { error } = await client.auth.signInAnonymously();
        if (error) throw new Error("Unable to enter the city. Please try again shortly.");
      }
    }
  })().catch((error) => { identity = null; throw error; });
  return identity;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  await ensureIdentity();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!isLocal) {
    const { data } = await getSupabase()!.auth.getSession();
    headers.Authorization = `Bearer ${data.session?.access_token ?? ""}`;
  }
  const response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) identity = null;
    throw new ApiError(data.error ?? "Unable to connect. Try again.", response.status);
  }
  return data as T;
}

export function roomAction(room: RoomView, command: Command) {
  return api<RoomView | null>(`/api/rooms/${room.code}`, "PATCH", { ...command, matchId: room.matchId, expectedRound: room.round });
}
