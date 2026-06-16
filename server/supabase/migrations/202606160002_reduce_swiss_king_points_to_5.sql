update public.player_tournament_records
set total_points =
  swiss_wins
  + case when top_cut_entry then 2 else 0 end
  + case when is_swiss_king then 5 else 0 end
  + case final_placement
      when 1 then 10
      when 2 then 8
      when 3 then 5
      when 4 then 4
      when 5 then 3
      when 6 then 2
      when 7 then 1
      when 8 then 1
      else 0
    end;
