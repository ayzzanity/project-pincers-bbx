create extension if not exists pgcrypto;

create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'player' check (role in ('player', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  challonge_started_at timestamptz,
  challonge_completed_at timestamptz,
  event_date date,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected')),
  submitted_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  locked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tournament_sources (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  source_type text not null check (source_type in ('main', 'top_cut')),
  challonge_tournament_id bigint not null,
  challonge_url text not null,
  challonge_slug text,
  name text,
  tournament_type text,
  is_authoritative_top_cut boolean not null default false,
  imported_at timestamptz not null default now(),
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tournament_id, source_type),
  unique (challonge_tournament_id)
);

create table public.tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  source_id uuid not null references public.tournament_sources(id) on delete cascade,
  challonge_participant_id bigint not null,
  name text not null,
  seed integer,
  final_rank integer,
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_record_id uuid,
  claimed_at timestamptz,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, challonge_participant_id)
);

create table public.player_tournament_records (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  main_source_id uuid not null references public.tournament_sources(id),
  main_challonge_tournament_id bigint not null,
  main_challonge_participant_id bigint not null,
  player_name text not null,
  top_cut_source_id uuid references public.tournament_sources(id),
  top_cut_participant_id bigint,
  deck jsonb not null default '{}'::jsonb,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected')),
  swiss_wins integer not null default 0 check (swiss_wins >= 0),
  top_cut_entry boolean not null default false,
  is_swiss_king boolean not null default false,
  final_placement integer check (final_placement in (1, 2, 3, 4, 5, 6, 7, 8)),
  total_points integer not null default 0 check (total_points >= 0),
  valid_wins integer not null default 0 check (valid_wins >= 0),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  locked_at timestamptz,
  import_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (main_challonge_tournament_id, main_challonge_participant_id)
);

alter table public.tournament_participants
  add constraint tournament_participants_claimed_record_fk
  foreign key (claimed_record_id)
  references public.player_tournament_records(id)
  on delete set null;

create table public.match_records (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  source_id uuid not null references public.tournament_sources(id) on delete cascade,
  player_record_id uuid references public.player_tournament_records(id) on delete cascade,
  challonge_match_id bigint not null,
  stage text not null check (stage in ('swiss', 'top_cut', 'unknown')),
  round_label text,
  round_number integer,
  player_challonge_participant_id bigint,
  opponent_challonge_participant_id bigint,
  result text not null check (result in ('win', 'loss', 'tie', 'bye', 'dq', 'forfeit', 'unknown')),
  points_awarded integer not null default 0,
  needs_review boolean not null default false,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, challonge_match_id, player_challonge_participant_id)
);

create table public.review_flags (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  player_record_id uuid references public.player_tournament_records(id) on delete cascade,
  source_id uuid references public.tournament_sources(id) on delete cascade,
  flag_type text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index tournaments_status_event_date_idx
  on public.tournaments (status, event_date desc);

create index tournament_sources_tournament_id_idx
  on public.tournament_sources (tournament_id);

create index tournament_participants_claim_idx
  on public.tournament_participants (source_id, claimed_by);

create index player_records_user_status_idx
  on public.player_tournament_records (user_id, status);

create index player_records_leaderboard_idx
  on public.player_tournament_records (
    status,
    total_points desc,
    is_swiss_king desc,
    valid_wins desc
  );

create index match_records_record_stage_idx
  on public.match_records (player_record_id, stage);

create index review_flags_status_idx
  on public.review_flags (status, severity);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger tournaments_set_updated_at
before update on public.tournaments
for each row execute function private.set_updated_at();

create trigger player_tournament_records_set_updated_at
before update on public.player_tournament_records
for each row execute function private.set_updated_at();

create view public.leaderboard
with (security_invoker = true)
as
select
  p.id as user_id,
  p.display_name,
  coalesce(sum(r.total_points), 0)::integer as total_points,
  count(*) filter (where r.final_placement = 1)::integer as champion_count,
  count(*) filter (where r.is_swiss_king)::integer as swiss_king_count,
  count(*) filter (where r.final_placement = 2)::integer as finisher_count,
  coalesce(sum(r.valid_wins), 0)::integer as total_valid_wins,
  max(t.event_date)::date as most_recent_approved_tournament_date,
  count(*)::integer as approved_tournament_count
from public.player_tournament_records r
join public.profiles p on p.id = r.user_id
join public.tournaments t on t.id = r.tournament_id
where r.status = 'approved'
  and t.status = 'approved'
group by p.id, p.display_name
order by
  total_points desc,
  champion_count desc,
  swiss_king_count desc,
  finisher_count desc,
  total_valid_wins desc,
  most_recent_approved_tournament_date desc nulls last;

create view public.player_profile_stats
with (security_invoker = true)
as
select
  p.id as user_id,
  p.display_name,
  coalesce(sum(r.total_points), 0)::integer as total_points,
  count(*) filter (where r.status = 'approved')::integer as approved_tournament_count,
  count(*) filter (where r.final_placement = 1 and r.status = 'approved')::integer as champion_count,
  count(*) filter (where r.final_placement = 2 and r.status = 'approved')::integer as finisher_count,
  count(*) filter (where r.final_placement = 3 and r.status = 'approved')::integer as third_place_count,
  count(*) filter (where r.final_placement = 4 and r.status = 'approved')::integer as fourth_place_count,
  count(*) filter (where r.is_swiss_king and r.status = 'approved')::integer as swiss_king_count,
  coalesce(sum(r.valid_wins) filter (where r.status = 'approved'), 0)::integer as total_valid_wins,
  max(t.event_date) filter (where r.status = 'approved')::date as most_recent_approved_tournament_date
from public.profiles p
left join public.player_tournament_records r on r.user_id = p.id
left join public.tournaments t on t.id = r.tournament_id
group by p.id, p.display_name;

alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_sources enable row level security;
alter table public.tournament_participants enable row level security;
alter table public.player_tournament_records enable row level security;
alter table public.match_records enable row level security;
alter table public.review_flags enable row level security;

create policy "profiles are readable"
on public.profiles for select
to anon, authenticated
using (true);

create policy "users can insert own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id and role = 'player');

create policy "users can update own display name"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id and role = 'player');

create policy "admins can manage profiles"
on public.profiles for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "approved tournaments are public"
on public.tournaments for select
to anon, authenticated
using (status = 'approved');

create policy "users can see submitted tournaments"
on public.tournaments for select
to authenticated
using (submitted_by = (select auth.uid()) or (select private.is_admin()));

create policy "backend or admins manage tournaments"
on public.tournaments for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "approved sources are public"
on public.tournament_sources for select
to anon, authenticated
using (
  exists (
    select 1 from public.tournaments t
    where t.id = tournament_id and t.status = 'approved'
  )
);

create policy "users can see sources for own submitted tournaments"
on public.tournament_sources for select
to authenticated
using (
  exists (
    select 1 from public.tournaments t
    where t.id = tournament_id
      and (t.submitted_by = (select auth.uid()) or (select private.is_admin()))
  )
);

create policy "admins manage sources"
on public.tournament_sources for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "participants visible for import dropdown"
on public.tournament_participants for select
to authenticated
using (
  exists (
    select 1 from public.tournaments t
    where t.id = tournament_id
      and (t.submitted_by = (select auth.uid()) or t.status = 'approved' or (select private.is_admin()))
  )
);

create policy "admins manage participants"
on public.tournament_participants for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "approved player records are public"
on public.player_tournament_records for select
to anon, authenticated
using (status = 'approved');

create policy "users can see own player records"
on public.player_tournament_records for select
to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "admins manage player records"
on public.player_tournament_records for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "approved match records are public"
on public.match_records for select
to anon, authenticated
using (
  exists (
    select 1
    from public.player_tournament_records r
    where r.id = player_record_id
      and r.status = 'approved'
  )
);

create policy "users can see own match records"
on public.match_records for select
to authenticated
using (
  exists (
    select 1
    from public.player_tournament_records r
    where r.id = player_record_id
      and (r.user_id = (select auth.uid()) or (select private.is_admin()))
  )
);

create policy "admins manage match records"
on public.match_records for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "users can see own review flags"
on public.review_flags for select
to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1
    from public.player_tournament_records r
    where r.id = player_record_id
      and r.user_id = (select auth.uid())
  )
);

create policy "admins manage review flags"
on public.review_flags for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
