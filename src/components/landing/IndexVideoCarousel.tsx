import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from 'react';
import { CREATURE_RECORDS, type CreatureRecord } from '../../data/creatureRecords';
import { InteractiveFrameBackground } from './InteractiveFrameBackground';
import { FluidHub } from './FluidHub';

const VIDEO_SOURCES = [
  '/media/index/no-01.mp4',
  '/media/index/no-02.mp4',
  '/media/index/no-03.mp4',
  '/media/index/no-04.mp4',
];

type DialTheme = {
  background: string;
  ink: string;
  line: string;
  signal: string;
};

type CreatureDialItem = {
  kind: 'creature';
  key: string;
  index: number;
  record: CreatureRecord;
  video: string;
  eyebrow: string;
  title: string;
  description: string;
  theme: DialTheme;
};

type InformationDialItem = {
  kind: 'information';
  key: string;
  code: string;
  eyebrow: string;
  title: string;
  shortTitle: string;
  description: string;
  action?: 'about' | 'field';
  theme: DialTheme;
};

type DialItem = CreatureDialItem | InformationDialItem;

const THEMES = {
  paper: { background: '#FFFFFF', ink: '#002928', line: 'rgba(0, 41, 40, .12)', signal: '#D9D9D9' },
  mist: { background: '#D9D9D9', ink: '#002928', line: 'rgba(0, 41, 40, .12)', signal: '#FFFFFF' },
  mineral: { background: '#FFFFFF', ink: '#002928', line: 'rgba(0, 41, 40, .14)', signal: '#D9D9D9' },
  dark: { background: '#002928', ink: '#FFFFFF', line: 'rgba(255, 255, 255, .2)', signal: '#D9D9D9' },
} satisfies Record<string, DialTheme>;

const creatureItem = (index: number, theme: DialTheme): CreatureDialItem => {
  const record = CREATURE_RECORDS[index];
  return {
    kind: 'creature',
    key: record.id,
    index,
    record,
    video: VIDEO_SOURCES[index],
    eyebrow: `${record.code} / LIVING RECORD`,
    title: record.shortName,
    description: `${record.sensor}. ${record.response}.`,
    theme,
  };
};

const DIAL_ITEMS: DialItem[] = [
  creatureItem(0, THEMES.paper),
  {
    kind: 'information', key: 'sensing', code: '02', eyebrow: 'WORLD SYSTEM / INPUT',
    title: 'Sensing becomes behaviour.', shortTitle: 'SENSING',
    description: 'Pressure, proximity, sound and collective current are not interface commands. They are environmental conditions that each organism interprets differently.',
    theme: THEMES.mist,
  },
  {
    kind: 'information', key: 'field', code: '03', eyebrow: 'LIVE SYSTEM / SHARED HABITAT',
    title: 'Enter the living field.', shortTitle: 'FIELD',
    description: 'Observe four electronic organisms sharing one responsive habitat. The field continues to change even when nobody is watching.',
    action: 'field', theme: THEMES.dark,
  },
  creatureItem(1, THEMES.paper),
  {
    kind: 'information', key: 'fermentation', code: '05', eyebrow: 'PROCESS / TRANSFORMATION',
    title: 'Electro-fermentation.', shortTitle: 'FERMENT',
    description: 'Discarded devices are treated as unstable biological material. Time, residue and residual signal reorganise them into autonomous bodies.',
    theme: THEMES.mineral,
  },
  {
    kind: 'information', key: 'residue', code: '06', eyebrow: 'MATTER / MEMORY',
    title: 'A body remembers its previous use.', shortTitle: 'RESIDUE',
    description: 'A switch remembers pressure. A speaker remembers sound. A cable remembers current. Old functions persist as new instincts.',
    theme: THEMES.mist,
  },
  creatureItem(2, THEMES.paper),
  {
    kind: 'information', key: 'archive', code: '08', eyebrow: 'LIVING RECORDS / 01—04',
    title: 'The archive remains alive.', shortTitle: 'ARCHIVE',
    description: 'Each record combines origin, sensory behaviour, ecological response and a live three-dimensional specimen.',
    theme: THEMES.dark,
  },
  {
    kind: 'information', key: 'observation', code: '09', eyebrow: 'METHOD / NON-CONTROL',
    title: 'Observe, do not command.', shortTitle: 'OBSERVE',
    description: 'Interaction reveals the ecology rather than controlling it. A response may be immediate, delayed or incomplete.',
    theme: THEMES.mist,
  },
  creatureItem(3, THEMES.paper),
  {
    kind: 'information', key: 'about', code: '11', eyebrow: 'ENSIL / BRAND',
    title: 'About ENSIL.', shortTitle: 'ABOUT',
    description: 'A research archive for imagined life emerging from obsolete electronic matter.',
    action: 'about', theme: THEMES.mineral,
  },
  {
    kind: 'information', key: 'history', code: '12', eyebrow: 'HISTORY / ONGOING',
    title: 'From object to organism.', shortTitle: 'HISTORY',
    description: 'ENSIL began by asking how an electronic object might evolve when its original purpose disappears.',
    action: 'about', theme: THEMES.mist,
  },
];

const SLOT = 100 / DIAL_ITEMS.length;
const TOP_POSITION = 75;
const wrapIndex = (value: number) => ((value % DIAL_ITEMS.length) + DIAL_ITEMS.length) % DIAL_ITEMS.length;

type DragState = {
  pointerId: number;
  startY: number;
  lastY: number;
  lastAt: number;
  velocity: number;
  moved: boolean;
};

export function IndexVideoCarousel() {
  const [step, setStep] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [motionLevel, setMotionLevel] = useState(0);
  const [pointerSize, setPointerSize] = useState(124);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const rootRef = useRef<HTMLElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const wheelAtRef = useRef(0);
  const motionTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  const activeIndex = wrapIndex(step);
  const activeItem = DIAL_ITEMS[activeIndex];

  const pulseMotion = (amount: number) => {
    setMotionLevel(Math.min(1, Math.max(.18, amount)));
    if (motionTimerRef.current) window.clearTimeout(motionTimerRef.current);
    motionTimerRef.current = window.setTimeout(() => setMotionLevel(0), 520);
  };

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduceMotion(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onPointerSizeKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.matches('input, textarea, select')) return;
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setPointerSize((current) => Math.min(640, current + 32));
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        setPointerSize((current) => Math.max(64, current - 32));
      }
    };
    window.addEventListener('keydown', onPointerSizeKey);
    return () => window.removeEventListener('keydown', onPointerSizeKey);
  }, []);

  useEffect(() => () => {
    if (motionTimerRef.current) window.clearTimeout(motionTimerRef.current);
  }, []);

  useEffect(() => {
    rootRef.current?.querySelectorAll<HTMLVideoElement>('video[data-dial-index]').forEach((video) => {
      const index = Number(video.dataset.dialIndex);
      if (!reduceMotion && index === activeIndex) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
        if (video.readyState >= 1) video.currentTime = 0;
      }
    });
  }, [activeIndex, reduceMotion]);

  useEffect(() => {
    if (!aboutOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAboutOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [aboutOpen]);

  const pulseAndMove = (amount: number) => {
    if (!amount) return;
    setStep((current) => current + amount);
    setDragOffset(0);
    pulseMotion(Math.min(1, Math.abs(amount) * .42));
  };

  const selectIndex = (index: number) => {
    let delta = index - activeIndex;
    if (delta > DIAL_ITEMS.length / 2) delta -= DIAL_ITEMS.length;
    if (delta < -DIAL_ITEMS.length / 2) delta += DIAL_ITEMS.length;
    pulseAndMove(delta);
  };

  const updatePointerPosition = (clientX: number, clientY: number) => {
    const root = rootRef.current;
    if (!root) return;
    root.style.setProperty('--pointer-x', `${(clientX / window.innerWidth - .5) * 2}`);
    root.style.setProperty('--pointer-y', `${(clientY / window.innerHeight - .5) * 2}`);
    root.style.setProperty('--pointer-client-x', `${clientX}px`);
    root.style.setProperty('--pointer-client-y', `${clientY}px`);
  };

  const activateInformation = (item: InformationDialItem, index: number) => {
    if (suppressClickRef.current) return;
    if (index !== activeIndex) {
      selectIndex(index);
      return;
    }
    if (item.action === 'about') setAboutOpen(true);
    if (item.action === 'field') window.location.hash = '/field';
  };

  const onWheel = (event: WheelEvent<HTMLElement>) => {
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(delta) < 4) return;
    event.preventDefault();
    const now = performance.now();
    if (now - wheelAtRef.current < 165) return;
    wheelAtRef.current = now;
    pulseAndMove(delta > 0 ? 1 : -1);
    pulseMotion(Math.min(1, Math.abs(delta) / 110));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    updatePointerPosition(event.clientX, event.clientY);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastAt: performance.now(),
      velocity: 0,
      moved: false,
    };
    setIsDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    updatePointerPosition(event.clientX, event.clientY);
    if (!drag || drag.pointerId !== event.pointerId) return;

    const now = performance.now();
    const deltaY = event.clientY - drag.startY;
    const elapsed = Math.max(1, now - drag.lastAt);
    drag.velocity = (event.clientY - drag.lastY) / elapsed;
    drag.lastY = event.clientY;
    drag.lastAt = now;

    if (Math.abs(deltaY) > 6 && !drag.moved) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const preview = Math.max(-SLOT * 2.6, Math.min(SLOT * 2.6, (deltaY / window.innerHeight) * 34));
    setDragOffset(preview);
    pulseMotion(Math.min(1, Math.abs(drag.velocity) * 2.4));
  };

  const finishPointer = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.moved) {
      suppressClickRef.current = true;
      const projectedOffset = dragOffset + drag.velocity * 70;
      const slots = Math.max(-3, Math.min(3, Math.round(-projectedOffset / SLOT)));
      if (slots) pulseAndMove(slots);
      else setDragOffset(0);
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    } else {
      setDragOffset(0);
    }

    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const sceneStyle = {
    '--stage-bg': activeItem.theme.background,
    '--stage-ink': activeItem.theme.ink,
    '--stage-line': activeItem.theme.line,
    '--stage-signal': activeItem.theme.signal,
    '--motion-level': motionLevel,
    '--pointer-effect-size': `${pointerSize}px`,
  } as CSSProperties;

  return (
    <section
      ref={rootRef}
      className={`index-dial${isDragging ? ' is-dragging' : ''}${motionLevel ? ' is-spinning' : ''}`}
      style={sceneStyle}
      aria-roledescription="carousel"
      aria-label="ENSIL circular archive"
      data-pointer-size={pointerSize}
      tabIndex={0}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
          event.preventDefault();
          pulseAndMove(1);
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
          event.preventDefault();
          pulseAndMove(-1);
        }
        if (event.key === 'Enter' && activeItem.kind === 'information') {
          activateInformation(activeItem, activeIndex);
        }
      }}
    >
      <svg className="index-dial__duotone-filter" aria-hidden="true">
        <defs>
          <filter id="ensil-interface-duotone" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.2126 0.7152 0.0722 0 0
                      0.1784 0.6002 0.0606 0 0.1608
                      0.1793 0.6030 0.0609 0 0.1569
                      0 0 0 1 0"
            />
          </filter>
        </defs>
      </svg>

      <div className="index-dial__effect-plane">
        <InteractiveFrameBackground />

      <div className="index-dial__identity">
        <strong>ENSIL</strong>
      </div>

      <nav className="index-dial__utility" aria-label="ENSIL information">
        <button type="button" onClick={() => setAboutOpen(true)}>ABOUT ENSIL</button>
        <a href="#/field">ENTER FIELD ↗</a>
      </nav>

      <div className="index-dial__hub" aria-hidden data-fluid-window>
        <FluidHub />
      </div>

      <div className="index-dial__nodes">
        {DIAL_ITEMS.map((item, index) => {
          const distance = TOP_POSITION + index * SLOT - step * SLOT + dragOffset;
          const nodeStyle = { '--node-distance': `${distance}%` } as CSSProperties;
          if (item.kind === 'creature') {
            return (
              <a
                className={`index-dial__node index-dial__node--creature${index === activeIndex ? ' is-active' : ''}`}
                style={nodeStyle}
                href={`#/creature/${item.record.id}`}
                aria-label={`Open archive record for ${item.record.code}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={(event) => {
                  if (suppressClickRef.current) event.preventDefault();
                }}
                key={item.key}
              >
                <video
                  src={item.video}
                  data-dial-index={index}
                  muted
                  loop
                  playsInline
                  preload={index === activeIndex ? 'auto' : 'metadata'}
                  aria-hidden="true"
                />
                <span className="index-dial__node-label">
                  <b>{item.record.code}</b>
                  <i>OPEN RECORD ↗</i>
                </span>
              </a>
            );
          }

          return (
            <button
              type="button"
              className={`index-dial__node index-dial__node--information${index === activeIndex ? ' is-active' : ''}`}
              style={nodeStyle}
              aria-label={`${item.code}. ${item.title}`}
              aria-current={index === activeIndex ? 'true' : undefined}
              onClick={() => activateInformation(item, index)}
              key={item.key}
            >
              <span>{item.code}</span>
              <strong>{item.shortTitle}</strong>
            </button>
          );
        })}
      </div>

      </div>

      <p className="sr-only" aria-live="polite">Item {activeIndex + 1} of 12. {activeItem.title}</p>

      {aboutOpen ? (
        <aside className="index-about" aria-label="About ENSIL" aria-modal="true" role="dialog">
          <header>
            <span>ABOUT ENSIL / BRAND HISTORY</span>
            <button type="button" onClick={() => setAboutOpen(false)} aria-label="Close About ENSIL">CLOSE ×</button>
          </header>
          <div className="index-about__lead">
            <span>RESEARCHING ELECTRO-FERMENTATION</span>
            <h2>Archiving the life electronic residue might create.</h2>
          </div>
          <div className="index-about__body">
            <p>ENSIL is an evolving archive of electronic organisms. It imagines discarded switches, cables, processors, speakers and bulbs not as dead objects, but as matter capable of developing memory, instinct and ecology.</p>
            <ol>
              <li><span>01 / ORIGIN</span><p>Obsolete electronic objects are collected and classified by their former function.</p></li>
              <li><span>02 / FERMENTATION</span><p>Residual signals and material memory are treated as conditions for a new body to emerge.</p></li>
              <li><span>03 / OBSERVATION</span><p>Each organism is archived through its sensory input, response, habitat and ongoing behaviour.</p></li>
            </ol>
          </div>
          <footer>
            <a href="#/field">ENTER THE SHARED FIELD ↗</a>
            <button type="button" onClick={() => setAboutOpen(false)}>RETURN TO DIAL</button>
          </footer>
        </aside>
      ) : null}
    </section>
  );
}
