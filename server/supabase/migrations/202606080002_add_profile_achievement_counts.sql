create or replace view public.player_profile_stats
with (security_invoker = true)
as
with verified_records as (
  select
    r.user_id,
    r.total_points,
    r.valid_wins,
    r.final_placement,
    r.is_swiss_king,
    t.event_date
  from public.player_tournament_records r
  join public.tournaments t on t.id = r.tournament_id
  where r.status = 'approved'
    and t.status = 'approved'
),
monthly_rankings as (
  select
    user_id,
    month_start,
    dense_rank() over (
      partition by month_start
      order by
        total_points desc,
        champion_count desc,
        swiss_king_count desc,
        finisher_count desc,
        total_valid_wins desc
    ) as monthly_rank
  from (
    select
      user_id,
      date_trunc('month', event_date)::date as month_start,
      coalesce(sum(total_points), 0)::integer as total_points,
      count(*) filter (where final_placement = 1)::integer as champion_count,
      count(*) filter (where is_swiss_king)::integer as swiss_king_count,
      count(*) filter (where final_placement = 2)::integer as finisher_count,
      coalesce(sum(valid_wins), 0)::integer as total_valid_wins
    from verified_records
    where event_date is not null
    group by user_id, date_trunc('month', event_date)::date
  ) monthly_totals
),
monthly_awards as (
  select
    user_id,
    count(*) filter (where monthly_rank = 1)::integer as blader_of_month_count
  from monthly_rankings
  group by user_id
)
select
  p.id as user_id,
  p.display_name,
  coalesce(sum(v.total_points), 0)::integer as total_points,
  count(v.*)::integer as approved_tournament_count,
  count(*) filter (where v.final_placement = 1)::integer as champion_count,
  count(*) filter (where v.final_placement = 2)::integer as finisher_count,
  count(*) filter (where v.final_placement = 3)::integer as third_place_count,
  count(*) filter (where v.final_placement = 4)::integer as fourth_place_count,
  count(*) filter (where v.is_swiss_king)::integer as swiss_king_count,
  coalesce(sum(v.valid_wins), 0)::integer as total_valid_wins,
  max(v.event_date)::date as most_recent_approved_tournament_date,
  count(*) filter (where v.final_placement in (1, 2, 3, 4))::integer as podium_finish_count,
  coalesce(max(ma.blader_of_month_count), 0)::integer as blader_of_month_count
from public.profiles p
left join verified_records v on v.user_id = p.id
left join monthly_awards ma on ma.user_id = p.id
group by p.id, p.display_name;
