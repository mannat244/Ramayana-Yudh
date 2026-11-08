import * as THREE from 'three';
import { ASSET_PATHS } from '../assets/assetManifest.js';

/**
 * High-performance, object-pooled impact visual effects.
 * Uses real transparent VFX textures (sparks/burst for wood, soft billowing dust for soil).
 * Pre-allocates sprites and splinters with ZERO runtime allocations.
 */
export class ImpactFXSystem {
  /**
   * @param {THREE.Scene} scene 
   * @param {number} [maxEmitters=16] 
   */
  constructor(scene, maxEmitters = 16) {
    this.scene = scene;
    this.maxEmitters = maxEmitters;
    this.emitters = [];
    this.nextIndex = 0;

    // Load authentic VFX textures with sRGB encoding
    const textureLoader = new THREE.TextureLoader();
    this.woodBurstTexture = textureLoader.load(ASSET_PATHS.VFX.IMPACT_BURST_WOOD, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
    });
    this.soilDustTexture = textureLoader.load(ASSET_PATHS.VFX.IMPACT_DUST_SOIL, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
    });

    this.initPool();
  }

  initPool() {
    // 1. Shared Sprite Materials
    this.woodBurstMaterial = new THREE.SpriteMaterial({
      map: this.woodBurstTexture,
      color: 0xfff6c8,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.soilDustMaterial = new THREE.SpriteMaterial({
      map: this.soilDustTexture,
      color: 0xdcd0bb,
      transparent: true,
      opacity: 0.85,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    // 2. Subtle directional wood slivers
    this.splinterGeom = new THREE.BoxGeometry(0.008, 0.045, 0.008);
    this.splinterMaterial = new THREE.MeshBasicMaterial({
      color: 0x9b6b38,
      transparent: true,
      opacity: 1.0,
      depthWrite: false
    });

    // 3. Pre-allocate Emitters
    for (let i = 0; i < this.maxEmitters; i++) {
      const group = new THREE.Group();
      group.name = `ImpactEmitter_${i}`;
      group.visible = false;

      // Wood Impact Burst Sprite (Camera-facing billboard)
      const woodSprite = new THREE.Sprite(this.woodBurstMaterial.clone());
      woodSprite.visible = false;
      group.add(woodSprite);

      // Wood Splinters (6 per burst)
      const splinters = [];
      for (let s = 0; s < 6; s++) {
        const m = new THREE.Mesh(this.splinterGeom, this.splinterMaterial.clone());
        m.visible = false;
        group.add(m);
        splinters.push({
          mesh: m,
          vel: new THREE.Vector3(),
          rotVel: new THREE.Vector3()
        });
      }

      // Soil Dust Puff Sprites (1 main center + 3 peripheral billowing puffs)
      const dustSprites = [];
      for (let d = 0; d < 4; d++) {
        const sp = new THREE.Sprite(this.soilDustMaterial.clone());
        sp.visible = false;
        group.add(sp);
        dustSprites.push({
          sprite: sp,
          vel: new THREE.Vector3(),
          baseScale: 1.0,
          targetScale: 1.0,
          maxOpacity: 0.85
        });
      }

      this.scene.add(group);

      this.emitters.push({
        group,
        woodSprite,
        splinters,
        dustSprites,
        active: false,
        age: 0,
        maxAge: 0.28,
        type: 'wood' // 'wood' | 'soil'
      });
    }

    console.log(`[ImpactFXSystem] Pre-allocated ${this.maxEmitters} impact emitters with transparent burst and dust textures.`);
  }

  /**
   * Trigger an impact effect at a collision point
   * @param {THREE.Vector3} position 
   * @param {THREE.Vector3} normal 
   * @param {'wood'|'soil'} [type='wood'] 
   */
  spawnImpact(position, normal, type = 'wood') {
    const emitter = this.emitters[this.nextIndex];
    this.nextIndex = (this.nextIndex + 1) % this.maxEmitters;

    emitter.active = true;
    emitter.age = 0;
    emitter.type = type;
    emitter.maxAge = type === 'wood' ? 0.28 : 0.45;
    emitter.group.position.copy(position);
    emitter.group.visible = true;

    // Normal vector alignment
    const n = normal && normal.lengthSq() > 0.001 ? normal.clone().normalize() : new THREE.Vector3(0, 1, 0);

    if (type === 'wood') {
      // 1. Transparent Wood Burst Sprite (Instant sharp flash & sparks)
      emitter.woodSprite.visible = true;
      emitter.woodSprite.position.set(n.x * 0.04, n.y * 0.04, n.z * 0.04);
      emitter.woodSprite.scale.set(0.18, 0.18, 0.18);
      emitter.woodSprite.material.opacity = 1.0;

      // 2. Wooden splinters bursting along normal cone
      emitter.splinters.forEach((s) => {
        s.mesh.visible = true;
        s.mesh.position.set(0, 0, 0);
        s.mesh.scale.setScalar(0.7 + Math.random() * 0.5);
        s.mesh.material.opacity = 1.0;

        s.vel.set(
          n.x * 2.2 + (Math.random() - 0.5) * 2.5,
          Math.max(0.4, n.y * 2.2 + (Math.random() - 0.5) * 1.8),
          n.z * 2.2 + (Math.random() - 0.5) * 2.5
        );
        s.rotVel.set(
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 16
        );
      });

      // Hide dust sprites
      emitter.dustSprites.forEach((d) => (d.sprite.visible = false));

    } else {
      // Soil impact: No splinters, billowy transparent dust puff
      emitter.woodSprite.visible = false;
      emitter.splinters.forEach((s) => (s.mesh.visible = false));

      emitter.dustSprites.forEach((d, idx) => {
        d.sprite.visible = true;
        if (idx === 0) {
          // Main central dust cloud
          d.sprite.position.set(0, 0.05, 0);
          d.baseScale = 0.20;
          d.targetScale = 0.65;
          d.maxOpacity = 0.85;
          d.vel.set(n.x * 0.3, Math.max(0.4, n.y * 0.6), n.z * 0.3);
        } else {
          // Peripheral billowing puffs
          const angle = (idx - 1) * (Math.PI * 2 / 3) + Math.random() * 0.4;
          const radius = 0.06 + Math.random() * 0.04;
          d.sprite.position.set(Math.cos(angle) * radius, 0.03, Math.sin(angle) * radius);
          d.baseScale = 0.14 + Math.random() * 0.08;
          d.targetScale = 0.45 + Math.random() * 0.15;
          d.maxOpacity = 0.65;
          d.vel.set(
            Math.cos(angle) * 0.5 + (Math.random() - 0.5) * 0.2,
            0.35 + Math.random() * 0.25,
            Math.sin(angle) * 0.5 + (Math.random() - 0.5) * 0.2
          );
        }
        d.sprite.scale.set(d.baseScale, d.baseScale, d.baseScale);
        d.sprite.material.opacity = d.maxOpacity;
      });
    }
  }

  update(delta) {
    for (let i = 0; i < this.maxEmitters; i++) {
      const e = this.emitters[i];
      if (!e.active) continue;

      e.age += delta;
      const progress = e.age / e.maxAge;

      if (progress >= 1.0) {
        e.active = false;
        e.group.visible = false;
        continue;
      }

      const fade = 1.0 - progress;

      if (e.type === 'wood') {
        // 1. Update Wood Burst Sprite: Quick outward expansion then sharp fade
        if (e.woodSprite.visible) {
          const burstProgress = Math.min(1.0, e.age / 0.10);
          const currentScale = 0.18 + burstProgress * 0.24; // Expands to 0.42m
          e.woodSprite.scale.set(currentScale, currentScale, currentScale);
          e.woodSprite.material.opacity = Math.max(0, 1.0 - Math.pow(progress, 1.4));
        }

        // 2. Update Splinters
        e.splinters.forEach((s) => {
          if (!s.mesh.visible) return;
          s.vel.y -= 9.81 * delta * 0.65; // Gravity
          s.mesh.position.addScaledVector(s.vel, delta);
          s.mesh.rotation.x += s.rotVel.x * delta;
          s.mesh.rotation.y += s.rotVel.y * delta;
          s.mesh.rotation.z += s.rotVel.z * delta;
          s.mesh.material.opacity = Math.max(0, fade);
        });

      } else {
        // Update Soil Dust Sprites: Soft billowing expansion and upward drift
        e.dustSprites.forEach((d) => {
          if (!d.sprite.visible) return;
          d.vel.y += 0.20 * delta; // Gentle thermal rise
          d.vel.x *= (1.0 - delta * 1.5); // Air resistance
          d.vel.z *= (1.0 - delta * 1.5);
          d.sprite.position.addScaledVector(d.vel, delta);

          const curScale = d.baseScale + (d.targetScale - d.baseScale) * Math.sin(progress * Math.PI * 0.5);
          d.sprite.scale.set(curScale, curScale, curScale);
          d.sprite.material.opacity = Math.max(0, d.maxOpacity * Math.pow(fade, 1.6));
        });
      }
    }
  }

  dispose() {
    this.emitters.forEach((e) => {
      this.scene.remove(e.group);
      e.woodSprite.material.dispose();
      e.splinters.forEach(s => s.mesh.material.dispose());
      e.dustSprites.forEach(d => d.sprite.material.dispose());
    });
    this.emitters = [];
    this.splinterGeom?.dispose();
    this.splinterMaterial?.dispose();
    this.woodBurstMaterial?.dispose();
    this.soilDustMaterial?.dispose();
    this.woodBurstTexture?.dispose();
    this.soilDustTexture?.dispose();
  }
}
