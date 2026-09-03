import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Tilt } from '../../input/types';
import type { World } from '../../sim/types';
import { SIM_STATE_NAME } from '../../copy';
import {
  buildNodeMesh,
  buildSelectRing,
  makeLabelSprite,
  setGroupOpacity,
} from '../../sim3d/meshes';
import { cloneCreature, creatureModelUrl, loadCreatureModel } from '../../sim3d/creatureModel';
import type { OverlayFlags } from './TransportBar';

/**
 * 3D 렌더러 — 유니티식 3/4 뷰. world를 읽어 그리기만 한다 (엔진 스텝은 SimView 담당).
 * 월드 좌표 0~100 → X/Z -50~+50 평면.
 * 종별 프리미티브 목업(sim3d/meshes.ts)은 에셋이 나오면 GLTF로 교체.
 */

const W2S = (v: number) => v - 50; // world → scene

interface OrgVisual {
  group: THREE.Group;
  label: ReturnType<typeof makeLabelSprite>;
  trail: THREE.Line;
  trailGeo: THREE.BufferGeometry;
  baseScale: number;
}

export function ThreeStage({
  world,
  selectedId,
  overlays,
  onSelect,
  tiltRef,
  modelUrls,
}: {
  world: World;
  selectedId: string | null;
  overlays: OverlayFlags;
  onSelect: (id: string) => void;
  /** 물리 보드(IMU) 기울기 — 월드 그룹이 이 각도를 따라간다 (plan.md §7) */
  tiltRef?: React.RefObject<Tilt>;
  /** 개체 id → GLB 경로 (개체별 에셋, 없으면 공용 모델) */
  modelUrls?: Record<string, string>;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  // 최신 props를 rAF 루프에서 읽기 위한 ref
  const stateRef = useRef({ world, selectedId, overlays });
  stateRef.current = { world, selectedId, overlays };
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const tiltPropRef = useRef(tiltRef);
  tiltPropRef.current = tiltRef;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── 씬 기본 ──────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x002928);
    scene.fog = new THREE.Fog(0x002928, 105, 215);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    camera.position.set(0, 62, 74);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.minDistance = 30;
    controls.maxDistance = 160;
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xd9d9d9, 0.58));
    const sun = new THREE.DirectionalLight(0xffffff, 1.28);
    sun.position.set(40, 80, 30);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xd9d9d9, 0.58);
    rim.position.set(-45, 28, -36);
    scene.add(rim);

    // 월드 그룹 — 물리 보드(IMU)가 이 그룹의 기울기를 조종한다. "나노 보드 = 시뮬 바닥"
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // 바닥
    const grid = new THREE.GridHelper(100, 20, 0xd9d9d9, 0x002928);
    worldGroup.add(grid);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0x002928, roughness: 0.94, metalness: 0.08 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    worldGroup.add(ground);

    // ── 월드 오브젝트 ─────────────────────────
    const w = stateRef.current.world;

    const nodeGroup = new THREE.Group();
    for (const n of w.nodes) {
      const m = buildNodeMesh();
      m.position.set(W2S(n.pos.x), 0, W2S(n.pos.y));
      nodeGroup.add(m);
    }
    worldGroup.add(nodeGroup);

    const visuals = new Map<string, OrgVisual>();
    const pickables: THREE.Object3D[] = [];
    for (const o of w.organisms) {
      const group = new THREE.Group(); // GLB 로드 완료 시 모델이 채워진다
      const baseScale = 0.8 + (o.traits.charge / 10) * 0.7;
      group.scale.setScalar(baseScale);
      group.userData.orgId = o.id;
      worldGroup.add(group);
      pickables.push(group);

      const label = makeLabelSprite();
      label.sprite.position.y = 6;
      group.add(label.sprite);

      const trailGeo = new THREE.BufferGeometry();
      const trail = new THREE.Line(
        trailGeo,
        new THREE.LineBasicMaterial({ color: 0xd9d9d9, transparent: true, opacity: 0.38 }),
      );
      worldGroup.add(trail);

      visuals.set(o.id, { group, label, trail, trailGeo, baseScale });
    }

    const selectRing = buildSelectRing();
    selectRing.visible = false;
    worldGroup.add(selectRing);

    // ── 생물 모델 로드 (비동기) — 도착하면 각 개체 그룹에 꽂는다.
    //    URL별 캐시라 공용 모델이면 실제 로드는 1회 ──
    let unmounted = false;
    for (const [id, v] of visuals) {
      loadCreatureModel(modelUrls?.[id] ?? creatureModelUrl()).then((model) => {
        if (unmounted) return;
        v.group.add(cloneCreature(model, 4.5));
      });
    }

    // ── 리사이즈 ─────────────────────────────
    const resize = () => {
      const { clientWidth: cw, clientHeight: ch } = mount;
      renderer.setSize(cw, ch);
      camera.aspect = cw / Math.max(1, ch);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // ── 클릭 선택 (드래그=궤도 회전과 구분) ─────
    const raycaster = new THREE.Raycaster();
    const down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => { down.x = e.clientX; down.y = e.clientY; };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; // 드래그였음
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(pickables, true)[0];
      if (!hit) return;
      let obj: THREE.Object3D | null = hit.object;
      while (obj && !obj.userData.orgId) obj = obj.parent;
      if (obj?.userData.orgId) onSelectRef.current(obj.userData.orgId);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    // ── 렌더 루프 (world는 SimView의 엔진 루프가 변형) ──
    let raf = 0;
    const frame = () => {
      const { world: wld, selectedId: sel, overlays: ov } = stateRef.current;

      grid.visible = ov.grid;
      nodeGroup.visible = ov.nodes;

      for (const o of wld.organisms) {
        const v = visuals.get(o.id);
        if (!v) continue;
        v.group.position.set(W2S(o.pos.x), 0, W2S(o.pos.y));
        v.group.rotation.y = -o.heading; // 진행 방향으로 회전
        // 종별 시각 액센트
        if (o.species === 'led') {
          const blink = 0.75 + Math.sin(o.movePhase) * 0.25;
          v.group.scale.setScalar(v.baseScale * blink);
        } else if (o.species === 'capacitor') {
          const charge = Math.min(1, o.movePhase); // 충전량만큼 부푼다
          v.group.scale.set(v.baseScale, v.baseScale * (0.85 + charge * 0.3), v.baseScale);
        }

        const dim = sel !== null && o.id !== sel;
        setGroupOpacity(v.group, dim ? 0.42 : 1);

        v.label.sprite.visible = ov.labels && !dim;
        v.label.setText(`${o.code} · ${SIM_STATE_NAME[o.state]}`);

        v.trail.visible = ov.trails && !dim;
        if (ov.trails && o.trail.length > 1) {
          const pts = o.trail.map((p) => new THREE.Vector3(W2S(p.x), 0.1, W2S(p.y)));
          v.trailGeo.setFromPoints(pts);
        }

        if (o.id === sel) {
          selectRing.visible = true;
          selectRing.position.set(v.group.position.x, 0.06, v.group.position.z);
          selectRing.scale.setScalar(v.baseScale);
        }
      }
      if (sel === null) selectRing.visible = false;

      // 물리 보드 기울기 → 월드 그룹 (부드럽게 추종)
      const tilt = tiltPropRef.current?.current;
      if (tilt) {
        const clamp = (v: number) => Math.max(-0.45, Math.min(0.45, v));
        // 실보드 기준 보정: 축 교차(90°) + 양축 반전(180°) — 보드 장착 방향에 맞춤
        worldGroup.rotation.x += (clamp(tilt.roll) - worldGroup.rotation.x) * 0.12;
        worldGroup.rotation.z += (clamp(tilt.pitch) - worldGroup.rotation.z) * 0.12;
      }

      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      unmounted = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        // GLB 클론의 지오메트리는 캐시 원본과 공유 — dispose하면 다음 마운트가 깨진다
        if (m.geometry && !m.userData.sharedGeo) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
    };
    // world 교체(리셋) 시 씬 재구성
  }, [world]);

  return <div className="sim-stage" ref={mountRef} />;
}
