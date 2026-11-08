import * as THREE from 'three';
import { GameplayHangLogger } from './GameplayHangLogger.js';

export class SceneManager {
  /**
   * @param {import('./Renderer.js').Renderer} renderer 
   */
  constructor(renderer) {
    this.renderer = renderer;
    this.scenes = new Map();
    this.currentScene = null;
    this.clock = new THREE.Clock();
    this.animationFrameId = null;
    this.isRunning = false;
    this.lastFrameTimestamp = 0;
    this.boundLoop = this.loop.bind(this);

    // Milestone 6 Part H: Flight recorder & hang logger disabled by default; enabled only with ?debug=1
    const isDebugMode = typeof window !== 'undefined' && 
      (new URLSearchParams(window.location.search).get('debug') === '1' || window.__ENABLE_PROFILER__);
    this.hangLogger = isDebugMode ? new GameplayHangLogger(this.renderer.threeRenderer, this) : null;

    this.renderer.addResizeListener(this.onResize.bind(this));
  }

  registerScene(name, sceneInstance) {
    this.scenes.set(name, sceneInstance);
    if (typeof sceneInstance.setSceneManager === 'function') {
      sceneInstance.setSceneManager(this);
    }
  }

  async switchScene(name, params = {}) {
    const nextScene = this.scenes.get(name);
    if (!nextScene) {
      console.error(`[SceneManager] Scene "${name}" not found!`);
      return;
    }

    if (this.currentScene) {
      if (typeof this.currentScene.exit === 'function') {
        await this.currentScene.exit();
      }
    }

    this.currentScene = nextScene;

    if (typeof this.currentScene.enter === 'function') {
      await this.currentScene.enter(params);
    }

    // Reset frame timestamp so asset loading / FBX parsing is not counted as a gameplay frame hitch
    this.lastFrameTimestamp = performance.now();
    this.clock.getDelta(); // flush delta

    // Forward current dimensions to the newly active scene
    if (typeof this.currentScene.onResize === 'function') {
      this.currentScene.onResize(this.renderer.width, this.renderer.height, this.renderer.aspect);
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.clock.stop();
  }

  loop() {
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame(this.boundLoop);

    const frameStart = performance.now();
    const frameInterval = this.lastFrameTimestamp > 0 ? (frameStart - this.lastFrameTimestamp) : 16.6;
    this.lastFrameTimestamp = frameStart;

    const delta = Math.min(this.clock.getDelta(), 0.1); // cap delta to prevent frame spikes
    const elapsed = this.clock.getElapsedTime();

    let jsMs = 0;
    let renderMs = 0;

    if (this.currentScene) {
      const updateStart = performance.now();
      if (typeof this.currentScene.update === 'function') {
        this.currentScene.update(delta, elapsed);
      }
      jsMs = performance.now() - updateStart;

      if (this.currentScene.threeScene && this.currentScene.camera) {
        const renderStart = performance.now();
        this.renderer.render(this.currentScene.threeScene, this.currentScene.camera);
        renderMs = performance.now() - renderStart;
      }
    }

    // High-precision flight recorder & hang logger
    if (this.hangLogger) {
      const sceneTimings = this.currentScene?.lastFrameTimings || {};
      this.hangLogger.recordFrame({
        totalFrameMs: frameInterval,
        jsMs,
        renderMs,
        physicsMs: sceneTimings.physicsMs || 0,
        playerMs: sceneTimings.playerMs || 0,
        enemyMs: sceneTimings.enemyMs || 0
      }, {
        gameplay: this.currentScene
      });
    }
  }

  onResize(width, height, aspect) {
    if (this.currentScene && typeof this.currentScene.onResize === 'function') {
      this.currentScene.onResize(width, height, aspect);
    }
  }

  dispose() {
    this.stop();
    if (this.hangLogger) {
      this.hangLogger.dispose();
      this.hangLogger = null;
    }
    for (const scene of this.scenes.values()) {
      if (typeof scene.dispose === 'function') {
        scene.dispose();
      }
    }
    this.scenes.clear();
    this.currentScene = null;
  }
}

