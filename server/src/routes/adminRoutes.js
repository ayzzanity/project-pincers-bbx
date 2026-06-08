const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const { supabaseAdmin } = require('../lib/supabase');
const { AppError } = require('../utils/errors');

const router = express.Router();

const decisionSchema = z.object({
  status: z.enum(['approved', 'rejected'])
});

router.use(requireAuth);

router.get('/review-flags', async (_req, res, next) => {
  try {
    await assertAdmin(_req.user.id);

    const { data, error } = await supabaseAdmin
      .from('review_flags')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get('/pending-records', async (req, res, next) => {
  try {
    await assertAdmin(req.user.id);

    const { data: records, error } = await supabaseAdmin
      .from('player_tournament_records')
      .select(
        'id, tournament_id, user_id, player_name, status, swiss_wins, top_cut_entry, is_swiss_king, final_placement, total_points, valid_wins, created_at'
      )
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const tournamentIds = [...new Set(records.map((record) => record.tournament_id))];
    const userIds = [...new Set(records.map((record) => record.user_id))];
    const recordIds = records.map((record) => record.id);

    const [tournamentsResult, profilesResult, flagsResult, sourcesResult] = await Promise.all([
      tournamentIds.length
        ? supabaseAdmin
            .from('tournaments')
            .select('id, name, event_date, status')
            .in('id', tournamentIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? supabaseAdmin.from('profiles').select('id, display_name').in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
      recordIds.length
        ? supabaseAdmin.from('review_flags').select('id, player_record_id, severity, flag_type, message').eq('status', 'open').in('player_record_id', recordIds)
        : Promise.resolve({ data: [], error: null }),
      tournamentIds.length
        ? supabaseAdmin
            .from('tournament_sources')
            .select('id, tournament_id, source_type, challonge_url, is_authoritative_top_cut')
            .in('tournament_id', tournamentIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (tournamentsResult.error) throw tournamentsResult.error;
    if (profilesResult.error) throw profilesResult.error;
    if (flagsResult.error) throw flagsResult.error;
    if (sourcesResult.error) throw sourcesResult.error;

    const tournamentsById = new Map(tournamentsResult.data.map((tournament) => [tournament.id, tournament]));
    const profilesById = new Map(profilesResult.data.map((profile) => [profile.id, profile]));
    const flagsByRecordId = flagsResult.data.reduce((acc, flag) => {
      const flags = acc.get(flag.player_record_id) || [];
      flags.push(flag);
      acc.set(flag.player_record_id, flags);
      return acc;
    }, new Map());
    const sourcesByTournamentId = sourcesResult.data.reduce((acc, source) => {
      const sources = acc.get(source.tournament_id) || [];
      sources.push(source);
      acc.set(source.tournament_id, sources);
      return acc;
    }, new Map());

    res.json({
      data: records.map((record) => ({
        ...record,
        tournament: tournamentsById.get(record.tournament_id) || null,
        tournament_sources: sourcesByTournamentId.get(record.tournament_id) || [],
        submitted_by_profile: profilesById.get(record.user_id) || null,
        review_flags: flagsByRecordId.get(record.id) || []
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/records/:recordId/decision', async (req, res, next) => {
  try {
    await assertAdmin(req.user.id);
    const input = decisionSchema.parse(req.body);
    const approved = input.status === 'approved';

    if (!approved) {
      const { data: deletedRecord, error: deleteError } = await supabaseAdmin
        .from('player_tournament_records')
        .delete()
        .eq('id', req.params.recordId)
        .eq('status', 'pending_review')
        .select()
        .maybeSingle();

      if (deleteError) throw deleteError;
      if (!deletedRecord) {
        throw new AppError(404, 'pending_record_not_found', 'This pending tournament record was not found.');
      }

      return res.json({
        data: {
          id: deletedRecord.id,
          status: 'rejected',
          deleted: true
        }
      });
    }

    const approvedAt = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('player_tournament_records')
      .update({
        status: 'approved',
        approved_by: req.user.id,
        approved_at: approvedAt,
        locked_at: approvedAt
      })
      .eq('id', req.params.recordId)
      .eq('status', 'pending_review')
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new AppError(404, 'pending_record_not_found', 'This pending tournament record was not found.');
    }

    const { error: tournamentError } = await supabaseAdmin
      .from('tournaments')
      .update({
        status: 'approved',
        approved_by: req.user.id,
        approved_at: approvedAt,
        locked_at: approvedAt
      })
      .eq('id', data.tournament_id);

    if (tournamentError) throw tournamentError;

    const { error: flagsError } = await supabaseAdmin
      .from('review_flags')
      .update({
        status: 'resolved',
        resolved_by: req.user.id,
        resolved_at: approvedAt
      })
      .eq('player_record_id', data.id)
      .eq('status', 'open');

    if (flagsError) throw flagsError;

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

async function assertAdmin(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) throw error;
  if (data.role !== 'admin') {
    throw new AppError(403, 'admin_required', 'Admin access is required.');
  }
}

module.exports = router;
