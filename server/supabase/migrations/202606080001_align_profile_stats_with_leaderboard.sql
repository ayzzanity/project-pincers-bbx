create or replace view public.player_profile_stats
with (security_invoker = true)
as
select
  p.id as user_id,
  p.display_name,
  coalesce(sum(r.total_points) filter (where r.status = 'approved' and t.status = 'approved'), 0)::integer as total_points,
  count(*) filter (where r.status = 'approved' and t.status = 'approved')::integer as approved_tournament_count,
  count(*) filter (where r.final_placement = 1 and r.status = 'approved' and t.status = 'approved')::integer as champion_count,
  count(*) filter (where r.final_placement = 2 and r.status = 'approved' and t.status = 'approved')::integer as finisher_count,
  count(*) filter (where r.final_placement = 3 and r.status = 'approved' and t.status = 'approved')::integer as third_place_count,
  count(*) filter (where r.final_placement = 4 and r.status = 'approved' and t.status = 'approved')::integer as fourth_place_count,
  count(*) filter (where r.is_swiss_king and r.status = 'approved' and t.status = 'approved')::integer as swiss_king_count,
  coalesce(sum(r.valid_wins) filter (where r.status = 'approved' and t.status = 'approved'), 0)::integer as total_valid_wins,
  max(t.event_date) filter (where r.status = 'approved' and t.status = 'approved')::date as most_recent_approved_tournament_date
from public.profiles p
left join public.player_tournament_records r on r.user_id = p.id
left join public.tournaments t on t.id = r.tournament_id
group by p.id, p.display_name;
