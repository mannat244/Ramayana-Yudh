import { ASSET_PATHS } from '../assets/assetManifest.js';
import { gameSettings } from '../core/GameSettings.js';
import { pwaManager } from '../pwa/PWAManager.js';

export class MainMenuUI {
  /**
   * @param {Object} options
   * @param {function} options.onPlay
   */
  constructor(options = {}) {
    this.onPlay = options.onPlay || (() => {});

    this.container = null;
    this.settingsModal = null;
    this.audioModal = null;
    this.aboutModal = null;

    this.isVisible = false;
    this.isStarting = false;

    this.initDOM();
  }

  initDOM() {
    this.container = document.createElement('div');
    this.container.id = 'main-menu-ui';
    this.container.className = 'scene-overlay main-menu-layout';

    const currentSettings = gameSettings.settings;

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

        <!-- Main Navigation Actions -->
        <nav class="menu-nav" aria-label="Main Navigation">
          <button class="menu-btn primary-btn" id="btn-start-game" type="button">
            <span class="btn-bracket">⟨</span>
            <span class="btn-text">START GAME</span>
            <span class="btn-bracket">⟩</span>
            <span class="btn-glow"></span>
          </button>

          <button class="menu-btn secondary-btn" id="btn-open-settings" type="button">
            <span class="btn-bracket">⟨</span>
            <span class="btn-text">SETTINGS</span>
            <span class="btn-bracket">⟩</span>
          </button>

          <button class="menu-btn secondary-btn" id="btn-open-audio" type="button">
            <span class="btn-bracket">⟨</span>
            <span class="btn-text">AUDIO</span>
            <span class="btn-bracket">⟩</span>
          </button>

          <button class="menu-btn secondary-btn" id="btn-open-about" type="button">
            <span class="btn-bracket">⟨</span>
            <span class="btn-text">ABOUT</span>
            <span class="btn-bracket">⟩</span>
          </button>

          <button class="menu-btn secondary-btn install-btn hidden" id="btn-install-app" type="button" title="Install to Chrome / Desktop">
            <span class="btn-bracket">⟨</span>
            <span class="btn-text">⤓ INSTALL APP</span>
            <span class="btn-bracket">⟩</span>
          </button>
        </nav>

        <div class="menu-footer">
          <span class="footer-note">A Non-Commercial Mythological Action Tribute</span>
        </div>
      </div>

      <!-- SETTINGS MODAL -->
      <div class="modal-backdrop hidden" id="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-ornament">❖</div>
            <h2 class="modal-title" id="settings-title">GAMEPLAY SETTINGS</h2>
            <button class="close-modal-btn" id="btn-close-settings" aria-label="Close Settings">✕</button>
          </div>

          <div class="modal-body">
            <!-- Mouse Sensitivity -->
            <div class="setting-item">
              <div class="setting-label-row">
                <label for="setting-mouse-sens" class="setting-label">Mouse Aim Sensitivity</label>
                <span class="slider-value" id="val-mouse-sens">${currentSettings.mouseSensitivity.toFixed(1)}x</span>
              </div>
              <div class="slider-control">
                <input type="range" id="setting-mouse-sens" min="0.5" max="2.5" step="0.1" value="${currentSettings.mouseSensitivity}" class="mythic-slider" />
              </div>
            </div>

            <!-- Camera Orbit Sensitivity -->
            <div class="setting-item">
              <div class="setting-label-row">
                <label for="setting-camera-sens" class="setting-label">Camera Orbit Sensitivity</label>
                <span class="slider-value" id="val-camera-sens">${currentSettings.cameraSensitivity.toFixed(1)}x</span>
              </div>
              <div class="slider-control">
                <input type="range" id="setting-camera-sens" min="0.5" max="2.5" step="0.1" value="${currentSettings.cameraSensitivity}" class="mythic-slider" />
              </div>
            </div>

            <!-- Invert Y -->
            <div class="setting-item setting-toggle-row">
              <label for="setting-invert-y" class="setting-label">Invert Vertical Look (Pitch)</label>
              <input type="checkbox" id="setting-invert-y" class="mythic-checkbox" ${currentSettings.invertY ? 'checked' : ''} />
            </div>

            <!-- Graphics Quality -->
            <div class="setting-item">
              <label for="setting-graphics" class="setting-label">Graphics Quality Preset</label>
              <select id="setting-graphics" class="mythic-select">
                <option value="high" ${currentSettings.graphicsQuality === 'high' ? 'selected' : ''}>High (ACES Filmic & Dynamic Shadows)</option>
                <option value="medium" ${currentSettings.graphicsQuality === 'medium' ? 'selected' : ''}>Balanced (Standard Exposure & Shadows)</option>
                <option value="low" ${currentSettings.graphicsQuality === 'low' ? 'selected' : ''}>Performance (Shadows Disabled)</option>
              </select>
            </div>

            <!-- Shadow Quality -->
            <div class="setting-item">
              <label for="setting-shadows" class="setting-label">Shadow Quality</label>
              <select id="setting-shadows" class="mythic-select">
                <option value="high" ${currentSettings.shadowsEnabled ? 'selected' : ''}>High (PCF Soft Shadows)</option>
                <option value="off" ${!currentSettings.shadowsEnabled ? 'selected' : ''}>Off (Maximum Performance)</option>
              </select>
            </div>

            <!-- Aiming Reticle Accessibility -->
            <div class="setting-item">
              <label for="setting-reticle" class="setting-label">Aiming Reticle Contrast</label>
              <select id="setting-reticle" class="mythic-select">
                <option value="standard" ${currentSettings.reticleContrast === 'standard' ? 'selected' : ''}>Standard (Subtle Golden Dot)</option>
                <option value="high_contrast" ${currentSettings.reticleContrast === 'high_contrast' ? 'selected' : ''}>High-Contrast (Enhanced Visibility)</option>
              </select>
            </div>

            <!-- Display Mode -->
            <div class="setting-item">
              <button class="secondary-btn small-btn full-width" id="btn-toggle-fullscreen">Toggle Fullscreen</button>
            </div>
          </div>

          <div class="modal-footer">
            <button class="menu-btn primary-btn small-btn" id="btn-apply-settings">
              <span class="btn-text">APPLY & CLOSE</span>
            </button>
          </div>
        </div>
      </div>

      <!-- AUDIO MODAL -->
      <div class="modal-backdrop hidden" id="audio-modal" role="dialog" aria-modal="true" aria-labelledby="audio-title">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-ornament">♫</div>
            <h2 class="modal-title" id="audio-title">AUDIO SETTINGS</h2>
            <button class="close-modal-btn" id="btn-close-audio" aria-label="Close Audio">✕</button>
          </div>

          <div class="modal-body">
            <!-- Master Volume -->
            <div class="setting-item">
              <div class="setting-label-row">
                <label for="setting-master-vol" class="setting-label">Master Volume</label>
                <span class="slider-value" id="val-master-vol">${currentSettings.masterVolume}%</span>
              </div>
              <div class="slider-control">
                <input type="range" id="setting-master-vol" min="0" max="100" value="${currentSettings.masterVolume}" class="mythic-slider" />
              </div>
            </div>

            <!-- Music Volume -->
            <div class="setting-item">
              <div class="setting-label-row">
                <label for="setting-music-vol" class="setting-label">Background Music</label>
                <span class="slider-value" id="val-music-vol">${currentSettings.musicVolume}%</span>
              </div>
              <div class="slider-control">
                <input type="range" id="setting-music-vol" min="0" max="100" value="${currentSettings.musicVolume}" class="mythic-slider" />
              </div>
            </div>

            <!-- Sound Effects Volume -->
            <div class="setting-item">
              <div class="setting-label-row">
                <label for="setting-sfx-vol" class="setting-label">Sound Effects (SFX)</label>
                <span class="slider-value" id="val-sfx-vol">${currentSettings.sfxVolume}%</span>
              </div>
              <div class="slider-control">
                <input type="range" id="setting-sfx-vol" min="0" max="100" value="${currentSettings.sfxVolume}" class="mythic-slider" />
              </div>
            </div>

            <!-- Cinematic Audio Volume -->
            <div class="setting-item">
              <div class="setting-label-row">
                <label for="setting-cinematic-vol" class="setting-label">Cinematic Audio</label>
                <span class="slider-value" id="val-cinematic-vol">${currentSettings.cinematicVolume}%</span>
              </div>
              <div class="slider-control">
                <input type="range" id="setting-cinematic-vol" min="0" max="100" value="${currentSettings.cinematicVolume}" class="mythic-slider" />
              </div>
            </div>

            <!-- Mute Toggle -->
            <div class="setting-item setting-toggle-row">
              <label for="setting-mute-all" class="setting-label">Mute All Audio</label>
              <input type="checkbox" id="setting-mute-all" class="mythic-checkbox" ${currentSettings.isMuted ? 'checked' : ''} />
            </div>
          </div>

          <div class="modal-footer">
            <button class="menu-btn primary-btn small-btn" id="btn-apply-audio">
              <span class="btn-text">APPLY & CLOSE</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ABOUT MODAL -->
      <div class="modal-backdrop hidden" id="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <div class="modal-card about-card">
          <div class="modal-header">
            <div class="modal-ornament">ॐ</div>
            <h2 class="modal-title" id="about-title">ABOUT RAMAYANA YUDH</h2>
            <button class="close-modal-btn" id="btn-close-about" aria-label="Close About">✕</button>
          </div>

          <div class="modal-body about-body">
            <h3 class="about-headline">A Mythological Action-Adventure Browser Game</h3>
            <p class="about-text">
              <strong>Ramayana Yudh</strong> is a personal, non-commercial browser game inspired by the Ramayana
              and timeless Indian mythological storytelling.
            </p>
            <p class="about-text">
              Created out of deep admiration, curiosity, and festive celebration for Diwali, this independent
              creative experiment explores how cinematic third-person archery, divine weapons, and dynamic battles
              can come to life directly within modern web browsers.
            </p>
            
            <div class="about-section-title">TECHNOLOGY STACK</div>
            <p class="about-text">
              Engineered with <strong>Three.js</strong> WebGL rendering, <strong>Rapier3D</strong> WebAssembly physics,
              native <strong>JavaScript (ES Modules)</strong>, and <strong>Vite</strong>.
            </p>

            <div class="about-section-title">PROGRESSIVE WEB APP (CHROME INSTALLABLE)</div>
            <p class="about-text" id="pwa-about-status">
              Ramayana Yudh is built as an installable Progressive Web App (PWA). You can install it directly to Google Chrome, Edge, or Android to run as a standalone, fullscreen game with offline support.
            </p>
            <div id="pwa-install-action-wrapper" class="hidden">
              <button class="menu-btn primary-btn small-btn mt-2" id="btn-modal-install-app" type="button">
                <span class="btn-text">⤓ INSTALL APP TO CHROME</span>
              </button>
            </div>

            <div class="about-section-title">LEGAL NOTICE & ATTRIBUTION</div>
            <p class="about-text disclaimer-text">
              This is a strictly non-commercial tribute project. It is not affiliated with, sponsored by, or endorsed by
              any film production house, studio, or corporate rights holder.
              All rights to their respective characters, names, trademarks, music, and third-party models remain with their
              respective owners. No ownership of those third-party materials is claimed.
            </p>
            <p class="about-text disclaimer-text">
              If you are a copyright or rights holder and have questions or concerns regarding material in this personal project,
              please reach out directly:
              <br /><strong class="contact-email-placeholder"><a href="mailto:mannateducation@gmail.com" class="email-link">mannateducation@gmail.com</a></strong>
            </p>
          </div>

          <div class="modal-footer">
            <button class="menu-btn primary-btn small-btn" id="btn-return-about">
              <span class="btn-text">RETURN TO MENU</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    this.settingsModal = this.container.querySelector('#settings-modal');
    this.audioModal = this.container.querySelector('#audio-modal');
    this.aboutModal = this.container.querySelector('#about-modal');

    this.bindEvents();
  }

  bindEvents() {
    // Navigation buttons
    const startBtn = this.container.querySelector('#btn-start-game');
    const settingsBtn = this.container.querySelector('#btn-open-settings');
    const audioBtn = this.container.querySelector('#btn-open-audio');
    const aboutBtn = this.container.querySelector('#btn-open-about');

    startBtn.addEventListener('click', () => {
      if (this.isStarting) return;
      this.isStarting = true;
      startBtn.classList.add('loading-click');
      this.onPlay();
    });

    settingsBtn.addEventListener('click', () => this.openModal(this.settingsModal));
    audioBtn.addEventListener('click', () => this.openModal(this.audioModal));
    aboutBtn.addEventListener('click', () => this.openModal(this.aboutModal));

    // Close buttons
    this.container.querySelector('#btn-close-settings').addEventListener('click', () => this.closeModal(this.settingsModal));
    this.container.querySelector('#btn-apply-settings').addEventListener('click', () => this.closeModal(this.settingsModal));

    this.container.querySelector('#btn-close-audio').addEventListener('click', () => this.closeModal(this.audioModal));
    this.container.querySelector('#btn-apply-audio').addEventListener('click', () => this.closeModal(this.audioModal));

    this.container.querySelector('#btn-close-about').addEventListener('click', () => this.closeModal(this.aboutModal));
    this.container.querySelector('#btn-return-about').addEventListener('click', () => this.closeModal(this.aboutModal));

    // PWA Install Triggers & State Sync
    const installNavBtn = this.container.querySelector('#btn-install-app');
    const modalInstallWrapper = this.container.querySelector('#pwa-install-action-wrapper');
    const modalInstallBtn = this.container.querySelector('#btn-modal-install-app');
    const pwaAboutStatus = this.container.querySelector('#pwa-about-status');

    const handleInstallClick = async () => {
      const result = await pwaManager.promptInstall();
      if (result.accepted) {
        if (installNavBtn) installNavBtn.classList.add('hidden');
        if (modalInstallWrapper) modalInstallWrapper.classList.add('hidden');
      }
    };

    if (installNavBtn) {
      installNavBtn.addEventListener('click', handleInstallClick);
    }
    if (modalInstallBtn) {
      modalInstallBtn.addEventListener('click', handleInstallClick);
    }

    // Subscribe to PWA installability updates
    pwaManager.onStateChange(({ canInstall, isInstalled }) => {
      if (isInstalled) {
        if (installNavBtn) installNavBtn.classList.add('hidden');
        if (modalInstallWrapper) modalInstallWrapper.classList.add('hidden');
        if (pwaAboutStatus) {
          pwaAboutStatus.innerHTML = '✓ <strong>Application Installed</strong>. Currently running as a standalone Progressive Web App.';
        }
      } else if (canInstall) {
        if (installNavBtn) installNavBtn.classList.remove('hidden');
        if (modalInstallWrapper) modalInstallWrapper.classList.remove('hidden');
      } else {
        if (installNavBtn) installNavBtn.classList.add('hidden');
        if (modalInstallWrapper) modalInstallWrapper.classList.add('hidden');
      }
    });

    // Backdrop click-to-close
    [this.settingsModal, this.audioModal, this.aboutModal].forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal);
        }
      });
    });

    // SETTINGS: Mouse Sensitivity
    const mouseSensInput = this.container.querySelector('#setting-mouse-sens');
    const mouseSensVal = this.container.querySelector('#val-mouse-sens');
    mouseSensInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      mouseSensVal.textContent = `${val.toFixed(1)}x`;
      gameSettings.set('mouseSensitivity', val);
    });

    // SETTINGS: Camera Sensitivity
    const camSensInput = this.container.querySelector('#setting-camera-sens');
    const camSensVal = this.container.querySelector('#val-camera-sens');
    camSensInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      camSensVal.textContent = `${val.toFixed(1)}x`;
      gameSettings.set('cameraSensitivity', val);
    });

    // SETTINGS: Invert Y
    const invertYInput = this.container.querySelector('#setting-invert-y');
    invertYInput.addEventListener('change', (e) => {
      gameSettings.set('invertY', e.target.checked);
    });

    // SETTINGS: Graphics Preset
    const graphicsSelect = this.container.querySelector('#setting-graphics');
    graphicsSelect.addEventListener('change', (e) => {
      gameSettings.set('graphicsQuality', e.target.value);
    });

    // SETTINGS: Shadows
    const shadowsSelect = this.container.querySelector('#setting-shadows');
    shadowsSelect.addEventListener('change', (e) => {
      gameSettings.set('shadowsEnabled', e.target.value === 'high');
    });

    // SETTINGS: Reticle Accessibility
    const reticleSelect = this.container.querySelector('#setting-reticle');
    reticleSelect.addEventListener('change', (e) => {
      gameSettings.set('reticleContrast', e.target.value);
    });

    // Fullscreen Toggle
    const fullscreenBtn = this.container.querySelector('#btn-toggle-fullscreen');
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    });

    // AUDIO: Master Volume
    const masterSlider = this.container.querySelector('#setting-master-vol');
    const masterVal = this.container.querySelector('#val-master-vol');
    masterSlider.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      masterVal.textContent = `${pct}%`;
      gameSettings.set('masterVolume', pct);
    });

    // AUDIO: Music Volume
    const musicSlider = this.container.querySelector('#setting-music-vol');
    const musicVal = this.container.querySelector('#val-music-vol');
    musicSlider.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      musicVal.textContent = `${pct}%`;
      gameSettings.set('musicVolume', pct);
    });

    // AUDIO: SFX Volume
    const sfxSlider = this.container.querySelector('#setting-sfx-vol');
    const sfxVal = this.container.querySelector('#val-sfx-vol');
    sfxSlider.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      sfxVal.textContent = `${pct}%`;
      gameSettings.set('sfxVolume', pct);
    });

    // AUDIO: Cinematic Volume
    const cineSlider = this.container.querySelector('#setting-cinematic-vol');
    const cineVal = this.container.querySelector('#val-cinematic-vol');
    cineSlider.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      cineVal.textContent = `${pct}%`;
      gameSettings.set('cinematicVolume', pct);
    });

    // AUDIO: Mute All
    const muteInput = this.container.querySelector('#setting-mute-all');
    muteInput.addEventListener('change', (e) => {
      gameSettings.set('isMuted', e.target.checked);
    });
  }

  openModal(modal) {
    if (!modal) return;
    this.closeAllModals();
    modal.classList.remove('hidden');
    modal.classList.add('active');
  }

  closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    modal.classList.add('hidden');
  }

  closeAllModals() {
    [this.settingsModal, this.audioModal, this.aboutModal].forEach((m) => {
      if (m) {
        m.classList.remove('active');
        m.classList.add('hidden');
      }
    });
  }

  show() {
    this.isVisible = true;
    this.isStarting = false;
    const startBtn = this.container.querySelector('#btn-start-game');
    if (startBtn) startBtn.classList.remove('loading-click');

    this.container.classList.remove('hidden');
    this.container.classList.add('active');
  }

  hide() {
    this.isVisible = false;
    this.container.classList.remove('active');
    this.container.classList.add('hidden');
    this.closeAllModals();
  }

  openSettings() {
    this.openModal(this.settingsModal);
  }

  openAudio() {
    this.openModal(this.audioModal);
  }

  openAbout() {
    this.openModal(this.aboutModal);
  }

  onResize(width, height, aspect) {
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
