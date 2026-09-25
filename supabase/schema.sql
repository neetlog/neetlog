-- Run once in the Supabase SQL Editor. All user data is scoped by auth.uid().
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  neet_target_year integer not null default 2027 check (neet_target_year between 2026 and 2100),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (subject in ('Physics','Organic Chemistry','Physical Chemistry','Inorganic Chemistry','Zoology','Botany')),
  name text not null,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  progress integer not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, subject, name),
  check ((status = 'completed' and progress = 100) or (status = 'not_started' and progress = 0) or status = 'in_progress')
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  subject text not null check (subject in ('Physics','Organic Chemistry','Physical Chemistry','Inorganic Chemistry','Zoology','Botany')),
  chapter text,
  due_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  started_at timestamptz not null,
  completed_at timestamptz,
  study_date date not null,
  completed boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists chapters_user_subject_idx on public.chapters(user_id, subject);
create index if not exists tasks_user_due_idx on public.tasks(user_id, due_date);
create index if not exists sessions_user_date_idx on public.study_sessions(user_id, study_date desc);

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.chapters to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.study_sessions to authenticated;

alter table public.profiles enable row level security;
alter table public.chapters enable row level security;
alter table public.tasks enable row level security;
alter table public.study_sessions enable row level security;
drop policy if exists "read own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (id = (select auth.uid()));
create policy "update own profile" on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Profile creation is handled by the trusted auth trigger; users cannot create another profile.
drop policy if exists "manage own chapters" on public.chapters;
create policy "manage own chapters" on public.chapters for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "manage own tasks" on public.tasks;
create policy "manage own tasks" on public.tasks for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "manage own sessions" on public.study_sessions;
create policy "manage own sessions" on public.study_sessions for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, neet_target_year)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'neet_target_year')::integer, 2027));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
