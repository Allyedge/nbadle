import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

export class HintCell extends LitElement {
  static properties = {
    state:    { type: String, reflect: true },
    value:    { type: String },
    arrow:    { type: String },
    delay:    { type: Number },
    hinted:   { type: Boolean, reflect: true },
    revealed: { type: Boolean },
    _flipped: { type: Boolean, state: true },
  };

  static styles = css`
    :host {
      display: block;
      position: relative;
      min-height: clamp(44px, 6vw, 56px);
      -webkit-perspective: 500px;
      perspective: 500px;
    }

    .inner {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: clamp(44px, 6vw, 56px);
      -webkit-transform-style: preserve-3d;
      transform-style: preserve-3d;
      transition: transform 0.45s cubic-bezier(0.23, 1, 0.32, 1);
    }

    :host([flipped]) .inner,
    .inner.flipped {
      -webkit-transform: rotateX(180deg);
      transform: rotateX(180deg);
    }

    .face {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
      border-radius: var(--radius, 6px);
      text-align: center;
      padding: 5px 3px;
    }

    .front {
      background: transparent;
      border: 2px dashed var(--border, #d6c9b8);
    }

    .back {
      -webkit-transform: rotateX(180deg);
      transform: rotateX(180deg);
      font-family: var(--font-body, 'Chakra Petch', sans-serif);
      font-size: clamp(9px, 1.3vw, 12px);
      font-weight: 700;
      line-height: 1.3;
      word-break: break-word;
      border: 2px solid transparent;
    }

    .back.correct {
      background: var(--correct-bg, rgba(157, 255, 0, 0.15));
      border-color: var(--correct, #9DFF00);
      color: #3a6000;
    }

    :host([hinted]) .back.correct,
    :host([hinted]) .back.close,
    :host([hinted]) .back.wrong {
      box-shadow: inset 0 0 0 1px rgba(218, 168, 79, 0.22);
    }

    :host([hinted]) .back.wrong {
      border-color: var(--gold, #DAA84F);
      background: rgba(218, 168, 79, 0.08);
      color: var(--dark, #0f0024);
    }

    .back.close {
      background: var(--close-bg, rgba(255, 170, 0, 0.15));
      border-color: var(--close, #ffaa00);
      color: #7a4800;
    }

    .back.wrong {
      background: var(--wrong-bg, #ece4d9);
      border-color: var(--wrong, #d6c9b8);
      color: var(--text-dim, #7a6a8a);
    }

    .back.empty {
      background: transparent;
      border: 2px dashed var(--border, #d6c9b8);
      color: transparent;
    }

    .arrow {
      font-size: 10px;
      opacity: 0.8;
      display: block;
      margin-top: 1px;
    }
  `;

  constructor() {
    super();
    this.state = 'empty';
    this.value = '';
    this.arrow = '';
    this.delay = 0;
    this.hinted = false;
    this.revealed = false;
    this._flipped = false;
  }

  flip() {
    if (this._flipped) return;
    setTimeout(() => {
      this._flipped = true;
    }, this.delay);
  }

  render() {
    const arrowChar = this.arrow === 'up' ? '▲' : this.arrow === 'down' ? '▼' : '';

    return html`
      <div class="inner ${(this._flipped || this.revealed) ? 'flipped' : ''}">
        <div class="face front"></div>
        <div class="face back ${this.state}">
          ${this.value}
          ${arrowChar ? html`<span class="arrow">${arrowChar}</span>` : ''}
        </div>
      </div>
    `;
  }
}

customElements.define('hint-cell', HintCell);
