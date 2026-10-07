import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { GameError } from "@/lib/game/engine";

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  // Next.js can construct request.url with the listening host (0.0.0.0), while
  // the browser correctly uses localhost or a LAN IP. Host is the actual HTTP
  // destination and cannot be set by cross-site browser JavaScript.
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const forwardedProtocol = process.env.VERCEL ? request.headers.get("x-forwarded-proto")?.split(",")[0].trim() : null;
  const protocol = forwardedProtocol === "https" ? "https:" : forwardedProtocol === "http" ? "http:" : request.nextUrl.protocol;
  let matches = !origin;
  if (origin) {
    try {
      const parsed = new URL(origin);
      matches = ["http:", "https:"].includes(parsed.protocol) && parsed.origin === `${protocol}//${host}`;
    } catch { matches = false; }
  }
  if (!matches) throw new GameError("Cross-site requests are not allowed.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new GameError("Cross-site requests are not allowed.", 403);
}

export async function readBody<T>(request: NextRequest, schema: z.ZodType<T>): Promise<T> {
  assertSameOrigin(request);
  const raw = await request.text();
  if (raw.length > 4096) throw new GameError("This request is too large.", 413);
  try { return schema.parse(JSON.parse(raw)); }
  catch { throw new GameError("Check the details and try again.", 400); }
}

export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store, private" } });
}

export function apiError(error: unknown) {
  if (error instanceof GameError) return json({ error: error.message }, error.status);
  console.error("Neon Heist request failed", error instanceof Error ? error.name : "Unknown error");
  return json({ error: "The room service is unavailable. Try reconnecting in a moment." }, 503);
}

export function parseCode(value: string) {
  const code = value.toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(code)) throw new GameError("Enter a six-character room code.", 400);
  return code;
}

const generation = { matchId: z.uuid(), expectedRound: z.number().int().min(0).max(4) };
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ ...generation, type: z.literal("ready"), ready: z.boolean() }).strict(),
  z.object({ ...generation, type: z.literal("start") }).strict(),
  z.object({ ...generation, type: z.literal("submit"), operative: z.enum(["ghost", "brute", "wraith", "switch", "rook", "oracle"]).optional(), target: z.number().int().min(0).max(2), doubleCross: z.boolean() }).strict(),
  z.object({ ...generation, type: z.literal("rematch") }).strict(),
  z.object({ ...generation, type: z.literal("leave") }).strict(),
]);
