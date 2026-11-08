import * as THREE from 'three';

export const ENEMY_STATE = {
  SPAWNING: 'SPAWNING',
  IDLE: 'IDLE',
  APPROACH: 'APPROACH',
  COMBAT_RANGE: 'COMBAT_RANGE',
  HIT: 'HIT',
  DEATH: 'DEATH',
  DESPAWNED: 'DESPAWNED'
};

/**
 * Represents an individual Rakshasa (Aasura) enemy warrior instance
 * with an independent animation state machine, lightweight combat hitbox,
 * terrain elevation tracking, and LOD management.
 */
export class EnemyCharacter {
  /**
   * @param {object} instanceData - Object returned by EnemyOptimizer.createClonedInstance()
   * @param {import('../physics/PhysicsWorld.js').PhysicsWorld} physics
   */
  constructor(instanceData, physics) {
    this.root = instanceData.root;
    this.skinnedMesh = instanceData.skinnedMesh;
    this.skeleton = instanceData.skeleton;
    this.animations = instanceData.animations || [];
    this.lods = instanceData.lods; // { lod0Geom, lod1Geom, lod2Geom }
    this.physics = physics;

    // Combat Stats
    this.maxHealth = 100;
    this.health = 100;
    this.isDead = false;
    this.deathTimer = 0;
    this.deathDuration = 7.0; // 5s corpse lie + 2s dissolve

    // AI & Locomotion State
    this.state = ENEMY_STATE.SPAWNING;
    this.stateTimer = 0;
    this.target = null; // Shri Ram position reference (THREE.Object3D or Vector3)
    this.walkSpeed = 0.75; // Milestone 5.2: Slow, deliberate approach pacing (0.65-0.85 m/s)
    this.currentSpeed = 0;
    this.combatDistance = 3.0; // Distance to enter sword guard / melee range
    this.resumeApproachDistance = 4.5;
    this.attackCooldownTimer = 1.5;
    this.attackInterval = 3.2; // Attacks every ~3.2 seconds when in melee range

    // Current LOD Index (0: LOD0, 1: LOD1, 2: LOD2)
    this.currentLOD = 0;

    // Independent Animation Mixer & Actions
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = new Map();
    this.currentAction = null;
    this.initAnimations();

    // Lightweight Combat Hitbox (Capsule proxy for zero-overhead raycast hits)
    this.hitbox = null;
    this.initHitbox();

    // Stuck arrows collection
    this.stuckArrows = [];

    // Callbacks
    this.onDefeatedCallback = null;
    this.onDeathCallback = null;
  }

  /**
   * Catalog and prepare all embedded Aasura animation actions
   */
  initAnimations() {
    this.animations.forEach((clip) => {
      const action = this.mixer.clipAction(clip);
      this.actions.set(clip.name, action);
    });

    // Default starting posture: Sword idle (guard) or Idle
    const spawnAction = this.actions.get('Sword idle (guard)') || this.actions.get('Idle');
    if (spawnAction) {
      spawnAction.play();
      this.currentAction = spawnAction;
    }
  }

  /**
   * Create a lightweight, high-performance combat hitbox.
   * Testing a 64-triangle capsule takes < 0.005 ms compared to 151 ms for a 207k SkinnedMesh.
   * Milestone 5.2: Scaled by 100x to counter root FBX scale (0.01), positioned at torso (1.30m world elevation),
   * visible: true with transparent opacity: 0.0 so Three.js Raycaster reliably tests it.
   */
  initHitbox() {
    // Aasura is 2.56m tall. Capsule radius 0.55m, length 1.5m covers torso, head, and limbs (total height 2.6m).
    const geom = new THREE.CapsuleGeometry(0.55, 1.5, 8, 16);
    const isDebug = typeof window !== 'undefined' && window.__debugHitboxes;
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff0044,
      wireframe: true,
      transparent: true,
      opacity: isDebug ? 0.6 : 0.0,
      depthWrite: false
    });

    this.hitbox = new THREE.Mesh(geom, mat);
    this.hitbox.name = `Aasura_Combat_Hitbox_${this.root.id}`;
    // In local FBX centimeters, position 130 cm maps to 1.30m world height
    this.hitbox.position.set(0, 130, 0);
    // Counter root.scale = 0.01 so world scale of hitbox is exactly 1.0
    this.hitbox.scale.set(100, 100, 100);
    this.hitbox.visible = true; // Essential: Three.js raycaster ignores objects if visible is false
    this.hitbox.userData = {
      isEnemy: true,
      isHitbox: true,
      enemy: this
    };

    this.root.add(this.hitbox);
  }

  /**
   * Smoothly crossfade to a target animation clip
   * @param {string} clipName 
   * @param {number} [duration=0.25] 
   * @param {number} [loop=THREE.LoopRepeat] 
   * @param {boolean} [clamp=false] 
   */
  playAction(clipName, duration = 0.25, loop = THREE.LoopRepeat, clamp = false) {
    const nextAction = this.actions.get(clipName);
    if (!nextAction) {
      return false;
    }

    if (this.currentAction === nextAction) {
      return true;
    }

    nextAction.reset();
    nextAction.setLoop(loop);
    nextAction.clampWhenFinished = clamp;
    nextAction.fadeIn(duration);
    nextAction.play();

    if (this.currentAction) {
      this.currentAction.fadeOut(duration);
    }

    this.currentAction = nextAction;
    return true;
  }

  /**
   * Spawn enemy at specific coordinates with a smooth fog emergence
   * @param {number} x 
   * @param {number} z 
   * @param {THREE.Object3D} targetPlayer 
   */
  spawn(x, z, targetPlayer) {
    this.target = targetPlayer;
    this.isDead = false;
    this.health = this.maxHealth;
    this.state = ENEMY_STATE.SPAWNING;
    this.stateTimer = 0;

    // Terrain ground elevation query
    let groundY = 0;
    if (this.physics && this.physics.isInitialized) {
      const elev = this.physics.getTerrainElevation(x, z);
      if (elev) groundY = elev.y;
    }

    this.root.position.set(x, groundY, z);

    // Face towards player
    if (this.target) {
      const targetPos = this.target.position || this.target;
      const dx = targetPos.x - x;
      const dz = targetPos.z - z;
      this.root.rotation.set(0, Math.atan2(dx, dz), 0);
    }

    // Play Sword idle guard during emergence
    this.playAction('Sword idle (guard)', 0.3);
  }

  /**
   * Main per-frame update loop
   * @param {number} delta 
   * @param {THREE.Camera} camera 
   * @param {EnemyCharacter[]} [otherEnemies=[]]
   */
  update(delta, camera, otherEnemies = []) {
    if (this.state === ENEMY_STATE.DESPAWNED) return;

    // 1. Advance skeletal animation mixer
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // 2. Distance-based LOD switching
    if (camera && this.lods) {
      this.updateLOD(camera);
    }

    // 3. AI State Machine execution
    this.stateTimer += delta;

    switch (this.state) {
      case ENEMY_STATE.SPAWNING:
        this.updateSpawning(delta);
        break;

      case ENEMY_STATE.IDLE:
        this.updateIdle(delta);
        break;

      case ENEMY_STATE.APPROACH:
        this.updateApproach(delta, otherEnemies);
        break;

      case ENEMY_STATE.COMBAT_RANGE:
        this.updateCombatRange(delta);
        break;

      case ENEMY_STATE.HIT:
        this.updateHit(delta);
        break;

      case ENEMY_STATE.DEATH:
        this.updateDeath(delta);
        break;
    }

    // Always keep world matrices synced for swept projectile detection
    this.root.updateMatrixWorld(true);
  }

  /**
   * Distance-based LOD switching between LOD0, LOD1, and LOD2 with hysteresis band
   * to eliminate geometry buffer thrashing when enemies move around threshold boundaries.
   */
  updateLOD(camera) {
    const dist = this.root.position.distanceTo(camera.position);

    let targetLOD = this.currentLOD;

    // Hysteresis thresholds:
    // LOD 0 (close-up < 14m, exit at 16m)
    // LOD 1 (medium 14m - 28m, enter at 16m, exit to LOD2 at 30m)
    // LOD 2 (distant > 28m, enter at 30m, exit to LOD1 at 26m)
    if (this.currentLOD === 0) {
      if (dist > 30.0) targetLOD = 2;
      else if (dist > 16.0) targetLOD = 1;
    } else if (this.currentLOD === 1) {
      if (dist < 13.5) targetLOD = 0;
      else if (dist > 30.0) targetLOD = 2;
    } else { // currentLOD === 2
      if (dist < 13.5) targetLOD = 0;
      else if (dist < 26.5) targetLOD = 1;
    }

    if (this.currentLOD !== targetLOD && this.skinnedMesh) {
      this.currentLOD = targetLOD;
      if (targetLOD === 0 && this.lods.lod0Geom) {
        this.skinnedMesh.geometry = this.lods.lod0Geom;
      } else if (targetLOD === 1 && this.lods.lod1Geom) {
        this.skinnedMesh.geometry = this.lods.lod1Geom;
      } else if (targetLOD === 2 && this.lods.lod2Geom) {
        this.skinnedMesh.geometry = this.lods.lod2Geom;
      }
    }
  }

  updateSpawning(delta) {
    // Emerge from fog over 1.8 seconds, then begin walking towards Shri Ram
    if (this.stateTimer >= 1.8) {
      this.state = ENEMY_STATE.APPROACH;
      this.stateTimer = 0;
      this.playAction('Walk', 0.3);
    }
  }

  updateIdle(delta) {
    if (this.stateTimer >= 1.0) {
      this.state = ENEMY_STATE.APPROACH;
      this.stateTimer = 0;
      this.playAction('Walk', 0.3);
    }
  }

  updateApproach(delta, otherEnemies = []) {
    if (!this.target) return;
    const targetPos = this.target.position || this.target;

    const dx = targetPos.x - this.root.position.x;
    const dz = targetPos.z - this.root.position.z;
    const dist = Math.hypot(dx, dz);

    // Transition to combat range if within melee reach
    if (dist <= this.combatDistance) {
      this.state = ENEMY_STATE.COMBAT_RANGE;
      this.stateTimer = 0;
      this.attackCooldownTimer = 1.0;
      this.playAction('Sword idle (guard)', 0.3);
      return;
    }

    // Steady, measured approach pacing at 0.75 m/s with Walk animation (no abrupt running)
    if (this.currentAction?.getClip()?.name !== 'Walk') {
      this.playAction('Walk', 0.3);
    }

    // PART B: Lightweight runtime separation steering to prevent overlapping with other warriors
    let sepX = 0;
    let sepZ = 0;
    if (otherEnemies && otherEnemies.length > 0) {
      const minSeparation = 2.4; // 2.4m personal buffer
      for (const other of otherEnemies) {
        if (other === this || other.isDead) continue;
        const ox = this.root.position.x - other.root.position.x;
        const oz = this.root.position.z - other.root.position.z;
        const dSq = ox * ox + oz * oz;
        if (dSq > 0.0001 && dSq < minSeparation * minSeparation) {
          const d = Math.sqrt(dSq);
          const push = (minSeparation - d) / minSeparation;
          sepX += (ox / d) * push;
          sepZ += (oz / d) * push;
        }
      }
    }

    // Combined movement vector: to-target heading + soft neighbor repulsion
    let moveDirX = dist > 0.001 ? (dx / dist) : 0;
    let moveDirZ = dist > 0.001 ? (dz / dist) : 0;

    moveDirX += sepX * 0.75;
    moveDirZ += sepZ * 0.75;

    const moveMag = Math.hypot(moveDirX, moveDirZ);
    if (moveMag > 0.001) {
      moveDirX /= moveMag;
      moveDirZ /= moveMag;
    }

    // Smooth rotation towards combined movement direction
    const targetAngle = Math.atan2(moveDirX, moveDirZ);
    let diff = targetAngle - this.root.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.root.rotation.y += diff * Math.min(1.0, delta * 4.5);

    // Forward movement along facing heading at configured walk speed
    const moveDist = this.walkSpeed * delta;
    const forwardX = Math.sin(this.root.rotation.y) * moveDist;
    const forwardZ = Math.cos(this.root.rotation.y) * moveDist;

    this.root.position.x += forwardX;
    this.root.position.z += forwardZ;

    // Physical ground snapping via Rapier trimesh elevation
    if (this.physics && this.physics.isInitialized) {
      const groundElev = this.physics.getTerrainElevation(this.root.position.x, this.root.position.z);
      if (groundElev) {
        this.root.position.y = groundElev.y;
      }
    }
  }

  updateCombatRange(delta) {
    if (!this.target) return;
    const targetPos = this.target.position || this.target;

    const dx = targetPos.x - this.root.position.x;
    const dz = targetPos.z - this.root.position.z;
    const dist = Math.hypot(dx, dz);

    // If player backs away out of range, resume approach
    if (dist > this.resumeApproachDistance) {
      this.state = ENEMY_STATE.APPROACH;
      this.stateTimer = 0;
      this.playAction('Walk', 0.25);
      return;
    }

    // Always maintain sword guard posture facing player
    const targetAngle = Math.atan2(dx, dz);
    let diff = targetAngle - this.root.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.root.rotation.y += diff * Math.min(1.0, delta * 8.0);

    // Trigger visual sword slash attack on cooldown interval
    this.attackCooldownTimer += delta;
    if (this.attackCooldownTimer >= this.attackInterval) {
      this.attackCooldownTimer = 0;
      this.playAction('Sword slash', 0.15, THREE.LoopOnce);

      // Return to guard stance after slash completes (clip duration 1.0s)
      setTimeout(() => {
        if (this.state === ENEMY_STATE.COMBAT_RANGE && !this.isDead) {
          this.playAction('Sword idle (guard)', 0.25);
        }
      }, 950);
    }
  }

  updateHit(delta) {
    if (this.stateTimer >= 0.8) {
      if (!this.isDead) {
        this.state = ENEMY_STATE.COMBAT_RANGE;
        this.stateTimer = 0;
        this.playAction('Sword idle (guard)', 0.25);
      }
    }
  }

  updateDeath(delta) {
    this.deathTimer += delta;

    // Final 2 seconds: gentle sink into ground before disposal
    if (this.deathTimer >= this.deathDuration - 2.0) {
      this.root.position.y -= delta * 0.45;
    }

    if (this.deathTimer >= this.deathDuration) {
      this.state = ENEMY_STATE.DESPAWNED;
      this.dispose();
      if (this.onDeathCallback) {
        this.onDeathCallback(this);
      }
    }
  }

  /**
   * Handle incoming projectile damage
   * @param {number} amount 
   * @param {THREE.Vector3} hitPoint 
   * @param {THREE.Vector3} hitDirection 
   * @param {boolean} [isAbilityKill=false]
   */
  takeDamage(amount, hitPoint, hitDirection, isAbilityKill = false) {
    if (this.isDead) return false;

    this.health = Math.max(0, this.health - amount);

    if (this.health <= 0) {
      this.triggerDeath(hitPoint, hitDirection, isAbilityKill);
    } else {
      this.state = ENEMY_STATE.HIT;
      this.stateTimer = 0;
      this.playAction('Hit reaction', 0.1, THREE.LoopOnce);
    }

    return true;
  }

  /**
   * Execute lethal death sequence with appropriate directional knockdown
   * @param {THREE.Vector3} hitPoint 
   * @param {THREE.Vector3} hitDirection 
   * @param {boolean} [isAbilityKill=false]
   */
  triggerDeath(hitPoint, hitDirection, isAbilityKill = false) {
    this.isDead = true;
    this.state = ENEMY_STATE.DEATH;
    this.deathTimer = 0;

    // Immediately disable combat hitbox so further arrows pass through or stick in terrain
    if (this.hitbox) {
      this.hitbox.userData.isEnemy = false;
      this.hitbox.visible = false;
    }

    // Determine front vs back impact based on enemy facing direction
    const forward = new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    const dot = hitDirection ? hitDirection.dot(forward) : 1;

    // If arrow was moving opposite to enemy facing, it hit from front -> fall backward
    // If arrow was moving same as enemy facing, it hit from back -> fall forward
    const deathClip = dot < 0 ? 'Death (fall backward)' : 'Death (fall forward)';
    this.playAction(deathClip, 0.2, THREE.LoopOnce, true);

    console.log(`[EnemyCharacter] Aasura defeated with ${deathClip}. Health: 0/${this.maxHealth}. isAbilityKill: ${isAbilityKill}`);

    // Milestone 5.2 & 6: Promptly notify defeat callback on lethal impact
    if (typeof this.onDefeatedCallback === 'function') {
      this.onDefeatedCallback(this, isAbilityKill);
    }
  }

  /**
   * Register stuck arrow reference on enemy hit
   * (Maintains scene parenting and original scale; ProjectileSystem tracks world translation)
   * @param {THREE.Object3D} arrowMesh 
   * @param {THREE.Vector3} worldHitPoint 
   */
  attachArrow(arrowMesh, worldHitPoint) {
    if (!arrowMesh) return;
    this.stuckArrows.push(arrowMesh);
  }

  dispose() {
    if (this.hitbox) {
      this.hitbox.geometry?.dispose();
      this.hitbox.material?.dispose();
      this.root.remove(this.hitbox);
      this.hitbox = null;
    }

    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }

    this.stuckArrows = [];
  }
}

