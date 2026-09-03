/**
 * 물리 입력 추상화 (plan.md §7-3).
 * 하드웨어(WsInput)든 키보드(MockInput)든 같은 이벤트를 낸다 —
 * 상위 코드는 입력이 어디서 왔는지 모른다.
 */

/** 목업 식별 — 슬롯 번호(1~4) 또는 개체 id('eo-002'). 매핑은 input/units.ts */
export type UnitRef = number | string;

export type PhysicalEvent =
  | { type: 'tilt'; pitch: number; roll: number } // 라디안, 수평 = 0,0
  | { type: 'select'; slot: number }
  | { type: 'release'; slot: number }
  | { type: 'step'; dir: 1 | -1 }
  | { type: 'sensor'; channel: string; value: number }
  /** 목업이 스스로 감지→동작했음. 웹은 해당 개체 아카이브를 띄운다 */
  | { type: 'trigger'; unit?: UnitRef; action: string; intensity?: number }
  /** 브릿지가 알려주는 접속 중인 목업 목록 */
  | { type: 'units'; units: Array<{ unit: UnitRef; name?: string }> };

/** 웹 → 목업 동작 명령 (브릿지가 해당 목업으로 중계) */
export type ActCommand = { type: 'act'; unit: UnitRef; action: string; intensity?: number };

export interface Tilt {
  pitch: number;
  roll: number;
}

export type InputListener = (e: PhysicalEvent) => void;

export interface InputSource {
  connect(): void;
  disconnect(): void;
  onEvent(cb: InputListener): void;
  /** 하드웨어로 피드백 전송 (없으면 no-op) */
  send(msg: unknown): void;
}
