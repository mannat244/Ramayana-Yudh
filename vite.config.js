import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

function gameplayLoggerPlugin() {
  return {
    name: 'gameplay-logger-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/log-gameplay', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const logFile = path.resolve(process.cwd(), 'gameplay_hang_log.json');
              const summaryFile = path.resolve(process.cwd(), 'gameplay_hang_summary.txt');

              fs.writeFileSync(logFile, JSON.stringify(data, null, 2), 'utf8');

              // Generate human-readable summary
              const lines = [
                '======================================================================',
                '   RAMAYANA YUDH — GAMEPLAY HANG TELEMETRY REPORT',
                '======================================================================\n',
                `Recorded at: ${data.reportGeneratedAt || new Date().toISOString()}`,
                `Session Duration: ${data.sessionSummary?.durationSeconds}s`,
                `Total Frames: ${data.sessionSummary?.totalFramesRendered} (Avg FPS: ${data.sessionSummary?.averageFPS})`,
                `Worst Frame Time: ${data.sessionSummary?.worstFrameMs}ms`,
                `Total Hangs Captured: ${data.sessionSummary?.totalHangsDetected} (Critical Freezes: ${data.sessionSummary?.criticalFreezesCount})`,
                `GPU Renderer: ${data.hardware?.gpuRenderer || 'N/A'}\n`,
                '--- HANG SUMMARY BY BOTTLENECK CAUSE ---',
                ...Object.entries(data.hangsSummaryByCause || {}).map(([cause, count]) => `• ${cause}: ${count} occurrence(s)`),
                '\n--- DETAILED HANG EVENTS (TOP 10 WORST) ---',
                ...(data.hangEvents || [])
                  .slice()
                  .sort((a, b) => b.totalFrameMs - a.totalFrameMs)
                  .slice(0, 10)
                  .map((h, i) => [
                    `[#${i + 1}] Frame Duration: ${h.totalFrameMs}ms at t=${h.timestampSeconds}s (${h.severity})`,
                    `     Primary Cause: ${h.primaryCause} (${h.causeDetail})`,
                    `     Breakdown: JS=${h.breakdown?.jsMs}ms (Physics=${h.breakdown?.physicsMs}ms, Player=${h.breakdown?.playerMs}ms, Enemy=${h.breakdown?.enemyMs}ms), Render=${h.breakdown?.renderMs}ms, Browser/GC=${h.breakdown?.browserOtherMs}ms`,
                    `     Draw Calls: ${h.hardware?.drawCalls}, Triangles: ${h.hardware?.triangles?.toLocaleString()}, Heap: ${h.hardware?.heapUsedMB} MB`,
                    `     Game State: Enemies Active=${h.gameState?.enemies?.activeEnemiesCount}, Aiming=${h.gameState?.player?.isAiming}, Shooting=${h.gameState?.player?.isShooting}`,
                    `     Camera Yaw=${h.gameState?.player?.yaw}, Pitch=${h.gameState?.player?.pitch}`,
                    ''
                  ].join('\n'))
              ];

              fs.writeFileSync(summaryFile, lines.join('\n'), 'utf8');
              console.log(`\x1b[32m[Gameplay Logger] Hang telemetry saved to gameplay_hang_log.json & gameplay_hang_summary.txt (${data.sessionSummary?.totalHangsDetected} hangs recorded)\x1b[0m`);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, saved: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else {
          res.statusCode = 404;
          res.end();
        }
      });
    }
  };
}

export default defineConfig({
  base: './',
  root: './',
  publicDir: 'public',
  plugins: [
    gameplayLoggerPlugin()
  ],
  server: {
    port: 5173,
    host: true,
    open: false
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});

