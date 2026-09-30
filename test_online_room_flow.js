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
  console.log('=== TEST ALUR BUAT ROOM LOBBY (TIDAK LANGSUNG IN-GAME) ===\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cdpPort = 9229;
  const userDataDir = path.join(__dirname, '.temp_chrome_room_test');

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

    // 1. Pilih Mode Online Room Multiplayer di Lobby
    console.log('1. Memilih mode Online Room Multiplayer di menu utama...');
    await client.eval(`document.getElementById('mode-online').click()`);
    await sleep(300);

    const inputsVisible = await client.eval(`!document.getElementById('online-room-inputs').classList.contains('hidden')`);
    const soloProceedHidden = await client.eval(`document.getElementById('lobby-action-row-solo').classList.contains('hidden')`);
    console.log('Input box online muncul:', inputsVisible, '| Tombol lanjut solo disembunyikan:', soloProceedHidden);

    // 2. Klik BUAT ROOM BARU
    console.log('\n2. Mengklik BUAT ROOM BARU (dengan kode TEST7)...');
    await client.eval(`
      document.getElementById('input-player-name').value = 'Kapten Red';
      document.getElementById('input-room-code').value = 'TEST7';
      document.getElementById('btn-create-room').click();
    `);
    await sleep(700);

    // 3. Verifikasi apakah masuk ke Room Lobby (BUKAN langsung in-game!)
    const isRoomLobbyVisible = await client.eval(`!document.getElementById('online-room-screen').classList.contains('hidden')`);
    const isMainLobbyHidden = await client.eval(`document.getElementById('lobby-screen').classList.contains('hidden')`);
    const turnPhase = await client.eval(`window.game.turnManager.phase`);
    const displayedCode = await client.eval(`document.getElementById('room-code-display').textContent`);
    const isControlsLocked = await client.eval(`window.game.slingshot.isControlsLocked`);

    console.log('\n--- VERIFIKASI ROOM LOBBY (TIDAK MASUK LANGSUNG KE IN-GAME) ---');
    console.log('Room Lobby Screen terlihat:', isRoomLobbyVisible);
    console.log('Main Lobby tertutup:', isMainLobbyHidden);
    console.log('Turn Manager Phase (Harus LOBBY, BUKAN PLANNING):', turnPhase);
    console.log('Kontrol Slingshot terkunci:', isControlsLocked);
    console.log('Kode Room yang ditampilkan:', displayedCode);

    await client.screenshot('room_lobby_waiting_room.png');

    if (isRoomLobbyVisible && turnPhase === 'LOBBY' && displayedCode === 'TEST7') {
      console.log('✅ BERHASIL: Buat room sekarang masuk ke Waiting Room Lobby, TIDAK langsung in-game!');
    } else {
      console.error('❌ GAGAL: Masih langsung masuk in-game atau phase salah!');
      process.exit(1);
    }

    // 4. Uji interaksi di Room Lobby: ganti tim ke BIRU, ganti koin ke KIKI, klik READY
    console.log('\n4. Menguji interaksi di Room Lobby (Pindah ke Tim Biru & ganti koin ke Kiki)...');
    await client.eval(`document.getElementById('btn-room-join-blue').click()`);
    await sleep(300);
    await client.eval(`
      const kikiChip = document.querySelector('.room-char-chip[data-key="KIKI"]') || Array.from(document.querySelectorAll('.room-char-chip')).find(el => el.textContent.includes('Kiki'));
      if (kikiChip) kikiChip.click();
    `);
    await sleep(300);

    const userTeamAfterSwitch = await client.eval(`window.game.userTeam`);
    const userCharAfterSwitch = await client.eval(`window.game.userCharKey`);
    console.log('User team di room:', userTeamAfterSwitch, '| User character di room:', userCharAfterSwitch);

    console.log('Mengklik READY ✓ di Room Lobby...');
    await client.eval(`document.getElementById('btn-room-ready').click()`);
    await sleep(300);

    const isReadyActive = await client.eval(`document.getElementById('btn-room-ready').classList.contains('active')`);
    console.log('Status tombol ready aktif:', isReadyActive);
    await client.screenshot('room_lobby_customized.png');

    // 5. Host memulai pertandingan
    console.log('\n5. Host mengklik MULAI PERTANDINGAN ⚽...');
    await client.eval(`document.getElementById('btn-room-start').click()`);
    await sleep(800);

    const isRoomScreenClosed = await client.eval(`document.getElementById('online-room-screen').classList.contains('hidden')`);
    const inGamePhase = await client.eval(`window.game.turnManager.phase`);
    const activeChar = await client.eval(`window.game.activeUserChar ? window.game.activeUserChar.def.id : null`);
    console.log('Room Lobby ditutup setelah mulai:', isRoomScreenClosed);
    console.log('Fase in-game sekarang:', inGamePhase);
    console.log('Karakter aktif saat in-game dimulai:', activeChar);
    await client.screenshot('room_match_started_ingame.png');

    if (isRoomScreenClosed && inGamePhase === 'PLANNING') {
      console.log('✅ BERHASIL: Pertandingan online dimulai dengan sempurna setelah host menekan Mulai Pertandingan!');
    } else {
      console.error('❌ GAGAL saat memulai match dari room lobby!');
    }

    // 6. Uji tombol Keluar Room (Leave)
    console.log('\n6. Kembali ke lobby dan uji tombol KELUAR ROOM...');
    await client.eval(`window.game.returnToLobby()`);
    await sleep(400);

    await client.eval(`
      document.getElementById('mode-online').click();
      document.getElementById('input-room-code').value = 'LEAVE1';
      document.getElementById('btn-create-room').click();
    `);
    await sleep(600);

    console.log('Mengklik ⬅️ KELUAR ROOM...');
    await client.eval(`document.getElementById('btn-room-leave').click()`);
    await sleep(400);

    const backInMainLobby = await client.eval(`!document.getElementById('lobby-screen').classList.contains('hidden')`);
    const roomScreenHidden = await client.eval(`document.getElementById('online-room-screen').classList.contains('hidden')`);
    console.log('Kembali ke Lobby Utama:', backInMainLobby, '| Room Screen tertutup:', roomScreenHidden);
    await client.screenshot('room_lobby_left.png');

    if (backInMainLobby && roomScreenHidden) {
      console.log('✅ BERHASIL: Tombol KELUAR ROOM mengembalikan pemain ke menu utama secara bersih!');
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

runTest().catch(console.error);
