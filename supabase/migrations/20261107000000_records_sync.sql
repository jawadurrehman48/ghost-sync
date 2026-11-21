-- Ghost Sync: cloud copy of the append-only records of every app.
--
-- Security model
--   * The browser only ever uses the publishable (anon) key.
--   * The table has row level security ON and NO policies, and anon has no
--     table privileges, so the table cannot be read or written directly.
--   * The only way in is through two SECURITY DEFINER functions that always
--     filter by workspace_id. A workspace id is a random UUID created on the
--     device, so knowing it is what grants access: it is a shared secret.
--   * Records are append-only: nothing here ever updates or deletes a row.
--
-- Run this once in the Supabase SQL Editor (or with `supabase db push`).
-- It is safe to run again.

-- The primary key is (workspace_id, id): a record id is unique within a
-- workspace. This lets a device that already synced records join another
-- workspace and share them there too (same ids, new workspace), and it means
-- one workspace can never block or confirm another workspace's records.
create table if not exists public.records (
  id           uuid        not null,
  workspace_id uuid        not null,
  app          text        not null,
  collection   text        not null,
  payload      jsonb       not null,
  device_id    text        not null,
  created_at   timestamptz not null,
  received_at  timestamptz not null default now(),
  constraint records_pkey primary key (workspace_id, id)
);

-- Incremental pull: (workspace_id, app, received_at), with id as the tie-breaker
-- so rows that share a received_at are paged without gaps.
create index if not exists records_workspace_app_received_idx
  on public.records (workspace_id, app, received_at, id);

alter table public.records enable row level security;
-- No policies on purpose: with RLS on and no policy, anon and authenticated see nothing.
revoke all on table public.records from public;
revoke all on table public.records from anon;
revoke all on table public.records from authenticated;

-- ---------------------------------------------------------------------------
-- push_records: insert a batch, ignore ids the workspace already has
-- (ON CONFLICT (workspace_id, id) DO NOTHING).
-- Returns the ids of the batch that are now stored in this workspace and app
-- (new or already there), so a client whose earlier push response was lost
-- can confirm those records too.
-- ---------------------------------------------------------------------------
create or replace function public.push_records(
  p_workspace_id uuid,
  p_app text,
  p_records jsonb
)
returns table (id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_workspace_id is null then
    raise exception 'p_workspace_id is required' using errcode = '22023';
  end if;
  if p_app is null or p_app !~ '^[a-z][a-z0-9-]{0,39}$' then
    raise exception 'invalid p_app' using errcode = '22023';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception 'p_records must be a JSON array' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_records);
  if v_count = 0 then
    return;
  end if;
  if v_count > 500 then
    raise exception 'too many records in one batch (max 500)' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_records) as e(r)
    where jsonb_typeof(r) <> 'object'
       or jsonb_typeof(r -> 'id') is distinct from 'string'
       or (r ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(r -> 'collection') is distinct from 'string'
       or (r ->> 'collection') !~ '^[A-Za-z][A-Za-z0-9_]{0,63}$'
       or jsonb_typeof(r -> 'deviceId') is distinct from 'string'
       or length(r ->> 'deviceId') not between 1 and 100
       or jsonb_typeof(r -> 'createdAt') is distinct from 'string'
       or (r ->> 'createdAt') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$'
       or jsonb_typeof(r -> 'payload') is distinct from 'object'
       or octet_length((r -> 'payload')::text) > 16384
  ) then
    raise exception 'invalid record in batch' using errcode = '22023';
  end if;

  insert into public.records as rec (id, workspace_id, app, collection, payload, device_id, created_at)
  select (r ->> 'id')::uuid,
         p_workspace_id,
         p_app,
         r ->> 'collection',
         r -> 'payload',
         r ->> 'deviceId',
         (r ->> 'createdAt')::timestamptz
  from jsonb_array_elements(p_records) as e(r)
  -- records_pkey is (workspace_id, id); named so it can't clash with the output column "id".
  on conflict on constraint records_pkey do nothing;

  return query
    select rec.id
    from public.records as rec
    where rec.workspace_id = p_workspace_id
      and rec.app = p_app
      and rec.id in (select (r ->> 'id')::uuid from jsonb_array_elements(p_records) as e(r));
end;
$$;

-- ---------------------------------------------------------------------------
-- pull_records: one page of a workspace's records for an app, in
-- (received_at, id) order, starting strictly after (p_since, p_after_id).
--   * p_since null       -> from the beginning
--   * p_after_id null    -> every row with received_at >= p_since
-- Clients page with the last row's (received_at, id), so rows that share a
-- received_at are never skipped. Page size is capped at 1000.
-- created_at is returned exactly as JavaScript writes it (ms, UTC, "Z").
-- ---------------------------------------------------------------------------
create or replace function public.pull_records(
  p_workspace_id uuid,
  p_app text,
  p_since timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 500
)
returns table (
  id uuid,
  collection text,
  payload jsonb,
  device_id text,
  created_at text,
  received_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_workspace_id is null then
    raise exception 'p_workspace_id is required' using errcode = '22023';
  end if;
  if p_app is null or p_app !~ '^[a-z][a-z0-9-]{0,39}$' then
    raise exception 'invalid p_app' using errcode = '22023';
  end if;

  return query
    select rec.id,
           rec.collection,
           rec.payload,
           rec.device_id,
           to_char(rec.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           rec.received_at
    from public.records as rec
    where rec.workspace_id = p_workspace_id
      and rec.app = p_app
      and (
        p_since is null
        or (rec.received_at, rec.id) > (p_since, coalesce(p_after_id, '00000000-0000-0000-0000-000000000000'::uuid))
      )
    order by rec.received_at, rec.id
    limit least(greatest(coalesce(p_limit, 500), 1), 1000);
end;
$$;

-- Only these two functions are callable from the browser.
revoke all on function public.push_records(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.pull_records(uuid, text, timestamptz, uuid, integer) from public, anon, authenticated;
grant execute on function public.push_records(uuid, text, jsonb) to anon;
grant execute on function public.pull_records(uuid, text, timestamptz, uuid, integer) to anon;
