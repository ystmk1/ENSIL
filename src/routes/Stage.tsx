import { useCallback, useEffect, useRef, useState } from 'react';
import { EcosystemCanvas } from '../components/field/EcosystemCanvas';
import type { HabitatSnapshot } from '../components/habitat-engine/types';
import { useFieldLink } from '../state/fieldLink';
import { isStageShortcut } from '../state/useStageWindow';

type Stimulus = { id: string; strength: number; at: number };

const SNAPSHOT_INTERVAL_MS = 1_000;

/**
 * 스테이지 — 빔프로젝터에 띄우는 3D 공용 필드. 크롬·버튼 없이 구석 라벨만 두고,
 * 콘솔(#/field)에서 온 focus/pulse 를 받아 개체를 반응시킨다.
 * 개체 상태는 1초마다 콘솔로 돌려보내 핫스팟 라벨에 표시된다.
 */
export function Stage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stimulus, setStimulus] = useState<Stimulus | null>(null);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const lastSnapshotRef = useRef(0);

  const { peerAlive, send } = useFieldLink('stage', (msg) => {
    if (msg.type === 'pulse') setStimulus({ id: msg.id, strength: msg.strength, at: performance.now() });
    if (msg.type === 'focus') setSelectedId(msg.id);
  });

  const onSnapshot = useCallback((items: HabitatSnapshot[]) => {
    const now = performance.now();
    if (now - lastSnapshotRef.current < SNAPSHOT_INTERVAL_MS) return;
    lastSnapshotRef.current = now;
    send({ type: 'snapshot', items: items.map(({ id, state, energy }) => ({ id, state, energy })) });
  }, [send]);

  // 전체화면 — 사용자 제스처가 필요하므로 첫 클릭 또는 단축키(F / Ctrl+Alt+Shift+O)로 진입
  useEffect(() => {
    const toggle = () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen().catch(() => undefined);
    };
    const onPointerDown = () => { if (!document.fullscreenElement) toggle(); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isStageShortcut(event) || (event.key.toLowerCase() === 'f' && !event.metaKey && !event.ctrlKey)) {
        event.preventDefault();
        toggle();
      }
    };
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, []);

  return (
    <main className="stage-page">
      <EcosystemCanvas
        selectedId={selectedId}
        observation={false}
        paused={false}
        onSelect={setSelectedId}
        onEnter={() => undefined}
        onProximity={() => undefined}
        onSnapshot={onSnapshot}
        onImmersiveChange={() => undefined}
        entryRequest={0}
        stimulus={stimulus}
        ambient
      />
      {stimulus && <div className="stage-page__pulse" key={stimulus.at} aria-hidden />}
      <div className="stage-page__meta" aria-hidden>
        <span>ENSIL / FIELD STAGE</span>
        <span><i data-alive={peerAlive ? 'true' : 'false'} />{peerAlive ? 'CONSOLE LINKED' : 'CONSOLE WAITING'}</span>
      </div>
      {!fullscreen && <p className="stage-page__hint">CLICK OR PRESS F FOR FULLSCREEN</p>}
    </main>
  );
}
