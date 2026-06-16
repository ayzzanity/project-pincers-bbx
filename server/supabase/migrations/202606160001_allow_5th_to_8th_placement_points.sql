alter table public.player_tournament_records
  drop constraint if exists player_tournament_records_final_placement_check;

alter table public.player_tournament_records
  add constraint player_tournament_records_final_placement_check
  check (final_placement in (1, 2, 3, 4, 5, 6, 7, 8));
