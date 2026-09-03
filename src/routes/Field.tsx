import { useState } from 'react';
import { PanoramaViewer } from '../components/field/PanoramaViewer';
import { CREATURE_RECORDS, getCreatureRecord, type CreatureState } from '../data/creatureRecords';
import { useFieldLink } from '../state/fieldLink';

const SENT_FLASH_MS = 1_400;

/**
 * 필드(콘솔) — 아이맥에서 보는 파노라마. 스테이지(빔프로젝터 #/stage)가 살아 있으면
 * 개체 선택이 스테이지 포커스로, 조우 카드의 SEND SIGNAL 이 스테이지 펄스로 건너간다.
 */
export function Field() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [proximityId, setProximityId] = useState<string | null>(null);
  const [observation, setObservation] = useState(false);
  const [paused, setPaused] = useState(false);
  const [panoramaMode, setPanoramaMode] = useState<'loading' | 'limited' | '360' | 'error'>('loading');
  const [stageStates, setStageStates] = useState<Record<string, CreatureState>>({});
  const [sentAt, setSentAt] = useState(0);
  const selected = selectedId ? getCreatureRecord(selectedId) : null;
  const proximity = !selected && proximityId ? getCreatureRecord(proximityId) : null;

  const { peerAlive, send } = useFieldLink('panel', (msg) => {
    if (msg.type === 'snapshot') setStageStates(Object.fromEntries(msg.items.map((item) => [item.id, item.state])));
  });

  const select = (id: string | null) => {
    setSelectedId(id);
    send({ type: 'focus', id });
  };
  const sendSignal = () => {
    if (!selected) return;
    send({ type: 'pulse', id: selected.id, strength: 1 });
    setSentAt(Date.now());
  };
  const justSent = Date.now() - sentAt < SENT_FLASH_MS;

  return (
    <main className="field-page field-page--panorama">
      <PanoramaViewer paused={paused} states={stageStates} onSelect={select} onProximity={setProximityId} onModeChange={setPanoramaMode} />

      <div className="field-index" aria-hidden><span>FIELD 01 / LIVING PANORAMA</span><span>04 ELECTRONIC ORGANISMS</span></div>
      <div className="field-environment" aria-hidden>
        <span>{peerAlive ? 'STAGE / LINKED' : 'STAGE / OFFLINE'}</span>
        <span>INPUT / POINTER</span>
        <span>{panoramaMode === '360' ? 'VIEW / 360°' : 'VIEW / ±47°'}</span>
        <span>DENSITY 04</span>
      </div>
      <p className="field-panorama-help">DRAG TO LOOK · SCROLL TO ZOOM · SELECT A SIGNAL</p>

      <div className="field-controls field-controls--compact" aria-label="Field controls">
        <button type="button" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>{paused ? 'RESUME' : 'PAUSE'}</button>
        <button type="button" onClick={() => setObservation((value) => !value)} aria-pressed={observation}>{observation ? 'CLOSE INDEX' : 'FIELD INDEX'}</button>
      </div>

      {proximity && <div className="field-proximity" aria-live="polite"><i /><span>{proximity.code}</span><strong>{proximity.sensor}</strong><small>SIGNAL IN RANGE</small></div>}

      {selected && (
        <aside className="encounter-card is-open" aria-live="polite">
          <button className="encounter-card__close" type="button" onClick={() => select(null)} aria-label="Close encounter">×</button>
          <span>{selected.code} / PANORAMA SIGNAL</span><h1>{selected.name}</h1>
          <dl>
            <div><dt>SENSOR</dt><dd>{selected.sensor}</dd></div>
            <div><dt>INPUT</dt><dd>{selected.input}</dd></div>
            <div><dt>RESPONSE</dt><dd>{selected.response}</dd></div>
            <div><dt>ON STAGE</dt><dd>{peerAlive ? (stageStates[selected.id] ?? 'observing').toUpperCase() : '—'}</dd></div>
          </dl>
          <button type="button" className="encounter-card__signal" onClick={sendSignal} disabled={!peerAlive} aria-live="polite">
            <span>{peerAlive ? (justSent ? 'SIGNAL SENT' : 'SEND SIGNAL TO STAGE') : 'STAGE OFFLINE'}</span>
            <i data-sent={justSent ? 'true' : 'false'} aria-hidden />
          </button>
          <div className="encounter-card__actions"><a href={`#/habitat/${selected.id}`}>ENTER HABITAT <span>→</span></a><a href={`#/creature/${selected.id}`}>ARCHIVE RECORD <span>↗</span></a></div>
        </aside>
      )}

      {observation && (
        <aside className="observation-layer" aria-label="Living organism index">
          <header><span>SPECIMEN</span><span>SENSOR</span></header>
          {CREATURE_RECORDS.map((record) => <button type="button" key={record.id} onClick={() => select(record.id)}><span><i />{record.code}</span><span>{record.sensor}</span></button>)}
          <footer><span>SELECT A RECORD TO OPEN ITS SIGNAL</span></footer>
        </aside>
      )}
    </main>
  );
}
