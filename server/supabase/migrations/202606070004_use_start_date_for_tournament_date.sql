update public.tournaments
set event_date = (challonge_started_at at time zone 'Asia/Manila')::date
where challonge_started_at is not null
  and event_date is distinct from (challonge_started_at at time zone 'Asia/Manila')::date;
