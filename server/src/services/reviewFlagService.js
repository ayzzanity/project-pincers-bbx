function flag(flagType, message, context = {}, severity = 'medium') {
  return {
    flag_type: flagType,
    message,
    context,
    severity,
    status: 'open'
  };
}

function flagsForPreview(preview) {
  const flags = [];

  if (preview.hasSeparateTopCut) {
    flags.push(flag(
      'separate_top_cut_overrides_main',
      'A separate Top Cut source was supplied and should override any built-in Top Cut data in the main source.',
      { mainChallongeTournamentId: preview.main.challongeTournamentId, topCutChallongeTournamentId: preview.topCut?.challongeTournamentId },
      'low'
    ));
  }

  if (preview.swissRecord?.source === 'challonge_two_stage_group_stage_unavailable') {
    flags.push(flag(
      'challonge_group_stage_unavailable',
      'Challonge returned this as a built-in two-stage tournament, but the API response did not include group-stage match history or Swiss/group wins. Admin review is required before approving Swiss win and Swiss King points.',
      {
        mainChallongeTournamentId: preview.main.challongeTournamentId,
        participantId: preview.selectedParticipant.challongeParticipantId,
        participantName: preview.selectedParticipant.name
      },
      'high'
    ));
  }

  if (preview.swissKingStatus === 'unclear') {
    flags.push(flag('unclear_swiss_king', 'Swiss King could not be confidently determined from Challonge data.', {}, 'high'));
  }

  for (const item of preview.matchSummaries) {
    if (item.needsReview) {
      flags.push(flag(
        `${item.result}_match`,
        `Match ${item.challongeMatchId} needs admin review because it was classified as ${item.result}.`,
        item,
        item.result === 'unknown' ? 'high' : 'medium'
      ));
    }
  }

  return flags;
}

module.exports = {
  flag,
  flagsForPreview
};
