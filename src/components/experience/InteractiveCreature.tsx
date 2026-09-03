import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getGLTFLoader } from '../../sim3d/gltf';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CreatureRecord } from '../../data/creatureRecords';

type ViewerApi = { controls: OrbitControls; pivot: THREE.Group };

function proxyModel(id: string) {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x002928, roughness: 0.55, metalness: 0.18 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, roughness: 0.7, metalness: 0.06 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, position?: [number, number, number]) => {
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(...position);
    group.add(mesh);
    return mesh;
  };

  if (id === 'eo-002') {
    add(new THREE.TorusKnotGeometry(1.5, 0.2, 120, 12, 2, 3), dark).rotation.x = 0.7;
    add(new THREE.SphereGeometry(0.5, 20, 14), pale);
  } else if (id === 'eo-003') {
    add(new THREE.SphereGeometry(1.05, 24, 16), pale);
    [1.5, 1.9, 2.3].forEach((radius, index) => {
      const ring = add(new THREE.TorusGeometry(radius, 0.055, 6, 72), dark);
      ring.rotation.set(Math.PI / 2 + index * 0.26, index * 0.42, 0);
    });
  } else if (id === 'eo-004') {
    add(new THREE.OctahedronGeometry(0.95, 1), dark);
    const wing = new THREE.CircleGeometry(1.8, 3);
    add(wing, pale, [-1.25, 0, 0]).rotation.y = -0.32;
    add(wing.clone(), pale, [1.25, 0, 0]).rotation.y = 0.32;
  } else {
    add(new THREE.IcosahedronGeometry(1.55, 2), pale);
    const eye = add(new THREE.TorusGeometry(0.76, 0.12, 8, 48), dark, [0, 0, 1.25]);
    eye.rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.3, 18, 12), dark, [0, 0, 1.35]);
  }
  return group;
}

export function InteractiveCreature({ record }: { record: CreatureRecord }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ViewerApi | null>(null);
  const autoRef = useRef(true);
  const pausedRef = useRef(false);
  const anatomyRef = useRef(false);
  const impulseUntilRef = useRef(0);
  const [loading, setLoading] = useState(0);
  const [ready, setReady] = useState(false);
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(false);
  const [anatomy, setAnatomy] = useState(false);
  const [touchCount, setTouchCount] = useState(0);

  useEffect(() => { autoRef.current = auto; }, [auto]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { anatomyRef.current = anatomy; }, [anatomy]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    setReady(false);
    setLoading(record.modelUrl ? 0 : 100);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    camera.position.set(0.15, 0.1, 6.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, reducedMotion ? 1.25 : 1.8));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 9;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.65;
    controls.autoRotateSpeed = 0.62;
    controls.saveState();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x002928, 2.7));
    const key = new THREE.DirectionalLight(0xffffff, 4.2);
    key.position.set(4, 5, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 1.8);
    rim.position.set(-4, 1, -3);
    scene.add(rim);

    const pivot = new THREE.Group();
    scene.add(pivot);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let lastActivity = performance.now();
    let down = { x: 0, y: 0 };

    const fitAndAdd = (object: THREE.Object3D) => {
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;
      });
      const before = new THREE.Box3().setFromObject(object);
      const size = before.getSize(new THREE.Vector3());
      object.scale.setScalar(2.9 / (Math.max(size.x, size.y, size.z) || 1));
      const after = new THREE.Box3().setFromObject(object);
      object.position.sub(after.getCenter(new THREE.Vector3()));
      pivot.add(object);
      setLoading(100);
      setReady(true);
    };

    const modelUrl = record.modelUrl; // 콜백 안에서도 string으로 유지
    if (modelUrl) {
      getGLTFLoader().then((loader) => loader.load(
        modelUrl,
        (gltf) => fitAndAdd(gltf.scene),
        (event) => event.total && setLoading(Math.min(99, Math.round((event.loaded / event.total) * 100))),
        () => setReady(true),
      ));
    } else {
      fitAndAdd(proxyModel(record.id));
    }

    const updatePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
        -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1,
      );
      lastActivity = performance.now();
    };
    const onPointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; updatePointer(event); };
    const onPointerUp = (event: PointerEvent) => {
      updatePointer(event);
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return;
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.intersectObject(pivot, true).length) return;
      impulseUntilRef.current = performance.now() + 1150;
      setTouchCount((value) => value + 1);
    };
    const reset = () => { controls.reset(); pivot.rotation.set(0, 0, 0); };
    const onDoubleClick = () => reset();
    renderer.domElement.addEventListener('pointermove', updatePointer);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('dblclick', onDoubleClick);

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

    apiRef.current = { controls, pivot };
    const startedAt = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const elapsed = (now - startedAt) / 1000;
      controls.autoRotate = autoRef.current && !pausedRef.current;
      controls.update();
      if (!pausedRef.current) {
        const impulse = Math.max(0, (impulseUntilRef.current - now) / 1150);
        pivot.position.y = Math.sin(elapsed * 0.72) * (reducedMotion ? 0.015 : 0.075);
        pivot.rotation.z += ((Math.sin(impulse * Math.PI * 4) * impulse * 0.07) - pivot.rotation.z) * 0.12;
        const reactionScale = 1 - Math.sin(impulse * Math.PI) * 0.045;
        pivot.scale.setScalar(reactionScale);
      }
      pivot.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial) mat.wireframe = anatomyRef.current;
        });
      });
      if (now - lastActivity > 9000) controls.autoRotate = !pausedRef.current;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      apiRef.current = null;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', updatePointer);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('dblclick', onDoubleClick);
      controls.dispose();
      scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry?.dispose();
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => mat.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [record.id, record.modelUrl]);

  const reset = () => {
    apiRef.current?.controls.reset();
    apiRef.current?.pivot.rotation.set(0, 0, 0);
  };

  return (
    <section className="record-viewer" aria-label={`Interactive model of ${record.name}`}>
      <div className="record-viewer__canvas" ref={mountRef} />
      {!ready && <div className="record-viewer__loading"><span>LOADING BODY</span><b>{loading}%</b></div>}
      {!record.modelUrl && <span className="record-viewer__pending">MODEL PENDING / BEHAVIOUR PROXY ACTIVE</span>}
      {anatomy && (
        <div className="anatomy-labels" aria-hidden>
          <span className="anatomy-labels__a">SENSOR ARRAY</span>
          <span className="anatomy-labels__b">KINETIC BODY</span>
          <span className="anatomy-labels__c">SIGNAL MEMORY</span>
        </div>
      )}
      <div className="record-controls" aria-label="3D model controls">
        <button type="button" onClick={() => setAuto((value) => !value)} aria-pressed={auto}>AUTO</button>
        <button type="button" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>{paused ? 'PLAY' : 'PAUSE'}</button>
        <button type="button" onClick={reset}>RESET</button>
        <button type="button" onClick={() => setAnatomy((value) => !value)} aria-pressed={anatomy}>ANATOMY</button>
      </div>
      <p className="record-viewer__instruction">DRAG TO ORBIT · SCROLL TO ZOOM · CLICK THE BODY TO RESPOND · {touchCount.toString().padStart(2, '0')} CONTACTS</p>
    </section>
  );
}
