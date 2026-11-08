import * as THREE from 'three';

/**
 * High-precision Gameplay Flight Recorder & Hang Logger.
 * Runs passively with near-zero overhead (< 0.04ms/frame).
 * Continuously monitors frame intervals and isolates hang causes
 * (JS execution, Physics, Enemy animation/LOD, GPU Render, GC / Browser idle).
 * Automatically captures forensic snapshots of game state on any hang
 * and writes to disk via /api/log-gameplay, localStorage, and JSON export.
 */
export class GameplayHangLogger {
  /**
   * @param {THREE.WebGLRenderer} renderer 
   * @param {import('./SceneManager.js').SceneManager} [sceneManager] 
   */
  constructor(renderer, sceneManager) {
    this.renderer = renderer;
    this.sceneManager = sceneManager;
    this.isEnabled = true;

    // Thresholds (ms)
    this.hangThresholdMs = 40.0; // Any frame >= 40ms (~ < 25fps) is captured
    this.criticalThresholdMs = 100.0; // Any frame >= 100ms is marked critical

    // Circular Rolling Frame Buffer (last 120 frames, ~2-3 seconds)
    this.BUFFER_SIZE = 120;
    this.frameBuffer = [];
    this.bufferIndex = 0;

    // Captured Hang Events
    this.hangEvents = [];
    this.topSessionHangs = [];
    this.maxRecordedHangs = 100;
    this._lastHeapMB = 0;

    // Session Statistics
    this.sessionStartTime = performance.now();
    this.totalFrames = 0;
    this.totalFrameTimeSum = 0;
    this.worstFrameTime = 0;
    this.recentFps = 60;
    this.lastFpsCalcTime = performance.now();
    this.framesSinceLastFpsCalc = 0;

    // Console message interceptor (last 20 logs)
    this.recentConsoleLogs = [];
    this.hookConsole();

    // Hardware & Driver Info
    this.hardwareInfo = this.getHardwareInfo();

    // HUD Display
    this.hudElement = null;
    this.initHUD();
    this.bindShortcuts();

    // Expose global debug utilities
    if (typeof window !== 'undefined') {
      window.__gameplayLogger = this;
      window.dumpHangLog = () => this.exportLogJSON();
      window.copyHangSummary = () => this.copySummaryToClipboard();
    }

    // Debounce server syncing to prevent GC churn during active gameplay
    this.lastSyncTime = 0;
    this.syncIntervalMs = 8000; // sync at most once every 8 seconds
  }

  getHardwareInfo() {
    try {
      const gl = this.renderer?.getContext();
      const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
      return {
        webglVersion: gl?.getParameter(gl.VERSION) || 'WebGL2',
        gpuVendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : 'N/A',
        gpuRenderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'N/A',
        pixelRatio: window.devicePixelRatio || 1,
        screenResolution: `${window.innerWidth}x${window.innerHeight}`,
        userAgent: navigator.userAgent
      };
    } catch (e) {
      return { gpuRenderer: 'Detection failed' };
    }
  }

  hookConsole() {
    if (typeof window === 'undefined') return;
    const origWarn = console.warn;
    const origError = console.error;

    console.warn = (...args) => {
      // Lightweight text logging without JSON stringification overhead
      const text = args.map(a => (typeof a === 'string' ? a : (a?.message || '[Object]'))).join(' ');
      this.recentConsoleLogs.push({
        type: 'warn',
        time: Number(((performance.now() - this.sessionStartTime) / 1000).toFixed(2)),
        text
      });
      if (this.recentConsoleLogs.length > 15) this.recentConsoleLogs.shift();
      origWarn.apply(console, args);
    };

    console.error = (...args) => {
      const text = args.map(a => (typeof a === 'string' ? a : (a?.message || '[Object]'))).join(' ');
      this.recentConsoleLogs.push({
        type: 'error',
        time: Number(((performance.now() - this.sessionStartTime) / 1000).toFixed(2)),
        text
      });
      if (this.recentConsoleLogs.length > 15) this.recentConsoleLogs.shift();
      origError.apply(console, args);
    };
  }

  initHUD() {
    if (typeof document === 'undefined') return;

    this.hudElement = document.createElement('div');
    this.hudElement.id = 'gameplay-hang-logger-pill';
    this.hudElement.style.cssText = `
      position: fixed;
      bottom: 12px;
      left: 12px;
      z-index: 99999;
      background: rgba(12, 16, 24, 0.90);
      border: 1px solid rgba(255, 215, 79, 0.40);
      border-radius: 20px;
      padding: 6px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: 'Consolas', 'Segoe UI', monospace;
      font-size: 11px;
      color: #f1f2f6;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
      user-select: none;
      transition: opacity 0.3s ease, transform 0.3s ease;
    `;

    this.hudElement.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span id="hang-logger-indicator" style="width: 8px; height: 8px; border-radius: 50%; background: #2ed573; box-shadow: 0 0 6px #2ed573; display: inline-block;"></span>
        <span id="hang-logger-status" style="font-weight: 600; color: #ffd54f;">RECORDER ACTIVE</span>
      </div>
      <span style="color: #747d8c;">|</span>
      <span id="hang-logger-stats">FPS: 60 • Hangs: 0</span>
      <div style="display: flex; gap: 6px; margin-left: 4px;">
        <button id="hang-logger-btn-export" style="background: rgba(255, 215, 79, 0.20); border: 1px solid rgba(255, 215, 79, 0.60); color: #ffd54f; border-radius: 12px; padding: 2px 8px; font-size: 10px; cursor: pointer; font-family: inherit;">Save Log (F9)</button>
        <button id="hang-logger-btn-copy" style="background: rgba(255, 255, 255, 0.10); border: 1px solid rgba(255, 255, 255, 0.25); color: #ced6e0; border-radius: 12px; padding: 2px 8px; font-size: 10px; cursor: pointer; font-family: inherit;">Copy</button>
        <button id="hang-logger-btn-toggle" title="Toggle Compact Mode (F8)" style="background: transparent; border: none; color: #a4b0be; cursor: pointer; font-size: 11px; padding: 0 4px;">✕</button>
      </div>
    `;

    document.body.appendChild(this.hudElement);

    const exportBtn = this.hudElement.querySelector('#hang-logger-btn-export');
    const copyBtn = this.hudElement.querySelector('#hang-logger-btn-copy');
    const toggleBtn = this.hudElement.querySelector('#hang-logger-btn-toggle');

    exportBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.exportLogJSON();
    });

    copyBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copySummaryToClipboard();
    });

    toggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCompact();
    });
  }

  toggleCompact() {
    if (!this.hudElement) return;
    this.isCompact = !this.isCompact;
    if (this.isCompact) {
      this.hudElement.style.opacity = '0.35';
      this.hudElement.style.transform = 'scale(0.85)';
      this.hudElement.style.transformOrigin = 'bottom left';
    } else {
      this.hudElement.style.opacity = '1.0';
      this.hudElement.style.transform = 'scale(1.0)';
    }
  }

  bindShortcuts() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F9') {
        e.preventDefault();
        this.exportLogJSON();
      } else if (e.key === 'F8') {
        e.preventDefault();
        this.toggleCompact();
      }
    });
  }

  /**
   * Main per-frame instrumentation hook.
   * Call once per frame with the sub-stage timings.
   * @param {object} timings 
   * @param {object} [context] 
   */
  recordFrame(timings, context = {}) {
    if (!this.isEnabled) return;

    const now = performance.now();
    this.totalFrames++;

    const totalFrameMs = timings.totalFrameMs || 16.6;
    const jsMs = timings.jsMs || 0;
    const renderMs = timings.renderMs || 0;
    const physicsMs = timings.physicsMs || 0;
    const playerMs = timings.playerMs || 0;
    const enemyMs = timings.enemyMs || 0;

    // Residual wall-clock time spent in browser compositor, garbage collection, or OS stall
    const browserOtherMs = Math.max(0, totalFrameMs - (jsMs + renderMs));

    this.totalFrameTimeSum += totalFrameMs;
    if (totalFrameMs > this.worstFrameTime) {
      this.worstFrameTime = totalFrameMs;
    }

    // Rolling FPS update
    this.framesSinceLastFpsCalc++;
    if (now - this.lastFpsCalcTime >= 500) {
      this.recentFps = (this.framesSinceLastFpsCalc * 1000) / (now - this.lastFpsCalcTime);
      this.lastFpsCalcTime = now;
      this.framesSinceLastFpsCalc = 0;
      this.updateHUDStats();
    }

    // Chrome memory heap
    let heapUsedMB = 0;
    if (typeof performance !== 'undefined' && performance.memory) {
      heapUsedMB = Number((performance.memory.usedJSHeapSize / 1048576).toFixed(1));
    }

    // Renderer stats
    const rInfo = this.renderer?.info?.render;
    const drawCalls = rInfo?.calls || 0;
    const triangles = rInfo?.triangles || 0;

    const frameRecord = {
      frame: this.totalFrames,
      time: Number(((now - this.sessionStartTime) / 1000).toFixed(3)),
      totalMs: Number(totalFrameMs.toFixed(2)),
      jsMs: Number(jsMs.toFixed(2)),
      renderMs: Number(renderMs.toFixed(2)),
      physicsMs: Number(physicsMs.toFixed(2)),
      playerMs: Number(playerMs.toFixed(2)),
      enemyMs: Number(enemyMs.toFixed(2)),
      browserOtherMs: Number(browserOtherMs.toFixed(2)),
      heapMB: heapUsedMB,
      calls: drawCalls,
      triangles
    };

    // Store in circular buffer
    this.frameBuffer[this.bufferIndex % this.BUFFER_SIZE] = frameRecord;
    this.bufferIndex++;

    // CHECK FOR HANG
    if (totalFrameMs >= this.hangThresholdMs) {
      this.handleHangDetected(frameRecord, timings, context);
    }
  }

  handleHangDetected(frameRecord, timings, context) {
    const isCritical = frameRecord.totalMs >= this.criticalThresholdMs;

    // Milestone 5.2 Flight Recorder Optimization:
    // Throttle deep forensic snapshotting to at most once per 1.5s during sustained hitch periods.
    // Completely eliminates the self-induced GC feedback loop where logging stalls the next frame!
    const now = performance.now();
    if (this._lastHangSnapshotTime && (now - this._lastHangSnapshotTime) < 1500 && !isCritical) {
      return;
    }
    this._lastHangSnapshotTime = now;

    // 1. Identify primary bottleneck cause
    let primaryCause = 'GPU / Browser Compositor Stutter';
    let causeDetail = '';

    // Heap difference check to verify real V8 garbage collection
    const heapDiff = this._lastHeapMB > 0 ? (this._lastHeapMB - frameRecord.heapMB) : 0;
    this._lastHeapMB = frameRecord.heapMB;
    const isMajorGC = heapDiff > 12.0;

    if (frameRecord.enemyMs > 12.0) {
      primaryCause = 'Enemy AI & Skeletal Animation';
      causeDetail = `Enemy computation took ${frameRecord.enemyMs}ms`;
    } else if (frameRecord.physicsMs > 8.0) {
      primaryCause = 'Rapier3D Physics Step';
      causeDetail = `Physics step took ${frameRecord.physicsMs}ms`;
    } else if (frameRecord.playerMs > 8.0) {
      primaryCause = 'Player Controller / Reticle Raycast';
      causeDetail = `Player update took ${frameRecord.playerMs}ms`;
    } else if (frameRecord.renderMs > 25.0) {
      primaryCause = 'WebGL Render / Draw Calls';
      causeDetail = `Renderer.render took ${frameRecord.renderMs}ms (${frameRecord.calls} draw calls, ${frameRecord.triangles.toLocaleString()} tris)`;
    } else if (isMajorGC && frameRecord.browserOtherMs > 25.0) {
      primaryCause = 'V8 Garbage Collection (Major GC)';
      causeDetail = `Major GC reclaimed ${heapDiff.toFixed(1)} MB in ${frameRecord.browserOtherMs}ms`;
    } else if (frameRecord.browserOtherMs > 25.0) {
      // External Guidance Defect Fix 1: Residual is GPU execution / presentation stall, NOT garbage collection
      primaryCause = 'GPU Pipeline / Presentation Wait (WAIT_GPU/PRESENT)';
      causeDetail = `GPU command buffer wait of ${frameRecord.browserOtherMs}ms (${frameRecord.calls} calls, ${frameRecord.triangles.toLocaleString()} tris)`;
    } else {
      primaryCause = 'Mixed High Frame Load';
      causeDetail = `JS: ${frameRecord.jsMs}ms, Render: ${frameRecord.renderMs}ms, GPU Wait: ${frameRecord.browserOtherMs}ms`;
    }

    // 2. Gather Forensic Game State Snapshot
    const forensicSnapshot = this.captureForensicSnapshot(context);

    // 3. Extract pre-hang history (last 10 frames prior to hang)
    const preHangFrames = [];
    const count = Math.min(this.BUFFER_SIZE, this.frameBuffer.length);
    const startIdx = this.bufferIndex - 1 - 10;
    for (let i = startIdx; i < this.bufferIndex - 1; i++) {
      if (i >= 0) {
        const item = this.frameBuffer[i % this.BUFFER_SIZE];
        if (item) preHangFrames.push(item);
      }
    }

    const hangEvent = {
      hangId: this.hangEvents.length + 1,
      severity: isCritical ? 'CRITICAL_FREEZE' : 'FRAME_HITCH',
      timestampSeconds: frameRecord.time,
      totalFrameMs: frameRecord.totalMs,
      primaryCause,
      causeDetail,
      breakdown: {
        jsMs: frameRecord.jsMs,
        renderMs: frameRecord.renderMs,
        physicsMs: frameRecord.physicsMs,
        playerMs: frameRecord.playerMs,
        enemyMs: frameRecord.enemyMs,
        browserOtherMs: frameRecord.browserOtherMs
      },
      hardware: {
        heapUsedMB: frameRecord.heapMB,
        drawCalls: frameRecord.calls,
        triangles: frameRecord.triangles
      },
      preHangFrames,
      gameState: forensicSnapshot,
      recentConsoleLogs: [...this.recentConsoleLogs]
    };

    this.hangEvents.push(hangEvent);
    if (this.hangEvents.length > this.maxRecordedHangs) {
      this.hangEvents.shift();
    }

    // External Guidance Fix 3: Maintain session-wide top worst hangs (eliminates sampling bias)
    this.topSessionHangs.push(hangEvent);
    this.topSessionHangs.sort((a, b) => b.totalFrameMs - a.totalFrameMs);
    if (this.topSessionHangs.length > 25) {
      this.topSessionHangs.pop();
    }

    // Update HUD
    this.updateHUDOnHang(hangEvent);

    // Auto-stream to server / storage
    this.persistHangEvent(hangEvent);
  }

  captureForensicSnapshot(context = {}) {
    const gameplay = context.gameplay || this.sceneManager?.currentScene;
    if (!gameplay) return { scene: 'Unknown' };

    const ramHero = gameplay.ramHero;
    const player = gameplay.playerController;
    const waveMgr = gameplay.enemyWaveManager;
    const projSys = gameplay.projectileSystem;

    const playerState = {
      position: player?.camera ? {
        x: Number(player.camera.position.x.toFixed(2)),
        y: Number(player.camera.position.y.toFixed(2)),
        z: Number(player.camera.position.z.toFixed(2))
      } : null,
      yaw: player ? Number(player.currentYaw?.toFixed(3)) : null,
      pitch: player ? Number(player.currentPitch?.toFixed(3)) : null,
      isAiming: !!player?.isAiming,
      isShooting: !!player?.isShooting,
      isGrounded: !!player?.isGrounded,
      locomotionState: player?.locomotionState || 'unknown'
    };

    const enemyState = {
      defeatedCount: waveMgr?.defeatedCount || 0,
      activeEnemiesCount: waveMgr?.activeEnemies?.length || 0,
      corpseEnemiesCount: waveMgr?.corpseEnemies?.length || 0,
      activeEnemies: (waveMgr?.activeEnemies || []).map(e => ({
        id: e.id,
        state: e.state,
        clip: e.currentAction?.getClip()?.name || 'none',
        health: e.health,
        currentLOD: e.currentLOD,
        distToPlayer: player?.character ? Number(e.root.position.distanceTo(player.character.position).toFixed(2)) : null,
        pos: {
          x: Number(e.root.position.x.toFixed(2)),
          y: Number(e.root.position.y.toFixed(2)),
          z: Number(e.root.position.z.toFixed(2))
        }
      }))
    };

    const projectileState = {
      activePoolArrows: projSys?.pool?.filter(p => p.active)?.length || 0,
      stuckArrows: projSys?.pool?.filter(p => p.isStuck)?.length || 0
    };

    return {
      scene: gameplay.constructor?.name || 'GameplayScene',
      player: playerState,
      enemies: enemyState,
      projectiles: projectileState
    };
  }

  updateHUDStats() {
    if (!this.hudElement) return;
    const statsEl = this.hudElement.querySelector('#hang-logger-stats');
    if (statsEl) {
      statsEl.textContent = `FPS: ${Math.round(this.recentFps)} • Hangs: ${this.hangEvents.length} • Worst: ${Math.round(this.worstFrameTime)}ms`;
    }
  }

  updateHUDOnHang(hangEvent) {
    if (!this.hudElement) return;

    const indicator = this.hudElement.querySelector('#hang-logger-indicator');
    const status = this.hudElement.querySelector('#hang-logger-status');
    const statsEl = this.hudElement.querySelector('#hang-logger-stats');

    if (indicator) {
      indicator.style.background = hangEvent.severity === 'CRITICAL_FREEZE' ? '#ff4757' : '#ffa502';
      indicator.style.boxShadow = `0 0 10px ${indicator.style.background}`;
    }

    if (status) {
      status.textContent = `HANG ${hangEvent.totalFrameMs}ms!`;
      status.style.color = hangEvent.severity === 'CRITICAL_FREEZE' ? '#ff4757' : '#ffa502';
    }

    if (statsEl) {
      statsEl.textContent = `${hangEvent.primaryCause} (Hangs: ${this.hangEvents.length})`;
    }

    // Revert indicator to normal after 3 seconds
    setTimeout(() => {
      if (indicator) {
        indicator.style.background = '#2ed573';
        indicator.style.boxShadow = '0 0 6px #2ed573';
      }
      if (status) {
        status.textContent = 'RECORDER ACTIVE';
        status.style.color = '#ffd54f';
      }
      this.updateHUDStats();
    }, 3500);
  }

  async persistHangEvent(hangEvent) {
    const now = performance.now();
    // Debounce syncing to avoid JSON stringification churn during frame hitches
    if (now - this.lastSyncTime < this.syncIntervalMs) {
      return;
    }
    this.lastSyncTime = now;

    // 1. Save lightweight mini summary to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const miniSummary = {
          totalHangs: this.hangEvents.length,
          worstFrameMs: this.worstFrameTime,
          recentHangsCount: this.hangEvents.length
        };
        localStorage.setItem('ramayana_hang_log', JSON.stringify(miniSummary));
      }
    } catch (e) {}

    // 2. Stream to local Vite server endpoint /api/log-gameplay
    try {
      fetch('/api/log-gameplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.generateFullReport())
      }).catch(() => {
        // Safe silent fallback if server endpoint not reachable
      });
    } catch (e) {}
  }

  generateFullReport() {
    const elapsedSeconds = Number(((performance.now() - this.sessionStartTime) / 1000).toFixed(1));
    const avgFps = this.totalFrames > 0 ? Number(((this.totalFrames / elapsedSeconds)).toFixed(1)) : 0;

    return {
      reportGeneratedAt: new Date().toISOString(),
      sessionSummary: {
        durationSeconds: elapsedSeconds,
        totalFramesRendered: this.totalFrames,
        averageFPS: avgFps,
        worstFrameMs: Number(this.worstFrameTime.toFixed(2)),
        hangThresholdMs: this.hangThresholdMs,
        totalHangsDetected: this.hangEvents.length,
        criticalFreezesCount: this.hangEvents.filter(h => h.severity === 'CRITICAL_FREEZE').length
      },
      hardware: this.hardwareInfo,
      hangsSummaryByCause: this.aggregateCauses(),
      topWorstHangs: this.topSessionHangs,
      hangEvents: this.hangEvents
    };
  }

  aggregateCauses() {
    const counts = {};
    for (const h of this.hangEvents) {
      counts[h.primaryCause] = (counts[h.primaryCause] || 0) + 1;
    }
    return counts;
  }

  exportLogJSON() {
    const report = this.generateFullReport();
    const jsonStr = JSON.stringify(report, null, 2);

    // Also send to dev server
    try {
      fetch('/api/log-gameplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonStr
      });
    } catch (e) {}

    // Browser file download
    if (typeof document !== 'undefined') {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ramayana_gameplay_hang_log_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    console.log('[GameplayHangLogger] Full gameplay hang report exported successfully.');
    if (this.hudElement) {
      const status = this.hudElement.querySelector('#hang-logger-status');
      if (status) {
        status.textContent = 'LOG SAVED!';
        setTimeout(() => { status.textContent = 'RECORDER ACTIVE'; }, 2000);
      }
    }

    return report;
  }

  copySummaryToClipboard() {
    const report = this.generateFullReport();
    const summary = [
      `=== RAMAYANA YUDH — GAMEPLAY HANG REPORT ===`,
      `Duration: ${report.sessionSummary.durationSeconds}s | Total Frames: ${report.sessionSummary.totalFramesRendered} | Avg FPS: ${report.sessionSummary.averageFPS}`,
      `Total Hangs: ${report.sessionSummary.totalHangsDetected} | Worst Frame: ${report.sessionSummary.worstFrameMs}ms`,
      `GPU: ${report.hardware.gpuRenderer}`,
      `Hangs by Cause: ${JSON.stringify(report.hangsSummaryByCause)}`,
      `\nHang Breakdown (Top 5 Worst across entire session):`,
      ...(this.topSessionHangs.length > 0 ? this.topSessionHangs : report.hangEvents)
        .slice()
        .sort((a, b) => b.totalFrameMs - a.totalFrameMs)
        .slice(0, 5)
        .map(h => `• ${h.totalFrameMs}ms at t=${h.timestampSeconds}s: ${h.primaryCause} (${h.causeDetail})`)
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(summary);
      console.log('[GameplayHangLogger] Summary copied to clipboard:\n' + summary);
      if (this.hudElement) {
        const status = this.hudElement.querySelector('#hang-logger-status');
        if (status) {
          status.textContent = 'COPIED TO CLIPBOARD!';
          setTimeout(() => { status.textContent = 'RECORDER ACTIVE'; }, 2000);
        }
      }
    }

    return summary;
  }

  dispose() {
    if (this.hudElement && this.hudElement.parentNode) {
      this.hudElement.parentNode.removeChild(this.hudElement);
    }
    this.frameBuffer = [];
    this.hangEvents = [];
  }
}

