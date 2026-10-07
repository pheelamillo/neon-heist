# Neon Heist

A standalone vault game: **pick a vault, grab the loot, watch the getaway**. Play against the computer or invite 2–8 people on separate devices. Built with **Next.js App Router, TypeScript, Three.js, Supabase Postgres, and Supabase Realtime**. Deployable to Vercel or any Node.js host. Players use a normal browser URL and a nickname. **No ChatGPT, OpenAI account, model API, or AI service is involved at runtime.**

## Run locally

Requirements: Node.js 22 or newer and PostgreSQL 16+ with `initdb`, `pg_ctl`, and `createdb` on your PATH. On macOS these are included in the Homebrew `postgresql@16` package.

```sh
npm ci
npm run local:setup
npm run dev
```

Open **http://localhost:3000**. The setup command creates an isolated database under `.local/postgres`, binds it to **127.0.0.1:55432**, applies migrations, and writes `.env.local`. It does not use or reset your other Postgres databases. Re-running it preserves existing game state.

For a second phone/computer on the same Wi-Fi, visit `http://<this-computer's-LAN-IP>:3000`. The web server listens on all interfaces; Postgres stays on loopback. On macOS, `ipconfig getifaddr en0` usually shows the LAN address. Share the LAN invite URL or the six-character room code, and allow incoming connections if your firewall asks. `localhost` on a phone refers to the phone, so use the host computer's LAN address.

Native local development uses random, hashed, HttpOnly-cookie sessions and authenticated polling. This makes the local game usable without Docker or cloud credentials. **Supabase Auth and Supabase Realtime are the production path**, and can also be exercised locally with a hosted Supabase development project. Vercel builds reject local auth. Local auth also refuses a non-loopback database.

To stop the local database: `npm run local:stop`. Stop the web server with Ctrl+C.

## Play

1. Watch the 14-second demo, or press **Play vs computer** to start solo practice immediately.
2. For multiplayer, select **With friends**, enter a name, and create a room. Share its URL or code. Guests mark ready; the host starts.
3. Tap one of the three 3D vaults, or use its labelled button. Press **Grab loot**. Every occupied vault opens: alone, take it all; together, split the loot.
4. Optionally turn on **Steal instead**, your one Double Cross. A single steal takes the vault's whole payout. Two or more steals at the same vault trigger an alarm and pay nobody there.
5. Watch the doors open, see the getaway and your payout, then play the next round. Most loot after four rounds wins; ties share the win.

The complete rules and an interactive demo are built into `/rules`. Character selection and strength requirements have been removed from the new play loop. The server automatically sends an available runner, rests used runners for the following round, and makes them available one round later. Runners do not change loot. The normal payout is the vault's loot divided into whole credits; any remainder stays in the vault. A locked choice cannot change; a missed timer is a pass. Rounds use 20-, 45-, or 60-second server deadlines, followed by an eight-second results screen.

Solo practice uses the same authoritative engine and rules. Byte commits its secret choice at the beginning of each round, before the human can submit. It uses random choices and previously revealed moves, never pending human choices. Its one Double Cross is scheduled for one of rounds 2–4. The computer does not have an auth account or a database membership and cannot receive a client session. Practice rooms admit only their creator. Multiplayer rooms still require at least two real players.

The vaults are original procedural 3D models: thick steel shells, circular doors on hinges, moving wheel handles, bolt rings, gold coin stacks, and animated coins. Drag to turn the view and tap a vault to choose it. Pause controls and reduced-motion preferences are respected. Devices without WebGL can still play through the same accessible vault buttons, with a CSS preview. These animations display server results; they never authorize moves or determine payouts. Three.js is loaded on the client and its MIT notice is included in `docs/THIRD_PARTY.md`.

Rooms created before the rebuild retain their original strength rules in stored state. The new UI links those rooms back to the homepage to start fresh; no existing data is reset. Rematches upgrade the rules version to the new vault game.

Your own wallet is visible to you during play. The server redacts everyone else's totals and individual round payouts until the final reveal after round four. Crew lists stay in join order during play to avoid exposing score rankings. Vault outcomes and revealed choices are visible.

## Architecture

```text
Player browser
  ├─ Supabase anonymous Auth → verified identity / access token
  ├─ Next.js API → transaction + row lock → private Postgres room state
  └─ Supabase Realtime ← RLS-protected room_updates version signal
                           ↓
                    authenticated API refresh
```

`src/lib/game/engine.ts` contains the authoritative rules. `src/lib/server/store.ts` locks the room with `SELECT ... FOR UPDATE`, reads the **database clock**, advances expired deadlines, validates a command, and commits the new canonical state and its Realtime signal together. Scoring, phase changes, readiness, timers, submissions, exhaustion, and Double Cross charges are never accepted as values from the browser.

The room document, membership mappings, local sessions, and request limits live in **`heist_private`**, outside the exposed API schema. Browsers receive a projected room view without authentication IDs or other players' secret choices. The only Realtime table is `public.room_updates`, containing a room ID, version, and timestamp. Membership RLS permits reads; client writes are denied. All mutations go through the verified Next.js API.

Repeated identical submissions are idempotent. A competing different submission is rejected. Commands include the match generation and expected round so delayed packets cannot act in another round or rematch. Score resolution happens once inside the room lock. Deadline advancement commits even if a late command fails.

Timers are persisted deadlines, not browser intervals or in-process timeout jobs. Active clients refresh at the deadline, and any read/action catches up the room to the database clock. If everyone disconnects, no background process is required: the next authenticated access catches up through all elapsed rounds without extending them. Realtime delivers changes made in transactions; a periodic authenticated refresh also recovers missed events and drives deadline materialization. This is compatible with Vercel's serverless lifecycle.

Clearing browser storage or switching browsers creates another anonymous identity. Reconnect in the same browser to retain your seat. Nicknames are labels, not identity credentials. In-game seats stay until the match ends; players can leave in the lobby. If the host leaves the lobby, hosting transfers to the next player.

## Verify

```sh
npm run typecheck
npm test
npm run test:integration
npm run test:security
npm run test:http
npm run test:e2e
npm run build
```

Database and security tests intentionally refuse remote databases. The security test creates and removes its own temporary database on the isolated local cluster, emulating the Supabase JWT `auth.uid()` contract to exercise the actual RLS migration. HTTP tests use independent sessions and a four-round match with real persisted deadlines. Browser tests use isolated Chrome contexts, including a phone viewport, and cover multiplayer, solo practice, raycast selection, the demo, hidden loot, reconnect, rematch, reduced motion, WebGL fallback, invalid rooms, and forged actions. Install Chrome or use your preferred Playwright browser channel in `playwright.config.ts`.

Hosted Supabase Realtime is a separate verification step; passing native local tests does **not** prove a live Realtime connection. Configure a development Supabase project as described in [DEPLOYMENT.md](DEPLOYMENT.md), restart the Next.js server, then run:

```sh
npm run test:supabase
```

The smoke test signs in three anonymous users, verifies member/outsider RLS and forbidden client writes, receives updates in two Realtime subscribers, then checks hidden choices and a Double Cross payout. It creates a small test match in the development project. Set `NEON_TEST_URL` to test a Vercel preview instead. Use a development project for this test.

## Repository layout

- `src/app/`: pages, styling, and authenticated API routes.
- `src/components/`: landing page, lobby, heist controls, results, and field guide.
- `src/lib/game/`: types, operative/target catalog, and server rules.
- `src/lib/server/`: database pool, identity verification, request validation, persistence.
- `src/lib/client/`: anonymous sign-in, API calls, Realtime subscription, reconnect/polling.
- `supabase/migrations/`: canonical database schema and production RLS/Realtime setup.
- `scripts/`: local setup, migration runner, hosted smoke test.
- `tests/`: rules, concurrency, database security, and browser multiplayer tests.

`node_modules`, `.next`, `.local`, environment secrets, and test artifacts are ignored by Git. There is no dependency on a hosted app builder or a ChatGPT-specific runtime.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the GitHub → Supabase → Vercel process and the remaining hosted verification gate. Dependency versions are reproducibly recorded in `package-lock.json`; use `npm ci`.

Implementation references: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres), and [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).

The game includes original cinematic cyberpunk character art served from `public/art`. See [the artwork notes](docs/ART.md) and [exact generation prompts](docs/art-prompts.json). The generation tool is used only during development. See [VERIFICATION.md](VERIFICATION.md) for tested behavior and outstanding validation.
