-- Booky online review sharing.
--
-- Review copies are encrypted in the author's browser (AES-GCM, key derived from the
-- reviewer's email + passcode), so this database only ever stores ciphertext: neither
-- Supabase nor anyone with database access can read the book or the comments.
--
-- Who can do what (row level security):
--   * an author (signed in) creates, lists, revokes and deletes their own copies;
--   * a reviewer (signed in with the invited email) can read only the copy shared
--     with that email, while it is not revoked or expired, and can send comments to it;
--   * the author reads the comments sent to their copies.

create table if not exists public.review_copies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id text not null,
  round_id text not null,
  reviewer_email text not null check (reviewer_email = lower(reviewer_email)),
  title text not null default '',
  author text not null default '',
  box jsonb not null,
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists review_copies_owner_idx on public.review_copies (owner_id, book_id);
create index if not exists review_copies_email_idx on public.review_copies (reviewer_email);

create table if not exists public.review_submissions (
  id uuid primary key default gen_random_uuid(),
  copy_id uuid not null references public.review_copies (id) on delete cascade,
  reviewer_email text not null default lower(auth.jwt() ->> 'email'),
  box jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists review_submissions_copy_idx on public.review_submissions (copy_id, created_at);

alter table public.review_copies enable row level security;
alter table public.review_submissions enable row level security;

revoke all on public.review_copies from anon;
revoke all on public.review_submissions from anon;
grant select, insert, update, delete on public.review_copies to authenticated;
grant select, insert, delete on public.review_submissions to authenticated;

-- Copies ---------------------------------------------------------------------
drop policy if exists "Authors manage their own review copies" on public.review_copies;
create policy "Authors manage their own review copies"
  on public.review_copies for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Invited reviewers read their copy" on public.review_copies;
create policy "Invited reviewers read their copy"
  on public.review_copies for select to authenticated
  using (
    reviewer_email = lower((select auth.jwt()) ->> 'email')
    and not revoked
    and (expires_at is null or expires_at > now())
  );

-- Comments -------------------------------------------------------------------
drop policy if exists "Reviewers send comments to their copy" on public.review_submissions;
create policy "Reviewers send comments to their copy"
  on public.review_submissions for insert to authenticated
  with check (
    reviewer_email = lower((select auth.jwt()) ->> 'email')
    and exists (
      select 1 from public.review_copies c
      where c.id = copy_id
        and c.reviewer_email = lower((select auth.jwt()) ->> 'email')
        and not c.revoked
        and (c.expires_at is null or c.expires_at > now())
    )
  );

drop policy if exists "Reviewers see what they sent" on public.review_submissions;
create policy "Reviewers see what they sent"
  on public.review_submissions for select to authenticated
  using (reviewer_email = lower((select auth.jwt()) ->> 'email'));

drop policy if exists "Authors read comments on their copies" on public.review_submissions;
create policy "Authors read comments on their copies"
  on public.review_submissions for select to authenticated
  using (exists (select 1 from public.review_copies c where c.id = copy_id and c.owner_id = (select auth.uid())));

drop policy if exists "Authors delete comments on their copies" on public.review_submissions;
create policy "Authors delete comments on their copies"
  on public.review_submissions for delete to authenticated
  using (exists (select 1 from public.review_copies c where c.id = copy_id and c.owner_id = (select auth.uid())));
