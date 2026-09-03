import type { InputListener, InputSource } from './types';

/**
 * 키보드로 물리 입력을 흉내내는 소스 — 개발용이자 전시장 비상 조작 수단 (plan.md §7-3).
 *
 *   Shift+←/→   roll  ∓
 *   Shift+↑/↓   pitch ∓
 *   Shift+0     수평 복귀
 *   Shift+1~4   목업 1~4 가 감지→동작한 것처럼 trigger (브릿지 없이 아카이브 띄우기 테스트)
 */

const STEP = 0.06; // rad
const MAX = 0.45;

export class MockInput implements InputSource {
  private listeners: InputListener[] = [];
  private pitch = 0;
  private roll = 0;
  private handler = (e: KeyboardEvent) => {
    if (!e.shiftKey) return;
    const target = e.target as HTMLElement | null;
    if (target?.isContentEditable || target?.matches('input, textarea, select')) return;
    let hit = true;
    switch (e.code) {
      case 'ArrowUp': this.pitch = Math.max(-MAX, this.pitch - STEP); break;
      case 'ArrowDown': this.pitch = Math.min(MAX, this.pitch + STEP); break;
      case 'ArrowLeft': this.roll = Math.max(-MAX, this.roll - STEP); break;
      case 'ArrowRight': this.roll = Math.min(MAX, this.roll + STEP); break;
      case 'Digit0': this.pitch = 0; this.roll = 0; break;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': {
        e.preventDefault();
        const unit = Number(e.code.slice(-1));
        for (const cb of this.listeners) cb({ type: 'trigger', unit, action: 'mock', intensity: 0.8 });
        return;
      }
      default: hit = false;
    }
    if (hit) {
      e.preventDefault();
      for (const cb of this.listeners) cb({ type: 'tilt', pitch: this.pitch, roll: this.roll });
    }
  };

  connect() {
    window.addEventListener('keydown', this.handler);
  }

  disconnect() {
    window.removeEventListener('keydown', this.handler);
  }

  onEvent(cb: InputListener) {
    this.listeners.push(cb);
  }

  send() {
    /* no-op */
  }
}
