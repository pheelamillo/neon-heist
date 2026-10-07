import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { migrate } from "./migrate.mjs";

const root = process.cwd();
const local = path.join(root, ".local");
const data = path.join(local, "postgres");
const envFile = path.join(root, ".env.local");
if (existsSync(envFile) && !readFileSync(envFile, "utf8").includes("NEON_AUTH_MODE=local")) {
  throw new Error("An existing non-local .env.local is present. Preserve it before using local:setup.");
}
mkdirSync(local, { recursive: true });
const run = (bin, args, capture = false) => execFileSync(bin, args, { stdio: capture ? "pipe" : "inherit" });
if (!existsSync(path.join(data, "PG_VERSION"))) {
  run("initdb", ["-D", data, "--auth=trust", "--username=neon_heist", "--no-locale", "-E", "UTF8"]);
}
try { run("pg_ctl", ["-D", data, "status"], true); }
catch {
  run("pg_ctl", ["-D", data, "-l", path.join(local, "postgres.log"), "-o", `-p 55432 -h 127.0.0.1 -k '${local}'`, "-w", "start"]);
}
const connectionString = "postgresql://neon_heist@127.0.0.1:55432/neon_heist";
try { run("createdb", ["-h", "127.0.0.1", "-p", "55432", "-U", "neon_heist", "neon_heist"], true); }
catch (error) { if (!String(error.stderr ?? "").includes("already exists")) throw error; }
if (!existsSync(envFile)) {
  writeFileSync(envFile, `NEON_AUTH_MODE=local\nNEXT_PUBLIC_NEON_AUTH_MODE=local\nDATABASE_URL=${connectionString}\nDATABASE_SSL=false\n`);
}
await migrate(connectionString);
console.log("\nLocal database is ready. Run npm run dev, then visit http://localhost:3000.");
console.log("For a second device, use this computer's LAN IP on port 3000.");
