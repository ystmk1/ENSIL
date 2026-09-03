import { useEffect } from 'react';

/**
 * 스테이지(빔프로젝터) 창 열기 — Ctrl+Alt+Shift+O (맥은 control+option+shift+O).
 * 관람객이 누를 일 없는 운영용 단축키. 같은 이름의 창을 재사용하므로 두 번 눌러도 하나만 뜬다.
 * Window Management API가 허용되면 두 번째 화면(프로젝터) 위치에 바로 띄우고,
 * 아니면 현재 화면에 뜬 창을 손으로 옮긴 뒤 스테이지 화면을 클릭해 전체화면으로 만든다.
 */

const STAGE_WINDOW_NAME = 'ensil-stage';

type ScreenDetailed = { availLeft: number; availTop: number; availWidth: number; availHeight: number };
type ScreenDetails = { screens: ScreenDetailed[]; currentScreen: ScreenDetailed };
type WindowWithScreens = Window & { getScreenDetails?: () => Promise<ScreenDetails> };

export function isStageShortcut(event: KeyboardEvent) {
  return event.ctrlKey && event.altKey && event.shiftKey && event.code === 'KeyO';
}

export async function openStageWindow() {
  const url = `${window.location.pathname}${window.location.search}#/stage`;
  // features 없이 열면 '탭'이 되고, 배경 탭은 rAF가 멈춰 필드가 얼어붙는다 — 항상 독립 창(popup)으로
  let features = 'popup=1,width=1920,height=1080';
  try {
    const details = await (window as WindowWithScreens).getScreenDetails?.();
    const other = details?.screens.find((screen) => screen !== details.currentScreen);
    if (other) features = `left=${other.availLeft},top=${other.availTop},width=${other.availWidth},height=${other.availHeight}`;
  } catch {
    /* 권한 거부 또는 미지원 — 현재 화면에 연다 */
  }
  const stage = window.open(url, STAGE_WINDOW_NAME, features || undefined);
  stage?.focus();
  return stage;
}

export function useStageWindow() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isStageShortcut(event)) return;
      // 스테이지 창 자신에서는 Stage 라우트가 전체화면 토글로 처리한다
      if (window.location.hash.startsWith('#/stage')) return;
      event.preventDefault();
      void openStageWindow();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
