const EASY_POOL_RATIO = 0.4;

const STAT_WEIGHTS = {
  ppg: 0.4,
  rpg: 0.16,
  apg: 0.16,
  spg: 0.08,
  gp: 0.12,
  fg_pct: 0.04,
  fg3_pct: 0.04,
};

export const DEFAULT_RANDOM_DIFFICULTY = 'easy';

export function normalizeDifficulty(value, fallback = DEFAULT_RANDOM_DIFFICULTY) {
  return value === 'hard' || value === 'easy' ? value : fallback;
}

export function getDifficultyPool(pools, difficulty) {
  return pools[normalizeDifficulty(difficulty, DEFAULT_RANDOM_DIFFICULTY)] || [];
}

export function createDifficultyPools(players) {
  if (!Array.isArray(players) || players.length <= 1) {
    return {
      easy: Array.isArray(players) ? [...players] : [],
      hard: [],
    };
  }

  const percentileMaps = Object.fromEntries(
    Object.keys(STAT_WEIGHTS).map(stat => [stat, buildPercentileMap(players, player => Number(player.stats?.[stat]) || 0)]),
  );

  const rankedPlayers = players
    .map((player, index) => ({
      player,
      index,
      score: scorePlayer(player, percentileMaps),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.index - right.index;
    });

  const easyCount = clamp(Math.round(players.length * EASY_POOL_RATIO), 1, players.length - 1);
  const easyIds = new Set(rankedPlayers.slice(0, easyCount).map(entry => entry.player.player_id));

  return players.reduce((pools, player) => {
    if (easyIds.has(player.player_id)) {
      pools.easy.push(player);
    } else {
      pools.hard.push(player);
    }
    return pools;
  }, { easy: [], hard: [] });
}

function scorePlayer(player, percentileMaps) {
  return Object.entries(STAT_WEIGHTS).reduce((score, [stat, weight]) => {
    return score + ((percentileMaps[stat].get(player.player_id) || 0) * weight);
  }, 0);
}

function buildPercentileMap(players, selector) {
  const ranked = players
    .map(player => ({
      playerId: player.player_id,
      value: selector(player),
    }))
    .sort((left, right) => left.value - right.value || left.playerId - right.playerId);

  const denominator = Math.max(ranked.length - 1, 1);
  const percentiles = new Map();

  for (let start = 0; start < ranked.length; ) {
    let end = start;
    while (end + 1 < ranked.length && ranked[end + 1].value === ranked[start].value) {
      end += 1;
    }

    const percentile = ((start + end) / 2) / denominator;
    for (let index = start; index <= end; index += 1) {
      percentiles.set(ranked[index].playerId, percentile);
    }

    start = end + 1;
  }

  return percentiles;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
