-- ============================================================
-- Openwall Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ─── Extensions ────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Tables ────────────────────────────────────────────────

-- profiles: mirrors auth.users, stores display info
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text not null default '',
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- exhibitions: created by organizers
create table public.exhibitions (
  id               uuid primary key default gen_random_uuid(),
  organizer_id     uuid not null references public.profiles(id) on delete cascade,
  title            text not null,
  description      text,
  slug             text not null unique,           -- used in QR code URL: /e/[slug]
  cover_image_path text,                           -- Supabase Storage path
  status           text not null default 'active'  -- 'draft' | 'active' | 'closed'
                   check (status in ('draft', 'active', 'closed')),
  starts_at        timestamptz,
  ends_at          timestamptz,
  created_at       timestamptz not null default now()
);

-- uploads: visitor contributions to an exhibition
create table public.uploads (
  id             uuid primary key default gen_random_uuid(),
  exhibition_id  uuid not null references public.exhibitions(id) on delete cascade,
  uploader_id    uuid references public.profiles(id) on delete set null,  -- null = anonymous
  guest_name     text,                              -- for anonymous visitors
  type           text not null                      -- 'photo' | 'text'
                 check (type in ('photo', 'text')),
  storage_path   text,                              -- Supabase Storage path (photos only)
  text_content   text,                              -- text type content
  caption        text,
  created_at     timestamptz not null default now()
);

-- ─── Indexes ───────────────────────────────────────────────
create index on public.exhibitions (organizer_id);
create index on public.exhibitions (slug);
create index on public.uploads (exhibition_id, created_at desc);
create index on public.uploads (uploader_id, created_at desc);

-- ─── Auto-create profile on signup ────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Row Level Security ────────────────────────────────────
alter table public.profiles   enable row level security;
alter table public.exhibitions enable row level security;
alter table public.uploads     enable row level security;

-- profiles
create policy "Users can read any profile"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- exhibitions
-- closed 전시도 방문자에게 공개 (종료 안내 + 갤러리 열람). draft는 주최자만.
create policy "Anyone can read active or closed exhibitions"
  on public.exhibitions for select
  using (status in ('active', 'closed') or organizer_id = auth.uid());

create policy "Organizers can insert exhibitions"
  on public.exhibitions for insert
  with check (auth.uid() = organizer_id);

create policy "Organizers can update own exhibitions"
  on public.exhibitions for update
  using (auth.uid() = organizer_id);

create policy "Organizers can delete own exhibitions"
  on public.exhibitions for delete
  using (auth.uid() = organizer_id);

-- uploads
create policy "Anyone can read uploads"
  on public.uploads for select using (true);

create policy "Anyone can insert uploads"
  on public.uploads for insert with check (true);  -- visitors (incl. anonymous) can upload

create policy "Uploader can delete own upload"
  on public.uploads for delete
  using (auth.uid() = uploader_id);

-- ─── Storage Buckets ───────────────────────────────────────
-- Run these separately if needed (or create via Dashboard > Storage)
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict do nothing;

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict do nothing;

-- Storage policies
create policy "Public read covers"
  on storage.objects for select
  using (bucket_id = 'covers');

create policy "Authenticated upload covers"
  on storage.objects for insert
  with check (bucket_id = 'covers' and auth.role() = 'authenticated');

create policy "Public read uploads"
  on storage.objects for select
  using (bucket_id = 'uploads');

create policy "Anyone can upload"
  on storage.objects for insert
  with check (bucket_id = 'uploads');
