import * as THREE from 'three';
import { ImpactFXSystem } from './ImpactFXSystem.js';
import { ASSET_PATHS } from '../assets/assetManifest.js';

export class ProjectileSystem {
  /**
   * @param {THREE.Scene} scene 
   * @param {import('../physics/PhysicsWorld.js').PhysicsWorld} [physics] 
   */
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    this.gravity = 9.81; // m/s^2

    // Internal raycaster for precise tree and environment hit detection
    this.raycaster = new THREE.Raycaster();
    this.environmentMeshes = [];
    this.enemyHitboxes = [];

    // Impact Visual Effects System (Transparent bursts & soft soil dust)
    this.impactFX = new ImpactFXSystem(scene, 16);

    // Object Pooling Architecture
    this.POOL_SIZE = 30;
    this.pool = [];
    this.arrowTemplate = null;
    this.isPoolInitialized = false;

    // Pre-allocated scratch objects to eliminate per-frame GC allocations
    this._scratchCurrentPos = new THREE.Vector3();
    this._scratchNextPos = new THREE.Vector3();
    this._scratchSegVec = new THREE.Vector3();
    this._scratchSegDir = new THREE.Vector3();
    this._scratchTerrainHit = new THREE.Vector3();
    this._scratchHitNormal = new THREE.Vector3(0, 1, 0);

    // Arrow Tip Glow & Divine Sparks Textures
    const textureLoader = new THREE.TextureLoader();
    this.tipGlowTexture = textureLoader.load(ASSET_PATHS.VFX.ARROW_TIP_GLOW, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
    });
    this.sparksTexture = textureLoader.load(ASSET_PATHS.VFX.SPARKS_BURST, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
    });

    // Pre-allocated Mid-Air Divine Split Bursts (Zero heap allocations)
    this.divineBursts = [];
  }

  /**
   * Set template arrow mesh extracted from tribal_basic_bow.glb and initialize object pool
   * @param {THREE.Mesh} templateMesh 
   */
  setTemplate(templateMesh) {
    this.arrowTemplate = templateMesh;
    if (!this.isPoolInitialized) {
      this.initPool();
    }
  }

  /**
   * Pre-allocate arrow meshes, trails, tip glow sprites, and point lights
   */
  initPool() {
    if (!this.arrowTemplate || this.isPoolInitialized) return;

    // 1. Shared Trail Material (subtle silver/white flight trail)
    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0xe8eef5,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    // 2. Shared Tip Glow Material (warm golden divine aura)
    this.tipGlowMaterial = new THREE.SpriteMaterial({
      map: this.tipGlowTexture,
      color: 0xffdf78,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const TRAIL_POINTS = 8;

    // 3. Arrow Mesh Pool (30 arrows)
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const arrowMesh = this.arrowTemplate.clone();
      arrowMesh.name = `PooledArrow_${i}`;
      arrowMesh.visible = false;

      // Subtle persistent golden glow sprite at arrowhead tip
      const tipGlow = new THREE.Sprite(this.tipGlowMaterial.clone());
      tipGlow.position.set(0, -0.34, 0); // arrowhead tip
      tipGlow.scale.set(0.20, 0.20, 0.20);
      tipGlow.visible = false;
      arrowMesh.add(tipGlow);

      this.scene.add(arrowMesh);

      // Dedicated pre-allocated trail line
      const trailPositions = new Float32Array(TRAIL_POINTS * 3);
      const trailGeom = new THREE.BufferGeometry();
      trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
      const trailLine = new THREE.Line(trailGeom, trailMaterial);
      trailLine.visible = false;
      trailLine.frustumCulled = false;
      this.scene.add(trailLine);

      const trailHistory = [];
      for (let p = 0; p < TRAIL_POINTS; p++) {
        trailHistory.push(new THREE.Vector3());
      }

      this.pool.push({
        index: i,
        mesh: arrowMesh,
        tipGlow,
        trailLine,
        trailPositions,
        trailHistory,
        trailPointsCount: 0,
        lightHandle: null,
        velocity: new THREE.Vector3(),
        isStuck: false,
        stuckEnemy: null,
        stuckOffset: null,
        stuckTime: 0,
        birthTime: 0,
        lifetime: 14000,
        active: false,
        isBahuBaanPrimary: false,
        isBahuBaanChild: false,
        splitTimer: 0,
        bahuBaanTargets: null,
        targetEnemy: null,
        isAbilityKill: false
      });
    }

    // 4. Pre-allocate Mid-Air Divine Split Burst Sprites (4 pooled emitters)
    this.divineSplitMaterial = new THREE.SpriteMaterial({
      map: this.sparksTexture,
      color: 0xffea78,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    for (let b = 0; b < 4; b++) {
      const sp = new THREE.Sprite(this.divineSplitMaterial.clone());
      sp.name = `DivineSplitBurst_${b}`;
      sp.visible = false;
      this.scene.add(sp);
      this.divineBursts.push({
        sprite: sp,
        active: false,
        timer: 0,
        duration: 0.28
      });
    }

    this.isPoolInitialized = true;
    console.log(`[ProjectileSystem] Pre-allocated object pool of ${this.POOL_SIZE} arrows and 4 divine burst emitters.`);
  }

  /**
   * Register hittable environment meshes (terrain, trees)
   * @param {THREE.Object3D[]} meshes 
   */
  setEnvironmentMeshes(meshes) {
    this.environmentMeshes = meshes;
  }

  /**
   * Register active enemy hitboxes for swept arrow collision
   * @param {THREE.Object3D[]} hitboxes 
   */
  setEnemyHitboxes(hitboxes) {
    this.enemyHitboxes = hitboxes || [];
  }

  /**
   * Acquire a light from the shared pool
   * If all 4 lights are in use, borrow from the oldest stuck arrow
   */
  acquireLight(parentMesh, arrowItem) {
    return null;
  }

  releaseLight(handle) {
    // No-op: dynamic point lights disabled to prevent Three.js PBR shader recompilation freezes
  }

  /**
   * Cleanly recycle an arrow projectile back to default scene state and pool baseline.
   * Restores original 0.01 scale and ensures scene parenting with zero matrix corruption.
   * @param {object} p 
   */
  recycleArrow(p) {
    if (!p) return;
    p.active = false;
    p.isStuck = false;
    p.stuckEnemy = null;
    p.stuckOffset = null;
    p.stuckTime = 0;
    p.velocity.set(0, 0, 0);
    p.isBahuBaanPrimary = false;
    p.isBahuBaanChild = false;
    p.splitTimer = 0;
    p.bahuBaanTargets = null;
    p.targetEnemy = null;
    p.isAbilityKill = false;

    if (p.mesh) {
      p.mesh.visible = false;
      // Guarantee arrow is parented to main scene and restored to original 0.01 scale
      if (p.mesh.parent !== this.scene) {
        this.scene.add(p.mesh);
      }
      p.mesh.scale.set(0.01, 0.01, 0.01);
    }

    if (p.tipGlow) {
      p.tipGlow.visible = false;
    }

    if (p.trailLine) {
      p.trailLine.visible = false;
    }

    if (p.lightHandle) {
      this.releaseLight(p.lightHandle);
      p.lightHandle = null;
    }
  }

  /**
   * Spawn and launch a physical arrow projectile towards a 3D target point
   * @param {THREE.Vector3} spawnPos 
   * @param {THREE.Vector3} targetOrDirection 
   * @param {number} [speed=48] m/s 
   * @returns {THREE.Object3D}
   */
  spawnArrow(spawnPos, targetOrDirection, speed = 48) {
    if (!this.isPoolInitialized) {
      this.initPool();
    }

    // 1. Find inactive pooled arrow, or recycle oldest stuck arrow
    let p = this.pool.find(item => !item.active);
    if (!p) {
      let oldestStuck = null;
      let oldestTime = Infinity;
      for (const item of this.pool) {
        if (item.isStuck && item.stuckTime < oldestTime) {
          oldestTime = item.stuckTime;
          oldestStuck = item;
        }
      }
      p = oldestStuck || this.pool[0];
      this.recycleArrow(p);
    }

    // Guarantee arrow is parented to main scene and scale is strictly calibrated (0.01)
    if (p.mesh.parent !== this.scene) {
      this.scene.add(p.mesh);
    }
    p.mesh.scale.set(0.01, 0.01, 0.01);

    // 2. Position arrow at launch coordinates
    p.active = true;
    p.isStuck = false;
    p.stuckEnemy = null;
    p.stuckOffset = null;
    p.stuckTime = 0;
    p.birthTime = performance.now();
    p.mesh.position.copy(spawnPos);
    p.mesh.visible = true;

    // 3. Activate golden tip glow for flight (calibrated for authentic flame texture)
    p.tipGlow.visible = true;
    p.tipGlow.scale.set(0.25, 0.16, 0.20);
    p.tipGlow.material.opacity = 0.90;

    // 4. Calculate ballistic trajectory velocity
    const toTarget = targetOrDirection.clone().sub(spawnPos);
    const dist = toTarget.length();

    if (dist > 1.2) {
      const flightTime = Math.max(0.08, dist / speed);
      p.velocity.set(
        toTarget.x / flightTime,
        (toTarget.y + 0.5 * this.gravity * flightTime * flightTime) / flightTime,
        toTarget.z / flightTime
      );
    } else {
      const normDir = targetOrDirection.clone().normalize();
      p.velocity.copy(normDir).multiplyScalar(speed);
    }

    // 5. Align orientation: arrowhead tip is at -Y in arrow geometry
    const forwardDir = p.velocity.clone().normalize();
    p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), forwardDir);

    // 6. Reset trail history to current nock position (at +Y, 0.40m behind origin)
    const nockOffset = new THREE.Vector3(0, 0.40, 0).applyQuaternion(p.mesh.quaternion);
    const nockPos = spawnPos.clone().add(nockOffset);

    for (let k = 0; k < p.trailHistory.length; k++) {
      p.trailHistory[k].copy(nockPos);
      p.trailPositions[k * 3] = nockPos.x;
      p.trailPositions[k * 3 + 1] = nockPos.y;
      p.trailPositions[k * 3 + 2] = nockPos.z;
    }
    p.trailLine.geometry.attributes.position.needsUpdate = true;
    p.trailLine.visible = true;
    p.trailPointsCount = 1;

    return p.mesh;
  }

  /**
   * Milestone 6: Spawn Divya Bahu-Baan projectile which splits in mid-air
   * into multiple divine arrows targeting distinct enemies.
   * @param {THREE.Vector3} spawnPos 
   * @param {THREE.Vector3} targetOrDirection 
   * @param {object[]} targets - Array of eligible living EnemyCharacter instances (up to 4)
   * @returns {THREE.Object3D}
   */
  spawnBahuBaanArrow(spawnPos, targetOrDirection, targets = []) {
    if (!this.isPoolInitialized) {
      this.initPool();
    }

    const arrowMesh = this.spawnArrow(spawnPos, targetOrDirection, 52);
    const p = this.pool.find(item => item.mesh === arrowMesh);
    if (p) {
      p.isBahuBaanPrimary = true;
      p.bahuBaanTargets = targets;
      p.splitTimer = 0.22; // Splits in mid-air after ~11.5 meters flight
      p.isAbilityKill = true;

      if (p.tipGlow) {
        p.tipGlow.scale.set(0.40, 0.28, 0.35);
        p.tipGlow.material.opacity = 1.0;
        p.tipGlow.material.color.setHex(0xffea60);
      }
    }
    return arrowMesh;
  }

  /**
   * Execute the mid-air transformation and arrow multiplication
   * @param {object} primaryP 
   */
  triggerBahuBaanSplit(primaryP) {
    const splitPos = primaryP.mesh.position.clone();
    const splitVel = primaryP.velocity.clone();
    const targets = primaryP.bahuBaanTargets || [];

    // 1. Trigger brilliant golden divine burst at split point
    this.spawnDivineSplitBurst(splitPos);

    // 2. Recycle primary projectile
    this.recycleArrow(primaryP);

    // 3. Fallback targets if none in range
    const effectiveTargets = targets.length > 0 ? targets : [null, null, null];

    // 4. Spawn child divine arrows fanning out towards targets
    effectiveTargets.forEach((target, idx) => {
      let childP = this.pool.find(item => !item.active);
      if (!childP) {
        childP = this.pool[0];
        this.recycleArrow(childP);
      }

      childP.active = true;
      childP.isStuck = false;
      childP.stuckEnemy = null;
      childP.stuckOffset = null;
      childP.stuckTime = 0;
      childP.birthTime = performance.now();
      childP.isBahuBaanChild = true;
      childP.targetEnemy = target;
      childP.isAbilityKill = true;

      if (childP.mesh.parent !== this.scene) {
        this.scene.add(childP.mesh);
      }
      childP.mesh.scale.set(0.01, 0.01, 0.01);

      // Arc spread offset from split origin
      const angle = (idx / effectiveTargets.length) * Math.PI * 2;
      const offset = new THREE.Vector3(Math.cos(angle) * 0.35, Math.sin(angle) * 0.25, 0);
      childP.mesh.position.copy(splitPos).add(offset);
      childP.mesh.visible = true;

      // Divine golden tip glow
      if (childP.tipGlow) {
        childP.tipGlow.visible = true;
        childP.tipGlow.scale.set(0.35, 0.22, 0.28);
        childP.tipGlow.material.opacity = 0.95;
        childP.tipGlow.material.color.setHex(0xffea60);
      }

      // Calculate trajectory directed towards target's torso
      let targetPos = null;
      if (target && target.root) {
        targetPos = target.root.position.clone().add(new THREE.Vector3(0, 1.35, 0));
      } else {
        targetPos = splitPos.clone().add(splitVel.clone().normalize().multiplyScalar(40));
        targetPos.x += (idx - 1) * 6.0;
      }

      const toTarget = targetPos.clone().sub(childP.mesh.position);
      const dist = toTarget.length();
      const speed = 52.0;
      const flightTime = Math.max(0.12, dist / speed);

      childP.velocity.set(
        toTarget.x / flightTime,
        (toTarget.y + 0.5 * this.gravity * flightTime * flightTime) / flightTime,
        toTarget.z / flightTime
      );

      const forwardDir = childP.velocity.clone().normalize();
      childP.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), forwardDir);

      // Reset trail history
      const nockOffset = new THREE.Vector3(0, 0.40, 0).applyQuaternion(childP.mesh.quaternion);
      const nockPos = childP.mesh.position.clone().add(nockOffset);
      for (let k = 0; k < childP.trailHistory.length; k++) {
        childP.trailHistory[k].copy(nockPos);
        childP.trailPositions[k * 3] = nockPos.x;
        childP.trailPositions[k * 3 + 1] = nockPos.y;
        childP.trailPositions[k * 3 + 2] = nockPos.z;
      }
      childP.trailLine.geometry.attributes.position.needsUpdate = true;
      childP.trailLine.visible = true;
      childP.trailPointsCount = 1;
    });

    console.log(`[ProjectileSystem] Divya Bahu-Baan split into ${effectiveTargets.length} divine arrows.`);
  }

  /**
   * Spawn a camera-facing brilliant golden spark burst at split location
   * @param {THREE.Vector3} pos 
   */
  spawnDivineSplitBurst(pos) {
    const burst = this.divineBursts.find(b => !b.active) || this.divineBursts[0];
    if (!burst) return;

    burst.active = true;
    burst.timer = 0;
    burst.sprite.position.copy(pos);
    burst.sprite.scale.set(0.45, 0.45, 0.45);
    burst.sprite.material.opacity = 1.0;
    burst.sprite.visible = true;
  }

  updateDivineBursts(delta) {
    for (let i = 0; i < this.divineBursts.length; i++) {
      const b = this.divineBursts[i];
      if (!b.active) continue;

      b.timer += delta;
      const prog = b.timer / b.duration;
      if (prog >= 1.0) {
        b.active = false;
        b.sprite.visible = false;
        continue;
      }

      // Fast outward celestial expansion & smooth fade
      const scale = 0.45 + Math.sin(prog * Math.PI * 0.5) * 2.2;
      b.sprite.scale.set(scale, scale, scale);
      b.sprite.material.opacity = Math.max(0, 1.0 - prog * prog);
    }
  }

  /**
   * Return array of active projectiles for inspection/tests
   */
  get projectiles() {
    return this.pool.filter(item => item.active);
  }

  update(delta) {
    const now = performance.now();

    // Update impact particles & transparent bursts
    if (this.impactFX) {
      this.impactFX.update(delta);
    }

    // Update mid-air divine split burst animations
    this.updateDivineBursts(delta);

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      // Milestone 6: Mid-air Divya Bahu-Baan Transformation & Multiplication
      if (p.isBahuBaanPrimary) {
        p.splitTimer -= delta;
        if (p.splitTimer <= 0) {
          this.triggerBahuBaanSplit(p);
          continue;
        }
      }

      // Handle embedded (stuck) arrow behavior & natural fading
      if (p.isStuck) {
        // If arrow was embedded into an enemy, track enemy translation while alive/sinking
        if (p.stuckEnemy && p.stuckOffset) {
          if (p.stuckEnemy.state !== 'DESPAWNED' && p.stuckEnemy.root) {
            p.mesh.position.copy(p.stuckEnemy.root.position).add(p.stuckOffset);
          } else {
            // Enemy despawned / removed: recycle arrow cleanly
            this.recycleArrow(p);
            continue;
          }
        }

        const elapsedSinceImpact = now - p.stuckTime;
        const remaining = p.lifetime - elapsedSinceImpact;

        if (remaining <= 0) {
          // Arrow lifetime expired: recycle cleanly
          this.recycleArrow(p);
        } else {
          // Subtle atmospheric fading in the last 3 seconds
          if (remaining < 3000) {
            const fadeRatio = Math.max(0, remaining / 3000);
            p.tipGlow.material.opacity = 0.80 * fadeRatio;
            if (p.lightHandle) {
              p.lightHandle.light.intensity = 0.85 * fadeRatio;
            }
          } else {
            // Keep subtle golden tip glow active on embedded arrow
            p.tipGlow.visible = true;
            p.tipGlow.material.opacity = 0.80;
            if (p.lightHandle) {
              p.lightHandle.light.intensity = 0.85;
            }
          }
        }
        continue;
      }

      // In-flight physics simulation (zero allocations)
      this._scratchCurrentPos.copy(p.mesh.position);
      this._scratchNextPos.copy(this._scratchCurrentPos).addScaledVector(p.velocity, delta);

      // Swept continuous collision detection along segment from currentPos to nextPos
      this._scratchSegVec.copy(this._scratchNextPos).sub(this._scratchCurrentPos);
      const segDist = this._scratchSegVec.length();

      let earliestHit = null;
      let earliestType = null; // 'enemy' | 'environment' | 'terrain'

      if (segDist > 0.0001) {
        this._scratchSegDir.copy(this._scratchSegVec).multiplyScalar(1 / segDist);
        this.raycaster.set(this._scratchCurrentPos, this._scratchSegDir);
        this.raycaster.far = segDist;

        // 1. Raycast against registered living enemy hitboxes
        if (this.enemyHitboxes && this.enemyHitboxes.length > 0) {
          const enemyHits = this.raycaster.intersectObjects(this.enemyHitboxes, false);
          for (const hit of enemyHits) {
            const enemy = hit.object?.userData?.enemy;
            if (enemy && !enemy.isDead) {
              if (!earliestHit || hit.distance < earliestHit.distance) {
                earliestHit = hit;
                earliestType = 'enemy';
              }
              break;
            }
          }
        }

        // 2. Raycast against environment meshes (trees, rocks, trunks)
        if (this.environmentMeshes && this.environmentMeshes.length > 0) {
          const envHits = this.raycaster.intersectObjects(this.environmentMeshes, true);
          if (envHits.length > 0) {
            const hit = envHits[0];
            if (!earliestHit || hit.distance < earliestHit.distance) {
              earliestHit = hit;
              earliestType = 'environment';
            }
          }
        }

        // 3. Raycast / query against Rapier3D continuous terrain ground trimesh
        if (this.physics && this.physics.isInitialized) {
          const terrainElevation = this.physics.getTerrainElevation(this._scratchNextPos.x, this._scratchNextPos.z);
          if (terrainElevation && this._scratchNextPos.y <= terrainElevation.y + 0.12) {
            this._scratchTerrainHit.set(this._scratchNextPos.x, terrainElevation.y, this._scratchNextPos.z);
            const terrainDist = this._scratchCurrentPos.distanceTo(this._scratchTerrainHit);
            if (!earliestHit || terrainDist < earliestHit.distance) {
              earliestHit = {
                point: this._scratchTerrainHit.clone(),
                distance: terrainDist,
                face: { normal: new THREE.Vector3(0, 1, 0) },
                object: { name: 'terrain_ground' },
                isTerrain: true
              };
              earliestType = 'terrain';
            }
          }
        }
      }

      if (earliestHit) {
        console.log(`[ProjectileSystem] Arrow impact registered: type=${earliestType}, dist=${earliestHit.distance?.toFixed(2)}m, point=(${earliestHit.point.x.toFixed(2)}, ${earliestHit.point.y.toFixed(2)}, ${earliestHit.point.z.toFixed(2)}), obj=${earliestHit.object?.name}`);
        if (earliestType === 'enemy') {
          const hitEnemyInstance = earliestHit.object?.userData?.enemy;
          if (hitEnemyInstance && !hitEnemyInstance.isDead) {
            // Successful lethal arrow hit against Rakshasa enemy
            p.isStuck = true;
            p.stuckTime = now;
            p.stuckEnemy = hitEnemyInstance;
            p.stuckOffset = earliestHit.point.clone().sub(hitEnemyInstance.root.position);
            p.velocity.set(0, 0, 0);
            p.mesh.position.copy(earliestHit.point);
            p.trailLine.visible = false;
            p.tipGlow.visible = true;
            p.tipGlow.material.opacity = 0.85;

            // Attenuate dynamic light
            if (p.lightHandle) {
              p.lightHandle.light.intensity = 0.85;
              p.lightHandle.light.distance = 2.4;
            }

            const hitNormal = new THREE.Vector3(0, 1, 0);
            if (earliestHit.face && earliestHit.face.normal) {
              hitNormal.copy(earliestHit.face.normal).applyQuaternion(earliestHit.object.quaternion);
            }

            // Register 100 lethal damage and notify enemy (with ability-kill tracking to prevent recursive energy)
            hitEnemyInstance.takeDamage(100, earliestHit.point, this._scratchSegDir, !!p.isAbilityKill);
            hitEnemyInstance.attachArrow(p.mesh, earliestHit.point);

            // Burst VFX on enemy impact
            if (this.impactFX) {
              this.impactFX.spawnImpact(earliestHit.point, hitNormal, 'wood');
            }
          }
        } else {
          // Impact occurred against environment or terrain: embed arrow firmly
          p.isStuck = true;
          p.stuckTime = now;
          p.velocity.set(0, 0, 0);
          p.mesh.position.copy(earliestHit.point);

          // Hide flight trail line on impact
          p.trailLine.visible = false;

          // Preserve warm subtle golden glow at arrow tip after impact
          p.tipGlow.visible = true;
          p.tipGlow.scale.set(0.16, 0.16, 0.16);
          p.tipGlow.material.opacity = 0.80;

          // Attenuate dynamic light to gentle atmospheric level
          if (p.lightHandle) {
            p.lightHandle.light.intensity = 0.85;
            p.lightHandle.light.distance = 2.4;
          }

          const hitNormal = new THREE.Vector3(0, 1, 0);
          if (earliestHit.face && earliestHit.face.normal) {
            hitNormal.copy(earliestHit.face.normal).applyQuaternion(earliestHit.object.quaternion);
          }

          // Classify hit surface type
          const hitName = (earliestHit.object?.name || '').toLowerCase();
          const hitMaterialType = (earliestType === 'terrain' || hitName.includes('obj1') || hitName.includes('floor') || hitName.includes('terrain') || hitName.includes('ground')) ? 'soil' : 'wood';

          // Trigger real transparent impact VFX (wood burst / soil dust)
          if (this.impactFX) {
            this.impactFX.spawnImpact(earliestHit.point, hitNormal, hitMaterialType);
          }
        }
      } else {
        // In-flight trajectory update
        p.velocity.y -= this.gravity * delta;
        p.mesh.position.copy(this._scratchNextPos);

        // Align arrow along flight velocity with tip (-Y) forward
        if (p.velocity.lengthSq() > 0.1) {
          const forward = p.velocity.clone().normalize();
          p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), forward);
        }

        // Update thin silver air trail behind flying arrow
        const nockOffset = new THREE.Vector3(0, 0.40, 0).applyQuaternion(p.mesh.quaternion);
        const currentNockPos = this._scratchNextPos.clone().add(nockOffset);

        // Shift trail history points backward
        for (let k = p.trailHistory.length - 1; k > 0; k--) {
          p.trailHistory[k].copy(p.trailHistory[k - 1]);
        }
        p.trailHistory[0].copy(currentNockPos);

        // Update buffer geometry positions
        for (let k = 0; k < p.trailHistory.length; k++) {
          p.trailPositions[k * 3] = p.trailHistory[k].x;
          p.trailPositions[k * 3 + 1] = p.trailHistory[k].y;
          p.trailPositions[k * 3 + 2] = p.trailHistory[k].z;
        }
        p.trailLine.geometry.attributes.position.needsUpdate = true;
        p.trailLine.visible = true;

        // Out-of-bounds safety check
        if (p.mesh.position.y < -30 || Math.hypot(p.mesh.position.x, p.mesh.position.z) > 180) {
          p.active = false;
          p.mesh.visible = false;
          p.tipGlow.visible = false;
          p.trailLine.visible = false;
          if (p.lightHandle) {
            this.releaseLight(p.lightHandle);
            p.lightHandle = null;
          }
        }
      }
    }
  }

  dispose() {
    this.pool.forEach(p => {
      this.scene.remove(p.mesh);
      this.scene.remove(p.trailLine);
      p.trailLine.geometry?.dispose();
      p.tipGlow.material.dispose();
    });
    this.pool = [];

    this.lightPool.forEach(l => {
      this.scene.remove(l.light);
      l.light.dispose();
    });
    this.lightPool = [];

    if (this.impactFX) {
      this.impactFX.dispose();
    }
    this.divineBursts.forEach(b => {
      this.scene.remove(b.sprite);
    });
    this.divineBursts = [];
    this.divineSplitMaterial?.dispose();
    this.sparksTexture?.dispose();
    this.tipGlowTexture?.dispose();
    this.tipGlowMaterial?.dispose();
  }
}
