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
  cover_image_path text,                           -- (legacy) 단일 커버 경로, 현재 미사용
  cover_images     text[],                         -- covers 버킷 경로 목록 ({organizer_id}/{파일명})
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
  edit_token_hash text,                             -- 비회원 수정·귀속 토큰의 SHA-256(hex). 회원 업로드·귀속 후에는 null
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

-- insert 정책 없음: 업로드 행은 submitUpload 서버 액션이 권한 확인 후 admin client로만 추가

create policy "Uploader can delete own upload"
  on public.uploads for delete
  using (auth.uid() = uploader_id);

-- ─── Storage Buckets ───────────────────────────────────────
-- Run these separately if needed (or create via Dashboard > Storage)
-- 두 버킷 모두 10MB, 이미지 7종 (app/actions/uploads.ts의 ALLOWED_IMAGE_TYPES와 동일하게 유지)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('covers',  'covers',  true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif']),
  ('uploads', 'uploads', true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies
create policy "Public read covers"
  on storage.objects for select
  using (bucket_id = 'covers');

-- covers: 로그인 사용자가 본인 폴더({user.id}/...)에만 쓰기·수정·삭제
create policy "Owners can upload covers"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owners can update covers"
  on storage.objects for update to authenticated
  using      (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own covers"
  on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Public read uploads"
  on storage.objects for select
  using (bucket_id = 'uploads');

-- uploads 버킷 insert 정책 없음: submitUpload 서버 액션이 admin client로만 업로드
