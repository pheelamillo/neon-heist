import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { db } from "../src/lib/server/db";
import type { RoomView } from "../src/lib/game/types";

loadEnvFile(".env.local");
if (process.env.NEON_AUTH_MODE !== "local") throw new Error("HTTP tests require native local development.");
const base = "http://localhost:3000";
const created: string[] = [];
after(async () => {
  await db().query("delete from heist_private.rooms where id=any($1::uuid[])", [created]);
  await db().end();
});

async function session() {
  const response = await fetch(`${base}/api/session`, { method: "POST", headers: { Origin: base, "Sec-Fetch-Site": "same-origin" } });
  assert.equal(response.status, 200, "localhost session creation must pass the origin check");
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  return async function request<T>(route: string, method = "GET", body?: unknown): Promise<T> {
    const result = await fetch(`${base}${route}`, { method, headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const value = await result.json();
    assert.ok(result.ok, `HTTP ${result.status}: ${value.error}`);
    return value as T;
  };
}

test("separate cookie sessions play four complete rounds over HTTP, keep loot private, and rematch", { timeout: 60000 }, async () => {
  const alice = await session(); const bob = await session();
  let room = await alice<RoomView>("/api/rooms", "POST", { nickname: "HTTP Alice", roundSeconds: 20 });
  created.push(room.id);
  const endpoint = `/api/rooms/${room.code}`;
  await bob(endpoint, "POST", { nickname: "HTTP Bob" });
  const generation = { matchId: room.matchId, expectedRound: 0 };
  await bob(endpoint, "PATCH", { ...generation, type: "ready", ready: true });
  room = await alice(endpoint, "PATCH", { ...generation, type: "start" });
  for (let round = 1; round <= 4; round++) {
    assert.equal(room.round, round);
    const plan = { matchId: room.matchId, expectedRound: round, type: "submit", operative: round % 2 ? "ghost" : "oracle", target: round === 1 ? 1 : 0 };
    await alice(endpoint, "PATCH", { ...plan, doubleCross: round === 1 });
    const privateView = await bob<RoomView>(endpoint);
    assert.equal(privateView.players[0].score, null);
    assert.equal(privateView.mySubmission, null);
    await bob(endpoint, "PATCH", { ...plan, doubleCross: false });
    room = await alice(endpoint);
    assert.equal(room.phase, "reveal");
    assert.equal(room.history.length, round);
    assert.equal(room.players[1].score, null);
    assert.equal(room.history[round - 1].players[1].earned, null);
    // Use real persisted reveal deadlines; no database clock/time manipulation.
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, room.deadline! - room.serverNow) + 100));
    room = await alice(endpoint);
  }
  assert.equal(room.phase, "finished");
  assert.deepEqual(room.players.map((player) => player.score), [25000, 15000]);
  const reconnect = await bob<RoomView>(endpoint);
  assert.equal(reconnect.me, room.players[1].id);
  assert.deepEqual(reconnect.players.map((player) => player.score), [25000, 15000]);
  const newMatch = await alice<RoomView>(endpoint, "PATCH", { matchId: room.matchId, expectedRound: 4, type: "rematch" });
  assert.equal(newMatch.phase, "lobby");
  assert.notEqual(newMatch.matchId, room.matchId);
  assert.equal((await bob<RoomView>(endpoint)).phase, "lobby");
});

test("malicious cross-site session creation stays blocked", async () => {
  const response = await fetch(`${base}/api/session`, { method: "POST", headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" } });
  assert.equal(response.status, 403);
});

test("one click practice starts over HTTP and accepts the simplified vault-only move", async () => {
  const human = await session(); const outsider = await session();
  const room = await human<RoomView>("/api/rooms", "POST", { nickname: "Solo Player", roundSeconds: 45, mode: "practice" });
  created.push(room.id);
  assert.equal(room.phase, "planning");
  assert.equal(room.players[1].isComputer, true);
  assert.equal(room.players[1].submitted, true);
  assert.equal(room.mySubmission, null);
  await assert.rejects(outsider(`/api/rooms/${room.code}`, "POST", { nickname: "Guest" }), /HTTP 403/);
  const revealed = await human<RoomView>(`/api/rooms/${room.code}`, "PATCH", { type: "submit", target: 2, doubleCross: false, matchId: room.matchId, expectedRound: 1 });
  assert.equal(revealed.phase, "reveal");
  assert.equal(revealed.history.length, 1);
  assert.equal(revealed.mySubmission?.target, 2);
  assert.equal(revealed.players[1].score, null);
  const reconnect = await human<RoomView>(`/api/rooms/${room.code}`);
  assert.equal(reconnect.me, revealed.me);
  assert.equal(reconnect.mySubmission?.operative, revealed.mySubmission?.operative);
});
