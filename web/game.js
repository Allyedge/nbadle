import { UI } from './strings.js';
import { base62Encode, getDailySelection, getUrlState } from './lib/daily.js';
import { DEFAULT_RANDOM_DIFFICULTY, createDifficultyPools, getDifficultyPool, normalizeDifficulty } from './lib/difficulty.js';
import { applyGuess, buildGuessRow, createHintCandidate, createSession, MAX_GUESSES } from './lib/game-engine.js';
import { clearChallengeSessions, clearOtherDailySessions, clearSession, loadRandomDifficulty, loadSession, saveRandomDifficulty, saveSession } from './lib/storage.js';

function launchConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);

  const colors = ['#9DFF00', '#DAA84F', '#0f0024', '#ffffff', '#ffaa00', '#c4943a'];
  for (let index = 0; index < 60; index += 1) {
    const particle = document.createElement('div');
    particle.className = 'confetti-particle';
    particle.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${-10 - Math.random() * 20}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      width: ${6 + Math.random() * 6}px;
      height: ${6 + Math.random() * 6}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '1px'};
      animation-delay: ${Math.random() * 0.8}s;
      animation-duration: ${1.5 + Math.random() * 1.5}s;
    `;
    container.appendChild(particle);
  }

  setTimeout(() => container.remove(), 4000);
}

function showToast(message, duration = 2200) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), duration);
}

class NBAdle {
  constructor() {
    this.mode = 'classic';
    this.guesses = [];
    this.allPlayers = [];
    this.difficultyPools = { easy: [], hard: [] };
    this.playersById = new Map();
    this.challengeKey = null;
    this.challengeDate = null;
    this.session = null;
    this.targetPlayer = null;
    this.targetPlayerId = null;
    this.targetPlayerName = null;
    this.headshotUrl = null;
    this.hintGuessIndex = [];
    this.silhouettePeeked = false;
    this._pendingGuess = null;
    this._shareUrl = null;
    this._urlPlayerId = null;
    this.randomDifficulty = DEFAULT_RANDOM_DIFFICULTY;

    this.boardEl = document.querySelector('game-board');
    this.inputEl = document.querySelector('guess-input');
    this.modeSwitcherEl = document.querySelector('mode-switcher');
    this.submitBtn = document.getElementById('btn-submit');
    this.hintBtn = document.getElementById('btn-hint');
    this.randomBtn = document.getElementById('btn-random');
    this.difficultyNavEl = document.getElementById('difficulty-nav');
    this.revealBtn = document.getElementById('btn-reveal');
    this.resultEl = document.getElementById('result-panel');
    this.guessCounterEl = document.getElementById('guess-counter');
  }

  async init() {
    this._setLoading(true);

    const { playerId: urlPlayerId, mode, difficulty: urlDifficulty } = getUrlState();
    this._urlPlayerId = urlPlayerId;
    this.mode = mode;
    if (urlDifficulty && !urlPlayerId) {
      this.randomDifficulty = urlDifficulty;
      saveRandomDifficulty(urlDifficulty);
    } else {
      this.randomDifficulty = normalizeDifficulty(loadRandomDifficulty(), DEFAULT_RANDOM_DIFFICULTY);
    }
    this.modeSwitcherEl.mode = mode;
    this.boardEl.mode = mode;
    this._syncNavDifficulty();

    try {
      await this._loadPlayers();
      await this._loadChallenge();
      this._hydrateSession();
      this._hydrateBoard();
    } catch (error) {
      console.error(error);
      showToast(UI.toastFailedPlayers, 4200);
      this._setLoading(false);
      return;
    }

    document.addEventListener('player-selected', event => this._onPlayerSelected(event));
    document.addEventListener('player-cleared', () => this._onPlayerCleared());
    this.submitBtn?.addEventListener('click', () => this._submitCurrentSelection());
    document.addEventListener('mode-changed', event => this._onModeChanged(event));
    this.hintBtn?.addEventListener('click', () => this._useHint());
    this.randomBtn?.addEventListener('click', () => this._goRandom());
    this.difficultyNavEl?.addEventListener('click', event => {
      const btn = event.target.closest('.difficulty-nav-btn');
      if (btn && !btn.disabled) {
        this._onNavDifficultyChanged(btn.dataset.difficulty);
      }
    });
    this.revealBtn?.addEventListener('click', () => this._onRevealClick());
    document.addEventListener('keydown', event => this._onGlobalKey(event));

    this._setLoading(false);
    this._setSilhouette(this.headshotUrl);
    this._updateCounter(this.session?.won ? 'correct' : null);
    this._updateHintBtn();
    setTimeout(() => this.inputEl?.focus(), 100);
  }

  async _loadPlayers() {
    const response = await fetch('./data/players.json');
    if (!response.ok) {
      throw new Error(`Failed to load players.json (${response.status})`);
    }

    const payload = await response.json();
    this.allPlayers = payload.players;
    this.difficultyPools = createDifficultyPools(this.allPlayers);
    this.playersById = new Map(payload.players.map(player => [player.player_id, player]));
    this.inputEl.players = this.allPlayers;
  }

  async _loadChallenge() {
    let targetPlayerId = this._urlPlayerId;

    if (!targetPlayerId) {
      const dailyPool = this._getTargetPool(this.randomDifficulty);
      const daily = await getDailySelection(dailyPool.length, this.randomDifficulty);
      const target = dailyPool[daily.playerIndex];
      targetPlayerId = target?.player_id;
      this.challengeDate = daily.date;
    }

    const targetPlayer = this.playersById.get(targetPlayerId);
    if (!targetPlayer) {
      throw new Error(`Unknown target player: ${targetPlayerId}`);
    }

    this.targetPlayer = targetPlayer;
    this.targetPlayerId = targetPlayer.player_id;
    this.headshotUrl = targetPlayer.headshot_url;
    this.challengeKey = this._urlPlayerId
      ? `custom-${targetPlayer.player_id}`
      : `daily-${this.randomDifficulty}-${this.challengeDate || 'local'}-${targetPlayer.player_id}`;

    if (!this._urlPlayerId) {
      clearOtherDailySessions(this.challengeKey, this.challengeDate);
    }
  }

  _hydrateSession() {
    const existing = loadSession(this.challengeKey, this.mode);
    this.session = this._getValidatedSession(existing);

    this.guesses = [];
    this.hintGuessIndex = Array.isArray(this.session.hintGuessIndices)
      ? this.session.hintGuessIndices
      : [];
    this.silhouettePeeked = this.session.silhouettePeeked;
    this.targetPlayerName = this.session.gameOver ? this.targetPlayer.name : null;

    this.guesses = this._buildStoredGuessStates();
  }

  async _hydrateBoard() {
    this.boardEl.guesses = this._buildBoardRows();

    if (this.session.gameOver) {
      this.targetPlayerName = this.targetPlayer.name;
      this._shareUrl = this._urlPlayerId
        ? this._buildShareUrl(this.targetPlayerId, this.mode)
        : this._buildDailyShareUrl();
      this._revealHeadshot();
      this._showResult(this.session.won, this.targetPlayer.name);
      this._showContinueSection();
      this.inputEl.disabled = true;
      this.submitBtn.disabled = true;
    }
  }

  _setLoading(on) {
    if (this.inputEl) {
      this.inputEl.disabled = on;
      this.inputEl.placeholder = on ? UI.placeholderLoading : UI.placeholderSearch;
    }
    if (this.modeSwitcherEl) {
      this.modeSwitcherEl.disabled = on;
    }
    if (this.submitBtn) {
      this.submitBtn.disabled = true;
    }
    if (this.hintBtn) {
      this.hintBtn.disabled = on;
    }
    if (this.difficultyNavEl) {
      this.difficultyNavEl.querySelectorAll('.difficulty-nav-btn').forEach(btn => {
        btn.disabled = on;
      });
    }
  }

  _setSilhouette(headshotUrl) {
    const wrap = document.getElementById('player-mystery');
    const image = document.getElementById('player-img');
    if (!wrap || !image || !headshotUrl) {
      return;
    }

    image.classList.add('hidden');
    const probe = new Image();
    probe.onload = () => {
      image.style.backgroundImage = `url('${headshotUrl}')`;
      image.classList.add('loaded');
    };
    probe.onerror = () => {
      wrap.hidden = true;
    };
    probe.src = headshotUrl;
    wrap.hidden = false;
    this.revealBtn.hidden = false;

    if (this.session?.gameOver) {
      image.classList.remove('silhouette', 'hidden');
      this.revealBtn.hidden = true;
    } else if (this.silhouettePeeked) {
      image.classList.remove('hidden');
      this.revealBtn.hidden = true;
    }
  }

  _onRevealClick() {
    const image = document.getElementById('player-img');
    image?.classList.remove('hidden');
    if (this.revealBtn) {
      this.revealBtn.hidden = true;
    }
    this.silhouettePeeked = true;
    if (this.session) {
      this.session.silhouettePeeked = true;
      saveSession(this.challengeKey, this.mode, this.session);
    }
  }

  _revealHeadshot() {
    const image = document.getElementById('player-img');
    image?.classList.remove('silhouette', 'hidden');
    if (this.revealBtn) {
      this.revealBtn.hidden = true;
    }
  }

  _onGlobalKey(event) {
    if (this.session?.gameOver) {
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey && this._pendingGuess) {
      event.preventDefault();
      this._submitCurrentSelection();
      return;
    }

    if (event.key === 'Escape') {
      this._clearSelection();
      return;
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const input = this.inputEl?.shadowRoot?.querySelector('input');
      if (input && document.activeElement !== input) {
        input.focus();
      }
    }
  }

  _clearSelection() {
    this._setPendingGuess(null);
    this.inputEl?.clear();
  }

  _setPendingGuess(guess) {
    this._pendingGuess = guess;
    if (!this.submitBtn) {
      return;
    }

    if (guess) {
      this.submitBtn.textContent = UI.btnGuessSelected(guess.name);
      this.submitBtn.disabled = false;
      return;
    }

    this.submitBtn.textContent = UI.btnGuessIdle;
    this.submitBtn.disabled = true;
  }

  _onPlayerCleared() {
    if (this.session?.gameOver) {
      return;
    }

    this._setPendingGuess(null);
  }

  _onPlayerSelected({ detail: { playerId, name } }) {
    if (this.session?.gameOver) {
      return;
    }
    if (this.session?.guessedIds.includes(playerId)) {
      this._setPendingGuess(null);
      showToast(UI.toastAlreadyGuessed);
      return;
    }
    this._setPendingGuess({ playerId, name });
  }

  async _submitCurrentSelection() {
    if (!this._pendingGuess || this.session?.gameOver) {
      return;
    }

    const { playerId, name } = this._pendingGuess;
    this._setPendingGuess(null);
    this.inputEl?.clear();
    await this._processGuess(playerId, name);
  }

  async _processGuess(playerId, playerName) {
    const player = this.playersById.get(playerId);
    if (!player) {
      showToast(UI.toastFailedGuess, 3000);
      return;
    }

    this.inputEl.disabled = true;
    const result = applyGuess({ session: this.session, guessPlayer: player, targetPlayer: this.targetPlayer });

    if (result?.duplicate) {
      showToast(UI.toastAlreadyGuessed);
      this.inputEl.disabled = false;
      return;
    }

    if (!result) {
      this.inputEl.disabled = false;
      return;
    }

    await this._applyGuessResult(result, playerName);

    if (!result.game_over) {
      this.inputEl.disabled = false;
      this.inputEl.focus();
      return;
    }

    this._finishGame(result, playerName);
  }

  _buildShareUrl(playerId, mode) {
    const encoded = base62Encode(playerId);
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('p', encoded);
    if (mode !== 'classic') {
      url.searchParams.set('m', mode);
    }
    return url.toString();
  }

  _buildDailyShareUrl() {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('d', this.randomDifficulty);
    return url.toString();
  }

  _teamIsCovered() {
    return this.guesses.some(row => row[0]?.state === 'correct');
  }

  async _useHint() {
    if (this.session?.gameOver || this.guesses.length >= MAX_GUESSES - 1) {
      return;
    }

    const hint = createHintCandidate({
      targetPlayer: this.targetPlayer,
      players: this.allPlayers,
      guessedIds: new Set(this.session.guessedIds),
      playersById: this.playersById,
      mode: this.mode,
    });

    if (!hint || hint.status === 'close') {
      showToast(UI.toastHintClose, 2500);
      return;
    }

    if (hint.status !== 'ok') {
      showToast(UI.toastHintNoTeammates, 2500);
      return;
    }

    this.hintGuessIndex = [...this.hintGuessIndex, this.guesses.length];
    this.session.hintGuessIndices = [...this.hintGuessIndex];
    saveSession(this.challengeKey, this.mode, this.session);
    await this._processGuess(hint.player_id, hint.name);
  }

  _updateHintBtn() {
    if (!this.hintBtn) {
      return;
    }

    const canHint = !this.session?.gameOver && this.guesses.length < MAX_GUESSES - 1;
    this.hintBtn.disabled = !canHint;

    if (this.session?.gameOver || this.guesses.length >= MAX_GUESSES - 1) {
      this.hintBtn.textContent = UI.btnHintGameOver;
      this.hintBtn.title = UI.titleGameOver;
    } else {
      this.hintBtn.textContent = UI.btnHintAvailable;
      this.hintBtn.title = '';
    }
  }

  _handleWin(playerName) {
    this.inputEl.disabled = true;
    this.submitBtn.disabled = true;
    this._updateHintBtn();

    setTimeout(() => {
      this._revealHeadshot();
      launchConfetti();
      this._showResult(true, playerName);
      this._showContinueSection();
    }, 600);
  }

  _handleLoss() {
    this.inputEl.disabled = true;
    this.submitBtn.disabled = true;
    this._updateHintBtn();

    const title = document.querySelector('.title-scoreboard');
    title?.classList.add('flicker');
    setTimeout(() => {
      title?.classList.remove('flicker');
      this._revealHeadshot();
      this._showResult(false, this.targetPlayerName || '?');
      this._showContinueSection();
    }, 700);
  }

  _showResult(won, playerName) {
    if (!this.resultEl) {
      return;
    }

    const headline = won ? UI.resultWinHeadline : UI.resultLoseHeadline;
    const sub = won ? UI.resultWinSub(this.guesses.length) : UI.resultLoseSub;
    const diffLabel = this.randomDifficulty === 'easy' ? UI.difficultyEasyLabel : UI.difficultyHardLabel;

    this.resultEl.innerHTML = `
      <div class="result-headline">${headline}</div>
      <div class="result-player-name">${playerName}</div>
      <div class="result-sub">${sub}</div>
      <div class="difficulty-badge difficulty-badge--${this.randomDifficulty}">${diffLabel}</div>
      <share-panel id="share-panel"></share-panel>
    `;
    this.resultEl.className = `result-panel ${won ? 'win' : 'lose'}`;
    this.resultEl.style.display = 'block';

    const sharePanel = this.resultEl.querySelector('share-panel');
    if (sharePanel) {
      sharePanel.guesses = this.guesses;
      sharePanel.won = won;
      sharePanel.mode = this.mode;
      sharePanel.difficulty = this.randomDifficulty;
      sharePanel.shareUrl = this._shareUrl || window.location.href;
      sharePanel.challengeDate = this._urlPlayerId ? '' : (this.challengeDate || '');
      sharePanel.hintGuessIndex = this.hintGuessIndex;
      sharePanel.silhouettePeeked = this.silhouettePeeked;
    }
  }

  _showContinueSection() {
    const section = document.getElementById('continue-section');
    if (!section) {
      return;
    }

    const next = this._pickRandomPlayer({
      difficulty: this.randomDifficulty,
      excludedPlayerId: this.targetPlayerId,
    });
    const button = document.getElementById('btn-continue');
    if (button && next) {
      button.href = this._buildShareUrl(next.player_id, this.mode);
    }
    section.style.display = 'block';
  }

  _buildStoredGuessStates() {
    return this.session.guessedIds
      .map(guessedId => this.playersById.get(guessedId))
      .filter(Boolean)
      .map(player => buildGuessRow({ guessPlayer: player, targetPlayer: this.targetPlayer, mode: this.mode }))
      .map(row => row.cells.map(cell => ({ state: cell.state })));
  }

  _getValidatedSession(existing) {
    if (!existing) {
      return createSession({
        challengeKey: this.challengeKey,
        targetPlayerId: this.targetPlayerId,
        mode: this.mode,
      });
    }

    if (existing.targetPlayerId !== this.targetPlayerId) {
      clearSession(this.challengeKey, this.mode);
      return createSession({
        challengeKey: this.challengeKey,
        targetPlayerId: this.targetPlayerId,
        mode: this.mode,
      });
    }

    return existing;
  }

  _buildBoardRows() {
    return this.session.guessedIds
      .map(guessedId => this.playersById.get(guessedId))
      .filter(Boolean)
      .map((player, guessIndex) => {
        const row = buildGuessRow({ guessPlayer: player, targetPlayer: this.targetPlayer, mode: this.mode });
        return {
          playerName: player.name,
          cells: row.cells,
          isHint: this.hintGuessIndex.includes(guessIndex),
        };
      });
  }

  async _applyGuessResult(result, playerName) {
    saveSession(this.challengeKey, this.mode, this.session);

    const guessIndex = this.guesses.length;
    const guessRow = {
      playerName,
      cells: result.cells,
      isHint: this.hintGuessIndex.includes(guessIndex),
    };

    this.guesses.push(result.cells.map(cell => ({ state: cell.state })));
    await this.boardEl.addGuess(guessRow, result.correct);
    this._updateCounter(result.correct ? 'correct' : null);
    this._updateHintBtn();
  }

  _finishGame(result, playerName) {
    this.targetPlayerName = result.target_name;
    this.targetPlayerId = result.target_player_id;
    this._shareUrl = this._urlPlayerId
      ? this._buildShareUrl(result.target_player_id, this.mode)
      : this._buildDailyShareUrl();

    if (result.correct) {
      this._handleWin(playerName);
      return;
    }

    this._handleLoss();
  }

  _onNavDifficultyChanged(difficulty) {
    const next = normalizeDifficulty(difficulty, this.randomDifficulty);
    if (next === this.randomDifficulty) return;

    this.randomDifficulty = next;
    saveRandomDifficulty(next);
    this._syncNavDifficulty();
    this._animateHeaderPing();

    if (!this._urlPlayerId) {
      window.location.reload();
    } else {
      this._goRandom();
    }
  }

  _syncNavDifficulty() {
    document.documentElement.setAttribute('data-difficulty', this.randomDifficulty);

    if (!this.difficultyNavEl) return;
    this.difficultyNavEl.querySelectorAll('.difficulty-nav-btn').forEach(btn => {
      const isActive = btn.dataset.difficulty === this.randomDifficulty;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  _animateHeaderPing() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    header.classList.remove('difficulty-ping');
    void header.offsetWidth;
    header.classList.add('difficulty-ping');
    setTimeout(() => header.classList.remove('difficulty-ping'), 450);
  }

  async _onModeChanged({ detail: { mode } }) {
    if (mode === this.mode) return;

    const prevGuessedIds = this.session?.guessedIds ?? [];
    const prevHintGuessIndices = this.session?.hintGuessIndices ?? [];
    const prevSilhouettePeeked = this.session?.silhouettePeeked ?? false;

    const won = prevGuessedIds.includes(this.targetPlayerId);
    const gameOver = won || prevGuessedIds.length >= MAX_GUESSES;

    this.mode = mode;

    this.session = {
      ...createSession({ challengeKey: this.challengeKey, targetPlayerId: this.targetPlayerId, mode }),
      guessedIds: [...prevGuessedIds],
      hintGuessIndices: [...prevHintGuessIndices],
      silhouettePeeked: prevSilhouettePeeked,
      gameOver,
      won,
    };
    saveSession(this.challengeKey, mode, this.session);

    this.hintGuessIndex = [...prevHintGuessIndices];
    this.silhouettePeeked = prevSilhouettePeeked;
    this.guesses = this._buildStoredGuessStates();
    this.targetPlayerName = gameOver ? this.targetPlayer.name : null;

    await this.boardEl.switchMode(mode);
    this.boardEl.guesses = this._buildBoardRows();

    this._clearSelection();
    this._updateCounter(won ? 'correct' : null);
    this._updateHintBtn();

    if (gameOver) {
      this.targetPlayerName = this.targetPlayer.name;
      this._shareUrl = this._urlPlayerId
        ? this._buildShareUrl(this.targetPlayerId, mode)
        : this._buildDailyShareUrl();
      this._revealHeadshot();
      this._showResult(won, this.targetPlayer.name);
      this._showContinueSection();
      this.inputEl.disabled = true;
      this.submitBtn.disabled = true;
    } else {
      if (this.resultEl) {
        this.resultEl.style.display = 'none';
        this.resultEl.innerHTML = '';
      }
      this.inputEl.disabled = false;
      this.inputEl.focus();
    }
  }

  _goRandom() {
    if (this.challengeKey && this.challengeKey.startsWith('custom-')) {
      clearChallengeSessions(this.challengeKey);
    }

    const player = this._pickRandomPlayer({
      difficulty: this.randomDifficulty,
      excludedPlayerId: this.targetPlayerId,
    });
    if (!player) {
      return;
    }

    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('p', base62Encode(player.player_id));
    if (this.mode !== 'classic') {
      url.searchParams.set('m', this.mode);
    }
    window.location.href = url.toString();
  }

  _getTargetPool(difficulty) {
    const pool = getDifficultyPool(this.difficultyPools, difficulty);
    return pool.length ? pool : this.allPlayers;
  }

  _pickRandomPlayer({ difficulty, excludedPlayerId = null } = {}) {
    const pool = this._getTargetPool(difficulty)
      .filter(player => player.player_id !== excludedPlayerId);
    if (pool.length) {
      return pool[Math.floor(Math.random() * pool.length)];
    }

    const fallbackPool = this.allPlayers.filter(player => player.player_id !== excludedPlayerId);
    if (!fallbackPool.length) {
      return null;
    }

    return fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
  }

  _updateCounter(finalState = null) {
    if (!this.guessCounterEl) {
      return;
    }

    const pips = Array.from(this.guessCounterEl.querySelectorAll('.guess-pip'));
    const used = this.guesses.length;
    pips.forEach((pip, index) => {
      pip.className = 'guess-pip';
      if (index < used) {
        if (finalState === 'correct' && index === used - 1) {
          pip.classList.add('correct');
        } else if (finalState === null && index === used - 1 && this.guesses.length >= MAX_GUESSES) {
          pip.classList.add('wrong-final');
        } else {
          pip.classList.add('used');
        }
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new NBAdle();
  game.init();
});
