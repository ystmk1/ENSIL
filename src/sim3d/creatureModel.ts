import * as THREE from 'three';
import type { Creature } from '../types/creature';
import { getGLTFLoader } from './gltf';

/**
 * 생물 GLB 공용 로더 — 시뮬레이터(ThreeStage)·표본 뷰(SpecimenModel)·갤러리(GalleryView) 공용.
 * URL별로 1회만 로드해 캐시하고, 화면에는 cloneCreature()로 복제해서 올린다.
 * 개체별 에셋이 나오면 creatures.json의 visual.main에 .glb 경로만 넣으면 된다 —
 * 없으면 공용 creature.glb로 폴백 (creatureModelUrl).
 * 클론은 지오메트리·텍스처를 원본과 공유한다 — 씬 정리 때 지오메트리를 dispose하면
 * 캐시가 죽으므로, 클론 메시에 userData.sharedGeo 표시를 남긴다.
 */

const DEFAULT_MODEL = 'models/creature.glb';
const cache = new Map<string, Promise<THREE.Group>>();

/** 개체별 모델 경로 — visual.main이 .glb면 그것, 아니면 공용 모델 */
export function creatureModelUrl(creature?: Pick<Creature, 'visual'> | null): string {
  const main = creature?.visual?.main;
  return main && main.endsWith('.glb') ? main : DEFAULT_MODEL;
}

/** 정규화된 원본: 최대 변 1유닛, 바닥(y=0)에 안착, XZ 중심 원점 */
export function loadCreatureModel(rel: string = DEFAULT_MODEL): Promise<THREE.Group> {
  let entry = cache.get(rel);
  if (!entry) {
    entry = getGLTFLoader().then((loader) => loader.loadAsync(`${import.meta.env.BASE_URL}${rel}`)).then((gltf) => {
      const root = gltf.scene;
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      root.position.set(-center.x, -box.min.y, -center.z);
      const norm = new THREE.Group();
      norm.add(root);
      norm.scale.setScalar(1 / Math.max(size.x, size.y, size.z, 1e-6));
      return norm;
    });
    cache.set(rel, entry);
  }
  return entry;
}

/** 개체별 인스턴스 — 재질만 복제(개별 투명도 조절용), 지오메트리·텍스처는 공유 */
export function cloneCreature(model: THREE.Group, targetSize: number): THREE.Group {
  const inst = model.clone(true);
  inst.scale.multiplyScalar(targetSize);
  inst.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.userData.sharedGeo = true;
      m.material = Array.isArray(m.material)
        ? m.material.map((mat) => mat.clone())
        : (m.material as THREE.Material).clone();
    }
  });
  return inst;
}
