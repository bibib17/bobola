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
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      const detail = res.exceptionDetails.exception?.description || res.exceptionDetails.text || JSON.stringify(res.exceptionDetails);
      throw new Error(`Eval failed: ${detail}`);
    }
    return res.result?.value;
  }
}

async function connectCDPWithRetry(port, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json`);
      const page = targets?.find(t => t.type === 'page');
      if (page) {
        const client = new CDPClient(page.webSocketDebuggerUrl);
        await client.ready();
        await client.send('Runtime.enable');
        return client;
      }
    } catch (e) {
      // retry
    }
    await sleep(400);
  }
  throw new Error(`Could not connect to Chrome CDP on port ${port}`);
}

async function waitForGame(client) {
  for (let i = 0; i < 30; i++) {
    try {
      const ready = await client.eval(`typeof window.game !== 'undefined' && !!document.getElementById('mode-solo') && !!document.getElementById('input-player-name')`);
      if (ready) return true;
    } catch (e) {}
    await sleep(400);
  }
  throw new Error('Timeout waiting for game initialization');
}

async function runTestSuite() {
  console.log('=====================================================');
  console.log('⚡ BOLABOLA FULL TEST SUITE: 3 GAME MODES EVALUATION ⚡');
  console.log('=====================================================\n');

  // 1. Start Server on port 3000
  const serverProc = spawn('node', ['server.js'], { cwd: __dirname });
  serverProc.stdout.on('data', d => console.log(`[Server] ${d.toString().trim()}`));
  serverProc.stderr.on('data', d => console.error(`[Server Error] ${d.toString().trim()}`));

  await sleep(1500);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const testResults = [];

  // ====================================================
  // TEST 1: MODE 1 (SOLO MATCH VS AI)
  // ====================================================
  console.log('----------------------------------------------------');
  console.log('🧪 TEST 1: Mode 1 - Solo Match vs AI');
  console.log('----------------------------------------------------');

  const tmpDir1 = path.join(__dirname, '.chrome_test_1');
  const chromeSolo = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9240',
    `--user-data-dir=${tmpDir1}`,
    '--window-size=1280,720',
    '--hide-scrollbars',
    '--disable-gpu',
    'http://localhost:3000'
  ]);

  const clientSolo = await connectCDPWithRetry(9240);
  await waitForGame(clientSolo);

  try {
    // 1. Click Solo Mode Card
    await clientSolo.eval(`document.getElementById('mode-solo')?.click();`);
    await sleep(400);

    // 2. Click Proceed to Customizer
    await clientSolo.eval(`document.getElementById('btn-proceed-customizer')?.click();`);
    await sleep(400);

    // 3. Click Start Match
    await clientSolo.eval(`document.getElementById('btn-start-match')?.click();`);
    await sleep(1000);

    const soloStart = await clientSolo.eval(`({
      gameMode: window.game.gameMode,
      phase: window.game.turnManager.phase,
      entitiesCount: window.game.entities.length,
      userTeam: window.game.userTeam,
      userCharKey: window.game.userCharKey,
      turn: window.game.turnManager.turn
    })`);

    console.log('✓ Solo Start State:', soloStart);

    // 4. Aim user coin (Ziggy) and click READY
    await clientSolo.eval(`
      const ziggy = window.game.entities.find(e => e.def.id === 'ziggy');
      ziggy.aimAngle = 0;
      ziggy.aimPower = 120;
      ziggy.isAiming = true;
      document.getElementById('btn-ready')?.click();
    `);
    await sleep(500);

    const soloResolution = await clientSolo.eval(`({
      phase: window.game.turnManager.phase,
      ziggyVx: window.game.entities.find(e => e.def.id === 'ziggy').vx,
      ballVx: window.game.ball.vx
    })`);
    console.log('✓ Solo Resolution State:', soloResolution);

    // 5. Wait for resolution to finish and turn to advance to Turn 2
    await sleep(4500);
    const soloTurn2 = await clientSolo.eval(`({
      turn: window.game.turnManager.turn,
      phase: window.game.turnManager.phase,
      scoreRed: window.game.scoreRed,
      scoreBlue: window.game.scoreBlue
    })`);
    console.log('✓ Solo Turn 2 State:', soloTurn2);

    const passed1 = soloStart.gameMode === 'SOLO' && soloStart.phase === 'PLANNING' &&
                    (soloResolution.phase === 'RESOLUTION' || soloResolution.phase === 'GOAL') &&
                    soloTurn2.turn >= 1 && soloTurn2.phase === 'PLANNING';

    testResults.push({
      mode: 'Mode 1: Solo Match vs AI',
      passed: passed1,
      details: { soloStart, soloResolution, soloTurn2 }
    });

  } catch (err) {
    console.error('Test 1 Error:', err.message);
    testResults.push({ mode: 'Mode 1: Solo Match vs AI', passed: false, error: err.message });
  } finally {
    chromeSolo.kill();
  }

  // ====================================================
  // TEST 2: MODE 2 (ONLINE 1V1 TEAM DUEL)
  // ====================================================
  console.log('\n----------------------------------------------------');
  console.log('🧪 TEST 2: Mode 2 - Online 1v1 Full Team Duel (2 Players)');
  console.log('----------------------------------------------------');

  const tmpDir2 = path.join(__dirname, '.chrome_test_2');
  const tmpDir3 = path.join(__dirname, '.chrome_test_3');

  const chrome1v1_P1 = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9241',
    `--user-data-dir=${tmpDir2}`,
    '--window-size=1280,720',
    '--hide-scrollbars',
    '--disable-gpu',
    'http://localhost:3000'
  ]);

  const chrome1v1_P2 = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9242',
    `--user-data-dir=${tmpDir3}`,
    '--window-size=1280,720',
    '--hide-scrollbars',
    '--disable-gpu',
    'http://localhost:3000'
  ]);

  const client1v1_P1 = await connectCDPWithRetry(9241);
  const client1v1_P2 = await connectCDPWithRetry(9242);
  await waitForGame(client1v1_P1);
  await waitForGame(client1v1_P2);

  try {
    const duelRoomCode = 'DUEL88';

    // 1. P1 creates room
    await client1v1_P1.eval(`
      document.getElementById('mode-1v1')?.click();
      document.getElementById('input-player-name').value = 'Player 1 (Red)';
      document.getElementById('input-room-code').value = '${duelRoomCode}';
      document.getElementById('btn-create-room')?.click();
    `);
    await sleep(1000);

    const p1RoomState = await client1v1_P1.eval(`({
      roomId: window.game.roomId,
      playerId: window.game.playerId,
      hostId: window.game.hostId,
      players: window.game.onlineRoomPlayers
    })`);
    console.log('P1 Room State after create:', p1RoomState);

    // 2. P2 joins room
    await client1v1_P2.eval(`
      document.getElementById('mode-1v1')?.click();
      document.getElementById('input-player-name').value = 'Player 2 (Blue)';
      document.getElementById('input-room-code').value = '${duelRoomCode}';
      document.getElementById('btn-join-room')?.click();
    `);
    await sleep(1200);

    const p2RoomState = await client1v1_P2.eval(`({
      roomId: window.game.roomId,
      playerId: window.game.playerId,
      hostId: window.game.hostId,
      players: window.game.onlineRoomPlayers
    })`);
    console.log('P2 Room State after join:', p2RoomState);

    // 3. P2 chooses Blue Team & Readies
    await client1v1_P2.eval(`
      document.getElementById('btn-room-join-blue')?.click();
    `);
    await sleep(400);
    await client1v1_P2.eval(`
      document.getElementById('btn-room-ready')?.click();
    `);
    await sleep(400);

    // 4. P1 Readies & Starts Match
    await client1v1_P1.eval(`
      document.getElementById('btn-room-ready')?.click();
    `);
    await sleep(400);
    await client1v1_P1.eval(`
      document.getElementById('btn-room-start')?.click();
    `);
    await sleep(1200);

    const p1DuelStart = await client1v1_P1.eval(`({
      phase: window.game.turnManager.phase,
      gameMode: window.game.gameMode,
      turn: window.game.turnManager.turn,
      entitiesCount: window.game.entities.length
    })`);
    const p2DuelStart = await client1v1_P2.eval(`({
      phase: window.game.turnManager.phase,
      gameMode: window.game.gameMode,
      turn: window.game.turnManager.turn
    })`);

    console.log('✓ 1v1 Start State - P1:', p1DuelStart, 'P2:', p2DuelStart);

    // 5. Test Simultaneous Team Aim
    // P1 aims Red Team Coins
    await client1v1_P1.eval(`
      const redCoin = window.game.entities.find(e => e.team === 'RED');
      if (redCoin) {
        redCoin.aimAngle = 0;
        redCoin.aimPower = 110;
        redCoin.isAiming = true;
      }
      document.getElementById('btn-ready')?.click();
    `);
    await sleep(300);

    // P2 aims Blue Team Coins
    await client1v1_P2.eval(`
      const blueCoin = window.game.entities.find(e => e.team === 'BLUE');
      if (blueCoin) {
        blueCoin.aimAngle = Math.PI;
        blueCoin.aimPower = 110;
        blueCoin.isAiming = true;
      }
      document.getElementById('btn-ready')?.click();
    `);

    await sleep(1000);

    const duelResolution = await client1v1_P1.eval(`({
      phase: window.game.turnManager.phase,
      scoreRed: window.game.scoreRed,
      scoreBlue: window.game.scoreBlue
    })`);
    console.log('✓ 1v1 Resolution State:', duelResolution);

    const passed2 = p1DuelStart.phase === 'PLANNING' && p2DuelStart.phase === 'PLANNING' &&
                    (duelResolution.phase === 'RESOLUTION' || duelResolution.phase === 'GOAL' || duelResolution.phase === 'PLANNING');

    testResults.push({
      mode: 'Mode 2: Online 1v1 Team Duel (2 Players)',
      passed: passed2,
      details: { p1DuelStart, p2DuelStart, duelResolution }
    });

  } catch (err) {
    console.error('Test 2 Error:', err.message);
    testResults.push({ mode: 'Mode 2: Online 1v1 Team Duel (2 Players)', passed: false, error: err.message });
  } finally {
    chrome1v1_P1.kill();
    chrome1v1_P2.kill();
  }

  // ====================================================
  // TEST 3: MODE 3 (ONLINE PARTY ROOM 4-8 PLAYERS)
  // ====================================================
  console.log('\n----------------------------------------------------');
  console.log('🧪 TEST 3: Mode 3 - Online Party Room (4-8 Players, 1 Coin/Player)');
  console.log('----------------------------------------------------');

  const tmpDir4 = path.join(__dirname, '.chrome_test_4');
  const tmpDir5 = path.join(__dirname, '.chrome_test_5');

  const chromeParty_P1 = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9243',
    `--user-data-dir=${tmpDir4}`,
    '--window-size=1280,720',
    '--hide-scrollbars',
    '--disable-gpu',
    'http://localhost:3000'
  ]);

  const chromeParty_P2 = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9244',
    `--user-data-dir=${tmpDir5}`,
    '--window-size=1280,720',
    '--hide-scrollbars',
    '--disable-gpu',
    'http://localhost:3000'
  ]);

  const clientParty_P1 = await connectCDPWithRetry(9243);
  const clientParty_P2 = await connectCDPWithRetry(9244);
  await waitForGame(clientParty_P1);
  await waitForGame(clientParty_P2);

  try {
    const partyRoomCode = 'PARTY9';

    // 1. P1 creates Party Room
    await clientParty_P1.eval(`
      document.getElementById('mode-online')?.click();
      document.getElementById('input-player-name').value = 'Host Red';
      document.getElementById('input-room-code').value = '${partyRoomCode}';
      document.getElementById('btn-create-room')?.click();
    `);
    await sleep(1000);

    // 2. P2 joins Party Room
    await clientParty_P2.eval(`
      document.getElementById('mode-online')?.click();
      document.getElementById('input-player-name').value = 'Guest Blue';
      document.getElementById('input-room-code').value = '${partyRoomCode}';
      document.getElementById('btn-join-room')?.click();
    `);
    await sleep(1200);

    // 3. P2 chooses Blue Team & Readies
    await clientParty_P2.eval(`
      document.getElementById('btn-room-join-blue')?.click();
    `);
    await sleep(400);
    await clientParty_P2.eval(`
      document.getElementById('btn-room-ready')?.click();
    `);
    await sleep(400);

    // 4. P1 Readies & Starts Match
    await clientParty_P1.eval(`
      document.getElementById('btn-room-ready')?.click();
    `);
    await sleep(400);
    await clientParty_P1.eval(`
      document.getElementById('btn-room-start')?.click();
    `);
    await sleep(1200);

    const partyStartP1 = await clientParty_P1.eval(`({
      phase: window.game.turnManager.phase,
      gameMode: window.game.gameMode,
      userTeam: window.game.userTeam,
      activeUserChar: window.game.activeUserChar?.charKey
    })`);
    const partyStartP2 = await clientParty_P2.eval(`({
      phase: window.game.turnManager.phase,
      gameMode: window.game.gameMode,
      userTeam: window.game.userTeam,
      activeUserChar: window.game.activeUserChar?.charKey
    })`);

    console.log('✓ Party Start State - P1:', partyStartP1, 'P2:', partyStartP2);

    // 5. Individual Aiming
    await clientParty_P1.eval(`
      const char = window.game.activeUserChar || window.game.entities.find(e => e.isUser);
      if (char) {
        char.aimAngle = 0.1;
        char.aimPower = 95;
        window.game.network.sendAimUpdate(char.aimAngle, char.aimPower);
      }
      document.getElementById('btn-ready')?.click();
    `);
    await sleep(300);

    await clientParty_P2.eval(`
      const char = window.game.activeUserChar || window.game.entities.find(e => e.isUser);
      if (char) {
        char.aimAngle = Math.PI - 0.1;
        char.aimPower = 95;
        window.game.network.sendAimUpdate(char.aimAngle, char.aimPower);
      }
      document.getElementById('btn-ready')?.click();
    `);

    await sleep(1000);

    const partyResolution = await clientParty_P1.eval(`({
      phase: window.game.turnManager.phase,
      scoreRed: window.game.scoreRed,
      scoreBlue: window.game.scoreBlue
    })`);
    console.log('✓ Party Resolution State:', partyResolution);

    const passed3 = partyStartP1.phase === 'PLANNING' && partyStartP2.phase === 'PLANNING' &&
                    (partyResolution.phase === 'RESOLUTION' || partyResolution.phase === 'GOAL');

    testResults.push({
      mode: 'Mode 3: Online Party Room (4-8 Players, 1 Coin/Player)',
      passed: passed3,
      details: { partyStartP1, partyStartP2, partyResolution }
    });

  } catch (err) {
    console.error('Test 3 Error:', err.message);
    testResults.push({ mode: 'Mode 3: Online Party Room (4-8 Players, 1 Coin/Player)', passed: false, error: err.message });
  } finally {
    chromeParty_P1.kill();
    chromeParty_P2.kill();
  }

  // ====================================================
  // FINAL RESULTS SUMMARY
  // ====================================================
  console.log('\n=====================================================');
  console.log('📊 FINAL TEST SUITE RESULTS REPORT');
  console.log('=====================================================');
  console.log(JSON.stringify(testResults, null, 2));

  serverProc.kill();

  fs.writeFileSync('test_results_dump.json', JSON.stringify(testResults, null, 2));
}

runTestSuite().catch(e => {
  console.error('Test Suite Fatal Error:', e);
  process.exit(1);
});
