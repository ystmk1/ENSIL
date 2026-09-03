import { useEffect, useRef } from 'react';
import { FluidSim, type SplatInput } from '../../fluid/FluidSim';

/**
 * 전면 유체 베일 — 허브 유체를 사이트 전체로 확장한 것.
 * 커서 궤적을 따라 한 덩어리 액체가 흐르고, difference 블렌드라
 * 밝은 면 위에선 어둡게 / 어두운 면 위에선 밝게 뒤집혀 가독성이 유지된다.
 * 실버-틸 근백색 염료 + difference = 색상 난동 없이 모노톤 반전.
 * 유휴 3.5초 후 rAF 완전 정지 (배터리/CPU 보호), 터치·reduced-motion 비활성.
 */

const IDLE_STOP_MS = 3500;
const MAX_DPR = 1.5;
const TINT_DPR = 0.6; // 민트 글레이즈는 색만 입히므로 저해상도로 충분
const KEY_COLOR = '#58d6c3'; // 키컬러 — 민트~청록

/** 근백색 실버-틸 염료 — difference에서 모노톤 반전으로 읽힌다 */
function dyeColor(t: number): [number, number, number] {
  const k = 0.5 + 0.5 * Math.sin(t * 0.14);
  return [0.62 + 0.1 * k, 0.8 - 0.04 * k, 0.77];
}

export function FluidVeil() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tintRef = useRef<HTMLCanvasElement>(null);
  const toneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const tint = tintRef.current;
    if (!canvas || !tint) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const fit = () => {
      canvas.width = Math.max(2, Math.round(window.innerWidth * dpr));
      canvas.height = Math.max(2, Math.round(window.innerHeight * dpr));
      tint.width = Math.max(2, Math.round(window.innerWidth * TINT_DPR));
      tint.height = Math.max(2, Math.round(window.innerHeight * TINT_DPR));
    };
    fit();

    const sim = new FluidSim(canvas);
    if (!sim.supported) return;
    const tintCtx = tint.getContext('2d');

    // 메인 화면(랜딩): 글레이즈 없이 difference 단독 + 최상단 hue 통일 레이어 —
    // 반전이 만드는 붉은 기를 브랜드 틸로 정렬하고 허브·포인터·배경의 톤을 맞춘다
    let tintEnabled = true;
    const updateTintEnabled = () => {
      const path = window.location.hash.replace(/^#/, '') || '/';
      const isLanding = path === '/' || path === '/index';
      tintEnabled = !isLanding;
      tint.style.display = tintEnabled ? '' : 'none';
      if (toneRef.current) toneRef.current.style.display = isLanding ? '' : 'none';
    };
    updateTintEnabled();
    window.addEventListener('hashchange', updateTintEnabled);

    // difference 결과 위에 유체 모양 그대로 키컬러를 입힌다 (color 블렌드 글레이즈)
    const paintTint = () => {
      if (!tintCtx || !tintEnabled) return;
      tintCtx.globalCompositeOperation = 'copy';
      tintCtx.drawImage(canvas, 0, 0, tint.width, tint.height);
      tintCtx.globalCompositeOperation = 'source-in';
      tintCtx.fillStyle = KEY_COLOR;
      tintCtx.fillRect(0, 0, tint.width, tint.height);
      tintCtx.globalCompositeOperation = 'source-over';
    };

    const pending: SplatInput[] = [];
    let last = { x: 0, y: 0, t: 0, has: false };
    let lastActive = 0;
    let running = false;
    let prevFrame = 0;
    let raf = 0;

    const loop = (now: number) => {
      const dt = Math.min(1 / 30, Math.max(1 / 240, (now - prevFrame) / 1000));
      prevFrame = now;
      while (pending.length) sim.splat(pending.shift()!);
      sim.step(dt);
      sim.render();
      paintTint();
      if (now - lastActive > IDLE_STOP_MS) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      lastActive = performance.now();
      if (!running) {
        running = true;
        prevFrame = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const x = event.clientX / window.innerWidth;
      const y = 1 - event.clientY / window.innerHeight;
      if (last.has) {
        const dt = Math.max(1, event.timeStamp - last.t);
        const dx = (x - last.x) * Math.min(3, 16 / dt) * 1.3;
        const dy = (y - last.y) * Math.min(3, 16 / dt) * 1.3;
        if (Math.abs(dx) + Math.abs(dy) > 0.0001) {
          const speed = Math.min(1, Math.hypot(dx, dy) * 8);
          const base = dyeColor(event.timeStamp / 1000);
          pending.push({
            x, y, dx, dy,
            color: [base[0] * (0.45 + speed * 0.6), base[1] * (0.45 + speed * 0.6), base[2] * (0.45 + speed * 0.6)],
          });
          if (pending.length > 24) pending.shift();
          wake();
        }
      }
      last = { x, y, t: event.timeStamp, has: true };
    };
    const onLeave = () => { last.has = false; };
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        running = false;
      }
    };
    const onResize = () => {
      fit();
      sim.resize();
    };
    // (허브 마스크 홀 제거 — 허브도 같은 흑백 유체라 겹침이 곧 섞임 표현이 된다)

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerout', onLeave, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('hashchange', updateTintEnabled);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerout', onLeave);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      sim.dispose();
    };
  }, []);

  return (
    <>
      <canvas className="fluid-veil" ref={canvasRef} aria-hidden />
      <canvas className="fluid-veil-tint" ref={tintRef} aria-hidden />
      {/* 색상 통일 레이어 — 랜딩에서만: hue만 이식되어 붉은 반전을 틸로 정렬, 회색은 그대로 */}
      <div className="site-tone" ref={toneRef} aria-hidden />
    </>
  );
}
