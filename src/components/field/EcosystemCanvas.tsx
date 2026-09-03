import { useEffect, useRef, useState } from 'react';
import { CREATURE_RECORDS } from '../../data/creatureRecords';
import { HabitatWorld } from '../habitat-engine/HabitatWorld';
import type { HabitatSnapshot } from '../habitat-engine/types';

type Props = {
  selectedId: string | null;
  observation: boolean;
  paused: boolean;
  onSelect: (id: string | null) => void;
  onEnter: (id: string) => void;
  onProximity: (id: string | null) => void;
  onSnapshot: (snapshot: HabitatSnapshot[]) => void;
  onImmersiveChange: (active: boolean) => void;
  entryRequest: number;
  /** 외부(콘솔 창)에서 온 신호 — at 이 바뀔 때마다 해당 개체를 활성화 */
  stimulus?: { id: string; strength: number; at: number } | null;
  /** 스테이지 모드 — 카메라가 필드를 천천히 돌며 관람 (조작 없는 프로젝터용) */
  ambient?: boolean;
};

export function EcosystemCanvas({ selectedId, observation, paused, onSelect, onEnter, onProximity, onSnapshot, onImmersiveChange, entryRequest, stimulus, ambient }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HabitatWorld | null>(null);
  const callbacksRef = useRef({ onSelect, onEnter, onProximity, onSnapshot, onImmersiveChange });
  callbacksRef.current = { onSelect, onEnter, onProximity, onSnapshot, onImmersiveChange };
  const [loading, setLoading] = useState({ loaded: 0, total: CREATURE_RECORDS.length });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const world = new HabitatWorld({
      mount,
      records: CREATURE_RECORDS,
      mode: 'field',
      ambient,
      selectedId,
      observation,
      paused,
      onLoaded: (loaded, total) => setLoading({ loaded, total }),
      onSelect: (id) => callbacksRef.current.onSelect(id),
      onEnter: (id) => callbacksRef.current.onEnter(id),
      onProximity: (id) => callbacksRef.current.onProximity(id),
      onSnapshot: (snapshot) => callbacksRef.current.onSnapshot(snapshot),
      onImmersiveChange: (active) => callbacksRef.current.onImmersiveChange(active),
    });
    worldRef.current = world;
    return () => {
      world.dispose();
      worldRef.current = null;
    };
  }, []);

  useEffect(() => {
    worldRef.current?.setOptions({ selectedId, observation, paused });
  }, [selectedId, observation, paused]);

  useEffect(() => {
    if (entryRequest > 0) worldRef.current?.enterFirstPerson();
  }, [entryRequest]);

  useEffect(() => {
    if (stimulus) worldRef.current?.activate(stimulus.id, stimulus.strength);
  }, [stimulus]);

  return (
    <div className="ecosystem-canvas" ref={mountRef}>
      {loading.loaded < loading.total && (
        <span className="ecosystem-loading">
          ECOLOGIES GENERATING / {loading.loaded.toString().padStart(2, '0')}—{loading.total.toString().padStart(2, '0')}
        </span>
      )}
    </div>
  );
}
