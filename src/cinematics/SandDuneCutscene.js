import * as THREE from 'three';
import { ASSET_PATHS } from '../assets/assetManifest.js';
import { audioDirector } from '../audio/AudioDirector.js';
import { toast } from '../ui/ToastManager.js';

/**
 * SandDuneCutscene
 * Dedicated cinematic director for the Divya Sand Dune Ultimate ability.
 * Orchestrates a 29.16-second cutscene synchronized with the epic soundtrack:
 * 
 * Scene 1 (0.0s – 5.0s):   The Invocation (Dramatic close-up on Shri Ram's face, warm amber lighting, subtle sand swirl)
 * Scene 2 (5.0s – 13.0s):  Divine Chant (Bow raised skyward, multi-angle framing, intensifying golden vortex)
 * Scene 3 (13.0s – 18.0s): Celestial Arrow (Apex release at t=13s, woosh SFX, glowing arrow ascending into clouds)
 * Scene 4 (18.0s – 25.5s): Divine Sand Dune Manifestation (Wide battlefield view, rolling ground wave conforming to Rapier terrain)
 * Scene 5 (25.5s – 29.16s): Enemy Destruction & Aftermath (Wave strikes remaining enemies, dust settles, lighting & camera restored)
 */
export class SandDuneCutscene {
  /**
   * @param {import('../scenes/GameplayScene.js').GameplayScene} gameplayScene 
   */
  constructor(gameplayScene) {
    this.gameplayScene = gameplayScene;
    this.scene = gameplayScene.threeScene;
    this.camera = gameplayScene.camera;
    this.physics = gameplayScene.physics;

    // Timeline Configuration (Exact match to sand_ability.mp3 duration)
    this.TOTAL_DURATION = 29.16;
    this.isPlaying = false;
    this.elapsedTime = 0;
    this.onCompleteCallback = null;

    // Pre-allocated Transform Math Objects (Zero runtime heap allocations)
    this._camPos = new THREE.Vector3();
    this._camTarget = new THREE.Vector3();
    this._heroPos = new THREE.Vector3();
    this._heroFwd = new THREE.Vector3();
    this._heroRight = new THREE.Vector3();
    this._savedCamPos = new THREE.Vector3();
    this._savedCamTarget = new THREE.Vector3();
    this._savedCamFOV = 45;

    // Lighting Baseline & Target Colors
    this._savedSunColor = new THREE.Color();
    this._savedSunIntensity = 3.2;
    this._savedHemiSky = new THREE.Color();
    this._savedHemiGround = new THREE.Color();
    this._savedHemiIntensity = 1.9;
    this._savedAmbientColor = new THREE.Color();
    this._savedAmbientIntensity = 1.4;

    this._amberSunColor = new THREE.Color(0xffc466);
    this._amberHemiSky = new THREE.Color(0xffd9a8);
    this._amberHemiGround = new THREE.Color(0x8f6236);
    this._amberAmbientColor = new THREE.Color(0xb37a3b);

    // Celestial Sky Arrow
    this.skyArrowMesh = null;
    this.skyArrowGlow = null;
    this.skyArrowPos = new THREE.Vector3();
    this.skyArrowVelocity = new THREE.Vector3(0, 42.0, 0);
    this.isSkyArrowActive = false;

    // Swirling Invocation Sand Particles
    this.swirlParticles = null;
    this.swirlPositions = null;
    this.swirlData = [];
    this.swirlCount = 140;

    // Tracking flags for discrete timeline milestones
    this.chantTriggered = false;
    this.arrowLaunched = false;
    this.sandWaveTriggered = false;
    this.enemiesCleaned = false;

    this.initCutsceneVFX();
  }

  initCutsceneVFX() {
    // 1. Swirling Sand Aura (Pre-allocated points buffer)
    const swirlGeom = new THREE.BufferGeometry();
    this.swirlPositions = new Float32Array(this.swirlCount * 3);

    for (let i = 0; i < this.swirlCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.6 + Math.random() * 1.8;
      const height = Math.random() * 2.4;
      const speed = 1.8 + Math.random() * 2.2;

      this.swirlData.push({ angle, radius, height, speed });
      this.swirlPositions[i * 3 + 0] = Math.cos(angle) * radius;
      this.swirlPositions[i * 3 + 1] = height;
      this.swirlPositions[i * 3 + 2] = Math.sin(angle) * radius;
    }

    swirlGeom.setAttribute('position', new THREE.BufferAttribute(this.swirlPositions, 3));

    const swirlTexture = typeof document !== 'undefined'
      ? new THREE.TextureLoader().load(ASSET_PATHS.VFX.SAND_STORM || ASSET_PATHS.VFX.TORNADO_SMOKE)
      : new THREE.Texture();

    const swirlMat = new THREE.PointsMaterial({
      map: swirlTexture,
      size: 0.95,
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.swirlParticles = new THREE.Points(swirlGeom, swirlMat);
    this.swirlParticles.visible = false;
    this.scene.add(this.swirlParticles);

    // 2. Celestial Sky Arrow Mesh
    const arrowGeom = new THREE.CylinderGeometry(0.022, 0.022, 1.1, 8);
    const arrowMat = new THREE.MeshBasicMaterial({
      color: 0xfff0aa,
      transparent: true,
      opacity: 0.95
    });
    this.skyArrowMesh = new THREE.Mesh(arrowGeom, arrowMat);
    this.skyArrowMesh.visible = false;

    // Radiant Golden Glow Sprite
    const glowTex = typeof document !== 'undefined'
      ? new THREE.TextureLoader().load(ASSET_PATHS.VFX.ARROW_TIP_GLOW)
      : new THREE.Texture();
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffd966,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.skyArrowGlow = new THREE.Sprite(glowMat);
    this.skyArrowGlow.scale.set(1.4, 1.4, 1.4);
    this.skyArrowMesh.add(this.skyArrowGlow);

    this.scene.add(this.skyArrowMesh);
  }

  /**
   * Save current environmental lighting and camera transforms
   */
  captureBaseline() {
    this._savedCamPos.copy(this.camera.position);
    this._savedCamFOV = this.camera.fov;

    // Calculate current look target
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this._savedCamTarget.copy(this.camera.position).addScaledVector(dir, 10.0);

    // Capture Scene Lights
    if (this.gameplayScene.sunLight) {
      this._savedSunColor.copy(this.gameplayScene.sunLight.color);
      this._savedSunIntensity = this.gameplayScene.sunLight.intensity;
    }
    if (this.gameplayScene.hemiLight) {
      this._savedHemiSky.copy(this.gameplayScene.hemiLight.color);
      this._savedHemiGround.copy(this.gameplayScene.hemiLight.groundColor);
      this._savedHemiIntensity = this.gameplayScene.hemiLight.intensity;
    }
    if (this.gameplayScene.ambientLight) {
      this._savedAmbientColor.copy(this.gameplayScene.ambientLight.color);
      this._savedAmbientIntensity = this.gameplayScene.ambientLight.intensity;
    }
  }

  /**
   * Begin the 29.16-second Divya Sand Dune Cinematic
   * @param {Function} onComplete 
   */
  play(onComplete) {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.elapsedTime = 0;
    this.onCompleteCallback = onComplete;

    this.chantTriggered = false;
    this.arrowLaunched = false;
    this.sandWaveTriggered = false;
    this.enemiesCleaned = false;

    // 1. Lock Player Movement & Take Control of Camera
    if (this.gameplayScene.playerController) {
      this.gameplayScene.playerController.setMovementEnabled(false);
      this.gameplayScene.playerController.setCameraControlled(true);

      if (this.gameplayScene.weaponManager) {
        this.gameplayScene.weaponManager.isEquipped = true;
        if (this.gameplayScene.weaponManager.bowPivot) {
          this.gameplayScene.weaponManager.bowPivot.visible = true;
        }
      }

      if (this.gameplayScene.playerController.animManager) {
        this.gameplayScene.playerController.animManager.playChant({
          onRelease: () => {},
          onComplete: () => {}
        });
        this.chantTriggered = true;
      }
    }

    // 2. Capture Baselines
    this.captureBaseline();

    // 3. Start Epic Soundtrack
    audioDirector.playSandDuneUltimate({
      onEnded: () => {
        console.log('[SandDuneCutscene] Audio playback concluded.');
      }
    });

    // 4. Activate Swirl Particles
    if (this.swirlParticles) {
      this.swirlParticles.visible = true;
      this.swirlParticles.material.opacity = 0.0;
    }

    toast.show('🔱 DIVYA SAND DUNE: Celestial Invocation Commences...', 4000);
    console.log('[SandDuneCutscene] Divya Sand Dune Cinematic initiated (29.16s).');
  }

  update(delta) {
    if (!this.isPlaying) return;

    this.elapsedTime += delta;
    const t = this.elapsedTime;

    // Get live Shri Ram Transform
    const hero = this.gameplayScene.ramHero;
    if (hero) {
      this._heroPos.copy(hero.position);
      hero.getWorldDirection(this._heroFwd);
      this._heroRight.set(-this._heroFwd.z, 0, this._heroFwd.x).normalize();
    } else {
      this._heroPos.set(0, 0, 0);
      this._heroFwd.set(0, 0, 1);
      this._heroRight.set(1, 0, 0);
    }

    // -------------------------------------------------------------------------
    // SCENE 1: THE INVOCATION (t = 0.0s – 5.0s)
    // -------------------------------------------------------------------------
    if (t < 5.0) {
      const p = Math.min(1.0, t / 4.5);
      const ease = this.smootherstep(p);

      // Camera transitions from gameplay camera to dramatic close-up of Shri Ram's face
      const targetPos = this._heroPos.clone()
        .addScaledVector(this._heroFwd, 1.35)
        .addScaledVector(this._heroRight, -0.42)
        .add(new THREE.Vector3(0, 1.68, 0));

      const targetLook = this._heroPos.clone().add(new THREE.Vector3(0, 1.76, 0));

      this._camPos.lerpVectors(this._savedCamPos, targetPos, ease);
      this._camTarget.lerpVectors(this._savedCamTarget, targetLook, ease);
      this.camera.position.copy(this._camPos);
      this.camera.lookAt(this._camTarget);
      this.camera.fov = THREE.MathUtils.lerp(this._savedCamFOV, 42, ease);
      this.camera.updateProjectionMatrix();

      // Atmospheric Lighting: Warm amber golden shift begins
      this.updateLighting(p * 0.5);

      // Subtle swirling sand particles around Shri Ram
      if (this.swirlParticles) {
        this.swirlParticles.material.opacity = Math.min(0.65, t * 0.16);
        this.updateSwirlParticles(delta, 1.2, 0.4);
      }
    }

    // -------------------------------------------------------------------------
    // SCENE 2: DIVINE CHANT & SKY AIM (t = 5.0s – 13.0s)
    // -------------------------------------------------------------------------
    else if (t >= 5.0 && t < 13.0) {
      // Trigger Chant Animation once at t=5.0s
      if (!this.chantTriggered) {
        this.chantTriggered = true;
        if (this.gameplayScene.playerController?.animManager) {
          this.gameplayScene.playerController.animManager.playChant({
            onRelease: () => {},
            onComplete: () => {}
          });
        }
        toast.show('🔱 Shri Ram invokes the Celestial Astram...', 3500);
      }

      const scene2Progress = (t - 5.0) / 8.0;

      // Shot 2A (5.0s - 8.5s): Medium three-quarters shot as bow rises
      if (t < 8.5) {
        const subP = (t - 5.0) / 3.5;
        const ease = this.smootherstep(subP);

        const startPos = this._heroPos.clone()
          .addScaledVector(this._heroFwd, 1.35)
          .addScaledVector(this._heroRight, -0.42)
          .add(new THREE.Vector3(0, 1.68, 0));
        const endPos = this._heroPos.clone()
          .addScaledVector(this._heroFwd, 1.45)
          .addScaledVector(this._heroRight, 1.15)
          .add(new THREE.Vector3(0, 1.48, 0));

        this._camPos.lerpVectors(startPos, endPos, ease);
        this._camTarget.copy(this._heroPos).add(new THREE.Vector3(0, 1.72, 0));
        this.camera.position.copy(this._camPos);
        this.camera.lookAt(this._camTarget);
      }
      // Shot 2B (8.5s - 13.0s): Dramatic low-angle hero shot showing raised bow against the sky
      else {
        const subP = (t - 8.5) / 4.5;
        const ease = this.smootherstep(subP);

        const startPos = this._heroPos.clone()
          .addScaledVector(this._heroFwd, 1.45)
          .addScaledVector(this._heroRight, 1.15)
          .add(new THREE.Vector3(0, 1.48, 0));
        const endPos = this._heroPos.clone()
          .addScaledVector(this._heroFwd, -0.75)
          .addScaledVector(this._heroRight, -0.65)
          .add(new THREE.Vector3(0, 0.78, 0));

        const startLook = this._heroPos.clone().add(new THREE.Vector3(0, 1.72, 0));
        const endLook = this._heroPos.clone()
          .addScaledVector(this._heroFwd, 0.35)
          .add(new THREE.Vector3(0, 3.1, 0));

        this._camPos.lerpVectors(startPos, endPos, ease);
        this._camTarget.lerpVectors(startLook, endLook, ease);
        this.camera.position.copy(this._camPos);
        this.camera.lookAt(this._camTarget);
      }

      // Warm amber lighting intensifies to peak
      this.updateLighting(0.5 + scene2Progress * 0.5);

      // Swirling particles accelerate into a golden spiral vortex
      if (this.swirlParticles) {
        this.swirlParticles.material.opacity = Math.min(0.85, 0.65 + scene2Progress * 0.2);
        this.updateSwirlParticles(delta, 3.2, 0.9);
      }
    }

    // -------------------------------------------------------------------------
    // SCENE 3: CELESTIAL ARROW ASCENT (t = 13.0s – 18.0s)
    // -------------------------------------------------------------------------
    else if (t >= 13.0 && t < 18.0) {
      // Apex release event at t=13.0s
      if (!this.arrowLaunched) {
        this.arrowLaunched = true;
        this.isSkyArrowActive = true;
        audioDirector.playWoosh();

        // Position sky arrow at bow release point
        const launchPos = this.gameplayScene.weaponManager?.getLaunchPosition() ||
          this._heroPos.clone().add(new THREE.Vector3(0, 2.3, 0));
        this.skyArrowPos.copy(launchPos);

        if (this.skyArrowMesh) {
          this.skyArrowMesh.position.copy(this.skyArrowPos);
          this.skyArrowMesh.visible = true;
          this.skyArrowMesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0.08, 0.99, 0.08).normalize()
          );
        }

        toast.show('⚡ THE CELESTIAL ARROW ASCENDS INTO THE HEAVENS!', 3200);
      }

      const ascentP = (t - 13.0) / 5.0;

      // Update Sky Arrow Position (Shoots into the cloud canopy)
      this.skyArrowPos.addScaledVector(this.skyArrowVelocity, delta);
      if (this.skyArrowMesh) {
        this.skyArrowMesh.position.copy(this.skyArrowPos);
        if (this.skyArrowGlow) {
          const pulse = 1.4 + Math.sin(t * 22.0) * 0.35;
          this.skyArrowGlow.scale.set(pulse, pulse, pulse);
        }
      }

      // Camera tilts upward tracking the rising arrow into the zenith
      const camOrigin = this._heroPos.clone()
        .addScaledVector(this._heroFwd, -1.8)
        .addScaledVector(this._heroRight, -0.5)
        .add(new THREE.Vector3(0, 1.1, 0));

      const arrowLookTarget = this.skyArrowPos.clone();
      this.camera.position.copy(camOrigin);
      this.camera.lookAt(arrowLookTarget);

      this.updateLighting(1.0);

      // Swirl particles dissipate upward as arrow departs
      if (this.swirlParticles) {
        this.swirlParticles.material.opacity = Math.max(0, 0.85 - ascentP * 1.5);
        this.updateSwirlParticles(delta, 4.5, 1.4);
      }
    }

    // -------------------------------------------------------------------------
    // SCENE 4: DIVINE SAND DUNE MANIFESTATION (t = 18.0s – 25.5s)
    // -------------------------------------------------------------------------
    else if (t >= 18.0 && t < 25.5) {
      if (!this.sandWaveTriggered) {
        this.sandWaveTriggered = true;
        this.isSkyArrowActive = false;
        if (this.skyArrowMesh) this.skyArrowMesh.visible = false;
        audioDirector.playWoosh();

        // Trigger supernatural ground wave in SandDuneSystem
        if (this.gameplayScene.sandDuneSystem) {
          const launchPos = this._heroPos.clone();
          this.gameplayScene.sandDuneSystem.trigger(
            launchPos,
            this._heroFwd,
            this.gameplayScene.enemyWaveManager,
            () => {}
          );
        }

        toast.show('🌪️ SUPERNATURAL SAND DUNE SWEEPS DANDAKARANYA!', 4000);
      }

      const waveP = (t - 18.0) / 7.5;
      const ease = this.smootherstep(waveP);

      // Epic Panoramic Battlefield View (Elevated wide shot overlooking clearing)
      const wideCamStart = this._heroPos.clone()
        .addScaledVector(this._heroFwd, -14.0)
        .addScaledVector(this._heroRight, -10.0)
        .add(new THREE.Vector3(0, 8.8, 0));

      const wideCamEnd = this._heroPos.clone()
        .addScaledVector(this._heroFwd, -11.0)
        .addScaledVector(this._heroRight, -7.5)
        .add(new THREE.Vector3(0, 7.2, 0));

      const battlefieldLook = this._heroPos.clone()
        .addScaledVector(this._heroFwd, 16.0 + waveP * 12.0)
        .add(new THREE.Vector3(0, 1.2, 0));

      this._camPos.lerpVectors(wideCamStart, wideCamEnd, ease);
      this.camera.position.copy(this._camPos);
      this.camera.lookAt(battlefieldLook);
      this.camera.fov = 56;
      this.camera.updateProjectionMatrix();

      this.updateLighting(1.0);
    }

    // -------------------------------------------------------------------------
    // SCENE 5: ENEMY DESTRUCTION & AFTERMATH (t = 25.5s – 29.16s+)
    // -------------------------------------------------------------------------
    else if (t >= 25.5) {
      const settleP = Math.min(1.0, (t - 25.5) / (this.TOTAL_DURATION - 25.5));
      const ease = this.smootherstep(settleP);

      // Coordinate lethal defeat of all final wave enemies as the wave crests over them
      if (!this.enemiesCleaned && t >= 26.2) {
        this.enemiesCleaned = true;
        this.defeatEnemiesInPath();
      }

      // Smooth camera glide returning behind Shri Ram's shoulder
      const finalLook = this._heroPos.clone().add(new THREE.Vector3(0, 1.45, 0));

      this._camPos.lerpVectors(
        this._heroPos.clone().addScaledVector(this._heroFwd, -7.0).add(new THREE.Vector3(0, 3.8, 0)),
        this._savedCamPos,
        ease
      );
      this._camTarget.lerpVectors(finalLook, this._savedCamTarget, ease);

      this.camera.position.copy(this._camPos);
      this.camera.lookAt(this._camTarget);
      this.camera.fov = THREE.MathUtils.lerp(56, this._savedCamFOV, ease);
      this.camera.updateProjectionMatrix();

      // Atmospheric lighting smoothly returns to natural pine forest daylight
      this.updateLighting(1.0 - ease);

      // Final completion when timeline finishes
      if (t >= this.TOTAL_DURATION) {
        this.completeCutscene();
      }
    }
  }

  /**
   * Defeat all remaining living Aasura enemies with authentic directional death animations,
   * cancel pending unspawned enemies in Wave 2, and update HUD defeated count cleanly.
   */
  defeatEnemiesInPath() {
    const waveMgr = this.gameplayScene.enemyWaveManager;
    if (!waveMgr) return;

    console.log('[SandDuneCutscene] Defeating all remaining Dandakaranya enemies in final wave...');

    // 1. Defeat active living enemies with lethal earth shockwave
    const active = waveMgr.activeEnemies.filter(e => !e.isDead && e.root);
    active.forEach(enemy => {
      const knockbackDir = new THREE.Vector3(0, 0, 1);
      enemy.takeDamage(100, knockbackDir, true); // Flagged as isAbilityKill
    });

    // 2. Cancel pending unspawned enemies in Wave 2 and conclude encounter
    waveMgr.cancelPendingSpawnsAndComplete();

    toast.show('🏆 VICTORY OVER THE DANDAKARANYA HORDE!', 5000);
  }

  /**
   * Animate swirling invocation sand particles around Shri Ram
   */
  updateSwirlParticles(delta, speedMultiplier, heightRise) {
    if (!this.swirlPositions || !this.swirlParticles) return;

    const heroPos = this._heroPos;
    this.swirlParticles.position.copy(heroPos);

    for (let i = 0; i < this.swirlCount; i++) {
      const data = this.swirlData[i];
      data.angle += delta * data.speed * speedMultiplier;
      data.height += delta * heightRise;

      if (data.height > 3.2) {
        data.height = 0.1;
        data.radius = 0.5 + Math.random() * 1.6;
      }

      this.swirlPositions[i * 3 + 0] = Math.cos(data.angle) * data.radius;
      this.swirlPositions[i * 3 + 1] = data.height;
      this.swirlPositions[i * 3 + 2] = Math.sin(data.angle) * data.radius;
    }

    this.swirlParticles.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Modulate environmental lighting smoothly without adding/removing dynamic lights
   */
  updateLighting(progress) {
    const p = Math.max(0, Math.min(1, progress));

    if (this.gameplayScene.sunLight) {
      this.gameplayScene.sunLight.color.lerpColors(this._savedSunColor, this._amberSunColor, p);
      this.gameplayScene.sunLight.intensity = THREE.MathUtils.lerp(this._savedSunIntensity, 4.4, p);
    }

    if (this.gameplayScene.hemiLight) {
      this.gameplayScene.hemiLight.color.lerpColors(this._savedHemiSky, this._amberHemiSky, p);
      this.gameplayScene.hemiLight.groundColor.lerpColors(this._savedHemiGround, this._amberHemiGround, p);
      this.gameplayScene.hemiLight.intensity = THREE.MathUtils.lerp(this._savedHemiIntensity, 2.2, p);
    }

    if (this.gameplayScene.ambientLight) {
      this.gameplayScene.ambientLight.color.lerpColors(this._savedAmbientColor, this._amberAmbientColor, p);
      this.gameplayScene.ambientLight.intensity = THREE.MathUtils.lerp(this._savedAmbientIntensity, 1.8, p);
    }
  }

  /**
   * Conclude cutscene and restore all normal gameplay states
   */
  completeCutscene() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    this.elapsedTime = 0;

    // 1. Hide Temporary Cutscene Meshes
    if (this.swirlParticles) {
      this.swirlParticles.visible = false;
      this.swirlParticles.material.opacity = 0;
    }
    if (this.skyArrowMesh) {
      this.skyArrowMesh.visible = false;
    }

    // 2. Restore Exact Initial Lighting
    this.updateLighting(0.0);

    // 3. Restore Exact Gameplay Camera
    this.camera.position.copy(this._savedCamPos);
    this.camera.lookAt(this._savedCamTarget);
    this.camera.fov = this._savedCamFOV;
    this.camera.updateProjectionMatrix();

    // 4. Restore Player Locomotion, Controls, and Camera Control
    if (this.gameplayScene.playerController) {
      this.gameplayScene.playerController.setCameraControlled(false);
      this.gameplayScene.playerController.setMovementEnabled(true);
      if (this.gameplayScene.playerController.animManager) {
        this.gameplayScene.playerController.animManager.isChanting = false;
        this.gameplayScene.playerController.animManager.playState('idle');
      }
    }

    console.log('[SandDuneCutscene] Divya Sand Dune cutscene completed cleanly. Normal gameplay restored.');

    // 5. Fire Completion Callback
    if (typeof this.onCompleteCallback === 'function') {
      const cb = this.onCompleteCallback;
      this.onCompleteCallback = null;
      cb();
    }
  }

  smootherstep(x) {
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  dispose() {
    this.completeCutscene();

    if (this.swirlParticles) {
      this.scene.remove(this.swirlParticles);
      this.swirlParticles.geometry.dispose();
      this.swirlParticles.material.dispose();
      this.swirlParticles = null;
    }

    if (this.skyArrowMesh) {
      this.scene.remove(this.skyArrowMesh);
      this.skyArrowMesh.geometry.dispose();
      this.skyArrowMesh.material.dispose();
      this.skyArrowMesh = null;
    }
  }
}
