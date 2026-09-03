import type { InputListener, InputSource } from './types';

/**
 * 브릿지 입력 소스.
 * 실패 대응이 본체다 (plan.md §7-4):
 *  - 브릿지 미실행 → 3초마다 조용히 재연결. 화면은 정상 동작
 *  - 알 수 없는 메시지 → 무시
 *  - 절대 모달·에러 화면을 띄우지 않는다
 *
 * 주소 결정 순서 (전시장에서 브릿지가 다른 컴퓨터에 있어도 빌드를 다시 하지 않도록):
 *  1. URL 쿼리  ?bridge=192.168.4.100:7777   (한 번 넣으면 localStorage 에 기억)
 *  2. localStorage 'ensil-bridge'
 *  3. 빌드 환경변수 VITE_BRIDGE_URL
 *  4. 사이트를 서빙한 호스트의 7777 — 브릿지가 사이트도 같이 서빙하는 기본 구성이면 이걸로 끝
 */

const RECONNECT_MS = 3000;
const STORAGE_KEY = 'ensil-bridge';

export function resolveBridgeUrl(): string {
  const fromQuery = new URLSearchParams(window.location.search).get('bridge');
  if (fromQuery) {
    try { localStorage.setItem(STORAGE_KEY, fromQuery); } catch { /* 저장 불가 — 이번 세션만 */ }
  }
  let stored: string | null = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* 접근 불가 */ }
  const raw = fromQuery ?? stored ?? (import.meta.env.VITE_BRIDGE_URL as string | undefined);
  if (raw) return /^wss?:\/\//.test(raw) ? raw : `ws://${raw}`;
  const host = window.location.hostname || 'localhost';
  return `ws://${host}:7777`;
}

export class WsInput implements InputSource {
  private ws: WebSocket | null = null;
  private listeners: InputListener[] = [];
  private stateListeners: ((connected: boolean) => void)[] = [];
  private timer: number | null = null;
  private disposed = false;

  constructor(private url: string = resolveBridgeUrl()) {}

  connect() {
    if (this.disposed) return;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.retry();
      return;
    }
    this.ws.onopen = () => this.emitState(true);
    this.ws.onclose = () => {
      this.emitState(false);
      this.retry();
    };
    this.ws.onerror = () => this.ws?.close();
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (typeof msg?.type === 'string') {
          for (const cb of this.listeners) cb(msg);
        }
      } catch {
        /* JSON 아닌 메시지 무시 */
      }
    };
  }

  private retry() {
    if (this.disposed || this.timer !== null) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.connect();
    }, RECONNECT_MS);
  }

  disconnect() {
    this.disposed = true;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.ws?.close();
    this.ws = null;
  }

  onEvent(cb: InputListener) {
    this.listeners.push(cb);
  }

  onState(cb: (connected: boolean) => void) {
    this.stateListeners.push(cb);
  }

  private emitState(connected: boolean) {
    for (const cb of this.stateListeners) cb(connected);
  }

  send(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
