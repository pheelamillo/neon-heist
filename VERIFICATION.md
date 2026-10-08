# Verification status

The rebuilt game uses **three interactive 3D vaults, four different stage settings, and private opponent totals**. Every occupied vault opens. Runners are assigned automatically, with exhaustion kept authoritative on the server. Solo practice is available alongside rooms for 2–8 humans.

Public game: **https://neon-heist-eight.vercel.app**. Source: **https://github.com/pheelamillo/neon-heist**. Hosted checks below completed on **October 8, 2026**, using the game implementation in commit `b3fb419`.

Passed:

- **23 rules/origin tests**: legacy rules compatibility, new vault opening and sharing, Double Cross alarms, automatic runner exhaustion, secret and precommitted computer choices, four-round practice and rematch, unattended catch-up, private views, retries, exact deadlines, stale generations, capacity, host transfer, and origin checks.
- **7 Postgres integration tests**: persistence, outsider denial, simultaneous submissions, conflicting submissions, expired transitions on rejected commands, minimal Realtime signals, duplicate joins, and atomic practice creation with human-only membership.
- **1 database policy test**: actual RLS SQL tested in a temporary local database with the Supabase JWT contract; members can read their signals, outsiders cannot, and clients cannot write signals or access canonical room state.
- **3 live HTTP tests**: two independent sessions complete four rounds using real eight-second reveal deadlines, hidden totals reveal at the finale, reconnect and rematch work, malicious origins fail, and solo practice starts with a legal vault-only move.
- **6 isolated Chrome tests**: two browsers complete multiplayer through the actual UI (one phone viewport), raycast selection works on the 3D vault, secret choices and loot stay private, reconnect/rematch work, all four settings follow the authoritative round in both browsers and solo practice, the four-stage homepage preview supports keyboard navigation, the demo visibly transfers loot and replays sharing/stealing payouts without changing rooms, the mobile pages fit without horizontal overflow, solo practice completes four rounds and replays, non-WebGL devices can play, and forged actions are rejected. The demo’s completed payouts and empty vault were also checked with reduced motion and without WebGL. A focused repeat also verified the homepage door toggle and pause/resume controls under reduced motion. Desktop/mobile screenshots were visually inspected.
- TypeScript checking and an optimized Next.js production build.
- **Real hosted Supabase Auth and Realtime**: the smoke test passed against both the local Next.js server using the new cloud database and the public Vercel URL. Three anonymous identities established member/outsider isolation and forbidden direct writes. Both member subscriptions received an actual Postgres Changes update containing only the room ID, version, and timestamp. Hidden pending choices and server-authoritative Double Cross scoring passed.
- **All 6 Chrome tests repeated on the public Vercel URL**: complete multiplayer with a desktop and phone viewport, both live Realtime listeners, four stage transitions, private views, reconnect/rematch, demo payouts, keyboard stage previews, reduced motion, full solo practice, WebGL fallback, and unauthorized/forged request rejection. All passed in 2.2 minutes. Hosted desktop/mobile screenshots were visually inspected.
- **Public access and deployment**: homepage and rules return HTTP 200 without a Vercel login; Vercel's Next.js production build and TypeScript checks passed on Node 22. Supabase TLS uses certificate verification with the official Supabase CA. Source was published to the public GitHub repository and connected to Vercel.

Outstanding:

- **Two physical devices.** Separate hosted browser contexts and a simulated phone viewport passed, but a physical phone/computer playtest has not been observed.

This remaining manual check is distinct from the completed hosted multiplayer and deployment verification.
