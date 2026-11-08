import * as THREE from 'three';

/**
 * Dev-only performance profiler and telemetry system.
 * Completely hidden during normal gameplay.
 * Can be activated with F2 or window.__perfProfiler.toggle() or ?profiler=1.
 */
export class PerformanceProfiler {
  /**
   * @param {THREE.WebGLRenderer} renderer 
   */
  constructor(renderer) {
    this.renderer = renderer;
    this.isEnabled = false;
    this.panel = null;

    // Timing metrics
    this.frameTimes = [];
    this.jsTimes = [];
    this.enemyTimes = [];
    this.physicsTimes = [];
    this.renderTimes = [];
    this.longFrames = 0;
    this.lastFpsUpdate = 0;

    // WebGL Hardware Info
    this.gpuInfo = this.queryGPUInfo();

    this.initHUD();
    this.bindShortcuts();

    // Check URL query param
    if (typeof window !== 'undefined' && window.location.search.includes('profiler=1')) {
      this.show();
    }
  }

  queryGPUInfo() {
    try {
      const gl = this.renderer.getContext();
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        webglVersion: gl.getParameter(gl.VERSION),
        vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'N/A',
        renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'N/A'
      };
    } catch (e) {
      return { vendor: 'N/A', renderer: 'N/A' };
    }
  }

  initHUD() {
    this.panel = document.createElement('div');
    this.panel.id = 'dev-perf-profiler';
    this.panel.className = 'dev-profiler-panel hidden';
    this.panel.style.cssText = `
      display: none;
      position: fixed;
      top: 14px;
      right: 14px;
      background: rgba(10, 14, 20, 0.88);
      border: 1px solid rgba(255, 215, 79, 0.35);
      border-radius: 6px;
      padding: 12px 16px;
      color: #e0e8f0;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.5;
      z-index: 9999;
      pointer-events: none;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      min-width: 260px;
    `;

    document.body.appendChild(this.panel);
  }

  bindShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        this.toggle();
      }
    });
  }

  toggle() {
    if (this.isEnabled) this.hide();
    else this.show();
  }

  show() {
    this.isEnabled = true;
    if (this.panel) {
      this.panel.classList.remove('hidden');
      this.panel.style.display = 'block';
    }
  }

  hide() {
    this.isEnabled = false;
    if (this.panel) {
      this.panel.classList.add('hidden');
      this.panel.style.display = 'none';
    }
  }

  recordFrame(frameDuration, jsDuration, enemyDuration, physicsDuration, renderDuration) {
    if (!this.isEnabled) return;

    this.frameTimes.push(frameDuration);
    this.jsTimes.push(jsDuration);
    this.enemyTimes.push(enemyDuration);
    this.physicsTimes.push(physicsDuration);
    this.renderTimes.push(renderDuration);

    if (frameDuration > 50) {
      this.longFrames++;
    }

    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
      this.jsTimes.shift();
      this.enemyTimes.shift();
      this.physicsTimes.shift();
      this.renderTimes.shift();
    }

    const now = performance.now();
    if (now - this.lastFpsUpdate > 250) {
      this.lastFpsUpdate = now;
      this.updateDisplay();
    }
  }

  updateDisplay() {
    if (!this.panel || this.frameTimes.length === 0) return;

    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const worst = sorted[sorted.length - 1] || 0;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const fps = avg > 0 ? (1000 / avg).toFixed(1) : '0';

    const avgJs = (this.jsTimes.reduce((a, b) => a + b, 0) / this.jsTimes.length).toFixed(2);
    const avgEnemy = (this.enemyTimes.reduce((a, b) => a + b, 0) / this.enemyTimes.length).toFixed(2);
    const avgPhys = (this.physicsTimes.reduce((a, b) => a + b, 0) / this.physicsTimes.length).toFixed(2);
    const avgRender = (this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length).toFixed(2);

    const info = this.renderer.info;
    const calls = info.render.calls;
    const tris = info.render.triangles.toLocaleString();
    const geoms = info.memory.geometries;
    const texs = info.memory.textures;
    const progs = info.programs ? info.programs.length : 'N/A';

    this.panel.innerHTML = `
      <div style="color: #ffd54f; font-weight: bold; border-bottom: 1px solid rgba(255,215,79,0.3); padding-bottom: 4px; margin-bottom: 6px;">
        ⚙ RAMAYANA YUDH — PERFORMANCE PROFILER (F2)
      </div>
      <div><strong>FPS:</strong> <span style="color: ${fps >= 55 ? '#2ed573' : (fps >= 30 ? '#ffa502' : '#ff4757')}; font-weight:bold;">${fps}</span> (Median: ${median.toFixed(1)}ms, 95%: ${p95.toFixed(1)}ms, Worst: ${worst.toFixed(1)}ms)</div>
      <div><strong>Long Frames (>50ms):</strong> <span style="color: ${this.longFrames === 0 ? '#2ed573' : '#ff4757'}">${this.longFrames}</span></div>
      <div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
        <strong>CPU Breakdown:</strong><br/>
        &bull; JS Total: ${avgJs} ms<br/>
        &bull; Enemy AI & Mixers: ${avgEnemy} ms<br/>
        &bull; Rapier3D Physics: ${avgPhys} ms<br/>
        &bull; Three.js Render: ${avgRender} ms
      </div>
      <div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
        <strong>GPU & Render Stats:</strong><br/>
        &bull; Draw Calls: <strong>${calls}</strong><br/>
        &bull; Triangles: <strong>${tris}</strong><br/>
        &bull; Geometries / Textures: ${geoms} / ${texs}<br/>
        &bull; Active Shaders: ${progs}
      </div>
      <div style="margin-top: 4px; font-size: 9px; color: #8899a6; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
        GPU: ${this.gpuInfo.renderer.substring(0, 48)}
      </div>
    `;
  }

  dispose() {
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }
  }
}

