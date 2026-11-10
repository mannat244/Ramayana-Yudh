/**
 * Ramayana Yudh — Progressive Web App (PWA) Manager
 * Handles Service Worker lifecycle, Chrome install prompt capture, and standalone detection.
 */

export class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.canInstall = false;
    this.listeners = new Set();

    this.checkStandalone();
    this.initInstallPromptListener();
  }

  /**
   * Register the Service Worker
   */
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.log('[PWA] Service Worker not supported in this browser.');
      return null;
    }

    try {
      // Determine service worker path relative to current base
      const swUrl = './sw.js';
      const registration = await navigator.serviceWorker.register(swUrl, { scope: './' });

      console.log('%c[PWA] Service Worker registered with scope: ' + registration.scope, 'color: #2ed573;');

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New version available. Refresh to update.');
            }
          });
        }
      });

      return registration;
    } catch (err) {
      console.warn('[PWA] Service Worker registration failed:', err);
      return null;
    }
  }

  /**
   * Check if running in standalone display mode (already installed or launched as PWA)
   */
  checkStandalone() {
    const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
    const isFullscreenDisplay = window.matchMedia('(display-mode: fullscreen)').matches;
    const isIosStandalone = window.navigator.standalone === true;

    this.isInstalled = isStandaloneDisplay || isFullscreenDisplay || isIosStandalone;
    return this.isInstalled;
  }

  /**
   * Capture Chrome's beforeinstallprompt event
   */
  initInstallPromptListener() {
    window.addEventListener('beforeinstallprompt', (event) => {
      // Prevent automatic mini-infobar on mobile so we can offer our themed in-game install button
      // Note: This does NOT prevent Chrome's native desktop Omnibox/address-bar install icon
      event.preventDefault();

      this.deferredPrompt = event;
      this.canInstall = true;

      console.log('%c[PWA] Chrome beforeinstallprompt captured. Game is installable!', 'color: #ffd54f;');
      this.notifyListeners();
      
      window.dispatchEvent(new CustomEvent('pwa-installable', { detail: { canInstall: true } }));
    });

    window.addEventListener('appinstalled', (event) => {
      console.log('%c[PWA] Ramayana Yudh was successfully installed!', 'color: #2ed573; font-weight: bold;');
      this.deferredPrompt = null;
      this.canInstall = false;
      this.isInstalled = true;
      this.notifyListeners();

      window.dispatchEvent(new CustomEvent('pwa-installed'));
    });
  }

  /**
   * Trigger the native Chrome install prompt dialog
   * @returns {Promise<{ accepted: boolean, outcome: string }>}
   */
  async promptInstall() {
    if (!this.deferredPrompt) {
      console.log('[PWA] No deferred install prompt available.');
      return { accepted: false, outcome: 'unavailable' };
    }

    try {
      // Show the Chrome native install prompt
      this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;

      console.log('[PWA] User choice outcome:', choiceResult.outcome);

      const accepted = choiceResult.outcome === 'accepted';
      if (accepted) {
        this.canInstall = false;
      }

      this.deferredPrompt = null;
      this.notifyListeners();

      return { accepted, outcome: choiceResult.outcome };
    } catch (err) {
      console.error('[PWA] Error displaying install prompt:', err);
      return { accepted: false, outcome: 'error' };
    }
  }

  /**
   * Subscribe to installability changes
   * @param {Function} callback 
   */
  onStateChange(callback) {
    this.listeners.add(callback);
    // Fire immediately with initial state
    callback({
      canInstall: this.canInstall,
      isInstalled: this.isInstalled
    });
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    const state = {
      canInstall: this.canInstall,
      isInstalled: this.isInstalled
    };
    this.listeners.forEach((callback) => {
      try {
        callback(state);
      } catch (e) {
        console.error('[PWA] Listener error:', e);
      }
    });
  }
}

export const pwaManager = new PWAManager();

