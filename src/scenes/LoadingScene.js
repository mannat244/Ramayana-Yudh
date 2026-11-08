import * as THREE from 'three';
import { ASSET_PATHS } from '../assets/assetManifest.js';

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
      <div class="loading-content">
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

        <h2 class="loading-title">PREPARING FOR BATTLE</h2>
        <p class="sanskrit-blessing">धर्मो रक्षति रक्षितः — Dharma protects those who protect it</p>

        <div class="progress-container">
          <div class="progress-bar-glow">
            <div class="progress-bar-fill" id="loading-bar-fill"></div>
          </div>
          <div class="progress-info">
            <span class="loading-status" id="loading-status-text">Surveying Dandakaranya forest...</span>
            <span class="progress-percentage" id="loading-percent-text">0%</span>
          </div>
        </div>

        <div class="error-card hidden" id="loading-error-card">
          <div class="card-ornament">⚠</div>
          <h3 class="card-title">LOADING INTERRUPTED</h3>
          <p class="card-desc" id="loading-error-message">Unable to stream environment assets.</p>
          <button class="menu-btn return-btn" id="return-menu-btn">
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
    
    const returnBtn = this.container.querySelector('#return-menu-btn');
    returnBtn.addEventListener('click', () => {
      if (this.sceneManager) {
        this.sceneManager.switchScene('mainMenu');
      }
    });
  }

  async enter(params = {}) {
    this.progress = 0;
    this.isLoading = true;
    this.errorCard.classList.add('hidden');
    this.progressBar.style.width = '0%';
    this.progressText.textContent = '0%';
    this.statusText.textContent = 'Surveying Dandakaranya terrain...';
    
    this.container.classList.remove('hidden');
    this.container.classList.add('active');

    if (params.target === 'gameplay') {
      await this.loadGameplayAssets();
    }
  }

  async loadGameplayAssets() {
    try {
      this.statusText.textContent = 'Streaming Dandakaranya pine forest environment...';

      // 1. Load Pine Forest environment (0% - 40%)
      await this.assetLoader.loadGLTF(ASSET_PATHS.ENVIRONMENT.PINE_FOREST, (ratio) => {
        const percent = Math.min(38, Math.floor(ratio * 38));
        this.progress = percent;
        this.progressBar.style.width = `${percent}%`;
        this.progressText.textContent = `${percent}%`;
      });

      this.statusText.textContent = 'Summoning Shri Ram Royal Warrior rig & animations...';

      // 2. Load Shri Ram FBX hero model and 15 animations (40% - 95%)
      await this.assetLoader.loadFBX(ASSET_PATHS.RAM_WARRIOR.HERO_FBX, (ratio) => {
        const percent = Math.min(95, 40 + Math.floor(ratio * 55));
        this.progress = percent;
        this.progressBar.style.width = `${percent}%`;
        this.progressText.textContent = `${percent}%`;
      });

      this.progress = 100;
      this.progressBar.style.width = '100%';
      this.progressText.textContent = '100%';
      this.statusText.textContent = 'Entering Dandakaranya battlefield...';

      // Brief transition delay so user feels the completion
      await new Promise((r) => setTimeout(r, 400));

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
    }
  }

  update(delta, elapsed) {
    // Progress is driven by real asset loading in loadGameplayAssets()
  }

  onResize(width, height, aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  async exit() {
    this.container.classList.remove('active');
    this.container.classList.add('hidden');
  }

  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
