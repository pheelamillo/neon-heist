import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

if (process.env.NEON_AUTH_MODE !== "supabase" || process.env.NEXT_PUBLIC_NEON_AUTH_MODE !== "supabase") {
  throw new Error("Switch both auth modes to supabase and run the Next.js server before this hosted smoke test.");
}
const base = process.env.NEON_TEST_URL ?? "http://127.0.0.1:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase URL and publishable key are required.");
const players = Array.from({ length: 3 }, () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
const channels = [];
let room;
async function api(client, route, method = "GET", body) {
  const { data } = await client.auth.getSession();
  const response = await fetch(`${base}${route}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json();
  assert.ok(response.ok, `HTTP ${response.status}: ${result.error ?? "Unexpected failure"}`);
  return result;
}
async function subscribe(client, roomId) {
  await client.realtime.setAuth((await client.auth.getSession()).data.session.access_token);
  let changed, failed, eventTimeout, replicationReady;
  const listening = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Postgres Changes listener timed out.")), 15000);
    replicationReady = () => { clearTimeout(timeout); resolve(); };
  });
  listening.catch(() => {});
  const update = new Promise((resolve, reject) => {
    changed = (value) => { clearTimeout(eventTimeout); resolve(value); };
    failed = (error) => { clearTimeout(eventTimeout); reject(error); };
  });
  // Prevent a transient unhandled rejection while waiting for channel setup.
  update.catch(() => {});
  const channel = client.channel(`smoke:${roomId}`)
    .on("system", {}, (payload) => {
      if (process.env.NEON_SMOKE_DEBUG) console.log("Realtime system:", payload);
      if (payload.extension === "postgres_changes" && payload.status === "ok") replicationReady();
      if (payload.status === "error") failed(new Error(`Realtime: ${payload.message}`));
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "room_updates", filter: `room_id=eq.${roomId}` }, (payload) => changed(payload.new));
  channels.push([client, channel]);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Realtime subscription timed out.")), 12000);
    channel.subscribe((status, error) => {
      if (process.env.NEON_SMOKE_DEBUG) console.log("Realtime status:", status, error?.message ?? "");
      if (status === "SUBSCRIBED") { clearTimeout(timeout); resolve(); }
      if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) { clearTimeout(timeout); reject(new Error(`Realtime: ${status}`)); }
    });
  });
  // A joined WebSocket can precede the actual replication listener.
  await listening;
  eventTimeout = setTimeout(() => failed(new Error("No Realtime update received.")), 30000);
  return { update };
}

try {
  for (const client of players) {
    const { error } = await client.auth.signInAnonymously();
    if (error) throw new Error("Anonymous sign-in failed. Enable it in the Supabase project.");
  }
  room = await api(players[0], "/api/rooms", "POST", { nickname: "Smoke Host", roundSeconds: 60 });
  const endpoint = `/api/rooms/${room.code}`;
  await api(players[1], endpoint, "POST", { nickname: "Smoke Guest" });
  const memberSignal = await players[1].from("room_updates").select("*").eq("room_id", room.id);
  assert.ifError(memberSignal.error); assert.equal(memberSignal.data.length, 1);
  const outsider = await players[2].from("room_updates").select("*").eq("room_id", room.id);
  assert.ifError(outsider.error); assert.equal(outsider.data.length, 0);
  const forged = await players[1].from("room_updates").update({ version: 999 }).eq("room_id", room.id);
  assert.ok(forged.error, "Direct client writes must fail.");
  const signals = await Promise.all([subscribe(players[0], room.id), subscribe(players[1], room.id)]);
  if (process.env.NEON_SMOKE_DEBUG) console.log("Both subscriptions joined; changing room state.");
  const generation = { matchId: room.matchId, expectedRound: 0 };
  await api(players[1], endpoint, "PATCH", { ...generation, type: "ready", ready: true });
  if (process.env.NEON_SMOKE_DEBUG) console.log("Authoritative ready command committed.");
  for (const { update } of signals) {
    const payload = await update;
    assert.deepEqual(Object.keys(payload).sort(), ["room_id", "updated_at", "version"]);
  }
  await api(players[0], endpoint, "PATCH", { ...generation, type: "start" });
  const plans = { matchId: room.matchId, expectedRound: 1, type: "submit", operative: "ghost", target: 1 };
  await api(players[0], endpoint, "PATCH", { ...plans, doubleCross: true });
  const secret = await api(players[1], endpoint);
  assert.equal(secret.mySubmission, null);
  assert.equal(secret.players[0].doubleCrossAvailable, true);
  await api(players[1], endpoint, "PATCH", { ...plans, doubleCross: false });
  const result = await api(players[0], endpoint);
  assert.equal(result.phase, "reveal");
  assert.deepEqual(result.players.map((player) => player.score), [10000, null]);
  console.log("PASS: hosted Supabase identity, membership RLS, forbidden client writes, two Realtime subscribers, hidden plans, and authoritative scoring.");
  console.log("Test accounts are anonymous. Include them in your normal anonymous-account retention cleanup.");
} finally {
  for (const [client, channel] of channels) await client.removeChannel(channel);
  for (const client of players) { await client.removeAllChannels(); await client.auth.signOut(); }
}
