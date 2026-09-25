-- Upgrade existing deployments from fixed-minute sessions to elapsed seconds.
-- Existing session totals are converted exactly before the old column is removed.
alter table public.study_sessions
  add column if not exists duration_seconds bigint;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'study_sessions' and column_name = 'duration_minutes'
  ) then
    execute 'update public.study_sessions set duration_seconds = duration_minutes::bigint * 60 where duration_seconds is null';
  end if;
end;
$$;

update public.study_sessions set duration_seconds = 1 where duration_seconds is null;
alter table public.study_sessions alter column duration_seconds set not null;
alter table public.study_sessions drop constraint if exists study_sessions_duration_minutes_check;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'study_sessions_duration_seconds_check'
      and conrelid = 'public.study_sessions'::regclass
  ) then
    alter table public.study_sessions
      add constraint study_sessions_duration_seconds_check check (duration_seconds > 0);
  end if;
end;
$$;
alter table public.study_sessions drop column if exists duration_minutes;
