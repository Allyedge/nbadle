import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

export class GuessInput extends LitElement {
  static properties = {
    disabled:     { type: Boolean },
    placeholder:  { type: String },
    players:      { type: Array },
    _query:       { type: String, state: true },
    _suggestions: { type: Array, state: true },
    _highlighted: { type: Number, state: true },
  };

  static styles = css`
    :host {
      display: block;
      position: relative;
    }

    .input-wrap {
      position: relative;
      display: flex;
    }

    .icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.75rem;
      flex-shrink: 0;
      background: var(--dark, #0f0024);
      color: #fff;
      font-family: var(--font-display, 'Chakra Petch', sans-serif);
      font-size: 1.1rem;
      font-weight: 700;
      border: 2px solid var(--dark, #0f0024);
      border-right: none;
      border-radius: var(--radius, 6px) 0 0 var(--radius, 6px);
    }

    input {
      flex: 1;
      min-width: 0;
      background: var(--surface, #ffffff);
      border: 2px solid var(--dark, #0f0024);
      border-left: none;
      border-radius: 0 var(--radius, 6px) var(--radius, 6px) 0;
      color: var(--dark, #0f0024);
      font-family: var(--font-body, 'Chakra Petch', sans-serif);
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      padding: 0.75rem 1rem;
      outline: none;
      transition: border-color 0.15s;
      box-sizing: border-box;
    }

    input::placeholder {
      color: var(--text-muted, #b8a8c8);
      font-weight: 400;
    }

    input:focus {
      border-color: var(--gold, #DAA84F);
    }

    input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: var(--bg-dark, #f0e7d5);
    }

    .suggestions {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: var(--surface, #ffffff);
      border: 2px solid var(--dark, #0f0024);
      border-radius: var(--radius, 6px);
      max-height: 260px;
      overflow-y: auto;
      z-index: 100;
      scrollbar-width: thin;
      scrollbar-color: var(--border-dark, #d6c9b8) transparent;
    }

    .suggestion-item {
      padding: 0.625rem 1rem;
      font-family: var(--font-body, 'Chakra Petch', sans-serif);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      border-bottom: 1px solid var(--wrong-bg, #ece4d9);
      opacity: 0;
      -webkit-transform: translateY(-4px);
      transform: translateY(-4px);
      -webkit-animation: item-in 0.15s ease forwards;
      animation: item-in 0.15s ease forwards;
      color: var(--dark, #0f0024);
    }

    .suggestion-item:last-child {
      border-bottom: none;
    }

    .suggestion-item:hover,
    .suggestion-item.active {
      background: var(--bg, #F5ECDF);
    }

    .suggestion-item:nth-child(1) { -webkit-animation-delay: 0.02s; animation-delay: 0.02s; }
    .suggestion-item:nth-child(2) { -webkit-animation-delay: 0.04s; animation-delay: 0.04s; }
    .suggestion-item:nth-child(3) { -webkit-animation-delay: 0.06s; animation-delay: 0.06s; }
    .suggestion-item:nth-child(4) { -webkit-animation-delay: 0.08s; animation-delay: 0.08s; }
    .suggestion-item:nth-child(5) { -webkit-animation-delay: 0.10s; animation-delay: 0.10s; }
    .suggestion-item:nth-child(6) { -webkit-animation-delay: 0.12s; animation-delay: 0.12s; }
    .suggestion-item:nth-child(7) { -webkit-animation-delay: 0.14s; animation-delay: 0.14s; }
    .suggestion-item:nth-child(8) { -webkit-animation-delay: 0.16s; animation-delay: 0.16s; }

    @-webkit-keyframes item-in {
      from { opacity: 0; -webkit-transform: translateY(-4px); transform: translateY(-4px); }
      to   { opacity: 1; -webkit-transform: translateY(0);    transform: translateY(0); }
    }

    @keyframes item-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;

  constructor() {
    super();
    this.disabled = false;
    this.placeholder = 'Search for an NBA player...';
    this.players = [];
    this._query = '';
    this._baseQuery = '';
    this._suggestions = [];
    this._highlighted = -1;
  }

  _dispatchSelectionCleared() {
    this.dispatchEvent(new CustomEvent('player-cleared', {
      bubbles: true,
      composed: true,
    }));
  }

  _findExactMatch(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    return this.players.find(player => player.name.toLowerCase() === normalized) || null;
  }

  _onInput(e) {
    this._baseQuery = e.target.value;
    this._query = this._baseQuery;
    this._highlighted = -1;

    const exactMatch = this._findExactMatch(this._baseQuery);
    if (exactMatch) {
      this._selectPlayer(exactMatch);
      return;
    }

    this._dispatchSelectionCleared();

    if (this._baseQuery.trim().length < 2) {
      this._suggestions = [];
      return;
    }

    const q = this._baseQuery.toLowerCase();
    this._suggestions = this.players
      .filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }

  _onKeyDown(e) {
    if (!this._suggestions.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this._highlighted = Math.min(this._highlighted + 1, this._suggestions.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this._highlighted = Math.max(this._highlighted - 1, -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this._highlighted >= 0) {
        this._selectPlayer(this._suggestions[this._highlighted]);
      } else if (this._suggestions.length === 1) {
        this._selectPlayer(this._suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      this._highlighted = -1;
      this._suggestions = [];
    }
  }

  _onHover(index) {
    this._highlighted = index;
  }

  _selectPlayer(player) {
    this._baseQuery = player.name;
    this._query = player.name;
    this._suggestions = [];
    this._highlighted = -1;

    this.dispatchEvent(new CustomEvent('player-selected', {
      detail: { playerId: player.player_id, name: player.name },
      bubbles: true,
      composed: true,
    }));
  }

  _onBlur() {
    setTimeout(() => {
      this._highlighted = -1;
      this._suggestions = [];
      if (this._query !== this._baseQuery) {
        this._query = this._baseQuery;
      }
    }, 150);
  }

  focus() {
    this.shadowRoot?.querySelector('input')?.focus();
  }

  clear() {
    this._baseQuery = '';
    this._query = '';
    this._suggestions = [];
    this._highlighted = -1;
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="input-wrap">
        <div class="icon">?</div>
        <input
          type="text"
          .value="${this._query}"
          placeholder="${this.placeholder}"
          ?disabled="${this.disabled}"
          @input="${this._onInput}"
          @keydown="${this._onKeyDown}"
          @blur="${this._onBlur}"
          autocomplete="off"
          spellcheck="false"
        />
        ${this._suggestions.length ? html`
          <div class="suggestions">
            ${this._suggestions.map((p, i) => html`
              <div
                class="suggestion-item ${i === this._highlighted ? 'active' : ''}"
                @mousedown="${() => this._selectPlayer(p)}"
                @mouseover="${() => this._onHover(i)}"
              >
                ${p.name}
              </div>
            `)}
          </div>
        ` : ''}
      </div>
    `;
  }
}

customElements.define('guess-input', GuessInput);
