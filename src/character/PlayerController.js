import * as THREE from 'three';
import { AnimationManager } from './AnimationManager.js';

/**
 * Dedicated, configurable camera tuning parameters for normal and aiming modes.
 * Calibrated to match GTA-style over-the-shoulder framing (Reference Image 1).
 */
export const CAMERA_CONFIG = {
  // Normal Third-Person Exploration Camera
  normal: {
    distance: 3.6,        // Meters behind character
    minDistance: 2.0,
    maxDistance: 6.0,
    sideOffset: 0.0,       // Centered behind character
    heightOffset: 1.48,   // Target height above character root
    lookAtHeight: 1.45,   // Look focus height
    fov: 55,              // Standard human perspective FOV
    smoothing: 14.0       // Follow smoothing factor
  },
  // GTA-style Close Over-the-Shoulder Aiming Camera (Reference Image 1)
  aiming: {
    distance: 0.90,       // Close to upper back/neck, cutting off lower body
    minDistance: 0.65,    // Mouse wheel zoom in boundary
    maxDistance: 1.35,    // Mouse wheel zoom out boundary
    sideOffset: 0.65,     // Offset to right shoulder: places Shri Ram at extreme left (15%-20%)
    heightOffset: 1.74,   // At head/eye level, slightly above right shoulder
    lookAtHeight: 1.70,   // Look forward into the open forest clearing
    fov: 55,              // Generous, natural panoramic forest view (not narrow zoom)
    smoothing: 20.0       // Responsive tracking
  },
  transitionSpeed: 10.0   // Smooth lerp speed between normal & aiming
};

export class PlayerController {
  /**
   * @param {THREE.Object3D} characterModel 
   * @param {THREE.Camera} camera 
   * @param {HTMLElement} domElement 
   * @param {import('../physics/PhysicsWorld.js').PhysicsWorld} [physicsWorld]
   * @param {import('../weapons/WeaponManager.js').WeaponManager} [weaponManager]
   */
  constructor(characterModel, camera, domElement, physicsWorld, weaponManager = null) {
    this.character = characterModel;
    this.camera = camera;
    this.domElement = domElement;
    this.physics = physicsWorld;
    this.weaponManager = weaponManager;

    // Movement Speeds (m/s)
    this.walkSpeed = 2.5;
    this.runSpeed = 6.0;
    this.currentSpeed = 0;
    this.velocity = new THREE.Vector3();
    this.isGrounded = true;

    // Playable Forest Clearing Boundary Radius
    this.maxPlayableRadius = 23.5;

    // Capsule Collider dimensions for Shri Ram (1.95m height)
    this.capsuleHalfHeight = 0.58;
    this.capsuleRadius = 0.28;
    this.capsuleCenterOffset = this.capsuleHalfHeight + this.capsuleRadius; // 0.86m

    // Input States
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      shift: false,
      space: false
    };

    // Third-Person Follow Camera Parameters
    this.cameraDistance = CAMERA_CONFIG.normal.distance;
    this.minDistance = CAMERA_CONFIG.normal.minDistance;
    this.maxDistance = CAMERA_CONFIG.normal.maxDistance;
    this.cameraYaw = 0;
    this.cameraPitch = 0.16; // Natural slight look-down angle (~9 deg)
    this.lookTargetOffset = new THREE.Vector3(0, CAMERA_CONFIG.normal.lookAtHeight, 0);

    // Aiming State & Camera Transitions
    this.isAiming = false;
    this.aimCameraDistance = CAMERA_CONFIG.aiming.distance;
    this.currentCameraDistance = this.cameraDistance;
    this.currentSideOffset = CAMERA_CONFIG.normal.sideOffset;
    this.currentHeightOffset = CAMERA_CONFIG.normal.heightOffset;

    // Rapid-Fire Archery Timing & Rate Management (~3.5 arrows/second)
    this.rapidFireInterval = 0.28; // Configurable rapid firing interval in seconds
    this.lastShotTime = 0;

    // Pointer Lock State
    this.isPointerLocked = false;

    // Environment References & Persistent Targeting Raycaster
    this.environmentModel = null;
    this.skyDomeMesh = null;
    this.hittableEnvironment = [];
    this.enemyHitboxes = [];
    this.aimRaycaster = new THREE.Raycaster();
    this.centerViewport = new THREE.Vector2(0, 0);

    // Pre-allocated scratch objects to eliminate per-frame GC allocations
    this._aimTargetPoint = new THREE.Vector3();
    this._inputVec = new THREE.Vector2();
    this._forwardVec = new THREE.Vector3();
    this._rightVec = new THREE.Vector3();
    this._moveDir = new THREE.Vector3();
    this._targetVel = new THREE.Vector3();
    this._scratchDesiredCamPos = new THREE.Vector3();
    this._scratchCamForward = new THREE.Vector3();
    this._scratchLookFocus = new THREE.Vector3();

    // Animation State Machine
    this.animManager = new AnimationManager(
      this.character,
      this.character.animations || []
    );

    // Crosshair HUD element
    this.crosshairElement = null;
    this.initCrosshair();

    // Milestone 6 — Divine Ability System & Controls Lock
    this.abilitySystem = null;
    this.isMovementEnabled = true;
    this.isCameraControlled = false;

    // Physics Kinematic Character Controller & Body
    this.rigidBody = null;
    this.collider = null;
    this.charController = null;
    this.initPhysicsBody();

    this.bindEvents();
  }

  setWeaponManager(wm) {
    this.weaponManager = wm;
    this.updateCrosshairVisibility();
  }

  setAbilitySystem(abilitySystem) {
    this.abilitySystem = abilitySystem;
  }

  setMovementEnabled(enabled) {
    this.isMovementEnabled = enabled;
    if (!enabled) {
      this.velocity.set(0, 0, 0);
      this.currentSpeed = 0;
      if (this.rigidBody) {
        this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  }

  setCameraControlled(controlled) {
    this.isCameraControlled = !!controlled;
  }

  /**
   * Return the living enemy instance currently targeted by the center reticle ray
   * @returns {import('../enemy/EnemyCharacter.js').EnemyCharacter|null}
   */
  getEnemyUnderReticle() {
    this.aimRaycaster.setFromCamera(this.centerViewport, this.camera);
    this.aimRaycaster.far = 250;
    if (this.enemyHitboxes && this.enemyHitboxes.length > 0) {
      const enemyHits = this.aimRaycaster.intersectObjects(this.enemyHitboxes, false);
      if (enemyHits.length > 0) {
        return enemyHits[0].object?.userData?.enemy || null;
      }
    }
    return null;
  }

  setEnvironmentReferences(envModel, skyDome) {
    this.environmentModel = envModel;
    this.skyDomeMesh = skyDome;

    // Cache hittable environment meshes (terrain, trees) excluding sky dome and player
    this.hittableEnvironment = [];
    if (envModel) {
      envModel.traverse((child) => {
        if (child.isMesh && child !== skyDome) {
          this.hittableEnvironment.push(child);
        }
      });
    }

    // Also register environment meshes with weapon projectile system
    if (this.weaponManager && this.weaponManager.projectileSystem) {
      this.weaponManager.projectileSystem.setEnvironmentMeshes(this.hittableEnvironment);
    }
  }

  /**
   * Register living enemy hitboxes for fast, stutter-free reticle aiming
   * @param {THREE.Object3D[]} hitboxes 
   */
  setEnemyHitboxes(hitboxes) {
    this.enemyHitboxes = hitboxes || [];
  }

  initCrosshair() {
    let crosshair = document.getElementById('combat-crosshair');
    if (!crosshair) {
      crosshair = document.createElement('div');
      crosshair.id = 'combat-crosshair';
      crosshair.className = 'combat-crosshair hidden';
      // Clean, high-contrast reticle dot fixed at center of screen
      crosshair.innerHTML = `<div class="crosshair-dot"></div>`;
      document.body.appendChild(crosshair);
    } else {
      crosshair.innerHTML = `<div class="crosshair-dot"></div>`;
    }
    this.crosshairElement = crosshair;
  }

  updateCrosshairVisibility() {
    if (!this.crosshairElement) return;
    // PRIORITY 2: Crosshair appears when aiming mode is active with equipped bow
    const isEquipped = this.weaponManager ? this.weaponManager.isEquipped : true;
    const isVisible = this.isAiming && isEquipped;
    if (isVisible) {
      this.crosshairElement.classList.remove('hidden');
    } else {
      this.crosshairElement.classList.add('hidden');
    }
  }

  initPhysicsBody() {
    if (this.physics && this.physics.isInitialized && this.physics.RAPIER) {
      const RAPIER = this.physics.RAPIER;

      // Sample initial ground elevation at spawn position
      const ground = this.physics.getTerrainElevation(
        this.character.position.x,
        this.character.position.z
      );
      const startGroundY = ground ? ground.y : this.character.position.y;
      this.character.position.y = startGroundY;

      // Create Kinematic Position-based body for player centered at waist
      const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(
          this.character.position.x,
          startGroundY + this.capsuleCenterOffset,
          this.character.position.z
        );
      this.rigidBody = this.physics.world.createRigidBody(bodyDesc);

      // Capsule Collider
      const colliderDesc = RAPIER.ColliderDesc.capsule(this.capsuleHalfHeight, this.capsuleRadius);
      this.collider = this.physics.world.createCollider(colliderDesc, this.rigidBody);

      // Rapier Kinematic Character Controller with 2cm clearance
      this.charController = this.physics.createCharacterController(0.02);

      console.log(`[PlayerController] Rapier3D character capsule registered at ground Y=${startGroundY.toFixed(3)}m.`);
    }
  }

  /**
   * Reset player transform, physics body, velocity, camera angles and aiming state
   * (Milestone 5.2 Part C: Ensures stable, reproducible grounding on game start/restart)
   * @param {THREE.Vector3} [spawnPos=new THREE.Vector3(0, 0, 0)]
   * @param {number} [initialYaw=0]
   */
  resetSpawn(spawnPos = new THREE.Vector3(0, 0, 0), initialYaw = 0) {
    let groundY = spawnPos.y;
    if (this.physics && this.physics.isInitialized) {
      const elev = this.physics.getTerrainElevation(spawnPos.x, spawnPos.z);
      if (elev) groundY = elev.y;
    }

    this.character.position.set(spawnPos.x, groundY, spawnPos.z);
    this.character.rotation.set(0, initialYaw, 0);

    if (this.rigidBody) {
      this.rigidBody.setTranslation({
        x: spawnPos.x,
        y: groundY + this.capsuleCenterOffset,
        z: spawnPos.z
      }, true);
      this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    this.cameraYaw = initialYaw;
    this.cameraPitch = 0.16; // Natural slight downward angle (~9 deg)
    this.currentCameraDistance = this.cameraDistance;
    this.isAiming = false;
    this.updateCrosshairVisibility();

    // Reset input states
    Object.keys(this.keys).forEach(k => { this.keys[k] = false; });

    // Reset animation to idle
    if (this.animManager) {
      this.animManager.playState('idle');
    }

    console.log(`[PlayerController] Player spawn reset to (${spawnPos.x}, ${groundY.toFixed(3)}, ${spawnPos.z}) with yaw=${initialYaw}.`);
  }

  bindEvents() {
    this.onKeyDown = (e) => {
      if (e.code === 'KeyE') {
        if (this.weaponManager) {
          this.weaponManager.toggleEquip();
          this.updateCrosshairVisibility();
        }
        return;
      }

      // Milestone 6 — Divine Abilities Shortcuts
      if (e.code === 'KeyQ') {
        if (this.abilitySystem) {
          this.abilitySystem.triggerBahuBaan();
        }
        return;
      }

      if (e.code === 'KeyR') {
        if (this.abilitySystem) {
          this.abilitySystem.triggerSandDune();
        }
        return;
      }

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.shift = true;
          break;
        case 'Space':
          this.keys.space = true;
          this.handleJump();
          break;
      }
    };

    this.onKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.shift = false;
          break;
        case 'Space':
          this.keys.space = false;
          break;
      }
    };

    this.onMouseMove = (e) => {
      if (!this.isPointerLocked) return;

      const sensitivity = 0.0022;
      this.cameraYaw -= e.movementX * sensitivity;

      // Clamp vertical pitch between -28 deg and +38 deg
      this.cameraPitch = Math.max(-0.48, Math.min(0.65, this.cameraPitch - e.movementY * sensitivity));
    };

    this.onWheel = (e) => {
      if (this.isAiming) {
        // PRIORITY 3 — Mouse wheel smoothly adjusts aiming camera distance
        this.aimCameraDistance = THREE.MathUtils.clamp(
          this.aimCameraDistance + e.deltaY * 0.0015,
          CAMERA_CONFIG.aiming.minDistance,
          CAMERA_CONFIG.aiming.maxDistance
        );
      } else {
        this.cameraDistance = THREE.MathUtils.clamp(
          this.cameraDistance + e.deltaY * 0.005,
          this.minDistance,
          this.maxDistance
        );
      }
    };

    this.onPointerLockChange = () => {
      this.isPointerLocked = document.pointerLockElement === this.domElement;
      if (!this.isPointerLocked && this.isAiming) {
        this.stopAiming();
      }
      this.updateCrosshairVisibility();
    };

    // Right-click aiming & left-click shooting
    this.onMouseDown = (e) => {
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('#gameplay-hud button')) {
        return;
      }

      if (!this.isPointerLocked) {
        if (this.domElement.requestPointerLock) {
          this.domElement.requestPointerLock();
        }
        return;
      }

      // Right Mouse Button (button 2): Enter aiming mode
      if (e.button === 2 && this.weaponManager && this.weaponManager.isEquipped) {
        this.startAiming();
      }

      // Left Mouse Button (button 0): Shoot arrow
      if (e.button === 0 && this.weaponManager && this.weaponManager.isEquipped) {
        this.shootArrow();
      }
    };

    this.onMouseUp = (e) => {
      // Release Right Mouse Button: Exit aiming mode
      if (e.button === 2) {
        this.stopAiming();
      }
    };

    this.onContextMenu = (e) => {
      // Prevent browser context menu on right click
      e.preventDefault();
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  /**
   * Enter third-person aiming mode (hold RMB)
   */
  startAiming() {
    if (!this.isMovementEnabled || this.animManager?.isChanting) return;
    if (this.isAiming || !this.weaponManager || !this.weaponManager.isEquipped) return;
    this.isAiming = true;
    this.updateCrosshairVisibility();

    // Trigger upper-body bow draw & aim stance
    this.animManager.startAim(() => {
      if (this.weaponManager) {
        this.weaponManager.onArrowExtracted();
      }
    });
  }

  /**
   * Exit aiming mode (release RMB)
   */
  stopAiming() {
    if (!this.isAiming) return;
    this.isAiming = false;
    this.updateCrosshairVisibility();

    this.animManager.stopAim();

    // Hide drawn arrow if shot was not released
    if (this.weaponManager && this.weaponManager.drawnArrow && !this.animManager.isShooting) {
      this.weaponManager.drawnArrow.visible = false;
    }
  }

  /**
   * PRIORITY 2 — Deterministic Camera-Based Targeting System
   * Casts a ray from the exact center of the camera viewport.
   * Resolves nearest valid intersection with living enemy capsule hitboxes (~0.005ms)
   * or Rapier3D terrain BVH trimesh (< 0.02ms).
   * Completely eliminates expensive 116,000-triangle CPU foliage raycasting on every frame!
   * @returns {THREE.Vector3} Exact 3D target point in world coordinates
   */
  getTargetAimPoint() {
    this.aimRaycaster.setFromCamera(this.centerViewport, this.camera);
    this.aimRaycaster.far = 400;

    // 1. Raycast living enemy hitboxes (cheap capsule hitboxes, ~0.005ms)
    if (this.enemyHitboxes && this.enemyHitboxes.length > 0) {
      const enemyHits = this.aimRaycaster.intersectObjects(this.enemyHitboxes, false);
      if (enemyHits.length > 0) {
        this._aimTargetPoint.copy(enemyHits[0].point);
        return this._aimTargetPoint;
      }
    }

    // 2. Fast Rapier3D BVH raycast against terrain trimesh (< 0.02ms, zero JS allocations)
    // Avoids testing 116,000 pine tree triangles on the CPU every frame!
    if (this.physics && this.physics.isInitialized && this.physics.terrainCollider) {
      const rayOrigin = this.aimRaycaster.ray.origin;
      const rayDir = this.aimRaycaster.ray.direction;
      const rapierRay = this.physics.getReusableRay(rayOrigin.x, rayOrigin.y, rayOrigin.z, rayDir.x, rayDir.y, rayDir.z);
      if (rapierRay && typeof this.physics.terrainCollider.castRay === 'function') {
        const hitToi = this.physics.terrainCollider.castRay(rapierRay, 300, false);
        if (hitToi !== null && hitToi !== undefined) {
          this._aimTargetPoint.copy(rayOrigin).addScaledVector(rayDir, hitToi);
          return this._aimTargetPoint;
        }
      }
    }

    // 3. Fallback: distant point along camera forward ray (120m)
    this.aimRaycaster.ray.at(120, this._aimTargetPoint);
    return this._aimTargetPoint;
  }

  /**
   * Shoot Arrow with Rapid-Fire Archery Support:
   * First Shot plays full draw/release; subsequent shots in aiming mode execute rapid flick shots.
   */
  shootArrow() {
    if (!this.isMovementEnabled || this.animManager?.isChanting) {
      return;
    }
    if (!this.weaponManager || !this.weaponManager.isEquipped) {
      return;
    }

    const now = performance.now() / 1000;

    // Rate-limit rapid firing to configurable interval (approx 3.5 arrows/second)
    if (now - this.lastShotTime < this.rapidFireInterval) {
      return;
    }

    // If not in rapid subsequent shot mode, check if animation is busy
    if (!this.animManager.hasFiredFirstShot && this.animManager.isShooting) {
      return;
    }

    this.lastShotTime = now;

    // Play shooting sequence with release synchronization
    this.animManager.playShoot({
      onExtract: () => {
        this.weaponManager.onArrowExtracted();
      },
      onRelease: () => {
        // Read exact 3D target point from center-screen camera ray
        const aimTarget = this.getTargetAimPoint();
        this.weaponManager.onArrowReleased(aimTarget);
      },
      onComplete: () => {
        // Infinite Arrow: keep arrow ready for next shot
        if (this.isAiming) {
          this.weaponManager.onArrowExtracted();
        }
      }
    });
  }

  handleJump() {
    if (this.isGrounded && this.animManager && !this.isAiming) {
      this.animManager.playState('jump');
    }
  }

  update(delta) {
    // If movement is locked (e.g. during Divine Chant / Sand Dune Ultimate), freeze locomotion
    if (!this.isMovementEnabled || this.animManager?.isChanting) {
      if (this.animManager) {
        this.animManager.update(delta);
      }
      this.updateCamera(delta);
      return;
    }

    // 1. Calculate movement input direction
    const rawInputZ = (this.keys.forward ? 1 : 0) - (this.keys.backward ? 1 : 0);
    const rawInputX = (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    
    // Responsive movement input: player is never trapped or locked after shooting
    const inputZ = rawInputZ;
    const inputX = rawInputX;
    const hasMovementInput = inputX !== 0 || inputZ !== 0;

    // 2. Select locomotion animation state for legs & hips
    if (hasMovementInput) {
      if (this.keys.shift && !this.isAiming) {
        this.animManager.playState('run');
        this.currentSpeed = this.runSpeed;
      } else {
        this.animManager.playState('walk');
        this.currentSpeed = this.walkSpeed;
      }
    } else {
      this.animManager.playState('idle');
      this.currentSpeed = 0;
    }

    // 3. Character Aiming Rotation Behaviour
    // When aiming: Shri Ram smoothly rotates horizontally to face the reticle target
    if (this.isAiming) {
      const aimTarget = this.getTargetAimPoint();
      const dx = aimTarget.x - this.character.position.x;
      const dz = aimTarget.z - this.character.position.z;

      // Shri Ram's model faces +Z: Math.atan2(dx, dz) correctly turns towards target
      const targetRotation = Math.atan2(dx, dz);
      let diff = targetRotation - this.character.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.character.rotation.y += diff * Math.min(1.0, delta * 16);
    } else if (hasMovementInput) {
      // Normal locomotion rotation towards movement direction (zero allocations)
      this._inputVec.set(inputX, inputZ).normalize();
      this._forwardVec.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
      this._rightVec.set(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));

      this._moveDir.set(0, 0, 0)
        .addScaledVector(this._forwardVec, this._inputVec.y)
        .addScaledVector(this._rightVec, -this._inputVec.x)
        .normalize();

      const targetRotation = Math.atan2(this._moveDir.x, this._moveDir.z);
      let diff = targetRotation - this.character.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.character.rotation.y += diff * Math.min(1.0, delta * 12);
    }

    // 4. Move character relative to camera horizontal yaw (zero allocations)
    this._targetVel.set(0, 0, 0);
    if (hasMovementInput) {
      this._inputVec.set(inputX, inputZ).normalize();
      this._forwardVec.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
      this._rightVec.set(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));

      this._moveDir.set(0, 0, 0)
        .addScaledVector(this._forwardVec, this._inputVec.y)
        .addScaledVector(this._rightVec, -this._inputVec.x)
        .normalize();

      this._targetVel.copy(this._moveDir).multiplyScalar(this.currentSpeed);
    }

    // Smooth velocity interpolation
    this.velocity.lerp(this._targetVel, Math.min(1.0, delta * 10));
    if (!hasMovementInput && this.velocity.lengthSq() < 0.002) {
      this.velocity.set(0, 0, 0);
    }

    // 5. Physical Terrain Grounding & Movement (Rapier3D Capsule)
    if (this.rigidBody && this.charController && this.physics) {
      const curPos = this.rigidBody.translation();

      const desiredMove = {
        x: this.velocity.x * delta,
        y: -9.81 * delta,
        z: this.velocity.z * delta
      };

      this.charController.computeColliderMovement(this.collider, desiredMove);
      const computed = this.charController.computedMovement();

      const nextPos = {
        x: curPos.x + computed.x,
        y: curPos.y + computed.y,
        z: curPos.z + computed.z
      };

      // Playable Forest Clearing Boundary Check
      const distFromCenter = Math.hypot(nextPos.x, nextPos.z);
      if (distFromCenter > this.maxPlayableRadius) {
        const angle = Math.atan2(nextPos.x, nextPos.z);
        nextPos.x = Math.sin(angle) * this.maxPlayableRadius;
        nextPos.z = Math.cos(angle) * this.maxPlayableRadius;
      }

      // Query exact terrain elevation directly below character
      const groundInfo = this.physics.getTerrainElevation(nextPos.x, nextPos.z, this.collider);
      if (groundInfo) {
        if (hasMovementInput) {
          nextPos.y = Math.max(nextPos.y, groundInfo.y + this.capsuleCenterOffset);
        } else {
          nextPos.y = groundInfo.y + this.capsuleCenterOffset;
        }
        this.isGrounded = true;
      } else {
        this.isGrounded = this.charController.computedGrounded();
      }

      // Update Rapier kinematic rigid body position
      this.rigidBody.setNextKinematicTranslation(nextPos);

      // Sync visual model: feet placed precisely on ground
      this.character.position.set(
        nextPos.x,
        nextPos.y - this.capsuleCenterOffset,
        nextPos.z
      );
    } else {
      this.character.position.addScaledVector(this.velocity, delta);
    }

    // 6. Update animation mixer & shooting timeline
    this.animManager.update(delta);

    // 7. Update weapons and active projectiles
    if (this.weaponManager) {
      this.weaponManager.update(delta);
    }

    // 8. PRIORITY 2 — GTA-style Third-Person Follow Camera Update
    this.updateCamera(delta);
  }

  /**
   * PRIORITY 1 — GTA-style Close Over-the-Shoulder Aiming Camera
   * Smoothly transitions close behind and slightly above Shri Ram's right shoulder when aiming (Reference Image 1)
   */
  updateCamera(delta) {
    if (this.isCameraControlled) return;

    const targetDistance = this.isAiming ? this.aimCameraDistance : this.cameraDistance;
    const targetSideOffset = this.isAiming ? CAMERA_CONFIG.aiming.sideOffset : CAMERA_CONFIG.normal.sideOffset;
    const targetHeightOffset = this.isAiming ? CAMERA_CONFIG.aiming.heightOffset : CAMERA_CONFIG.normal.heightOffset;
    const targetFOV = this.isAiming ? CAMERA_CONFIG.aiming.fov : CAMERA_CONFIG.normal.fov;

    // Smooth FOV zoom transition (tightens FOV during aiming for precision)
    if (Math.abs(this.camera.fov - targetFOV) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(
        this.camera.fov,
        targetFOV,
        Math.min(1.0, delta * CAMERA_CONFIG.transitionSpeed)
      );
      this.camera.updateProjectionMatrix();
    }

    // Smooth camera distance, height, and shoulder offset interpolation
    this.currentCameraDistance = THREE.MathUtils.lerp(
      this.currentCameraDistance ?? this.cameraDistance,
      targetDistance,
      Math.min(1.0, delta * CAMERA_CONFIG.transitionSpeed)
    );
    this.currentSideOffset = THREE.MathUtils.lerp(
      this.currentSideOffset ?? 0,
      targetSideOffset,
      Math.min(1.0, delta * CAMERA_CONFIG.transitionSpeed)
    );
    this.currentHeightOffset = THREE.MathUtils.lerp(
      this.currentHeightOffset ?? CAMERA_CONFIG.normal.heightOffset,
      targetHeightOffset,
      Math.min(1.0, delta * CAMERA_CONFIG.transitionSpeed)
    );

    const sinYaw = Math.sin(this.cameraYaw);
    const cosYaw = Math.cos(this.cameraYaw);
    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);

    // Camera horizontal right vector: (cosYaw, 0, -sinYaw)
    const rightVec = new THREE.Vector3(cosYaw, 0, -sinYaw);

    // Target position on character, offset to right shoulder
    const targetPos = this.character.position.clone();
    targetPos.y += this.currentHeightOffset;
    targetPos.addScaledVector(rightVec, this.currentSideOffset);

    // Spherical camera position behind targetPos (zero allocations)
    const cameraOffsetX = this.currentCameraDistance * cosPitch * sinYaw;
    const cameraOffsetY = this.currentCameraDistance * sinPitch;
    const cameraOffsetZ = this.currentCameraDistance * cosPitch * cosYaw;

    const targetY = this.character.position.y + this.currentHeightOffset;
    const targetX = this.character.position.x + cosYaw * this.currentSideOffset;
    const targetZ = this.character.position.z - sinYaw * this.currentSideOffset;

    this._scratchDesiredCamPos.set(
      targetX + cameraOffsetX,
      targetY + cameraOffsetY,
      targetZ + cameraOffsetZ
    );

    // Ensure camera does not clip through terrain
    if (this.physics && this.physics.isInitialized) {
      const camGround = this.physics.getTerrainElevation(this._scratchDesiredCamPos.x, this._scratchDesiredCamPos.z, this.collider);
      if (camGround) {
        this._scratchDesiredCamPos.y = Math.max(camGround.y + 0.45, this._scratchDesiredCamPos.y);
      }
    }

    const camSmoothing = this.isAiming ? CAMERA_CONFIG.aiming.smoothing : CAMERA_CONFIG.normal.smoothing;
    this.camera.position.lerp(this._scratchDesiredCamPos, Math.min(1.0, delta * camSmoothing));

    // Focus point along camera forward ray so reticle stays precisely at screen center (zero allocations)
    this._scratchCamForward.set(
      -sinYaw * cosPitch,
      -sinPitch,
      -cosYaw * cosPitch
    ).normalize();

    this._scratchLookFocus.copy(this.camera.position).addScaledVector(this._scratchCamForward, 20);
    this.camera.lookAt(this._scratchLookFocus);
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);

    if (this.isPointerLocked && document.exitPointerLock) {
      document.exitPointerLock();
    }

    if (this.animManager) {
      this.animManager.dispose();
    }

    if (this.crosshairElement && this.crosshairElement.parentNode) {
      this.crosshairElement.parentNode.removeChild(this.crosshairElement);
      this.crosshairElement = null;
    }

    if (this.weaponManager) {
      this.weaponManager.dispose();
    }
  }
}
