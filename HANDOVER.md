# HANDOVER — 2026-09-03

작업 브랜치: `codex/design-system` (윤서 작업용) · 협업자(정빈)는 `codex/index-motion-logo`를 main처럼 사용
최신 커밋: `43ab90c` 유체 베일 키컬러 발색

---

## 작업 요약

이번 세션(여러 날에 걸친 연속 세션)에서 완료된 것:

1. **에셋 최적화 파이프라인 구축**
   - 개체 GLB 5종: 총 318MB → 4.9MB (simplify 200만→10만 삼각형 + 텍스처 1024 + meshopt 압축)
   - 랜딩 영상 10종: 58.9MB → 20.9MB (H.264 CRF26/slow, 오디오 제거)
   - 배경 스크럽 영상은 키프레임 5프레임 간격으로 별도 재인코딩 (시킹 속도용, 6.0MB)
2. **협업자 브랜치 따라잡기 머지 4회** — 전자 생태계(113e388), index-motion-logo 14커밋,
   원형 아카이브+파노라마 필드(main), 인터랙티브 원형 아카이브 고도화(370859e).
   매번 원칙: 협업자 코드 우선, GLB는 압축본 유지, 로더는 meshopt 재배선
3. **커서 렉 근본 해결** — 범인은 유체가 아니라 ① 리퀴드 로고의 10526×11001 좌표계
   SVG 필터 재래스터, ② 배경 컴포넌트 2곳의 전체 화면 getImageData CPU 픽셀 루프 +
   마우스 이동마다 비디오 시킹. SVG feComponentTransfer 필터/블렌드 모드로 대체
4. **유체 인터랙션 시스템** (여러 차례 방향 전환 끝에 현재 형태):
   - `LiquidCursor` — 구이(gooey) 점 사슬 액체 커서, 간격 하드 클램프로 절대 안 끊김
   - `FluidVeil` — 전면 WebGL 유체(difference) + 민트 글레이즈(color 블렌드) = 키컬러 발색
   - `FluidHub` — 중앙 회전축 원 안의 민트 유체(multiply), 상시 일렁임, 베일은 이 원에서 마스크 홀
   - 커서-허브 접착: 허브 가장자리 150px에서 커서 꼬리가 림으로 끌려 붙는 브릿지
5. **배경 영상 드르르륵 스크럽** — seeked 연쇄 + 스텝 시킹(0.09s/회), 실측 초당 40회
6. **검증 하네스** — scratchpad의 puppeteer-core `verify.mjs` (실마우스 이동 + 콘솔 + DOM + 스크린샷)

## 성공/실패 기록

### 통한 접근
- **GLB 압축**: gltf-transform simplify(--ratio 0.07~0.12 --error 0.01) → 텍스처는 .NET
  System.Drawing으로 1024 리사이즈(sharp가 이 환경에서 깨짐) → optimize --compress meshopt.
  스크래치패드 `compress-glb.ps1`로 자동화했었음 (스크래치패드는 청소됐을 수 있음 — 재작성 쉬움)
- **meshopt 로드**: `src/sim3d/gltf.ts`의 getGLTFLoader() 팩토리 하나로 통일. 디코더는
  public/decoders/에서 런타임 로드 (new Function('u','return import(u)') 트릭으로 rollup 우회)
- **difference 위 키컬러**: difference 단독으론 흰 배경에서 보색 반전이라 민트 불가(수학적 한계)
  → 유체 알파를 drawImage로 딴 저해상도 2D 캔버스에 키컬러 채우고 mix-blend-mode: color 글레이즈
- **커서 한 덩어리**: 점 사슬 lerp만으론 빠른 이동에서 끊김 → 인접 간격을 지름×0.75로
  하드 클램프하니 어떤 속도에도 연결 유지
- **빠른 스크럽**: 시킹 주기를 줄이는 것만으론 한계 — GOP가 길면 시킹 자체가 느림.
  키프레임 조밀 재인코딩(-g 5)과 seeked 연쇄를 함께 해야 드르르륵이 나옴

### 실패/폐기
- **스크린월 인덱스**(e787d6c): 설치미술 레퍼런스로 만들었으나 사용자 취향 아님 → revert(81cc00e)
- **비트린 랜딩**(2085bf2): 진열장 렌더 — 이후 협업자 리워크에 대체됨
- **갤러리+두 모니터**(d43bbc4)·**전면 연기 FluidCursor**(10da72c): 방향 전환으로 대체/삭제
- **sharp/libvips**: 이 Windows+Node24 환경에서 colourspace 크래시 → 텍스처 리사이즈는 .NET으로
- **gltf-transform v2 CLI**: Node 24에서 squoosh 크래시 (navigator setter)
- **헤드리스 Chrome 직접 호출**: --dump-dom·--enable-logging 출력이 PowerShell에서 캡처 안 됨,
  스크린샷도 간헐 실패/좀비 프로세스 누적 → puppeteer-core로 전환하고 해결

### 잡은 버그
- **wasm-rollup 네이티브 크래시(exit 0xC0000409)**: meshopt 디코더 정적 import 또는
  Node 24 빌드가 원인 (debug.md #1 확장). 빌드는 반드시 Node 22
- **React StrictMode + loseContext**: dev에서 mount→cleanup→mount 시 같은 캔버스가 죽은
  컨텍스트를 돌려받아 유체가 침묵 + 헤드리스 GPU 채널 붕괴 → dispose를 리소스 개별 삭제로 교체
- **PowerShell -replace로 UTF-8 파일 수정 → 한글 주석 몽땅 깨짐** (carousel.css 사고,
  Write 도구로 재작성해 복구)

## 주요 결정 사항

- **머지 정책: 협업자 코드 우선(theirs), 내 인프라(압축 GLB·meshopt 로더·성능 수정)만 재적용**
  — 디자인 주도권은 협업자 브랜치에 있고, 내 역할은 성능/인터랙션 레이어이기 때문
- **유체는 자체 구현**(PavelDoGreat MIT 참고, 의존성 0) — three.js와 별개의 경량 클래스로.
  sim 128 / dye 512 고정 해상도라 화면 크기와 비용 무관
- **모든 유체·커서 효과는 유휴 시 rAF 완전 정지** — 이 프로젝트는 커서 성능 이슈 전력이
  있어 "안 움직이면 비용 0"을 불변 원칙으로 유지 (FluidHub만 상시 30fps, 작은 캔버스라 예외)
- **liquid look = threshold**: 연기(gas)와 액체의 차이는 display 셰이더의 알파 threshold
  (EDGE_LOW/HIGH smoothstep) + 색 정규화로 만든다. 블룸은 가스 느낌이라 비활성(INTENSITY 0)

## 주의사항 & 교훈

1. **빌드는 Node 22 필수** (dev는 Node 24 OK — esbuild라서). 포터블: nodejs.org에서
   node-v22.23.2-win-x64.zip을 스크래치패드에 받아 PATH 앞에 추가. `node --version` 확인 후 빌드.
   ⚠ 스크래치패드는 세션 사이에 청소되므로 매 세션 재다운로드 각오
2. **새 GLTFLoader 호출 금지** — 압축 GLB는 일반 로더로 못 읽는다. 반드시
   `src/sim3d/gltf.ts`의 getGLTFLoader(). 협업자 커밋엔 plain 로더가 다시 들어오므로
   **머지 후 `grep "new GLTFLoader()"` 체크가 루틴**
3. **머지 시 바이너리**: public/의 GLB가 협업자 쪽에서 원본(수십 MB)으로 돌아오려 하면
   압축본(ours) 유지. 협업자의 *새* 에셋은 채택 후 필요 시 압축
4. **UTF-8 소스 파일을 PowerShell 파이프로 고치지 말 것** — 한글 주석 파괴됨. Edit/Write 도구 사용
5. **git add -A 주의** — 관계없는 파일이 섞여 들어간 사례 있음 (.claude/commands/handover.md)
6. **git 저장소가 무겁다** — 히스토리에 318MB GLB + 60MB 영상 원본이 남아 있음. clone이 느려도 정상
7. **검증은 scratchpad/verify.mjs** (puppeteer-core + 시스템 Chrome). 헤드리스 chrome을 CLI로
   직접 부르는 방식은 이 환경에서 신뢰 불가. 창 없는 chrome 프로세스를 일괄 kill하지 말 것
   (사용자 브라우저의 헬퍼 프로세스일 수 있음)
8. 협업자 쪽 빌드가 안 될 때: meshopt 정적 import(빌드 크래시)나 plain 로더(런타임 로드 실패)가
   원인일 가능성부터

## 2026-09-03 세션 추가분

1. **디자인 시스템 통일** (792653c) — `SiteNavigation` 48px 바 제거, 랜딩의 워드마크+밑줄 링크 룩을
   `SiteChrome`(chrome.css)으로 모든 화면에 적용. 토큰: `--hairline/--hairline-strong/--key/--chrome-*/--fs-ui…`.
   필드·서식지·아카이브·레코드의 상자형 버튼→밑줄 텍스트, 굵은 테두리→헤어라인, 핫스팟→흰 원+코드.
2. **전시 두-창 연동** — `docs/EXHIBITION_SETUP.md` 참조. 권장: 아이맥 1대 + HDMI, 같은 Chrome에 창 2개.
   - `Ctrl+Alt+Shift+O` → `#/stage` 팝업 창 (`useStageWindow.ts`, Window Management API로 2번째 화면에 배치 시도)
   - `fieldLink.ts`: BroadcastChannel 기본 + `VITE_FIELD_LINK_URL` 있으면 브릿지 WS 릴레이(노트북 분리용, bridge/index.js 중계 추가)
   - 콘솔(#/field) focus/pulse → 스테이지 `HabitatWorld.activate`, 스테이지 snapshot(1s) → 콘솔 라벨 `STAGE / …`
   - `EcosystemCanvas`에 `stimulus`/`ambient` prop, `HabitatWorld`에 `ambient`(카메라 3분/바퀴) 옵션 — 협업자 파일이라 최소 추가
   - 검증: 스크래치패드 `link-test.mjs` (같은 브라우저 컨텍스트 두 페이지, 배경 탭은 rAF가 멈추므로 bringToFront 필요)
3. **주의**: 이 세션과 병렬로 다른 세션이 같은 작업트리에서 `FluidHub.tsx`·`LiquidCursor.tsx`·`landing.css`를
   수정·커밋했음(0589a66 허브 액체 테두리 + 커서 청록 그라데이션). 두 세션을 동시에 돌릴 때는 파일이 겹치지 않게 나눌 것

4. **하드웨어 목업(ESP32) 연동** — `docs/EXHIBITION_SETUP.md` §6. 현장에 2.4GHz 망이 없어 unit1이 SoftAP,
   도서관 노트북이 브릿지+사이트 서버(`node bridge/index.js`, ws 7777 + http 8080), 아이맥은 Chrome만.
   - 브릿지: 받은 JSON을 보낸 쪽 빼고 전부 중계(목업↔웹↔창). `--demo`는 15초마다 가짜 trigger. `--no-serial`
   - 웹: `useHardwareLink`(App) — trigger → 유휴면 즉시 `#/creature/:id`, 조작 중이면 칩 후 유휴 시 이동, 90초 후 랜딩 복귀,
     같은 목업 8초 쿨다운, 스테이지에 pulse. `Shift+1~4`가 키보드 목업. 브릿지 주소는 페이지 호스트 → `?bridge=` → localStorage
   - 펌웨어 `firmware/esp32-unit`(PlatformIO): unit1 스위치→네오픽셀, unit2 PIR→서보, unit3 카메라→앰프(sense/act 이식 자리)
   - 검증: 스크래치패드 `hw-test.mjs`(가짜 목업 ws 클라이언트 + puppeteer). 스테이지 창은 브릿지에 붙지 않음(enabled=false)
   - 미해결: 구형 아이맥의 Chrome 버전(116+ 필요) 확인, unit4 무선 LED, 웹→목업 act 버튼 UI

5. **아카이브 페이지 삭제** — 인덱스 다이얼(#/)이 곧 아카이브. `Archive.tsx`·`CircularArchiveCarousel`·`SpecimenGlyph`·
   `carousel.css`·`archive.css` 제거, 개체 기록 스타일만 `record.css`로 분리. `#/archive`는 랜딩으로 폴백. 크롬은 ARCHIVE / FIELD 두 링크

## 다음 단계 (우선순위순)

0. **스테이지 전용 연출** — 지금은 3D 공용 필드에서 크롬만 뺀 것. 프로젝터용 씬은 `Stage.tsx`의 캔버스만 교체
   (pulse/focus/snapshot 인터페이스 유지). 전시장 리허설에서 두 창 동시 GPU 부하 확인(프레임 떨어지면 pixelRatio 1로)

1. **유체 톤 실사용 피드백 반영** — 키컬러(`FluidVeil.tsx` KEY_COLOR #58d6c3), 글레이즈 강도
   (landing.css .fluid-veil-tint opacity 0.9), 액체 경계(FluidSim EDGE_LOW/HIGH 0.16/0.4),
   허브 접착 계수(LiquidCursor 0.22), 일렁임 세기(FluidHub 젓개 0.16)
2. **협업자 브랜치 재따라잡기** — index-motion-logo에 새 커밋이 쌓이면 머지 (충돌 시 위 정책)
3. **전시 두-창 연동 부활 검토** — `src/state/useFieldLink.ts` 보존돼 있음(현재 미사용).
   파노라마 필드에 전하 수신을 붙이면 "컴퓨터에서 전하 던지기 → 프로젝터 반응" 복원 가능
4. **verify.mjs를 리포로 이동** (예: tools/verify.mjs + devDependency puppeteer-core) —
   스크래치패드 휘발 문제 해결
5. **에셋 잔여 최적화** — ensil-green-circuit-ruins.glb 6.3MB(압축 여지),
   파노라마 PNG 2.1MB(WebP 전환), git 히스토리 대형 블롭 정리(force push — 정빈과 조율 필수)
6. **Vercel 배포 확인** — 프로젝트 설정 Node 22.x 지정 여부, 배포본에서 meshopt 로드 확인

## 중요 파일 맵

| 경로 | 역할 |
|---|---|
| `src/fluid/FluidSim.ts` | 유체 엔진 (stable fluids, 상단 상수가 튜닝 패널) |
| `src/components/shell/FluidVeil.tsx` | 전면 유체 베일 (difference + 민트 글레이즈, 허브 마스크 홀) |
| `src/components/landing/LiquidCursor.tsx` | 구이 액체 커서 (전역, 허브 접착 로직 포함) |
| `src/components/landing/FluidHub.tsx` | 중앙 회전축 원 유체 (상시 일렁임, multiply 민트) |
| `src/components/landing/InteractiveFrameBackground.tsx` | 커서 스크럽 배경 영상 (SVG 트라이톤 필터, 연쇄 시킹) |
| `src/components/landing/IndexVideoCarousel.tsx` | 랜딩 허브+궤도 UI (협업자 소유, 허브에 data-fluid-window) |
| `src/sim3d/gltf.ts` | meshopt GLTFLoader 팩토리 — 모든 GLB 로드는 여기로 |
| `src/components/habitat-engine/HabitatWorld.ts` | 필드/서식지 3D 엔진 (협업자 소유, 로더만 배선함) |
| `src/styles/landing.css` | 랜딩 + 커서/베일/허브 유체 스타일 |
| `public/models/*.glb`, `public/media/index/*` | 압축된 3D/영상 에셋 (원본은 git 히스토리에만) |
| `public/decoders/meshopt_decoder.module.js` | 런타임 로드용 meshopt 디코더 |
| `debug.md` | 선행 트러블슈팅 기록 (#1 Node24 빌드 크래시 — 여전히 유효) |
| (스크래치패드) `verify.mjs`, `compress-glb.ps1`, `tex-tool.mjs` | 검증/압축 도구 — 휘발성, 리포 이동 권장 |
