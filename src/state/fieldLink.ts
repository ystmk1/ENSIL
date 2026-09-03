import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreatureState } from '../data/creatureRecords';

/**
 * 전시 두-창 연동 — 콘솔(아이맥 #/field) ↔ 스테이지(빔프로젝터 #/stage).
 *
 * 기본 전송로는 BroadcastChannel: 아이맥 한 대의 같은 Chrome 프로필에서 창 두 개를 띄우면
 * 서버·네트워크 없이 동작한다 (docs/EXHIBITION_SETUP.md 의 권장 구성).
 * 노트북을 따로 써야 하면 VITE_FIELD_LINK_URL 로 브릿지(bridge/index.js) WebSocket 릴레이를
 * 켠다 — 같은 메시지를 {type:'field', role, msg} 봉투에 담아 다른 클라이언트에 중계한다.
 *
 * 두 전송로 모두 "보낸 쪽 role"을 붙여 보내므로 자기 메시지는 버린다.
 */

export type FieldLinkRole = 'panel' | 'stage';

export type FieldSnapshotItem = { id: string; state: CreatureState; energy: number };

export type FieldLinkMessage =
  | { type: 'hello'; role: FieldLinkRole }
  /** 콘솔이 고른 개체 — 스테이지가 포커스(살짝 활성 + 크기) */
  | { type: 'focus'; id: string | null }
  /** 콘솔에서 던진 신호 — 스테이지의 해당 개체가 반응 */
  | { type: 'pulse'; id: string; strength: number }
  /** 스테이지가 콘솔로 돌려주는 개체 상태 (1초 주기) */
  | { type: 'snapshot'; items: FieldSnapshotItem[] };

type Envelope = { role: FieldLinkRole; msg: FieldLinkMessage };

type Transport = { send(envelope: Envelope): void; close(): void };

const CHANNEL = 'ensil-field';
const HEARTBEAT_MS = 2_000;
const ALIVE_MS = 6_000;
const RELAY_RECONNECT_MS = 3_000;
const RELAY_URL = import.meta.env.VITE_FIELD_LINK_URL as string | undefined;

function openBroadcast(onEnvelope: (envelope: Envelope) => void): Transport | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<Envelope>) => {
    if (event.data && typeof event.data.role === 'string') onEnvelope(event.data);
  };
  return {
    send: (envelope) => channel.postMessage(envelope),
    close: () => channel.close(),
  };
}

/** 브릿지 릴레이 — 끊기면 조용히 재접속, 실패해도 화면은 정상 (plan.md §7-4 원칙) */
function openRelay(url: string, onEnvelope: (envelope: Envelope) => void): Transport {
  let socket: WebSocket | null = null;
  let timer: number | null = null;
  let disposed = false;

  const connect = () => {
    if (disposed) return;
    try {
      socket = new WebSocket(url);
    } catch {
      retry();
      return;
    }
    socket.onclose = retry;
    socket.onerror = () => socket?.close();
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'field' && data.msg && typeof data.role === 'string') {
          onEnvelope({ role: data.role, msg: data.msg });
        }
      } catch {
        /* JSON 아닌 메시지(IMU 원값 등) 무시 */
      }
    };
  };
  const retry = () => {
    if (disposed || timer !== null) return;
    timer = window.setTimeout(() => {
      timer = null;
      connect();
    }, RELAY_RECONNECT_MS);
  };
  connect();

  return {
    send: (envelope) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'field', ...envelope }));
    },
    close: () => {
      disposed = true;
      if (timer !== null) window.clearTimeout(timer);
      socket?.close();
    },
  };
}

export function useFieldLink(role: FieldLinkRole, onMessage?: (msg: FieldLinkMessage) => void, enabled = true) {
  const [peerAlive, setPeerAlive] = useState(false);
  const transportsRef = useRef<Transport[]>([]);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return undefined;
    let lastSeen = 0;
    const other: FieldLinkRole = role === 'panel' ? 'stage' : 'panel';

    const handle = (envelope: Envelope) => {
      if (envelope.role !== other) return;
      lastSeen = Date.now();
      setPeerAlive(true);
      if (envelope.msg.type !== 'hello') onMessageRef.current?.(envelope.msg);
    };

    const transports = [openBroadcast(handle), RELAY_URL ? openRelay(RELAY_URL, handle) : null]
      .filter((transport): transport is Transport => transport !== null);
    transportsRef.current = transports;

    const hello = () => transports.forEach((transport) => transport.send({ role, msg: { type: 'hello', role } }));
    hello();
    const beat = window.setInterval(() => {
      hello();
      if (lastSeen && Date.now() - lastSeen > ALIVE_MS) {
        lastSeen = 0;
        setPeerAlive(false);
      }
    }, HEARTBEAT_MS);

    return () => {
      window.clearInterval(beat);
      transports.forEach((transport) => transport.close());
      transportsRef.current = [];
    };
  }, [role, enabled]);

  const send = useCallback((msg: FieldLinkMessage) => {
    transportsRef.current.forEach((transport) => transport.send({ role, msg }));
  }, [role]);

  return { peerAlive, send };
}
