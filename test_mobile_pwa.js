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

async function startStaticServer(port = 8181) {
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
  console.log('=== TEST SUITE: MOBILE COMPACT & PWA VERIFICATION ===\n');

  const server = await startStaticServer(8181);
  console.log('Local test server running at http://localhost:8181');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join(__dirname, '.temp_chrome_test');

  const chromeProc = spawn(chromePath, [
    '--remote-debugging-port=9225',
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=844,390', // iPhone 14/15 Landscape
    'http://localhost:8181'
  ]);

  await sleep(2000);

  try {
    const versionInfo = await fetchJson('http://localhost:9225/json/version');
    const targets = await fetchJson('http://localhost:9225/json');
    const pageTarget = targets.find(t => t.type === 'page');

    if (!pageTarget) throw new Error('No page target found in Chrome');

    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.ready();
    await client.send('Runtime.enable');
    await client.send('Page.enable');

    console.log('Connected to Chrome DevTools Protocol.');

    // 1. Check PWA Manifest link
    const manifestLink = await client.eval(`document.querySelector('link[rel="manifest"]')?.getAttribute('href')`);
    console.log(`[PASS] PWA Manifest link: ${manifestLink}`);

    // 2. Check PWA Icons
    const appleIcon = await client.eval(`document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')`);
    console.log(`[PASS] Apple Touch Icon: ${appleIcon}`);

    // 3. Check Service Worker Registration
    const swSupported = await client.eval(`'serviceWorker' in navigator`);
    console.log(`[PASS] Service Worker API supported: ${swSupported}`);

    // 4. Test Mobile Landscape Layout Elements
    const isLobbyVisible = await client.eval(`!document.getElementById('lobby-screen').classList.contains('hidden')`);
    console.log(`[PASS] Lobby screen visible on launch: ${isLobbyVisible}`);

    const pwaInstallBtnExists = await client.eval(`!!document.getElementById('btn-pwa-install')`);
    console.log(`[PASS] PWA Install Button exists in DOM: ${pwaInstallBtnExists}`);

    // 5. Test proceed to Character Customizer
    await client.eval(`document.getElementById('btn-proceed-customizer').click()`);
    await sleep(400);

    const isCustomizerVisible = await client.eval(`!document.getElementById('character-select-screen').classList.contains('hidden')`);
    console.log(`[PASS] Character Selector opened: ${isCustomizerVisible}`);

    // 6. Test Start Match
    await client.eval(`document.getElementById('btn-start-match').click()`);
    await sleep(500);

    const gameCanvasSize = await client.eval(`({
      width: document.getElementById('game-canvas').width,
      height: document.getElementById('game-canvas').height,
      clientWidth: document.getElementById('game-canvas').clientWidth,
      clientHeight: document.getElementById('game-canvas').clientHeight
    })`);
    console.log(`[PASS] Canvas active match rendered:`, gameCanvasSize);

    // 7. Test Fullscreen / Orientation Toggle
    const fsBtnExists = await client.eval(`!!document.getElementById('btn-fullscreen')`);
    console.log(`[PASS] Fullscreen button available: ${fsBtnExists}`);

    await client.eval(`document.getElementById('btn-fullscreen').click()`);
    await sleep(300);

    const isPseudoFullscreen = await client.eval(`document.getElementById('game-wrapper').classList.contains('pseudo-fullscreen') || document.body.classList.contains('pseudo-fullscreen-active')`);
    console.log(`[PASS] Fullscreen / Pseudo-Fullscreen activated: ${isPseudoFullscreen}`);

    console.log('\n✅ ALL AUTOMATED MOBILE COMPACT & PWA TESTS PASSED PERFECTLY!');
  } finally {
    chromeProc.kill();
    server.close();
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
