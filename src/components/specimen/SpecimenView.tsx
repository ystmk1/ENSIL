import { useEffect, useRef, useState } from 'react';
import type { Creature } from '../../types/creature';
import { COPY, TAXON_NAME } from '../../copy';
import { AnnotationLayer } from './AnnotationLayer';
import { SpecimenModel } from './SpecimenModel';
import { TraitGauge } from './TraitGauge';

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 1279px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1279px)');
    const cb = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  }, []);
  return narrow;
}

/** 표본 모드 — 중앙 비주얼 + 4모서리 패널 + 주석 (plan.md §4-3) */
export function SpecimenView({ creature }: { creature: Creature }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const narrow = useNarrow();

  return (
    <div className="specimen" data-species={creature.species} ref={containerRef}>
      {/* 중앙 비주얼 — creature.glb 3D 뷰어 */}
      <div className="visual-wrap" ref={visualRef}>
        <div className="visual">
          <SpecimenModel creature={creature} />
        </div>
      </div>

      {/* 주석 — 컨테이너 좌표계로 그리므로 반드시 .specimen 직속 (visual-wrap 안이면 transform에 밀림) */}
      {!narrow && (
        <AnnotationLayer
          annotations={creature.annotations}
          containerRef={containerRef}
          visualRef={visualRef}
        />
      )}

      {/* 1280px 미만 폴백: 주석을 세로 목록으로 */}
      {narrow && (
        <div className="callout-stack">
          {creature.annotations.map((a) => (
            <div key={a.id} className="callout">
              <div className="label">{a.label}</div>
              <div className="body">{a.body}</div>
            </div>
          ))}
        </div>
      )}

      {/* 좌상 — 제목 */}
      <aside className="panel panel-tl panel-title">
        <span className="code">{creature.code}</span>
        <div className="name">{creature.name}</div>
        {creature.latin && <div className="latin">{creature.latin}</div>}
        <dl>
          <dt>{COPY.registered}</dt>
          <dd>{creature.registeredAt}</dd>
          <dt>{COPY.statusLabel}</dt>
          <dd>{creature.status}</dd>
        </dl>
      </aside>

      {/* 우상 — 계통 */}
      <aside className="panel panel-tr">
        <h3>{COPY.taxonPanel}</h3>
        <div className="taxon-tree">
          <div>{COPY.taxonRoot}</div>
          <div className="lv1">└ {TAXON_NAME[creature.taxon]}</div>
          <div className="lv2">└ {creature.code}</div>
        </div>
      </aside>

      {/* 좌하 — 최초의 목적 */}
      <aside className="panel panel-bl purpose">
        <h3>{COPY.purposePanel}</h3>
        <div className="statement">“{creature.purpose.statement}”</div>
        <TraitGauge label={COPY.traitCharge} value={creature.traits.charge} />
        <TraitGauge label={COPY.traitStimulus} value={creature.traits.stimulus} />
        <TraitGauge label={COPY.traitBond} value={creature.traits.bond} />
      </aside>

      {/* 우하 — 관찰 기록 */}
      <aside className="panel panel-br notes">
        <h3>{COPY.notesPanel}</h3>
        <ul>
          {creature.notes.map((n) => (
            <li key={n.date + n.text}>
              <span className="date">{n.date}</span>
              <span>{n.text}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
