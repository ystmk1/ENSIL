import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreatureRecord } from '../data/creatureRecords';
import { useInput } from '../input/useInput';
import { resolveUnit, unitSlot } from '../input/units';
import { useFieldLink } from './fieldLink';

/**
 * 목업 trigger → 아이맥 화면 반응 (docs/EXHIBITION_SETUP.md §6).
 *
 *  - 관람객이 조작 중(포인터/키 입력 후 ACTIVE_MS 이내)이면 화면을 뺏지 않고 신호 칩만 띄운 뒤,
 *    조작이 멈추면 그때 그 개체의 아카이브(#/creature/:id)로 이동
 *  - 유휴 상태면 즉시 이동
 *  - trigger 로 이동한 뒤 RETURN_MS 동안 아무 조작이 없으면 랜딩(#/)으로 복귀
 *  - 같은 목업의 연속 trigger 는 COOLDOWN_MS 안에서 한 번만 (PIR 재감지 등)
 *  - 스테이지(빔프)가 떠 있으면 같은 개체에 pulse 도 흘린다
 */

const ACTIVE_MS = 6_000;
const RETURN_MS = 90_000;
const COOLDOWN_MS = 8_000;
const CHIP_MS = 3_200;

export type HardwareSignal = { record: CreatureRecord; at: number; pending: boolean };

/** @param enabled 콘솔(아이맥 메인 창)에서만 true. 스테이지 창은 브릿지에 붙지 않는다 */
export function useHardwareLink(enabled = true) {
  const [signal, setSignal] = useState<HardwareSignal | null>(null);
  const lastActivityRef = useRef(performance.now());
  const lastTriggerRef = useRef<Record<string, number>>({});
  const pendingRef = useRef<CreatureRecord | null>(null);
  const navigatedAtRef = useRef(0);
  const { send: sendField } = useFieldLink('panel', undefined, enabled);

  const goToRecord = useCallback((record: CreatureRecord) => {
    pendingRef.current = null;
    navigatedAtRef.current = performance.now();
    window.location.hash = `/creature/${record.id}`;
    setSignal((current) => (current ? { ...current, pending: false } : current));
  }, []);

  const { connected, units, act } = useInput({
    onTrigger: (event) => {
      const record = resolveUnit(event.unit);
      if (!record) return;
      const now = performance.now();
      if (now - (lastTriggerRef.current[record.id] ?? -Infinity) < COOLDOWN_MS) return;
      lastTriggerRef.current[record.id] = now;

      sendField({ type: 'pulse', id: record.id, strength: Math.min(2, Math.max(0.3, event.intensity ?? 1)) });

      const busy = now - lastActivityRef.current < ACTIVE_MS;
      const alreadyThere = window.location.hash === `#/creature/${record.id}`;
      setSignal({ record, at: now, pending: busy && !alreadyThere });
      if (alreadyThere) {
        navigatedAtRef.current = now;
        return;
      }
      if (busy) pendingRef.current = record;
      else goToRecord(record);
    },
  }, enabled);

  // 관람객 조작 감지 — 마지막 입력 시각만 기록 (리렌더 없음)
  useEffect(() => {
    const mark = () => { lastActivityRef.current = performance.now(); };
    const options = { passive: true } as const;
    window.addEventListener('pointermove', mark, options);
    window.addEventListener('pointerdown', mark, options);
    window.addEventListener('wheel', mark, options);
    window.addEventListener('keydown', mark, options);
    return () => {
      window.removeEventListener('pointermove', mark);
      window.removeEventListener('pointerdown', mark);
      window.removeEventListener('wheel', mark);
      window.removeEventListener('keydown', mark);
    };
  }, []);

  // 보류된 이동 실행 + 유휴 복귀 + 칩 소거
  useEffect(() => {
    const tick = window.setInterval(() => {
      const now = performance.now();
      const idle = now - lastActivityRef.current;
      if (pendingRef.current && idle >= ACTIVE_MS) goToRecord(pendingRef.current);
      if (navigatedAtRef.current && idle >= RETURN_MS && now - navigatedAtRef.current >= RETURN_MS) {
        navigatedAtRef.current = 0;
        if (window.location.hash.startsWith('#/creature/')) window.location.hash = '/';
      }
      setSignal((current) => (current && !current.pending && now - current.at > CHIP_MS ? null : current));
    }, 500);
    return () => window.clearInterval(tick);
  }, [goToRecord]);

  /** 웹 → 목업: 해당 개체의 목업을 동작시킨다 */
  const actUnit = useCallback((record: CreatureRecord, action = 'pulse', intensity = 1) => {
    act(unitSlot(record), action, intensity);
  }, [act]);

  return { connected, units, signal, actUnit };
}
