import { lazy, Suspense, useEffect } from 'react';
import { SiteChrome } from './components/shell/SiteChrome';
import { FluidVeil } from './components/shell/FluidVeil';
import { LiquidCursor } from './components/landing/LiquidCursor';
import { useSiteRoute } from './state/useSiteRoute';
import { useStageWindow } from './state/useStageWindow';
import { useHardwareLink } from './state/useHardwareLink';
import { HardwareSignal } from './components/shell/HardwareSignal';

const Landing = lazy(() => import('./routes/Landing').then((module) => ({ default: module.Landing })));
const Field = lazy(() => import('./routes/Field').then((module) => ({ default: module.Field })));
const Stage = lazy(() => import('./routes/Stage').then((module) => ({ default: module.Stage })));
const Habitat = lazy(() => import('./routes/Habitat').then((module) => ({ default: module.Habitat })));
const CreatureRecordPage = lazy(() => import('./routes/CreatureRecord').then((module) => ({ default: module.CreatureRecordPage })));

export default function App() {
  const { route } = useSiteRoute();
  useStageWindow(); // Ctrl+Alt+Shift+O → 빔프로젝터 창(#/stage)
  // 목업(ESP32) trigger → 개체 아카이브 띄우기. 스테이지 창은 콘솔이 아니므로 제외
  const hardware = useHardwareLink(route.name !== 'stage');

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [route]);

  return (
    <div className={`site-shell site-shell--${route.name}`}>
      {/* 랜딩은 IndexVideoCarousel 자체 아이덴티티/유틸리티를 쓴다 — 그 외 화면은 같은 룩의 공통 크롬 */}
      {route.name !== 'landing' && route.name !== 'stage' ? <SiteChrome route={route} /> : null}
      <Suspense fallback={<div className="route-loading">ENSIL / LOADING MODULE</div>}>
        {route.name === 'landing' && <Landing />}
        {route.name === 'field' && <Field />}
        {route.name === 'stage' && <Stage />}
        {route.name === 'habitat' && <Habitat id={route.id} />}
        {route.name === 'creature' && <CreatureRecordPage id={route.id} />}
      </Suspense>
      {route.name !== 'stage' && <HardwareSignal signal={hardware.signal} connected={hardware.connected} unitCount={hardware.units.length} />}
      {/* 사이트 전역 유체 베일 + 액체 커서 (터치·reduced-motion에선 자체 비활성) */}
      <FluidVeil />
      <LiquidCursor />
    </div>
  );
}
