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
  console.log('=== TESTER SOLO PLAYER MENGARAHKAN SEMUA PANAH KOIN ===\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cdpPort = 9225;
  const userDataDir = path.join(__dirname, '.temp_chrome_solo_tester');

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

    // Navigasi ke pemilihan karakter & mulai match Solo (Tim Merah)
    await client.eval(`document.getElementById('mode-solo').click()`);
    await sleep(300);
    await client.eval(`document.getElementById('btn-proceed-customizer').click()`);
    await sleep(400);
    await client.eval(`document.getElementById('btn-start-match').click()`);
    await sleep(600);

    console.log('Match Solo dimulai. Mengarahkan SEMUA 4 koin tim pemain...');

    // Arahkan koin #1 (Rocco)
    console.log('1. Mengarahkan Rocco (#8)...');
    await client.eval(`(() => {
      const rocco = window.game.entities.find(e => e.def.id === 'rocco');
      window.game.selectCharacter(rocco);
      rocco.aimAngle = -0.45; // Serong kanan atas
      rocco.aimPower = 110;
      rocco.isAiming = true;
      window.game.updateRosterReadyDots();
    })()`);
    await sleep(250);

    // Arahkan koin #2 (Ziggy)
    console.log('2. Mengarahkan Ziggy (#5)...');
    await client.eval(`(() => {
      const ziggy = window.game.entities.find(e => e.def.id === 'ziggy');
      window.game.selectCharacter(ziggy);
      ziggy.aimAngle = 0.0; // Lurus ke arah bola / gawang
      ziggy.aimPower = 160;
      ziggy.isAiming = true;
      window.game.updateRosterReadyDots();
    })()`);
    await sleep(250);

    // Arahkan koin #3 (Milo)
    console.log('3. Mengarahkan Milo (#6)...');
    await client.eval(`(() => {
      const milo = window.game.entities.find(e => e.def.id === 'milo');
      window.game.selectCharacter(milo);
      milo.aimAngle = 0.35; // Serong kanan bawah
      milo.aimPower = 130;
      milo.isAiming = true;
      window.game.updateRosterReadyDots();
    })()`);
    await sleep(250);

    // Arahkan koin #4 (Boris)
    console.log('4. Mengarahkan Boris (#7)...');
    await client.eval(`(() => {
      const boris = window.game.entities.find(e => e.def.id === 'boris');
      window.game.selectCharacter(boris);
      boris.aimAngle = -0.25; // Mengarah ke tengah lapangan
      boris.aimPower = 100;
      boris.isAiming = true;
      window.game.updateRosterReadyDots();
    })()`);
    await sleep(400);

    // Verifikasi status ke-4 koin tim pemain
    const myTeamStatus = await client.eval(`(() => {
      const myCoins = window.game.entities.filter(e => e.team === window.game.userTeam);
      return myCoins.map(c => ({
        name: c.def.name,
        num: c.number,
        isAiming: c.isAiming,
        aimPower: Math.round(c.aimPower),
        aimAngle: c.aimAngle.toFixed(2)
      }));
    })()`);
    console.log('Status Ke-4 Koin Tim Pemain:', JSON.stringify(myTeamStatus));

    // Verifikasi status ke-4 koin bot lawan
    const opponentBotStatus = await client.eval(`(() => {
      const opponents = window.game.entities.filter(e => e.team !== window.game.userTeam);
      return opponents.map(c => ({
        name: c.def.name,
        num: c.number,
        isReady: c.isReady,
        aimPower: Math.round(c.aimPower)
      }));
    })()`);
    console.log('Status Koin Bot Lawan:', JSON.stringify(opponentBotStatus));

    // Ambil screenshot yang menampilkan SEMUA 4 panah koin tim pemain aktif bersamaan di lapangan!
    await client.screenshot('tester_solo_all_4_arrows.png');

    // Klik tombol READY untuk mengunci seluruh tim
    console.log('\nPemain mengklik tombol READY ✓ untuk meluncurkan ke-4 koin secara serentak...');
    await client.eval(`document.getElementById('btn-ready').click()`);
    await sleep(300);

    const phase = await client.eval(`window.game.turnManager.phase`);
    console.log('Fase permainan setelah READY:', phase);

    // Ambil screenshot saat 8 koin (4 pemain + 4 bot) meluncur bersamaan
    await sleep(600);
    await client.screenshot('tester_solo_all_action.png');

    console.log('\n--- EVALUASI RUNTIME ---');
    const exceptions = client.consoleLogs.filter(l => l.includes('EXCEPTION') || l.includes('error'));
    console.log(`Total log konsol: ${client.consoleLogs.length}`);
    if (exceptions.length > 0) {
      console.warn('Peringatan error ditemukan:');
      exceptions.forEach(e => console.warn('  ' + e));
    } else {
      console.log('✅ ZERO RUNTIME ERROR! Pemain berhasil mengarahkan semua koin dan meluncur serempak!');
    }

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
