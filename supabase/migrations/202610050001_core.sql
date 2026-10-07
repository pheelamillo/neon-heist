begin;

create schema if not exists heist_private;
revoke all on schema heist_private from public;

create table heist_private.rooms (
  id uuid primary key,
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table heist_private.members (
  room_id uuid not null references heist_private.rooms(id) on delete cascade,
  user_id uuid not null,
  primary key (room_id, user_id)
);
create index members_user_idx on heist_private.members(user_id);

-- A minimal invalidation signal. No choices, room codes, identities or scores.
create table public.room_updates (
  room_id uuid primary key references heist_private.rooms(id) on delete cascade,
  version integer not null,
  updated_at timestamptz not null default now()
);
alter table public.room_updates enable row level security;
revoke all on public.room_updates from public;

-- Development-only session identities. Supabase mode never consults this table.
create table heist_private.local_sessions (
  token_hash text primary key,
  user_id uuid not null,
  expires_at timestamptz not null
);
create index local_sessions_expiry_idx on heist_private.local_sessions(expires_at);

create table heist_private.rate_limits (
  key text primary key,
  count integer not null,
  reset_at timestamptz not null
);

revoke all on all tables in schema heist_private from public;
commit;
