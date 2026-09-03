import { useCallback, useEffect, useState } from 'react';

/**
 * 자체 해시 라우팅 — react-router-dom 대체.
 * (rollup이 react-router 포함 시 빌드 단계에서 네이티브 크래시 — debug.md #1 참조.
 *  라우트가 사실상 상태의 주소뿐이라 훅 하나로 충분하다. plan.md §3)
 *
 * URL 스킴:
 *   #/gallery            — 메인(전시 대기) 화면. 전체 개체 한눈에.
 *   #/c/:id?mode=sim&about=1 — 아카이브 화면.
 *   ?idle=N              — 전시 옵션: N초 무입력 시 갤러리로 복귀 (모든 라우트에서 유지)
 */

export type ViewMode = 'specimen' | 'sim';

export interface HashState {
  id: string | null;
  mode: ViewMode;
  about: boolean;
  /** 메인(갤러리) 화면 여부 */
  gallery: boolean;
  /** N초 무입력 시 갤러리 복귀 (null = 비활성) */
  idle: number | null;
}

function parse(): HashState {
  const hash = window.location.hash.replace(/^#/, '');
  const [path, qs] = hash.split('?');
  const m = /^\/c\/([^/?]+)/.exec(path ?? '');
  const params = new URLSearchParams(qs ?? '');
  const idleRaw = Number(params.get('idle'));
  return {
    id: m?.[1] ?? null,
    mode: params.get('mode') === 'sim' ? 'sim' : 'specimen',
    about: params.get('about') === '1',
    gallery: /^\/gallery/.test(path ?? ''),
    idle: Number.isFinite(idleRaw) && idleRaw > 0 ? idleRaw : null,
  };
}

export function buildHash(
  id: string | null,
  mode: ViewMode,
  about: boolean,
  gallery = false,
  idle: number | null = null,
): string {
  const params = new URLSearchParams();
  if (!gallery && mode === 'sim') params.set('mode', 'sim');
  if (!gallery && about) params.set('about', '1');
  if (idle) params.set('idle', String(idle));
  const path = gallery ? '/gallery' : id ? `/c/${id}` : '/';
  const qs = params.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function useHashRoute() {
  const [state, setState] = useState<HashState>(parse);

  useEffect(() => {
    const onChange = () => setState(parse());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((id: string | null, mode: ViewMode, about: boolean) => {
    // idle(전시 옵션)은 라우트가 바뀌어도 유지한다
    window.location.hash = buildHash(id, mode, about, false, parse().idle);
    // hashchange 이벤트가 setState를 호출한다
  }, []);

  const toGallery = useCallback(() => {
    window.location.hash = buildHash(null, 'specimen', false, true, parse().idle);
  }, []);

  return { ...state, navigate, toGallery };
}
