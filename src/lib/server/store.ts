import { randomInt, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { advanceRoom, applyCommand, createRoom, GameError, joinRoom, roomView } from "@/lib/game/engine";
import type { CommandRequest, Room, RoomMode } from "@/lib/game/types";
import { db } from "./db";

async function clock(client: PoolClient) {
  const result = await client.query<{ now: number }>("select floor(extract(epoch from clock_timestamp()) * 1000)::float8 as now");
  return result.rows[0].now;
}

async function persist(client: PoolClient, room: Room) {
  if (!room.players.length) {
    await client.query("delete from heist_private.rooms where id=$1", [room.id]);
    return;
  }
  await client.query("update heist_private.rooms set state=$2::jsonb, updated_at=clock_timestamp() where id=$1", [room.id, JSON.stringify(room)]);
  const humans = room.players.filter((player) => !player.isComputer);
  await client.query("delete from heist_private.members where room_id=$1 and not(user_id=any($2::uuid[]))", [room.id, humans.map((player) => player.userId)]);
  for (const player of humans) {
    await client.query("insert into heist_private.members(room_id,user_id) values($1,$2) on conflict do nothing", [room.id, player.userId]);
  }
  await client.query(`insert into public.room_updates(room_id,version) values($1,$2)
    on conflict (room_id) do update set version=$2, updated_at=clock_timestamp()`, [room.id, room.version]);
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function roomCode() { return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(""); }

export async function newRoom(userId: string, nickname: string, roundSeconds: number, mode: RoomMode = "multiplayer") {
  for (let attempt = 0; attempt < 5; attempt++) {
    const client = await db().connect();
    try {
      await client.query("begin");
      const now = await clock(client);
      const room = createRoom(randomUUID(), roomCode(), userId, nickname, roundSeconds, now, mode);
      if (mode === "practice") applyCommand(room, userId, { type: "start", matchId: room.matchId, expectedRound: 0 }, now);
      await client.query("insert into heist_private.rooms(id,code,state) values($1,$2,$3::jsonb)", [room.id, room.code, JSON.stringify(room)]);
      await persist(client, room);
      await client.query("commit");
      return roomView(room, userId, now);
    } catch (error) {
      await client.query("rollback");
      if ((error as { code?: string }).code !== "23505" || attempt === 4) throw error;
    } finally { client.release(); }
  }
  throw new Error("Room creation failed.");
}

export async function accessRoom(code: string, userId: string, operation?: { nickname: string } | { command: CommandRequest }) {
  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query("set local lock_timeout = '5s'");
    const result = await client.query<{ state: Room }>("select state from heist_private.rooms where code=$1 for update", [code]);
    if (!result.rows[0]) throw new GameError("Room not found. Check the six-character code.", 404);
    const room = result.rows[0].state;
    if (!operation || !("nickname" in operation)) {
      if (!room.players.some((player) => player.userId === userId && !player.isComputer)) throw new GameError("Join this room to continue.", 403);
    }
    const now = await clock(client);
    const previousVersion = room.version;
    advanceRoom(room, now);
    let actionError: GameError | null = null;
    try {
      if (operation && "nickname" in operation) joinRoom(room, userId, operation.nickname);
      if (operation && "command" in operation) applyCommand(room, userId, operation.command, now);
    } catch (error) {
      if (!(error instanceof GameError)) throw error;
      actionError = error;
    }
    if (room.version !== previousVersion) await persist(client, room);
    const left = operation && "command" in operation && operation.command.type === "leave" && !actionError;
    const view = left || actionError ? null : roomView(room, userId, now);
    // Deadline transitions must commit even when a stale/late command is rejected.
    await client.query("commit");
    if (actionError) throw actionError;
    return view;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
}
