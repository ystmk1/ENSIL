/*
 * ENSIL 목업 펌웨어 — 센싱→동작은 목업 안에서 완결되고, 동작한 사실만 브릿지에 알린다.
 *
 *   목업 → 브릿지  {"type":"hello","unit":2,"name":"tendon"}                 접속 시
 *   목업 → 브릿지  {"type":"trigger","unit":2,"action":"detect","intensity":0.8}  감지→동작 직후
 *   브릿지 → 목업  {"type":"act","unit":2,"action":"pulse","intensity":1}     웹에서 동작 명령
 *
 * 브릿지가 없어도 목업은 그대로 센싱→동작한다 (WiFi/WS 는 백그라운드에서 재접속만 반복).
 * 각 목업의 sense()/act() 만 보드에 맞게 채우면 된다 — 기존 PlatformIO 코드를 그 안에 옮긴다.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoWebsockets.h>
#include <ArduinoJson.h>
#include "config.h"

using namespace websockets;

#if UNIT == 1
  #include <Adafruit_NeoPixel.h>
  static const char* UNIT_NAME = "cross";
  Adafruit_NeoPixel pixels(PIXEL_COUNT, PIN_PIXELS, NEO_GRB + NEO_KHZ800);
#elif UNIT == 2
  #include <ESP32Servo.h>
  static const char* UNIT_NAME = "tendon";
  Servo tendon;
#elif UNIT == 3
  static const char* UNIT_NAME = "speaker";
#else
  #error "UNIT 빌드 플래그가 없다 — platformio.ini 의 env 를 골라라"
#endif

WebsocketsClient ws;
bool wsReady = false;
unsigned long lastReconnect = 0;
unsigned long lastTrigger = 0;

// ── 목업별 감지·동작 ───────────────────────────────────────
// sense(): 감지됐으면 true (한 번의 '사건'당 한 번만 true 를 돌려주도록 에지/디바운스 처리)
// act(intensity): 목업의 동작. 스스로 감지했을 때도, 웹에서 명령이 왔을 때도 같은 함수.

#if UNIT == 1
bool lastSwitch = HIGH;
void setupUnit() {
  pinMode(PIN_SWITCH, INPUT_PULLUP);
  pixels.begin();
  pixels.clear();
  pixels.show();
}
bool sense() {
  bool now = digitalRead(PIN_SWITCH);
  bool pressed = (lastSwitch == HIGH && now == LOW); // 눌리는 에지
  lastSwitch = now;
  if (pressed) delay(20); // 디바운스
  return pressed;
}
void act(float intensity) {
  // 십자형 개체: 17구가 방향성 있게 깜빡인다 — 기존 패턴 코드가 있으면 여기로
  int flashes = 3 + (int)(intensity * 3);
  for (int f = 0; f < flashes; f++) {
    for (int i = 0; i < PIXEL_COUNT; i++) pixels.setPixelColor(i, pixels.Color(88, 214, 195)); // 키컬러 민트
    pixels.show(); delay(90);
    pixels.clear(); pixels.show(); delay(110);
  }
}

#elif UNIT == 2
bool lastPir = LOW;
void setupUnit() {
  pinMode(PIN_PIR, INPUT);
  tendon.attach(PIN_SERVO);
  tendon.write(SERVO_REST);
}
bool sense() {
  bool now = digitalRead(PIN_PIR);
  bool rise = (lastPir == LOW && now == HIGH);
  lastPir = now;
  return rise;
}
void act(float intensity) {
  // 텐던: 꼬리를 안쪽으로 말았다가 천천히 푼다
  int pull = SERVO_REST + (int)((SERVO_PULL - SERVO_REST) * constrain(intensity, 0.3f, 1.0f));
  for (int a = SERVO_REST; a <= pull; a += 2) { tendon.write(a); delay(8); }
  delay(600);
  for (int a = pull; a >= SERVO_REST; a -= 1) { tendon.write(a); delay(18); }
}

#elif UNIT == 3
void setupUnit() {
  pinMode(PIN_AMP, OUTPUT);
  digitalWrite(PIN_AMP, LOW);
  // TODO: 카메라 초기화 — 기존 프로젝트의 esp_camera_init(...) 을 여기로
}
bool sense() {
  // TODO: 기존 카메라 감지 루틴을 여기로. 감지된 '순간'에 한 번만 true.
  //       (매 프레임 true 를 돌려줘도 TRIGGER_COOLDOWN_MS 가 막아주지만, 에지 처리가 더 깔끔하다)
  return false;
}
void act(float intensity) {
  // TODO: 앰프 스피커 사운드 재생 — 기존 코드로 교체
  digitalWrite(PIN_AMP, HIGH);
  delay(400 + (int)(intensity * 800));
  digitalWrite(PIN_AMP, LOW);
}
#endif

// ── 브릿지 연결 ────────────────────────────────────────────
void sendJson(JsonDocument& doc) {
  if (!wsReady) return;
  String out;
  serializeJson(doc, out);
  ws.send(out);
}

void sendHello() {
  JsonDocument doc;
  doc["type"] = "hello";
  doc["unit"] = UNIT;
  doc["name"] = UNIT_NAME;
  sendJson(doc);
}

void sendTrigger(const char* action, float intensity) {
  JsonDocument doc;
  doc["type"] = "trigger";
  doc["unit"] = UNIT;
  doc["action"] = action;
  doc["intensity"] = intensity;
  sendJson(doc);
}

void onMessage(WebsocketsMessage message) {
  JsonDocument doc;
  if (deserializeJson(doc, message.data())) return;
  const char* type = doc["type"] | "";
  if (strcmp(type, "act") != 0) return;
  // unit 이 없거나 내 번호면 실행 (브릿지는 모든 클라이언트에 중계하므로 여기서 거른다)
  if (!doc["unit"].isNull() && doc["unit"].as<int>() != UNIT) return;
  float intensity = doc["intensity"] | 1.0f;
  Serial.printf("[unit %d] act %s %.2f\n", UNIT, doc["action"] | "pulse", intensity);
  act(intensity);
}

void onEvent(WebsocketsEvent event, String) {
  if (event == WebsocketsEvent::ConnectionOpened) {
    wsReady = true;
    Serial.println("[ws] connected");
    sendHello();
  } else if (event == WebsocketsEvent::ConnectionClosed) {
    wsReady = false;
    Serial.println("[ws] closed");
  }
}

void connectWifi() {
#if HOST_AP
  // 이 보드가 공유기 역할: 고정 192.168.4.1. 노트북은 192.168.4.100 고정, 나머지는 DHCP
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(WIFI_SSID, WIFI_PASS, WIFI_CHANNEL, 0, AP_MAX_CLIENTS);
  Serial.printf("[wifi] AP %s  ip %s\n", WIFI_SSID, WiFi.softAPIP().toString().c_str());
#else
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("[wifi] joining %s\n", WIFI_SSID);
#endif
}

bool wifiUp() {
#if HOST_AP
  return true; // AP 보드는 자기 망 안에서 브릿지(노트북)에 붙는다
#else
  return WiFi.status() == WL_CONNECTED;
#endif
}

void maintainBridge() {
  if (wsReady) { ws.poll(); return; }
  if (!wifiUp()) return;
  unsigned long now = millis();
  if (now - lastReconnect < RECONNECT_MS) return;
  lastReconnect = now;
  Serial.printf("[ws] connecting ws://%s:%d\n", BRIDGE_HOST, BRIDGE_PORT);
  ws.connect(BRIDGE_HOST, BRIDGE_PORT, "/");
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.printf("ENSIL unit %d (%s)\n", UNIT, UNIT_NAME);
  setupUnit();
  ws.onMessage(onMessage);
  ws.onEvent(onEvent);
  connectWifi();
}

void loop() {
  maintainBridge();

  if (sense()) {
    unsigned long now = millis();
    bool report = now - lastTrigger >= TRIGGER_COOLDOWN_MS;
    // 동작은 항상, 보고는 쿨다운 안에서 한 번만
    if (report) {
      lastTrigger = now;
      sendTrigger("detect", 0.8f);   // 먼저 알리고 (act 는 수 초 걸릴 수 있다)
    }
    act(0.8f);
  }
  delay(5);
}
