import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

export class ModeSwitcher extends LitElement {
  static properties = {
    mode:     { type: String, reflect: true },
    disabled: { type: Boolean },
  };

  static styles = css`
    :host {
      display: flex;
      justify-content: center;
    }

    .switcher {
      display: flex;
    }

    button {
      font-family: var(--font-display, 'Chakra Petch', sans-serif);
      font-size: clamp(13px, 1.8vw, 15px);
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-dim, #7a6a8a);
      background: var(--surface, #ffffff);
      border: 2px solid var(--dark, #0f0024);
      padding: 0.6em 1.6em;
      cursor: pointer;
      transition: color 0.15s, background 0.15s, border-color 0.15s;
      white-space: nowrap;
    }

    button:first-child {
      border-radius: var(--radius, 6px) 0 0 var(--radius, 6px);
      border-right: none;
    }

    button:last-child {
      border-radius: 0 var(--radius, 6px) var(--radius, 6px) 0;
    }

    button.active {
      color: var(--dark, #0f0024);
      background: var(--gold, #DAA84F);
      border-color: var(--dark, #0f0024);
    }

    button:hover:not(.active):not(:disabled) {
      color: var(--dark, #0f0024);
      background: var(--bg, #F5ECDF);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  constructor() {
    super();
    this.mode = 'classic';
    this.disabled = false;
  }

  _select(mode) {
    if (this.disabled || mode === this.mode) return;
    this.mode = mode;
    this.dispatchEvent(new CustomEvent('mode-changed', {
      detail: { mode },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
      <div class="switcher">
        <button
          class="${this.mode === 'classic' ? 'active' : ''}"
          ?disabled="${this.disabled}"
          @click="${() => this._select('classic')}"
        >Classic</button>
        <button
          class="${this.mode === 'stats' ? 'active' : ''}"
          ?disabled="${this.disabled}"
          @click="${() => this._select('stats')}"
        >Stats</button>
      </div>
    `;
  }
}

customElements.define('mode-switcher', ModeSwitcher);
