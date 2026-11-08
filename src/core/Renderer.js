import * as THREE from 'three';

export class Renderer {
  /**
   * @param {HTMLElement} container 
   */
  constructor(container = document.body) {
    this.container = container;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // External Guidance Optimization: antialias false cuts 4x MSAA bandwidth on laptop GPUs
    this.threeRenderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
      precision: 'highp',
      stencil: false,
      depth: true
    });

    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.0);
    this.threeRenderer.setSize(this.width, this.height);
    this.threeRenderer.setPixelRatio(this.pixelRatio);
    this.threeRenderer.outputColorSpace = THREE.SRGBColorSpace;
    this.threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.threeRenderer.toneMappingExposure = 1.2;

    // Stable, flicker-free continuous shadow mapping with hardware 4-tap PCF
    this.threeRenderer.shadowMap.enabled = true;
    this.threeRenderer.shadowMap.type = THREE.PCFShadowMap;
    this.threeRenderer.shadowMap.autoUpdate = true;

    // Measure total draw calls across all passes accurately
    this.threeRenderer.info.autoReset = false;

    this.domElement = this.threeRenderer.domElement;
    this.domElement.id = 'game-canvas';
    this.container.appendChild(this.domElement);

    this.onResizeCallbacks = new Set();
    this.boundResizeHandler = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.boundResizeHandler);
  }

  get aspect() {
    return this.width / (this.height || 1);
  }

  onWindowResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.threeRenderer.setSize(this.width, this.height);
    this.threeRenderer.setPixelRatio(this.pixelRatio);

    for (const callback of this.onResizeCallbacks) {
      try {
        callback(this.width, this.height, this.aspect);
      } catch (err) {
        console.error('Error in resize callback:', err);
      }
    }
  }

  addResizeListener(callback) {
    this.onResizeCallbacks.add(callback);
  }

  removeResizeListener(callback) {
    this.onResizeCallbacks.delete(callback);
  }

  render(scene, camera) {
    if (!scene || !camera) return;

    // Reset draw call statistics once per frame to measure all passes together
    this.threeRenderer.info.reset();

    // Render scene with solid, stable shadow mapping (no flickering)
    this.threeRenderer.render(scene, camera);
  }

  dispose() {
    window.removeEventListener('resize', this.boundResizeHandler);
    this.onResizeCallbacks.clear();
    this.threeRenderer.dispose();
    if (this.domElement.parentNode) {
      this.domElement.parentNode.removeChild(this.domElement);
    }
  }
}

