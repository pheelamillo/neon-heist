import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

if (process.env.VERCEL && (process.env.NEON_AUTH_MODE !== "supabase" || process.env.NEXT_PUBLIC_NEON_AUTH_MODE !== "supabase")) {
  throw new Error("Vercel requires NEON_AUTH_MODE=supabase and NEXT_PUBLIC_NEON_AUTH_MODE=supabase.");
}
if (process.env.NEON_AUTH_MODE && process.env.NEXT_PUBLIC_NEON_AUTH_MODE && process.env.NEON_AUTH_MODE !== process.env.NEXT_PUBLIC_NEON_AUTH_MODE) {
  throw new Error("Server and browser authentication modes must agree.");
}

const config: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["localhost", "127.0.0.1", ...Object.values(networkInterfaces()).flatMap((items) =>
    (items ?? []).filter((item) => item.family === "IPv4" && !item.internal).map((item) => item.address))],
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default config;
