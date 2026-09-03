import { useEffect, useRef } from 'react';

/**
 * 액체 커서 — 구이(gooey) 필터로 합쳐지는 점 사슬. 커서 자체가 유체처럼
 * 움직임을 따라 늘어났다 고이며, 인터랙티브 요소 위에서 커지고 클릭 시 움츠러든다.
 * exclusion 블렌드라 밝은 면 위에선 어둡게, 어두운 면 위에선 밝게 — 항상 보인다.
 * transform만 갱신(리플로 0), 멈추면 2.5초 후 rAF 정지.
 */

const SIZES = [22, 20, 18, 16, 14, 12, 10, 9, 8, 7];
const HEAD_FOLLOW = 0.55;
const TAIL_FOLLOW = 0.52;
/** 인접 점 사이 최대 간격(각 점 지름 대비) — 이 이상 벌어지면 끌어당겨서
    아무리 빨라도 구이 필터 안에서 항상 한 덩어리로 붙어 있게 한다 */
const MAX_GAP_RATIO = 0.75;
const IDLE_STOP_MS = 2500;

export function LiquidCursor() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const debug = new URLSearchParams(window.location.search).has('fluidtest');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (debug) console.info('[liquid-cursor] off: reduced-motion');
      return;
    }
    if (window.matchMedia('(pointer: coarse)').matches) {
      if (debug) console.info('[liquid-cursor] off: coarse pointer');
      return; // 터치 기기 제외
    }
    if (debug) console.info('[liquid-cursor] active');

    const dots = Array.from(root.querySelectorAll<HTMLElement>('.liquid-cursor__dot'));
    const pos = SIZES.map(() => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 }));
    const target = { x: pos[0].x, y: pos[0].y };

    // 허브 유체([data-fluid-window])와의 접착 — 가까우면 꼬리가 허브 가장자리로 끌린다
    let hub: { cx: number; cy: number; r: number } | null = null;
    const measureHub = () => {
      const el = document.querySelector('[data-fluid-window]');
      if (!el) { hub = null; return; }
      const rect = el.getBoundingClientRect();
      hub = { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, r: rect.width / 2 };
    };
    measureHub();
    const hubTimer = window.setInterval(measureHub, 1500);
    window.addEventListener('hashchange', measureHub);
    let scale = 1;
    let scaleTarget = 1;
    let pressed = false;
    let hovering = false;
    let lastActive = 0;
    let running = false;
    let raf = 0;

    const loop = (now: number) => {
      pos[0].x += (target.x - pos[0].x) * HEAD_FOLLOW;
      pos[0].y += (target.y - pos[0].y) * HEAD_FOLLOW;
      for (let i = 1; i < pos.length; i += 1) {
        pos[i].x += (pos[i - 1].x - pos[i].x) * TAIL_FOLLOW;
        pos[i].y += (pos[i - 1].y - pos[i].y) * TAIL_FOLLOW;
        // 간격 하드 클램프 — 빠른 이동에도 사슬이 절대 끊기지 않는다
        const gx = pos[i].x - pos[i - 1].x;
        const gy = pos[i].y - pos[i - 1].y;
        const gap = Math.hypot(gx, gy);
        const maxGap = SIZES[i] * scale * MAX_GAP_RATIO;
        if (gap > maxGap) {
          const k = maxGap / gap;
          pos[i].x = pos[i - 1].x + gx * k;
          pos[i].y = pos[i - 1].y + gy * k;
        }
      }
      // 허브 접착: 가장자리 근처(150px)에서 꼬리 절반이 허브 림 쪽으로 끌려
      // 두 유체가 목을 늘여 맞닿는 듯한 브릿지를 만든다
      if (hub) {
        const hx = pos[0].x - hub.cx;
        const hy = pos[0].y - hub.cy;
        const d = Math.hypot(hx, hy);
        const edgeDist = d - hub.r;
        if (d > 1 && edgeDist < 150) {
          const pull = edgeDist <= 0 ? 1 : 1 - edgeDist / 150;
          const ex = hub.cx + (hx / d) * hub.r;
          const ey = hub.cy + (hy / d) * hub.r;
          const half = Math.floor(pos.length / 2);
          for (let i = half; i < pos.length; i += 1) {
            const w = pull * 0.22 * ((i - half + 1) / (pos.length - half));
            pos[i].x += (ex - pos[i].x) * w;
            pos[i].y += (ey - pos[i].y) * w;
          }
        }
      }
      scaleTarget = pressed ? 0.72 : hovering ? 1.65 : 1;
      scale += (scaleTarget - scale) * 0.2;
      dots.forEach((dot, i) => {
        const s = SIZES[i] * scale;
        dot.style.transform = `translate3d(${pos[i].x - s / 2}px, ${pos[i].y - s / 2}px, 0)`;
        dot.style.width = `${s}px`;
        dot.style.height = `${s}px`;
      });
      const settled = Math.hypot(target.x - pos[pos.length - 1].x, target.y - pos[pos.length - 1].y) < 0.5;
      if (settled && now - lastActive > IDLE_STOP_MS) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      lastActive = performance.now();
      if (!running) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };

    const onMove = (event: PointerEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
      const el = event.target as Element | null;
      hovering = !!el?.closest?.('a, button, [role="tab"], [role="slider"], input, label');
      root.style.opacity = '1';
      wake();
    };
    const onDown = () => { pressed = true; wake(); };
    const onUp = () => { pressed = false; wake(); };
    const onLeave = () => { root.style.opacity = '0'; };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(hubTimer);
      window.removeEventListener('hashchange', measureHub);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div ref={rootRef} className="liquid-cursor" aria-hidden>
      <svg width="0" height="0" style={{ position: 'absolute' }} focusable="false">
        <filter id="ensil-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" />
        </filter>
      </svg>
      <div className="liquid-cursor__goo">
        {SIZES.map((size, i) => (
          <i className="liquid-cursor__dot" key={i} style={{ width: size, height: size }} />
        ))}
      </div>
    </div>
  );
}
