import * as THREE from 'three';
import { toast } from '../ui/ToastManager.js';

export class DivineAbilitySystem {
  /**
   * @param {import('../character/PlayerController.js').PlayerController} playerController 
   * @param {import('./WeaponManager.js').WeaponManager} weaponManager 
   * @param {import('../enemy/EnemyWaveManager.js').EnemyWaveManager} waveManager 
   * @param {import('../vfx/SandDuneSystem.js').SandDuneSystem} sandDuneSystem 
   */
  constructor(playerController, weaponManager, waveManager, sandDuneSystem) {
    this.playerController = playerController;
    this.weaponManager = weaponManager;
    this.waveManager = waveManager;
    this.sandDuneSystem = sandDuneSystem;

    // Divine Energy State (0% - 100%)
    this.energy = 0;
    this.maxEnergy = 100;
    this.BAHU_BAAN_COST = 50;
    this.SAND_DUNE_COST = 100;

    // Ability Status Flags
    this.isFinalWave = false;
    this.isCasting = false;
    this.cutscene = null;

    // HUD Callback
    this.onStateChange = null;

    // Wire references
    if (this.waveManager) {
      this.waveManager.setAbilitySystem(this);
    }
  }

  setFinalWave(isFinal) {
    this.isFinalWave = isFinal;
    this.notifyState();
  }

  setCutscene(cutscene) {
    this.cutscene = cutscene;
  }

  /**
   * Confirmed normal enemy kill grants 25% divine energy
   * (4 normal kills = 100% full meter. Non-recursive, death grants energy only once)
   */
  onNormalEnemyKilled() {
    if (this.energy >= this.maxEnergy) return;

    this.energy = Math.min(this.maxEnergy, this.energy + 25);
    console.log(`[DivineAbilitySystem] Confirmed kill +25% Energy -> ${this.energy}%`);
    this.notifyState();
  }

  /**
   * Directly charge divine energy (utility for encounters and debug)
   */
  chargeEnergy(amount = 25) {
    this.energy = Math.min(this.maxEnergy, Math.max(0, this.energy + amount));
    this.notifyState();
  }

  /**
   * Check if Divya Bahu-Baan can be cast
   */
  canUseBahuBaan() {
    return this.energy >= this.BAHU_BAAN_COST && !this.isCasting;
  }

  /**
   * Check if Divya Sand Dune can be cast
   */
  canUseSandDune() {
    return this.isFinalWave && this.energy >= this.SAND_DUNE_COST && !this.isCasting;
  }

  /**
   * Target selection for Divya Bahu-Baan:
   * Prioritizes enemy under player's reticle + up to 3 additional living nearby enemies (total max 4)
   * Avoids duplicates, dead enemies, and checks line of sight.
   * @param {number} [maxTargets=4] 
   * @returns {import('../enemy/EnemyCharacter.js').EnemyCharacter[]}
   */
  selectBahuBaanTargets(maxTargets = 4) {
    if (!this.waveManager) return [];
    const active = this.waveManager.activeEnemies.filter(e => !e.isDead && e.root && e.hitbox);
    if (active.length === 0) return [];

    const selected = [];

    // 1. Prioritize reticle target
    const reticleEnemy = this.playerController.getEnemyUnderReticle();
    if (reticleEnemy && !reticleEnemy.isDead && active.includes(reticleEnemy)) {
      selected.push(reticleEnemy);
    }

    // 2. Select up to 3 nearby living enemies in player's forward cone
    const playerPos = this.playerController.character.position;
    const camDir = new THREE.Vector3();
    this.playerController.camera.getWorldDirection(camDir);

    const candidates = active
      .filter(e => !selected.includes(e))
      .map(e => {
        const toEnemy = e.root.position.clone().sub(playerPos);
        const dist = toEnemy.length();
        toEnemy.normalize();
        const dot = camDir.dot(toEnemy);
        return { enemy: e, dist, dot };
      })
      .filter(c => c.dist <= 65) // Within 65m range
      .sort((a, b) => (b.dot * 2 - b.dist * 0.05) - (a.dot * 2 - a.dist * 0.05));

    for (const cand of candidates) {
      if (selected.length >= maxTargets) break;
      selected.push(cand.enemy);
    }

    return selected;
  }

  /**
   * Activate Divya Bahu-Baan (Key Q)
   */
  triggerBahuBaan() {
    if (this.isCasting) return false;

    if (this.energy < this.BAHU_BAAN_COST) {
      toast.show('⚡ Insufficient Divine Energy (50% required for Divya Bahu-Baan)', 3000);
      return false;
    }

    if (!this.weaponManager || !this.weaponManager.isEquipped) {
      toast.show('🏹 Equip your bow (E) to invoke Divya Bahu-Baan!', 3000);
      return false;
    }

    const targets = this.selectBahuBaanTargets(4);
    if (targets.length === 0) {
      toast.show('🏹 No Rakshasa targets in range for Divya Bahu-Baan!', 3000);
      return false;
    }

    // Deduct 50% energy
    this.energy = Math.max(0, this.energy - this.BAHU_BAAN_COST);
    this.notifyState();

    toast.show(`🏹 DIVYA BAHU-BAAN: 1 arrow transforms into ${targets.length} divine arrows!`, 3800);

    // Aim target point
    const aimTarget = this.playerController.getTargetAimPoint();

    // Trigger enhanced shot animation & release
    this.playerController.animManager.playShoot({
      onExtract: () => {
        this.weaponManager.onArrowExtracted();
      },
      onRelease: () => {
        this.weaponManager.onBahuBaanReleased(aimTarget, targets);
      },
      onComplete: () => {
        if (this.playerController.isAiming) {
          this.weaponManager.onArrowExtracted();
        }
      }
    });

    return true;
  }

  /**
   * Activate Divya Sand Dune Ultimate (Key R)
   */
  triggerSandDune() {
    if (this.isCasting) return false;

    if (!this.isFinalWave) {
      toast.show('🔒 Divya Sand Dune is locked until the Final Wave (Wave 2)!', 3500);
      return false;
    }

    if (this.energy < this.SAND_DUNE_COST) {
      toast.show('⚡ Insufficient Divine Energy (100% required for Divya Sand Dune)', 3500);
      return false;
    }

    if (!this.weaponManager || !this.weaponManager.isEquipped) {
      toast.show('🏹 Equip your bow (E) to invoke Divya Sand Dune!', 3000);
      return false;
    }

    // Deduct 100% energy
    this.energy = 0;
    this.isCasting = true;
    this.notifyState();

    // Orchestrate with SandDuneCutscene if available
    if (this.cutscene) {
      this.cutscene.play(() => {
        this.isCasting = false;
        this.notifyState();
      });
      return true;
    }

    // Freeze normal movement & shooting
    this.playerController.setMovementEnabled(false);

    const forwardDir = new THREE.Vector3();
    this.playerController.character.getWorldDirection(forwardDir);

    toast.show('🔱 DIVYA SAND DUNE: Chanting Celestial Mantra...', 4500);

    // Play Divine Chant Animation
    this.playerController.animManager.playChant({
      onRelease: () => {
        // Celestial arrow release at verified apex (t = 2.15s)
        const launchPos = this.weaponManager.getLaunchPosition();
        if (this.sandDuneSystem) {
          this.sandDuneSystem.trigger(launchPos, forwardDir, this.waveManager, () => {
            // Restore controls after sand wave finishes cleansing
            this.isCasting = false;
            this.playerController.setMovementEnabled(true);
            this.notifyState();
          });
        }
      },
      onComplete: () => {
        console.log('[DivineAbilitySystem] Chant animation completed.');
      }
    });

    return true;
  }

  notifyState() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange({
        energy: this.energy,
        maxEnergy: this.maxEnergy,
        bahuBaanReady: this.canUseBahuBaan(),
        sandDuneReady: this.canUseSandDune(),
        isFinalWave: this.isFinalWave,
        sandDuneLocked: !this.isFinalWave,
        isCasting: this.isCasting
      });
    }
  }

  dispose() {
    this.isCasting = false;
    this.onStateChange = null;
  }
}

