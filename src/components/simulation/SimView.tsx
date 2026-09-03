import { useEffect, useReducer, useRef, useState } from 'react';
import type { Creature } from '../../types/creature';
import type { ViewState } from '../../state/useViewState';
import type { Tilt } from '../../input/types';
import type { World } from '../../sim/types';
import { createWorld } from '../../sim/world';
import { tick } from '../../sim/engine';
import { COPY } from '../../copy';
import { creatureModelUrl } from '../../sim3d/creatureModel';
import { ThreeStage } from './ThreeStage';
import { TransportBar, type OverlayFlags, type SimSpeed } from './TransportBar';
import { ObserverPanel } from './ObserverPanel';

const STEP = 1 / 30; // 고정 timestep 30tick/s, 렌더는 rAF (plan.md §8-3)

/** 시뮬레이션 모드 — 엔진 루프 + 렌더러 연결 (plan.md §4-4) */
export function SimView({
  creatures,
  view,
  tiltRef,
}: {
  creatures: Creature[];
  view: ViewState;
  tiltRef?: React.RefObject<Tilt>;
}) {
  const worldRef = useRef<World | null>(null);
  if (worldRef.current === null) worldRef.current = createWorld(creatures);

  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState<SimSpeed>(1);
  const [overlays, setOverlays] = useState<OverlayFlags>({
    trails: true,
    labels: true,
    nodes: true,
    grid: false,
  });
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      // 탭 비활성 등으로 프레임이 길어져도 최대 0.25초까지만 따라잡는다 (나선형 지연 방지)
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;
      if (running) {
        acc += dt * speed;
        while (acc >= STEP) {
          tick(worldRef.current!, STEP);
          acc -= STEP;
        }
        force();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  const world = worldRef.current;
  const selectedOrg = world.organisms.find((o) => o.id === view.selectedId) ?? null;

  return (
    <div className="sim">
      <div className="sim-stage-col">
        <div className="sim-stage-wrap">
          <ThreeStage
            world={world}
            selectedId={view.selectedId}
            overlays={overlays}
            onSelect={view.select}
            tiltRef={tiltRef}
            modelUrls={Object.fromEntries(creatures.map((c) => [c.id, creatureModelUrl(c)]))}
          />
          {!running && <span className="sim-note">{COPY.simPaused}</span>}
        </div>
        <TransportBar
          running={running}
          speed={speed}
          t={world.t}
          count={world.organisms.length}
          overlays={overlays}
          onToggleRun={() => setRunning((r) => !r)}
          onReset={() => {
            worldRef.current = createWorld(creatures);
            force();
          }}
          onSpeed={setSpeed}
          onOverlay={(key) => setOverlays((o) => ({ ...o, [key]: !o[key] }))}
        />
      </div>
      <ObserverPanel
        creature={view.selected}
        organism={selectedOrg}
        onGotoSpecimen={() => view.setMode('specimen')}
      />
    </div>
  );
}
