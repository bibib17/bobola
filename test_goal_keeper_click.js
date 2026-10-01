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

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }
}

async function startStaticServer(port = 8182) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg'
  };

  const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });

  await new Promise(resolve => server.listen(port, resolve));
  return server;
}

async function main() {
  console.log('=== TEST GOALKEEPER / ROCCO #8 TOUCH SELECTION & AIMING ===\n');

  const server = await startStaticServer(8182);
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join(__dirname, '.temp_chrome_goal');

  const chromeProc = spawn(chromePath, [
    '--remote-debugging-port=9226',
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=844,390', // iPhone 14/15 Landscape
    'http://localhost:8182'
  ]);

  let targets = null;
  for (let i = 0; i < 20; i++) {
    try {
      targets = await fetchJson('http://127.0.0.1:9226/json');
      if (targets && targets.length > 0) break;
    } catch (e) {
      await sleep(300);
    }
  }

  if (!targets) throw new Error('Could not connect to Chrome on port 9226');

  try {
    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found');

    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.ready();
    await client.send('Runtime.enable');

    // 1. Proceed to match
    await client.eval(`document.getElementById('btn-proceed-customizer').click()`);
    await sleep(300);
    await client.eval(`document.getElementById('btn-start-match').click()`);
    await sleep(600);

    console.log('Match started.');

    // 2. Test clicking bottom dot for Rocco
    await client.eval(`document.getElementById('dot-rocco').click()`);
    await sleep(200);

    const activeCharAfterDot = await client.eval(`({
      name: document.getElementById('active-char-name').textContent,
      isRoccoUser: window.game?.entities?.find(e => e.def?.id === 'rocco')?.isUser
    })`);
    console.log('[TEST 1] Roster Dot selection result:', activeCharAfterDot);

    // 3. Test Touch directly on Goal / Near Rocco
    // Let's get canvas bounding rect
    const canvasRect = await client.eval(`({
      left: document.getElementById('game-canvas').getBoundingClientRect().left,
      top: document.getElementById('game-canvas').getBoundingClientRect().top,
      width: document.getElementById('game-canvas').getBoundingClientRect().width,
      height: document.getElementById('game-canvas').getBoundingClientRect().height
    })`);
    console.log('Canvas Rect on Screen:', canvasRect);

    // Rocco is at virtual (140, 270). Touch at (50, 270) inside goal box
    const touchX = canvasRect.left + (50 / 960) * canvasRect.width;
    const touchY = canvasRect.top + (270 / 540) * canvasRect.height;

    const touchResult = await client.eval(`(() => {
      const slingshot = window.game?.slingshot;
      if (!slingshot) return { error: 'No slingshot' };
      const started = slingshot.handleStart(${touchX}, ${touchY});
      slingshot.handleMove(${touchX + 60}, ${touchY + 40});
      const selected = slingshot.selectedChar;
      return {
        started,
        selectedName: selected?.def?.name,
        selectedNumber: selected?.number,
        isAiming: selected?.isAiming,
        aimPower: selected?.aimPower
      };
    })()`);
    console.log('[TEST 2] Goal Area Touch & Drag Result:', touchResult);

    if (touchResult.selectedName === 'Rocco' && touchResult.isAiming) {
      console.log('\n✅ TEST PASSED: Rocco #8 (Goalkeeper/Bek dekat gawang) berhasil disentuh dan dibidik dengan sempurna!');
    } else {
      throw new Error(`Rocco was not properly selected! Got: ${JSON.stringify(touchResult)}`);
    }

  } finally {
    chromeProc.kill();
    server.close();
  }
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
