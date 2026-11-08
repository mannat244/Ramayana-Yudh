import * as THREE from 'three';
import { ProjectileSystem } from './ProjectileSystem.js';
import { toast } from '../ui/ToastManager.js';

/**
 * Configurable Weapon Socketing, Alignment, and Rest Offsets.
 * Units: Bone local space (centimeters).
 */
export const WEAPON_CONFIG = {
  bow: {
    // LeftHand local bone space offset (palm center):
    // X: towards palm cup (-X is deep inside palm, +X is palm surface)
    // Y: along palm from wrist (0) to knuckles (12)
    // Z: radial/ulnar (+Z is thumb, -Z is pinky)
    position: { x: -0.30, y: 6.8, z: -0.65 },
    // Rotation so bow is held naturally:
    // Bow top limb points UP (+Z in LeftHand aim pose)
    // Bowstring faces BACK towards archer (-Y in LeftHand aim pose)
    // Bow front faces FORWARD towards target (+Y in LeftHand aim pose)
    rotation: { x: Math.PI / 2, y: -Math.PI / 2, z: 0 },
    scale: 1.0
  },
  quiver: {
    // Slung diagonally across right shoulder onto upper back
    position: { x: -8.0, y: 6.0, z: -14.0 },
    rotation: { x: 0.2, y: 0.15, z: -0.65 },
    scale: 0.85
  },
  drawnArrow: {
    // Arrow resting on bow grip arrow-rest:
    // Arrow tip (-Y in raw mesh) points forward (-X of bow)
    // Nock (+Y in raw mesh) sits on string (+X of bow)
    // With rotation z = -Math.PI / 2: tip points forward along -X, nock is at +X
    position: { x: 8.5, y: 1.5, z: 0.0 },
    rotation: { x: 0, y: 0, z: -Math.PI / 2 },
    scale: 1.0
  },
  quiverArrow: {
    // Single visible stored arrow resting inside quiver
    position: { x: 0, y: 16.0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 0.9
  }
};

export class WeaponManager {
  /**
   * @param {THREE.Object3D} characterModel 
   * @param {THREE.Scene} scene 
   * @param {THREE.Camera} camera 
   * @param {import('../physics/PhysicsWorld.js').PhysicsWorld} physics 
   */
  constructor(characterModel, scene, camera, physics) {
    this.character = characterModel;
    this.scene = scene;
    this.camera = camera;
    this.physics = physics;

    this.isEquipped = true;
    this.isShooting = false;

    // Bone references
    this.leftHandBone = null;
    this.rightHandBone = null;
    this.spineBone = null;

    // Weapon Objects & Attachment Pivots
    this.bowPivot = null;
    this.bow = null;
    this.quiver = null;
    this.quiverArrow = null;
    this.drawnArrow = null;

    // Projectile System
    this.projectileSystem = new ProjectileSystem(scene, physics);

    this.findBones();
  }

  findBones() {
    this.character.traverse((child) => {
      if (child.isBone) {
        if (child.name === 'LeftHand') this.leftHandBone = child;
        if (child.name === 'RightHand') this.rightHandBone = child;
        if (child.name === 'Spine2' || child.name === 'Spine1') {
          if (!this.spineBone || child.name === 'Spine2') {
            this.spineBone = child;
          }
        }
      }
    });

    console.log('[WeaponManager] Bones located:', {
      leftHand: !!this.leftHandBone,
      rightHand: !!this.rightHandBone,
      spine: !!this.spineBone
    });
  }

  /**
   * Initialize weapons from the loaded tribal_basic_bow.glb
   * @param {THREE.Group} gltfScene 
   */
  initWeapons(gltfScene) {
    let rawBow = null;
    let rawQuiver = null;
    let rawArrow = null;

    gltfScene.traverse((child) => {
      if (child.isMesh) {
        if (child.name.includes('ectra1')) rawBow = child;
        else if (child.name.includes('quiver')) rawQuiver = child;
        else if (child.name.includes('arrow')) rawArrow = child;
      }
    });

    if (!rawBow || !rawQuiver || !rawArrow) {
      console.error('[WeaponManager] Missing one or more weapon meshes in GLTF.');
      return;
    }

    // Ensure materials use sRGB and cast shadows
    const prepMat = (mat) => {
      if (!mat) return;
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      mat.roughness = 0.65;
      mat.metalness = 0.15;
      mat.needsUpdate = true;
    };
    [rawBow, rawQuiver, rawArrow].forEach(m => {
      if (Array.isArray(m.material)) m.material.forEach(prepMat);
      else prepMat(m.material);
    });

    // 1. Prepare Bow & Dedicated Attachment Pivot
    // In raw bow geometry (ectra1), the grip center is at x = -0.14, y = 0.0, z = 0.0.
    // Shift by +0.14 in X so the origin is exactly the center of the grip handle.
    this.bow = rawBow.clone();
    this.bow.geometry = rawBow.geometry.clone();
    this.bow.geometry.translate(0.14, 0, 0);
    this.bow.castShadow = true;
    this.bow.receiveShadow = true;
    this.bow.scale.setScalar(WEAPON_CONFIG.bow.scale);

    // Create attachment pivot in LeftHand palm space
    this.bowPivot = new THREE.Group();
    this.bowPivot.name = 'BowAttachmentPivot';
    this.bowPivot.position.set(
      WEAPON_CONFIG.bow.position.x,
      WEAPON_CONFIG.bow.position.y,
      WEAPON_CONFIG.bow.position.z
    );
    this.bowPivot.rotation.set(
      WEAPON_CONFIG.bow.rotation.x,
      WEAPON_CONFIG.bow.rotation.y,
      WEAPON_CONFIG.bow.rotation.z
    );

    this.bowPivot.add(this.bow);

    if (this.leftHandBone) {
      this.leftHandBone.add(this.bowPivot);
    } else {
      this.character.add(this.bowPivot);
    }

    // 2. Prepare Quiver on Spine2
    this.quiver = rawQuiver.clone();
    this.quiver.geometry = rawQuiver.geometry.clone();
    this.quiver.geometry.center();
    this.quiver.castShadow = true;
    this.quiver.receiveShadow = true;
    this.quiver.scale.setScalar(WEAPON_CONFIG.quiver.scale);
    this.quiver.position.set(
      WEAPON_CONFIG.quiver.position.x,
      WEAPON_CONFIG.quiver.position.y,
      WEAPON_CONFIG.quiver.position.z
    );
    this.quiver.rotation.set(
      WEAPON_CONFIG.quiver.rotation.x,
      WEAPON_CONFIG.quiver.rotation.y,
      WEAPON_CONFIG.quiver.rotation.z
    );

    if (this.spineBone) {
      this.spineBone.add(this.quiver);
    } else {
      this.character.add(this.quiver);
    }

    // Prepare centered raw arrow geometry for drawn arrow & projectiles:
    // Raw arrow shaft is centered at X = -34.5, Z = 0 in GLTF file.
    const arrowGeom = rawArrow.geometry.clone();
    arrowGeom.translate(34.5, 0, 0);

    // 3. Prepare Single Visible Stored Arrow inside Quiver
    this.quiverArrow = rawArrow.clone();
    this.quiverArrow.geometry = arrowGeom.clone();
    this.quiverArrow.castShadow = true;
    this.quiverArrow.scale.setScalar(WEAPON_CONFIG.quiverArrow.scale);
    this.quiverArrow.position.set(
      WEAPON_CONFIG.quiverArrow.position.x,
      WEAPON_CONFIG.quiverArrow.position.y,
      WEAPON_CONFIG.quiverArrow.position.z
    );
    this.quiverArrow.rotation.set(
      WEAPON_CONFIG.quiverArrow.rotation.x,
      WEAPON_CONFIG.quiverArrow.rotation.y,
      WEAPON_CONFIG.quiverArrow.rotation.z
    );
    this.quiver.add(this.quiverArrow);

    // 4. Prepare Drawn Arrow (rests on bow arrow rest, nock on string)
    this.drawnArrow = rawArrow.clone();
    this.drawnArrow.geometry = arrowGeom.clone();
    this.drawnArrow.castShadow = true;
    this.drawnArrow.scale.setScalar(WEAPON_CONFIG.drawnArrow.scale);
    this.drawnArrow.position.set(
      WEAPON_CONFIG.drawnArrow.position.x,
      WEAPON_CONFIG.drawnArrow.position.y,
      WEAPON_CONFIG.drawnArrow.position.z
    );
    this.drawnArrow.rotation.set(
      WEAPON_CONFIG.drawnArrow.rotation.x,
      WEAPON_CONFIG.drawnArrow.rotation.y,
      WEAPON_CONFIG.drawnArrow.rotation.z
    );
    this.drawnArrow.visible = false;
    this.bow.add(this.drawnArrow);

    // 5. Template for in-flight Arrow Projectiles
    // Scale 0.01 brings 80.2cm arrow to 0.80m in world space
    const arrowWorldTemplate = rawArrow.clone();
    arrowWorldTemplate.geometry = arrowGeom.clone();
    arrowWorldTemplate.castShadow = true;
    arrowWorldTemplate.scale.setScalar(0.01);
    this.projectileSystem.setTemplate(arrowWorldTemplate);

    console.log('[WeaponManager] Bow, Quiver, and Arrow socketing complete with calibrated offsets.');
  }

  /**
   * Toggle equip / stow bow state
   */
  toggleEquip() {
    if (this.isShooting) return;

    this.isEquipped = !this.isEquipped;

    if (this.bowPivot) {
      this.bowPivot.visible = this.isEquipped;
    } else if (this.bow) {
      this.bow.visible = this.isEquipped;
    }

    if (this.isEquipped) {
      toast.show('🏹 Bow & Quiver Equipped • Hold RMB to Aim • LMB to Shoot • E to Stow', 4000);
    } else {
      toast.show('Bow Stowed • Press E to Equip', 3000);
    }
  }

  /**
   * Arrow extraction event: Called when right hand reaches the quiver
   */
  onArrowExtracted() {
    // 1. Stored arrow in quiver is retrieved
    if (this.quiverArrow) {
      this.quiverArrow.visible = false;
    }

    // 2. Drawn arrow becomes visible mounted on the bow
    if (this.drawnArrow) {
      this.drawnArrow.visible = true;
    }

    // 3. Infinite Arrow Replenishment:
    // A fresh arrow immediately appears in the quiver (never empty, never stacked)
    setTimeout(() => {
      if (this.quiverArrow) {
        this.quiverArrow.visible = true;
      }
    }, 120);
  }

  /**
   * Get world position where the arrow launches from the bow (exact arrow-rest)
   * @param {THREE.Vector3} [out] 
   * @returns {THREE.Vector3}
   */
  getLaunchPosition(out = new THREE.Vector3()) {
    if (this.drawnArrow) {
      this.drawnArrow.getWorldPosition(out);
      return out;
    }
    if (this.bow) {
      this.bow.getWorldPosition(out);
      return out;
    }
    this.character.getWorldPosition(out);
    out.y += 1.4;
    return out;
  }

  /**
   * Arrow release event: Called at the exact moment bowstring is released
   * @param {THREE.Vector3} targetPoint 
   */
  onArrowReleased(targetPoint) {
    // 1. Calculate exact spawn position at the bow arrow-rest before hiding
    const spawnPos = this.getLaunchPosition();

    // 2. Hide drawn arrow on bow
    if (this.drawnArrow) {
      this.drawnArrow.visible = false;
    }

    // 3. Launch arrow projectile forward towards aim target point with ballistic gravity compensation
    this.projectileSystem.spawnArrow(spawnPos, targetPoint, 48);
  }

  /**
   * Milestone 6: Divya Bahu-Baan release event
   * @param {THREE.Vector3} targetPoint 
   * @param {object[]} targets 
   */
  onBahuBaanReleased(targetPoint, targets = []) {
    const spawnPos = this.getLaunchPosition();
    if (this.drawnArrow) {
      this.drawnArrow.visible = false;
    }
    this.projectileSystem.spawnBahuBaanArrow(spawnPos, targetPoint, targets);
  }

  /**
   * Update active projectile physics
   */
  update(delta) {
    if (this.projectileSystem) {
      this.projectileSystem.update(delta);
    }
  }

  dispose() {
    if (this.projectileSystem) {
      this.projectileSystem.dispose();
    }
  }
}
