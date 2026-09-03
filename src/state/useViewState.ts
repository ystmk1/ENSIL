import { useCallback, useEffect, useMemo } from 'react';
import { useHashRoute, type ViewMode } from './useHashRoute';
import type { Creature } from '../types/creature';

export type { ViewMode };

export interface ViewState {
  selectedId: string | null;
  selected: Creature | null;
  selectedIndex: number; // -1 = 미선택
  mode: ViewMode;
  aboutOpen: boolean;
  /** 메인(갤러리) 화면 여부 — #/gallery */
  gallery: boolean;
  /** N초 무입력 시 갤러리 복귀 (전시 옵션 ?idle=N, null = 비활성) */
  idle: number | null;
  select: (id: string | null) => void;
  step: (dir: 1 | -1) => void;
  setMode: (mode: ViewMode) => void;
  setAbout: (open: boolean) => void;
  toGallery: () => void;
}

/**
 * 화면 전체의 단일 상태 (plan.md §5).
 * 목차 클릭 / 시뮬 클릭 / 키보드(=물리 입력 목업) / URL — 모든 입구가 여기로 들어온다.
 * URL이 곧 상태: #/c/:id, ?mode=sim, ?about=1
 */
export function useViewState(creatures: Creature[]): ViewState {
  const { id, mode, about: aboutOpen, gallery, idle, navigate, toGallery } = useHashRoute();

  const selectedIndex = useMemo(
    () => creatures.findIndex((c) => c.id === id),
    [creatures, id],
  );
  const selected = selectedIndex >= 0 ? creatures[selectedIndex] : null;

  const select = useCallback(
    (nextId: string | null) => navigate(nextId, mode, false),
    [navigate, mode],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      if (creatures.length === 0) return;
      const next =
        selectedIndex < 0
          ? dir === 1 ? 0 : creatures.length - 1
          : (selectedIndex + dir + creatures.length) % creatures.length;
      select(creatures[next].id);
    },
    [creatures, selectedIndex, select],
  );

  const setMode = useCallback(
    (nextMode: ViewMode) => navigate(selected?.id ?? null, nextMode, false),
    [navigate, selected],
  );

  const setAbout = useCallback(
    (open: boolean) => navigate(selected?.id ?? null, mode, open),
    [navigate, selected, mode],
  );

  // 키보드 = MockInput (plan.md §7-3). 하드웨어가 없어도 전 인터랙션 재현 + 현장 비상 조작.
  // 갤러리 화면에서는 비활성 — 두 모니터 운용 시 갤러리 창이 아카이브로 넘어가면 안 된다.
  useEffect(() => {
    if (gallery) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'Escape') {
        if (aboutOpen) setAbout(false);
        else select(null);
      } else if (/^[1-9]$/.test(e.key)) {
        const c = creatures[Number(e.key) - 1];
        if (c) select(c.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, select, setAbout, aboutOpen, creatures, gallery]);

  return { selectedId: selected?.id ?? null, selected, selectedIndex, mode, aboutOpen, gallery, idle, select, step, setMode, setAbout, toGallery };
}
