alter table public.tournaments
  drop constraint if exists tournaments_organizer_url_http_check;

alter table public.tournaments
  drop column if exists organizer_name,
  drop column if exists organizer_url;
