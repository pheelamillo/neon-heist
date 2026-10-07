# GitHub and Vercel deployment

The source is portable. The following steps deploy it under your own GitHub, Supabase, and Vercel accounts. Public deployment should follow local multiplayer tests and the hosted Supabase smoke test. No OpenAI integration is needed.

## 1. Create a Supabase development project

Use a fresh project for this game. Enable **Authentication → Providers → Anonymous Sign-Ins**. Players authenticate anonymously and enter a nickname in the game; no email/password screen is needed.

Get the project URL and publishable key. Get the **transaction pooler** Postgres connection string from the project's Connect dialog (port **6543**). Copy the actual pooler hostname and username from Supabase; do not guess them. Percent-encode reserved characters in the database password.

Use these values in `.env.local` for local testing against Supabase, and as environment variables for a Vercel preview:

```dotenv
NEON_AUTH_MODE=supabase
NEXT_PUBLIC_NEON_AUTH_MODE=supabase
DATABASE_URL=<Supabase transaction pooler connection string>
DATABASE_SSL=true
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Keep `DATABASE_URL` private. Only the two `NEXT_PUBLIC_SUPABASE_*` values and the nonsecret browser auth mode go to the browser. A Supabase service-role key is not required. `.env.local` is ignored by Git. TLS certificate verification stays enabled; use `DATABASE_CA_CERT` if your connection needs an additional trusted PEM certificate.

Preserve your native local `.env.local` separately before replacing it. Restart the development server after changing environment variables. Vercel must build with the Supabase browser settings; changing a `NEXT_PUBLIC_*` value requires a new deployment.

## 2. Apply the schema

With the Supabase connection configured:

```sh
npm run db:migrate
```

Alternatively, apply the two SQL files in `supabase/migrations` in order using Supabase's SQL Editor. Choose one migration method consistently. The Node migration runner records applied migrations separately; do not mix it with manually applied migrations unless you reconcile its tracking table.

Ensure the project's exposed API schemas exclude **`heist_private`** (Supabase normally exposes `public`). The migration enables RLS, grants members read-only access to `public.room_updates`, and adds that table to `supabase_realtime`. Enable Postgres Changes/replication for that table if your project uses a nondefault publication setup.

## 3. Verify hosted multiplayer before production

Start the local Next.js server in Supabase mode and run:

```sh
npm run test:supabase
```

This must verify two real Realtime subscribers, membership isolation, forbidden direct writes, secret submissions, and scoring. Then play a full match from two physical devices, including one reconnect. Confirm timer boundaries, all four rounds, automatic runners, vault animations, and rematch. Check solo practice as well. Local polling and simulated phone viewport tests alone do not complete this hosted check.

## 4. Prepare and push to your GitHub repository

Create an empty GitHub repository under your account. From this folder:

```sh
git init -b main
git add .
git commit -m "Build standalone Neon Heist multiplayer game"
git remote add origin <your-repository-url>
git push -u origin main
```

If this folder is already initialized, omit `git init`. Review `git status` before committing. Environment files, database data, build output, dependencies, and test artifacts must remain ignored. No repository has been selected or pushed automatically.

## 5. Create a Vercel preview

Import your GitHub repository into Vercel. Select **Next.js**, root directory `.` if the repository is this folder, build command `npm run build`, install command `npm ci`, and Node.js **22.x or newer**. If you place the app inside a larger repository, use its subdirectory as the Vercel root directory.

Add the six Supabase environment settings above for **Preview**. Deploy, visit the ordinary preview URL, and run the hosted smoke test with `NEON_TEST_URL` set to the preview URL. An unauthenticated test runner needs access to the preview; if Vercel deployment protection is enabled, open it appropriately for testing or use the local server against the same Supabase project.

Check that Supabase Auth allows the deployed site URL in its project settings. Anonymous sign-in has no OAuth redirect, but keep site settings correct. Keep Supabase's anonymous sign-in rate limits enabled; configure its CAPTCHA protection if you decide the public game needs it. A CAPTCHA-enabled sign-in requires adding the corresponding client token flow before enabling it.

## 6. Promote to production

Set the Supabase variables for **Production**, ideally against a separate production Supabase project with the same migrations. Complete the hosted smoke test and physical-device check there before sharing the public URL. Deploy or promote the verified commit in Vercel. People can then create rooms and play through your Vercel/custom domain URL, without ChatGPT running.

## Operations and limits

- Use the Supabase transaction pooler for serverless functions. The app's `pg` pool is capped at three connections per instance and uses unnamed queries, compatible with transaction pooling.
- There are no in-process timers, local file writes, or persistent WebSocket servers in production. Authoritative deadlines catch up on authenticated access. Supabase handles browser WebSockets.
- Room state and memberships persist until you choose a retention policy. For an initial small deployment this is intentional. Set retention/cleanup and review Supabase quotas before sustained public traffic. Supabase anonymous accounts also need a retention policy; its anonymous-account cleanup is not automatic.
- Request limits persist in Postgres and protect create, join, and action endpoints per identity. They are not a substitute for Supabase's authentication abuse controls.
- Monitor Vercel request errors and Supabase connections/Realtime usage. The client keeps polling if Realtime temporarily fails, and resumes its seat in the same browser.
- Test artifacts record browser automation, not a completed physical-device test or hosted deployment. Record those checks when you perform them.
