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

async function runTest() {
  console.log('=== DEEP TEST: SIKLUS KEMBALI KE HALAMAN UTAMA & SEMUA JALUR KEMBALI ===\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cdpPort = 9227;
  const userDataDir = path.join(__dirname, '.temp_chrome_deep_back');

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

    if (!targets || targets.length === 0) throw new Error('Chrome CDP tidak merespons');

    const pageTarget = targets.find(t => t.type === 'page');
    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.ready();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    for (let i = 0; i < 30; i++) {
      try {
        const ready = await client.eval(`document.readyState === 'complete' && !!window.game`);
        if (ready) break;
      } catch (e) {}
      await sleep(250);
    }
    await sleep(600);

    // KASUS 1: Tombol btn-home langsung di header saat match berjalan
    console.log('--- TEST KASUS 1: Klik btn-home (ikon 🏠 di top bar) saat match berlangsung ---');
    await client.eval(`document.getElementById('btn-proceed-customizer').click()`);
    await sleep(300);
    await client.eval(`document.getElementById('btn-start-match').click()`);
    await sleep(500);

    let matchInfo = await client.eval(`({
      phase: window.game.turnManager.phase,
      timer: Math.round(window.game.turnManager.planningTimer),
      isLobbyHidden: document.getElementById('lobby-screen').classList.contains('hidden')
    })`);
    console.log('Match berjalan:', matchInfo);

    console.log('Mengklik btn-home di header...');
    await client.eval(`document.getElementById('btn-home').click()`);
    await sleep(400);

    let lobbyInfo = await client.eval(`({
      phase: window.game.turnManager.phase,
      timer: Math.round(window.game.turnManager.planningTimer),
      isLobbyVisible: !document.getElementById('lobby-screen').classList.contains('hidden'),
      isCharSelectHidden: document.getElementById('character-select-screen').classList.contains('hidden'),
      isSettingsHidden: document.getElementById('settings-modal').classList.contains('hidden')
    })`);
    console.log('Setelah btn-home diklik:', lobbyInfo);
    await client.screenshot('test_back_home_btn.png');

    // KASUS 2: Kembali ke Lobby saat GOAL Banner sedang aktif (mengecek timeout leak)
    console.log('\n--- TEST KASUS 2: Kembali ke Lobby saat Selebrasi GOAL sedang aktif ---');
    await client.eval(`document.getElementById('btn-proceed-customizer').click()`);
    await sleep(300);
    await client.eval(`document.getElementById('btn-start-match').click()`);
    await sleep(500);

    console.log('Memicu Gol Merah...');
    await client.eval(`window.game.handleGoal('RED')`);
    await sleep(200);

    const isGoalBannerOpen = await client.eval(`!document.getElementById('goal-banner').classList.contains('hidden')`);
    console.log('Goal banner terlihat:', isGoalBannerOpen);

    console.log('Klik Menu Utama dari Settings saat banner gol muncul...');
    await client.eval(`document.getElementById('btn-settings').click()`);
    await sleep(200);
    await client.eval(`document.getElementById('btn-exit-lobby').click()`);
    await sleep(400);

    // Tunggu 3.5 detik untuk melihat apakah goal timeout bocor dan merusak lobby
    console.log('Menunggu 3.5s untuk memeriksa apakah goal timeout bocor ke lobby...');
    await sleep(3500);

    const leakCheck = await client.eval(`({
      phase: window.game.turnManager.phase,
      timer: Math.round(window.game.turnManager.planningTimer),
      isLobbyVisible: !document.getElementById('lobby-screen').classList.contains('hidden'),
      isGoalBannerHidden: document.getElementById('goal-banner').classList.contains('hidden')
    })`);
    console.log('Hasil setelah 3.5s di lobby:', leakCheck);
    await client.screenshot('test_back_during_goal.png');

    // KASUS 3: Dari Match End Modal -> Klik MENU UTAMA
    console.log('\n--- TEST KASUS 3: Match End Modal -> MENU UTAMA ---');
    await client.eval(`document.getElementById('btn-proceed-customizer').click()`);
    await sleep(300);
    await client.eval(`document.getElementById('btn-start-match').click()`);
    await sleep(500);

    console.log('Memicu Selesai Pertandingan (End Match)...');
    await client.eval(`window.game.endMatch('RED')`);
    await sleep(300);

    const isEndModalOpen = await client.eval(`!document.getElementById('match-end-modal').classList.contains('hidden')`);
    console.log('Match End Modal terbuka:', isEndModalOpen);

    console.log('Klik btn-end-to-menu (MENU UTAMA)...');
    await client.eval(`document.getElementById('btn-end-to-menu').click()`);
    await sleep(400);

    const isEndModalHiddenAfter = await client.eval(`document.getElementById('match-end-modal').classList.contains('hidden')`);
    const isLobbyVisibleAfterEnd = await client.eval(`!document.getElementById('lobby-screen').classList.contains('hidden')`);
    console.log('Match End Modal tertutup:', isEndModalHiddenAfter, '| Lobby muncul:', isLobbyVisibleAfterEnd);
    await client.screenshot('test_back_from_end_modal.png');

    // KASUS 4: Tombol ESC / Tab / Space saat di Lobby
    console.log('\n--- TEST KASUS 4: Menekan tombol ESC / Tab saat berada di Lobby ---');
    await client.eval(`
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
    `);
    await sleep(300);

    const isSettingsOpenedInLobby = await client.eval(`!document.getElementById('settings-modal').classList.contains('hidden')`);
    console.log('Apakah modal settings terbuka jika ESC ditekan di lobby?', isSettingsOpenedInLobby);

    await client.eval(`
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', key: 'Tab' }));
    `);
    await sleep(300);
    const isStatsOpenedInLobby = await client.eval(`!document.getElementById('stats-modal').classList.contains('hidden')`);
    console.log('Apakah modal stats terbuka jika TAB ditekan di lobby?', isStatsOpenedInLobby);

    console.log('\nConsole logs:');
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

runTest().catch(console.error);
