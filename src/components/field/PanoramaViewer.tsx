import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { CREATURE_RECORDS } from '../../data/creatureRecords';

type Props = {
  paused: boolean;
  /** 스테이지(프로젝터)에서 돌아온 개체 상태 — 있으면 핫스팟 라벨에 표시 */
  states?: Record<string, string>;
  onSelect: (id: string) => void;
  onProximity: (id: string | null) => void;
  onModeChange?: (mode: 'loading' | 'limited' | '360' | 'error') => void;
};

type HotspotPosition = { yaw: number; pitch: number; distance: number };

const HOTSPOTS: HotspotPosition[] = [
  { yaw: -0.62, pitch: 0.05, distance: 6.8 },
  { yaw: -0.2, pitch: -0.12, distance: 4.2 },
  { yaw: 0.23, pitch: 0.08, distance: 5.6 },
  { yaw: 0.65, pitch: -0.03, distance: 7.4 },
];

const PANORAMA_URL = '/panoramas/ensil-field-biome.png';

export function PanoramaViewer({ paused, states, onSelect, onProximity, onModeChange }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const hotspotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const callbacksRef = useRef({ onSelect, onProximity, onModeChange });
  const pausedRef = useRef(paused);
  const orientationRef = useRef<{ alpha: number; beta: number } | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [mode, setMode] = useState<'loading' | 'limited' | '360' | 'error'>('loading');
  const [motionActive, setMotionActive] = useState(false);

  callbacksRef.current = { onSelect, onProximity, onModeChange };
  pausedRef.current = paused;

  useEffect(() => {
    callbacksRef.current.onModeChange?.(mode);
  }, [mode]);

  useEffect(() => {
    if (!motionActive) return;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha == null || event.beta == null) return;
      orientationRef.current = {
        alpha: THREE.MathUtils.degToRad(event.alpha),
        beta: THREE.MathUtils.degToRad(event.beta - 90),
      };
    };
    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, [motionActive]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !window.matchMedia('(pointer: coarse)').matches, powerPreference: 'high-performance' });
    } catch {
      setMode('error');
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x002928);
    const camera = new THREE.PerspectiveCamera(62, 1, 0.01, 80);
    camera.rotation.order = 'YXZ';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.xr.enabled = true;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', 'Immersive ENSIL electronic fermentation panorama. Drag to look and select organism signals.');
    renderer.domElement.style.touchAction = 'none';
    mount.appendChild(renderer.domElement);

    let panoramaMesh: THREE.Mesh | null = null;
    let panoramaMode: 'limited' | '360' = 'limited';
    let vrButton: HTMLElement | null = null;
    let yaw = 0;
    let pitch = 0;
    let targetYaw = 0;
    let targetPitch = 0;
    let dragging = false;
    let pointerId = -1;
    let pointerX = 0;
    let pointerY = 0;
    let lastProximity: string | null = null;
    const keys = new Set<string>();
    let previousFrame = performance.now();
    const yawLimit = THREE.MathUtils.degToRad(47);
    const pitchMin = THREE.MathUtils.degToRad(-18);
    const pitchMax = THREE.MathUtils.degToRad(24);

    const applyTexture = (texture: THREE.Texture) => {
      const image = texture.image as { width?: number; height?: number };
      const aspect = (image.width ?? 16) / Math.max(image.height ?? 9, 1);
      panoramaMode = Math.abs(aspect - 2) < 0.08 ? '360' : 'limited';
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

      const geometry = panoramaMode === '360'
        ? new THREE.SphereGeometry(30, 96, 48)
        : new THREE.CylinderGeometry(10, 10, 20, 96, 1, true, -1.78, 3.56);
      if (panoramaMode === '360') geometry.scale(-1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ map: texture, side: panoramaMode === '360' ? THREE.FrontSide : THREE.BackSide });
      panoramaMesh = new THREE.Mesh(geometry, material);
      scene.add(panoramaMesh);
      renderer.domElement.dataset.panoramaMode = panoramaMode;
      setLoadProgress(100);
      setMode(panoramaMode);
    };

    new THREE.TextureLoader().load(
      PANORAMA_URL,
      applyTexture,
      (event) => event.total && setLoadProgress(Math.min(99, Math.round((event.loaded / event.total) * 100))),
      () => setMode('error'),
    );

    const xr = (navigator as Navigator & { xr?: { isSessionSupported: (mode: string) => Promise<boolean> } }).xr;
    if (window.isSecureContext && xr) {
      xr.isSessionSupported('immersive-vr').then((supported) => {
        if (!supported || !mount.isConnected) return;
        vrButton = VRButton.createButton(renderer);
        vrButton.classList.add('panorama-vr-button');
        mount.appendChild(vrButton);
      }).catch(() => undefined);
    }

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      pointerId = event.pointerId;
      pointerX = event.clientX;
      pointerY = event.clientY;
      renderer.domElement.setPointerCapture?.(event.pointerId);
      renderer.domElement.focus();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;
      const dx = event.clientX - pointerX;
      const dy = event.clientY - pointerY;
      pointerX = event.clientX;
      pointerY = event.clientY;
      targetYaw -= dx * 0.0032;
      targetPitch = THREE.MathUtils.clamp(targetPitch - dy * 0.0028, pitchMin, pitchMax);
      if (panoramaMode === 'limited') targetYaw = THREE.MathUtils.clamp(targetYaw, -yawLimit, yawLimit);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      dragging = false;
      pointerId = -1;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      camera.fov = THREE.MathUtils.clamp(camera.fov + event.deltaY * 0.025, 52, 72);
      camera.updateProjectionMatrix();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) return;
      event.preventDefault();
      keys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const onVisibility = () => { if (document.hidden) keys.clear(); };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('keydown', onKeyDown);
    renderer.domElement.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', onVisibility);

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const updateHotspots = () => {
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      let nearestId: string | null = null;
      let nearestAngle = 0.24;

      HOTSPOTS.forEach((position, index) => {
        const element = hotspotRefs.current[index];
        if (!element) return;
        let deltaYaw = position.yaw - yaw;
        if (panoramaMode === '360') deltaYaw = Math.atan2(Math.sin(deltaYaw), Math.cos(deltaYaw));
        const deltaPitch = position.pitch - pitch;
        const visible = Math.abs(deltaYaw) < horizontalFov * 0.58 && Math.abs(deltaPitch) < verticalFov * 0.58;
        element.dataset.visible = visible ? 'true' : 'false';
        if (visible) {
          const rawX = 50 + (deltaYaw / (horizontalFov / 2)) * 50;
          const y = 50 - (deltaPitch / (verticalFov / 2)) * 50;
          // 핫스팟은 가로 중앙 정렬(translateX(-50%))이라 절반 폭 + 여백만큼 안쪽으로 클램프
          const halfWidth = element.offsetWidth / 2 + 10;
          const leftMargin = (halfWidth / Math.max(mount.clientWidth, 1)) * 100;
          const rightLimit = 100 - leftMargin;
          const x = THREE.MathUtils.clamp(rawX, leftMargin, Math.max(leftMargin, rightLimit));
          element.style.setProperty('--hotspot-x', `${x}%`);
          element.style.setProperty('--hotspot-y', `${y}%`);
        }
        const angularDistance = Math.hypot(deltaYaw, deltaPitch);
        if (visible && angularDistance < nearestAngle) {
          nearestAngle = angularDistance;
          nearestId = CREATURE_RECORDS[index].id;
        }
      });

      if (nearestId !== lastProximity) {
        lastProximity = nearestId;
        callbacksRef.current.onProximity(nearestId);
      }
    };

    renderer.setAnimationLoop((frameTime) => {
      if (document.hidden) return;
      const dt = Math.min((frameTime - previousFrame) / 1000, 0.05);
      previousFrame = frameTime;
      if (!pausedRef.current) {
        const turn = dt * 0.72;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) targetYaw += turn;
        if (keys.has('KeyD') || keys.has('ArrowRight')) targetYaw -= turn;
        if (keys.has('KeyW') || keys.has('ArrowUp')) targetPitch += turn * 0.6;
        if (keys.has('KeyS') || keys.has('ArrowDown')) targetPitch -= turn * 0.6;
        if (orientationRef.current) {
          targetYaw = panoramaMode === 'limited'
            ? THREE.MathUtils.clamp(-orientationRef.current.alpha * 0.35, -yawLimit, yawLimit)
            : -orientationRef.current.alpha;
          targetPitch = THREE.MathUtils.clamp(orientationRef.current.beta * 0.45, pitchMin, pitchMax);
        }
        targetPitch = THREE.MathUtils.clamp(targetPitch, pitchMin, pitchMax);
        if (panoramaMode === 'limited') targetYaw = THREE.MathUtils.clamp(targetYaw, -yawLimit, yawLimit);
        const damping = 1 - Math.exp(-9 * dt);
        yaw = THREE.MathUtils.lerp(yaw, targetYaw, damping);
        pitch = THREE.MathUtils.lerp(pitch, targetPitch, damping);
      }
      const baseYaw = panoramaMode === 'limited' ? Math.PI : 0;
      camera.rotation.set(pitch, baseYaw + yaw, 0, 'YXZ');
      updateHotspots();
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('keydown', onKeyDown);
      renderer.domElement.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibility);
      panoramaMesh?.geometry.dispose();
      if (panoramaMesh?.material instanceof THREE.Material) {
        const material = panoramaMesh.material as THREE.MeshBasicMaterial;
        material.map?.dispose();
        material.dispose();
      }
      vrButton?.remove();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  const requestMotion = async () => {
    if (!('DeviceOrientationEvent' in window)) return;
    const orientation = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
    try {
      if (orientation.requestPermission) {
        const permission = await orientation.requestPermission();
        if (permission !== 'granted') return;
      }
      setMotionActive(true);
    } catch {
      setMotionActive(false);
    }
  };

  return (
    <section className="panorama-viewer" aria-label="ENSIL field panorama">
      <div className="panorama-viewer__canvas" ref={mountRef} />
      {mode === 'loading' && <div className="panorama-loading"><span>FIELD TEXTURE / LOADING</span><strong>{loadProgress}%</strong></div>}
      {mode === 'error' && <div className="panorama-error">WEBGL OR PANORAMA TEXTURE UNAVAILABLE</div>}

      <div className="panorama-hotspots" aria-label="Living organism signals">
        {CREATURE_RECORDS.map((record, index) => (
          <button
            type="button"
            className="panorama-hotspot"
            data-visible="false"
            ref={(element) => { hotspotRefs.current[index] = element; }}
            onClick={() => callbacksRef.current.onSelect(record.id)}
            aria-label={`Observe ${record.name}, ${record.sensor}`}
            key={record.id}
          >
            <i aria-hidden><b>{record.code}</b></i>
            <span>
              <small>{record.sensor}</small>
              <small>{HOTSPOTS[index].distance.toFixed(1)}M / SIGNAL</small>
              {states?.[record.id] && <small className="panorama-hotspot__stage">STAGE / {states[record.id]}</small>}
            </span>
          </button>
        ))}
      </div>

      <div className="panorama-viewer__mode">
        <span>{mode === '360' ? '360° EQUIRECTANGULAR' : mode === 'limited' ? 'CURVED PANORAMA / LIMITED YAW' : 'FIELD INITIALISING'}</span>
        <button type="button" onClick={requestMotion} aria-pressed={motionActive}>{motionActive ? 'GYRO ACTIVE' : 'ENABLE GYRO'}</button>
      </div>
    </section>
  );
}
