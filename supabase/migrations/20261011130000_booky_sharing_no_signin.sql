-- Booky online review sharing — version 2: no sign-in and no emails (works on Supabase's free plan).
--
-- How access is controlled:
--   * The book and the comments are encrypted in the author's browser with the reviewer's
--     email + passcode. The database only ever holds unreadable ciphertext.
--   * Each copy has two random secrets made on the author's computer. The database stores
--     only their SHA-256 hashes:
--       - the OWNER secret stays with the author (to read comments and delete the copy);
--       - the WRITE secret is hidden inside the encrypted copy, so only someone who unlocked
--         it with the right email + passcode can send comments.
--   * The tables are locked (row level security on, no policies, no grants): visitors can
--     only call the functions below, which check those secrets and expiry dates.
-- Safe to run more than once.

create table if not exists public.booky_copies (
  id uuid primary key default gen_random_uuid(),
  owner_hash text not null,
  write_hash text not null,
  title text not null default '',
  box jsonb not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.booky_comments (
  id uuid primary key default gen_random_uuid(),
  copy_id uuid not null references public.booky_copies (id) on delete cascade,
  box jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists booky_comments_copy_idx on public.booky_comments (copy_id, created_at);

alter table public.booky_copies enable row level security;
alter table public.booky_comments enable row level security;
revoke all on table public.booky_copies, public.booky_comments from public, anon, authenticated;

create or replace function public.booky_hash(secret text) returns text
language sql immutable set search_path = pg_catalog as $$
  select encode(sha256(convert_to(coalesce(secret, ''), 'UTF8')), 'hex')
$$;

create or replace function public.booky_version() returns integer
language sql stable set search_path = pg_catalog as $$ select 2 $$;

create or replace function public.booky_create_copy(p_box jsonb, p_title text, p_owner_secret text, p_write_secret text, p_expires_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $$
declare new_id uuid;
begin
  if length(coalesce(p_owner_secret, '')) < 32 or length(coalesce(p_write_secret, '')) < 32 then raise exception 'secrets too short'; end if;
  if pg_column_size(p_box) > 50 * 1024 * 1024 then raise exception 'review copy is too large (50 MB max)'; end if;
  -- tidy up: copies that expired more than 30 days ago
  delete from booky_copies where expires_at < now() - interval '30 days';
  insert into booky_copies (owner_hash, write_hash, title, box, expires_at)
  values (booky_hash(p_owner_secret), booky_hash(p_write_secret), left(coalesce(p_title, ''), 300), p_box, p_expires_at)
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.booky_get_copy(p_id uuid)
returns table (title text, box jsonb) language sql stable security definer set search_path = public, pg_catalog as $$
  select c.title, c.box from booky_copies c where c.id = p_id and (c.expires_at is null or c.expires_at > now())
$$;

create or replace function public.booky_send_comments(p_id uuid, p_write_secret text, p_box jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $$
declare new_id uuid;
begin
  if not exists (select 1 from booky_copies c where c.id = p_id and c.write_hash = booky_hash(p_write_secret) and (c.expires_at is null or c.expires_at > now())) then
    raise exception 'This review copy is no longer available.';
  end if;
  if pg_column_size(p_box) > 5 * 1024 * 1024 then raise exception 'too many comments in one go (5 MB max)'; end if;
  insert into booky_comments (copy_id, box) values (p_id, p_box) returning id into new_id;
  -- every send contains all of the reviewer's notes, so only the latest few are kept
  delete from booky_comments where copy_id = p_id and id not in (select id from booky_comments where copy_id = p_id order by created_at desc limit 5);
  return new_id;
end $$;

create or replace function public.booky_get_comments(p_id uuid, p_owner_secret text)
returns table (id uuid, box jsonb, created_at timestamptz) language sql stable security definer set search_path = public, pg_catalog as $$
  select m.id, m.box, m.created_at from booky_comments m join booky_copies c on c.id = m.copy_id
  where c.id = p_id and c.owner_hash = booky_hash(p_owner_secret) order by m.created_at
$$;

create or replace function public.booky_delete_copy(p_id uuid, p_owner_secret text)
returns boolean language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  delete from booky_copies where id = p_id and owner_hash = booky_hash(p_owner_secret);
  return found;
end $$;

revoke all on function public.booky_hash(text), public.booky_version(), public.booky_create_copy(jsonb, text, text, text, timestamptz),
  public.booky_get_copy(uuid), public.booky_send_comments(uuid, text, jsonb), public.booky_get_comments(uuid, text), public.booky_delete_copy(uuid, text) from public;
grant execute on function public.booky_version(), public.booky_create_copy(jsonb, text, text, text, timestamptz), public.booky_get_copy(uuid),
  public.booky_send_comments(uuid, text, jsonb), public.booky_get_comments(uuid, text), public.booky_delete_copy(uuid, text) to anon, authenticated;

-- The first version used email sign-in. Remove its tables if they hold nothing.
do $$
declare n bigint;
begin
  if to_regclass('public.review_submissions') is not null then
    execute 'select count(*) from public.review_submissions' into n;
    if n = 0 then execute 'drop table public.review_submissions'; end if;
  end if;
  if to_regclass('public.review_copies') is not null and to_regclass('public.review_submissions') is null then
    execute 'select count(*) from public.review_copies' into n;
    if n = 0 then execute 'drop table public.review_copies'; end if;
  end if;
end $$;
