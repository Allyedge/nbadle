const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function base62Encode(value) {
  if (value === 0) {
    return '0';
  }

  let result = '';
  let current = value;
  while (current > 0) {
    result = BASE62[current % 62] + result;
    current = Math.floor(current / 62);
  }
  return result;
}

export function base62Decode(value) {
  let result = 0;
  for (const char of value) {
    result = result * 62 + BASE62.indexOf(char);
  }
  return result;
}

export function getUrlState() {
  const params = new URLSearchParams(window.location.search);
  const playerParam = params.get('p');
  const difficultyParam = params.get('d');
  return {
    playerId: playerParam ? base62Decode(playerParam) : null,
    mode: params.get('m') === 'stats' ? 'stats' : 'classic',
    difficulty: difficultyParam === 'easy' || difficultyParam === 'hard' ? difficultyParam : null,
  };
}

export async function getDailySelection(playerCount, difficulty = 'hard') {
  const date = getUtcDateString();

  try {
    const response = await fetch(`/api/daily?count=${playerCount}&difficulty=${difficulty}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Daily endpoint returned ${response.status}`);
    }

    const payload = await response.json();
    if (!Number.isInteger(payload.player_index)) {
      throw new Error('Daily endpoint returned an invalid payload');
    }

    return {
      date: payload.date || date,
      playerIndex: payload.player_index,
      source: payload.source || 'edge',
      usedFallback: false,
    };
  } catch {
    return {
      date,
      playerIndex: localDailyIndex(playerCount, date, difficulty),
      source: 'local',
      usedFallback: true,
    };
  }
}

export function getUtcDateString() {
  return new Date().toISOString().slice(0, 10);
}

function localDailyIndex(count, date, difficulty = 'hard') {
  const hash = fnv1a(`nbadle:${difficulty}:${date}`);
  return hash % count;
}

function fnv1a(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}
