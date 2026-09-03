import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActCommand, PhysicalEvent, Tilt, UnitRef } from './types';
import { WsInput } from './WsInput';
import { MockInput } from './MockInput';

export interface InputBinding {
  /** 물리 슬롯 번호 → 표본 선택 */
  onSelectSlot?: (slot: number) => void;
  onStep?: (dir: 1 | -1) => void;
  onRelease?: () => void;
  /** 목업이 감지→동작했음 */
  onTrigger?: (e: Extract<PhysicalEvent, { type: 'trigger' }>) => void;
}

/**
 * 물리 입력 훅 — WsInput(브릿지)과 MockInput(키보드)을 동시에 연결한다.
 * tilt는 리렌더 없이 ref로 흐른다 (30Hz — React 상태로 쓰면 프레임마다 리렌더).
 * 접속 중인 목업 목록(units)과 목업 동작 명령(act)도 여기서.
 */
export function useInput(binding: InputBinding = {}, enabled = true) {
  const [connected, setConnected] = useState(false);
  const [units, setUnits] = useState<UnitRef[]>([]);
  const tiltRef = useRef<Tilt>({ pitch: 0, roll: 0 });
  const wsRef = useRef<WsInput | null>(null);
  const bindingRef = useRef(binding);
  bindingRef.current = binding;

  useEffect(() => {
    if (!enabled) return undefined;
    const handle = (e: PhysicalEvent) => {
      switch (e.type) {
        case 'tilt':
          tiltRef.current.pitch = e.pitch;
          tiltRef.current.roll = e.roll;
          break;
        case 'select':
          bindingRef.current.onSelectSlot?.(e.slot);
          break;
        case 'step':
          bindingRef.current.onStep?.(e.dir);
          break;
        case 'release':
          bindingRef.current.onRelease?.();
          break;
        case 'trigger':
          bindingRef.current.onTrigger?.(e);
          break;
        case 'units':
          setUnits(e.units.map((item) => item.unit));
          break;
        // sensor는 수신만 해두고 소비처가 생기면 연결 (plan.md §8-3)
      }
    };

    const ws = new WsInput();
    wsRef.current = ws;
    ws.onEvent(handle);
    ws.onState((state) => {
      setConnected(state);
      if (!state) setUnits([]);
    });
    ws.connect();

    const mock = new MockInput();
    mock.onEvent(handle);
    mock.connect();

    return () => {
      ws.disconnect();
      mock.disconnect();
      wsRef.current = null;
    };
  }, [enabled]);

  /** 웹 → 목업 동작 명령 */
  const act = useCallback((unit: UnitRef, action: string, intensity = 1) => {
    wsRef.current?.send({ type: 'act', unit, action, intensity } satisfies ActCommand);
  }, []);

  return { connected, units, tiltRef, act };
}
