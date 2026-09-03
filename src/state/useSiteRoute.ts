import { useCallback, useEffect, useState } from 'react';

export type SiteRoute =
  | { name: 'landing' }
  | { name: 'field' }
  | { name: 'habitat'; id: string }
  | { name: 'creature'; id: string }
  /** 빔프로젝터 창 — 크롬 없는 3D 공용 필드 (Ctrl+Alt+Shift+O 로 연다) */
  | { name: 'stage' };

function parseHash(): SiteRoute {
  const path = window.location.hash.replace(/^#/, '') || '/';
  if (path === '/' || path === '/index') return { name: 'landing' };
  if (path === '/field') return { name: 'field' };
  if (path === '/stage') return { name: 'stage' };
  if (path === '/archive') return { name: 'landing' }; // 아카이브 = 인덱스 다이얼 (옛 링크 호환)
  const creature = /^\/creature\/([^/?]+)/.exec(path);
  if (creature) return { name: 'creature', id: decodeURIComponent(creature[1]) };
  const habitat = /^\/habitat\/([^/?]+)/.exec(path);
  if (habitat) return { name: 'habitat', id: decodeURIComponent(habitat[1]) };
  return { name: 'landing' };
}

export function useSiteRoute() {
  const [route, setRoute] = useState<SiteRoute>(parseHash);

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', '#/');
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = path.startsWith('/') ? path : `/${path}`;
  }, []);

  return { route, navigate };
}
