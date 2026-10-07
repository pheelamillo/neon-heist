import { z } from "zod";
import type { NextRequest } from "next/server";
import { getIdentity } from "@/lib/server/auth";
import { GameError } from "@/lib/game/engine";
import { enforceLimit } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";
import { newRoom } from "@/lib/server/store";

export const runtime = "nodejs";
const schema = z.object({ nickname: z.string().min(2).max(40), roundSeconds: z.union([z.literal(20), z.literal(45), z.literal(60)]), mode: z.enum(["multiplayer", "practice"]).default("multiplayer") }).strict();
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request, schema);
    const userId = await getIdentity(request);
    if (!await enforceLimit(`create:${userId}`, 12, 3600)) throw new GameError("You have created a lot of rooms. Try again later.", 429);
    return json(await newRoom(userId, body.nickname, body.roundSeconds, body.mode), 201);
  } catch (error) { return apiError(error); }
}
