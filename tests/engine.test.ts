import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceRoom, applyCommand, createRoom, GameError, joinRoom, roomView } from "../src/lib/game/engine";
import { powerFor, REVEAL_SECONDS, targetsForRound } from "../src/lib/game/catalog";
import type { Command, Room } from "../src/lib/game/types";

const NOW = 1000000;
function lobby() {
  const room = createRoom("room", "ABC234", "alice", "Alice", 20, NOW);
  room.rulesVersion = 1; // Existing games finish using their original rules.
  joinRoom(room, "bob", "Bob");
  return room;
}
function act(room: Room, user: string, command: Command, now = NOW) {
  applyCommand(room, user, { ...command, matchId: room.matchId, expectedRound: room.round }, now);
}
function match() {
  const room = lobby();
  act(room, "bob", { type: "ready", ready: true });
  act(room, "alice", { type: "start" });
  return room;
}
function submit(room: Room, user: string, doubleCross = false, target = 1, operative: "ghost" | "oracle" = "ghost") {
  act(room, user, { type: "submit", operative, target, doubleCross });
}

test("the host needs at least two ready players", () => {
  const room = createRoom("room", "ABC234", "alice", "Alice", 20, NOW);
  assert.throws(() => act(room, "alice", { type: "start" }), /two players/);
  joinRoom(room, "bob", "Bob");
  assert.throws(() => act(room, "alice", { type: "start" }), /every player/);
  assert.throws(() => act(room, "bob", { type: "start" }), /host/);
  act(room, "bob", { type: "ready", ready: true });
  act(room, "alice", { type: "start" });
  assert.equal(room.deadline, NOW + 20000);
  assert.equal(room.round, 1);
});

test("specialties determine power, with Oracle always receiving its bonus", () => {
  const targets = targetsForRound(1);
  assert.equal(powerFor("ghost", targets[1]), 5);
  assert.equal(powerFor("ghost", targets[0]), 2);
  assert.equal(powerFor("oracle", targets[2]), 4);
});

test("successful crews split loot and reveal automatically", () => {
  const room = match();
  submit(room, "alice"); submit(room, "bob");
  assert.equal(room.phase, "reveal");
  assert.deepEqual(room.players.map((player) => player.score), [5000, 5000]);
  assert.equal(room.history.length, 1);
  assert.equal(room.deadline, NOW + REVEAL_SECONDS * 1000);
});

test("a single Double Cross takes the whole payout; the charge is one per match", () => {
  const room = match();
  submit(room, "alice", true); submit(room, "bob");
  assert.deepEqual(room.players.map((player) => player.score), [10000, 0]);
  assert.equal(room.history[0].players[1].outcome, "betrayed");
  advanceRoom(room, room.deadline!);
  assert.throws(() => submit(room, "alice", true, 0, "oracle"), /already used/);
});

test("multiple Double Crosses at one target trigger an alarm", () => {
  const room = match();
  submit(room, "alice", true); submit(room, "bob", true);
  assert.deepEqual(room.players.map((player) => player.score), [0, 0]);
  assert.equal(room.history[0].targets[1].alarm, true);
  assert.ok(room.players.every((player) => player.doubleCrossUsed));
});

test("a failed heist still exhausts the operative and consumes Double Cross", () => {
  const room = match();
  submit(room, "alice", true, 2); submit(room, "bob", false, 0);
  assert.equal(room.players[0].score, 0);
  assert.equal(room.players[0].availableFrom.ghost, 3);
  assert.equal(room.players[0].doubleCrossUsed, true);
  advanceRoom(room, room.deadline!);
  assert.throws(() => submit(room, "alice"), /exhausted/);
  advanceRoom(room, room.deadline! + REVEAL_SECONDS * 1000);
  assert.equal(room.round, 3);
  submit(room, "alice");
  assert.equal(room.submissions.length, 1);
});

test("the projection hides user identities, peer choices, and pending Double Cross", () => {
  const room = match();
  submit(room, "alice", true);
  const bobView = roomView(room, "bob", NOW);
  assert.equal(bobView.mySubmission, null);
  assert.equal(bobView.players[0].doubleCrossAvailable, true);
  assert.equal(bobView.players[0].submitted, true);
  assert.equal(bobView.players[0].score, null);
  assert.deepEqual(bobView.players[0].availableFrom, {});
  assert.ok(!JSON.stringify(bobView).includes('"userId"'));
  assert.ok(!JSON.stringify(bobView).includes('"submissions"'));
  assert.equal(roomView(room, "alice", NOW).mySubmission?.doubleCross, true);
  assert.equal(roomView(room, "alice", NOW).players[0].doubleCrossAvailable, false);
  assert.throws(() => roomView(room, "outsider", NOW), (error: unknown) => error instanceof GameError && error.status === 403);
});

test("peer totals and individual payouts stay hidden until the final reveal", () => {
  const room = match();
  submit(room, "alice", true); submit(room, "bob");
  const alice = roomView(room, "alice", NOW);
  const bob = roomView(room, "bob", NOW);
  assert.deepEqual(alice.players.map((player) => player.score), [10000, null]);
  assert.deepEqual(bob.players.map((player) => player.score), [null, 0]);
  assert.deepEqual(alice.history[0].players.map((player) => player.earned), [10000, null]);
  assert.deepEqual(bob.history[0].players.map((player) => player.earned), [null, 0]);
  advanceRoom(room, NOW + 200000);
  const final = roomView(room, "alice", NOW + 200000);
  assert.equal(final.phase, "finished");
  assert.equal(final.history.length, 4);
  assert.deepEqual(final.players.map((player) => player.score), [10000, 0]);
  assert.deepEqual(final.history[0].players.map((player) => player.earned), [10000, 0]);
});

test("identical submission retries are idempotent; changed retries fail", () => {
  const room = match();
  submit(room, "alice", true); const version = room.version;
  submit(room, "alice", true);
  assert.equal(room.version, version);
  assert.equal(room.submissions.length, 1);
  assert.throws(() => submit(room, "alice", false), /already locked/);
  submit(room, "bob"); const scores = room.players.map((player) => player.score);
  submit(room, "bob");
  assert.deepEqual(room.players.map((player) => player.score), scores);
  assert.equal(room.history.length, 1);
});

test("the exact deadline closes a round and missing submissions become passes", () => {
  const room = match(); const deadline = room.deadline!;
  assert.throws(() => act(room, "alice", { type: "submit", operative: "ghost", target: 1, doubleCross: false }, deadline), /closed/);
  advanceRoom(room, deadline);
  assert.equal(room.phase, "reveal");
  assert.ok(room.history[0].players.every((player) => player.outcome === "passed"));
});

test("disconnected matches catch up using original deadlines, without extending timers", () => {
  const room = match();
  advanceRoom(room, NOW + 200000);
  assert.equal(room.phase, "finished");
  assert.equal(room.history.length, 4);
  assert.equal(room.round, 4);
  assert.equal(room.deadline, null);
});

test("round and match generation reject stale commands", () => {
  const room = match(); const previousMatch = room.matchId;
  advanceRoom(room, NOW + 200000);
  const before = room.players.map((player) => player.score);
  assert.throws(() => applyCommand(room, "alice", { type: "submit", operative: "ghost", target: 0, doubleCross: false, expectedRound: 1, matchId: previousMatch }, NOW + 200000), /moved on/);
  act(room, "alice", { type: "rematch" }, NOW + 200000);
  assert.notEqual(room.matchId, previousMatch);
  assert.equal(room.phase, "lobby");
  assert.deepEqual(before, [0, 0]);
  assert.throws(() => applyCommand(room, "alice", { type: "start", expectedRound: 0, matchId: previousMatch }, NOW + 200000), /moved on/);
});

test("joining respects capacity, case-insensitive nicknames, and existing identity", () => {
  const room = lobby();
  assert.throws(() => joinRoom(room, "charlie", "alice"), /already in/);
  joinRoom(room, "bob", "Replacement");
  assert.equal(room.players[1].nickname, "Bob");
  for (let n = 0; n < 6; n++) joinRoom(room, `user-${n}`, `Guest ${n}`);
  assert.throws(() => joinRoom(room, "overflow", "Overflow"), /full/);
  assert.throws(() => createRoom("id", "ABC234", "user", "<bad>", 20, NOW), /nickname/);
});

test("the host can leave the lobby and hosting transfers", () => {
  const room = lobby();
  act(room, "alice", { type: "leave" });
  assert.equal(room.hostId, room.players[0].id);
  assert.equal(room.players[0].nickname, "Bob");
  assert.equal(room.players[0].ready, true);
});

test("new vaults open for a lone player without a strength calculation", () => {
  const room = createRoom("room", "ABC234", "alice", "Alice", 20, NOW);
  joinRoom(room, "bob", "Bob"); act(room, "bob", { type: "ready", ready: true }); act(room, "alice", { type: "start" });
  act(room, "alice", { type: "submit", target: 2, doubleCross: false });
  act(room, "bob", { type: "submit", target: 0, doubleCross: false });
  assert.equal(room.rulesVersion, 2);
  assert.deepEqual(room.players.map((player) => player.score), [14000, 6000]);
  assert.ok(room.history[0].targets.filter((target) => target.playerIds.length).every((target) => target.success));
});

test("the rebuilt game splits crowded vaults and preserves the two-steal alarm", () => {
  const room = createRoom("room", "ABC234", "alice", "Alice", 20, NOW);
  joinRoom(room, "bob", "Bob"); act(room, "bob", { type: "ready", ready: true }); act(room, "alice", { type: "start" });
  act(room, "alice", { type: "submit", target: 2, doubleCross: false }); act(room, "bob", { type: "submit", target: 2, doubleCross: false });
  assert.deepEqual(room.players.map((player) => player.score), [7000, 7000]);
  advanceRoom(room, room.deadline!);
  act(room, "alice", { type: "submit", target: 0, doubleCross: true }, room.deadline! - 1);
  act(room, "bob", { type: "submit", target: 0, doubleCross: true }, room.deadline! - 1);
  assert.deepEqual(room.players.map((player) => player.score), [7000, 7000]);
  assert.equal(room.history[1].targets[0].alarm, true);
  assert.ok(room.players.every((player) => player.doubleCrossUsed));
});

test("automatic runners rest on the server and omitted-operative retries stay idempotent", () => {
  const room = createRoom("room", "ABC234", "alice", "Alice", 20, NOW, "practice");
  act(room, "alice", { type: "start" });
  act(room, "alice", { type: "submit", target: 0, doubleCross: false });
  const first = room.submissions.find((submission) => submission.playerId === room.hostId)!;
  const scores = room.players.map((player) => player.score);
  act(room, "alice", { type: "submit", target: 0, doubleCross: false });
  assert.deepEqual(room.players.map((player) => player.score), scores);
  advanceRoom(room, room.deadline!);
  assert.throws(() => act(room, "alice", { type: "submit", operative: first.operative, target: 0, doubleCross: false }, room.deadline! - 1), /exhausted/);
  act(room, "alice", { type: "submit", target: 0, doubleCross: false }, room.deadline! - 1);
  assert.notEqual(room.submissions.find((submission) => submission.playerId === room.hostId)!.operative, first.operative);
});

test("computer choices commit before the human, stay secret, and cannot change after submission", () => {
  const room = createRoom("room", "ABC234", "alice", "Alice", 20, NOW, "practice");
  const bot = room.players.find((player) => player.isComputer)!;
  act(room, "alice", { type: "start" });
  const before = structuredClone(room.submissions[0]);
  const view = roomView(room, "alice", NOW);
  assert.equal(view.mode, "practice");
  assert.equal(view.players[1].submitted, true);
  assert.equal(view.mySubmission, null);
  assert.equal(view.players[1].score, null);
  assert.ok(!JSON.stringify(view).includes("computerCrossRound"));
  assert.ok(!JSON.stringify(view).includes(bot.userId));
  const alternate = structuredClone(room);
  act(room, "alice", { type: "submit", target: before.target, doubleCross: false });
  act(alternate, "alice", { type: "submit", target: (before.target + 1) % 3, doubleCross: true });
  assert.deepEqual(room.submissions[0], before);
  assert.deepEqual(alternate.submissions[0], before);
  assert.throws(() => joinRoom(room, "bob", "Bob"), /solo practice/);
  assert.throws(() => roomView(room, bot.userId, NOW), /not a member/);
  joinRoom(room, "alice", "Replacement");
  assert.equal(room.players[0].nickname, "Alice");
});

test("practice plays four rounds with legal runners and exactly one computer Double Cross", () => {
  const room = createRoom("room", "ABC234", "alice", "Alice", 20, NOW, "practice");
  act(room, "alice", { type: "start" });
  for (let round = 1; round <= 4; round++) {
    const bot = room.submissions[0];
    assert.equal(room.round, round);
    assert.equal(room.phase, "planning");
    assert.equal(room.submissions.length, 1);
    act(room, "alice", { type: "submit", target: bot.target, doubleCross: false }, room.deadline! - 1);
    assert.equal(room.phase, "reveal");
    assert.equal(room.history.length, round);
    assert.equal(roomView(room, "alice", NOW).players[1].score, null);
    advanceRoom(room, room.deadline!);
  }
  assert.equal(room.phase, "finished");
  const computer = room.players[1];
  const choices = room.history.map((result) => result.players.find((player) => player.playerId === computer.id)!);
  assert.equal(choices.filter((choice) => choice.doubleCross).length, 1);
  choices.slice(1).forEach((choice, index) => assert.notEqual(choice.operative, choices[index].operative));
  assert.ok(roomView(room, "alice", NOW).players.every((player) => player.score !== null));
  act(room, "alice", { type: "rematch" });
  assert.equal(room.players.length, 2);
  assert.ok(room.players.every((player) => player.ready && !player.doubleCrossUsed && player.score === 0));
  act(room, "alice", { type: "start" });
  assert.equal(room.submissions.length, 1);
});

test("unattended practice catches up without client timers and leaving removes the computer", () => {
  const room = createRoom("room", "ABC234", "alice", "Alice", 20, NOW, "practice");
  act(room, "alice", { type: "start" }); advanceRoom(room, NOW + 200000);
  assert.equal(room.phase, "finished");
  assert.equal(room.history.length, 4);
  assert.ok(room.history.every((result) => result.players[0].outcome === "passed"));
  act(room, "alice", { type: "rematch" }); act(room, "alice", { type: "leave" });
  assert.equal(room.players.length, 0);
});
