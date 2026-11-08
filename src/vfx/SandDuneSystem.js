import * as THREE from 'three';
import { ASSET_PATHS } from '../assets/assetManifest.js';
import { toast } from '../ui/ToastManager.js';

/**
 * Divya Sand Dune — Supernatural Ground Wave Ultimate VFX System.
 * Simulates a massive rolling earthen sand wave that sweeps across the Dandakaranya forest,
 * tightly adhering to Rapier terrain elevation, and defeating all remaining enemies.
 */
export class SandDuneSystem {
  /**
   * @param {THREE.Scene} scene 
   * @param {import('../physics/PhysicsWorld.js').PhysicsWorld} physics 
   */
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;

    this.isActive = false;
    this.elapsed = 0;
    this.duration = 3.6; // 0.8s sky arrow ascent + 2.8s sweeping ground wave

    // Sky Arrow State
    this.isSkyArrowActive = false;
    this.skyArrowTimer = 0;
    this.skyArrowDuration = 0.85;
    this.skyArrowMesh = null;
    this.skyArrowGlow = null;
    this.skyArrowVelocity = new THREE.Vector3(0, 65, 0);

    // Ground Sand Wave Parameters
    this.waveActive = false;
    this.waveProgress = 0;
    this.waveOrigin = new THREE.Vector3();
    this.waveDirection = new THREE.Vector3(0, 0, 1);
    this.wavePerp = new THREE.Vector3(1, 0, 0);
    this.waveSpeed = 19.5; // m/s
    this.waveDistance = 48.0; // Total sweep distance across forest clearing
    this.waveWidth = 38.0; // 38m lateral front

    // Target Enemies & Wave Manager References
    this.waveManager = null;
    this.hitEnemies = new Set();
    this.onCompleteCallback = null;

    // Pre-allocated Group & Sprites
    this.waveGroup = new THREE.Group();
    this.waveGroup.name = 'DivyaSandDuneWaveGroup';
    this.waveGroup.visible = false;
    this.scene.add(this.waveGroup);

    // Texture Loader
    const textureLoader = new THREE.TextureLoader();
    this.sandTexture = textureLoader.load(ASSET_PATHS.VFX.SAND_GROUND || ASSET_PATHS.VFX.TORNADO_SMOKE, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
    });

    this.initSprites();
    this.initDebris();
  }

  initSprites() {
    this.spriteCount = 28;
    this.sprites = [];

    this.spriteMaterial = new THREE.SpriteMaterial({
      map: this.sandTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    for (let i = 0; i < this.spriteCount; i++) {
      const sp = new THREE.Sprite(this.spriteMaterial.clone());
      sp.visible = false;
      this.waveGroup.add(sp);

      // Distribute across curved wave front
      const lateralRatio = (i / (this.spriteCount - 1)) * 2.0 - 1.0; // -1 to +1
      const depthOffset = (1.0 - Math.abs(lateralRatio)) * 3.5; // Crescent curved bow shape
      const baseScale = 4.5 + Math.random() * 2.5;

      this.sprites.push({
        sprite: sp,
        lateralOffset: lateralRatio * (this.waveWidth * 0.5),
        depthOffset: depthOffset + (Math.random() - 0.5) * 1.5,
        baseScale,
        rotSpeed: (Math.random() - 0.5) * 1.4,
        heightOffset: 0.8 + Math.random() * 2.2
      });
    }
  }

  initDebris() {
    // 80 instanced sand clods / small debris stones tumbling inside wave
    this.debrisCount = 80;
    this.debrisGeom = new THREE.DodecahedronGeometry(0.12, 0);
    this.debrisMaterial = new THREE.MeshBasicMaterial({
      color: 0x9e7344,
      transparent: true,
      opacity: 0.90
    });

    this.debrisMesh = new THREE.InstancedMesh(this.debrisGeom, this.debrisMaterial, this.debrisCount);
    this.debrisMesh.visible = false;
    this.waveGroup.add(this.debrisMesh);

    this.debrisData = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.debrisCount; i++) {
      const lat = (Math.random() - 0.5) * this.waveWidth * 0.85;
      const depth = (Math.random() - 0.5) * 5.0;
      this.debrisData.push({
        lat,
        depth,
        height: 0.3 + Math.random() * 2.5,
        rotX: Math.random() * Math.PI,
        rotY: Math.random() * Math.PI,
        rotZ: Math.random() * Math.PI,
        rotVel: new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4)
      });
      dummy.position.set(lat, 0, depth);
      dummy.updateMatrix();
      this.debrisMesh.setMatrixAt(i, dummy.matrix);
    }
    this.debrisMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Set reference to projectile arrow template to spawn celestial sky arrow
   * @param {THREE.Mesh} templateMesh 
   * @param {THREE.Texture} glowTex 
   */
  setArrowTemplate(templateMesh, glowTex) {
    if (!templateMesh) return;
    this.skyArrowMesh = templateMesh.clone();
    this.skyArrowMesh.visible = false;
    this.skyArrowMesh.scale.set(0.015, 0.015, 0.015);

    if (glowTex) {
      const glowMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xffe680,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.skyArrowGlow = new THREE.Sprite(glowMat);
      this.skyArrowGlow.position.set(0, -0.34, 0);
      this.skyArrowGlow.scale.set(0.45, 0.45, 0.45);
      this.skyArrowMesh.add(this.skyArrowGlow);
    }

    this.scene.add(this.skyArrowMesh);
  }

  /**
   * Trigger the full Divya Sand Dune sequence
   * @param {THREE.Vector3} launchPos 
   * @param {THREE.Vector3} forwardDir 
   * @param {import('../enemy/EnemyWaveManager.js').EnemyWaveManager} waveManager 
   * @param {Function} onComplete 
   */
  trigger(launchPos, forwardDir, waveManager, onComplete) {
    if (this.isActive) return false;

    this.isActive = true;
    this.elapsed = 0;
    this.waveManager = waveManager;
    this.onCompleteCallback = onComplete;
    this.hitEnemies.clear();

    // 1. Launch Celestial Sky Arrow
    this.isSkyArrowActive = true;
    this.skyArrowTimer = 0;

    if (this.skyArrowMesh) {
      this.skyArrowMesh.position.copy(launchPos);
      this.skyArrowMesh.visible = true;
      if (this.skyArrowGlow) this.skyArrowGlow.visible = true;

      // Vertical ascending trajectory with gentle forward tilt
      const fwd = forwardDir.clone().normalize();
      this.skyArrowVelocity.set(fwd.x * 6.0, 58.0, fwd.z * 6.0);
      this.skyArrowMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), this.skyArrowVelocity.clone().normalize());
    }

    // 2. Prepare Sand Wave Transform
    this.waveActive = false;
    this.waveProgress = 0;
    this.waveOrigin.copy(launchPos);
    this.waveDirection.copy(forwardDir).setY(0).normalize();
    this.wavePerp.set(-this.waveDirection.z, 0, this.waveDirection.x).normalize();

    toast.show('🔱 DIVYA SAND DUNE: Celestial arrow ascends into the heavens!', 3200);
    console.log('[SandDuneSystem] Divya Sand Dune celestial arrow launched!');
    return true;
  }

  /**
   * Start the rolling ground wave once the celestial arrow strikes the sky canopy
   */
  startGroundWave() {
    this.waveActive = true;
    this.waveProgress = 0;
    this.waveGroup.visible = true;
    this.debrisMesh.visible = true;

    this.sprites.forEach(s => {
      s.sprite.visible = true;
      s.sprite.material.opacity = 0.85;
    });

    toast.show('⚡ SUPERNATURAL SAND WAVE SWEEPS THE BATTLEFIELD!', 3500);
    console.log('[SandDuneSystem] Supernatural Sand Dune wave sweeps across Dandakaranya!');
  }

  update(delta) {
    if (!this.isActive) return;

    this.elapsed += delta;

    // 1. Update Sky Arrow Ascent
    if (this.isSkyArrowActive) {
      this.skyArrowTimer += delta;
      if (this.skyArrowMesh) {
        this.skyArrowMesh.position.addScaledVector(this.skyArrowVelocity, delta);
        if (this.skyArrowGlow) {
          const pulse = 0.45 + Math.sin(this.skyArrowTimer * 18.0) * 0.12;
          this.skyArrowGlow.scale.set(pulse, pulse, pulse);
        }
      }

      if (this.skyArrowTimer >= this.skyArrowDuration) {
        this.isSkyArrowActive = false;
        if (this.skyArrowMesh) this.skyArrowMesh.visible = false;
        // Arrow triggers ground wave
        this.startGroundWave();
      }
    }

    // 2. Update Advancing Sand Dune Wave
    if (this.waveActive) {
      const waveTravelTime = 2.6; // Seconds to traverse the entire 48m arena
      const waveProgress = Math.min(1.0, (this.elapsed - this.skyArrowDuration) / waveTravelTime);
      this.waveProgress = waveProgress;

      const currentDistance = waveProgress * this.waveDistance;
      const frontCenter = this.waveOrigin.clone().addScaledVector(this.waveDirection, currentDistance);

      // Fade-in at start, fade-out in final 25% of traverse
      let globalAlpha = 0.85;
      if (waveProgress < 0.15) {
        globalAlpha = (waveProgress / 0.15) * 0.85;
      } else if (waveProgress > 0.70) {
        globalAlpha = (1.0 - (waveProgress - 0.70) / 0.30) * 0.85;
      }

      // Height crest curve (rises to 4.2m at mid-sweep, gently rolls and dissipates)
      const crestHeight = 3.8 * Math.sin(Math.min(1.0, waveProgress * 1.3) * Math.PI * 0.8);

      // Update Sprites with Rapier terrain elevation snapping
      this.sprites.forEach((s) => {
        const posX = frontCenter.x + this.wavePerp.x * s.lateralOffset + this.waveDirection.x * s.depthOffset;
        const posZ = frontCenter.z + this.wavePerp.z * s.lateralOffset + this.waveDirection.z * s.depthOffset;

        let groundY = 0;
        if (this.physics && this.physics.isInitialized) {
          const elev = this.physics.getTerrainElevation(posX, posZ);
          if (elev) groundY = elev.y;
        }

        const posY = groundY + s.heightOffset * (crestHeight / 3.8);
        s.sprite.position.set(posX, posY, posZ);

        const curScale = s.baseScale * (0.8 + waveProgress * 0.5);
        s.sprite.scale.set(curScale * 1.8, curScale, 1);
        s.sprite.material.opacity = Math.max(0, globalAlpha);
        s.sprite.material.rotation += s.rotSpeed * delta;
      });

      // Update Tumbling Debris Instances
      const dummy = new THREE.Object3D();
      for (let i = 0; i < this.debrisCount; i++) {
        const d = this.debrisData[i];
        d.rotX += d.rotVel.x * delta;
        d.rotY += d.rotVel.y * delta;
        d.rotZ += d.rotVel.z * delta;

        const posX = frontCenter.x + this.wavePerp.x * d.lat + this.waveDirection.x * d.depth;
        const posZ = frontCenter.z + this.wavePerp.z * d.lat + this.waveDirection.z * d.depth;

        let groundY = 0;
        if (this.physics && this.physics.isInitialized) {
          const elev = this.physics.getTerrainElevation(posX, posZ);
          if (elev) groundY = elev.y;
        }

        dummy.position.set(posX, groundY + d.height * (crestHeight / 3.8), posZ);
        dummy.rotation.set(d.rotX, d.rotY, d.rotZ);
        dummy.scale.setScalar(Math.max(0.01, globalAlpha / 0.85));
        dummy.updateMatrix();
        this.debrisMesh.setMatrixAt(i, dummy.matrix);
      }
      this.debrisMesh.instanceMatrix.needsUpdate = true;
      this.debrisMaterial.opacity = globalAlpha;

      // 3. Collision Sweep & Immediate Enemy Knockdown
      if (this.waveManager) {
        const activeEnemies = [...this.waveManager.activeEnemies];
        for (const enemy of activeEnemies) {
          if (enemy.isDead || this.hitEnemies.has(enemy)) continue;

          // Check distance from wave origin along direction and perpendicular width
          const toEnemyFromOrigin = enemy.root.position.clone().sub(this.waveOrigin);
          const distAlongDir = toEnemyFromOrigin.dot(this.waveDirection);
          const distAlongPerp = Math.abs(toEnemyFromOrigin.dot(this.wavePerp));

          // If enemy is within wave breadth and has been swept over by current leading front
          if (distAlongDir >= -2.0 && distAlongDir <= currentDistance + 3.0 && distAlongPerp <= this.waveWidth * 0.55) {
            this.hitEnemies.add(enemy);

            // Lethal supernatural earth impact!
            console.log(`[SandDuneSystem] Enemy struck by Divya Sand Dune wave!`);
            enemy.takeDamage(100, enemy.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), this.waveDirection, true);
          }
        }
      }

      // 4. Wave Completion & Final Cleansing
      if (waveProgress >= 1.0) {
        this.completeSequence();
      }
    }
  }

  completeSequence() {
    this.isActive = false;
    this.waveActive = false;
    this.waveGroup.visible = false;
    if (this.skyArrowMesh) this.skyArrowMesh.visible = false;

    // Defeat any remaining active or pending enemies in wave manager
    if (this.waveManager) {
      this.waveManager.cancelPendingSpawnsAndComplete(true);
    }

    if (typeof this.onCompleteCallback === 'function') {
      this.onCompleteCallback();
    }
    this.onCompleteCallback = null;

    console.log('[SandDuneSystem] Divya Sand Dune sequence completed.');
  }

  dispose() {
    this.isActive = false;
    this.waveActive = false;
    if (this.waveGroup.parent) {
      this.waveGroup.parent.remove(this.waveGroup);
    }
    this.spriteMaterial?.dispose();
    this.sandTexture?.dispose();
    this.debrisGeom?.dispose();
    this.debrisMaterial?.dispose();
    if (this.skyArrowMesh && this.skyArrowMesh.parent) {
      this.skyArrowMesh.parent.remove(this.skyArrowMesh);
    }
  }
}
