#pragma once

// ── 네트워크 ──────────────────────────────────────────────
// 전시장 구성 (docs/EXHIBITION_SETUP.md §6): 2.4GHz 와이파이가 없으므로
// unit1(HOST_AP=1)이 SoftAP 를 띄우고, 나머지 목업·노트북(브릿지)·아이맥이 여기 붙는다.
// 노트북은 이 AP 안에서 고정 IP 192.168.4.100 을 잡는다 → 브릿지 주소.
#define WIFI_SSID      "ENSIL-FIELD"
#define WIFI_PASS      "electro-ferment"   // 8자 이상
#define WIFI_CHANNEL   6
#define AP_MAX_CLIENTS 8                   // 목업 3 + 노트북 + 아이맥 + 여유

#define BRIDGE_HOST    "192.168.4.100"
#define BRIDGE_PORT    7777

// 노트북 핫스팟 등 다른 AP 를 쓰게 되면 위 SSID/PASS 와 BRIDGE_HOST 만 바꾼다
// (Windows 모바일 핫스팟 게이트웨이는 보통 192.168.137.1)

// ── 동작 파라미터 ──────────────────────────────────────────
#define TRIGGER_COOLDOWN_MS 8000   // 같은 목업 연속 감지는 이 간격 안에서 한 번만 보고 (PIR 재감지 방지)
#define RECONNECT_MS        3000

// ── 핀 (보드 배선에 맞게) ─────────────────────────────────
#if UNIT == 1
  #define PIN_SWITCH   3    // 스위치 → GND (INPUT_PULLUP)
  #define PIN_PIXELS   4    // 네오픽셀 데이터
  #define PIXEL_COUNT  17
#elif UNIT == 2
  #define PIN_PIR      3    // PIR OUT
  #define PIN_SERVO    4    // 서보 신호
  #define SERVO_REST   20
  #define SERVO_PULL   120
#elif UNIT == 3
  #define PIN_AMP      12   // 앰프 enable / 사운드 트리거 (기존 코드에 맞게)
#endif
