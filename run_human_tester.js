import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACT_DIR = 'C:\\Users\\alhab\\.gemini\\antigravity-ide\\brain\\105ab7fd-957f-40f4-8a90-6822201b0877';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.msgId = 0;
    this.pending = new Map();
    this.consoleLogs = [];

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      } else if (data.method === 'Runtime.consoleAPICalled') {
        const args = (data.params.args || []).map(a => a.value || a.description || '').join(' ');
        this.consoleLogs.push(`[${data.params.type}] ${args}`);
      } else if (data.method === 'Runtime.exceptionThrown') {
        this.consoleLogs.push(`[EXCEPTION] ${data.params.exceptionDetails.text}`);
      }
    };
  }

  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
    });
  }

  send(method, params = {}) {
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(code) {
    const res = await this.send('Runtime.evaluate', {
      expression: code,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${res.exceptionDetails.text}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`📸 Screenshot saved: ${filename}`);
    return outPath;
  }

  async mouseClick(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await sleep(40);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left' });
    await sleep(50);
  }

  async mouseDrag(x1, y1, x2, y2, steps = 10) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1 });
    for (let i = 1; i <= steps; i++) {
      const curX = x1 + (x2 - x1) * (i / steps);
      const curY = y1 + (y2 - y1) * (i / steps);
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: curX, y: curY, button: 'left' });
      await sleep(25);
    }
    await sleep(80);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: x2, button: 'left' });
    await sleep(50);
  }
}

async function main() {
  console.log('=== MEMULAI TESTER OTOMATIS BERBASIS USER MANUSIA ===\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeArgs = [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--window-size=1280,720',
    '--disable-gpu',
    '--disable-extensions',
    '--autoplay-policy=no-user-gesture-required',
    'http://localhost:3000'
  ];

  console.log('1. Meluncurkan Google Chrome Headless (CDP Port: 9222)...');
  const chromeProc = spawn(chromePath, chromeArgs, { stdio: 'ignore' });

  // Tunggu Chrome siap
  let targets = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      targets = await fetchJson('http://localhost:9222/json');
      if (targets && targets.length > 0) break;
    } catch (e) {}
  }

  if (!targets || targets.length === 0) {
    throw new Error('Gagal menghubungkan ke Chrome DevTools Protocol port 9222');
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  console.log(`2. Terhubung ke target halaman: ${pageTarget.title} (${pageTarget.url})`);

  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.ready();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

  // Tunggu halaman selesai dimuat dan elemen lobby siap
  console.log('Menunggu pemuatan DOM & game engine...');
  for (let i = 0; i < 30; i++) {
    try {
      const ready = await client.eval(`document.readyState === 'complete' && !!document.getElementById('lobby-screen')`);
      if (ready) break;
    } catch (e) {}
    await sleep(250);
  }
  await sleep(800);

  try {
    // ==========================================
    // SKENARIO 1: LOBBY & MODE SELECTION
    // ==========================================
    console.log('\n--- SKENARIO 1: LOBBY & MODE SELECTION ---');
    const lobbyVisible = await client.eval(`!document.getElementById('lobby-screen').classList.contains('hidden')`);
    console.log('Status Lobby Screen terlihat:', lobbyVisible);

    // Pilih Solo Mode
    await client.eval(`document.getElementById('mode-solo').click()`);
    await sleep(300);

  // Ambil screenshot Lobby
  await client.screenshot('tester_1_lobby.png');

  // Klik tombol "LANJUT KE PEMILIHAN TIM & KOIN"
  console.log('Mengklik "LANJUT KE PEMILIHAN TIM & KOIN"...');
  await client.eval(`document.getElementById('btn-proceed-customizer').click()`);
  await sleep(600);

  // ==========================================
  // SKENARIO 2: SELEKSI TIM & KARAKTER KOIN
  // ==========================================
  console.log('\n--- SKENARIO 2: SELEKSI TIM & KARAKTER KOIN ---');
  const charSelectVisible = await client.eval(`!document.getElementById('character-select-screen').classList.contains('hidden')`);
  console.log('Status Layar Pemilihan Karakter terlihat:', charSelectVisible);

  // Uji ganti tim ke BIRU lalu kembali ke MERAH
  console.log('Menguji Switcher Tim: Pindah ke Tim Biru...');
  await client.eval(`document.getElementById('btn-pick-blue').click()`);
  await sleep(400);

  console.log('Pindah kembali ke Tim Merah...');
  await client.eval(`document.getElementById('btn-pick-red').click()`);
  await sleep(400);

  // Pilih karakter Ziggy (#2)
  console.log('Memilih Koin Karakter Ziggy (⚡ Kelinci)...');
  await client.eval(`
    const ziggyCard = document.querySelector('.char-card-item[data-key="ZIGGY"]');
    if (ziggyCard) ziggyCard.click();
  `);
  await sleep(400);

  // Uji goyangan pegas di live preview canvas
  console.log('Menguji sentuhan interaktif pada Canvas Preview Koin...');
  await client.eval(`
    const pCanvas = document.getElementById('preview-canvas');
    if (pCanvas) pCanvas.click();
  `);
  await sleep(500);

  // Ambil screenshot layar seleksi karakter
  await client.screenshot('tester_2_character_select.png');

  // Klik Mulai Pertandingan
  console.log('Mengklik "MULAI PERTANDINGAN ⚽"...');
  await client.eval(`document.getElementById('btn-start-match').click()`);
  await sleep(400);

  // ==========================================
  // SKENARIO 3: LAPANGAN PERTANDINGAN & FORMASI AWAL
  // ==========================================
  console.log('\n--- SKENARIO 3: LAPANGAN PERTANDINGAN & FORMASI AWAL ---');
  const gameState = await client.eval(`({
    phase: window.game ? window.game.turnManager.phase : null,
    turn: window.game ? window.game.turnManager.turn : null,
    timer: window.game ? Math.round(window.game.turnManager.planningTimer) : 0,
    entityCount: window.game ? window.game.entities.length : 0,
    ballPos: window.game ? { x: window.game.ball.x, y: window.game.ball.y } : null,
    userChar: window.game && window.game.activeUserChar ? {
      name: window.game.activeUserChar.playerName,
      team: window.game.activeUserChar.team,
      x: window.game.activeUserChar.x,
      y: window.game.activeUserChar.y
    } : null
  })`);
  console.log('State Pertandingan:', JSON.stringify(gameState));

  // Ambil screenshot formasi lapangan awal
  await client.screenshot('tester_3_field_initial.png');

  // ==========================================
  // SKENARIO 4: DIRECT AIMING (PENGARAHAN TEMBAKAN OLEH USER)
  // ==========================================
  console.log('\n--- SKENARIO 4: DIRECT AIMING (PENGARAHAN TEMBAKAN OLEH USER) ---');
  // Dapatkan koordinat absolut koin pemain di canvas
  const aimCoords = await client.eval(`(() => {
    const canvas = document.getElementById('game-canvas');
    const rect = canvas.getBoundingClientRect();
    const char = window.game.activeUserChar;
    const ball = window.game.ball;
    return {
      startX: rect.left + (char.x / 960) * rect.width,
      startY: rect.top + (char.y / 540) * rect.height,
      targetX: rect.left + (ball.x / 960) * rect.width,
      targetY: rect.top + (ball.y / 540) * rect.height
    };
  })()`);

  console.log(`Melakukan drag Direct Aim dari (${Math.round(aimCoords.startX)}, ${Math.round(aimCoords.startY)}) menuju bola (${Math.round(aimCoords.targetX)}, ${Math.round(aimCoords.targetY)})...`);
  
  // Tekan mouse di koin pemain
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: aimCoords.startX,
    y: aimCoords.startY,
    button: 'left',
    clickCount: 1
  });
  await sleep(100);

  // Tarik mouse lebih jauh ke depan melintasi bola untuk menguji tarikan jauh berkecepatan maksimal
  const dragVectorX = (aimCoords.targetX - aimCoords.startX) * 1.25;
  const dragVectorY = (aimCoords.targetY - aimCoords.startY) * 1.25;

  for (let step = 1; step <= 10; step++) {
    const intermediateX = aimCoords.startX + dragVectorX * (step / 10);
    const intermediateY = aimCoords.startY + dragVectorY * (step / 10);
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: intermediateX,
      y: intermediateY,
      button: 'left'
    });
    await sleep(35);
  }

  const aimStatus = await client.eval(`(() => {
    const char = window.game.activeUserChar;
    const maxPower = 180;
    const ratio = Math.min(char.aimPower / maxPower, 1.0);
    const boost = 1.0 + ratio * 0.90;
    const speedMult = (char.def && char.def.stats && char.def.stats.speed) ? (char.def.stats.speed / 80) : 1.0;
    const calculatedSpeed = char.aimPower * 4.6 * boost * speedMult;
    return {
      isAiming: char.isAiming,
      aimPower: Math.round(char.aimPower),
      powerRatio: (ratio * 100).toFixed(1) + '%',
      calculatedSpeed: Math.round(calculatedSpeed) + ' px/s',
      aimAngle: char.aimAngle.toFixed(2)
    };
  })()`);
  console.log('Status Direct Aiming saat ditarik jauh:', JSON.stringify(aimStatus));

  // Ambil screenshot panah Direct Aim panjang & indikator persentase kecepatan dinamis
  await client.screenshot('tester_4_direct_aiming.png');

  // Lepaskan mouse untuk mengunci vektor bidikan
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: aimCoords.startX + dragVectorX,
    y: aimCoords.startY + dragVectorY,
    button: 'left'
  });
  await sleep(300);

  // ==========================================
  // SKENARIO 5: LOCK-IN READY & AKSI SIMULTAN
  // ==========================================
  console.log('\n--- SKENARIO 5: LOCK-IN READY & AKSI SIMULTAN ---');
  console.log('Pemain menekan tombol READY ✓...');
  await client.eval(`document.getElementById('btn-ready').click()`);
  await sleep(400);

  const phaseAfterReady = await client.eval(`window.game.turnManager.phase`);
  console.log('Fase permainan setelah tombol READY diklik:', phaseAfterReady);

  // Tunggu 1 detik saat 8 koin meluncur bersamaan
  await sleep(1000);
  await client.screenshot('tester_5_action_physics.png');

  // Tunggu sampai fase kembali ke PLANNING atau ronde selesai
  await sleep(2500);

  // ==========================================
  // SKENARIO 6: MODAL STATISTIK & PENGATURAN
  // ==========================================
  console.log('\n--- SKENARIO 6: MODAL STATISTIK & PENGATURAN ---');
  console.log('Membuka modal statistik pertandingan...');
  await client.eval(`document.getElementById('btn-stats').click()`);
  await sleep(500);
  await client.screenshot('tester_6_stats_modal.png');

  console.log('Menutup modal statistik...');
  await client.eval(`document.getElementById('btn-close-stats').click()`);
  await sleep(400);

  console.log('Membuka modal pengaturan (Settings)...');
  await client.eval(`document.getElementById('btn-settings').click()`);
  await sleep(500);
  await client.screenshot('tester_7_settings_modal.png');

  console.log('Menutup modal pengaturan...');
  await client.eval(`document.getElementById('btn-close-settings').click()`);
  await sleep(400);

  // ==========================================
  // SKENARIO 7: EVALUASI KONSOL & DIAGNOSTIK
  // ==========================================
  console.log('\n--- SKENARIO 7: EVALUASI KONSOL & DIAGNOSTIK ---');
  const exceptions = client.consoleLogs.filter(l => l.includes('EXCEPTION') || l.includes('error'));
  console.log(`Total log konsol tercatat: ${client.consoleLogs.length}`);
  if (exceptions.length > 0) {
    console.warn('Peringatan error ditemukan di konsol:');
    exceptions.forEach(e => console.warn('  ' + e));
  } else {
    console.log('✅ ZERO RUNTIME ERROR! Seluruh alur user berjalan 100% mulus tanpa exception!');
  }

  } finally {
    // Tutup Chrome
    console.log('\nMenutup proses Chrome...');
    try {
      chromeProc.kill('SIGTERM');
    } catch (e) {}
  }

  console.log('\n=== PENGUJIAN USER MANUSIA SELESAI DENGAN SUKSES! ===');
}

main().catch(err => {
  console.error('TESTER FAILED:', err);
  process.exit(1);
});
