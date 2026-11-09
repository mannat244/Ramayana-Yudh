import { audioDirector } from '../audio/AudioDirector.js';

const STORAGE_KEY = 'ramayana_yudh_settings_v2';

const DEFAULT_SETTINGS = {
  // Gameplay & Controls
  mouseSensitivity: 1.0,
  cameraSensitivity: 1.0,
  invertY: false,
  reticleContrast: 'standard', // 'standard' | 'high_contrast'

  // Graphics & Performance (Default: Lowest for maximum compatibility & FPS)
  graphicsQuality: 'low',     // 'low' | 'medium' | 'high'
  shadowsEnabled: false,

  // Audio Settings
  masterVolume: 80,
  musicVolume: 70,
  sfxVolume: 80,
  cinematicVolume: 85,
  isMuted: false
};

export class GameSettings {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.listeners = new Set();
    this.load();
  }

  static getInstance() {
    if (!GameSettings.instance) {
      GameSettings.instance = new GameSettings();
    }
    return GameSettings.instance;
  }

  load() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.settings = { ...DEFAULT_SETTINGS, ...parsed };
        }
      }
    } catch (err) {
      console.warn('[GameSettings] Could not load stored settings, using defaults:', err);
    }
    this.applyToAudio();
    this.applyToDOM();
  }

  save() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      }
    } catch (err) {
      console.warn('[GameSettings] Could not save settings to localStorage:', err);
    }
    this.notify();
  }

  get(key) {
    return this.settings[key];
  }

  set(key, value) {
    this.settings[key] = value;
    this.save();

    if (key.toLowerCase().includes('volume') || key === 'isMuted') {
      this.applyToAudio();
    }
    if (key === 'reticleContrast') {
      this.applyToDOM();
    }
    if (key === 'graphicsQuality' || key === 'shadowsEnabled') {
      if (this.activeRenderer) {
        this.applyToRenderer(this.activeRenderer);
      }
    }
  }

  setMultiple(obj) {
    Object.assign(this.settings, obj);
    this.save();
    this.applyToAudio();
    this.applyToDOM();
    if (this.activeRenderer) {
      this.applyToRenderer(this.activeRenderer);
    }
  }

  applyToAudio() {
    audioDirector.setMasterVolume(this.settings.masterVolume / 100);
    audioDirector.setMusicVolume(this.settings.musicVolume / 100);
    audioDirector.setSFXVolume(this.settings.sfxVolume / 100);
    audioDirector.setCinematicVolume(this.settings.cinematicVolume / 100);
    audioDirector.setMuted(this.settings.isMuted);
  }

  applyToDOM() {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (this.settings.reticleContrast === 'high_contrast') {
      body.classList.add('high-contrast-reticle');
    } else {
      body.classList.remove('high-contrast-reticle');
    }
  }

  applyToRenderer(renderer) {
    if (!renderer || !renderer.threeRenderer) return;
    this.activeRenderer = renderer;
    const gl = renderer.threeRenderer;

    if (this.settings.graphicsQuality === 'low' || !this.settings.shadowsEnabled) {
      gl.shadowMap.enabled = false;
    } else {
      gl.shadowMap.enabled = true;
    }

    if (this.settings.graphicsQuality === 'low') {
      gl.toneMappingExposure = 1.0;
    } else if (this.settings.graphicsQuality === 'medium') {
      gl.toneMappingExposure = 1.0;
    } else if (this.settings.graphicsQuality === 'high') {
      gl.toneMappingExposure = 1.2;
    }
  }

  applyToPlayer(playerController) {
    if (!playerController) return;
    const baseline = 0.0022;
    playerController.mouseSensitivity = baseline * (this.settings.mouseSensitivity || 1.0);
    playerController.cameraSensitivity = baseline * (this.settings.cameraSensitivity || 1.0);
    playerController.invertY = !!this.settings.invertY;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      try {
        cb(this.settings);
      } catch (e) {
        console.error('[GameSettings] Error in settings listener:', e);
      }
    }
  }
}

export const gameSettings = GameSettings.getInstance();

