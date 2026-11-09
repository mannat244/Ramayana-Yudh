import { ASSET_PATHS } from '../assets/assetManifest.js';

/**
 * Ramayana Yudh — Central Audio Director
 * Handles Main Menu BGM, Cinematic Sand Dune Ultimate Audio, SFX,
 * Volume controls, smooth fades, and browser autoplay restrictions.
 */
export class AudioDirector {
  constructor() {
    this.masterVolume = 0.8;
    this.musicVolume = 0.7;
    this.sfxVolume = 0.8;
    this.cinematicVolume = 0.85;
    this.isMuted = false;

    // Dedicated HTML5 Audio Elements (single instances to eliminate duplicates)
    this.mainMenuAudio = null;
    this.sandAbilityAudio = null;
    this.wooshAudio = null;
    this.creditsAudio = null;

    // State Tracking
    this.isUnlocked = false;
    this.isMainMenuPlaying = false;
    this.isSandAbilityPlaying = false;
    this.isCreditsPlaying = false;
    this.pendingMainMenuPlay = false;

    // Fade intervals / animation frame trackers
    this.fadeRaf = null;

    this.initAudioElements();
    this.setupAutoplayUnlock();
  }

  static getInstance() {
    if (!AudioDirector.instance) {
      AudioDirector.instance = new AudioDirector();
    }
    return AudioDirector.instance;
  }

  getEffectiveMusicVolume() {
    if (this.isMuted) return 0;
    return Math.max(0, Math.min(1, this.masterVolume * this.musicVolume));
  }

  getEffectiveSFXVolume() {
    if (this.isMuted) return 0;
    return Math.max(0, Math.min(1, this.masterVolume * this.sfxVolume));
  }

  getEffectiveCinematicVolume() {
    if (this.isMuted) return 0;
    return Math.max(0, Math.min(1, this.masterVolume * this.cinematicVolume));
  }

  initAudioElements() {
    if (typeof Audio === 'undefined') return;

    // 1. Main Menu Atmospheric Music (20.06s loopable)
    this.mainMenuAudio = new Audio(ASSET_PATHS.AUDIO?.MAIN_MENU_BGM || '/assets/audio/main_menu.mp3');
    this.mainMenuAudio.loop = true;
    this.mainMenuAudio.preload = 'auto';
    this.mainMenuAudio.volume = 0;

    // 2. Divine Sand Dune Cinematic Track (29.16s epic ultimate)
    this.sandAbilityAudio = new Audio(ASSET_PATHS.AUDIO?.SAND_ABILITY_BGM || '/assets/audio/sand_ability.mp3');
    this.sandAbilityAudio.loop = false;
    this.sandAbilityAudio.preload = 'auto';
    this.sandAbilityAudio.volume = this.getEffectiveCinematicVolume();

    // 3. Woosh SFX (1.10s celestial release)
    this.wooshAudio = new Audio(ASSET_PATHS.AUDIO?.WOOSH_SFX || '/assets/audio/woosh.wav');
    this.wooshAudio.preload = 'auto';
    this.wooshAudio.volume = this.getEffectiveSFXVolume();

    // 4. End Credits Narration & Soundtrack (~65.4s)
    this.creditsAudio = new Audio(ASSET_PATHS.AUDIO?.END_CREDITS_BGM || '/assets/audio/end_credits.mp3');
    this.creditsAudio.loop = false;
    this.creditsAudio.preload = 'auto';
    this.creditsAudio.volume = 0;
  }

  setupAutoplayUnlock() {
    if (typeof window === 'undefined') return;

    const unlockHandler = () => {
      this.isUnlocked = true;
      if (this.pendingMainMenuPlay) {
        this.pendingMainMenuPlay = false;
        this.playMainMenuMusic({ fadeIn: true });
      }
      // Remove listeners once unlocked
      window.removeEventListener('pointerdown', unlockHandler);
      window.removeEventListener('keydown', unlockHandler);
      window.removeEventListener('click', unlockHandler);
    };

    window.addEventListener('pointerdown', unlockHandler, { once: false });
    window.addEventListener('keydown', unlockHandler, { once: false });
    window.addEventListener('click', unlockHandler, { once: false });
  }

  /**
   * Adjust Master Volume (0.0 to 1.0)
   */
  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    this.updateActiveVolumes();
  }

  /**
   * Adjust Music Volume (0.0 to 1.0)
   */
  setMusicVolume(val) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    this.updateActiveVolumes();
  }

  /**
   * Adjust SFX Volume (0.0 to 1.0)
   */
  setSFXVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    this.updateActiveVolumes();
  }

  /**
   * Adjust Cinematic Audio Volume (0.0 to 1.0)
   */
  setCinematicVolume(val) {
    this.cinematicVolume = Math.max(0, Math.min(1, val));
    this.updateActiveVolumes();
  }

  /**
   * Set Mute state
   */
  setMuted(muted) {
    this.isMuted = !!muted;
    this.updateActiveVolumes();
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  updateActiveVolumes() {
    const targetMusic = this.getEffectiveMusicVolume();
    const targetCinematic = this.getEffectiveCinematicVolume();
    const targetSFX = this.getEffectiveSFXVolume();

    if (this.mainMenuAudio && this.isMainMenuPlaying) {
      this.mainMenuAudio.volume = targetMusic;
    }
    if (this.sandAbilityAudio && this.isSandAbilityPlaying) {
      this.sandAbilityAudio.volume = targetCinematic;
    }
    if (this.creditsAudio && this.isCreditsPlaying) {
      this.creditsAudio.volume = targetMusic;
    }
    if (this.wooshAudio) {
      this.wooshAudio.volume = targetSFX;
    }
  }

  /**
   * Play Main Menu background music with smooth fade-in
   */
  playMainMenuMusic({ fadeIn = true, duration = 1.2 } = {}) {
    if (this.isSandAbilityPlaying) {
      this.stopSandDuneUltimate({ duration: 0.2 });
    }

    if (!this.mainMenuAudio) return;

    if (this.isMainMenuPlaying && this.mainMenuAudio.volume > 0.05) {
      return; // Already playing smoothly
    }

    this.pendingMainMenuPlay = true;

    const targetVolume = this.getEffectiveMusicVolume();

    // Reset track position if it finished or was reset
    if (this.mainMenuAudio.paused) {
      this.isMainMenuPlaying = true;
      const playPromise = this.mainMenuAudio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          this.isUnlocked = true;
          this.pendingMainMenuPlay = false;
          if (fadeIn) {
            this.fadeVolume(this.mainMenuAudio, 0, targetVolume, duration);
          } else {
            this.mainMenuAudio.volume = targetVolume;
          }
          console.log('[AudioDirector] Main Menu BGM playing smoothly.');
        }).catch((err) => {
          this.isMainMenuPlaying = false;
          console.warn('[AudioDirector] Autoplay prevented, waiting for user gesture:', err.message);
        });
      }
    } else {
      this.isMainMenuPlaying = true;
      if (fadeIn) {
        this.fadeVolume(this.mainMenuAudio, this.mainMenuAudio.volume, targetVolume, duration);
      } else {
        this.mainMenuAudio.volume = targetVolume;
      }
    }
  }

  /**
   * Fade out and pause Main Menu music
   */
  stopMainMenuMusic({ fadeOut = true, duration = 0.8 } = {}) {
    this.pendingMainMenuPlay = false;
    if (!this.mainMenuAudio || !this.isMainMenuPlaying) return;

    if (fadeOut) {
      this.fadeVolume(this.mainMenuAudio, this.mainMenuAudio.volume, 0, duration, () => {
        this.mainMenuAudio.pause();
        this.mainMenuAudio.currentTime = 0;
        this.isMainMenuPlaying = false;
        console.log('[AudioDirector] Main Menu BGM paused.');
      });
    } else {
      this.mainMenuAudio.pause();
      this.mainMenuAudio.currentTime = 0;
      this.mainMenuAudio.volume = 0;
      this.isMainMenuPlaying = false;
    }
  }

  /**
   * Play Sand Dune Cinematic Ultimate Audio (29.16s full epic track)
   */
  playSandDuneUltimate({ onEnded, onApexTime } = {}) {
    // 1. Ensure Main Menu BGM is stopped completely
    this.stopMainMenuMusic({ fadeOut: false });

    if (!this.sandAbilityAudio) return;

    // Reset playback position
    this.sandAbilityAudio.currentTime = 0;
    this.sandAbilityAudio.volume = this.getEffectiveMusicVolume();
    this.isSandAbilityPlaying = true;

    const playPromise = this.sandAbilityAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        console.log('[AudioDirector] Divya Sand Dune Cinematic Audio started (29.16s).');
      }).catch((err) => {
        console.warn('[AudioDirector] Audio play blocked:', err.message);
      });
    }

    // Handle natural track completion
    this.sandAbilityAudio.onended = () => {
      this.isSandAbilityPlaying = false;
      console.log('[AudioDirector] Divya Sand Dune Cinematic Audio ended naturally.');
      if (typeof onEnded === 'function') {
        onEnded();
      }
    };
  }

  /**
   * Play celestial woosh SFX
   */
  playWoosh() {
    if (!this.wooshAudio) return;
    this.wooshAudio.currentTime = 0;
    this.wooshAudio.volume = this.getEffectiveSFXVolume();
    this.wooshAudio.play().catch(() => {});
  }

  /**
   * Stop Sand Dune cinematic audio early if cutscene is interrupted
   */
  stopSandDuneUltimate({ duration = 0.5 } = {}) {
    if (!this.sandAbilityAudio || !this.isSandAbilityPlaying) return;

    if (duration <= 0) {
      this.sandAbilityAudio.pause();
      this.sandAbilityAudio.currentTime = 0;
      this.isSandAbilityPlaying = false;
      return;
    }

    this.fadeVolume(this.sandAbilityAudio, this.sandAbilityAudio.volume, 0, duration, () => {
      this.sandAbilityAudio.pause();
      this.sandAbilityAudio.currentTime = 0;
      this.isSandAbilityPlaying = false;
    });
  }

  /**
   * Utility for smooth volume fading via requestAnimationFrame
   */
  fadeVolume(audioElement, fromVol, toVol, durationSec, onComplete) {
    if (!audioElement) return;

    const startTime = performance.now();
    const durationMs = durationSec * 1000;
    const scheduleNext = typeof requestAnimationFrame !== 'undefined'
      ? requestAnimationFrame
      : (fn) => setTimeout(fn, 16);

    const step = () => {
      const now = performance.now();
      const progress = Math.min(1.0, (now - startTime) / durationMs);

      // Smooth cosine interpolation
      const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);
      const curVol = fromVol + (toVol - fromVol) * eased;

      audioElement.volume = Math.max(0, Math.min(1, curVol));

      if (progress < 1.0) {
        scheduleNext(step);
      } else {
        audioElement.volume = toVol;
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }
    };

    scheduleNext(step);
  }

  /**
   * Play Credits Narration & Soundtrack with smooth fade-in
   */
  playCreditsMusic({ fadeIn = true, duration = 1.5, onEnded } = {}) {
    // Ensure menu and cinematic audio are stopped completely
    this.stopMainMenuMusic({ fadeOut: false });
    this.stopSandDuneUltimate({ duration: 0 });

    if (!this.creditsAudio) return;

    this.creditsAudio.currentTime = 0;
    const targetVolume = this.getEffectiveMusicVolume();
    this.isCreditsPlaying = true;

    const playPromise = this.creditsAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        if (fadeIn) {
          this.fadeVolume(this.creditsAudio, 0, targetVolume, duration);
        } else {
          this.creditsAudio.volume = targetVolume;
        }
        console.log('[AudioDirector] End Credits Soundtrack playing smoothly.');
      }).catch((err) => {
        console.warn('[AudioDirector] Credits audio autoplay prevented:', err.message);
      });
    }

    this.creditsAudio.onended = () => {
      this.isCreditsPlaying = false;
      console.log('[AudioDirector] End Credits Soundtrack completed naturally.');
      if (typeof onEnded === 'function') {
        onEnded();
      }
    };
  }

  /**
   * Stop credits audio with fade-out
   */
  stopCreditsMusic({ fadeOut = true, duration = 1.0 } = {}) {
    if (!this.creditsAudio || !this.isCreditsPlaying) return;

    if (fadeOut) {
      this.fadeVolume(this.creditsAudio, this.creditsAudio.volume, 0, duration, () => {
        this.creditsAudio.pause();
        this.creditsAudio.currentTime = 0;
        this.isCreditsPlaying = false;
        console.log('[AudioDirector] Credits audio paused.');
      });
    } else {
      this.creditsAudio.pause();
      this.creditsAudio.currentTime = 0;
      this.creditsAudio.volume = 0;
      this.isCreditsPlaying = false;
    }
  }

  dispose() {
    this.stopMainMenuMusic({ fadeOut: false });
    this.stopSandDuneUltimate({ duration: 0 });
    this.stopCreditsMusic({ fadeOut: false });
    this.mainMenuAudio = null;
    this.sandAbilityAudio = null;
    this.wooshAudio = null;
    this.creditsAudio = null;
  }
}

export const audioDirector = AudioDirector.getInstance();
