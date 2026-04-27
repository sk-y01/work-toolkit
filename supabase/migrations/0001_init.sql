-- =====================================================================
-- Work Toolkit · 초기 스키마 (Phase 1)
--
-- 적용 방법:
--   1) Supabase 대시보드 > SQL Editor > New query 에 이 파일 내용을 복사 후 Run
--   2) 또는 Supabase CLI 로  `supabase db push`
--
-- 변경 시 주의사항:
--   - 이 파일은 "한 번 적용된 후에는 수정하지 말 것"
--   - 스키마 변경은 새 마이그레이션(0002_*.sql) 을 추가하는 식으로 누적
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) profiles : 사용자 프로필 (auth.users 와 1:1)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  team         text,
  created_at   timestamptz not null default now()
);

comment on table public.profiles is '사용자 프로필. auth.users 와 1:1 매핑.';


-- 새 유저가 auth.users 에 생기면 profiles 행을 자동 생성한다.
-- (클라이언트에서 별도 insert 호출을 하지 않아도 된다)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- 2) practice_sets : 훈련 세트 메타데이터
-- ---------------------------------------------------------------------
create table if not exists public.practice_sets (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text,
  difficulty  text not null default 'normal' check (difficulty in ('easy', 'normal', 'hard')),
  category    text,
  is_public   boolean not null default false,
  source      text not null default 'builtin' check (source in ('builtin', 'upload', 'generated')),
  row_count   int  not null check (row_count > 0),
  col_count   int  not null check (col_count > 0),
  created_at  timestamptz not null default now()
);

create index if not exists practice_sets_owner_idx  on public.practice_sets(owner_id);
create index if not exists practice_sets_public_idx on public.practice_sets(is_public) where is_public = true;


-- ---------------------------------------------------------------------
-- 3) practice_set_rows : 세트의 실제 셀 데이터
--    - 한 행을 text[] 로 저장하여 컬럼 수 변경에 유연하게 대응
-- ---------------------------------------------------------------------
create table if not exists public.practice_set_rows (
  set_id    uuid not null references public.practice_sets(id) on delete cascade,
  row_index int  not null check (row_index >= 0),
  cells     text[] not null,
  primary key (set_id, row_index)
);


-- ---------------------------------------------------------------------
-- 4) practice_records : 훈련 결과 기록
-- ---------------------------------------------------------------------
create table if not exists public.practice_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  set_id          uuid references public.practice_sets(id) on delete set null,
  accuracy        int  not null check (accuracy between 0 and 100),
  total_time_sec  int  not null check (total_time_sec >= 0),
  errors          int  not null check (errors >= 0),
  completed_rows  int  not null check (completed_rows >= 0),
  total_rows      int  not null check (total_rows > 0),
  created_at      timestamptz not null default now()
);

create index if not exists practice_records_user_idx on public.practice_records(user_id, created_at desc);
create index if not exists practice_records_set_idx  on public.practice_records(set_id, accuracy desc, total_time_sec asc);


-- ---------------------------------------------------------------------
-- 5) leaderboard : 세트별 사용자 베스트 기록 (뷰)
--    - security_invoker 로 두어 호출자 권한 RLS 가 그대로 적용되게 한다
-- ---------------------------------------------------------------------
create or replace view public.leaderboard
with (security_invoker = true) as
select
  r.set_id,
  r.user_id,
  p.display_name,
  max(r.accuracy)                                                  as best_accuracy,
  min(r.total_time_sec) filter (where r.accuracy = 100)            as best_time_perfect_sec,
  count(*)                                                         as attempts
from public.practice_records r
join public.profiles p on p.id = r.user_id
group by r.set_id, r.user_id, p.display_name;


-- =====================================================================
-- Row Level Security (RLS) 정책
--   - 기본 원칙: 본인 데이터는 풀 접근, 공개 세트는 읽기만 허용
--   - 모든 정책은 auth.uid() (현재 로그인한 사용자의 UUID) 기준
-- =====================================================================

alter table public.profiles          enable row level security;
alter table public.practice_sets     enable row level security;
alter table public.practice_set_rows enable row level security;
alter table public.practice_records  enable row level security;


-- profiles ------------------------------------------------------------
-- display_name 은 랭킹에서 보여줘야 하므로 모두 읽기 허용. 수정은 본인만.
drop policy if exists "profiles read all"   on public.profiles;
drop policy if exists "profiles update self" on public.profiles;

create policy "profiles read all"   on public.profiles for select using (true);
create policy "profiles update self" on public.profiles for update using (id = auth.uid());


-- practice_sets -------------------------------------------------------
drop policy if exists "sets select own or public" on public.practice_sets;
drop policy if exists "sets insert own"           on public.practice_sets;
drop policy if exists "sets update own"           on public.practice_sets;
drop policy if exists "sets delete own"           on public.practice_sets;

create policy "sets select own or public" on public.practice_sets
  for select using (owner_id = auth.uid() or is_public = true);

create policy "sets insert own" on public.practice_sets
  for insert with check (owner_id = auth.uid());

create policy "sets update own" on public.practice_sets
  for update using (owner_id = auth.uid());

create policy "sets delete own" on public.practice_sets
  for delete using (owner_id = auth.uid());


-- practice_set_rows ---------------------------------------------------
-- 부모 세트의 소유자/공개 여부를 따라간다.
drop policy if exists "rows select via parent" on public.practice_set_rows;
drop policy if exists "rows write via parent"  on public.practice_set_rows;

create policy "rows select via parent" on public.practice_set_rows
  for select using (
    exists (
      select 1 from public.practice_sets s
      where s.id = practice_set_rows.set_id
        and (s.owner_id = auth.uid() or s.is_public = true)
    )
  );

create policy "rows write via parent" on public.practice_set_rows
  for all using (
    exists (
      select 1 from public.practice_sets s
      where s.id = practice_set_rows.set_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.practice_sets s
      where s.id = practice_set_rows.set_id and s.owner_id = auth.uid()
    )
  );


-- practice_records ----------------------------------------------------
-- 랭킹용으로 모두 읽기 허용. 본인만 쓰고 본인만 지운다.
drop policy if exists "records read all"   on public.practice_records;
drop policy if exists "records insert self" on public.practice_records;
drop policy if exists "records delete self" on public.practice_records;

create policy "records read all"   on public.practice_records for select using (true);
create policy "records insert self" on public.practice_records for insert with check (user_id = auth.uid());
create policy "records delete self" on public.practice_records for delete using (user_id = auth.uid());
