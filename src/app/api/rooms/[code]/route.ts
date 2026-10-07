import { z } from "zod";
import type { NextRequest } from "next/server";
import { getIdentity } from "@/lib/server/auth";
import { GameError } from "@/lib/game/engine";
import { enforceLimit } from "@/lib/server/db";
import { apiError, commandSchema, json, parseCode, readBody } from "@/lib/server/http";
import { accessRoom } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ code: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const code = parseCode((await context.params).code);
    return json(await accessRoom(code, await getIdentity(request)));
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const code = parseCode((await context.params).code);
    const body = await readBody(request, z.object({ nickname: z.string().min(2).max(40) }).strict());
    const userId = await getIdentity(request);
    if (!await enforceLimit(`join:${userId}`, 30, 60)) throw new GameError("Too many join attempts. Try again in a minute.", 429);
    return json(await accessRoom(code, userId, body));
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const code = parseCode((await context.params).code);
    const command = await readBody(request, commandSchema);
    const userId = await getIdentity(request);
    if (!await enforceLimit(`action:${userId}`, 60, 60)) throw new GameError("Too many actions. Wait a moment before retrying.", 429);
    return json(await accessRoom(code, userId, { command }));
  } catch (error) { return apiError(error); }
}
