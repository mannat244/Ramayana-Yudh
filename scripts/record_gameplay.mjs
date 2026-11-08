import { createServer } from 'vite';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

async function startRecorder() {
  console.log('\x1b[33m======================================================================');
  console.log('   RAMAYANA YUDH — INTERACTIVE GAMEPLAY HANG RECORDER');
  console.log('======================================================================\x1b[0m\n');

  // 1. Start or connect to Vite dev server
  const server = await createServer({
    configFile: './vite.config.js',
    server: { port: 5173, host: 'localhost' }
  });
  await server.listen();
  const baseUrl = `http://localhost:5173`;

  console.log(`\x1b[32m✓ Local game server running at: ${baseUrl}\x1b[0m`);

  // 2. Locate Chrome
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debugPort = 9305;
  const userDataDir = path.join(process.env.TEMP, 'chrome_ramayana_gameplay_' + Date.now());

  console.log(`\x1b[36m🚀 Launching Google Chrome with Hardware Acceleration & Hang Logger...\x1b[0m`);
  console.log(`   (Play normally. All freezes and hangs are being automatically recorded to disk)\n`);

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${debugPort}`,
    '--force_high_performance_gpu',
    '--gpu-preference=high-performance',
    '--window-size=1440,900',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=' + userDataDir,
    baseUrl
  ], { stdio: 'ignore' });

  // Wait for Chrome remote debugging to come online
  let wsUrl = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const pages = await listRes.json();
      const page = pages.find(p => p.url.includes('5173')) || pages[0];
      if (page?.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch (e) {}
  }

  if (!wsUrl) {
    console.error('\x1b[31mFailed to connect to Chrome debugging port.\x1b[0m');
    chromeProc.kill();
    await server.close();
    process.exit(1);
  }

  // 3. Connect WebSocket for live telemetry logging
  const ws = new WebSocket(wsUrl);
  let msgId = 1;

  function send(method, params = {}) {
    const id = msgId++;
    ws.send(JSON.stringify({ id, method, params }));
  }

  ws.onopen = () => {
    send('Runtime.enable');
    send('Log.enable');
  };

  const capturedHangs = [];
  const logFile = path.resolve(process.cwd(), 'gameplay_hang_log.json');
  const summaryFile = path.resolve(process.cwd(), 'gameplay_hang_summary.txt');

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map(a => a.value ?? a.description ?? '').join(' ');
        
        if (text.includes('[HANG DETECTED]')) {
          console.log(`\x1b[31m${text}\x1b[0m`);
          capturedHangs.push({
            time: new Date().toLocaleTimeString(),
            message: text
          });
        } else if (data.params.type === 'error') {
          console.log(`\x1b[31m[Browser Error] ${text}\x1b[0m`);
        } else if (data.params.type === 'warn') {
          console.log(`\x1b[33m[Browser Warning] ${text}\x1b[0m`);
        }
      } else if (data.method === 'Runtime.exceptionThrown') {
        const desc = data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails?.text;
        console.log(`\x1b[31m[Uncaught Exception] ${desc}\x1b[0m`);
      }
    } catch (e) {}
  };

  // Graceful shutdown handler
  let isExiting = false;
  async function cleanup() {
    if (isExiting) return;
    isExiting = true;

    console.log('\n\x1b[33m======================================================================');
    console.log('   SESSION FINISHED — FINALIZING HANG REPORT');
    console.log('======================================================================\x1b[0m');

    // Request final dump from browser
    try {
      send('Runtime.evaluate', { expression: `window.__gameplayLogger?.exportLogJSON()` });
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {}

    try { ws.close(); } catch (e) {}
    try { chromeProc.kill(); } catch (e) {}
    try { await server.close(); } catch (e) {}

    // Check if report exists
    if (fs.existsSync(summaryFile)) {
      console.log(`\n\x1b[32m✓ Summary written to: ${summaryFile}\x1b[0m`);
      console.log(`\x1b[32m✓ Detailed JSON written to: ${logFile}\x1b[0m\n`);
      const content = fs.readFileSync(summaryFile, 'utf8');
      console.log(content);
    } else {
      console.log(`\x1b[36mSession completed. ${capturedHangs.length} hang event(s) recorded in real-time.\x1b[0m`);
    }

    process.exit(0);
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  chromeProc.on('exit', cleanup);

  console.log('\x1b[32m✓ Logger listening. Close Chrome or press Ctrl+C in this terminal when finished playing.\x1b[0m\n');
}

startRecorder().catch(err => {
  console.error('Failed to start recorder:', err);
  process.exit(1);
});

