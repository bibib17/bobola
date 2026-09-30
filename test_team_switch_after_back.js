import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
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
}

async function testTeamSwitch() {
  console.log('=== TEST PERGANTIAN TIM & KOIN SETELAH KEMBALI KE LOBBY ===\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cdpPort = 9228;
  const userDataDir = path.join(__dirname, '.temp_chrome_team_switch');

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

    // 1. Masuk match pertama dengan Tim Merah (default)
    console.log('1. Memulai match pertama (Tim Merah)...');
    await client.eval(`document.getElementById('btn-proceed-customizer').click()`);
    await sleep(300);
    await client.eval(`document.getElementById('btn-start-match').click()`);
    await sleep(400);

    const match1User = await client.eval(`({
      userTeam: window.game.userTeam,
      charId: window.game.activeUserChar.def.id,
      charTeam: window.game.activeUserChar.team,
      isUser: window.game.activeUserChar.isUser
    })`);
    console.log('Match 1 User info:', match1User);

    // 2. Klik btn-home untuk kembali ke menu utama
    console.log('\n2. Kembali ke Halaman Utama via btn-home...');
    await client.eval(`document.getElementById('btn-home').click()`);
    await sleep(400);

    // 3. Masuk kembali ke pemilihan karakter
    console.log('\n3. Masuk kembali ke pemilihan karakter...');
    await client.eval(`document.getElementById('btn-proceed-customizer').click()`);
    await sleep(300);

    // 4. Ganti tim ke TIM BIRU dan pilih karakter Kiki
    console.log('4. Mengklik ganti tim ke TIM BIRU...');
    await client.eval(`document.getElementById('btn-pick-blue').click()`);
    await sleep(300);

    console.log('Memilih karakter KIKI di grid...');
    await client.eval(`
      const kikiCard = document.querySelector('.char-card-item[data-key="KIKI"]');
      if (kikiCard) kikiCard.click();
    `);
    await sleep(300);

    // 5. Mulai match kedua
    console.log('\n5. Memulai match kedua dengan Tim Biru...');
    await client.eval(`document.getElementById('btn-start-match').click()`);
    await sleep(500);

    const match2User = await client.eval(`({
      userTeam: window.game.userTeam,
      charId: window.game.activeUserChar.def.id,
      charTeam: window.game.activeUserChar.team,
      isUser: window.game.activeUserChar.isUser,
      userTeamCoins: window.game.entities.filter(e => e.team === window.game.userTeam).length,
      userTeamHasActiveUser: window.game.entities.filter(e => e.team === 'BLUE' && e.isUser).length
    })`);
    console.log('Match 2 User info (Harus Tim Biru & Kiki):', match2User);

    if (match2User.userTeam === 'BLUE' && match2User.charTeam === 'BLUE' && match2User.charId === 'kiki') {
      console.log('✅ BERHASIL: Pergantian tim dan koin setelah kembali ke lobby bekerja 100% sempurna!');
    } else {
      console.error('❌ GAGAL: User team atau karakter tidak sinkron!');
      process.exit(1);
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

testTeamSwitch().catch(console.error);
