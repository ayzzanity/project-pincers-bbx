const express = require('express');
const { supabaseAdmin } = require('../lib/supabase');
const { AppError } = require('../utils/errors');
const { fetchTournament } = require('../services/challongeService');
const { POINTS } = require('../services/scoringService');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('leaderboard')
      .select('*')
      .limit(100);

    if (error) throw error;

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/monthly', async (_req, res, next) => {
  try {
    const currentMonth = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit'
    }).format(new Date());
    const [year, month] = currentMonth.split('-');
    res.json({ data: await buildPeriodLeaderboard({ year, month }) });
  } catch (error) {
    next(error);
  }
});

router.get('/filtered', async (req, res, next) => {
  try {
    const year = normalizeYear(req.query.year);
    const month = normalizeMonth(req.query.month);

    if (month && !year) {
      throw new AppError(400, 'leaderboard_year_required', 'A year is required when filtering by month.');
    }

    const data = await buildPeriodLeaderboard({ year, month });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/players/:userId/stats', async (req, res, next) => {
  try {
    const { data: stats, error } = await supabaseAdmin
      .from('player_profile_stats')
      .select('*')
      .eq('user_id', req.params.userId)
      .single();

    if (error) throw error;

    const { data: records, error: recordsError } = await supabaseAdmin
      .from('player_tournament_records')
      .select('id, tournaments!inner(status)')
      .eq('user_id', req.params.userId)
      .eq('status', 'approved')
      .eq('tournaments.status', 'approved');

    if (recordsError) throw recordsError;

    const recordIds = records.map((record) => record.id);
    const { count: totalMatches, error: matchesError } = recordIds.length
      ? await supabaseAdmin
          .from('match_records')
          .select('id', { count: 'exact', head: true })
          .in('player_record_id', recordIds)
      : { count: 0, error: null };

    if (matchesError) throw matchesError;

    res.json({
      data: {
        ...stats,
        total_matches: totalMatches || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/players/:userId/history', async (req, res, next) => {
  try {
    const { data: records, error } = await supabaseAdmin
      .from('player_tournament_records')
      .select(
        'id, player_name, swiss_wins, is_swiss_king, final_placement, total_points, status, created_at, tournaments!inner(name, event_date, status)'
      )
      .eq('user_id', req.params.userId)
      .eq('status', 'approved')
      .eq('tournaments.status', 'approved')
      .order('event_date', { foreignTable: 'tournaments', ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const recordIds = records.map((record) => record.id);
    const { data: matches, error: matchesError } = recordIds.length
      ? await supabaseAdmin
          .from('match_records')
          .select('player_record_id, stage, result')
          .in('player_record_id', recordIds)
      : { data: [], error: null };

    if (matchesError) throw matchesError;

    const matchesByRecordId = matches.reduce((acc, match) => {
      const rows = acc.get(match.player_record_id) || [];
      rows.push(match);
      acc.set(match.player_record_id, rows);
      return acc;
    }, new Map());

    const sortedRecords = [...records].sort((a, b) => {
      const dateA = a.tournaments.event_date ? new Date(a.tournaments.event_date).getTime() : 0;
      const dateB = b.tournaments.event_date ? new Date(b.tournaments.event_date).getTime() : 0;
      return dateB - dateA || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    res.json({
      data: sortedRecords.map((record) => {
        const recordMatches = matchesByRecordId.get(record.id) || [];
        const swissMatches = recordMatches.filter((match) => match.stage === 'swiss');
        const swissLosses = swissMatches.filter((match) => match.result === 'loss').length;
        const swissTies = swissMatches.filter((match) => match.result === 'tie').length;

        return {
          id: record.id,
          tournament_name: record.tournaments.name,
          event_date: record.tournaments.event_date,
          player_name: record.player_name,
          swiss_record: `${record.swiss_wins || 0} - ${swissLosses} - ${swissTies}`,
          isSwissKing: record.is_swiss_king,
          final_placement: record.final_placement,
          total_points: record.total_points,
          status: record.status
        };
      })
    });
  } catch (error) {
    next(error);
  }
});

router.get('/players/:userId/history/:recordId', async (req, res, next) => {
  try {
    const { data: record, error } = await supabaseAdmin
      .from('player_tournament_records')
      .select(
        'id, player_name, swiss_wins, valid_wins, top_cut_entry, is_swiss_king, final_placement, total_points, status, import_summary, tournaments!inner(name, event_date, status)'
      )
      .eq('id', req.params.recordId)
      .eq('user_id', req.params.userId)
      .eq('status', 'approved')
      .eq('tournaments.status', 'approved')
      .maybeSingle();

    if (error) throw error;
    if (!record) {
      throw new AppError(404, 'history_record_not_found', 'This verified tournament record was not found.');
    }

    const { data: matches, error: matchesError } = await supabaseAdmin
      .from('match_records')
      .select(
        'id, source_id, challonge_match_id, stage, round_number, player_challonge_participant_id, opponent_challonge_participant_id, result, points_awarded, raw_data'
      )
      .eq('player_record_id', record.id);

    if (matchesError) throw matchesError;

    const sourceIds = [...new Set(matches.map((match) => match.source_id))];
    const { data: sources, error: sourcesError } = sourceIds.length
      ? await supabaseAdmin
          .from('tournament_sources')
          .select('id, challonge_url')
          .in('id', sourceIds)
      : { data: [], error: null };

    if (sourcesError) throw sourcesError;

    const opponentNamesBySource = new Map();
    await Promise.all(sources.map(async (source) => {
      try {
        const tournament = await fetchTournament(source.challonge_url);
        const participantNames = new Map();

        for (const participant of tournament.participants) {
          participantNames.set(Number(participant.id), participant.name);
          for (const groupPlayerId of participant.group_player_ids || []) {
            participantNames.set(Number(groupPlayerId), participant.name);
          }
        }

        opponentNamesBySource.set(source.id, participantNames);
      } catch (_error) {
        opponentNamesBySource.set(source.id, new Map());
      }
    }));

    const pointBreakdown = buildCurrentPointBreakdown(record);
    const sortedMatches = [...matches].sort((a, b) =>
      (a.stage === b.stage ? 0 : a.stage === 'swiss' ? -1 : 1)
      || (a.round_number == null ? 1 : 0) - (b.round_number == null ? 1 : 0)
      || (a.round_number || 0) - (b.round_number || 0)
    );
    const swissMatches = sortedMatches.filter((match) => match.stage === 'swiss');
    const savedSwissRecord = record.import_summary?.swissRecord;
    const swissWins = swissMatches.length
      ? swissMatches.filter((match) => match.result === 'win').length
      : record.swiss_wins ?? 0;
    const swissLosses = swissMatches.filter((match) => match.result === 'loss').length;
    const swissTies = swissMatches.filter((match) => match.result === 'tie').length;
    const swissRecord = savedSwissRecord
      ? `${savedSwissRecord.wins ?? record.swiss_wins ?? 0} - ${savedSwissRecord.losses ?? 0} - ${savedSwissRecord.ties ?? 0}`
      : `${swissWins} - ${swissLosses} - ${swissTies}`;

    res.json({
      data: {
        id: record.id,
        tournamentName: record.tournaments.name,
        eventDate: record.tournaments.event_date,
        playerName: record.player_name,
        swissRecord,
        validWins: record.valid_wins,
        topCutEntry: record.top_cut_entry,
        isSwissKing: record.is_swiss_king,
        finalPlacement: record.final_placement,
        totalPoints: record.total_points,
        pointBreakdown,
        matches: sortedMatches.map((match) => ({
          id: match.id,
          challongeMatchId: match.challonge_match_id,
          stage: match.stage,
          round: match.round_number,
          result: match.result,
          pointsAwarded: match.points_awarded,
          opponentName:
            opponentNamesBySource.get(match.source_id)?.get(Number(match.opponent_challonge_participant_id))
            || (match.opponent_challonge_participant_id
              ? `Participant #${match.opponent_challonge_participant_id}`
              : 'Unknown opponent'),
          score: scoreFromPlayerPerspective(match)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

function scoreFromPlayerPerspective(match) {
  const rawScore = String(match.raw_data?.scores_csv || '').trim();
  const scoreParts = rawScore.match(/\d+/g)?.map(Number) || [];
  if (scoreParts.length < 2) return rawScore || null;

  const [firstScore, secondScore] = scoreParts;
  const higherScore = Math.max(firstScore, secondScore);
  const lowerScore = Math.min(firstScore, secondScore);

  if (match.result === 'win') return `${higherScore}-${lowerScore}`;
  if (match.result === 'loss') return `${lowerScore}-${higherScore}`;
  return `${firstScore}-${secondScore}`;
}

function buildCurrentPointBreakdown(record) {
  const finalPlacement = record.final_placement;

  return [
    {
      key: 'swiss_wins',
      label: 'Swiss wins',
      value: record.swiss_wins || 0,
      points: record.swiss_wins || 0
    },
    {
      key: 'top_cut_entry',
      label: 'Top Cut entry',
      value: record.top_cut_entry ? 'Yes' : 'No',
      points: record.top_cut_entry ? POINTS.topCutEntry : 0
    },
    {
      key: 'swiss_king',
      label: 'Swiss King',
      value: record.is_swiss_king ? 'Yes' : 'No',
      points: record.is_swiss_king ? POINTS.swissKing : 0
    },
    {
      key: 'final_placement',
      label: 'Final placement',
      value: finalPlacement || 'Unplaced',
      points: placementPoints(finalPlacement)
    }
  ];
}

function placementPoints(finalPlacement) {
  if (finalPlacement === 1) return POINTS.champion;
  if (finalPlacement === 2) return POINTS.finisher;
  if (finalPlacement === 3) return POINTS.thirdPlace;
  if (finalPlacement === 4) return POINTS.fourthPlace;
  if (finalPlacement === 5) return POINTS.fifthPlace;
  if (finalPlacement === 6) return POINTS.sixthPlace;
  if (finalPlacement === 7) return POINTS.seventhPlace;
  if (finalPlacement === 8) return POINTS.eighthPlace;
  return 0;
}

async function buildPeriodLeaderboard({ year = null, month = null }) {
  const { data, error } = await supabaseAdmin
    .from('player_tournament_records')
    .select(
      'user_id, total_points, valid_wins, final_placement, is_swiss_king, tournaments!inner(event_date, status)'
    )
    .eq('status', 'approved')
    .eq('tournaments.status', 'approved')
    .not('tournaments.event_date', 'is', null);

  if (error) throw error;

  const filteredRecords = data.filter((record) => matchesPeriod(record.tournaments?.event_date, { year, month }));
  const userIds = [...new Set(filteredRecords.map((record) => record.user_id))];
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabaseAdmin.from('profiles').select('id, display_name').in('id', userIds)
    : { data: [], error: null };

  if (profilesError) throw profilesError;

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const rowsByUser = new Map();

  for (const record of filteredRecords) {
    const row = rowsByUser.get(record.user_id) || {
      user_id: record.user_id,
      display_name: profilesById.get(record.user_id)?.display_name || 'BBX Player',
      total_points: 0,
      champion_count: 0,
      swiss_king_count: 0,
      finisher_count: 0,
      total_valid_wins: 0,
      approved_tournament_count: 0,
      most_recent_approved_tournament_date: null
    };

    row.total_points += record.total_points || 0;
    row.total_valid_wins += record.valid_wins || 0;
    row.approved_tournament_count += 1;
    if (record.final_placement === 1) row.champion_count += 1;
    if (record.final_placement === 2) row.finisher_count += 1;
    if (record.is_swiss_king) row.swiss_king_count += 1;

    const eventDate = record.tournaments?.event_date || null;
    if (!row.most_recent_approved_tournament_date || eventDate > row.most_recent_approved_tournament_date) {
      row.most_recent_approved_tournament_date = eventDate;
    }

    rowsByUser.set(record.user_id, row);
  }

  return [...rowsByUser.values()].sort((a, b) =>
    b.total_points - a.total_points
    || b.champion_count - a.champion_count
    || b.swiss_king_count - a.swiss_king_count
    || b.finisher_count - a.finisher_count
    || b.total_valid_wins - a.total_valid_wins
    || compareDatesDesc(a.most_recent_approved_tournament_date, b.most_recent_approved_tournament_date)
    || a.display_name.localeCompare(b.display_name)
  );
}

function matchesPeriod(eventDate, { year, month }) {
  const normalizedDate = String(eventDate || '');
  if (!normalizedDate) return false;
  if (year && !normalizedDate.startsWith(year)) return false;
  if (year && month && !normalizedDate.startsWith(`${year}-${month}`)) return false;
  return true;
}

function normalizeYear(value) {
  if (value == null || value === '') return null;
  const year = String(value).trim();
  if (!/^\d{4}$/.test(year)) {
    throw new AppError(400, 'invalid_leaderboard_year', 'Year must be a 4-digit value.');
  }
  return year;
}

function normalizeMonth(value) {
  if (value == null || value === '') return null;
  const month = String(value).trim().padStart(2, '0');
  if (!/^(0[1-9]|1[0-2])$/.test(month)) {
    throw new AppError(400, 'invalid_leaderboard_month', 'Month must be between 1 and 12.');
  }
  return month;
}

function compareDatesDesc(left, right) {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return rightTime - leftTime;
}

module.exports = router;
