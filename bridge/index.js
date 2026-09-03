/**
 * ENSIL 브릿지 — 하드웨어(ESP32 목업·아두이노) ↔ 웹 허브 (plan.md §7, docs/EXHIBITION_SETUP.md §6)
 *
 *   node index.js                     # WS 7777 + 사이트(../dist) HTTP 8080, 시리얼은 있으면 사용
 *   node index.js --demo              # 하드웨어 없이 가짜 trigger(15초마다) + 합성 tilt
 *   node index.js --no-serial         # 아두이노 탐색 생략 (ESP32 WiFi 목업만 쓸 때)
 *   node index.js --port COM5         # 시리얼 포트 지정
 *   node index.js --serve ../dist     # 정적 서빙 폴더 지정 (--serve none 으로 끔)
 *
 * 연결 모델: 모든 클라이언트(브라우저 창들, ESP32 목업들)가 같은 WS 서버에 붙고,
 * 브릿지는 받은 JSON 한 줄을 "보낸 쪽을 뺀 나머지 전부"에게 그대로 중계한다.
 *   목업 → 웹   {"type":"trigger","unit":2,"action":"detect","intensity":0.8}
 *   웹 → 목업   {"type":"act","unit":2,"action":"pulse","intensity":1}
 *   목업 → 웹   {"type":"hello","unit":2,"name":"tendon"}   (접속 시)
 *   창 ↔ 창     {"type":"field", ...}  (전시 두-창 연동, src/state/fieldLink.ts)
 * 시리얼(아두이노)이 열려 있으면 시리얼 → 전 클라이언트, 'act' 류 → 시리얼로도 흘린다.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const WS_PORT = 7777;
const HTTP_PORT = 8080;
const BAUD = 115200;
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const DEMO = flag('--demo');
const NO_SERIAL = flag('--no-serial');
const portArg = value('--port', null);
const serveDir = value('--serve', path.join(__dirname, '..', 'dist'));

function log(msg) {
  console.log(`[bridge] ${msg}`);
}

// ── 정적 사이트 서버 — 아이맥은 이 주소만 열면 된다 (http://<노트북IP>:8080) ───
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp4': 'video/mp4',
  '.m4v': 'video/mp4', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.otf': 'font/otf', '.woff2': 'font/woff2',
};
if (serveDir !== 'none' && fs.existsSync(path.join(serveDir, 'index.html'))) {
  http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.normalize(path.join(serveDir, urlPath === '/' ? 'index.html' : urlPath));
    if (!file.startsWith(path.normalize(serveDir))) { res.writeHead(403); res.end(); return; }
    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) { res.writeHead(404); res.end('not found'); return; }
      const ext = path.extname(file).toLowerCase();
      const headers = { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes' };
      // 영상 시킹(드르르륵 스크럽)용 Range 요청 지원
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
      if (range) {
        const start = range[1] ? Number(range[1]) : 0;
        const end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
        res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
        fs.createReadStream(file, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, { ...headers, 'Content-Length': stat.size });
      fs.createReadStream(file).pipe(res);
    });
  }).listen(HTTP_PORT, '0.0.0.0', () => log(`사이트 서빙: http://0.0.0.0:${HTTP_PORT}  (${serveDir})`));
} else if (serveDir !== 'none') {
  log(`사이트 서빙 생략 — ${serveDir}/index.html 없음 (Node 22로 npm run build 후 다시)`);
}

// ── WebSocket 허브 ─────────────────────────────────────────
const wss = new WebSocketServer({ port: WS_PORT, host: '0.0.0.0' });
const clients = new Set();
const units = new Map(); // ws → {unit, name}

wss.on('connection', (ws, req) => {
  clients.add(ws);
  log(`연결 ${req.socket.remoteAddress} (${clients.size})`);
  ws.on('close', () => {
    if (units.has(ws)) {
      log(`목업 unit ${units.get(ws).unit} 끊김`);
      units.delete(ws);
      broadcastUnits();
    }
    clients.delete(ws);
  });
  ws.on('message', (data) => {
    const text = data.toString();
    let msg = null;
    try { msg = JSON.parse(text); } catch { /* JSON 아님 */ }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'hello' && msg.unit !== undefined) {
      units.set(ws, { unit: msg.unit, name: msg.name ?? '' });
      log(`목업 unit ${msg.unit} ${msg.name ?? ''} 접속`);
      broadcastUnits();
      return;
    }
    if (msg.type === 'trigger') log(`trigger unit ${msg.unit} ${msg.action ?? ''} ${msg.intensity ?? ''}`);
    if (msg.type === 'act') log(`act → unit ${msg.unit} ${msg.action ?? ''}`);

    // 보낸 쪽을 뺀 나머지 전부에게 그대로 중계
    for (const c of clients) if (c !== ws && c.readyState === 1) c.send(text);
    // 웹 → 시리얼 하드웨어 (창 간 field 메시지는 제외)
    if (msg.type !== 'field' && serial?.isOpen) serial.write(text + '\n');
  });
});

function broadcast(obj) {
  const s = JSON.stringify(obj);
  for (const c of clients) if (c.readyState === 1) c.send(s);
}

/** 접속 중인 목업 목록 — 웹이 상태 표시에 쓴다 */
function broadcastUnits() {
  broadcast({ type: 'units', units: Array.from(units.values()) });
}

wss.on('listening', () => log(`ws://0.0.0.0:${WS_PORT} 대기 중`));

// ── 데모 모드 — 하드웨어 없이 개발·리허설 ────────────────────
if (DEMO) {
  log('데모 모드 — 합성 tilt + 15초마다 가짜 trigger (unit 1→2→3)');
  let t = 0;
  setInterval(() => {
    t += 0.033;
    broadcast({ type: 'tilt', pitch: Math.sin(t * 0.7) * 0.3, roll: Math.cos(t * 0.5) * 0.3 });
  }, 33);
  let unit = 0;
  setInterval(() => {
    unit = (unit % 3) + 1;
    log(`demo trigger unit ${unit}`);
    broadcast({ type: 'trigger', unit, action: 'demo', intensity: 0.8 });
  }, 15_000);
  return;
}

// ── 시리얼 (아두이노) — 선택 ─────────────────────────────────
let serial = null;
if (NO_SERIAL) {
  log('시리얼 생략 (--no-serial)');
  return;
}

let SerialPort, ReadlineParser;
try {
  ({ SerialPort, ReadlineParser } = require('serialport'));
} catch {
  log('serialport 모듈 없음 — 시리얼 생략 (ESP32 WiFi 목업만 쓰면 이대로 OK)');
  return;
}

// 원값 폴백용 스무딩 상태 (펌웨어가 JSON을 직접 보내면 사용되지 않음)
const SMOOTH = 0.15;
const tiltEma = { pitch: 0, roll: 0 };
let lastTiltSend = 0;
let serialWarned = false;

async function findPort() {
  if (portArg) return portArg;
  const ports = await SerialPort.list();
  // Arduino VID 0x2341 / clones 0x1a86 / Espressif 0x303a
  const hit = ports.find((p) => /2341|2a03|1a86|303a/i.test(p.vendorId ?? ''));
  return hit?.path ?? null;
}

async function openSerial() {
  const path = await findPort();
  if (!path) {
    if (!serialWarned) { log('시리얼 장치 없음 — 10초마다 조용히 재탐색 (--port COM5 로 지정 가능)'); serialWarned = true; }
    setTimeout(openSerial, 10_000);
    return;
  }
  serial = new SerialPort({ path, baudRate: BAUD });
  const parser = serial.pipe(new ReadlineParser({ delimiter: '\n' }));

  serial.on('open', () => log(`시리얼 연결: ${path} @ ${BAUD}`));
  serial.on('close', () => {
    log('시리얼 끊김 — 재연결 시도');
    serial = null;
    setTimeout(openSerial, 2000);
  });
  serial.on('error', (e) => log(`시리얼 오류: ${e.message}`));

  parser.on('data', (line) => {
    const s = line.trim();
    // 1) 정식 프로토콜: JSON 한 줄 (firmware/imu_tilt)
    try {
      broadcast(JSON.parse(s));
      return;
    } catch {
      /* JSON 아님 — 아래 폴백 시도 */
    }
    // 2) 폴백: IMU 라이브러리 예제(SimpleAccelerometer)의 "ax\tay\taz" 원값도 수용.
    const m = s.split(/[\t,\s]+/).map(Number);
    if (m.length === 3 && m.every((v) => Number.isFinite(v))) {
      const [ax, ay, az] = m;
      const p = Math.atan2(-ax, Math.sqrt(ay * ay + az * az));
      const r = Math.atan2(ay, az);
      tiltEma.pitch += SMOOTH * (p - tiltEma.pitch);
      tiltEma.roll += SMOOTH * (r - tiltEma.roll);
      const now = Date.now();
      if (now - lastTiltSend >= 33) { // 30Hz 스로틀
        lastTiltSend = now;
        broadcast({ type: 'tilt', pitch: +tiltEma.pitch.toFixed(4), roll: +tiltEma.roll.toFixed(4) });
      }
    }
  });
}

openSerial();
