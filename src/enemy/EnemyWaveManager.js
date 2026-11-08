import * as THREE from 'three';
import { EnemyCharacter } from './EnemyCharacter.js';
import { FogVFXSystem } from './FogVFXSystem.js';
import { toast } from '../ui/ToastManager.js';

/**
 * Manages the first encounter wave of Rakshasa enemies in the Dandakaranya forest.
 * Coordinates outer perimeter spawning, soft fog entrance VFX, active enemy caps,
 * defeat tracking, and wave progression.
 */
export class EnemyWaveManager {
  /**
   * @param {THREE.Scene} scene 
   * @param {import('./EnemyOptimizer.js').EnemyOptimizer} enemyOptimizer 
   * @param {import('../physics/PhysicsWorld.js').PhysicsWorld} physics 
   * @param {import('../core/AssetLoader.js').AssetLoader} assetLoader 
   */
  constructor(scene, enemyOptimizer, physics, assetLoader) {
    this.scene = scene;
    this.optimizer = enemyOptimizer;
    this.physics = physics;
    this.assetLoader = assetLoader;

    // Configurable Wave Settings (Milestone 5.2 Perimeter & Pacing Calibration)
    this.config = {
      waveNumber: 1,
      totalEnemies: 8,
      maxActiveEnemies: 4,
      initialSpawnCount: 2,
      spawnInterval: 4.5, // seconds between subsequent spawns
      minSpawnRadius: 21.0, // 20-27m perimeter as specified in Milestone 5.2
      maxSpawnRadius: 27.0
    };

    // Wave Progress State
    this.spawnedCount = 0;
    this.defeatedCount = 0;
    this.isWaveActive = false;
    this.isWaveComplete = false;
    this.spawnTimer = 0;

    // Active Instances, Corpses & Hitboxes
    this.activeEnemies = [];
    this.corpseEnemies = [];
    this.enemyHitboxes = [];
    this.targetPlayer = null;

    // Fog VFX System
    this.fogVFX = new FogVFXSystem(this.scene, this.assetLoader);

    // References to gameplay systems for hitbox registration
    this.projectileSystem = null;
    this.playerController = null;
    this.abilitySystem = null;

    // UI Callback
    this.onProgressChange = null;
  }

  setAbilitySystem(abilitySystem) {
    this.abilitySystem = abilitySystem;
  }

  setTargetPlayer(playerModel) {
    this.targetPlayer = playerModel;
  }

  setSystemReferences(projectileSystem, playerController) {
    this.projectileSystem = projectileSystem;
    this.playerController = playerController;
    this.syncHitboxes();
  }

  /**
   * Cleanly dispose and remove all active and corpse enemies from the scene
   */
  clearAllEnemies() {
    [...this.activeEnemies, ...this.corpseEnemies].forEach((e) => {
      e.dispose();
    });
    this.activeEnemies = [];
    this.corpseEnemies = [];
    this.enemyHitboxes = [];
    this.syncHitboxes();
  }

  /**
   * Begin the battle wave encounter
   */
  startWave() {
    this.clearAllEnemies();

    this.isWaveActive = true;
    this.isWaveComplete = false;
    this.spawnedCount = 0;
    this.defeatedCount = 0;
    this.spawnTimer = 0;

    toast.show('⚔ WAVE 1: Rakshasa Scouts emerge through the mist!', 4500);

    // Initial staggered spawns: 1 scout immediately emerges, 2nd emerges after 2.2s
    this.spawnNextEnemy();
    setTimeout(() => {
      if (this.isWaveActive && !this.isWaveComplete) {
        this.spawnNextEnemy();
      }
    }, 2200);

    this.notifyProgress();
  }

  /**
   * Find a valid randomized perimeter coordinate on suitable terrain
   * (Milestone 5.2 Part B & D: 21m-27m radius, >= 4.5m separation between enemies)
   */
  findValidSpawnPosition() {
    const center = this.targetPlayer ? this.targetPlayer.position : new THREE.Vector3(0, 0, 0);
    const allEnemies = [...this.activeEnemies, ...this.corpseEnemies];

    for (let attempt = 0; attempt < 25; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = this.config.minSpawnRadius + Math.random() * (this.config.maxSpawnRadius - this.config.minSpawnRadius);
      const x = center.x + Math.cos(angle) * radius;
      const z = center.z + Math.sin(angle) * radius;

      // Reject positions within 4.5m of other enemies
      let tooCloseToOther = false;
      for (const e of allEnemies) {
        const dist = Math.hypot(e.root.position.x - x, e.root.position.z - z);
        if (dist < 4.5) {
          tooCloseToOther = true;
          break;
        }
      }
      if (tooCloseToOther) continue;

      // Query terrain elevation
      if (this.physics && this.physics.isInitialized) {
        const elev = this.physics.getTerrainElevation(x, z);
        if (elev) {
          if (elev.y > -15 && elev.y < 20) {
            return { x, y: elev.y, z };
          }
        }
      } else {
        return { x, y: 0, z };
      }
    }

    // Deterministic sector-based fallback along perimeter: guaranteed separation
    const sectorAngle = (this.spawnedCount * ((Math.PI * 2) / this.config.totalEnemies)) + (Math.PI / 8);
    const fallbackRadius = 23.5;
    const fallbackX = center.x + Math.cos(sectorAngle) * fallbackRadius;
    const fallbackZ = center.z + Math.sin(sectorAngle) * fallbackRadius;
    let fallbackY = 0;
    if (this.physics && this.physics.isInitialized) {
      const elev = this.physics.getTerrainElevation(fallbackX, fallbackZ);
      if (elev) fallbackY = elev.y;
    }
    return { x: fallbackX, y: fallbackY, z: fallbackZ };
  }

  /**
   * Spawn a new Aasura warrior instance
   */
  spawnNextEnemy() {
    if (this.spawnedCount >= this.config.totalEnemies) return;
    if (this.activeEnemies.length >= this.config.maxActiveEnemies) return;

    const pos = this.findValidSpawnPosition();
    this.spawnedCount++;

    // 1. Trigger soft transparent emergence fog
    this.fogVFX.spawnEmergenceFog(pos.x, pos.y, pos.z, 3.8);

    // 2. Create optimized skeletal clone
    const cloneData = this.optimizer.createClonedInstance();
    const enemy = new EnemyCharacter(cloneData, this.physics);

    // Milestone 5.2 & 6: Wire immediate defeat callback and later corpse disposal callback
    enemy.onDefeatedCallback = (deadEnemy, isAbilityKill) => {
      this.handleEnemyDefeated(deadEnemy, isAbilityKill);
    };
    enemy.onDeathCallback = (deadEnemy) => {
      this.handleEnemyDisposed(deadEnemy);
    };

    // Spawn and position
    enemy.spawn(pos.x, pos.z, this.targetPlayer);
    this.scene.add(enemy.root);

    this.activeEnemies.push(enemy);
    this.syncHitboxes();
    this.notifyProgress();

    console.log(`[EnemyWaveManager] Spawned Aasura ${this.spawnedCount}/${this.config.totalEnemies} at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}). Active: ${this.activeEnemies.length}`);
  }

  /**
   * Called immediately when enemy takes lethal damage
   */
  handleEnemyDefeated(enemy, isAbilityKill = false) {
    const idx = this.activeEnemies.indexOf(enemy);
    if (idx !== -1) {
      this.activeEnemies.splice(idx, 1);
      this.corpseEnemies.push(enemy);
    }

    this.defeatedCount++;
    this.syncHitboxes();
    this.notifyProgress();

    // Confirmed normal kill grants 25% Divine Energy (ability-generated kills grant 0%)
    if (!isAbilityKill && this.abilitySystem) {
      this.abilitySystem.onNormalEnemyKilled();
    }

    console.log(`[EnemyWaveManager] Aasura defeated (abilityKill=${isAbilityKill})! Defeated: ${this.defeatedCount}/${this.config.totalEnemies}. Active: ${this.activeEnemies.length}`);

    // Check wave completion
    if (this.defeatedCount >= this.config.totalEnemies) {
      if (this.config.waveNumber === 1) {
        this.transitionToWave2();
      } else {
        this.isWaveComplete = true;
        this.isWaveActive = false;
        toast.show('🎉 VICTORY: Dandakaranya Forest Cleansed of All Rakshasas!', 7000);
        console.log('[EnemyWaveManager] Wave 2 Complete! All enemies vanquished.');
      }
    } else {
      // Promptly schedule replacement spawn
      this.spawnTimer = this.config.spawnInterval - 1.2;
    }
  }

  /**
   * Transition cleanly to Wave 2 (Final Encounter)
   */
  transitionToWave2() {
    this.isWaveComplete = false;
    this.config.waveNumber = 2;
    this.config.totalEnemies = 12;
    this.config.maxActiveEnemies = 4;
    this.spawnedCount = 0;
    this.defeatedCount = 0;
    this.spawnTimer = 0;

    toast.show('⚔ WAVE 2 — FINAL STAND: 12 Rakshasa Warriors Advance!', 5500);
    console.log('[EnemyWaveManager] Wave 2 begins! 12 enemies in final wave roster.');

    if (this.abilitySystem) {
      this.abilitySystem.setFinalWave(true);
    }

    this.notifyProgress();

    // Initial staggered spawns for Wave 2
    this.spawnNextEnemy();
    setTimeout(() => {
      if (this.isWaveActive && !this.isWaveComplete && this.config.waveNumber === 2) {
        this.spawnNextEnemy();
      }
    }, 2000);
  }

  /**
   * Cancel pending spawns in queue and defeat all remaining wave enemies
   * (Triggered by Divya Sand Dune Ultimate)
   * @param {boolean} [isUltimate=true]
   */
  cancelPendingSpawnsAndComplete(isUltimate = true) {
    this.spawnedCount = this.config.totalEnemies;

    const remainingActive = [...this.activeEnemies];
    remainingActive.forEach(e => {
      if (!e.isDead) {
        e.takeDamage(100, e.root.position, new THREE.Vector3(0, 0, 1), true);
      }
    });

    this.defeatedCount = this.config.totalEnemies;
    this.isWaveComplete = true;
    this.isWaveActive = false;
    this.syncHitboxes();
    this.notifyProgress();

    if (isUltimate) {
      toast.show('🎉 VICTORY: All Rakshasa Vanquished by Divya Sand Dune!', 7000);
    }
    console.log(`[EnemyWaveManager] Wave ${this.config.waveNumber} force completed by ultimate.`);
  }

  /**
   * Called when corpse sink/dissolve timer finishes
   */
  handleEnemyDisposed(enemy) {
    const idx = this.corpseEnemies.indexOf(enemy);
    if (idx !== -1) {
      this.corpseEnemies.splice(idx, 1);
    }
  }

  /**
   * Keep projectile system and aiming raycaster synchronized with living enemy hitboxes
   */
  syncHitboxes() {
    this.enemyHitboxes = this.activeEnemies
      .filter((e) => !e.isDead && e.hitbox)
      .map((e) => e.hitbox);

    if (this.projectileSystem) {
      this.projectileSystem.setEnemyHitboxes(this.enemyHitboxes);
    }

    if (this.playerController) {
      this.playerController.setEnemyHitboxes(this.enemyHitboxes);
    }
  }

  /**
   * Main per-frame update loop
   * @param {number} delta 
   * @param {THREE.Camera} camera 
   */
  update(delta, camera) {
    // Update localized fog VFX
    this.fogVFX.update(delta);

    // Staggered Spawning Loop
    if (this.isWaveActive && !this.isWaveComplete) {
      if (this.spawnedCount < this.config.totalEnemies && this.activeEnemies.length < this.config.maxActiveEnemies) {
        this.spawnTimer += delta;
        if (this.spawnTimer >= this.config.spawnInterval) {
          this.spawnTimer = 0;
          this.spawnNextEnemy();
        }
      }
    }

    // Update active enemies with separation steering
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];
      enemy.update(delta, camera, this.activeEnemies);
    }

    // Update corpses (death animation & sink)
    for (let i = this.corpseEnemies.length - 1; i >= 0; i--) {
      const corpse = this.corpseEnemies[i];
      corpse.update(delta, camera);
    }
  }

  notifyProgress() {
    if (typeof this.onProgressChange === 'function') {
      this.onProgressChange({
        wave: this.config.waveNumber,
        defeated: this.defeatedCount,
        total: this.config.totalEnemies,
        remaining: Math.max(0, this.config.totalEnemies - this.defeatedCount),
        active: this.activeEnemies.length
      });
    }
  }

  dispose() {
    this.fogVFX.dispose();
    this.clearAllEnemies();
  }
}

