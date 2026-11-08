import * as THREE from 'three';

/**
 * Filter bone track names for layered upper / lower body blending
 */
const isLowerBoneTrack = (trackName) => {
  return (
    trackName.includes('Hips') ||
    trackName.includes('Leg') ||
    trackName.includes('Foot') ||
    trackName.includes('Toe')
  );
};

const isUpperBoneTrack = (trackName) => {
  return !trackName.includes('Armature') && !isLowerBoneTrack(trackName);
};

export class AnimationManager {
  /**
   * @param {THREE.Object3D} characterModel 
   * @param {THREE.AnimationClip[]} animations 
   */
  constructor(characterModel, animations = []) {
    this.character = characterModel;
    this.mixer = new THREE.AnimationMixer(characterModel);

    // Layered Action Registries
    this.lowerActions = new Map();
    this.upperActions = new Map();
    this.rawClips = new Map();
    this.actions = new Map(); // General action registry for compatibility

    // Locomotion & Blending State
    this.currentLocomotion = 'idle';
    this.currentLowerAction = null;
    this.currentUpperAction = null;
    this.fadeDuration = 0.22;

    // Aiming & Shooting State
    this.isAiming = false;
    this.isShooting = false;
    this.hasFiredFirstShot = false; // Tracks if initial shot established rapid-fire stance
    this.isRapidFlick = false;
    this.rapidFlickTimer = 0;
    this.shootTime = 0;
    this.shootCallbacks = null;
    this.hasExtracted = false;
    this.hasReleased = false;

    // Milestone 6 — Divine Chant Animation State (Warrior aims bow toward sky)
    this.isChanting = false;
    this.chantTimer = 0;
    this.hasChantReleased = false;
    this.chantCallbacks = null;
    this.CHANT_RELEASE_TIME = 2.15; // Exact verified hand apex timestamp for celestial arrow launch
    this.CHANT_TOTAL_DURATION = 2.93; // Full chant clip duration

    // Timing Constants for bow_draw_and_shoot clip
    this.SHOOT_EXTRACT_TIME = 0.20; // Right hand reaches quiver arrow
    this.SHOOT_AIM_TIME = 1.00;     // Full bow draw & aim hold position
    this.SHOOT_TOTAL_DURATION = 1.25; // Follow-through for initial shot
    this.RAPID_FLICK_DURATION = 0.16; // Quick, responsive flick for rapid subsequent shots

    this.initAnimations(animations);
  }

  initAnimations(animations) {
    animations.forEach((clip) => {
      this.registerClip(clip);
    });

    console.log(`[AnimationManager] Initialized ${this.lowerActions.size} layered locomotion states.`);

    // Start in Idle pose
    this.playState('idle');
  }

  /**
   * Register an animation clip with automatic lower/upper body track splitting
   * @param {THREE.AnimationClip} clip 
   * @param {string} [customAlias] 
   */
  registerClip(clip, customAlias) {
    const rawName = (customAlias || clip.name).toLowerCase().trim();
    this.rawClips.set(rawName, clip);

    let stateKey = null;
    if (rawName.includes('idle') && !rawName.includes('crouch') && !rawName.includes('sword')) {
      stateKey = 'idle';
    } else if (rawName === 'walk') {
      stateKey = 'walk';
    } else if (rawName === 'run') {
      stateKey = 'run';
    } else if (rawName === 'jump') {
      stateKey = 'jump';
    } else if (rawName.includes('shoot') || rawName.includes('bow_draw')) {
      stateKey = 'shoot';
    } else if (rawName.includes('chant') || rawName.includes('sky')) {
      stateKey = 'chant';
    }

    if (stateKey === 'chant') {
      // Milestone 6 Fix:
      // Scale Hips.position track by 100 to convert FBX meter coordinates into character local space.
      // With root.scale = 0.01, 104.8 cm * 0.01 = 1.048m world height, completely eliminating lower-body sinking!
      const chantClip = clip.clone();
      chantClip.name = 'chant';
      chantClip.tracks.forEach((t) => {
        if (t.name.includes('Hips.position')) {
          for (let i = 0; i < t.values.length; i++) {
            t.values[i] *= 100;
          }
        }
      });

      const chantAction = this.mixer.clipAction(chantClip);
      chantAction.setLoop(THREE.LoopOnce);
      chantAction.clampWhenFinished = true;

      this.actions.set('chant', chantAction);
      console.log(`[AnimationManager] Registered Divine Chant animation (${chantClip.duration.toFixed(2)}s) with normalized Hips coordinate scaling.`);
      return;
    }

    if (stateKey === 'shoot') {
      // PRIORITY 5 FIX:
      // Strip Hips.position, Hips.quaternion, and all leg/foot tracks from shoot clip!
      // This completely eliminates the 1.05m plunge caused by meter/centimeter mismatch in Hips.position
      // Upper body performs 100% of the bow drawing motion while lower body stays grounded.
      const upperTracks = clip.tracks.filter((t) => isUpperBoneTrack(t.name));
      const shootUpperClip = new THREE.AnimationClip('shoot_upper', clip.duration, upperTracks);

      const shootUpperAction = this.mixer.clipAction(shootUpperClip);
      shootUpperAction.setLoop(THREE.LoopOnce);
      shootUpperAction.clampWhenFinished = true;

      this.upperActions.set('shoot', shootUpperAction);
      this.actions.set('shoot', shootUpperAction);
      return;
    }

    if (stateKey) {
      // Split locomotion clips into independent lower and upper actions
      const lowerTracks = clip.tracks.filter((t) => isLowerBoneTrack(t.name));
      const upperTracks = clip.tracks.filter((t) => isUpperBoneTrack(t.name));

      const lowerClip = new THREE.AnimationClip(`${stateKey}_lower`, clip.duration, lowerTracks);
      const upperClip = new THREE.AnimationClip(`${stateKey}_upper`, clip.duration, upperTracks);

      const lowerAction = this.mixer.clipAction(lowerClip);
      const upperAction = this.mixer.clipAction(upperClip);

      if (stateKey === 'walk') {
        lowerAction.timeScale = 1.15;
        upperAction.timeScale = 1.15;
      } else if (stateKey === 'run') {
        lowerAction.timeScale = 1.05;
        upperAction.timeScale = 1.05;
      } else if (stateKey === 'jump') {
        lowerAction.setLoop(THREE.LoopOnce);
        lowerAction.clampWhenFinished = true;
        upperAction.setLoop(THREE.LoopOnce);
        upperAction.clampWhenFinished = true;
      }

      this.lowerActions.set(stateKey, lowerAction);
      this.upperActions.set(stateKey, upperAction);

      // Also register full clip for legacy compatibility
      const fullAction = this.mixer.clipAction(clip);
      this.actions.set(stateKey, fullAction);
      this.actions.set(clip.name, fullAction);
    }
  }

  /**
   * Transition smoothly to a target locomotion state
   * @param {'idle'|'walk'|'run'|'jump'} targetState 
   */
  playState(targetState) {
    if (this.currentLocomotion === targetState && targetState !== 'jump') {
      return;
    }

    const nextLower = this.lowerActions.get(targetState);
    const nextUpper = this.upperActions.get(targetState);

    if (!nextLower) {
      console.warn(`[AnimationManager] Locomotion state "${targetState}" not found.`);
      return;
    }

    const prevLower = this.currentLowerAction;
    this.currentLocomotion = targetState;
    this.currentLowerAction = nextLower;

    // Smoothly crossfade lower body action (hips & legs)
    nextLower.reset();
    nextLower.enabled = true;
    if (prevLower && prevLower !== nextLower) {
      prevLower.crossFadeTo(nextLower, this.fadeDuration, true);
    } else {
      nextLower.fadeIn(this.fadeDuration);
    }
    nextLower.play();

    // Only crossfade upper body if not currently aiming or shooting
    if (!this.isAiming && !this.isShooting && nextUpper) {
      const prevUpper = this.currentUpperAction;
      this.currentUpperAction = nextUpper;

      nextUpper.reset();
      nextUpper.enabled = true;
      if (prevUpper && prevUpper !== nextUpper) {
        prevUpper.crossFadeTo(nextUpper, this.fadeDuration, true);
      } else {
        nextUpper.fadeIn(this.fadeDuration);
      }
      nextUpper.play();
    }
  }

  /**
   * Start third-person aiming stance (RMB held)
   * Upper body smoothly draws and holds bow at full draw, lower body stays in locomotion
   * @param {Function} [onExtract] Called when arrow is drawn onto bow
   */
  startAim(onExtract) {
    if (this.isAiming) return;
    this.isAiming = true;
    this.hasFiredFirstShot = false;
    this.isRapidFlick = false;

    const shootAction = this.upperActions.get('shoot');
    if (!shootAction) return;

    this.shootTime = 0;
    this.hasExtracted = false;

    // Crossfade upper body into shooting draw action
    const prevUpper = this.currentUpperAction;
    this.currentUpperAction = shootAction;

    shootAction.reset();
    shootAction.time = 0;
    shootAction.paused = false;
    shootAction.enabled = true;

    if (prevUpper && prevUpper !== shootAction) {
      prevUpper.crossFadeTo(shootAction, 0.15, true);
    } else {
      shootAction.fadeIn(0.15);
    }
    shootAction.play();

    if (onExtract) {
      // Arrow extraction happens promptly during draw
      setTimeout(() => {
        if (this.isAiming || this.isShooting) {
          this.hasExtracted = true;
          onExtract();
        }
      }, 180);
    }
  }

  /**
   * Stop aiming mode (RMB released)
   * Smoothly returns upper body to the active locomotion state
   */
  stopAim() {
    if (!this.isAiming) return;
    this.isAiming = false;
    this.hasFiredFirstShot = false;
    this.isRapidFlick = false;
    this.isShooting = false;
    this.shootCallbacks = null;

    const currentLocoUpper = this.upperActions.get(this.currentLocomotion) || this.upperActions.get('idle');
    const shootAction = this.upperActions.get('shoot');

    if (currentLocoUpper && shootAction) {
      currentLocoUpper.reset();
      currentLocoUpper.enabled = true;
      shootAction.crossFadeTo(currentLocoUpper, 0.16, true);
      currentLocoUpper.play();
      this.currentUpperAction = currentLocoUpper;
    }
  }

  /**
   * Execute bow shooting:
   * First Shot plays full draw/release sequence;
   * Subsequent Shots in aiming mode perform an optimized rapid flick release.
   * @param {{ onExtract: Function, onRelease: Function, onComplete: Function }} callbacks 
   * @returns {boolean} Whether the shot was executed
   */
  playShoot(callbacks) {
    const shootAction = this.upperActions.get('shoot');
    if (!shootAction) {
      console.warn('[AnimationManager] Shoot action not available.');
      return false;
    }

    // SUBSEQUENT SHOTS — Master Rapid Flick Archery
    if (this.isAiming && this.hasFiredFirstShot) {
      this.isShooting = false;

      // Release projectile immediately without animation delay
      if (callbacks?.onRelease) {
        callbacks.onRelease();
      }

      // Re-trigger arrow on bowstring
      if (callbacks?.onExtract) {
        callbacks.onExtract();
      }

      // Execute short, sharp flick motion on existing upper body action
      this.isRapidFlick = true;
      this.rapidFlickTimer = 0;
      shootAction.paused = false;
      shootAction.time = 0.94; // Nock snap release frame
      shootAction.play();

      if (callbacks?.onComplete) {
        callbacks.onComplete();
      }
      return true;
    }

    // FIRST SHOT — Full Animation
    if (this.isShooting) return false;

    this.isShooting = true;
    this.hasFiredFirstShot = true;
    this.shootCallbacks = callbacks;

    if (this.isAiming && shootAction.time >= this.SHOOT_AIM_TIME * 0.8) {
      // Already holding aim at full draw: immediate release!
      this.shootTime = this.SHOOT_AIM_TIME;
      this.hasExtracted = true;
      this.hasReleased = false;

      shootAction.paused = false;
      shootAction.time = this.SHOOT_AIM_TIME;
      shootAction.play();

      if (callbacks?.onRelease) {
        this.hasReleased = true;
        callbacks.onRelease();
      }
    } else {
      // Normal draw from start
      this.shootTime = 0;
      this.hasExtracted = false;
      this.hasReleased = false;

      const prevUpper = this.currentUpperAction;
      this.currentUpperAction = shootAction;

      shootAction.reset();
      shootAction.time = 0;
      shootAction.paused = false;
      shootAction.enabled = true;

      if (prevUpper && prevUpper !== shootAction) {
        prevUpper.crossFadeTo(shootAction, 0.12, true);
      } else {
        shootAction.fadeIn(0.12);
      }
      shootAction.play();
    }

    return true;
  }

  /**
   * Execute the non-looping divine chant animation for Divya Sand Dune
   * (Shri Ram raises bow towards the sky, chants celestial mantra, and launches arrow upwards)
   * @param {object} callbacks - { onRelease: Function, onComplete: Function }
   */
  playChant(callbacks) {
    if (this.isChanting) return false;

    const chantAction = this.actions.get('chant');
    if (!chantAction) {
      console.warn('[AnimationManager] Chant animation action not found!');
      if (callbacks?.onRelease) callbacks.onRelease();
      if (callbacks?.onComplete) callbacks.onComplete();
      return false;
    }

    this.isChanting = true;
    this.chantTimer = 0;
    this.hasChantReleased = false;
    this.chantCallbacks = callbacks;

    // Interrupt any active shooting or aiming state
    this.isShooting = false;
    this.isAiming = false;

    // Fade out current locomotion actions
    if (this.currentLowerAction) {
      this.currentLowerAction.fadeOut(0.20);
    }
    if (this.currentUpperAction) {
      this.currentUpperAction.fadeOut(0.20);
    }

    chantAction.reset();
    chantAction.time = 0;
    chantAction.setLoop(THREE.LoopOnce);
    chantAction.clampWhenFinished = true;
    chantAction.fadeIn(0.22);
    chantAction.play();

    return true;
  }

  stopChant() {
    if (!this.isChanting) return;
    this.isChanting = false;
    const chantAction = this.actions.get('chant');
    if (chantAction) {
      chantAction.fadeOut(0.25);
    }
    this.playState('idle');
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // 0. Milestone 6: Divine Chant Update
    if (this.isChanting) {
      this.chantTimer += delta;

      // Celestial Arrow release at verified apex (t = 2.15s)
      if (!this.hasChantReleased && this.chantTimer >= this.CHANT_RELEASE_TIME) {
        this.hasChantReleased = true;
        if (this.chantCallbacks?.onRelease) {
          this.chantCallbacks.onRelease();
        }
      }

      // Chant sequence completed (t = 2.93s)
      if (this.chantTimer >= this.CHANT_TOTAL_DURATION) {
        this.isChanting = false;
        const chantAction = this.actions.get('chant');
        if (chantAction) {
          chantAction.fadeOut(0.30);
        }

        const cb = this.chantCallbacks?.onComplete;
        this.chantCallbacks = null;

        // Smoothly restore idle locomotion
        this.playState('idle');

        if (cb) cb();
      }

      return;
    }

    const shootAction = this.upperActions.get('shoot');

    // 1. Rapid Flick Update (Subsequent Shots)
    if (this.isRapidFlick && shootAction) {
      this.rapidFlickTimer += delta;
      if (this.rapidFlickTimer >= this.RAPID_FLICK_DURATION) {
        this.isRapidFlick = false;
        shootAction.time = this.SHOOT_AIM_TIME;
        shootAction.paused = true;
      }
      return;
    }

    // 2. Aiming hold phase (RMB held down)
    if (this.isAiming && !this.isShooting && shootAction) {
      this.shootTime += delta;
      // Pause at full draw while aiming
      if (shootAction.time >= this.SHOOT_AIM_TIME) {
        shootAction.time = this.SHOOT_AIM_TIME;
        shootAction.paused = true;
      }
    }

    // 3. Active shooting sequence (First Shot)
    if (this.isShooting) {
      this.shootTime += delta;

      // Extract arrow from quiver
      if (!this.hasExtracted && this.shootTime >= this.SHOOT_EXTRACT_TIME) {
        this.hasExtracted = true;
        if (this.shootCallbacks?.onExtract) {
          this.shootCallbacks.onExtract();
        }
      }

      // Bowstring release: launch projectile
      if (!this.hasReleased && this.shootTime >= this.SHOOT_AIM_TIME) {
        this.hasReleased = true;
        if (this.shootCallbacks?.onRelease) {
          this.shootCallbacks.onRelease();
        }
      }

      // Follow-through completed
      if (this.shootTime >= this.SHOOT_TOTAL_DURATION) {
        this.isShooting = false;
        const cb = this.shootCallbacks?.onComplete;
        this.shootCallbacks = null;

        if (this.isAiming) {
          // In aiming mode: snap directly to full draw hold, ready for rapid subsequent shots!
          shootAction.time = this.SHOOT_AIM_TIME;
          shootAction.paused = true;
          this.hasExtracted = true;
          this.hasReleased = false;
        } else {
          // Smoothly return upper body to active locomotion
          const locoUpper = this.upperActions.get(this.currentLocomotion) || this.upperActions.get('idle');
          if (locoUpper) {
            locoUpper.reset();
            locoUpper.enabled = true;
            shootAction.crossFadeTo(locoUpper, 0.18, true);
            locoUpper.play();
            this.currentUpperAction = locoUpper;
          }
        }

        if (cb) cb();
      }
    }
  }

  dispose() {
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
    this.lowerActions.clear();
    this.upperActions.clear();
    this.actions.clear();
    this.currentLowerAction = null;
    this.currentUpperAction = null;
    this.isShooting = false;
    this.isAiming = false;
  }
}
