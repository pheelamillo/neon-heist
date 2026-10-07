# Verification status

The rebuilt game uses **three interactive 3D vaults, four rounds, and private opponent totals**. Every occupied vault opens. Runners are assigned automatically, with exhaustion kept authoritative on the server. Solo practice is available alongside rooms for 2–8 humans.

Passed:

- **23 rules/origin tests**: legacy rules compatibility, new vault opening and sharing, Double Cross alarms, automatic runner exhaustion, secret and precommitted computer choices, four-round practice and rematch, unattended catch-up, private views, retries, exact deadlines, stale generations, capacity, host transfer, and origin checks.
- **7 Postgres integration tests**: persistence, outsider denial, simultaneous submissions, conflicting submissions, expired transitions on rejected commands, minimal Realtime signals, duplicate joins, and atomic practice creation with human-only membership.
- **1 database policy test**: actual RLS SQL tested in a temporary local database with the Supabase JWT contract; members can read their signals, outsiders cannot, and clients cannot write signals or access canonical room state.
- **3 live HTTP tests**: two independent sessions complete four rounds using real eight-second reveal deadlines, hidden totals reveal at the finale, reconnect and rematch work, malicious origins fail, and solo practice starts with a legal vault-only move.
- **5 isolated Chrome tests**: two browsers complete multiplayer through the actual UI (one phone viewport), raycast selection works on the 3D vault, secret choices and loot stay private, reconnect/rematch work, the demo teaches sharing/stealing, the mobile pages fit without horizontal overflow, solo practice completes four rounds and replays, non-WebGL devices can play, and forged actions are rejected. A focused repeat also verified the homepage door toggle and pause/resume controls under reduced motion. Desktop/mobile screenshots were visually inspected.
- TypeScript checking and an optimized Next.js production build.

Outstanding:

- **Real Supabase Auth and Realtime.** The hosted smoke script is provided but has not been run against a configured Supabase project. Native Postgres mode uses authenticated polling. Local SQL policy tests do not establish hosted Realtime connectivity.
- **Two physical devices.** The server is available on the LAN, but a physical phone/computer playtest has not been observed.
- **Public URL.** GitHub/Vercel instructions are prepared; no remote repository has been selected or pushed, and no public deployment has been created.

These remaining checks are recorded in DEPLOYMENT.md and should complete before production publication.
