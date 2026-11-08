import * as THREE from 'three';
import { ASSET_PATHS } from '../assets/assetManifest.js';

/**
 * Creates soft localized transparent fog/mist reveal effects
 * when enemies emerge from the outer forest boundaries.
 */
export class FogVFXSystem {
  /**
   * @param {THREE.Scene} scene 
   * @param {import('../core/AssetLoader.js').AssetLoader} assetLoader 
   */
  constructor(scene, assetLoader) {
    this.scene = scene;
    this.assetLoader = assetLoader;
    this.fogTexture = null;
    this.activeEmitters = [];
    this.initTexture();
  }

  async initTexture() {
    try {
      this.fogTexture = await this.assetLoader.loadTexture(ASSET_PATHS.VFX.IMPACT_DUST_SOIL);
      if (this.fogTexture) {
        this.fogTexture.colorSpace = THREE.SRGBColorSpace;
      }
    } catch (err) {
      console.warn('[FogVFXSystem] Failed to load fog texture:', err);
    }
  }

  /**
   * Spawn a localized billowing mist cloud at the enemy emergence position
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @param {number} [duration=3.5]
   */
  spawnEmergenceFog(x, y, z, duration = 3.5) {
    const group = new THREE.Group();
    group.position.set(x, y + 0.3, z);

    const puffCount = 6;
    const puffs = [];

    for (let i = 0; i < puffCount; i++) {
      const angle = (i / puffCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const radius = 0.6 + Math.random() * 0.8;
      const size = 2.4 + Math.random() * 1.2;

      const mat = new THREE.SpriteMaterial({
        map: this.fogTexture,
        color: 0x98aab8,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.NormalBlending
      });

      const sprite = new THREE.Sprite(mat);
      sprite.position.set(
        Math.cos(angle) * radius,
        0.3 + Math.random() * 0.6,
        Math.sin(angle) * radius
      );
      sprite.scale.set(size, size, 1);

      puffs.push({
        sprite,
        mat,
        baseScale: size,
        rotationSpeed: (Math.random() - 0.5) * 0.4,
        expandRate: 0.4 + Math.random() * 0.3
      });

      group.add(sprite);
    }

    this.scene.add(group);

    this.activeEmitters.push({
      group,
      puffs,
      elapsed: 0,
      duration
    });
  }

  /**
   * Update active fog clouds
   * @param {number} delta 
   */
  update(delta) {
    for (let i = this.activeEmitters.length - 1; i >= 0; i--) {
      const emitter = this.activeEmitters[i];
      emitter.elapsed += delta;
      const progress = emitter.elapsed / emitter.duration;

      if (progress >= 1.0) {
        // Dispose
        emitter.puffs.forEach((p) => {
          p.mat.dispose();
          p.sprite.geometry?.dispose();
        });
        this.scene.remove(emitter.group);
        this.activeEmitters.splice(i, 1);
        continue;
      }

      // Fade-in then fade-out curve
      let alpha = 0;
      if (progress < 0.25) {
        alpha = (progress / 0.25) * 0.65;
      } else {
        alpha = (1.0 - (progress - 0.25) / 0.75) * 0.65;
      }

      emitter.puffs.forEach((p) => {
        p.mat.opacity = Math.max(0, Math.min(1, alpha));
        const currentScale = p.baseScale + progress * p.expandRate * 2.0;
        p.sprite.scale.set(currentScale, currentScale, 1);
        p.sprite.material.rotation += p.rotationSpeed * delta;
      });
    }
  }

  dispose() {
    this.activeEmitters.forEach((emitter) => {
      emitter.puffs.forEach((p) => {
        p.mat.dispose();
      });
      this.scene.remove(emitter.group);
    });
    this.activeEmitters = [];
  }
}

