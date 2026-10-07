import type { NextRequest } from "next/server";
import { localSession, SESSION_COOKIE } from "@/lib/server/auth";
import { apiError, assertSameOrigin, json } from "@/lib/server/http";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { token } = await localSession(request);
    const response = json({ ok: true });
    if (token) response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 604800 });
    return response;
  } catch (error) { return apiError(error); }
}
