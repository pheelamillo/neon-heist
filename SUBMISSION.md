# Neon Heist

Live game: pending hosted deployment and multiplayer verification.

Source repository: https://github.com/pheelamillo/neon-heist

## Project description

Neon Heist is a standalone multiplayer cyberpunk vault game for 2–8 players on separate devices, with a solo mode against the computer. Players enter a nickname, create or join a room using its code, and secretly choose one of three interactive 3D vaults. Alone at a vault, take all its loot; together, share it. Each player has one optional Double Cross to steal the whole payout. Two steals at the same vault trigger an alarm and pay nobody there.

The four rounds take players through a neon Street Bank, a moving Armored Train, a glass Sky Bank, and the golden Crown Vault. Most loot after round four wins; equal totals share the win. Players can watch a short interactive demo and read the complete rules in the app.

Built with Next.js, TypeScript, Three.js, Supabase Postgres and Realtime, and Vercel. The server controls scores, submissions, deadlines, round transitions, runner exhaustion, and Double Cross usage. ChatGPT assisted development; no ChatGPT, model API, or AI service is involved when people play.

## How reviewers can play

1. Open the live game on two separate devices or browsers.
2. On one device, choose **With friends**, enter a nickname, and create a room.
3. Share the room URL or six-character code. The second player joins and taps **I’m ready**; the host taps **Start playing**.
4. Each player picks a vault and taps **Grab loot**. Watch the reveal, then continue through all four settings.
5. Final loot totals reveal the winner. Alternatively, choose **Play vs computer** to try the same rules alone.

## Verification

The local version passed multiplayer tests using independent Chrome contexts, including a phone-sized screen, full four-round solo play, private opponent totals, reconnect/rematch, 3D selection, demo payouts, reduced motion, and non-WebGL controls. Rules, Postgres integration, database policies, HTTP requests, TypeScript, and production build checks also passed.

Hosted Supabase Auth/Realtime and public deployment verification are pending. A physical-device test has not yet been observed. See [VERIFICATION.md](VERIFICATION.md) for the current evidence.
