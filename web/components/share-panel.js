import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

const EMOJI = {
  correct: '🟩',
  close:   '🟨',
  wrong:   '⬛',
  empty:   '⬜',
  hint:    '🟫',
};

const DIFFICULTY_EMOJI = {
  easy: '🟡',
  hard: '🔴',
};

export class SharePanel extends LitElement {
  static properties = {
    guesses:          { type: Array },
    won:              { type: Boolean },
    mode:             { type: String },
    difficulty:       { type: String },
    shareUrl:         { type: String },
    challengeDate:    { type: String },
    hintGuessIndex:   { type: Array },
    silhouettePeeked: { type: Boolean },
    _copied:          { type: Boolean, state: true },
  };

  static styles = css`
    :host {
      display: block;
    }

    .emoji-grid {
      font-size: 20px;
      line-height: 1.5;
      letter-spacing: 2px;
      font-family: 'Chakra Petch', monospace;
      color: #0f0024;
      margin-bottom: 14px;
      background: #ffffff;
      padding: 12px 16px;
      border-radius: 6px;
      border: 2px solid #0f0024;
      display: inline-block;
      min-width: 200px;
      text-align: center;
      white-space: pre;
    }

    .legend {
      margin-bottom: 12px;
      font-family: 'Chakra Petch', sans-serif;
      font-size: 12px;
      letter-spacing: 0.06em;
      color: #7a6a8a;
      text-transform: uppercase;
    }

    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
    }

    button {
      font-family: 'Chakra Petch', sans-serif;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      background: #DAA84F;
      color: #0f0024;
      border: 2px solid #0f0024;
      border-radius: 6px;
      padding: 11px 32px;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
    }

    button:hover {
      background: #c8963d;
    }

    button:active {
      transform: scale(0.97);
    }

    button.copied {
      background: #9DFF00;
      color: #0f0024;
      animation: bounce 0.25s ease;
    }

    @keyframes bounce {
      0%, 100% { transform: scale(1); }
      50%       { transform: scale(1.06); }
    }
  `;

  constructor() {
    super();
    this.guesses = [];
    this.won = false;
    this.mode = 'classic';
    this.difficulty = 'hard';
    this.shareUrl = window.location.href;
    this.challengeDate = '';
    this.hintGuessIndex = [];
    this.silhouettePeeked = false;
    this._copied = false;
  }

  _buildEmojiGrid() {
    if (!this.guesses.length) return '';

    const guessCount = this.won ? this.guesses.length : 'X';
    const diffEmoji = DIFFICULTY_EMOJI[this.difficulty] ?? DIFFICULTY_EMOJI.hard;
    const header = `NBAdle ${guessCount}/8 ${diffEmoji}`;

    const hintedRows = this._getHintRows();
    const rows = this.guesses.map((row, index) => {
      const symbols = row.map(cell => EMOJI[cell.state] ?? EMOJI.empty).join('');
      return hintedRows.includes(index + 1)
        ? `${EMOJI.hint}${symbols}${EMOJI.hint}`
        : `${EMOJI.empty}${symbols}${EMOJI.empty}`;
    });

    const meta = [];
    if (this.silhouettePeeked) meta.push('👤');
    if (hintedRows.length) meta.push('💡');

    const parts = [header];
    if (this.challengeDate) {
      parts.push(this.challengeDate);
    }
    if (meta.length) parts.push(meta.join(' '));
    parts.push(...rows);

    return parts.join('\n');
  }

  _getHintRows() {
    if (!Array.isArray(this.hintGuessIndex)) return [];
    return this.hintGuessIndex.map(index => index + 1);
  }

  _buildHintSummary() {
    const hintRows = this._getHintRows();
    if (!hintRows.length) {
      return '';
    }
    return `Hints used: ${hintRows.length} · Rows ${hintRows.join(', ')}`;
  }

  async _copyShare() {
    const text = this._buildEmojiGrid() + '\n\n' + this.shareUrl;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    this._copied = true;
    setTimeout(() => { this._copied = false; }, 2000);
  }

  render() {
    const grid = this._buildEmojiGrid();

    return html`
      ${this._buildHintSummary() ? html`<div class="legend">${this._buildHintSummary()}</div>` : ''}
      <div class="emoji-grid">${grid}</div>
      <div class="actions">
        <button
          class="${this._copied ? 'copied' : ''}"
          @click="${this._copyShare}"
        >${this._copied ? 'COPIED!' : 'SHARE'}</button>
      </div>
    `;
  }
}

customElements.define('share-panel', SharePanel);
