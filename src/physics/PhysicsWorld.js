import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export class PhysicsWorld {
  constructor() {
    this.RAPIER = null;
    this.world = null;
    this.isInitialized = false;
    this.colliders = [];
    this.rigidBodies = [];
    this.terrainCollider = null;

    // Pre-allocated reusable query objects to eliminate garbage collection pauses
    this._cachedElevationRay = null;
    this._cachedGeneralRay = null;
    this._cachedElevationResult = { y: 0, normal: { x: 0, y: 1, z: 0 } };
  }

  /**
   * Initialize WebAssembly Rapier runtime
   */
  async init() {
    if (this.isInitialized) return;
    
    await RAPIER.init();
    this.RAPIER = RAPIER;
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.world = new RAPIER.World(gravity);
    this.isInitialized = true;
    console.log('[PhysicsWorld] Rapier3D physics engine initialized successfully.');
  }

  /**
   * Advance the physics simulation
   * @param {number} delta 
   */
  step(delta = 1 / 60) {
    if (!this.world) return;
    this.world.timestep = Math.min(delta, 0.05);
    this.world.step();
  }

  /**
   * Create static trimesh collider from Three.js terrain mesh
   * @param {THREE.Mesh} mesh 
   */
  createTerrainTrimesh(mesh) {
    if (!this.world || !this.RAPIER || !mesh || !mesh.geometry) return null;

    const geometry = mesh.geometry;
    const posAttr = geometry.getAttribute('position');
    if (!posAttr) return null;

    // Apply mesh world transformation to vertex positions if scaled or transformed
    mesh.updateWorldMatrix(true, false);
    const worldMatrix = mesh.matrixWorld;

    const vertices = new Float32Array(posAttr.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      v.applyMatrix4(worldMatrix);
      vertices[i * 3] = v.x;
      vertices[i * 3 + 1] = v.y;
      vertices[i * 3 + 2] = v.z;
    }

    let indices;
    if (geometry.index) {
      indices = new Uint32Array(geometry.index.array);
    } else {
      indices = new Uint32Array(posAttr.count);
      for (let i = 0; i < posAttr.count; i++) {
        indices[i] = i;
      }
    }

    const trimeshDesc = this.RAPIER.ColliderDesc.trimesh(vertices, indices);
    this.terrainCollider = this.world.createCollider(trimeshDesc);
    this.colliders.push(this.terrainCollider);

    // Prime the query pipeline so raycasts work immediately
    this.world.step();

    console.log(`[PhysicsWorld] Pine Forest terrain trimesh collider created (${posAttr.count} vertices, ${indices.length / 3} triangles).`);
    return this.terrainCollider;
  }

  /**
   * Create and configure Rapier Kinematic Character Controller
   * @param {number} offset 
   */
  createCharacterController(offset = 0.02) {
    if (!this.world || !this.RAPIER) return null;

    const controller = this.world.createCharacterController(offset);
    controller.enableAutostep(0.40, 0.25, false);
    controller.setMaxSlopeClimbAngle((65 * Math.PI) / 180);
    controller.enableSnapToGround(0.65);
    controller.setSlideEnabled(true);
    return controller;
  }

  /**
   * Reusable Rapier Ray wrapper to eliminate garbage allocations
   */
  getReusableRay(ox, oy, oz, dx, dy, dz) {
    if (!this.RAPIER) return null;
    if (!this._cachedGeneralRay) {
      this._cachedGeneralRay = new this.RAPIER.Ray({ x: ox, y: oy, z: oz }, { x: dx, y: dy, z: dz });
    } else {
      this._cachedGeneralRay.origin.x = ox;
      this._cachedGeneralRay.origin.y = oy;
      this._cachedGeneralRay.origin.z = oz;
      this._cachedGeneralRay.dir.x = dx;
      this._cachedGeneralRay.dir.y = dy;
      this._cachedGeneralRay.dir.z = dz;
    }
    return this._cachedGeneralRay;
  }

  /**
   * Query the exact terrain elevation and surface normal at (x, z)
   * Prioritizes direct terrain collider raycast to prevent hitting characters or hitboxes.
   * Completely allocation-free (reuses ray and result object).
   * @param {number} x 
   * @param {number} z 
   * @param {RAPIER.Collider} [excludeCollider]
   * @returns {{ y: number, normal: { x: number, y: number, z: number } } | null}
   */
  getTerrainElevation(x, z, excludeCollider = null) {
    if (!this.world || !this.RAPIER) return null;

    if (!this._cachedElevationRay) {
      this._cachedElevationRay = new this.RAPIER.Ray({ x, y: 35, z }, { x: 0, y: -1, z: 0 });
    } else {
      this._cachedElevationRay.origin.x = x;
      this._cachedElevationRay.origin.y = 35;
      this._cachedElevationRay.origin.z = z;
    }

    // Prioritize direct query against terrain collider so characters never obstruct the ground ray
    if (this.terrainCollider && typeof this.terrainCollider.castRayAndGetNormal === 'function') {
      const hit = this.terrainCollider.castRayAndGetNormal(this._cachedElevationRay, 70, false);
      if (hit) {
        const hitPt = this._cachedElevationRay.pointAt(hit.timeOfImpact);
        this._cachedElevationResult.y = hitPt.y;
        this._cachedElevationResult.normal.x = hit.normal.x;
        this._cachedElevationResult.normal.y = hit.normal.y;
        this._cachedElevationResult.normal.z = hit.normal.z;
        return this._cachedElevationResult;
      }
    }

    const hit = this.world.castRayAndGetNormal(this._cachedElevationRay, 70, false, undefined, undefined, excludeCollider);
    if (hit) {
      const hitPt = this._cachedElevationRay.pointAt(hit.timeOfImpact);
      this._cachedElevationResult.y = hitPt.y;
      this._cachedElevationResult.normal.x = hit.normal.x;
      this._cachedElevationResult.normal.y = hit.normal.y;
      this._cachedElevationResult.normal.z = hit.normal.z;
      return this._cachedElevationResult;
    }
    return null;
  }

  get stats() {
    return {
      isInitialized: this.isInitialized,
      collidersCount: this.colliders.length,
      bodiesCount: this.rigidBodies.length,
      hasTerrainTrimesh: !!this.terrainCollider
    };
  }

  dispose() {
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    this.colliders = [];
    this.rigidBodies = [];
    this.terrainCollider = null;
    this.isInitialized = false;
  }
}
