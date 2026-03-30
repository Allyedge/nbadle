const STORAGE_PREFIX = 'nbadle:v2:';
const RANDOM_DIFFICULTY_KEY = `${STORAGE_PREFIX}random-difficulty`;

export function getSessionStorageKey(challengeKey, mode) {
  return `${STORAGE_PREFIX}${challengeKey}:${mode}`;
}

export function loadSession(challengeKey, mode) {
  try {
    const raw = window.localStorage.getItem(getSessionStorageKey(challengeKey, mode));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(challengeKey, mode, session) {
  window.localStorage.setItem(getSessionStorageKey(challengeKey, mode), JSON.stringify(session));
}

export function clearSession(challengeKey, mode) {
  window.localStorage.removeItem(getSessionStorageKey(challengeKey, mode));
}

export function clearChallengeSessions(challengeKey) {
  clearSession(challengeKey, 'classic');
  clearSession(challengeKey, 'stats');
}

export function clearOtherDailySessions(activeChallengeKey, activeDate) {
  const activePrefix = getSessionStorageKey(activeChallengeKey, '').slice(0, -1);

  for (const key of Object.keys(window.localStorage)) {
    if (!key.startsWith(`${STORAGE_PREFIX}daily-`)) {
      continue;
    }
    if (key.startsWith(activePrefix)) {
      continue;
    }
    if (activeDate && key.includes(`-${activeDate}-`)) {
      continue;
    }
    window.localStorage.removeItem(key);
  }
}

export function loadRandomDifficulty() {
  try {
    return window.localStorage.getItem(RANDOM_DIFFICULTY_KEY);
  } catch {
    return null;
  }
}

export function saveRandomDifficulty(difficulty) {
  window.localStorage.setItem(RANDOM_DIFFICULTY_KEY, difficulty);
}
