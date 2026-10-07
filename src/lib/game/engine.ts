import { randomInt, randomUUID } from "node:crypto";
import { MAX_PLAYERS, OPERATIVES, powerFor, REVEAL_SECONDS, ROUND_OPTIONS, targetsForRound, TOTAL_ROUNDS, vaultsForRound } from "./catalog";
import type { CommandRequest, Player, PlayerResult, Room, RoomMode, RoomView, Submission } from "./types";

export class GameError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

export function createRoom(id: string, code: string, userId: string, nickname: string, roundSeconds: number, now: number, mode: RoomMode = "multiplayer"): Room {
  if (!(ROUND_OPTIONS as readonly number[]).includes(roundSeconds)) throw new GameError("Choose a supported round length.", 400);
  const host = newPlayer(userId, nickname);
  host.ready = true;
  const room: Room = { rulesVersion: 2, mode, id, code, matchId: randomUUID(), hostId: host.id, phase: "lobby", round: 0, roundSeconds, deadline: null,
    players: [host], submissions: [], history: [], createdAt: now, version: 1 };
  if (mode === "practice") {
    const computer = newPlayer(randomUUID(), host.nickname.toLowerCase() === "byte" ? "Byte PC" : "Byte");
    Object.assign(computer, { isComputer: true, ready: true, computerCrossRound: randomInt(2, 5) });
    room.players.push(computer);
  }
  return room;
}

function newPlayer(userId: string, nickname: string): Player {
  return { id: randomUUID(), userId, nickname: normalizeNickname(nickname), score: 0, ready: false, doubleCrossUsed: false, availableFrom: {} };
}

export function normalizeNickname(nickname: string) {
  const normalized = nickname.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 18 || /[\p{C}<>]/u.test(normalized)) {
    throw new GameError("Use a nickname of 2–18 characters without control characters or angle brackets.", 400);
  }
  return normalized;
}

export function joinRoom(room: Room, userId: string, nickname: string) {
  if (room.players.some((player) => player.userId === userId && !player.isComputer)) return;
  if (room.mode === "practice") throw new GameError("This is a solo practice room. Create a friends room to play together.", 403);
  if (room.phase !== "lobby") throw new GameError("This heist has started. Ask the host for a rematch after it finishes.");
  if (room.players.length >= MAX_PLAYERS) throw new GameError("This room is full. The maximum is 8 players.");
  const player = newPlayer(userId, nickname);
  if (room.players.some((other) => other.nickname.toLocaleLowerCase() === player.nickname.toLocaleLowerCase())) {
    throw new GameError("That nickname is already in this room. Choose another.");
  }
  room.players.push(player);
  room.version++;
}

function roomTargets(room: Room) { return room.rulesVersion === 2 ? vaultsForRound(room.round) : targetsForRound(room.round); }

function automaticOperative(room: Room, player: Player) {
  const offset = room.round - 1 + room.players.indexOf(player);
  for (let index = 0; index < OPERATIVES.length; index++) {
    const operative = OPERATIVES[(offset + index) % OPERATIVES.length];
    if ((player.availableFrom[operative.id] ?? 0) <= room.round) return operative.id;
  }
  throw new GameError("No runner is available for this round.");
}

// Commit the computer's secret move before the human gets a planning screen.
// It reads only revealed history, never current human submissions or scores.
function queueComputer(room: Room, now: number) {
  for (const player of room.players.filter((entry) => entry.isComputer)) {
    if (room.submissions.some((entry) => entry.playerId === player.id)) continue;
    const lastHumanMove = room.history.at(-1)?.players.find((entry) => !room.players.find((p) => p.id === entry.playerId)?.isComputer)?.target;
    const candidates = [0, 1, 1, 2, 2];
    const target = lastHumanMove != null && randomInt(2) === 0 ? lastHumanMove : candidates[randomInt(candidates.length)];
    applyCommand(room, player.userId, { type: "submit", target, doubleCross: !player.doubleCrossUsed && room.round === player.computerCrossRound,
      matchId: room.matchId, expectedRound: room.round }, now);
  }
}

function resolveRound(room: Room, resolvedAt: number) {
  const targets = roomTargets(room);
  const players: PlayerResult[] = room.players.map((player) => ({
    playerId: player.id, operative: null, target: null, doubleCross: false, power: 0, earned: 0, outcome: "passed",
  }));
  const results = targets.map((target) => {
    const crew = room.submissions.filter((submission) => submission.target === target.id);
    const power = room.rulesVersion === 2 ? crew.length : crew.reduce((sum, submission) => sum + powerFor(submission.operative, target), 0);
    const crosses = crew.filter((submission) => submission.doubleCross);
    const success = crew.length > 0 && power >= target.difficulty;
    const alarm = crosses.length > 1;
    const betrayer = crosses.length === 1 ? crosses[0].playerId : null;
    // Whole credits only. Undivided remainder stays in the vault.
    const share = success && !alarm ? Math.floor(target.loot / crew.length) : 0;
    for (const submission of crew) {
      const player = room.players.find((entry) => entry.id === submission.playerId)!;
      const earned = !success || alarm ? 0 : betrayer ? (betrayer === player.id ? target.loot : 0) : share;
      player.score += earned;
      player.availableFrom[submission.operative] = room.round + 2;
      const result = players.find((entry) => entry.playerId === player.id)!;
      Object.assign(result, { operative: submission.operative, target: target.id, doubleCross: submission.doubleCross,
        power: room.rulesVersion === 2 ? 1 : powerFor(submission.operative, target), earned,
        outcome: alarm ? "alarm" : !success ? "failed" : betrayer && betrayer !== player.id ? "betrayed" : "paid" });
    }
    return { target, power, success, alarm, playerIds: crew.map((entry) => entry.playerId), betrayer };
  });
  room.history.push({ round: room.round, targets: results, players });
  room.phase = "reveal";
  room.deadline = resolvedAt + REVEAL_SECONDS * 1000;
  room.version++;
}

// Persisted deadlines are the authority. Delayed reads never grant extra time.
// A reconnect can catch up through an entire unattended match.
export function advanceRoom(room: Room, now: number) {
  for (let transitions = 0; transitions < TOTAL_ROUNDS * 2 + 1; transitions++) {
    if (room.deadline === null || now < room.deadline || room.phase === "finished" || room.phase === "lobby") break;
    const boundary = room.deadline;
    if (room.phase === "planning") {
      resolveRound(room, boundary);
    } else if (room.round >= TOTAL_ROUNDS) {
      room.phase = "finished";
      room.deadline = null;
      room.version++;
    } else {
      room.round++;
      room.phase = "planning";
      room.submissions = [];
      room.deadline = boundary + room.roundSeconds * 1000;
      room.version++;
      queueComputer(room, boundary);
    }
  }
}

function sameSubmission(a: Submission, b: Extract<CommandRequest, { type: "submit" }>) {
  return (b.operative === undefined || a.operative === b.operative) && a.target === b.target && a.doubleCross === b.doubleCross;
}

export function applyCommand(room: Room, userId: string, command: CommandRequest, now: number) {
  const player = room.players.find((entry) => entry.userId === userId);
  if (!player) throw new GameError("Join this room before taking an action.", 403);
  if (command.matchId !== room.matchId || command.expectedRound !== room.round) {
    throw new GameError("The heist has moved on. Your room will refresh; try again.");
  }

  if (command.type === "submit") {
    const existing = room.submissions.find((entry) => entry.playerId === player.id);
    // Safe retries, even if the last submission already caused the reveal.
    if (existing && sameSubmission(existing, command)) return;
    if (existing) throw new GameError("Your plan is already locked for this round.");
    if (room.phase !== "planning" || room.deadline === null || now >= room.deadline) throw new GameError("This round is closed.");
    const operative = command.operative ?? (room.rulesVersion === 2 ? automaticOperative(room, player) : null);
    if (!operative || !OPERATIVES.some((entry) => entry.id === operative) || ![0, 1, 2].includes(command.target)) {
      throw new GameError("Choose a valid operative and target.", 400);
    }
    if ((player.availableFrom[operative] ?? 0) > room.round) throw new GameError("That operative is exhausted. Choose another.");
    if (command.doubleCross && player.doubleCrossUsed) throw new GameError("You have already used your Double Cross.");
    room.submissions.push({ playerId: player.id, operative, target: command.target,
      doubleCross: command.doubleCross, submittedAt: now });
    if (command.doubleCross) player.doubleCrossUsed = true;
    room.version++;
    if (room.submissions.length === room.players.length) resolveRound(room, now);
    return;
  }

  if (command.type === "ready") {
    if (room.phase !== "lobby") throw new GameError("Readiness can only change in the lobby.");
    if (player.ready !== command.ready) { player.ready = command.ready; room.version++; }
    return;
  }
  if (command.type === "leave") {
    if (room.phase !== "lobby") throw new GameError("Your seat stays in the match until it ends. Missed rounds count as a pass.");
    room.players = room.mode === "practice" ? [] : room.players.filter((entry) => entry.id !== player.id);
    if (room.hostId === player.id && room.players.length) {
      room.hostId = room.players[0].id;
      room.players[0].ready = true;
    }
    room.version++;
    return;
  }

  if (room.hostId !== player.id) throw new GameError("Only the host can do that.", 403);
  if (command.type === "start") {
    if (room.phase !== "lobby") throw new GameError("The match has already started.");
    if (room.players.length < 2) throw new GameError("You need at least two players.");
    if (!room.players.every((entry) => entry.ready)) throw new GameError("Wait until every player is ready.");
    room.phase = "planning";
    room.round = 1;
    room.deadline = now + room.roundSeconds * 1000;
    room.version++;
    queueComputer(room, now);
    return;
  }
  if (command.type === "rematch") {
    if (room.phase !== "finished") throw new GameError("Finish this match before starting a rematch.");
    room.matchId = randomUUID();
    room.rulesVersion = 2;
    room.phase = "lobby";
    room.round = 0;
    room.deadline = null;
    room.history = [];
    room.submissions = [];
    for (const entry of room.players) {
      entry.score = 0;
      entry.doubleCrossUsed = false;
      entry.availableFrom = {};
      entry.ready = entry.id === room.hostId || !!entry.isComputer;
      if (entry.isComputer) entry.computerCrossRound = randomInt(2, 5);
    }
    room.version++;
  }
}

export function roomView(room: Room, userId: string, now: number): RoomView {
  const me = room.players.find((player) => player.userId === userId && !player.isComputer);
  if (!me) throw new GameError("You are not a member of this room.", 403);
  const visibleCrosses = new Set(room.history.flatMap((result) => result.players.filter((player) => player.doubleCross).map((player) => player.playerId)));
  return {
    rulesVersion: room.rulesVersion ?? 1, mode: room.mode ?? "multiplayer",
    id: room.id, code: room.code, matchId: room.matchId, hostId: room.hostId, phase: room.phase, round: room.round,
    roundSeconds: room.roundSeconds, deadline: room.deadline, version: room.version, serverNow: now, me: me.id,
      players: room.players.map((player) => ({ id: player.id, nickname: player.nickname, isComputer: !!player.isComputer,
      score: room.phase === "finished" || player.id === me.id ? player.score : null, ready: player.ready,
      submitted: room.submissions.some((submission) => submission.playerId === player.id),
      doubleCrossAvailable: player.id === me.id ? !player.doubleCrossUsed : !visibleCrosses.has(player.id),
      availableFrom: { ...player.availableFrom } })),
    targets: room.round > 0 ? roomTargets(room) : [],
    history: room.history.map((result) => ({ ...structuredClone(result), players: result.players.map((player) => ({
      ...player, earned: room.phase === "finished" || player.playerId === me.id ? player.earned : null,
    })) })),
    mySubmission: structuredClone(room.submissions.find((submission) => submission.playerId === me.id) ?? null),
  };
}
