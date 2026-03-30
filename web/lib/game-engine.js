export const MAX_GUESSES = 8;

const CONFERENCE_MAP = {
  ATL: 'East', BOS: 'East', BKN: 'East', CHA: 'East', CHI: 'East', CLE: 'East', DET: 'East', IND: 'East', MIA: 'East', MIL: 'East', NYK: 'East', ORL: 'East', PHI: 'East', TOR: 'East', WAS: 'East',
  DAL: 'West', DEN: 'West', GSW: 'West', HOU: 'West', LAC: 'West', LAL: 'West', MEM: 'West', MIN: 'West', NOP: 'West', OKC: 'West', PHX: 'West', POR: 'West', SAC: 'West', SAS: 'West', UTA: 'West',
};

export function getConference(teamAbbr) {
  return CONFERENCE_MAP[teamAbbr] || 'Unknown';
}

export function compareClassicPlayers(candidate, target) {
  return [
    compareTeam(candidate, target),
    {
      state: candidate.conference === target.conference ? 'correct' : 'wrong',
      value: candidate.conference || '',
    },
    comparePosition(candidate, target),
    compareNumeric(candidate.height_inches, target.height_inches, 2, candidate.height_display || '?'),
    compareNumeric(candidate.age, target.age, 2, String(candidate.age ?? '?')),
    compareNumeric(candidate.jersey_number, target.jersey_number, 5, String(candidate.jersey_number || '?')),
    compareDraft(candidate, target),
    compareCountry(candidate, target),
  ];
}

export function compareStatsPlayers(candidate, target) {
  return [
    compareNumeric(candidate.stats?.ppg, target.stats?.ppg, 3, formatDecimal(candidate.stats?.ppg)),
    compareNumeric(candidate.stats?.rpg, target.stats?.rpg, 2, formatDecimal(candidate.stats?.rpg)),
    compareNumeric(candidate.stats?.apg, target.stats?.apg, 2, formatDecimal(candidate.stats?.apg)),
    compareNumeric(candidate.stats?.fg_pct, target.stats?.fg_pct, 5, formatPercent(candidate.stats?.fg_pct)),
    compareNumeric(candidate.stats?.fg3_pct, target.stats?.fg3_pct, 5, formatPercent(candidate.stats?.fg3_pct)),
    compareNumeric(candidate.stats?.spg, target.stats?.spg, 0.5, formatDecimal(candidate.stats?.spg)),
    compareNumeric(candidate.stats?.gp, target.stats?.gp, 10, String(Math.round(candidate.stats?.gp || 0))),
  ];
}

export function getColumnCount(mode) {
  return mode === 'stats' ? 7 : 8;
}

export function getSolvedColumns({ guessedIds, playersById, targetPlayer, mode }) {
  const solved = Array(getColumnCount(mode)).fill(false);

  for (const guessedId of guessedIds) {
    const player = playersById.get(guessedId);
    if (!player) {
      continue;
    }

    const row = buildGuessRow({ guessPlayer: player, targetPlayer, mode });
    row.cells.forEach((cell, index) => {
      if (cell.state === 'correct') {
        solved[index] = true;
      }
    });
  }

  return solved;
}

function compareNumeric(candidateValue, targetValue, threshold, label) {
  const candidateNumber = Number(candidateValue);
  const targetNumber = Number(targetValue);
  if (!Number.isFinite(candidateNumber) || !Number.isFinite(targetNumber)) {
    return { state: 'wrong', value: label };
  }
  if (candidateNumber === targetNumber) {
    return { state: 'correct', value: label };
  }
  return {
    state: Math.abs(candidateNumber - targetNumber) <= threshold ? 'close' : 'wrong',
    value: label,
    arrow: candidateNumber < targetNumber ? 'up' : 'down',
  };
}

function formatDecimal(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : '?';
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(1)}%` : '?';
}

export function createHintCandidate({ targetPlayer, players, guessedIds, playersById, mode }) {
  const solvedColumns = getSolvedColumns({
    guessedIds: Array.from(guessedIds),
    playersById,
    targetPlayer,
    mode,
  });
  const unsolvedColumns = solvedColumns
    .map((solved, index) => (solved ? null : index))
    .filter(index => index !== null);

  if (!unsolvedColumns.length) {
    return { status: 'close' };
  }

  let bestCandidate = null;

  for (const player of players) {
    if (isUnavailableHintPlayer(player, targetPlayer, guessedIds)) {
      continue;
    }

    const candidate = buildHintMatchCandidate(player, targetPlayer, mode, unsolvedColumns);
    if (!candidate) {
      continue;
    }

    if (!bestCandidate || candidate.matchingColumns.length < bestCandidate.matchingColumns.length) {
      bestCandidate = candidate;
    }

    if (candidate.matchingColumns.length === 1) {
      break;
    }
  }

  return bestCandidate || { status: 'close' };
}

function compareTeam(candidate, target) {
  if (candidate.team === target.team) {
    return { state: 'correct', value: candidate.team || '' };
  }
  if (candidate.conference === target.conference) {
    return { state: 'close', value: candidate.team || '' };
  }
  return { state: 'wrong', value: candidate.team || '' };
}

function comparePosition(candidate, target) {
  if (candidate.position === target.position) {
    return { state: 'correct', value: candidate.position || '' };
  }

  const candidateParts = new Set((candidate.position || '').split('-').filter(Boolean));
  const targetParts = new Set((target.position || '').split('-').filter(Boolean));
  const overlaps = [...candidateParts].some(part => targetParts.has(part));
  return { state: overlaps ? 'close' : 'wrong', value: candidate.position || '' };
}

function compareDraft(candidate, target) {
  const candidateDraft = candidate.draft_year || 'N/A';
  const targetDraft = target.draft_year || 'N/A';
  const candidateUndrafted = candidateDraft === 'N/A' || candidateDraft === '';
  const targetUndrafted = targetDraft === 'N/A' || targetDraft === '';

  if (candidateUndrafted && targetUndrafted) {
    return { state: 'correct', value: 'N/A' };
  }

  return compareNumeric(candidateDraft, targetDraft, 2, String(candidateDraft || 'N/A'));
}

function compareCountry(candidate, target) {
  if (candidate.country === target.country) {
    return { state: 'correct', value: candidate.country || '' };
  }
  if (candidate.continent && candidate.continent === target.continent) {
    return { state: 'close', value: candidate.country || '' };
  }
  return { state: 'wrong', value: candidate.country || '' };
}

function isUnavailableHintPlayer(player, targetPlayer, guessedIds) {
  return player.player_id === targetPlayer.player_id || guessedIds.has(player.player_id);
}

function buildHintMatchCandidate(player, targetPlayer, mode, unsolvedColumns) {
  const row = buildGuessRow({ guessPlayer: player, targetPlayer, mode });
  const matchingColumns = unsolvedColumns.filter(index => row.cells[index]?.state === 'correct');

  if (!matchingColumns.length) {
    return null;
  }

  return {
    status: 'ok',
    player_id: player.player_id,
    name: player.name,
    matchingColumns,
  };
}

export function buildGuessRow({ guessPlayer, targetPlayer, mode }) {
  return {
    playerId: guessPlayer.player_id,
    playerName: guessPlayer.name,
    cells: mode === 'stats'
      ? compareStatsPlayers(guessPlayer, targetPlayer)
      : compareClassicPlayers(guessPlayer, targetPlayer),
  };
}

export function createSession({ challengeKey, targetPlayerId, mode }) {
  return {
    challengeKey,
    targetPlayerId,
    mode,
    guessedIds: [],
    gameOver: false,
    won: false,
    hintGuessIndices: [],
    silhouettePeeked: false,
  };
}

export function applyGuess({ session, guessPlayer, targetPlayer }) {
  if (session.gameOver) {
    return null;
  }

  const alreadyGuessed = session.guessedIds.includes(guessPlayer.player_id);
  if (alreadyGuessed) {
    return { duplicate: true };
  }

  session.guessedIds = [...session.guessedIds, guessPlayer.player_id];
  const correct = guessPlayer.player_id === targetPlayer.player_id;
  const gameOver = correct || session.guessedIds.length >= MAX_GUESSES;

  session.gameOver = gameOver;
  session.won = correct;

  const row = buildGuessRow({
    guessPlayer,
    targetPlayer,
    mode: session.mode,
  });

  return {
    ...row,
    correct,
    game_over: gameOver,
    guesses_used: session.guessedIds.length,
    target_name: gameOver ? targetPlayer.name : undefined,
    target_player_id: gameOver ? targetPlayer.player_id : undefined,
  };
}
