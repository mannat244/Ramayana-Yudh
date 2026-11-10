import * as THREE from 'three';
import { ASSET_PATHS } from '../assets/assetManifest.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { PlayerController } from '../character/PlayerController.js';
import { WeaponManager } from '../weapons/WeaponManager.js';
import { EnemyOptimizer } from '../enemy/EnemyOptimizer.js';
import { EnemyWaveManager } from '../enemy/EnemyWaveManager.js';
import { DivineAbilitySystem } from '../weapons/DivineAbilitySystem.js';
import { SandDuneSystem } from '../vfx/SandDuneSystem.js';
import { SandDuneCutscene } from '../cinematics/SandDuneCutscene.js';
import { audioDirector } from '../audio/AudioDirector.js';
import { PerformanceProfiler } from '../core/PerformanceProfiler.js';
import { toast } from '../ui/ToastManager.js';
import { gameSettings } from '../core/GameSettings.js';
import { MobileInputController } from '../input/MobileInputController.js';
import { DeviceDetector } from '../utils/DeviceDetector.js';

export class GameplayScene {
  /**
   * @param {import('../core/AssetLoader.js').AssetLoader} assetLoader 
   */
  constructor(assetLoader) {
    this.assetLoader = assetLoader;
    this.sceneManager = null;

    // Three.js Scene
    this.threeScene = new THREE.Scene();

    // Natural Third-Person Follow Camera
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 2.2, 4.5);

    // Physics Engine Architecture
    this.physics = new PhysicsWorld();

    // Scene Graph References
    this.environmentModel = null;
    this.terrainMesh = null;
    this.skyDomeMesh = null;
    this.ramHero = null;
    this.playerController = null;
    this.isLoaded = false;

    // Enemy Architecture (Milestone 5.1 Optimization & First Battle Wave)
    this.enemyOptimizer = new EnemyOptimizer();
    this.enemyWaveManager = null;
    this.divineAbilitySystem = null;
    this.sandDuneSystem = null;
    this.sandDuneCutscene = null;
    this.profiler = null;

    // Lighting References
    this.sunLight = null;
    this.hemiLight = null;
    this.ambientLight = null;
    this.rimLight = null;

    // UI & Controls State
    this.hudContainer = null;
    this.locationBanner = null;
    this.wavePanel = null;
    this.waveTitleEl = null;
    this.waveDefeatedEl = null;
    this.waveTotalEl = null;

    // Milestone 7 Presentation State
    this.isPaused = false;
    this.isGameCompleted = false;
    this.pauseOverlay = null;
    this.pauseSettingsModal = null;
    this.pauseAudioModal = null;
    this.mobileInputController = null;

    this.boundKeyDown = this.handleKeyDown.bind(this);
    window.addEventListener('keydown', this.boundKeyDown);

    this.setupLighting();
    this.initHUD();
  }

  setSceneManager(sceneManager) {
    this.sceneManager = sceneManager;
  }

  setupLighting() {
    // 1. Natural forest canopy hemisphere light: soft sky blue above, warm earth green below
    this.hemiLight = new THREE.HemisphereLight(0xd8eeff, 0x55683e, 1.9);
    this.hemiLight.position.set(0, 50, 0);
    this.threeScene.add(this.hemiLight);

    // 2. Main Sun Light filtering through pine branches (warm golden morning sun)
    // Milestone 5.2 GPU Optimization: 1024x1024 shadow map with tight camera bounds
    // Cuts VRAM & shadow rasterization fill-rate by 75% while maintaining crisp character contact shadows
    this.sunLight = new THREE.DirectionalLight(0xfff6e8, 3.2);
    this.sunLight.position.set(35, 50, 25);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 110;
    this.sunLight.shadow.camera.left = -26;
    this.sunLight.shadow.camera.right = 26;
    this.sunLight.shadow.camera.top = 26;
    this.sunLight.shadow.camera.bottom = -26;
    this.sunLight.shadow.bias = -0.0004;
    this.threeScene.add(this.sunLight);

    // 3. Ambient light ensuring shaded areas under pine trees remain rich, legible, and daylight-filled
    this.ambientLight = new THREE.AmbientLight(0x6a788c, 1.4);
    this.threeScene.add(this.ambientLight);

    // 4. Subtle back-rim light to accentuate character silhouette against dark pine background
    this.rimLight = new THREE.DirectionalLight(0xffeedb, 1.0);
    this.rimLight.position.set(-30, 30, -25);
    this.threeScene.add(this.rimLight);
  }

  initHUD() {
    this.hudContainer = document.createElement('div');
    this.hudContainer.id = 'gameplay-hud';
    this.hudContainer.className = 'scene-overlay hidden';

    const currentSettings = gameSettings.settings;

    this.hudContainer.innerHTML = `
      <div class="hud-top-gradient"></div>

      <!-- Top Bar: Location & Compact Wave Indicator & Pause -->
      <div class="hud-top-bar">
        <div class="hud-location" id="hud-location-banner">
          <div class="location-badge">BATTLEFIELD LOCALE</div>
          <h1 class="location-title">DANDAKARANYA FOREST</h1>
          <div class="location-sanskrit">दण्डकारण्य वन • रणभूमि</div>
        </div>

        <div class="hud-top-right">
          <!-- Compact Wave Indicator -->
          <div class="hud-compact-wave" id="hud-wave-panel">
            <div class="compact-wave-header">
              <span class="compact-wave-ornament">❖</span>
              <span class="compact-wave-title" id="hud-wave-title">WAVE 1 — DANDAKARANYA SCOUTS</span>
            </div>
            <div class="compact-wave-counter">
              <span class="compact-counter-label">DEFEATED</span>
              <strong class="compact-count-val" id="hud-wave-defeated">0</strong>
              <span class="compact-count-slash">/</span>
              <span class="compact-count-total" id="hud-wave-total">8</span>
            </div>
          </div>

          <!-- Unobtrusive Pause Button -->
          <button class="hud-pause-btn" id="btn-hud-pause" type="button" title="Pause Game (ESC / P)">
            <span class="pause-symbol">⏸</span>
            <span class="pause-key-label">ESC</span>
          </button>
        </div>
      </div>

      <!-- Compact Divine Ability HUD Panel -->
      <div class="hud-divine-compact" id="hud-divine-panel">
        <div class="divine-energy-row">
          <span class="divine-label">DIVINE ENERGY</span>
          <span class="divine-percent" id="hud-energy-val">0%</span>
        </div>
        <div class="divine-track">
          <div class="divine-fill" id="hud-energy-fill" style="width: 0%;"></div>
        </div>
        <div class="divine-slots">
          <!-- Q: Bahu-Baan -->
          <div class="ability-slot locked" id="ability-bahu-baan" title="Q — Divya Bahu-Baan (50%)">
            <span class="slot-key">Q</span>
            <div class="slot-details">
              <span class="slot-name">BAHU-BAAN</span>
              <span class="slot-status" id="status-bahu-baan">50%</span>
            </div>
          </div>
          <!-- R: Sand Dune -->
          <div class="ability-slot locked" id="ability-sand-dune" title="R — Divya Sand Dune (100% - Final Wave)">
            <span class="slot-key">R</span>
            <div class="slot-details">
              <span class="slot-name">SAND DUNE</span>
              <span class="slot-status" id="status-sand-dune">LOCKED</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Smooth Fade to Black for Ending Sequence -->
      <div class="game-fade-black hidden" id="game-fade-black"></div>

      <!-- PAUSE OVERLAY -->
      <div class="modal-backdrop hidden" id="gameplay-pause-overlay">
        <div class="modal-card pause-modal-card">
          <div class="modal-header">
            <div class="modal-ornament">❖</div>
            <h2 class="modal-title">GAME PAUSED</h2>
            <button class="close-modal-btn" id="btn-pause-close" aria-label="Resume">✕</button>
          </div>
          <div class="pause-actions-list">
            <button class="menu-btn primary-btn full-width" id="btn-pause-resume" type="button">
              <span class="btn-bracket">⟨</span>
              <span class="btn-text">RESUME</span>
              <span class="btn-bracket">⟩</span>
            </button>
            <button class="menu-btn secondary-btn full-width" id="btn-pause-settings" type="button">
              <span class="btn-bracket">⟨</span>
              <span class="btn-text">SETTINGS</span>
              <span class="btn-bracket">⟩</span>
            </button>
            <button class="menu-btn secondary-btn full-width" id="btn-pause-audio" type="button">
              <span class="btn-bracket">⟨</span>
              <span class="btn-text">AUDIO</span>
              <span class="btn-bracket">⟩</span>
            </button>
            <button class="menu-btn secondary-btn full-width" id="btn-pause-main-menu" type="button">
              <span class="btn-bracket">⟨</span>
              <span class="btn-text">RETURN TO MAIN MENU</span>
              <span class="btn-bracket">⟩</span>
            </button>
          </div>
        </div>
      </div>

      <!-- IN-GAME SETTINGS MODAL -->
      <div class="modal-backdrop hidden" id="pause-settings-modal">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-ornament">❖</div>
            <h2 class="modal-title">GAMEPLAY SETTINGS</h2>
            <button class="close-modal-btn" id="btn-pause-close-settings" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <div class="setting-item">
              <div class="setting-label-row">
                <label for="pause-mouse-sens" class="setting-label">Mouse Aim Sensitivity</label>
                <span class="slider-value" id="pause-val-mouse-sens">${currentSettings.mouseSensitivity.toFixed(1)}x</span>
              </div>
              <div class="slider-control">
                <input type="range" id="pause-mouse-sens" min="0.5" max="2.5" step="0.1" value="${currentSettings.mouseSensitivity}" class="mythic-slider" />
              </div>
            </div>
            <div class="setting-item">
              <div class="setting-label-row">
                <label for="pause-camera-sens" class="setting-label">Camera Orbit Sensitivity</label>
                <span class="slider-value" id="pause-val-camera-sens">${currentSettings.cameraSensitivity.toFixed(1)}x</span>
              </div>
              <div class="slider-control">
                <input type="range" id="pause-camera-sens" min="0.5" max="2.5" step="0.1" value="${currentSettings.cameraSensitivity}" class="mythic-slider" />
              </div>
            </div>
            <div class="setting-item setting-toggle-row">
              <label for="pause-invert-y" class="setting-label">Invert Vertical Look (Pitch)</label>
              <input type="checkbox" id="pause-invert-y" class="mythic-checkbox" ${currentSettings.invertY ? 'checked' : ''} />
            </div>
            <div class="setting-item">
              <label for="pause-reticle" class="setting-label">Aiming Reticle Contrast</label>
              <select id="pause-reticle" class="mythic-select">
                <option value="standard" ${currentSettings.reticleContrast === 'standard' ? 'selected' : ''}>Standard (Subtle Golden Dot)</option>
                <option value="high_contrast" ${currentSettings.reticleContrast === 'high_contrast' ? 'selected' : ''}>High-Contrast (Enhanced Visibility)</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="menu-btn primary-btn small-btn" id="btn-pause-apply-settings">
              <span class="btn-text">APPLY & CLOSE</span>
            </button>
          </div>
        </div>
      </div>

      <!-- IN-GAME AUDIO MODAL -->
      <div class="modal-backdrop hidden" id="pause-audio-modal">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-ornament">♫</div>
            <h2 class="modal-title">AUDIO SETTINGS</h2>
            <button class="close-modal-btn" id="btn-pause-close-audio" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <div class="setting-item">
              <div class="setting-label-row">
                <label for="pause-master-vol" class="setting-label">Master Volume</label>
                <span class="slider-value" id="pause-val-master-vol">${currentSettings.masterVolume}%</span>
              </div>
              <div class="slider-control">
                <input type="range" id="pause-master-vol" min="0" max="100" value="${currentSettings.masterVolume}" class="mythic-slider" />
              </div>
            </div>
            <div class="setting-item">
              <div class="setting-label-row">
                <label for="pause-music-vol" class="setting-label">Background Music</label>
                <span class="slider-value" id="pause-val-music-vol">${currentSettings.musicVolume}%</span>
              </div>
              <div class="slider-control">
                <input type="range" id="pause-music-vol" min="0" max="100" value="${currentSettings.musicVolume}" class="mythic-slider" />
              </div>
            </div>
            <div class="setting-item">
              <div class="setting-label-row">
                <label for="pause-sfx-vol" class="setting-label">Sound Effects (SFX)</label>
                <span class="slider-value" id="pause-val-sfx-vol">${currentSettings.sfxVolume}%</span>
              </div>
              <div class="slider-control">
                <input type="range" id="pause-sfx-vol" min="0" max="100" value="${currentSettings.sfxVolume}" class="mythic-slider" />
              </div>
            </div>
            <div class="setting-item">
              <div class="setting-label-row">
                <label for="pause-cinematic-vol" class="setting-label">Cinematic Audio</label>
                <span class="slider-value" id="pause-val-cinematic-vol">${currentSettings.cinematicVolume}%</span>
              </div>
              <div class="slider-control">
                <input type="range" id="pause-cinematic-vol" min="0" max="100" value="${currentSettings.cinematicVolume}" class="mythic-slider" />
              </div>
            </div>
            <div class="setting-item setting-toggle-row">
              <label for="pause-mute-all" class="setting-label">Mute All Audio</label>
              <input type="checkbox" id="pause-mute-all" class="mythic-checkbox" ${currentSettings.isMuted ? 'checked' : ''} />
            </div>
          </div>
          <div class="modal-footer">
            <button class="menu-btn primary-btn small-btn" id="btn-pause-apply-audio">
              <span class="btn-text">APPLY & CLOSE</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.hudContainer);

    this.locationBanner = this.hudContainer.querySelector('#hud-location-banner');
    this.wavePanel = this.hudContainer.querySelector('#hud-wave-panel');
    this.waveTitleEl = this.hudContainer.querySelector('#hud-wave-title');
    this.waveDefeatedEl = this.hudContainer.querySelector('#hud-wave-defeated');
    this.waveTotalEl = this.hudContainer.querySelector('#hud-wave-total');

    // Divine Ability Elements
    this.energyValEl = this.hudContainer.querySelector('#hud-energy-val');
    this.energyFillEl = this.hudContainer.querySelector('#hud-energy-fill');
    this.bahuBaanSlot = this.hudContainer.querySelector('#ability-bahu-baan');
    this.bahuBaanStatus = this.hudContainer.querySelector('#status-bahu-baan');
    this.sandDuneSlot = this.hudContainer.querySelector('#ability-sand-dune');
    this.sandDuneStatus = this.hudContainer.querySelector('#status-sand-dune');

    // Modals
    this.pauseOverlay = this.hudContainer.querySelector('#gameplay-pause-overlay');
    this.pauseSettingsModal = this.hudContainer.querySelector('#pause-settings-modal');
    this.pauseAudioModal = this.hudContainer.querySelector('#pause-audio-modal');
    this.fadeOverlay = this.hudContainer.querySelector('#game-fade-black');

    // Milestone 7.1 — Mobile Touch Controls Adapter
    this.mobileInputController = new MobileInputController(
      this.hudContainer,
      this.playerController,
      this.divineAbilitySystem,
      this
    );

    this.bindHUDEvents();
  }

  bindHUDEvents() {
    // Pause button
    const pauseBtn = this.hudContainer.querySelector('#btn-hud-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.togglePause());
    }

    // Pause menu buttons
    const resumeBtn = this.hudContainer.querySelector('#btn-pause-resume');
    const pauseCloseBtn = this.hudContainer.querySelector('#btn-pause-close');
    const settingsBtn = this.hudContainer.querySelector('#btn-pause-settings');
    const audioBtn = this.hudContainer.querySelector('#btn-pause-audio');
    const mainMenuBtn = this.hudContainer.querySelector('#btn-pause-main-menu');

    if (resumeBtn) resumeBtn.addEventListener('click', () => this.setPaused(false));
    if (pauseCloseBtn) pauseCloseBtn.addEventListener('click', () => this.setPaused(false));

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.pauseSettingsModal.classList.remove('hidden');
        this.pauseSettingsModal.classList.add('active');
      });
    }

    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        this.pauseAudioModal.classList.remove('hidden');
        this.pauseAudioModal.classList.add('active');
      });
    }

    if (mainMenuBtn) {
      mainMenuBtn.addEventListener('click', () => {
        this.setPaused(false);
        if (this.sceneManager) {
          this.sceneManager.switchScene('mainMenu');
        }
      });
    }

    // Settings sub-modal close
    const closeSettings = () => {
      this.pauseSettingsModal.classList.remove('active');
      this.pauseSettingsModal.classList.add('hidden');
    };
    this.hudContainer.querySelector('#btn-pause-close-settings')?.addEventListener('click', closeSettings);
    this.hudContainer.querySelector('#btn-pause-apply-settings')?.addEventListener('click', closeSettings);

    // Audio sub-modal close
    const closeAudio = () => {
      this.pauseAudioModal.classList.remove('active');
      this.pauseAudioModal.classList.add('hidden');
    };
    this.hudContainer.querySelector('#btn-pause-close-audio')?.addEventListener('click', closeAudio);
    this.hudContainer.querySelector('#btn-pause-apply-audio')?.addEventListener('click', closeAudio);

    // In-game Settings Sliders
    const mouseSensInput = this.hudContainer.querySelector('#pause-mouse-sens');
    const mouseSensVal = this.hudContainer.querySelector('#pause-val-mouse-sens');
    mouseSensInput?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      mouseSensVal.textContent = `${val.toFixed(1)}x`;
      gameSettings.set('mouseSensitivity', val);
      if (this.playerController) gameSettings.applyToPlayer(this.playerController);
    });

    const camSensInput = this.hudContainer.querySelector('#pause-camera-sens');
    const camSensVal = this.hudContainer.querySelector('#pause-val-camera-sens');
    camSensInput?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      camSensVal.textContent = `${val.toFixed(1)}x`;
      gameSettings.set('cameraSensitivity', val);
      if (this.playerController) gameSettings.applyToPlayer(this.playerController);
    });

    const invertYInput = this.hudContainer.querySelector('#pause-invert-y');
    invertYInput?.addEventListener('change', (e) => {
      gameSettings.set('invertY', e.target.checked);
      if (this.playerController) gameSettings.applyToPlayer(this.playerController);
    });

    const reticleSelect = this.hudContainer.querySelector('#pause-reticle');
    reticleSelect?.addEventListener('change', (e) => {
      gameSettings.set('reticleContrast', e.target.value);
    });

    // In-game Audio Sliders
    const masterSlider = this.hudContainer.querySelector('#pause-master-vol');
    const masterVal = this.hudContainer.querySelector('#pause-val-master-vol');
    masterSlider?.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      masterVal.textContent = `${pct}%`;
      gameSettings.set('masterVolume', pct);
    });

    const musicSlider = this.hudContainer.querySelector('#pause-music-vol');
    const musicVal = this.hudContainer.querySelector('#pause-val-music-vol');
    musicSlider?.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      musicVal.textContent = `${pct}%`;
      gameSettings.set('musicVolume', pct);
    });

    const sfxSlider = this.hudContainer.querySelector('#pause-sfx-vol');
    const sfxVal = this.hudContainer.querySelector('#pause-val-sfx-vol');
    sfxSlider?.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      sfxVal.textContent = `${pct}%`;
      gameSettings.set('sfxVolume', pct);
    });

    const cineSlider = this.hudContainer.querySelector('#pause-cinematic-vol');
    const cineVal = this.hudContainer.querySelector('#pause-val-cinematic-vol');
    cineSlider?.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      cineVal.textContent = `${pct}%`;
      gameSettings.set('cinematicVolume', pct);
    });

    const muteInput = this.hudContainer.querySelector('#pause-mute-all');
    muteInput?.addEventListener('change', (e) => {
      gameSettings.set('isMuted', e.target.checked);
    });
  }

  handleKeyDown(e) {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.hudContainer && this.hudContainer.classList.contains('active') && !this.isGameCompleted) {
        this.togglePause();
      }
    }
  }

  togglePause() {
    if (this.isGameCompleted) return;
    this.setPaused(!this.isPaused);
  }

  setPaused(paused) {
    this.isPaused = !!paused;
    if (this.playerController) {
      this.playerController.isPaused = this.isPaused;
    }

    if (this.pauseOverlay) {
      if (this.isPaused) {
        this.pauseOverlay.classList.remove('hidden');
        this.pauseOverlay.classList.add('active');
        if (document.exitPointerLock) {
          document.exitPointerLock();
        }
      } else {
        this.pauseOverlay.classList.remove('active');
        this.pauseOverlay.classList.add('hidden');
        this.closePauseSubModals();
      }
    }
  }

  closePauseSubModals() {
    if (this.pauseSettingsModal) {
      this.pauseSettingsModal.classList.remove('active');
      this.pauseSettingsModal.classList.add('hidden');
    }
    if (this.pauseAudioModal) {
      this.pauseAudioModal.classList.remove('active');
      this.pauseAudioModal.classList.add('hidden');
    }
  }

  checkGameCompletion() {
    if (this.isGameCompleted) return;

    const waveMgr = this.enemyWaveManager;
    if (!waveMgr) return;

    // Conclude encounter once Wave 2 is defeated and abilities/cutscenes have resolved
    if (waveMgr.config.waveNumber === 2 && waveMgr.isWaveComplete) {
      if (this.sandDuneCutscene && this.sandDuneCutscene.isPlaying) {
        return; // wait for cinematic ultimate to finish naturally
      }
      this.triggerEndingSequence();
    }
  }

  async triggerEndingSequence() {
    if (this.isGameCompleted) return;
    this.isGameCompleted = true;

    console.log('[GameplayScene] Concluding battle encounter: Wave 2 resolved. Initiating ending transition...');

    if (this.playerController) {
      this.playerController.setMovementEnabled(false);
      this.playerController.isPaused = true;
      if (document.exitPointerLock) {
        document.exitPointerLock();
      }
    }

    // Fade to black
    const fadeOverlay = this.hudContainer.querySelector('#game-fade-black');
    if (fadeOverlay) {
      fadeOverlay.classList.remove('hidden');
      void fadeOverlay.offsetWidth; // force reflow
      fadeOverlay.classList.add('visible');
    }

    audioDirector.stopSandDuneUltimate({ duration: 1.0 });

    await new Promise((r) => setTimeout(r, 1600));

    if (this.sceneManager) {
      await this.sceneManager.switchScene('credits');
    }
  }

  updateWaveUI(progress) {
    if (this.waveTitleEl) {
      this.waveTitleEl.textContent = progress.wave === 1 
        ? 'WAVE 1 — DANDAKARANYA SCOUTS' 
        : 'WAVE 2 — FINAL STAND';
    }
    if (this.waveDefeatedEl) this.waveDefeatedEl.textContent = progress.defeated;
    if (this.waveTotalEl) this.waveTotalEl.textContent = progress.total;
  }

  updateDivineHUD(state) {
    if (this.energyValEl) {
      this.energyValEl.textContent = `${Math.round(state.energy)}%`;
    }
    if (this.energyFillEl) {
      this.energyFillEl.style.width = `${state.energy}%`;
      if (state.energy >= 100) {
        this.energyFillEl.classList.add('full-glow');
      } else {
        this.energyFillEl.classList.remove('full-glow');
      }
    }

    // Bahu-Baan Slot (Q)
    if (this.bahuBaanSlot && this.bahuBaanStatus) {
      if (state.bahuBaanReady) {
        this.bahuBaanSlot.classList.remove('locked');
        this.bahuBaanSlot.classList.add('ready');
        this.bahuBaanStatus.textContent = 'READY';
      } else {
        this.bahuBaanSlot.classList.remove('ready');
        this.bahuBaanSlot.classList.add('locked');
        this.bahuBaanStatus.textContent = '50%';
      }
    }

    // Sand Dune Slot (R)
    if (this.sandDuneSlot && this.sandDuneStatus) {
      if (state.sandDuneLocked) {
        this.sandDuneSlot.classList.remove('ready', 'charging');
        this.sandDuneSlot.classList.add('locked');
        this.sandDuneStatus.textContent = 'LOCKED (WAVE 1)';
      } else if (state.sandDuneReady) {
        this.sandDuneSlot.classList.remove('locked', 'charging');
        this.sandDuneSlot.classList.add('ready');
        this.sandDuneStatus.textContent = 'READY';
      } else {
        this.sandDuneSlot.classList.remove('ready');
        this.sandDuneSlot.classList.add('locked', 'charging');
        this.sandDuneStatus.textContent = `${Math.round(state.energy)}%`;
      }
    }

    if (this.mobileInputController) {
      this.mobileInputController.updateDivineHUD(state);
    }
  }

  async enter(params = {}) {
    this.hudContainer.classList.remove('hidden');
    this.hudContainer.classList.add('active');

    if (this.mobileInputController) {
      if (DeviceDetector.shouldShowMobileControls()) {
        this.hudContainer.classList.add('touch-hud-mode');
        this.mobileInputController.show();
      } else {
        this.hudContainer.classList.remove('touch-hud-mode');
        this.mobileInputController.hide();
      }
    }

    this.isPaused = false;
    this.isGameCompleted = false;

    // Reset black fade overlay
    const fadeOverlay = this.hudContainer.querySelector('#game-fade-black');
    if (fadeOverlay) {
      fadeOverlay.classList.remove('visible');
      fadeOverlay.classList.add('hidden');
    }

    this.setPaused(false);

    // Apply settings
    gameSettings.applyToRenderer(this.sceneManager?.renderer);
    if (this.playerController) {
      gameSettings.applyToPlayer(this.playerController);
      this.playerController.isPaused = false;
    }

    // Initialize WebAssembly Rapier3D physics engine
    if (!this.physics.isInitialized) {
      await this.physics.init();
    }

    if (!this.isLoaded) {
      await this.loadSceneAssets();
    }

    // External Guidance Warm-up Pass:
    // Precompile all shaders and render 1 warm-up frame before revealing gameplay
    // Completely eliminates the 2.2s first-frame shader compilation & texture upload freeze!
    if (this.sceneManager?.renderer?.threeRenderer) {
      const threeRenderer = this.sceneManager.renderer.threeRenderer;
      try {
        if (typeof threeRenderer.compileAsync === 'function') {
          await threeRenderer.compileAsync(this.threeScene, this.camera);
        } else {
          threeRenderer.compile(this.threeScene, this.camera);
        }
        this.sceneManager.renderer.render(this.threeScene, this.camera);
      } catch (compileErr) {
        console.warn('[GameplayScene] Precompile warning:', compileErr);
      }
    }

    // Milestone 6 Part H: Performance Profiler disabled by default, enabled only with ?debug=1 or ?profiler=1
    const isDebugMode = typeof window !== 'undefined' && 
      (new URLSearchParams(window.location.search).get('debug') === '1' || 
       new URLSearchParams(window.location.search).get('profiler') === '1' || 
       window.__ENABLE_PROFILER__);
    if (isDebugMode && !this.profiler && this.sceneManager?.renderer?.threeRenderer) {
      this.profiler = new PerformanceProfiler(this.sceneManager.renderer.threeRenderer);
      window.__perfProfiler = this.profiler;
    }

    // Reset Shri Ram's spawn position to stable central clearing (0, 0, 0)
    if (this.playerController) {
      this.playerController.resetSpawn(new THREE.Vector3(0, 0, 0), 0);
    }

    // Start battle wave encounter
    if (this.enemyWaveManager) {
      if (params.isRestart) {
        this.enemyWaveManager.config.waveNumber = 1;
        this.enemyWaveManager.config.totalEnemies = 8;
      }
      this.enemyWaveManager.startWave();
    }
    if (this.divineAbilitySystem) {
      if (params.isRestart) {
        this.divineAbilitySystem.energy = 0;
        this.divineAbilitySystem.setFinalWave(false);
      }
      this.divineAbilitySystem.notifyState();
    }

    if (params.isRestart) {
      toast.show('⚔ BATTLE RESTARTED: Dandakaranya Clearing', 3500);
    } else {
      // Trigger brief, elegant controls toast notification (auto-dismissed in 5.5s)
      toast.show('WASD — Move  •  SHIFT — Run  •  Hold RMB — Aim  •  LMB — Shoot  •  E — Equip/Stow', 5500);
    }

    // Animate location banner: visible on entry, gently fades out after 5.5s
    if (this.locationBanner) {
      this.locationBanner.classList.remove('fade-out');
      this.locationBanner.classList.add('fade-in');
      setTimeout(() => {
        if (this.locationBanner) {
          this.locationBanner.classList.remove('fade-in');
          this.locationBanner.classList.add('fade-out');
        }
      }, 5500);
    }
  }

  async loadSceneAssets() {
    // 1. Load Pine Forest Environment
    try {
      console.log('[GameplayScene] Streaming Pine Forest environment asset...');
      const gltf = await this.assetLoader.loadGLTF(ASSET_PATHS.ENVIRONMENT.PINE_FOREST);
      if (gltf && gltf.scene) {
        this.environmentModel = gltf.scene;
        this.environmentModel.position.set(0, 0, 0);

        this.environmentModel.traverse((child) => {
          if (child.isMesh) {
            const isSkyDome = child.name === 'obj2' || child.name.includes('obj2') ||
                              (child.geometry && child.geometry.boundingSphere && child.geometry.boundingSphere.radius > 50);

            if (isSkyDome) {
              // Sky Dome enclosure: background render order, no shadows, no depth writing
              this.skyDomeMesh = child;
              child.castShadow = false;
              child.receiveShadow = false;
              child.renderOrder = -1000;

              if (child.material) {
                const skyTex = child.material.map;
                if (skyTex) {
                  skyTex.colorSpace = THREE.SRGBColorSpace;
                  skyTex.needsUpdate = true;
                  child.material = new THREE.MeshBasicMaterial({
                    map: skyTex,
                    side: THREE.DoubleSide, // Crucial: obj2 normals point inwards; DoubleSide renders both
                    depthWrite: false,
                    toneMapped: false,      // Preserves full vibrant daylight sky brightness
                    fog: false
                  });
                } else {
                  child.material.side = THREE.DoubleSide;
                  child.material.depthWrite = false;
                }
              }
            } else if (child.name === 'obj1' || child.name.includes('obj1')) {
              // Forest floor terrain mesh (obj1)
              this.terrainMesh = child;
              child.castShadow = false;
              child.receiveShadow = true;

              if (child.material) {
                if (child.material.map) {
                  child.material.map.colorSpace = THREE.SRGBColorSpace;
                }
                child.material.roughness = 0.85;
                child.material.metalness = 0.05;
                child.material.needsUpdate = true;
              }
            } else {
              // Pine trees and foliage (pine1)
              // Milestone 5.2 Performance Fix: Disable shadow-casting on dense foliage
              // Prevents 116,000 alpha-tested triangles from choking the 2048x2048 shadow map pass
              // Trees still receive dynamic shadows from characters and environment
              child.frustumCulled = true;
              child.castShadow = false;
              child.receiveShadow = true;

              if (child.material) {
                if (child.material.map) {
                  child.material.map.colorSpace = THREE.SRGBColorSpace;
                }
                // Non-metallic foliage reflects natural diffuse daylight instead of absorbing it
                child.material.metalness = 0.05;
                child.material.roughness = 0.75;
                child.material.side = THREE.DoubleSide;
                child.material.alphaTest = 0.30;
                child.material.needsUpdate = true;
              }
            }
          }
        });

        this.threeScene.add(this.environmentModel);

        // Register exact Rapier3D static trimesh collider for terrain
        if (this.terrainMesh && this.physics && this.physics.isInitialized) {
          this.physics.createTerrainTrimesh(this.terrainMesh);
        }
      }
    } catch (err) {
      console.error('[GameplayScene] Failed to load Pine Forest environment:', err);
    }

    // 2. Load Updated Shri Ram Royal Warrior FBX Character & Skeletal Rig
    try {
      console.log('[GameplayScene] Loading updated Shri Ram Royal Warrior FBX...');
      const fbx = await this.assetLoader.loadFBX(ASSET_PATHS.RAM_WARRIOR.HERO_FBX);
      if (fbx) {
        this.ramHero = fbx;

        // Model is in centimeters (194.68 cm). Scale 0.01 brings it to true 1.95m height
        this.ramHero.scale.setScalar(0.01);

        // Query terrain elevation at spawn point (0, 0)
        const groundElevation = this.physics.getTerrainElevation(0, 0);
        const spawnY = groundElevation ? groundElevation.y : 0;
        this.ramHero.position.set(0, spawnY, 0);

        // Optimize materials: preserve natural human complexion, updated hairstyle & enable shadow casting
        this.ramHero.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // Milestone 5.2 Draw Count Optimization: Collapse multi-material shadow pass into 1 single depth draw call
            if (child.isSkinnedMesh) {
              child.customDepthMaterial = new THREE.MeshDepthMaterial({
                depthPacking: THREE.RGBADepthPacking
              });
            }

            const applyMaterialProps = (mat) => {
              if (!mat) return;
              // Ensure diffuse tint is pure white so original texture skin tone and hair display accurately
              if (mat.color) {
                mat.color.setHex(0xffffff);
              }
              if (mat.map) {
                mat.map.colorSpace = THREE.SRGBColorSpace;
                mat.map.needsUpdate = true;
              }

              // Material-specific calibration
              if (mat.name === 'Hair') {
                // Short textured hair: rich black double-sided hair cards matching Ara 3D Studio export
                mat.map = null;
                mat.color.setHex(0x181818);
                if (mat.specular) {
                  mat.specular.setHex(0x282828);
                }
                mat.shininess = 25;
                mat.side = THREE.DoubleSide;
                mat.transparent = false;
                mat.depthWrite = true;
                mat.alphaTest = 0;
              } else if (mat.name === 'Eyebrows' || mat.name === 'Eyelashes') {
                mat.color.setHex(0x181818);
                mat.side = THREE.DoubleSide;
                mat.alphaTest = 0.10;
                mat.depthWrite = true;
                mat.transparent = true;
              } else if (mat.name === 'Skin' || mat.name === 'Skin details') {
                mat.roughness = 0.58;
                mat.metalness = 0.02;
              } else if (mat.name === 'Gold' || mat.name === 'Brass') {
                mat.roughness = 0.35;
                mat.metalness = 0.75;
              } else {
                mat.roughness = Math.max(mat.roughness ?? 0.6, 0.55);
                mat.metalness = Math.min(mat.metalness ?? 0.1, 0.15);
              }
              mat.needsUpdate = true;
            };

            if (Array.isArray(child.material)) {
              child.material.forEach(applyMaterialProps);
            } else {
              applyMaterialProps(child.material);
            }
          }
        });

        this.threeScene.add(this.ramHero);
        console.log(`[GameplayScene] Shri Ram Royal Warrior character added to scene at ground Y=${spawnY.toFixed(3)}m.`);

        // Initialize Player Controller with physics terrain collision
        const canvas = this.sceneManager?.renderer?.domElement || document.getElementById('game-canvas');
        this.playerController = new PlayerController(
          this.ramHero,
          this.camera,
          canvas,
          this.physics
        );

        // 3. Load Weapon Assets (Tribal Bow, Quiver, Arrow) & Shoot / Chant Animations
        try {
          console.log('[GameplayScene] Loading Tribal Bow weapon assets and chant animation...');
          const [bowGltf, shootFbx, chantFbx] = await Promise.all([
            this.assetLoader.loadGLTF(ASSET_PATHS.WEAPONS.TRIBAL_BOW_GLB),
            this.assetLoader.loadFBX(ASSET_PATHS.RAM_WARRIOR.BOW_SHOOT_ANIM),
            this.assetLoader.loadFBX(ASSET_PATHS.RAM_WARRIOR.SKY_CHANT_ANIM)
          ]);

          // Register shoot animation action with AnimationManager
          if (shootFbx && shootFbx.animations && shootFbx.animations.length > 0) {
            this.playerController.animManager.registerClip(shootFbx.animations[0], 'shoot');
            console.log('[GameplayScene] Bow draw & shoot animation registered.');
          }

          // Register chant animation action with AnimationManager
          if (chantFbx && chantFbx.animations && chantFbx.animations.length > 0) {
            this.playerController.animManager.registerClip(chantFbx.animations[0], 'chant');
            console.log('[GameplayScene] Divine Chant (aims bow toward sky) animation registered.');
          }

          // Initialize Weapon Manager and socket bow, quiver, and arrows
          this.weaponManager = new WeaponManager(
            this.ramHero,
            this.threeScene,
            this.camera,
            this.physics
          );

          if (bowGltf && bowGltf.scene) {
            this.weaponManager.initWeapons(bowGltf.scene);
          }

          this.playerController.setWeaponManager(this.weaponManager);
          this.playerController.setEnvironmentReferences(this.environmentModel, this.skyDomeMesh);
          if (this.mobileInputController) {
            this.mobileInputController.setPlayerController(this.playerController);
          }

          // Initialize Supernatural Sand Dune Ultimate VFX System
          this.sandDuneSystem = new SandDuneSystem(this.threeScene, this.physics);
          if (this.weaponManager.projectileSystem?.arrowTemplate) {
            this.sandDuneSystem.setArrowTemplate(
              this.weaponManager.projectileSystem.arrowTemplate,
              this.weaponManager.projectileSystem.tipGlowTexture
            );
          }

          console.log('[GameplayScene] Weapon and Sand Dune systems successfully initialized.');
        } catch (weapErr) {
          console.error('[GameplayScene] Failed to load weapons:', weapErr);
        }

        // 4. Load Master Aasura Warrior & Initialize Battle Wave (Milestone 5.1 Optimization)
        try {
          console.log('[GameplayScene] Loading and prewarming master Aasura warrior FBX...');
          const enemyFbx = await this.assetLoader.loadFBX(ASSET_PATHS.ENEMY.AASURA_FBX);
          if (enemyFbx) {
            // Optimize master asset: consolidate materials, build LOD0/1/2 geometries, prewarm textures & shaders
            await this.enemyOptimizer.initMasterAsset(
              enemyFbx,
              this.sceneManager?.renderer?.threeRenderer,
              this.threeScene,
              this.camera
            );

            // Initialize Battle Wave Manager
            this.enemyWaveManager = new EnemyWaveManager(
              this.threeScene,
              this.enemyOptimizer,
              this.physics,
              this.assetLoader
            );
            this.enemyWaveManager.setTargetPlayer(this.ramHero);

            if (this.weaponManager && this.playerController) {
              this.enemyWaveManager.setSystemReferences(
                this.weaponManager.projectileSystem,
                this.playerController
              );
            }

            // Sync with Wave UI HUD
            this.enemyWaveManager.onProgressChange = (progress) => {
              this.updateWaveUI(progress);
            };

            // 5. Initialize Divine Ability System (Energy Meter, Bahu-Baan, Sand Dune)
            this.divineAbilitySystem = new DivineAbilitySystem(
              this.playerController,
              this.weaponManager,
              this.enemyWaveManager,
              this.sandDuneSystem
            );
            this.sandDuneCutscene = new SandDuneCutscene(this);
            this.divineAbilitySystem.setCutscene(this.sandDuneCutscene);
            this.playerController.setAbilitySystem(this.divineAbilitySystem);
            this.enemyWaveManager.setAbilitySystem(this.divineAbilitySystem);
            this.divineAbilitySystem.onStateChange = (state) => {
              this.updateDivineHUD(state);
            };
            if (this.mobileInputController) {
              this.mobileInputController.setAbilitySystem(this.divineAbilitySystem);
            }
            this.divineAbilitySystem.notifyState();

            console.log('[GameplayScene] Aasura master asset optimized & Divine Abilities initialized.');
          }
        } catch (enemyErr) {
          console.error('[GameplayScene] Failed to load Aasura warrior FBX:', enemyErr);
        }
      }
    } catch (err) {
      console.error('[GameplayScene] Failed to load Shri Ram hero FBX:', err);
    }

    this.isLoaded = true;
  }

  update(delta, elapsed) {
    if (this.isPaused) {
      return;
    }

    const frameStart = performance.now();
    const jsStart = performance.now();

    // 1. Step Rapier3D physics
    const pStart = performance.now();
    if (this.physics && this.physics.isInitialized) {
      this.physics.step(delta);
    }
    const pDur = performance.now() - pStart;

    // 2. Update Player Controller & Third-Person Camera
    const plStart = performance.now();
    if (this.playerController) {
      this.playerController.update(delta);
    }
    const plDur = performance.now() - plStart;

    // 3. Update Enemy Wave Manager (spawning, locomotion, AI, LODs, animations)
    const eStart = performance.now();
    if (this.enemyWaveManager) {
      this.enemyWaveManager.update(delta, this.camera);
    }
    const eDur = performance.now() - eStart;

    const jsDur = performance.now() - jsStart;

    // Expose sub-stage timings for flight recorder & profiler
    this.lastFrameTimings = {
      physicsMs: pDur,
      playerMs: plDur,
      enemyMs: eDur,
      jsMs: jsDur
    };

    // 4. Update Sand Dune Ultimate VFX System & Cutscene Director
    if (this.sandDuneSystem) {
      this.sandDuneSystem.update(delta);
    }
    if (this.sandDuneCutscene) {
      this.sandDuneCutscene.update(delta);
    }

    // 5. Check if Wave 2 and abilities have concluded -> trigger ending transition
    this.checkGameCompletion();

    // 6. Record profiler metrics (active only when F2 or ?debug=1 is enabled)
    if (this.profiler && this.profiler.isEnabled) {
      this.profiler.recordFrame(performance.now() - frameStart, jsDur, eDur, pDur, 0);
    }
  }

  onResize(width, height, aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  async exit() {
    this.setPaused(false);
    this.hudContainer.classList.remove('active');
    this.hudContainer.classList.add('hidden');

    if (this.sandDuneCutscene && this.sandDuneCutscene.isPlaying) {
      this.sandDuneCutscene.completeCutscene();
    }
    audioDirector.stopSandDuneUltimate({ duration: 0.2 });

    if (this.playerController && this.playerController.isPointerLocked) {
      if (document.exitPointerLock) {
        document.exitPointerLock();
      }
    }

    if (this.hudContainer) {
      this.hudContainer.classList.remove('touch-hud-mode');
    }

    if (this.mobileInputController) {
      this.mobileInputController.hide();
    }
  }

  dispose() {
    window.removeEventListener('keydown', this.boundKeyDown);

    if (this.mobileInputController) {
      this.mobileInputController.dispose();
      this.mobileInputController = null;
    }

    if (this.playerController) {
      this.playerController.dispose();
      this.playerController = null;
    }

    if (this.weaponManager) {
      this.weaponManager.dispose();
      this.weaponManager = null;
    }

    if (this.enemyWaveManager) {
      this.enemyWaveManager.dispose();
      this.enemyWaveManager = null;
    }

    if (this.sandDuneCutscene) {
      this.sandDuneCutscene.dispose();
      this.sandDuneCutscene = null;
    }

    if (this.sandDuneSystem) {
      this.sandDuneSystem.dispose();
      this.sandDuneSystem = null;
    }

    if (this.divineAbilitySystem) {
      this.divineAbilitySystem.dispose();
      this.divineAbilitySystem = null;
    }

    if (this.profiler) {
      this.profiler.dispose();
      this.profiler = null;
    }

    if (this.hudContainer && this.hudContainer.parentNode) {
      this.hudContainer.parentNode.removeChild(this.hudContainer);
    }

    if (this.physics) {
      this.physics.dispose();
    }

    this.threeScene.traverse((object) => {
      if (object.isMesh) {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => mat.dispose());
        } else if (object.material) {
          object.material.dispose();
        }
      }
    });

    while (this.threeScene.children.length > 0) {
      this.threeScene.remove(this.threeScene.children[0]);
    }
  }
}
