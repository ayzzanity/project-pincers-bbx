# Laravel Backend Comparison

The old Laravel backend used three separate Challonge v1 calls:

- `GET /v1/tournaments/{slug}.json`
- `GET /v1/tournaments/{slug}/participants.json`
- `GET /v1/tournaments/{slug}/matches.json`

This matters for built-in two-stage Challonge tournaments. The tournament `include_matches=1` response can omit group-stage matches, while the separate `/matches.json` endpoint returns both:

- grouped Swiss/group-stage matches where `group_id` is present
- final-stage bracket matches where `group_id` is `null`

The old backend also mapped `participant.group_player_ids` back to the main participant id. Group-stage matches use those group player ids, not the final-stage participant ids.

Current Node behavior now mirrors that important Laravel behavior:

- v2.1 is tried first when available
- v1 fallback uses separate tournament, participants, and matches endpoints
- grouped matches are classified as `swiss`
- non-group matches in a built-in two-stage tournament are classified as `top_cut`
- selected participant matching includes both `participant.id` and `participant.group_player_ids`

The old `ChallongeStandingsService` also scraped `https://challonge.com/{slug}/standings` and parsed the standings table. The Node backend now has the same parser in `challongeStandingsService`, but Challonge may return Cloudflare challenge HTML to server-side requests. When that happens, the backend still computes Swiss wins from `/matches.json`.

Verified sample:

- Tournament: `https://challonge.com/c091t27x`
- Player: `Ayz 1`
- Result: `5 - 0 - 0` Swiss record
- Top Cut: entered
- Swiss King: confirmed
- Total MVP points: `15`
