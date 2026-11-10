/**
 * DeviceDetector.js
 * Comprehensive detection for mobile, tablet, touch, and desktop pointer capabilities.
 * Supports Android, iOS Safari, Chrome Mobile, touch laptops, and standard desktops.
 */

export class DeviceDetector {
  /**
   * Check if device has physical touch input capabilities
   * @returns {boolean}
   */
  static isTouchDevice() {
    if (typeof window === 'undefined') return false;
    return (
      'ontouchstart' in window ||
      (navigator && navigator.maxTouchPoints > 0) ||
      (navigator && navigator.msMaxTouchPoints > 0) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    );
  }

  /**
   * Check if user agent string matches known mobile or tablet platforms
   * @returns {boolean}
   */
  static isMobileUserAgent() {
    if (typeof navigator === 'undefined') return false;
    const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua);
  }

  /**
   * Check if the device is a mobile or tablet form-factor
   * @returns {boolean}
   */
  static isMobileOrTablet() {
    if (typeof window === 'undefined') return false;
    const isMobileUA = DeviceDetector.isMobileUserAgent();
    const hasCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const hasTouch = DeviceDetector.isTouchDevice();
    const isSmallViewport = Math.max(window.innerWidth, window.innerHeight) <= 1280;

    return isMobileUA || (hasTouch && (hasCoarsePointer || isSmallViewport));
  }

  /**
   * Determine if mobile touch controls should be displayed
   * Strict rule: Never display mobile touch controls on ordinary desktop systems.
   * @returns {boolean}
   */
  static shouldShowMobileControls() {
    if (typeof window === 'undefined') return false;

    // Standard desktop check: fine pointer (mouse) with large screen and not mobile UA
    const hasFinePointerOnly = window.matchMedia &&
      window.matchMedia('(pointer: fine) and not (pointer: coarse)').matches;

    if (hasFinePointerOnly && !DeviceDetector.isMobileUserAgent()) {
      return false;
    }

    return DeviceDetector.isMobileOrTablet() || DeviceDetector.isTouchDevice();
  }

  /**
   * Check if the screen is currently in portrait orientation
   * @returns {boolean}
   */
  static isPortrait() {
    if (typeof window === 'undefined') return false;
    if (window.screen && window.screen.orientation && window.screen.orientation.type) {
      return window.screen.orientation.type.startsWith('portrait');
    }
    if (typeof window.orientation !== 'undefined') {
      return window.orientation === 0 || window.orientation === 180;
    }
    return window.innerHeight > window.innerWidth;
  }

  /**
   * Register a callback for orientation changes
   * @param {Function} callback 
   * @returns {Function} unbind function
   */
  static onOrientationChange(callback) {
    if (typeof window === 'undefined') return () => {};

    const handler = () => {
      callback(DeviceDetector.isPortrait());
    };

    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);

    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', handler);
    }

    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
      if (window.screen && window.screen.orientation) {
        window.screen.orientation.removeEventListener('change', handler);
      }
    };
  }
}

