import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * meshopt 압축(EXT_meshopt_compression) GLB 공용 로더 팩토리.
 * 모든 GLB 에셋은 압축돼 있으므로 (원본 318MB -> 약 5MB) 어디서든 이걸로 로드한다.
 * 디코더는 public/decoders/에서 런타임 로드 — 번들에 넣거나 import() 구문을 쓰면
 * wasm-rollup이 네이티브 크래시한다 (debug.md #1 계열). new Function으로 rollup 눈을 피한다.
 */

let decoderPromise: Promise<unknown> | null = null;

function loadDecoder(): Promise<unknown> {
  if (!decoderPromise) {
    const url = `${import.meta.env.BASE_URL}decoders/meshopt_decoder.module.js`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dynImport = new Function('u', 'return import(u)') as (u: string) => Promise<{ MeshoptDecoder: any }>;
    decoderPromise = dynImport(url).then(({ MeshoptDecoder }) => MeshoptDecoder);
  }
  return decoderPromise;
}

/** meshopt 디코더가 연결된 GLTFLoader */
export function getGLTFLoader(): Promise<GLTFLoader> {
  return loadDecoder().then((decoder) => {
    const loader = new GLTFLoader();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loader.setMeshoptDecoder(decoder as any);
    return loader;
  });
}
