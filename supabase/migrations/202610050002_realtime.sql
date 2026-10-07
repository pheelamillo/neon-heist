begin;

-- The native Postgres development path has no auth schema or Realtime server.
-- On Supabase this block installs the exact RLS policy and publication.
do $migration$
begin
  if to_regprocedure('auth.uid()') is not null then
    execute $function$
      create or replace function public.neon_is_member(p_room_id uuid)
      returns boolean
      language sql stable security definer
      set search_path = ''
      as $body$
        select exists (
          select 1 from heist_private.members
          where room_id = p_room_id and user_id = (select auth.uid())
        );
      $body$;
    $function$;
    revoke all on function public.neon_is_member(uuid) from public;
    revoke all on function public.neon_is_member(uuid) from anon;
    grant execute on function public.neon_is_member(uuid) to authenticated;
    grant usage on schema public to authenticated;
    grant select on public.room_updates to authenticated;
    revoke insert, update, delete, truncate, references, trigger on public.room_updates from authenticated, anon;
    revoke all on schema heist_private from authenticated, anon;
    revoke all on all tables in schema heist_private from authenticated, anon;
    create policy "Room members receive only their room updates"
      on public.room_updates for select to authenticated
      using (public.neon_is_member(room_id));
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
      alter publication supabase_realtime add table public.room_updates;
    end if;
  end if;
end;
$migration$;

commit;
