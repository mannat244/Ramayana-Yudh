/**
 * MobileInputController.js
 * Modular touch input adapter for mobile & tablet browsers.
 * Features:
 * - Top-Left Compact Divine Energy Meter (no overlap with movement or center).
 * - Combined AIM / FIRE button (Hold to aim & drag to look; release to fire).
 * - Single DIVINE ability button with pop-up ability selector.
 * - Left virtual joystick (movement) + Right camera touch surface.
 * - Mobile pause button connecting to existing pause flow.
 * - Mutual exclusivity: hides desktop HUD panels on touch devices.
 */

import { DeviceDetector } from '../utils/DeviceDetector.js';

export class MobileInputController {
  /**
   * @param {HTMLElement} container 
   * @param {import('../character/PlayerController.js').PlayerController} [playerController]
   * @param {import('../weapons/DivineAbilitySystem.js').DivineAbilitySystem} [abilitySystem]
   * @param {import('../scenes/GameplayScene.js').GameplayScene} [gameplayScene]
   */
  constructor(container = document.body, playerController = null, abilitySystem = null, gameplayScene = null) {
    this.container = container;
    this.playerController = playerController;
    this.abilitySystem = abilitySystem;
    this.gameplayScene = gameplayScene;

    // Pointer Tracking
    this.joystickPointerId = null;
    this.cameraPointerId = null;
    this.lastCameraX = 0;
    this.lastCameraY = 0;

    // Combined AIM / FIRE Pointer State
    this.aimFirePointerId = null;
    this.isAimFiring = false;
    this.aimFireLastX = 0;
    this.aimFireLastY = 0;

    // Joystick Metrics
    this.joystickRadius = 54; // Max travel in pixels
    this.deadZone = 8;        // Dead zone threshold in pixels
    this.joystickCenter = { x: 0, y: 0 };

    // DOM Elements
    this.rootElement = null;
    this.energyMeter = null;
    this.energyPct = null;
    this.energyFill = null;
    this.joystickBase = null;
    this.joystickKnob = null;
    this.cameraSurface = null;
    this.btnAimFire = null;
    this.btnRun = null;
    this.btnWeapon = null;
    this.btnDivine = null;
    this.divineSelector = null;
    this.optBahuBaan = null;
    this.optSandDune = null;
    this.statusBahuBaan = null;
    this.statusSandDune = null;
    this.btnPause = null;
    this.portraitPrompt = null;

    // State
    this.isEnabled = false;
    this.isPortraitDismissed = false;
    this.isDivineSelectorOpen = false;

    // Bound Event Handlers
    this.boundOnBlur = this.handleWindowBlur.bind(this);
    this.boundOnResize = this.handleOrientationCheck.bind(this);
    this.boundOnDocumentClick = this.handleDocumentClick.bind(this);

    this.initDOM();
    this.bindEvents();
    this.handleOrientationCheck();
  }

  setPlayerController(pc) {
    this.playerController = pc;
  }

  setAbilitySystem(as) {
    this.abilitySystem = as;
  }

  setGameplayScene(gs) {
    this.gameplayScene = gs;
  }

  initDOM() {
    this.rootElement = document.createElement('div');
    this.rootElement.id = 'mobile-controls-root';
    this.rootElement.className = 'mobile-controls-root hidden';
    this.rootElement.setAttribute('aria-hidden', 'true');

    this.rootElement.innerHTML = `
      <!-- Right Side Camera Look Touch Surface -->
      <div class="mobile-camera-surface" id="mobile-cam-surface"></div>

      <!-- Top Left Mobile Divine Energy Bar -->
      <div class="mobile-energy-meter" id="mobile-energy-meter" aria-label="Divine Energy">
        <div class="mobile-energy-header">
          <span class="mobile-energy-title">DIVINE ENERGY</span>
          <span class="mobile-energy-pct" id="mobile-energy-pct">0%</span>
        </div>
        <div class="mobile-energy-track">
          <div class="mobile-energy-fill" id="mobile-energy-fill" style="width: 0%;"></div>
        </div>
      </div>

      <!-- Top Right Mobile Pause Button -->
      <button class="mobile-touch-btn mobile-pause-btn" id="mobile-btn-pause" type="button" aria-label="Pause Game">
        <span class="mobile-btn-icon">⏸</span>
      </button>

      <!-- Bottom Left Virtual Movement Joystick -->
      <div class="mobile-joystick-zone" id="mobile-joystick-zone">
        <div class="mobile-joystick-base" id="mobile-joystick-base">
          <div class="joystick-ring"></div>
          <div class="mobile-joystick-knob" id="mobile-joystick-knob">
            <div class="knob-core"></div>
          </div>
        </div>
      </div>

      <!-- Right Side Action Cluster -->
      <div class="mobile-action-cluster" id="mobile-action-cluster">
        <!-- Divine Abilities Button & Popup Selector -->
        <div class="mobile-divine-wrapper" id="mobile-divine-wrapper">
          <button class="mobile-touch-btn mobile-divine-btn" id="mobile-btn-divine" type="button" aria-label="Open Divine Abilities">
            <span class="divine-btn-glyph">❖</span>
            <span class="divine-btn-text">DIVINE</span>
          </button>

          <!-- Divine Ability Selector Popup -->
          <div class="mobile-divine-selector hidden" id="mobile-divine-selector">
            <div class="selector-header">DIVINE ARSENAL</div>
            
            <button class="ability-select-opt locked" id="mobile-opt-bahu-baan" type="button">
              <span class="opt-glyph">❖</span>
              <div class="opt-info">
                <span class="opt-name">BAHU-BAAN</span>
                <span class="opt-cost">50% ENERGY</span>
              </div>
              <span class="opt-status" id="mobile-status-bahu-baan">50%</span>
            </button>

            <button class="ability-select-opt locked" id="mobile-opt-sand-dune" type="button">
              <span class="opt-glyph">✹</span>
              <div class="opt-info">
                <span class="opt-name">SAND DUNE</span>
                <span class="opt-cost">100% • WAVE 2</span>
              </div>
              <span class="opt-status" id="mobile-status-sand-dune">LOCKED</span>
            </button>
          </div>
        </div>

        <!-- Utility Row: Run & Weapon Bow Toggle -->
        <div class="mobile-utility-row">
          <button class="mobile-touch-btn mobile-secondary-btn" id="mobile-btn-run" type="button" aria-label="Hold to Sprint">
            <span class="mobile-btn-glyph">⚡</span>
            <span class="mobile-btn-text">RUN</span>
          </button>

          <button class="mobile-touch-btn mobile-secondary-btn" id="mobile-btn-weapon" type="button" aria-label="Equip / Holster Bow">
            <span class="mobile-btn-glyph">⚔</span>
            <span class="mobile-btn-text">BOW</span>
          </button>
        </div>

        <!-- Primary Combat Button: Combined AIM / FIRE -->
        <button class="mobile-touch-btn mobile-btn-aim-fire" id="mobile-btn-aim-fire" type="button" aria-label="Hold to Aim and Drag to Look, Release to Fire">
          <div class="aim-fire-ring"></div>
          <span class="aim-fire-glyph">🏹</span>
          <span class="aim-fire-text">AIM / FIRE</span>
          <span class="aim-fire-sub">HOLD & RELEASE</span>
        </button>
      </div>

      <!-- Portrait Orientation Warning Overlay -->
      <div class="mobile-portrait-prompt hidden" id="mobile-portrait-prompt">
        <div class="portrait-card">
          <div class="phone-rotate-icon">
            <span class="phone-frame"></span>
            <span class="rotate-arrow">⟳</span>
          </div>
          <h2 class="portrait-title">ROTATE YOUR DEVICE</h2>
          <div class="portrait-sanskrit">कृपया स्क्रीन को क्षैतिज (Landscape) करें</div>
          <p class="portrait-desc">Ramayana Yudh is calibrated for cinematic landscape gameplay.</p>
          <button class="menu-btn secondary-btn small-btn" id="btn-dismiss-portrait" type="button">CONTINUE ANYWAY</button>
        </div>
      </div>
    `;

    this.container.appendChild(this.rootElement);

    // Query Cached References
    this.energyMeter = this.rootElement.querySelector('#mobile-energy-meter');
    this.energyPct = this.rootElement.querySelector('#mobile-energy-pct');
    this.energyFill = this.rootElement.querySelector('#mobile-energy-fill');
    this.cameraSurface = this.rootElement.querySelector('#mobile-cam-surface');
    this.joystickBase = this.rootElement.querySelector('#mobile-joystick-base');
    this.joystickKnob = this.rootElement.querySelector('#mobile-joystick-knob');
    this.btnAimFire = this.rootElement.querySelector('#mobile-btn-aim-fire');
    this.btnRun = this.rootElement.querySelector('#mobile-btn-run');
    this.btnWeapon = this.rootElement.querySelector('#mobile-btn-weapon');
    this.btnDivine = this.rootElement.querySelector('#mobile-btn-divine');
    this.divineSelector = this.rootElement.querySelector('#mobile-divine-selector');
    this.optBahuBaan = this.rootElement.querySelector('#mobile-opt-bahu-baan');
    this.optSandDune = this.rootElement.querySelector('#mobile-opt-sand-dune');
    this.statusBahuBaan = this.rootElement.querySelector('#mobile-status-bahu-baan');
    this.statusSandDune = this.rootElement.querySelector('#mobile-status-sand-dune');
    this.btnPause = this.rootElement.querySelector('#mobile-btn-pause');
    this.portraitPrompt = this.rootElement.querySelector('#mobile-portrait-prompt');

    const btnDismiss = this.rootElement.querySelector('#btn-dismiss-portrait');
    if (btnDismiss) {
      btnDismiss.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isPortraitDismissed = true;
        this.portraitPrompt?.classList.add('hidden');
      });
    }
  }

  bindEvents() {
    // 1. Virtual Joystick Pointer Events
    if (this.joystickBase) {
      this.joystickBase.addEventListener('pointerdown', this.onJoystickDown.bind(this));
      window.addEventListener('pointermove', this.onJoystickMove.bind(this));
      window.addEventListener('pointerup', this.onJoystickUp.bind(this));
      window.addEventListener('pointercancel', this.onJoystickUp.bind(this));
    }

    // 2. Right-Side Camera Look Pointer Events
    if (this.cameraSurface) {
      this.cameraSurface.addEventListener('pointerdown', this.onCameraDown.bind(this));
      window.addEventListener('pointermove', this.onCameraMove.bind(this));
      window.addEventListener('pointerup', this.onCameraUp.bind(this));
      window.addEventListener('pointercancel', this.onCameraUp.bind(this));
    }

    // 3. Combined AIM / FIRE Pointer Logic
    this.bindCombinedAimFire();

    // 4. Utility Buttons (Run, Weapon)
    this.bindRunButton();
    this.bindWeaponButton();

    // 5. Divine Ability Selector Logic
    this.bindDivineSelector();

    // 6. Pause Button
    this.bindPauseButton();

    // 7. Lifecycle & Safety
    window.addEventListener('blur', this.boundOnBlur);
    window.addEventListener('resize', this.boundOnResize);
    window.addEventListener('orientationchange', this.boundOnResize);
    document.addEventListener('pointerdown', this.boundOnDocumentClick);
  }

  /* -------------------------------------------------------------
   * COMBINED AIM / FIRE LOGIC (MILESTONE 7.1 UI CORRECTION)
   * - Pointer down: Enter aiming mode immediately & draw the bow.
   * - Finger drag while held: Rotate camera yaw & pitch.
   * - Pointer up: Fire exactly one arrow at centre reticle & stop aiming.
   * - Pointer cancel / blur: Cancel safely without firing.
   * ------------------------------------------------------------- */
  bindCombinedAimFire() {
    if (!this.btnAimFire) return;

    this.btnAimFire.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (this.aimFirePointerId !== null) return;
      this.aimFirePointerId = e.pointerId;
      this.isAimFiring = true;
      this.aimFireLastX = e.clientX;
      this.aimFireLastY = e.clientY;

      this.btnAimFire.classList.add('active', 'aiming');

      if (this.playerController) {
        this.playerController.startAiming();
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isAimFiring || e.pointerId !== this.aimFirePointerId) return;
      e.preventDefault();

      const deltaX = e.clientX - this.aimFireLastX;
      const deltaY = e.clientY - this.aimFireLastY;
      this.aimFireLastX = e.clientX;
      this.aimFireLastY = e.clientY;

      if (this.playerController) {
        // Dragging while holding AIM/FIRE adjusts camera view smoothly
        this.playerController.rotateCamera(deltaX, deltaY);
      }
    });

    const releaseAimFire = (e) => {
      if (!this.isAimFiring || e.pointerId !== this.aimFirePointerId) return;
      e.preventDefault();

      this.aimFirePointerId = null;
      this.isAimFiring = false;
      this.btnAimFire.classList.remove('active', 'aiming');

      if (this.playerController) {
        // Release shot: shoot arrow at center reticle target then exit aiming
        this.playerController.shootArrow();
        this.playerController.stopAiming();
      }
    };

    const cancelAimFire = (e) => {
      if (!this.isAimFiring || e.pointerId !== this.aimFirePointerId) return;
      this.aimFirePointerId = null;
      this.isAimFiring = false;
      this.btnAimFire.classList.remove('active', 'aiming');

      if (this.playerController) {
        // Safe cancellation without shooting
        this.playerController.stopAiming();
      }
    };

    window.addEventListener('pointerup', releaseAimFire);
    window.addEventListener('pointercancel', cancelAimFire);
  }

  /* -------------------------------------------------------------
   * VIRTUAL JOYSTICK LOGIC
   * ------------------------------------------------------------- */
  onJoystickDown(e) {
    if (this.joystickPointerId !== null) return;
    e.preventDefault();
    e.stopPropagation();

    this.joystickPointerId = e.pointerId;
    if (this.joystickBase.setPointerCapture) {
      try { this.joystickBase.setPointerCapture(e.pointerId); } catch (_) {}
    }

    const rect = this.joystickBase.getBoundingClientRect();
    this.joystickCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };

    this.updateJoystick(e.clientX, e.clientY);
  }

  onJoystickMove(e) {
    if (e.pointerId !== this.joystickPointerId) return;
    e.preventDefault();
    this.updateJoystick(e.clientX, e.clientY);
  }

  onJoystickUp(e) {
    if (e.pointerId !== this.joystickPointerId) return;
    this.joystickPointerId = null;

    if (this.joystickKnob) {
      this.joystickKnob.style.transform = 'translate3d(0px, 0px, 0px)';
    }

    if (this.playerController) {
      this.playerController.setJoystickInput(0, 0, 0);
    }
  }

  updateJoystick(clientX, clientY) {
    const dx = clientX - this.joystickCenter.x;
    const dy = clientY - this.joystickCenter.y;
    const dist = Math.hypot(dx, dy);

    let clampedX = dx;
    let clampedY = dy;
    if (dist > this.joystickRadius) {
      clampedX = (dx / dist) * this.joystickRadius;
      clampedY = (dy / dist) * this.joystickRadius;
    }

    if (this.joystickKnob) {
      this.joystickKnob.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0px)`;
    }

    if (!this.playerController) return;

    if (dist < this.deadZone) {
      this.playerController.setJoystickInput(0, 0, 0);
      return;
    }

    // Normalized magnitude between 0.0 and 1.0 (deadzone accounted)
    const effectiveDist = Math.min(dist, this.joystickRadius);
    const magnitude = (effectiveDist - this.deadZone) / (this.joystickRadius - this.deadZone);

    // Coordinate mapping:
    // Screen Up (dy < 0) -> Move Forward (+Z in PlayerController) -> y = -normY
    // Screen Right (dx > 0) -> Strafe Right (-X in PlayerController) -> x = -normX
    const normX = dx / dist;
    const normY = dy / dist;

    const inputX = -normX * magnitude;
    const inputZ = -normY * magnitude;

    this.playerController.setJoystickInput(inputX, inputZ, magnitude);
  }

  /* -------------------------------------------------------------
   * CAMERA LOOK LOGIC
   * ------------------------------------------------------------- */
  onCameraDown(e) {
    if (this.cameraPointerId !== null) return;
    e.preventDefault();

    this.cameraPointerId = e.pointerId;
    this.lastCameraX = e.clientX;
    this.lastCameraY = e.clientY;
  }

  onCameraMove(e) {
    if (e.pointerId !== this.cameraPointerId) return;
    e.preventDefault();

    const deltaX = e.clientX - this.lastCameraX;
    const deltaY = e.clientY - this.lastCameraY;
    this.lastCameraX = e.clientX;
    this.lastCameraY = e.clientY;

    if (this.playerController) {
      this.playerController.rotateCamera(deltaX, deltaY);
    }
  }

  onCameraUp(e) {
    if (e.pointerId !== this.cameraPointerId) return;
    this.cameraPointerId = null;
  }

  /* -------------------------------------------------------------
   * UTILITY BUTTONS (RUN & BOW)
   * ------------------------------------------------------------- */
  bindRunButton() {
    if (!this.btnRun) return;

    const startRun = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.btnRun.classList.add('active');
      if (this.playerController) {
        this.playerController.keys.shift = true;
      }
    };

    const stopRun = (e) => {
      e?.preventDefault();
      this.btnRun?.classList.remove('active');
      if (this.playerController) {
        this.playerController.keys.shift = false;
      }
    };

    this.btnRun.addEventListener('pointerdown', startRun);
    this.btnRun.addEventListener('pointerup', stopRun);
    this.btnRun.addEventListener('pointercancel', stopRun);
  }

  bindWeaponButton() {
    if (!this.btnWeapon) return;

    this.btnWeapon.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.playerController && this.playerController.weaponManager) {
        this.playerController.weaponManager.toggleEquip();
        this.playerController.updateCrosshairVisibility();
        const isEquipped = this.playerController.weaponManager.isEquipped;
        if (isEquipped) {
          this.btnWeapon.classList.add('equipped');
        } else {
          this.btnWeapon.classList.remove('equipped');
        }
      }
    });
  }

  /* -------------------------------------------------------------
   * SINGLE DIVINE BUTTON & ABILITY SELECTOR
   * ------------------------------------------------------------- */
  bindDivineSelector() {
    if (!this.btnDivine) return;

    this.btnDivine.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleDivineSelector();
    });

    if (this.optBahuBaan) {
      this.optBahuBaan.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.abilitySystem) {
          this.abilitySystem.triggerBahuBaan();
        }
        this.closeDivineSelector();
      });
    }

    if (this.optSandDune) {
      this.optSandDune.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.abilitySystem) {
          this.abilitySystem.triggerSandDune();
        }
        this.closeDivineSelector();
      });
    }
  }

  toggleDivineSelector() {
    this.isDivineSelectorOpen = !this.isDivineSelectorOpen;
    if (this.divineSelector) {
      if (this.isDivineSelectorOpen) {
        this.divineSelector.classList.remove('hidden');
        this.btnDivine?.classList.add('active');
      } else {
        this.divineSelector.classList.add('hidden');
        this.btnDivine?.classList.remove('active');
      }
    }
  }

  closeDivineSelector() {
    this.isDivineSelectorOpen = false;
    this.divineSelector?.classList.add('hidden');
    this.btnDivine?.classList.remove('active');
  }

  handleDocumentClick(e) {
    if (!this.isDivineSelectorOpen) return;
    const wrapper = this.rootElement?.querySelector('#mobile-divine-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      this.closeDivineSelector();
    }
  }

  bindPauseButton() {
    if (!this.btnPause) return;
    this.btnPause.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.gameplayScene) {
        this.gameplayScene.togglePause();
      }
    });
  }

  /* -------------------------------------------------------------
   * STATE UPDATES & SYNCHRONIZATION
   * ------------------------------------------------------------- */
  updateDivineHUD(state) {
    if (!state) return;

    // 1. Update Top-Left Mobile Divine Energy Meter
    if (this.energyPct) {
      this.energyPct.textContent = `${Math.round(state.energy)}%`;
    }
    if (this.energyFill) {
      this.energyFill.style.width = `${state.energy}%`;
      if (state.energy >= 100) {
        this.energyFill.classList.add('full-glow');
      } else {
        this.energyFill.classList.remove('full-glow');
      }
    }

    // 2. Update Single DIVINE button aura
    const canUseAny = state.bahuBaanReady || state.sandDuneReady;
    if (this.btnDivine) {
      if (canUseAny) {
        this.btnDivine.classList.add('ready');
      } else {
        this.btnDivine.classList.remove('ready');
      }
    }

    // 3. Update Bahu-Baan Option in Selector
    if (this.optBahuBaan && this.statusBahuBaan) {
      if (state.bahuBaanReady) {
        this.optBahuBaan.classList.remove('locked');
        this.optBahuBaan.classList.add('ready');
        this.statusBahuBaan.textContent = 'READY';
      } else {
        this.optBahuBaan.classList.remove('ready');
        this.optBahuBaan.classList.add('locked');
        this.statusBahuBaan.textContent = '50%';
      }
    }

    // 4. Update Sand Dune Option in Selector
    if (this.optSandDune && this.statusSandDune) {
      if (state.sandDuneLocked) {
        this.optSandDune.classList.remove('ready', 'charging');
        this.optSandDune.classList.add('locked');
        this.statusSandDune.textContent = 'WAVE 1';
      } else if (state.sandDuneReady) {
        this.optSandDune.classList.remove('locked', 'charging');
        this.optSandDune.classList.add('ready');
        this.statusSandDune.textContent = 'READY';
      } else {
        this.optSandDune.classList.remove('ready');
        this.optSandDune.classList.add('locked', 'charging');
        this.statusSandDune.textContent = `${Math.round(state.energy)}%`;
      }
    }
  }

  handleOrientationCheck() {
    if (!this.portraitPrompt) return;
    const isPortrait = DeviceDetector.isPortrait();
    const isTouch = DeviceDetector.isTouchDevice();

    if (isPortrait && isTouch && !this.isPortraitDismissed) {
      this.portraitPrompt.classList.remove('hidden');
    } else {
      this.portraitPrompt.classList.add('hidden');
    }
  }

  handleWindowBlur() {
    this.joystickPointerId = null;
    this.cameraPointerId = null;

    if (this.isAimFiring) {
      this.aimFirePointerId = null;
      this.isAimFiring = false;
      this.btnAimFire?.classList.remove('active', 'aiming');
      if (this.playerController) {
        this.playerController.stopAiming();
      }
    }

    if (this.joystickKnob) {
      this.joystickKnob.style.transform = 'translate3d(0px, 0px, 0px)';
    }

    if (this.btnRun) this.btnRun.classList.remove('active');
    this.closeDivineSelector();

    if (this.playerController) {
      this.playerController.setJoystickInput(0, 0, 0);
      this.playerController.keys.shift = false;
    }
  }

  show() {
    if (!this.rootElement) return;
    this.isEnabled = true;
    this.rootElement.classList.remove('hidden');
    this.rootElement.setAttribute('aria-hidden', 'false');
    this.handleOrientationCheck();
  }

  hide() {
    if (!this.rootElement) return;
    this.isEnabled = false;
    this.handleWindowBlur();
    this.rootElement.classList.add('hidden');
    this.rootElement.setAttribute('aria-hidden', 'true');
  }

  dispose() {
    this.handleWindowBlur();

    window.removeEventListener('blur', this.boundOnBlur);
    window.removeEventListener('resize', this.boundOnResize);
    window.removeEventListener('orientationchange', this.boundOnResize);
    document.removeEventListener('pointerdown', this.boundOnDocumentClick);

    if (this.rootElement && this.rootElement.parentNode) {
      this.rootElement.parentNode.removeChild(this.rootElement);
      this.rootElement = null;
    }

    this.playerController = null;
    this.abilitySystem = null;
    this.gameplayScene = null;
  }
}
