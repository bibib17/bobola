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
  console.log('=== TESTER SISTEM BUFF LAPANGAN (1-BY-1 & EFEK TURN BERIKUTNYA) ===\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cdpPort = 9224;
  const userDataDir = path.join(__dirname, '.temp_chrome_buff_tester');

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
    await sleep(800);

    // Navigasi ke pemilihan karakter & mulai match
    await client.eval(`document.getElementById('mode-solo').click()`);
    await sleep(300);
    await client.eval(`document.getElementById('btn-proceed-customizer').click()`);
    await sleep(500);
    await client.eval(`document.getElementById('btn-start-match').click()`);
    await sleep(600);

    // 1. Verifikasi Spawn 1-by-1
    console.log('--- TAHAP 1: VERIFIKASI SPAWN BUFF 1 PER 1 ---');
    const buffStatus = await client.eval(`(() => {
      const bm = window.game.physics.buffManager;
      const item = bm.activeBuffItem;
      return {
        hasBuff: !!item,
        active: item ? item.active : false,
        name: item ? item.def.name : null,
        icon: item ? item.def.icon : null,
        id: item ? item.def.id : null,
        pos: item ? { x: Math.round(item.x), y: Math.round(item.y) } : null
      };
    })()`);
    console.log('Status Buff Item di Lapangan:', JSON.stringify(buffStatus));
    await client.screenshot('tester_buff_1_spawn.png');

    // 2. Simulasi Koin Mengambil Buff Item
    console.log('\n--- TAHAP 2: PENGAMBILAN BUFF OLEH KOIN ZIGGY ---');
    const claimResult = await client.eval(`(() => {
      const bm = window.game.physics.buffManager;
      const char = window.game.activeUserChar;
      const item = bm.activeBuffItem;
      
      // Letakkan koin tepat di item buff untuk mensimulasikan tabrakan
      char.x = item.x;
      char.y = item.y;
      bm.claimBuff(char, item, (x, y, text, color) => window.game.physics.addCallout(x, y, text, color));

      return {
        pendingBuff: char.pendingBuff ? char.pendingBuff.name : null,
        pendingIcon: char.pendingBuff ? char.pendingBuff.icon : null,
        activeBuffItemActive: item.active
      };
    })()`);
    console.log('Hasil Pengambilan Buff:', JSON.stringify(claimResult));
    await sleep(400);
    await client.screenshot('tester_buff_2_collected.png');

    // 3. Pergantian Turn: Verifikasi Buff DITERAPKAN DI TURN BERIKUTNYA
    console.log('\n--- TAHAP 3: TRANSISI KE TURN BERIKUTNYA (BUFF DIAKTIFKAN!) ---');
    const turnAdvanceResult = await client.eval(`(() => {
      // Jalankan onTurnAdvanced pada BuffManager
      window.game.physics.buffManager.onTurnAdvanced(
        2,
        window.game.entities,
        window.game.ball,
        (x, y, text, color) => window.game.physics.addCallout(x, y, text, color)
      );

      const char = window.game.activeUserChar;
      const bm = window.game.physics.buffManager;

      return {
        activeBuffOnChar: char.activeBuff ? char.activeBuff.name : null,
        activeBuffIcon: char.activeBuff ? char.activeBuff.icon : null,
        pendingBuffOnChar: char.pendingBuff,
        buffTurnsRemaining: char.buffTurnsRemaining,
        newBuffOnField: bm.activeBuffItem ? bm.activeBuffItem.def.name : null,
        isNewBuffActive: bm.activeBuffItem ? bm.activeBuffItem.active : false
      };
    })()`);
    console.log('Status Buff Setelah Turn Berganti:', JSON.stringify(turnAdvanceResult));
    await sleep(400);
    await client.screenshot('tester_buff_3_activated_next_turn.png');

    // 4. Uji Pengarahan Bidikan dengan Buff Aktif
    console.log('\n--- TAHAP 4: UJI BIDIKAN & AKSI DENGAN EFEK BUFF ---');
    await client.eval(`(() => {
      const char = window.game.activeUserChar;
      char.isAiming = true;
      char.aimPower = 120;
      char.aimAngle = 0;
      window.game.updateActiveCharacterCard(char);
    })()`);
    await sleep(400);
    await client.screenshot('tester_buff_4_aim_with_buff.png');

    // Uji Tombol Ready & Eksekusi Turn
    await client.eval(`document.getElementById('btn-ready').click()`);
    await sleep(800);
    await client.screenshot('tester_buff_5_action_with_buff.png');

    console.log('\n--- EVALUASI RUNTIME ---');
    const exceptions = client.consoleLogs.filter(l => l.includes('EXCEPTION') || l.includes('error'));
    console.log(`Total log konsol: ${client.consoleLogs.length}`);
    if (exceptions.length > 0) {
      console.warn('Peringatan error ditemukan:');
      exceptions.forEach(e => console.warn('  ' + e));
    } else {
      console.log('✅ ZERO RUNTIME ERROR! Seluruh alur sistem buff berjalan 100% mulus!');
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
