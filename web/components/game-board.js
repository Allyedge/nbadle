import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import './hint-cell.js';

const CLASSIC_HEADERS = ['Player', 'Team', 'Conf', 'Pos', 'Height', 'Age', 'Jersey', 'Draft', 'Country'];
const STATS_HEADERS   = ['Player', 'PPG', 'RPG', 'APG', 'FG%', '3P%', 'SPG', 'GP'];

export class GameBoard extends LitElement {
  static properties = {
    guesses:    { type: Array },
    mode:       { type: String, reflect: true },
    maxGuesses: { type: Number },
    _animating: { type: Boolean, state: true },
  };

  static styles = css`
    :host {
      display: block;
    }

    .headers.mode-classic,
    .row.mode-classic {
      grid-template-columns: clamp(72px, 22%, 160px) repeat(8, 1fr);
    }

    .headers.mode-stats,
    .row.mode-stats {
      grid-template-columns: clamp(72px, 22%, 160px) repeat(7, 1fr);
    }

    .headers {
      display: grid;
      gap: var(--cell-gap, 5px);
      margin-bottom: 6px;
      padding: 0 2px;
    }

    .col-header {
      font-family: var(--font-display, 'Chakra Petch', sans-serif);
      font-size: clamp(9px, 1.4vw, 12px);
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--text-dim, #7a6a8a);
      text-align: center;
      padding: 5px 2px;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .col-header:first-child {
      text-align: left;
      padding-left: 8px;
    }

    .headers.slide-out {
      animation: slide-out 0.15s ease-in forwards;
    }

    .headers.slide-in {
      animation: slide-in 0.20s ease-out forwards;
    }

    .grid {
      display: flex;
      flex-direction: column;
      gap: var(--cell-gap, 5px);
    }

    .row {
      display: grid;
      gap: var(--cell-gap, 5px);
      min-height: clamp(44px, 6vw, 56px);
    }

    .row.winning {
      animation: row-ripple 0.8s ease 0.5s;
    }

    .row.hinted {
      filter: drop-shadow(0 2px 8px rgba(218, 168, 79, 0.12));
    }

    .cell-name {
      display: flex;
      align-items: center;
      padding: 0 8px;
      background: var(--surface, #ffffff);
      border: 2px solid var(--border-dark, #b8a899);
      border-radius: var(--radius, 6px);
      font-family: var(--font-body, 'Chakra Petch', sans-serif);
      font-weight: 700;
      font-size: clamp(10px, 1.5vw, 13px);
      color: var(--dark, #0f0024);
      min-height: clamp(44px, 6vw, 56px);
      letter-spacing: 0.01em;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .cell-name.hinted {
      background: rgba(218, 168, 79, 0.14);
      border-color: var(--gold, #DAA84F);
      box-shadow: inset 0 0 0 1px rgba(218, 168, 79, 0.22);
    }

    .cell-name.empty {
      background: transparent;
      border: 2px dashed var(--border, #d6c9b8);
      color: transparent;
    }

    .empty-cell {
      background: transparent;
      border: 2px dashed var(--border, #d6c9b8);
      border-radius: var(--radius, 6px);
      min-height: clamp(44px, 6vw, 56px);
    }

    @keyframes slide-out {
      from { opacity: 1; transform: translateX(0); }
      to   { opacity: 0; transform: translateX(-20px); }
    }

    @keyframes slide-in {
      from { opacity: 0; transform: translateX(20px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    @keyframes row-ripple {
      0%   { box-shadow: 0 0 0 0 rgba(157,255,0,0.4); }
      50%  { box-shadow: 0 0 0 8px rgba(157,255,0,0); }
      100% { box-shadow: none; }
    }
  `;

  constructor() {
    super();
    this.guesses = [];
    this.mode = 'classic';
    this.maxGuesses = 8;
    this._animating = false;
  }

  get _colCount() {
    return this.mode === 'stats' ? 7 : 8;
  }

  get _headers() {
    return this.mode === 'stats' ? STATS_HEADERS : CLASSIC_HEADERS;
  }

  async addGuess(guessResult, isWin = false) {
    this._animating = true;
    this.guesses = [...this.guesses, { ...guessResult, _isNew: true, _isWin: isWin }];

    await this.updateComplete;

    const rowIndex = this.guesses.length - 1;
    const cells = this.shadowRoot.querySelectorAll(
      `.row:nth-child(${rowIndex + 1}) hint-cell`
    );

    const flipPromises = Array.from(cells).map((cell, i) => {
      return new Promise(resolve => {
        cell.delay = i * 90;
        cell.flip();
        setTimeout(resolve, i * 90 + 550);
      });
    });

    await Promise.all(flipPromises);

    if (isWin) {
      const row = this.shadowRoot.querySelector(`.row:nth-child(${rowIndex + 1})`);
      row?.classList.add('winning');
    }

    this._animating = false;

    this.guesses = this.guesses.map((g, i) =>
      i === rowIndex ? { ...g, _isNew: false } : g
    );
  }

  async switchMode(newMode) {
    if (newMode === this.mode) return;

    const headers = this.shadowRoot.querySelector('.headers');
    if (headers) {
      headers.classList.add('slide-out');
      await new Promise(r => setTimeout(r, 180));
      headers.classList.remove('slide-out');
    }

    this.mode = newMode;
    await this.updateComplete;

    const newHeaders = this.shadowRoot.querySelector('.headers');
    if (newHeaders) {
      newHeaders.classList.add('slide-in');
      setTimeout(() => newHeaders.classList.remove('slide-in'), 220);
    }
  }

  _renderEmptyRow(index) {
    const empties = Array.from({ length: this._colCount }, (_, i) => i);

    return html`
      <div class="row mode-${this.mode}" data-row="${index}">
        <div class="cell-name empty">— — —</div>
        ${empties.map(() => html`<div class="empty-cell"></div>`)}
      </div>
    `;
  }

  _renderGuessRow(guess, rowIndex) {
    const isWin = guess._isWin;
    return html`
      <div class="row mode-${this.mode} ${isWin ? 'winning' : ''} ${guess.isHint ? 'hinted' : ''}" data-row="${rowIndex}">
        <div class="cell-name ${guess.isHint ? 'hinted' : ''}">${guess.playerName}</div>
        ${guess.cells.map((cell, i) => html`
          <hint-cell
            state="${cell.state}"
            value="${cell.value}"
            arrow="${cell.arrow || ''}"
            delay="${i * 90}"
            ?hinted="${guess.isHint}"
            ?revealed="${!guess._isNew}"
          ></hint-cell>
        `)}
      </div>
    `;
  }

  render() {
    const rows = Array.from({ length: this.maxGuesses }, (_, i) => i);

    return html`
      <div class="headers mode-${this.mode}">
        ${this._headers.map(h => html`<div class="col-header">${h}</div>`)}
      </div>
      <div class="grid">
        ${rows.map(i =>
          i < this.guesses.length
            ? this._renderGuessRow(this.guesses[i], i)
            : this._renderEmptyRow(i)
        )}
      </div>
    `;
  }
}

customElements.define('game-board', GameBoard);
