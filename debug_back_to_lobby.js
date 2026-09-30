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
      const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
      throw new Error(`Eval failed: ${desc}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`📸 Screenshot saved: ${filename}`);
  }
}

async function main() {
  console.log('=== DIAGNOSIS BUG KEMBALI KE HALAMAN UTAMA ===\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cdpPort = 9226;
  const userDataDir = path.join(__dirname, '.temp_chrome_debug_back');

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--window-size=1280,720',
    'http://localhost:3000/'
  ]);

  try {
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        targets = await fetchJson(`http://localhost:${cdpPort}/json`);
        if (targets && targets.length > 0) break;
      } catch (e) {}
    }

    if (!targets || targets.length === 0) {
      throw new Error('Chrome CDP tidak merespons dalam 10 detik');
    }

    const pageTarget = targets.find(t => t.type === 'page');
    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.ready();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    console.log('Menunggu pemuatan DOM & game engine...');
    for (let i = 0; i < 30; i++) {
      try {
        const ready = await client.eval(`document.readyState === 'complete' && !!document.getElementById('lobby-screen')`);
        if (ready) break;
      } catch (e) {}
      await sleep(250);
    }
    await sleep(600);

    // TEST 1: Dari Character Select -> Klik KEMBALI ke Lobby
    console.log('\n--- UJI 1: Character Select Screen -> KEMBALI ke Lobby ---');
    await client.eval(`document.getElementById('btn-proceed-customizer').click()`);
    await sleep(400);

    const isCharSelectOpen = await client.eval(`!document.getElementById('character-select-screen').classList.contains('hidden')`);
    console.log('Layar Pemilihan Karakter terbuka:', isCharSelectOpen);

    console.log('Mengklik btn-back-to-lobby (⬅️ KEMBALI)...');
    await client.eval(`document.getElementById('btn-back-to-lobby').click()`);
    await sleep(400);

    const isLobbyVisible1 = await client.eval(`!document.getElementById('lobby-screen').classList.contains('hidden')`);
    const isCharSelectVisible1 = await client.eval(`!document.getElementById('character-select-screen').classList.contains('hidden')`);
    console.log('Lobby terlihat:', isLobbyVisible1, '| Character Select terlihat:', isCharSelectVisible1);
    await client.screenshot('debug_back_1_from_char_select.png');

    // TEST 2: Masuk ke Pertandingan -> Buka Pengaturan -> Klik MENU UTAMA
    console.log('\n--- UJI 2: Di Dalam Match -> Settings -> MENU UTAMA ---');
    await client.eval(`document.getElementById('btn-proceed-customizer').click()`);
    await sleep(400);
    await client.eval(`document.getElementById('btn-start-match').click()`);
    await sleep(600);

    const gameStateBefore = await client.eval(`({
      phase: window.game.turnManager.phase,
      turn: window.game.turnManager.turn,
      timer: Math.round(window.game.turnManager.planningTimer),
      scores: [window.game.scoreRed, window.game.scoreBlue]
    })`);
    console.log('Status Game Saat Main:', JSON.stringify(gameStateBefore));

    // Buka Settings Modal
    console.log('Membuka modal Settings...');
    await client.eval(`document.getElementById('btn-settings').click()`);
    await sleep(400);

    // Klik btn-exit-lobby (MENU UTAMA 🏠)
    console.log('Mengklik btn-exit-lobby (MENU UTAMA 🏠)...');
    await client.eval(`document.getElementById('btn-exit-lobby').click()`);
    await sleep(600);

    const isLobbyVisible2 = await client.eval(`!document.getElementById('lobby-screen').classList.contains('hidden')`);
    console.log('Lobby terlihat setelah exit:', isLobbyVisible2);
    await client.screenshot('debug_back_2_after_exit_lobby.png');

    // Cek apakah game state di latar belakang masih berjalan (timer masih berkurang / phase masih PLANNING)
    await sleep(2000);
    const gameStateAfter = await client.eval(`({
      phase: window.game.turnManager.phase,
      turn: window.game.turnManager.turn,
      timer: Math.round(window.game.turnManager.planningTimer),
      scores: [window.game.scoreRed, window.game.scoreBlue]
    })`);
    console.log('Status Game Di Balik Layar Saat di Lobby:', JSON.stringify(gameStateAfter));

    // TEST 3: Coba Masuk Match Lagi Dari Lobby
    console.log('\n--- UJI 3: Memulai Match Lagi Setelah Kembali ke Lobby ---');
    await client.eval(`document.getElementById('btn-proceed-customizer').click()`);
    await sleep(400);
    await client.eval(`document.getElementById('btn-start-match').click()`);
    await sleep(600);

    const gameStateReplay = await client.eval(`({
      phase: window.game.turnManager.phase,
      turn: window.game.turnManager.turn,
      timer: Math.round(window.game.turnManager.planningTimer),
      scores: [window.game.scoreRed, window.game.scoreBlue]
    })`);
    console.log('Status Game Setelah Rematch:', JSON.stringify(gameStateReplay));
    await client.screenshot('debug_back_3_rematch.png');

    console.log('\n--- LOG KONSOL LENGKAP ---');
    client.consoleLogs.forEach(l => console.log('  ' + l));

  } finally {
    try {
      chromeProc.kill();
    } catch (e) {}
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

main().catch(err => {
  console.error('Fatal error in tester:', err);
  process.exit(1);
});
