const cheerio = require('cheerio');

async function fetchGroupStandings(slug) {
  try {
    const response = await fetch(`https://challonge.com/${encodeURIComponent(slug)}/standings`);
    if (!response.ok) return null;

    return parseGroupStandingsHtml(await response.text());
  } catch (_error) {
    return null;
  }
}

function parseGroupStandingsHtml(html) {
  const $ = cheerio.load(html);

  for (const table of $('table').toArray()) {
    const headers = $(table)
      .find('th')
      .toArray()
      .map((cell) => normalizeHeader($(cell).text()));

    if (!isStandingsTable(headers)) {
      continue;
    }

    const rows = $(table)
      .find('tbody tr')
      .toArray()
      .map((row) => parseStandingsRow($, row, headers))
      .filter(Boolean);

    if (rows.length > 0) return rows;
  }

  return null;
}

function parseStandingsRow($, row, headers) {
  const cells = $(row).find('td').toArray();
  if (cells.length === 0) return null;

  const data = {};
  headers.forEach((header, index) => {
    data[header] = cells[index] ? collapseWhitespace($(cells[index]).text()) : null;
  });

  const participantText = data.participant || '';
  const participantName = participantText.replace(/^advanced\s+/i, '').trim();
  const [wins, losses, ties] = parseRecord(data['match w-l-t'] || '');
  const historyIndex = headers.indexOf('match history');

  return {
    rank: toInt(data.rank),
    participantName,
    qualifiedForTopCut: /advanced/i.test(participantText),
    wins,
    losses,
    ties,
    score: toFloat(data.score),
    tb: toInt(data.tb),
    pts: toInt(data.pts),
    buchholz: toFloat(data.buchholz),
    pointsDiff: toInt(data['pts diff']),
    matchHistory: historyIndex >= 0 ? parseMatchHistory($(cells[historyIndex]).text()) : []
  };
}

function isStandingsTable(headers) {
  return headers.includes('rank')
    && headers.includes('participant')
    && headers.includes('score')
    && (headers.includes('pts') || headers.includes('tb') || headers.includes('buchholz'));
}

function normalizeHeader(header) {
  let value = collapseWhitespace(header).toLowerCase();
  value = value.replace(/^\d+\.\s*/, '').replace(/[()]/g, '');

  if (value.includes('participant')) return 'participant';
  if (value.includes('match w-l-t')) return 'match w-l-t';
  if (value.includes('match history')) return 'match history';
  if (value.includes('pts diff')) return 'pts diff';
  if (value.includes('buchholz')) return 'buchholz';
  if (value === 'pts') return 'pts';
  if (value === 'tb') return 'tb';
  if (value === 'score') return 'score';
  if (value === 'rank') return 'rank';

  return value;
}

function parseRecord(record) {
  const match = String(record).match(/(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/);
  if (!match) return [0, 0, 0];

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function parseMatchHistory(history) {
  return String(history).match(/[WLT]/gi)?.map((item) => item.toUpperCase()) || [];
}

function toInt(value) {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replace(/[^0-9-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function toFloat(value) {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function collapseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

module.exports = {
  fetchGroupStandings,
  parseGroupStandingsHtml
};
