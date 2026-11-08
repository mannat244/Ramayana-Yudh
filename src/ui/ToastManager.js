export class ToastManager {
  constructor() {
    if (typeof document === 'undefined') return;
    this.container = document.getElementById('toast-container');
    if (!this.container && document.body) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
    this.activeTimeout = null;
  }

  /**
   * Display a temporary, unobtrusive toast notification
   * @param {string} message 
   * @param {number} [duration=3500] Duration in milliseconds
   */
  show(message, duration = 3500) {
    if (!this.container) {
      console.log(`[Toast] ${message}`);
      return;
    }

    // Clear previous toast if still displaying
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
    }
    this.container.innerHTML = '';

    const toast = document.createElement('div');
    toast.className = 'game-toast';
    toast.innerHTML = `<span class="toast-text">${message}</span>`;
    this.container.appendChild(toast);

    // Trigger enter animation on next frame
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    this.activeTimeout = setTimeout(() => {
      toast.classList.remove('visible');
      toast.classList.add('fade-out');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 500);
      this.activeTimeout = null;
    }, duration);
  }

  dispose() {
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

export const toast = new ToastManager();

