const env = require('../config/env');
const { AppError } = require('../utils/errors');

function parseChallongeIdentifier(input) {
  if (!input) {
    throw new AppError(400, 'challonge_link_required', 'A Challonge tournament link is required.');
  }

  try {
    const url = new URL(input);
    const slug = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean).pop();
    if (!slug) {
      throw new Error('Missing slug');
    }

    if (url.hostname.endsWith('challonge.com') && url.hostname !== 'challonge.com') {
      const subdomain = url.hostname.replace('.challonge.com', '');
      return `${subdomain}-${slug}`;
    }

    return slug;
  } catch (_error) {
    return String(input).trim();
  }
}

async function fetchTournament(input) {
  const identifier = parseChallongeIdentifier(input);
  const v21 = await fetchTournamentV21(identifier, input);
  if (v21) return v21;

  return fetchTournamentV1(identifier, input);
}

async function fetchTournamentV1(identifier, input) {
  const [tournamentBody, participantsBody, matchesBody] = await Promise.all([
    requestV1(`/tournaments/${encodeURIComponent(identifier)}.json`),
    requestV1(`/tournaments/${encodeURIComponent(identifier)}/participants.json`),
    requestV1(`/tournaments/${encodeURIComponent(identifier)}/matches.json`)
  ]);

  if (!tournamentBody.tournament) {
    throw new AppError(502, 'challonge_unexpected_response', 'Challonge returned an unexpected tournament response.');
  }

  return normalizeTournamentV1(
    {
      ...tournamentBody.tournament,
      participants: Array.isArray(participantsBody) ? participantsBody : [],
      matches: Array.isArray(matchesBody) ? matchesBody : []
    },
    input,
    identifier
  );
}

async function requestV1(path) {
  const url = new URL(`${env.challongeApiBaseUrl}${path}`);
  url.searchParams.set('api_key', env.challongeApiKey);

  const response = await fetch(url);
  const text = await response.text();

  if (!response.ok) {
    throw new AppError(response.status, 'challonge_import_failed', 'Challonge import failed.', {
      path,
      response: text.slice(0, 500)
    });
  }

  return JSON.parse(text);
}

async function fetchTournamentV21(identifier, input) {
  try {
    const tournament = await requestV21(`/tournaments/${encodeURIComponent(identifier)}.json`);
    const tournamentId = tournament.data?.id || identifier;
    const participants = await requestV21(`/tournaments/${encodeURIComponent(tournamentId)}/participants.json`);
    const matches = await requestV21(`/tournaments/${encodeURIComponent(tournamentId)}/matches.json`);

    return normalizeTournamentV21(
      {
        tournament: tournament.data,
        participants: participants.data || [],
        matches: matches.data || []
      },
      input,
      identifier
    );
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      throw error;
    }

    return null;
  }
}

async function requestV21(path, query = {}) {
  const url = new URL(`${env.challongeApiV21BaseUrl}${path}`);

  if (env.challongeCommunityId) {
    url.searchParams.set('community_id', env.challongeCommunityId);
  }

  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/vnd.api+json',
      'Authorization-Type': 'v1',
      Authorization: env.challongeApiKey
    }
  });
  const text = await response.text();

  if (!response.ok) {
    throw new AppError(response.status, 'challonge_v21_import_failed', 'Challonge v2.1 import failed.', {
      path,
      response: text.slice(0, 500)
    });
  }

  return JSON.parse(text);
}

function normalizeTournamentV1(tournament, sourceUrl, identifier) {
  return {
    id: tournament.id,
    name: tournament.name,
    url: sourceUrl,
    slug: identifier,
    tournamentType: tournament.tournament_type,
    startedAt: tournament.start_at || tournament.started_at || tournament.created_at,
    completedAt: tournament.completed_at,
    participants: (tournament.participants || []).map((item) => item.participant || item),
    matches: (tournament.matches || []).map((item) => item.match || item),
    raw: tournament
  };
}

function normalizeTournamentV21(payload, sourceUrl, identifier) {
  const attributes = payload.tournament.attributes || {};

  return {
    id: Number(payload.tournament.id),
    name: attributes.name,
    url: sourceUrl,
    slug: attributes.url || identifier,
    tournamentType: attributes.tournament_type,
    startedAt:
      attributes.start_at ||
      attributes.started_at ||
      attributes.starts_at ||
      attributes.created_at ||
      attributes.timestamps?.start_at ||
      attributes.timestamps?.started_at,
    completedAt: attributes.completed_at || attributes.timestamps?.completed_at,
    participants: payload.participants.map(normalizeParticipantV21),
    matches: payload.matches.map(normalizeMatchV21),
    apiVersion: 'v2.1',
    raw: {
      ...attributes,
      id: Number(payload.tournament.id),
      participants: payload.participants,
      matches: payload.matches
    }
  };
}

function normalizeParticipantV21(participant) {
  const attributes = participant.attributes || {};

  return {
    id: Number(participant.id),
    tournament_id: Number(attributes.tournament_id),
    name: attributes.name,
    seed: attributes.seed,
    final_rank: attributes.final_rank,
    group_id: attributes.group_id,
    username: attributes.username,
    misc: attributes.misc,
    active: attributes.states?.active,
    raw: participant
  };
}

function normalizeMatchV21(match) {
  const attributes = match.attributes || {};
  const playerOneId = Number(attributes.relationships?.player1?.data?.id);
  const playerTwoId = Number(attributes.relationships?.player2?.data?.id);

  return {
    id: Number(match.id),
    state: attributes.state,
    round: attributes.round,
    identifier: attributes.identifier,
    player1_id: Number.isFinite(playerOneId) ? playerOneId : null,
    player2_id: Number.isFinite(playerTwoId) ? playerTwoId : null,
    winner_id: attributes.winner_id == null ? null : Number(attributes.winner_id),
    scores_csv: attributes.scores || '',
    score_in_sets: attributes.score_in_sets || [],
    points_by_participant: attributes.points_by_participant || [],
    group_id: attributes.group_id || null,
    completed_at: attributes.timestamps?.completed_at,
    raw: match
  };
}

module.exports = {
  fetchTournament,
  parseChallongeIdentifier
};
