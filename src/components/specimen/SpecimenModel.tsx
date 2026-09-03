import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Creature } from '../../types/creature';
import { cloneCreature, creatureModelUrl, loadCreatureModel } from '../../sim3d/creatureModel';

/**
 * 표본 모드 중앙 비주얼 — 개체 GLB 단독 뷰어 (개체별 에셋 없으면 공용 모델).
 * 배경 투명(alpha)이라 .visual의 CSS 글로우 링이 뒤에 비친다.
 * 자동 회전 + 드래그 궤도. 지오메트리는 캐시 원본과 공유(sharedGeo)라 dispose하지 않는다.
 */
export function SpecimenModel({ creature }: { creature?: Creature }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const modelUrl = creatureModelUrl(creature);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 50);
    camera.position.set(0, 0.62, 1.9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.42, 0);
    controls.enablePan = false;
    controls.minDistance = 1;
    controls.maxDistance = 3.2;
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.1;

    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(2, 3, 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.45);
    fill.position.set(-2, 1, -2);
    scene.add(fill);

    let unmounted = false;
    loadCreatureModel(modelUrl).then((model) => {
      if (unmounted) return;
      scene.add(cloneCreature(model, 1));
    });

    const resize = () => {
      const { clientWidth: cw, clientHeight: ch } = mount;
      renderer.setSize(cw, ch);
      camera.aspect = cw / Math.max(1, ch);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let raf = 0;
    const frame = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      unmounted = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry && !m.userData.sharedGeo) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
    };
  }, [modelUrl]);

  return <div className="visual-model" ref={mountRef} />;
}
