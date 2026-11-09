import * as THREE from 'three';
import { ASSET_PATHS } from '../assets/assetManifest.js';

const GAMEPLAY_TIPS = [
  {
    tag: 'TIP 01 — HARDWARE',
    text: 'For the best performance, close unnecessary browser tabs and background applications before playing.'
  },
  {
    tag: 'TIP 02 — GRAPHICS ACCELERATION',
    text: 'Enable hardware acceleration in your browser. If you have an NVIDIA graphics card, configure your browser to use the High Performance GPU through Windows Graphics Settings.'
  },
  {
    tag: 'TIP 03 — CONTROLS',
    text: 'A physical mouse is recommended for comfortable third-person aiming and precise archery.'
  },
  {
    tag: 'TIP 04 — ARCHERY',
    text: 'Hold the right mouse button to aim and use the left mouse button to shoot.'
  },
  {
    tag: 'TIP 05 — DIVINE ENERGY',
    text: "Defeating enemies charges Shri Ram's divine energy. Use it strategically."
  },
  {
    tag: 'TIP 06 — ENEMY APPROACH',
    text: 'Watch the forest perimeter. Aasura warriors emerge from the surrounding fog.'
  },
  {
    tag: 'TIP 07 — DIVINE ABILITIES',
    text: 'Divya Bahu-Baan can strike multiple enemies. Divya Sand Dune is reserved for the final-wave ultimate.'
  }
];

export class LoadingScene {
  /**
   * @param {import('../core/AssetLoader.js').AssetLoader} assetLoader 
   */
  constructor(assetLoader) {
    this.assetLoader = assetLoader;
    this.sceneManager = null;
    this.threeScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.z = 5;

    this.container = null;
    this.progressBar = null;
    this.progressText = null;
    this.statusText = null;
    this.errorCard = null;

    // Tips Rotation
    this.tipTagEl = null;
    this.tipTextEl = null;
    this.currentTipIndex = 0;
    this.tipIntervalId = null;

    this.progress = 0;
    this.isLoading = false;

    this.initDOM();
  }

  setSceneManager(sceneManager) {
    this.sceneManager = sceneManager;
  }

  initDOM() {
    this.container = document.createElement('div');
    this.container.id = 'loading-screen';
    this.container.className = 'scene-overlay hidden';

    this.container.innerHTML = `
      <div class="loading-backdrop-ambient"></div>

      <div class="loading-content">
        <!-- Logo / Title -->
        <div class="loading-header">
          <img src="${ASSET_PATHS.MAIN_MENU.LOGO}" alt="Ramayana Yudh" class="loading-game-logo" />
          <h2 class="loading-title">PREPARING FOR BATTLE</h2>
          <p class="sanskrit-blessing">धर्मो रक्षति रक्षितः — Dharma protects those who protect it</p>
        </div>

        <!-- Chakra Divine Spinner -->
        <div class="divine-emblem-spinner">
          <svg viewBox="0 0 100 100" class="chakra-svg">
            <circle cx="50" cy="50" r="44" stroke="#d4af37" stroke-width="2" fill="none" opacity="0.4"/>
            <circle cx="50" cy="50" r="38" stroke="#f5c042" stroke-width="1.5" stroke-dasharray="6,4" fill="none"/>
            <circle cx="50" cy="50" r="12" fill="#d4af37" opacity="0.3"/>
            <!-- 8 radiating spokes -->
            <line x1="50" y1="12" x2="50" y2="88" stroke="#d4af37" stroke-width="1.5"/>
            <line x1="12" y1="50" x2="88" y2="50" stroke="#d4af37" stroke-width="1.5"/>
            <line x1="23" y1="23" x2="77" y2="77" stroke="#d4af37" stroke-width="1.5"/>
            <line x1="23" y1="77" x2="77" y2="23" stroke="#d4af37" stroke-width="1.5"/>
          </svg>
        </div>

        <!-- Genuine Asset Progress Bar -->
        <div class="progress-container">
          <div class="progress-bar-glow">
            <div class="progress-bar-fill" id="loading-bar-fill"></div>
          </div>
          <div class="progress-info">
            <span class="loading-status" id="loading-status-text">Surveying Dandakaranya...</span>
            <span class="progress-percentage" id="loading-percent-text">0%</span>
          </div>
        </div>

        <!-- Rotating Gameplay Tips Card with High Contrast Backing -->
        <div class="loading-tips-card" id="loading-tips-card">
          <div class="tip-ornament">❖</div>
          <div class="tip-tag" id="loading-tip-tag">TIP 01 — HARDWARE</div>
          <p class="tip-text" id="loading-tip-text">
            For the best performance, close unnecessary browser tabs and background applications before playing.
          </p>
        </div>

        <!-- Error Card -->
        <div class="error-card hidden" id="loading-error-card">
          <div class="card-ornament">⚠</div>
          <h3 class="card-title">LOADING INTERRUPTED</h3>
          <p class="card-desc" id="loading-error-message">Unable to load battlefield assets.</p>
          <button class="menu-btn secondary-btn small-btn" id="return-menu-btn">
            <span class="btn-bracket">⟨</span>
            <span class="btn-text">RETURN TO MAIN MENU</span>
            <span class="btn-bracket">⟩</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    this.progressBar = this.container.querySelector('#loading-bar-fill');
    this.progressText = this.container.querySelector('#loading-percent-text');
    this.statusText = this.container.querySelector('#loading-status-text');
    this.errorCard = this.container.querySelector('#loading-error-card');
    this.tipTagEl = this.container.querySelector('#loading-tip-tag');
    this.tipTextEl = this.container.querySelector('#loading-tip-text');
    this.tipsCard = this.container.querySelector('#loading-tips-card');
    
    const returnBtn = this.container.querySelector('#return-menu-btn');
    returnBtn.addEventListener('click', () => {
      if (this.sceneManager) {
        this.sceneManager.switchScene('mainMenu');
      }
    });
  }

  startTipRotation() {
    this.stopTipRotation();
    this.currentTipIndex = 0;
    this.showTip(this.currentTipIndex);

    this.tipIntervalId = setInterval(() => {
      if (!this.isLoading) return;
      this.currentTipIndex = (this.currentTipIndex + 1) % GAMEPLAY_TIPS.length;
      
      if (this.tipsCard) {
        this.tipsCard.classList.add('tip-fade');
        setTimeout(() => {
          this.showTip(this.currentTipIndex);
          if (this.tipsCard) {
            this.tipsCard.classList.remove('tip-fade');
          }
        }, 250);
      } else {
        this.showTip(this.currentTipIndex);
      }
    }, 4200);
  }

  stopTipRotation() {
    if (this.tipIntervalId) {
      clearInterval(this.tipIntervalId);
      this.tipIntervalId = null;
    }
  }

  showTip(index) {
    const tip = GAMEPLAY_TIPS[index];
    if (!tip) return;
    if (this.tipTagEl) this.tipTagEl.textContent = tip.tag;
    if (this.tipTextEl) this.tipTextEl.textContent = tip.text;
  }

  async enter(params = {}) {
    this.progress = 0;
    this.isLoading = true;
    this.errorCard.classList.add('hidden');
    this.progressBar.style.width = '0%';
    this.progressText.textContent = '0%';
    this.statusText.textContent = 'Preparing Dandakaranya...';
    
    this.container.classList.remove('hidden');
    this.container.classList.add('active');

    this.startTipRotation();

    if (params.target === 'gameplay') {
      await this.loadGameplayAssets();
    }
  }

  async loadGameplayAssets() {
    try {
      this.statusText.textContent = 'Preparing Dandakaranya...';

      // 1. Load Pine Forest environment (0% - 35%)
      await this.assetLoader.loadGLTF(ASSET_PATHS.ENVIRONMENT.PINE_FOREST, (ratio) => {
        const percent = Math.min(35, Math.floor(ratio * 35));
        this.updateProgress(percent);
      });

      this.statusText.textContent = 'Loading the battlefield...';

      // 2. Load Shri Ram FBX hero model and animations (35% - 72%)
      await this.assetLoader.loadFBX(ASSET_PATHS.RAM_WARRIOR.HERO_FBX, (ratio) => {
        const percent = Math.min(72, 35 + Math.floor(ratio * 37));
        this.updateProgress(percent);
      });

      this.statusText.textContent = 'Preparing the divine arsenal...';

      // 3. Preload weapons & chant animations (72% - 85%)
      await Promise.all([
        this.assetLoader.loadGLTF(ASSET_PATHS.WEAPONS.TRIBAL_BOW_GLB).catch(() => {}),
        this.assetLoader.loadFBX(ASSET_PATHS.RAM_WARRIOR.BOW_SHOOT_ANIM).catch(() => {}),
        this.assetLoader.loadFBX(ASSET_PATHS.RAM_WARRIOR.SKY_CHANT_ANIM).catch(() => {})
      ]);
      this.updateProgress(85);

      this.statusText.textContent = 'Initializing the encounter...';

      // 4. Preload Aasura warrior model (85% - 98%)
      await this.assetLoader.loadFBX(ASSET_PATHS.ENEMY.AASURA_FBX, (ratio) => {
        const percent = Math.min(98, 85 + Math.floor(ratio * 13));
        this.updateProgress(percent);
      }).catch(() => {});

      // 5. Assets confirmed ready
      this.updateProgress(100);
      this.statusText.textContent = 'Entering Dandakaranya battlefield...';

      // Brief transition delay so user feels the completion
      await new Promise((r) => setTimeout(r, 450));

      if (this.sceneManager) {
        await this.sceneManager.switchScene('gameplay');
      }
    } catch (err) {
      console.error('[LoadingScene] Error loading gameplay assets:', err);
      this.statusText.textContent = 'Failed to load battlefield environment.';
      this.errorCard.classList.remove('hidden');
      const errorMsg = this.container.querySelector('#loading-error-message');
      if (errorMsg) {
        errorMsg.textContent = err.message || 'Network or asset decompression error.';
      }
    } finally {
      this.isLoading = false;
      this.stopTipRotation();
    }
  }

  updateProgress(percent) {
    this.progress = percent;
    if (this.progressBar) this.progressBar.style.width = `${percent}%`;
    if (this.progressText) this.progressText.textContent = `${percent}%`;
  }

  update(delta, elapsed) {
    // Driven by real asset loader progress
  }

  onResize(width, height, aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  async exit() {
    this.stopTipRotation();
    this.container.classList.remove('active');
    this.container.classList.add('hidden');
  }

  dispose() {
    this.stopTipRotation();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
