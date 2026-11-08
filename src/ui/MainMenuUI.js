import { ASSET_PATHS } from '../assets/assetManifest.js';

import { audioDirector } from '../audio/AudioDirector.js';

export class MainMenuUI {
  /**
   * @param {Object} options
   * @param {function} options.onPlay
   * @param {function} options.onSettings
   */
  constructor(options = {}) {
    this.onPlay = options.onPlay || (() => {});
    this.onSettings = options.onSettings || (() => {});

    this.container = null;
    this.settingsModal = null;
    this.isVisible = false;

    this.initDOM();
  }

  initDOM() {
    this.container = document.createElement('div');
    this.container.id = 'main-menu-ui';
    this.container.className = 'scene-overlay main-menu-layout';

    this.container.innerHTML = `
      <div class="menu-left-panel">
        <!-- Logo Header -->
        <div class="logo-wrapper">
          <img src="${ASSET_PATHS.MAIN_MENU.LOGO}" alt="Ramayana Yudh Logo" class="game-logo" id="main-logo" />
          <div class="logo-subtext">THE EPIC BATTLE OF DHARMA</div>
        </div>

        <!-- Mythological Sanskrit Inscription -->
        <div class="vedic-shloka">
          <span class="shloka-bracket">«</span>
          <span>यतो धर्मस्ततो जयः</span>
          <span class="shloka-bracket">»</span>
        </div>

        <!-- Menu Navigation Actions -->
        <nav class="menu-nav" aria-label="Main Navigation">
          <button class="menu-btn primary-btn" id="btn-play" type="button">
            <span class="btn-bracket">⟨</span>
            <span class="btn-text">PLAY GAME</span>
            <span class="btn-bracket">⟩</span>
            <span class="btn-glow"></span>
          </button>

          <button class="menu-btn secondary-btn" id="btn-settings" type="button">
            <span class="btn-bracket">⟨</span>
            <span class="btn-text">SETTINGS</span>
            <span class="btn-bracket">⟩</span>
          </button>
        </nav>
      </div>

      <!-- Settings Modal -->
      <div class="modal-backdrop hidden" id="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-ornament">❖</div>
            <h2 class="modal-title" id="settings-title">SETTINGS</h2>
            <button class="close-modal-btn" id="btn-close-settings" aria-label="Close Settings">✕</button>
          </div>

          <div class="modal-body">
            <!-- Master Volume -->
            <div class="setting-item">
              <label for="setting-master-vol" class="setting-label">Master Volume</label>
              <div class="slider-control">
                <input type="range" id="setting-master-vol" min="0" max="100" value="80" class="mythic-slider" />
                <span class="slider-value" id="val-master-vol">80%</span>
              </div>
            </div>

            <!-- Music Volume -->
            <div class="setting-item">
              <label for="setting-music-vol" class="setting-label">Atmospheric Music</label>
              <div class="slider-control">
                <input type="range" id="setting-music-vol" min="0" max="100" value="70" class="mythic-slider" />
                <span class="slider-value" id="val-music-vol">70%</span>
              </div>
            </div>

            <!-- Graphics Quality -->
            <div class="setting-item">
              <label for="setting-graphics" class="setting-label">Graphics Quality</label>
              <select id="setting-graphics" class="mythic-select">
                <option value="high" selected>High (ACES Filmic & Soft Shadows)</option>
                <option value="medium">Balanced (Standard Tone Map)</option>
                <option value="low">Performance (1x Pixel Ratio)</option>
              </select>
            </div>

            <!-- Display Mode -->
            <div class="setting-item">
              <label class="setting-label">Display Mode</label>
              <button class="secondary-btn small-btn" id="btn-toggle-fullscreen">Toggle Fullscreen</button>
            </div>
          </div>

          <div class="modal-footer">
            <button class="menu-btn primary-btn small-btn" id="btn-save-settings">
              <span class="btn-text">APPLY & CLOSE</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);
    this.settingsModal = this.container.querySelector('#settings-modal');

    this.bindEvents();
  }

  bindEvents() {
    const playBtn = this.container.querySelector('#btn-play');
    const settingsBtn = this.container.querySelector('#btn-settings');
    const closeBtn = this.container.querySelector('#btn-close-settings');
    const applyBtn = this.container.querySelector('#btn-save-settings');
    const fullscreenBtn = this.container.querySelector('#btn-toggle-fullscreen');

    playBtn.addEventListener('click', () => this.onPlay());
    settingsBtn.addEventListener('click', () => this.openSettings());
    closeBtn.addEventListener('click', () => this.closeSettings());
    applyBtn.addEventListener('click', () => this.closeSettings());

    // Master volume slider
    const masterSlider = this.container.querySelector('#setting-master-vol');
    const masterVal = this.container.querySelector('#val-master-vol');
    masterSlider.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      masterVal.textContent = `${pct}%`;
      audioDirector.setMasterVolume(pct / 100);
    });

    // Music volume slider
    const musicSlider = this.container.querySelector('#setting-music-vol');
    const musicVal = this.container.querySelector('#val-music-vol');
    musicSlider.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      musicVal.textContent = `${pct}%`;
      audioDirector.setMusicVolume(pct / 100);
    });

    // Fullscreen toggle
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn('Could not enter fullscreen:', err);
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });

    // Close on clicking backdrop outside card
    this.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) {
        this.closeSettings();
      }
    });
  }

  show() {
    this.isVisible = true;
    this.container.classList.remove('hidden');
    this.container.classList.add('active');
  }

  hide() {
    this.isVisible = false;
    this.container.classList.remove('active');
    this.container.classList.add('hidden');
    this.closeSettings();
  }

  openSettings() {
    this.settingsModal.classList.remove('hidden');
    this.settingsModal.classList.add('active');
  }

  closeSettings() {
    this.settingsModal.classList.remove('active');
    this.settingsModal.classList.add('hidden');
  }

  onResize(width, height, aspect) {
    // Dynamic adjustments if needed for mobile viewport
    if (aspect < 0.8) {
      this.container.classList.add('mobile-layout');
    } else {
      this.container.classList.remove('mobile-layout');
    }
  }

  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

