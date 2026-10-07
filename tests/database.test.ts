import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { db } from "../src/lib/server/db";
import { accessRoom, newRoom } from "../src/lib/server/store";
import type { Command, CommandRequest, Room, RoomView } from "../src/lib/game/types";

if (existsSync(".env.local")) loadEnvFile(".env.local");
if (process.env.NEON_AUTH_MODE !== "local" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname)) {
  throw new Error("Integration tests require the dedicated native local database. They must not run against production.");
}
const roomIds: string[] = [];
after(async () => {
  await db().query("delete from heist_private.rooms where id=any($1::uuid[])", [roomIds]);
  await db().end();
});

async function fixture() {
  const alice = randomUUID(); const bob = randomUUID();
  const room = await newRoom(alice, "Alice", 20);
  roomIds.push(room.id);
  await accessRoom(room.code, bob, { nickname: "Bob" });
  return { alice, bob, room: (await accessRoom(room.code, alice))! };
}
function command(room: RoomView, value: Command): CommandRequest { return { ...value, matchId: room.matchId, expectedRound: room.round }; }
async function start() {
  const f = await fixture();
  await accessRoom(f.room.code, f.bob, { command: command(f.room, { type: "ready", ready: true }) });
  f.room = (await accessRoom(f.room.code, f.alice, { command: command(f.room, { type: "start" }) }))!;
  return f;
}

test("independent requests persist in the database and outsiders cannot read", async () => {
  const { room, alice } = await fixture();
  assert.equal(room.players.length, 2);
  const raw = (await db().query<{ state: Room }>("select state from heist_private.rooms where id=$1", [room.id])).rows[0].state;
  assert.equal(raw.players.length, 2);
  assert.equal((await accessRoom(room.code, alice))!.id, room.id);
  await assert.rejects(accessRoom(room.code, randomUUID()), /Join this room/);
  assert.equal((await accessRoom(room.code, alice, { nickname: "Alice" }))!.players.length, 2);
});

test("concurrent identical submissions and simultaneous final submit resolve exactly once", async () => {
  const { room, alice, bob } = await start();
  const alicePlan = command(room, { type: "submit", operative: "ghost", target: 1, doubleCross: true });
  const bobPlan = command(room, { type: "submit", operative: "ghost", target: 1, doubleCross: false });
  await Promise.all([
    accessRoom(room.code, alice, { command: alicePlan }), accessRoom(room.code, alice, { command: alicePlan }),
    accessRoom(room.code, bob, { command: bobPlan }), accessRoom(room.code, bob, { command: bobPlan }),
  ]);
  const result = (await accessRoom(room.code, alice))!;
  assert.equal(result.phase, "reveal");
  assert.equal(result.history.length, 1);
  assert.deepEqual(result.players.map((player) => player.score), [10000, null]);
  const raw = (await db().query<{ state: Room }>("select state from heist_private.rooms where id=$1", [room.id])).rows[0].state;
  assert.equal(raw.submissions.length, 2);
  assert.equal(raw.players[0].doubleCrossUsed, true);
});

test("competing different plans from one player commit only one", async () => {
  const { room, alice } = await start();
  const requests = await Promise.allSettled([
    accessRoom(room.code, alice, { command: command(room, { type: "submit", operative: "ghost", target: 1, doubleCross: true }) }),
    accessRoom(room.code, alice, { command: command(room, { type: "submit", operative: "oracle", target: 0, doubleCross: false }) }),
  ]);
  assert.equal(requests.filter((request) => request.status === "fulfilled").length, 1);
  assert.equal(requests.filter((request) => request.status === "rejected").length, 1);
  const raw = (await db().query<{ state: Room }>("select state from heist_private.rooms where id=$1", [room.id])).rows[0].state;
  assert.equal(raw.submissions.length, 1);
  assert.equal(raw.players[0].doubleCrossUsed, raw.submissions[0].doubleCross);
});

test("expired transitions persist even when a late command fails", async () => {
  const { room, alice } = await start();
  await db().query("update heist_private.rooms set state=jsonb_set(state,'{deadline}',to_jsonb(floor(extract(epoch from clock_timestamp())*1000-100)::bigint)) where id=$1", [room.id]);
  await assert.rejects(accessRoom(room.code, alice, { command: command(room, { type: "submit", operative: "ghost", target: 1, doubleCross: true }) }), /closed/);
  const result = (await accessRoom(room.code, alice))!;
  assert.equal(result.phase, "reveal");
  assert.equal(result.history.length, 1);
  assert.ok(result.players.every((player) => player.doubleCrossAvailable));
});

test("secret plans never appear in another player's API projection or update signal", async () => {
  const { room, alice, bob } = await start();
  await accessRoom(room.code, alice, { command: command(room, { type: "submit", operative: "ghost", target: 1, doubleCross: true }) });
  const peer = (await accessRoom(room.code, bob))!;
  assert.equal(peer.mySubmission, null);
  assert.equal(peer.players[0].doubleCrossAvailable, true);
  assert.equal(peer.players[0].submitted, true);
  const signal = (await db().query("select * from public.room_updates where room_id=$1", [room.id])).rows[0];
  assert.deepEqual(Object.keys(signal).sort(), ["room_id", "updated_at", "version"]);
});

test("concurrent room joins by one identity produce one player", async () => {
  const { room } = await fixture(); const charlie = randomUUID();
  await Promise.all(Array.from({ length: 4 }, () => accessRoom(room.code, charlie, { nickname: "Charlie" })));
  const view = (await accessRoom(room.code, charlie))!;
  assert.equal(view.players.length, 3);
  assert.equal((await db().query("select count(*)::int as count from heist_private.members where room_id=$1 and user_id=$2", [room.id, charlie])).rows[0].count, 1);
});

test("practice atomically starts with a private computer plan and only human membership", async () => {
  const user = randomUUID();
  const room = await newRoom(user, "Solo", 20, "practice"); roomIds.push(room.id);
  assert.equal(room.phase, "planning");
  assert.equal(room.round, 1);
  assert.equal(room.players[1].isComputer, true);
  assert.equal(room.players[1].score, null);
  assert.equal(room.mySubmission, null);
  const raw = (await db().query<{ state: Room }>("select state from heist_private.rooms where id=$1", [room.id])).rows[0].state;
  assert.equal(raw.submissions.length, 1);
  const botPlan = structuredClone(raw.submissions[0]);
  const members = (await db().query("select user_id from heist_private.members where room_id=$1", [room.id])).rows;
  assert.deepEqual(members, [{ user_id: user }]);
  await assert.rejects(accessRoom(room.code, randomUUID(), { nickname: "Outsider" }), /solo practice/);
  await assert.rejects(accessRoom(room.code, raw.players[1].userId), /Join this room/);
  const reconnect = (await accessRoom(room.code, user))!;
  assert.equal(reconnect.me, room.me);
  await accessRoom(room.code, user, { command: command(room, { type: "submit", target: botPlan.target, doubleCross: false }) });
  const after = (await db().query<{ state: Room }>("select state from heist_private.rooms where id=$1", [room.id])).rows[0].state;
  assert.deepEqual(after.submissions[0], botPlan);
  assert.equal(after.history.length, 1);
  assert.equal(after.phase, "reveal");
});
