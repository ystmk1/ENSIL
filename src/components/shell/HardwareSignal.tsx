import type { HardwareSignal as Signal } from '../../state/useHardwareLink';

/**
 * 목업 신호 칩 + 브릿지 상태 — 상단 중앙 한 자리(모든 화면에서 비어 있는 곳).
 * 평소엔 `BRIDGE / 02 UNITS`를 옅게, trigger 가 오면 같은 자리가 민트 점 + 개체 코드로 바뀐다.
 */
export function HardwareSignal({ signal, connected, unitCount }: { signal: Signal | null; connected: boolean; unitCount: number }) {
  if (signal) {
    return (
      <div className="hardware-signal is-signal" role="status" key={signal.at}>
        <i />
        <span>{signal.record.code}</span>
        <span>{signal.pending ? 'SIGNAL RECEIVED / OPENING WHEN IDLE' : 'SIGNAL RECEIVED'}</span>
      </div>
    );
  }
  return (
    <div className="hardware-signal" aria-hidden data-connected={connected ? 'true' : 'false'}>
      <i />
      <span>{connected ? `BRIDGE / ${String(unitCount).padStart(2, '0')} UNITS` : 'BRIDGE / OFFLINE'}</span>
    </div>
  );
}
