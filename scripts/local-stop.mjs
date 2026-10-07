import { execFileSync } from "node:child_process";
import path from "node:path";
execFileSync("pg_ctl", ["-D", path.join(process.cwd(), ".local/postgres"), "-m", "fast", "-w", "stop"], { stdio: "inherit" });
