import { useEffect, useId, useRef } from 'react';

const WORDMARK_PATH = 'M377.57,90.01V4.4h-27.97v58.98c0,3.27-2.65,5.92-5.92,5.92h-1.17c-3.27,0-5.92-2.65-5.92-5.92V4.4h-27.96v8.29c0,3.27-2.65,5.92-5.92,5.92h-3.08c-1.96,0-3.79-.97-4.88-2.59-3.15-4.65-7.76-8.29-13.91-11.29-6.31-3.04-13.26-4.72-21.19-4.72-16.15,0-31.06,7.55-37.86,19.16-1.07,1.83-3.01,2.99-5.14,2.99h-2.45c-3.27,0-5.92-2.65-5.92-5.92V4.41h-26.57v49.08c0,5.2-6.82,7.13-9.54,2.7l-31.77-51.74h-24.18v25.51c0,5.73-7.32,8.11-10.7,3.49l-4.55-6.24h0C90.73,12.44,73.49,2.87,54.05,3.34,24.49,4.05.45,28.31,0,57.87c-.47,30.99,24.51,56.26,55.4,56.26,18.8,0,35.4-9.37,45.42-23.69v.02s5.07-5.66,5.07-5.66c3.62-4.05,10.33-1.48,10.33,3.95v3.96s0,20.98,0,20.98h24.18s2.2,0,2.2,0v-46.46c0-6,7.87-8.22,11.01-3.11l30.51,49.58h24.16v-10.07c0-3.27,2.65-5.92,5.92-5.92h2.29c2,0,3.87,1,4.95,2.68,7.02,10.9,20.4,16.56,37.71,16.56s30.04-5.69,36.65-15.92c1.09-1.69,2.96-2.71,4.97-2.71h1.93c3.27,0,5.92,2.65,5.92,5.92v9.43h27.96v-9.43c0-3.27,2.65-5.92,5.92-5.92h1.17c3.27,0,5.92,2.65,5.92,5.92v9.43h63.04v-23.65h-35.07ZM32.25,39.5c4.07-8.36,13.22-12.2,23.16-12.2s19.09,3.85,23.16,12.2c1.67,3.43-.81,7.42-4.62,7.42h-18.43s-.21,0-.21,0h-18.43c-3.81,0-6.29-4-4.62-7.42ZM79.35,75.88c-4.16,8.69-13.65,14.75-23.95,14.75s-19.78-6.07-23.95-14.75c-1.68-3.5.95-7.54,4.83-7.54h19.01s.21,0,.21,0h19.01c3.88,0,6.5,4.04,4.83,7.54ZM259.01,92.88c-6.27,0-10.66-4.14-12.11-10.8-.58-2.69-3.01-4.58-5.76-4.58h-15.86s-16.99,0-16.99,0v-28.17c0-3.27,2.65-5.92,5.92-5.92h1.67c2.21,0,4.19,1.25,5.24,3.18,4.14,7.62,12.39,13.51,25.26,18.42,10.84,4.11,24.1,8.07,24.1,17.05,0,6.09-5.18,10.81-11.48,10.81ZM300.87,68.27c-1.9,0-3.66-.92-4.79-2.45-4.65-6.32-13.25-11.82-28.17-17.85-13.1-5.33-19.57-8.37-19.57-15.07,0-5.03,4.85-8.83,10.51-8.83,4.87,0,8.13,1.91,9.88,6.97.82,2.38,3.07,3.99,5.59,3.99h25.61s2.79,0,2.79,0c3.27,0,5.92,2.65,5.92,5.92v21.41c0,3.27-2.65,5.92-5.92,5.92h-1.85Z';

type LogoVariant = 'wordmark' | 'symbol';

const LIQUID_MOTION = {
  baseBlur: 0.017,
  threshold: 15,
  mainBlur: 0.01,
  mainRadius: 0.31,
  mainSpots: 2,
  secBlur: 0.018,
  secRadius: 0.14,
  secSpots: 3,
  roundness: 0.55,
  rotationSpeed: 0.5,
  orbitSpeed: 0.6,
  cursorPull: 0.3,
  follow: 0.29,
  wobble: 0.008,
} as const;

const SYMBOL_PATH = 'M310.96,167.9V1.64h-40v73.87c0,7.82-10.27,10.73-14.37,4.06L208.78,1.69h-36.4v36.49c0,1.9-.17,3.8-.51,5.68l-.08.44c-1.27,6.62-10.15,8.1-13.52,2.25l-1.15-1.99C142.99,17.99,114.93-.18,82.92,0,37.08.26,0,37.5,0,83.4c0,30.57,16.45,57.3,40.98,71.82,4.72,2.79,5.18,9.49.82,12.82-11.64,8.89-19.12,21.42-19.12,35.91,0,22,13.39,36.67,42.84,47.9,16.31,6.19,36.27,12.15,36.27,25.67,0,9.17-7.79,16.27-17.28,16.27s-16.3-6.47-18.34-16.82c-.72-3.66-3.89-6.32-7.62-6.32H19.76s0,3.67,0,3.67c0,36.44,25.81,55.7,65,55.7,24.48,0,42.99-7.61,53.37-21.39v.16l.8-1.14c4.58-6.55,14.77-3.47,15.11,4.36v15.09h42.09v-17.54h.03s0-.05,0-.07c0-6.83,5.53-12.36,12.36-12.36s12.36,5.53,12.36,12.36c0,.03,0,.05,0,.07h0v17.05h94.89v-37.14h-40.85c-6.59,0-11.93-5.34-11.93-11.93v-96.49c0-7.25,5.88-13.13,13.13-13.13h34.85ZM48.48,54.57c6.09-12.67,19.92-18.5,34.92-18.5s28.83,5.83,34.92,18.5c2.46,5.12-1.34,11.05-7.02,11.05h-27.74s-.31,0-.31,0h-27.74c-5.68,0-9.48-5.93-7.02-11.05ZM47.44,109.38c-2.59-5.32,1.26-11.52,7.18-11.52h28.62s.32,0,.32,0h28.62c5.92,0,9.77,6.2,7.18,11.52-6.31,12.98-20.53,22.03-35.96,22.03s-29.65-9.05-35.96-22.03ZM141.9,254.02c-.98-.52-1.79-1.3-2.49-2.16-7.19-9.01-19.98-16.98-41.5-25.68-19.72-8.02-29.46-12.6-29.46-22.69,0-7.56,7.3-13.29,15.82-13.29,7.51,0,12.48,3.02,15.05,11.06,1.03,3.22,3.96,5.44,7.34,5.44h35.41s4.03,0,4.03,0h.17c4.28,0,7.76,3.47,7.76,7.76v32.62c-.3,6.24-7.03,9.67-12.14,6.95ZM154.04,167.27h0c0,3.32-.24,6.64-.71,9.92h0c-.73,5.11-5.37,7.51-9.39,6.6-2.01-.45-3.68-1.83-4.74-3.6-.2-.33-.4-.65-.6-.97,0-.01-.01-.02-.01-.03h0s0,0,0,0c-3.26-5.13-6.81-8.34-9-9.97-.13-.1-1.14-.76-2.56-1.69-4.8-3.13-4.67-10.16.2-13.17,13.24-8.2,24.02-20,30.97-34.04.26-.53.56-1.04.95-1.48,3.88-4.43,12-2.52,12.73,4.08l.39,3.79c.08.75.12,1.51.12,2.26v25.19c0,4.28-3.47,7.76-7.76,7.76h-5.24c-2.95,0-5.34,2.39-5.34,5.34ZM220.88,250.64h0s0,0,0,0c0,6.83-5.53,12.36-12.36,12.36s-12.36-5.53-12.36-12.36c0,0,0,0,0,0h-.03v-68.57c0-6.84,5.54-12.38,12.38-12.38h0c6.84,0,12.38,5.54,12.38,12.38v68.57ZM248.53,161.93h-21.53c-8.24,0-14.91-6.68-14.91-14.91v-50.85c0-9.03,11.85-12.38,16.58-4.68l31.04,50.45c5.38,8.74-.91,20-11.18,20Z';

const LOGO_GEOMETRY = {
  // 좌표계 크기 = SVG 필터 래스터 버퍼 크기. 원본 10526×11001은 필터 체인이
  // 프레임마다 거대 버퍼를 다시 그려 커서까지 버벅였다 — 1/15로 축소 (마스크 이미지가 늘어나므로 시각 동일).
  wordmark: { width: 701.73, height: 733.4, path: '', asset: '/assets/ensil-index-logo-mask.png' },
  symbol: { width: 315.77, height: 330, path: SYMBOL_PATH, asset: '' },
} as const;

type SpotRef = { normal: SVGEllipseElement | null; inverse: SVGEllipseElement | null };

function deterministicRandom(index: number) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function useSpotAnimation(
  svgRef: React.RefObject<SVGSVGElement | null>,
  mainRefs: React.MutableRefObject<SpotRef[]>,
  secondaryRefs: React.MutableRefObject<SpotRef[]>,
  displacementRef: React.RefObject<SVGFEDisplacementMapElement | null>,
  width: number,
  height: number,
) {
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const diagonal = Math.hypot(width, height);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: width * 0.5, y: height * 0.5 };
    let hovering = false;
    let hoverBlend = 0;
    let previousTime: number | null = null;
    let frame = 0;

    const makeSpot = (seed: number, radius: number, isCursor: boolean, refs: SpotRef) => {
      const anchorX = width * (0.15 + 0.7 * deterministicRandom(seed));
      const anchorY = height * (0.2 + 0.6 * deterministicRandom(seed + 1));
      return {
        refs,
        radius,
        isCursor,
        anchorX,
        anchorY,
        amplitudeX: width * (0.12 + 0.14 * deterministicRandom(seed + 2)),
        amplitudeY: height * (0.18 + 0.2 * deterministicRandom(seed + 3)),
        speed: 0.5 + 0.9 * deterministicRandom(seed + 4),
        phase: deterministicRandom(seed + 5) * Math.PI * 2,
        rotationPhase: deterministicRandom(seed + 6) * Math.PI * 2,
        rotationDirection: deterministicRandom(seed + 7) < 0.5 ? -1 : 1,
        scale: 0.75 + 0.5 * deterministicRandom(seed + 8),
        x: anchorX,
        y: anchorY,
      };
    };

    const spots = [
      ...Array.from({ length: LIQUID_MOTION.mainSpots }, (_, index) => makeSpot(
        index * 11 + 1,
        LIQUID_MOTION.mainRadius,
        index === 0,
        mainRefs.current[index],
      )),
      ...Array.from({ length: LIQUID_MOTION.secSpots }, (_, index) => makeSpot(
        index * 13 + 101,
        LIQUID_MOTION.secRadius,
        false,
        secondaryRefs.current[index],
      )),
    ];

    // 포인터 이벤트에서는 좌표만 저장 — getScreenCTM(레이아웃 강제)은 렌더 틱에서 1회만
    const pointerClient = { x: 0, y: 0 };
    const handlePointerMove = (event: PointerEvent) => {
      pointerClient.x = event.clientX;
      pointerClient.y = event.clientY;
      hovering = true;
    };
    const handlePointerLeave = () => { hovering = false; };

    // rx/ry는 상수 — 최초 1회만 기록, 프레임마다는 cx/cy/rotate만 갱신
    const setEllipseStatic = (ellipse: SVGEllipseElement | null, radius: number) => {
      if (!ellipse) return;
      ellipse.setAttribute('rx', radius.toFixed(3));
      ellipse.setAttribute('ry', (radius * LIQUID_MOTION.roundness).toFixed(3));
    };
    spots.forEach((spot) => {
      const radius = spot.radius * diagonal * spot.scale;
      setEllipseStatic(spot.refs.normal, radius);
      setEllipseStatic(spot.refs.inverse, radius);
    });

    const setEllipse = (ellipse: SVGEllipseElement | null, spot: typeof spots[number], angle: string) => {
      if (!ellipse) return;
      ellipse.setAttribute('cx', spot.x.toFixed(3));
      ellipse.setAttribute('cy', spot.y.toFixed(3));
      ellipse.setAttribute('transform', `rotate(${angle} ${spot.x.toFixed(3)} ${spot.y.toFixed(3)})`);
    };

    // 필터 재래스터가 지배 비용 — 로고는 30fps로도 충분히 리퀴드하다
    const FRAME_MS = 33;
    let lastTick = 0;
    let tickCount = 0;
    const render = (now: number) => {
      frame = window.requestAnimationFrame(render);
      if (now - lastTick < FRAME_MS) return;
      lastTick = now;
      tickCount += 1;
      if (previousTime === null) previousTime = now;
      const delta = Math.min((now - previousTime) / 1000, 0.06);
      previousTime = now;
      const time = now / 1000;

      if (hovering) {
        const matrix = svg.getScreenCTM();
        if (matrix) {
          const local = new DOMPoint(pointerClient.x, pointerClient.y).matrixTransform(matrix.inverse());
          pointer.x = local.x;
          pointer.y = local.y;
        }
      }
      hoverBlend += ((hovering ? 1 : 0) - hoverBlend) * (1 - Math.exp(-3 * delta));
      const follow = 1 - Math.exp(-LIQUID_MOTION.follow * delta * 60);
      const motion = reducedMotion ? 0 : 1;

      spots.forEach((spot) => {
        const orbit = time * spot.speed * LIQUID_MOTION.orbitSpeed * motion + spot.phase;
        let targetX = spot.anchorX + Math.sin(orbit) * spot.amplitudeX;
        let targetY = spot.anchorY + Math.sin(orbit * 2) * spot.amplitudeY;
        const pull = spot.isCursor ? hoverBlend : LIQUID_MOTION.cursorPull * hoverBlend;
        targetX += (pointer.x - targetX) * pull;
        targetY += (pointer.y - targetY) * pull;
        spot.x += (targetX - spot.x) * follow;
        spot.y += (targetY - spot.y) * follow;

        const angle = ((spot.rotationPhase + time * LIQUID_MOTION.rotationSpeed * spot.rotationDirection * motion) * 180 / Math.PI).toFixed(1);
        setEllipse(spot.refs.normal, spot, angle);
        setEllipse(spot.refs.inverse, spot, angle);
      });

      // 디스플레이스먼트 강도는 900ms 주기 사인 — 5Hz 갱신이면 충분 (필터 무효화 최소화)
      const displacement = displacementRef.current;
      if (displacement && tickCount % 6 === 0) {
        const wobble = reducedMotion
          ? 0
          : LIQUID_MOTION.wobble * diagonal * (0.75 + 0.25 * Math.sin(now / 900));
        displacement.setAttribute('scale', wobble.toFixed(2));
      }
    };

    svg.addEventListener('pointermove', handlePointerMove, { passive: true });
    svg.addEventListener('pointerleave', handlePointerLeave);
    frame = window.requestAnimationFrame(render);
    return () => {
      svg.removeEventListener('pointermove', handlePointerMove);
      svg.removeEventListener('pointerleave', handlePointerLeave);
      window.cancelAnimationFrame(frame);
    };
  }, [displacementRef, height, mainRefs, secondaryRefs, svgRef, width]);
}

export function LiquidEnsilLogo({ variant = 'wordmark', className = '' }: { variant?: LogoVariant; className?: string }) {
  const geometry = LOGO_GEOMETRY[variant];
  const uid = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const mainRefs = useRef<SpotRef[]>([]);
  const secondaryRefs = useRef<SpotRef[]>([]);
  const displacementRef = useRef<SVGFEDisplacementMapElement>(null);
  useSpotAnimation(svgRef, mainRefs, secondaryRefs, displacementRef, geometry.width, geometry.height);

  const id = (name: string) => `${name}-${uid}`;
  const diagonal = Math.hypot(geometry.width, geometry.height);
  const filterPadding = diagonal * 0.4;
  const thresholdMatrix = `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${LIQUID_MOTION.threshold} ${-(LIQUID_MOTION.threshold * 0.4).toFixed(2)}`;
  const ellipseRef = (
    refs: React.MutableRefObject<SpotRef[]>,
    index: number,
    key: keyof SpotRef,
    node: SVGEllipseElement | null,
  ) => {
    refs.current[index] ??= { normal: null, inverse: null };
    refs.current[index][key] = node;
  };
  const logoShape = geometry.asset ? (
    <rect width={geometry.width} height={geometry.height} fill="currentColor" mask={`url(#${id('asset-mask')})`} />
  ) : (
    <path d={geometry.path} fill="currentColor" />
  );

  return (
    <svg
      ref={svgRef}
      className={`liquid-ensil-logo liquid-ensil-logo--${variant} ${className}`.trim()}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      role="img"
      aria-label="ENSIL"
    >
      <defs>
        {geometry.asset && (
          <mask id={id('asset-mask')} maskUnits="userSpaceOnUse" x="0" y="0" width={geometry.width} height={geometry.height}>
            <image href={geometry.asset} x="0" y="0" width={geometry.width} height={geometry.height} preserveAspectRatio="none" />
          </mask>
        )}
        <radialGradient id={id('spot-white')}>
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="40%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('spot-black')}>
          <stop offset="0%" stopColor="black" stopOpacity="1" />
          <stop offset="40%" stopColor="black" stopOpacity="1" />
          <stop offset="100%" stopColor="black" stopOpacity="0" />
        </radialGradient>

        <mask id={id('main-mask')} maskUnits="userSpaceOnUse" x={-filterPadding} y={-filterPadding} width={geometry.width + filterPadding * 2} height={geometry.height + filterPadding * 2}>
          <rect x={-filterPadding} y={-filterPadding} width={geometry.width + filterPadding * 2} height={geometry.height + filterPadding * 2} fill="black" />
          {Array.from({ length: LIQUID_MOTION.mainSpots }, (_, index) => (
            <ellipse key={index} fill={`url(#${id('spot-white')})`} ref={(node) => ellipseRef(mainRefs, index, 'normal', node)} />
          ))}
        </mask>
        <mask id={id('secondary-mask')} maskUnits="userSpaceOnUse" x={-filterPadding} y={-filterPadding} width={geometry.width + filterPadding * 2} height={geometry.height + filterPadding * 2}>
          <rect x={-filterPadding} y={-filterPadding} width={geometry.width + filterPadding * 2} height={geometry.height + filterPadding * 2} fill="black" />
          {Array.from({ length: LIQUID_MOTION.secSpots }, (_, index) => (
            <ellipse key={index} fill={`url(#${id('spot-white')})`} ref={(node) => ellipseRef(secondaryRefs, index, 'normal', node)} />
          ))}
        </mask>
        <mask id={id('inverse-mask')} maskUnits="userSpaceOnUse" x={-filterPadding} y={-filterPadding} width={geometry.width + filterPadding * 2} height={geometry.height + filterPadding * 2}>
          <rect x={-filterPadding} y={-filterPadding} width={geometry.width + filterPadding * 2} height={geometry.height + filterPadding * 2} fill="white" />
          {Array.from({ length: LIQUID_MOTION.mainSpots }, (_, index) => (
            <ellipse key={`main-${index}`} fill={`url(#${id('spot-black')})`} ref={(node) => ellipseRef(mainRefs, index, 'inverse', node)} />
          ))}
          {Array.from({ length: LIQUID_MOTION.secSpots }, (_, index) => (
            <ellipse key={`secondary-${index}`} fill={`url(#${id('spot-black')})`} ref={(node) => ellipseRef(secondaryRefs, index, 'inverse', node)} />
          ))}
        </mask>

        <filter id={id('base-filter')} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={LIQUID_MOTION.baseBlur * diagonal} />
        </filter>
        <filter id={id('secondary-filter')} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={LIQUID_MOTION.secBlur * diagonal} />
        </filter>
        <filter id={id('main-filter')} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={LIQUID_MOTION.mainBlur * diagonal} />
        </filter>
        <filter id={id('final-filter')} x="-40%" y="-40%" width="180%" height="180%">
          <feColorMatrix in="SourceGraphic" type="matrix" values={thresholdMatrix} result="threshold" />
          <feTurbulence type="fractalNoise" baseFrequency={(8 / diagonal).toFixed(4)} numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap ref={displacementRef} in="threshold" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <g filter={`url(#${id('final-filter')})`}>
        <g mask={`url(#${id('inverse-mask')})`}>
          {logoShape}
        </g>
        <g filter={`url(#${id('secondary-filter')})`} mask={`url(#${id('secondary-mask')})`}>
          {logoShape}
        </g>
        <g filter={`url(#${id('main-filter')})`} mask={`url(#${id('main-mask')})`}>
          {logoShape}
        </g>
      </g>
    </svg>
  );
}

export function EnsilWordmark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 412.64 116.94" aria-hidden="true">
      <path d={WORDMARK_PATH} fill="currentColor" />
    </svg>
  );
}
