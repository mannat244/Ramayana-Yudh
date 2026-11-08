import * as THREE from 'three';
import { ASSET_PATHS } from '../assets/assetManifest.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { PlayerController } from '../character/PlayerController.js';
import { WeaponManager } from '../weapons/WeaponManager.js';
import { EnemyOptimizer } from '../enemy/EnemyOptimizer.js';
import { EnemyWaveManager } from '../enemy/EnemyWaveManager.js';
import { DivineAbilitySystem } from '../weapons/DivineAbilitySystem.js';
import { SandDuneSystem } from '../vfx/SandDuneSystem.js';
import { SandDuneCutscene } from '../cinematics/SandDuneCutscene.js';
import { audioDirector } from '../audio/AudioDirector.js';
import { PerformanceProfiler } from '../core/PerformanceProfiler.js';
import { toast } from '../ui/ToastManager.js';

export class GameplayScene {
  /**
   * @param {import('../core/AssetLoader.js').AssetLoader} assetLoader 
   */
  constructor(assetLoader) {
    this.assetLoader = assetLoader;
    this.sceneManager = null;

    // Three.js Scene
    this.threeScene = new THREE.Scene();

    // Natural Third-Person Follow Camera
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 2.2, 4.5);

    // Physics Engine Architecture
    this.physics = new PhysicsWorld();

    // Scene Graph References
    this.environmentModel = null;
    this.terrainMesh = null;
    this.skyDomeMesh = null;
    this.ramHero = null;
    this.playerController = null;
    this.isLoaded = false;

    // Enemy Architecture (Milestone 5.1 Optimization & First Battle Wave)
    this.enemyOptimizer = new EnemyOptimizer();
    this.enemyWaveManager = null;
    this.divineAbilitySystem = null;
    this.sandDuneSystem = null;
    this.sandDuneCutscene = null;
    this.profiler = null;

    // Lighting References
    this.sunLight = null;
    this.hemiLight = null;
    this.ambientLight = null;
    this.rimLight = null;

    // UI & Controls State
    this.hudContainer = null;
    this.locationBanner = null;
    this.wavePanel = null;
    this.waveDefeatedEl = null;
    this.waveTotalEl = null;
    this.waveActiveEl = null;

    this.setupLighting();
    this.initHUD();
  }

  setSceneManager(sceneManager) {
    this.sceneManager = sceneManager;
  }

  setupLighting() {
    // 1. Natural forest canopy hemisphere light: soft sky blue above, warm earth green below
    this.hemiLight = new THREE.HemisphereLight(0xd8eeff, 0x55683e, 1.9);
    this.hemiLight.position.set(0, 50, 0);
    this.threeScene.add(this.hemiLight);

    // 2. Main Sun Light filtering through pine branches (warm golden morning sun)
    // Milestone 5.2 GPU Optimization: 1024x1024 shadow map with tight camera bounds
    // Cuts VRAM & shadow rasterization fill-rate by 75% while maintaining crisp character contact shadows
    this.sunLight = new THREE.DirectionalLight(0xfff6e8, 3.2);
    this.sunLight.position.set(35, 50, 25);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 110;
    this.sunLight.shadow.camera.left = -26;
    this.sunLight.shadow.camera.right = 26;
    this.sunLight.shadow.camera.top = 26;
    this.sunLight.shadow.camera.bottom = -26;
    this.sunLight.shadow.bias = -0.0004;
    this.threeScene.add(this.sunLight);

    // 3. Ambient light ensuring shaded areas under pine trees remain rich, legible, and daylight-filled
    this.ambientLight = new THREE.AmbientLight(0x6a788c, 1.4);
    this.threeScene.add(this.ambientLight);

    // 4. Subtle back-rim light to accentuate character silhouette against dark pine background
    this.rimLight = new THREE.DirectionalLight(0xffeedb, 1.0);
    this.rimLight.position.set(-30, 30, -25);
    this.threeScene.add(this.rimLight);
  }

  initHUD() {
    this.hudContainer = document.createElement('div');
    this.hudContainer.id = 'gameplay-hud';
    this.hudContainer.className = 'scene-overlay hidden';

    this.hudContainer.innerHTML = `
      <div class="hud-top-gradient"></div>

      <div class="hud-top-bar">
        <div class="hud-location" id="hud-location-banner">
          <div class="location-badge">BATTLEFIELD LOCALE</div>
          <h1 class="location-title">DANDAKARANYA FOREST</h1>
          <div class="location-sanskrit">दण्डकारण्य वन • रणभूमि</div>
        </div>

        <div class="hud-wave-panel" id="hud-wave-panel">
          <div class="wave-badge">BATTLE ENCOUNTER</div>
          <div class="wave-title" id="hud-wave-title">WAVE 1 — DANDAKARANYA SCOUTS</div>
          <div class="wave-stats">
            <span class="wave-stat-item">Defeated: <strong id="hud-wave-defeated">0</strong> / <span id="hud-wave-total">8</span></span>
            <span class="wave-stat-separator">•</span>
            <span class="wave-stat-item">Active Threats: <strong id="hud-wave-active">0</strong></span>
          </div>
        </div>
      </div>

      <div class="hud-bottom-bar">
        <button class="menu-btn secondary-btn small-btn" id="btn-gameplay-back">
          <span class="btn-bracket">⟨</span>
          <span class="btn-text">RETURN TO MAIN MENU</span>
          <span class="btn-bracket">⟩</span>
        </button>
      </div>

      <!-- Milestone 6: Minimalist Divine Energy Interface -->
      <div class="hud-divine-panel" id="hud-divine-panel">
        <div class="divine-energy-header">
          <span class="divine-energy-label">DIVINE ENERGY • दिव्य शक्ति</span>
          <span class="divine-energy-value" id="hud-energy-val">0%</span>
        </div>
        <div class="divine-energy-bar-track">
          <div class="divine-energy-bar-fill" id="hud-energy-fill" style="width: 0%;"></div>
        </div>
        <div class="divine-abilities-container">
          <!-- Ability 1: Divya Bahu-Baan -->
          <div class="ability-card locked" id="ability-bahu-baan">
            <div class="ability-key">Q</div>
            <div class="ability-info">
              <div class="ability-name">DIVYA BAHU-BAAN</div>
              <div class="ability-sanskrit">दिव्य बहु-बाण • Arrow Multiplication</div>
            </div>
            <div class="ability-cost-badge">50%</div>
            <div class="ability-status" id="status-bahu-baan">CHARGING</div>
          </div>

          <!-- Ability 2: Divya Sand Dune -->
          <div class="ability-card locked" id="ability-sand-dune">
            <div class="ability-key">R</div>
            <div class="ability-info">
              <div class="ability-name">DIVYA SAND DUNE</div>
              <div class="ability-sanskrit">रेत की लहर • Supernatural Wave</div>
            </div>
            <div class="ability-cost-badge">100%</div>
            <div class="ability-status" id="status-sand-dune">LOCKED (WAVE 1)</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.hudContainer);
    this.locationBanner = this.hudContainer.querySelector('#hud-location-banner');
    this.wavePanel = this.hudContainer.querySelector('#hud-wave-panel');
    this.waveTitleEl = this.hudContainer.querySelector('#hud-wave-title');
    this.waveDefeatedEl = this.hudContainer.querySelector('#hud-wave-defeated');
    this.waveTotalEl = this.hudContainer.querySelector('#hud-wave-total');
    this.waveActiveEl = this.hudContainer.querySelector('#hud-wave-active');

    // Divine Ability HUD Elements
    this.energyValEl = this.hudContainer.querySelector('#hud-energy-val');
    this.energyFillEl = this.hudContainer.querySelector('#hud-energy-fill');
    this.bahuBaanCard = this.hudContainer.querySelector('#ability-bahu-baan');
    this.bahuBaanStatus = this.hudContainer.querySelector('#status-bahu-baan');
    this.sandDuneCard = this.hudContainer.querySelector('#ability-sand-dune');
    this.sandDuneStatus = this.hudContainer.querySelector('#status-sand-dune');

    const backBtn = this.hudContainer.querySelector('#btn-gameplay-back');
    backBtn.addEventListener('click', () => {
      if (this.sceneManager) {
        this.sceneManager.switchScene('mainMenu');
      }
    });
  }

  updateWaveUI(progress) {
    if (this.waveTitleEl) {
      this.waveTitleEl.textContent = progress.wave === 1 
        ? 'WAVE 1 — DANDAKARANYA SCOUTS' 
        : 'WAVE 2 — FINAL STAND';
    }
    if (this.waveDefeatedEl) this.waveDefeatedEl.textContent = progress.defeated;
    if (this.waveTotalEl) this.waveTotalEl.textContent = progress.total;
    if (this.waveActiveEl) this.waveActiveEl.textContent = progress.active;
  }

  updateDivineHUD(state) {
    if (this.energyValEl) {
      this.energyValEl.textContent = `${Math.round(state.energy)}%`;
    }
    if (this.energyFillEl) {
      this.energyFillEl.style.width = `${state.energy}%`;
      if (state.energy >= 100) {
        this.energyFillEl.classList.add('full-glow');
      } else {
        this.energyFillEl.classList.remove('full-glow');
      }
    }

    // Bahu-Baan Card (Q)
    if (this.bahuBaanCard && this.bahuBaanStatus) {
      if (state.bahuBaanReady) {
        this.bahuBaanCard.classList.remove('locked');
        this.bahuBaanCard.classList.add('ready');
        this.bahuBaanStatus.textContent = 'READY';
      } else {
        this.bahuBaanCard.classList.remove('ready');
        this.bahuBaanCard.classList.add('locked');
        this.bahuBaanStatus.textContent = 'CHARGING';
      }
    }

    // Sand Dune Card (R)
    if (this.sandDuneCard && this.sandDuneStatus) {
      if (state.sandDuneLocked) {
        this.sandDuneCard.classList.remove('ready', 'charging');
        this.sandDuneCard.classList.add('locked');
        this.sandDuneStatus.textContent = 'LOCKED (WAVE 1)';
      } else if (state.sandDuneReady) {
        this.sandDuneCard.classList.remove('locked', 'charging');
        this.sandDuneCard.classList.add('ready');
        this.sandDuneStatus.textContent = 'READY';
      } else {
        this.sandDuneCard.classList.remove('ready');
        this.sandDuneCard.classList.add('locked', 'charging');
        this.sandDuneStatus.textContent = `CHARGING (${Math.round(state.energy)}%)`;
      }
    }
  }

  async enter() {
    this.hudContainer.classList.remove('hidden');
    this.hudContainer.classList.add('active');

    // Initialize WebAssembly Rapier3D physics engine
    if (!this.physics.isInitialized) {
      await this.physics.init();
    }

    if (!this.isLoaded) {
      await this.loadSceneAssets();
    }

    // External Guidance Warm-up Pass:
    // Precompile all shaders and render 1 warm-up frame before revealing gameplay
    // Completely eliminates the 2.2s first-frame shader compilation & texture upload freeze!
    if (this.sceneManager?.renderer?.threeRenderer) {
      const threeRenderer = this.sceneManager.renderer.threeRenderer;
      try {
        if (typeof threeRenderer.compileAsync === 'function') {
          await threeRenderer.compileAsync(this.threeScene, this.camera);
        } else {
          threeRenderer.compile(this.threeScene, this.camera);
        }
        this.sceneManager.renderer.render(this.threeScene, this.camera);
      } catch (compileErr) {
        console.warn('[GameplayScene] Precompile warning:', compileErr);
      }
    }

    // Milestone 6 Part H: Performance Profiler disabled by default, enabled only with ?debug=1 or ?profiler=1
    const isDebugMode = typeof window !== 'undefined' && 
      (new URLSearchParams(window.location.search).get('debug') === '1' || 
       new URLSearchParams(window.location.search).get('profiler') === '1' || 
       window.__ENABLE_PROFILER__);
    if (isDebugMode && !this.profiler && this.sceneManager?.renderer?.threeRenderer) {
      this.profiler = new PerformanceProfiler(this.sceneManager.renderer.threeRenderer);
      window.__perfProfiler = this.profiler;
    }

    // Reset Shri Ram's spawn position to stable central clearing (0, 0, 0)
    if (this.playerController) {
      this.playerController.resetSpawn(new THREE.Vector3(0, 0, 0), 0);
    }

    // Start battle wave encounter
    if (this.enemyWaveManager) {
      this.enemyWaveManager.startWave();
    }
    if (this.divineAbilitySystem) {
      this.divineAbilitySystem.notifyState();
    }

    // Trigger brief, elegant controls toast notification (auto-dismissed in 5.5s)
    toast.show('WASD — Move  •  SHIFT — Run  •  Hold RMB — Aim  •  LMB — Shoot  •  E — Equip/Stow', 5500);

    // Animate location banner: visible on entry, gently fades out after 5.5s
    if (this.locationBanner) {
      this.locationBanner.classList.remove('fade-out');
      this.locationBanner.classList.add('fade-in');
      setTimeout(() => {
        if (this.locationBanner) {
          this.locationBanner.classList.remove('fade-in');
          this.locationBanner.classList.add('fade-out');
        }
      }, 5500);
    }
  }

  async loadSceneAssets() {
    // 1. Load Pine Forest Environment
    try {
      console.log('[GameplayScene] Streaming Pine Forest environment asset...');
      const gltf = await this.assetLoader.loadGLTF(ASSET_PATHS.ENVIRONMENT.PINE_FOREST);
      if (gltf && gltf.scene) {
        this.environmentModel = gltf.scene;
        this.environmentModel.position.set(0, 0, 0);

        this.environmentModel.traverse((child) => {
          if (child.isMesh) {
            const isSkyDome = child.name === 'obj2' || child.name.includes('obj2') ||
                              (child.geometry && child.geometry.boundingSphere && child.geometry.boundingSphere.radius > 50);

            if (isSkyDome) {
              // Sky Dome enclosure: background render order, no shadows, no depth writing
              this.skyDomeMesh = child;
              child.castShadow = false;
              child.receiveShadow = false;
              child.renderOrder = -1000;

              if (child.material) {
                const skyTex = child.material.map;
                if (skyTex) {
                  skyTex.colorSpace = THREE.SRGBColorSpace;
                  skyTex.needsUpdate = true;
                  child.material = new THREE.MeshBasicMaterial({
                    map: skyTex,
                    side: THREE.DoubleSide, // Crucial: obj2 normals point inwards; DoubleSide renders both
                    depthWrite: false,
                    toneMapped: false,      // Preserves full vibrant daylight sky brightness
                    fog: false
                  });
                } else {
                  child.material.side = THREE.DoubleSide;
                  child.material.depthWrite = false;
                }
              }
            } else if (child.name === 'obj1' || child.name.includes('obj1')) {
              // Forest floor terrain mesh (obj1)
              this.terrainMesh = child;
              child.castShadow = false;
              child.receiveShadow = true;

              if (child.material) {
                if (child.material.map) {
                  child.material.map.colorSpace = THREE.SRGBColorSpace;
                }
                child.material.roughness = 0.85;
                child.material.metalness = 0.05;
                child.material.needsUpdate = true;
              }
            } else {
              // Pine trees and foliage (pine1)
              // Milestone 5.2 Performance Fix: Disable shadow-casting on dense foliage
              // Prevents 116,000 alpha-tested triangles from choking the 2048x2048 shadow map pass
              // Trees still receive dynamic shadows from characters and environment
              child.frustumCulled = true;
              child.castShadow = false;
              child.receiveShadow = true;

              if (child.material) {
                if (child.material.map) {
                  child.material.map.colorSpace = THREE.SRGBColorSpace;
                }
                // Non-metallic foliage reflects natural diffuse daylight instead of absorbing it
                child.material.metalness = 0.05;
                child.material.roughness = 0.75;
                child.material.side = THREE.DoubleSide;
                child.material.alphaTest = 0.30;
                child.material.needsUpdate = true;
              }
            }
          }
        });

        this.threeScene.add(this.environmentModel);

        // Register exact Rapier3D static trimesh collider for terrain
        if (this.terrainMesh && this.physics && this.physics.isInitialized) {
          this.physics.createTerrainTrimesh(this.terrainMesh);
        }
      }
    } catch (err) {
      console.error('[GameplayScene] Failed to load Pine Forest environment:', err);
    }

    // 2. Load Updated Shri Ram Royal Warrior FBX Character & Skeletal Rig
    try {
      console.log('[GameplayScene] Loading updated Shri Ram Royal Warrior FBX...');
      const fbx = await this.assetLoader.loadFBX(ASSET_PATHS.RAM_WARRIOR.HERO_FBX);
      if (fbx) {
        this.ramHero = fbx;

        // Model is in centimeters (194.68 cm). Scale 0.01 brings it to true 1.95m height
        this.ramHero.scale.setScalar(0.01);

        // Query terrain elevation at spawn point (0, 0)
        const groundElevation = this.physics.getTerrainElevation(0, 0);
        const spawnY = groundElevation ? groundElevation.y : 0;
        this.ramHero.position.set(0, spawnY, 0);

        // Optimize materials: preserve natural human complexion, updated hairstyle & enable shadow casting
        this.ramHero.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // Milestone 5.2 Draw Count Optimization: Collapse multi-material shadow pass into 1 single depth draw call
            if (child.isSkinnedMesh) {
              child.customDepthMaterial = new THREE.MeshDepthMaterial({
                depthPacking: THREE.RGBADepthPacking
              });
            }

            const applyMaterialProps = (mat) => {
              if (!mat) return;
              // Ensure diffuse tint is pure white so original texture skin tone and hair display accurately
              if (mat.color) {
                mat.color.setHex(0xffffff);
              }
              if (mat.map) {
                mat.map.colorSpace = THREE.SRGBColorSpace;
                mat.map.needsUpdate = true;
              }

              // Material-specific calibration
              if (mat.name === 'Hair') {
                // Short textured hair: rich black double-sided hair cards matching Ara 3D Studio export
                mat.map = null;
                mat.color.setHex(0x181818);
                if (mat.specular) {
                  mat.specular.setHex(0x282828);
                }
                mat.shininess = 25;
                mat.side = THREE.DoubleSide;
                mat.transparent = false;
                mat.depthWrite = true;
                mat.alphaTest = 0;
              } else if (mat.name === 'Eyebrows' || mat.name === 'Eyelashes') {
                mat.color.setHex(0x181818);
                mat.side = THREE.DoubleSide;
                mat.alphaTest = 0.10;
                mat.depthWrite = true;
                mat.transparent = true;
              } else if (mat.name === 'Skin' || mat.name === 'Skin details') {
                mat.roughness = 0.58;
                mat.metalness = 0.02;
              } else if (mat.name === 'Gold' || mat.name === 'Brass') {
                mat.roughness = 0.35;
                mat.metalness = 0.75;
              } else {
                mat.roughness = Math.max(mat.roughness ?? 0.6, 0.55);
                mat.metalness = Math.min(mat.metalness ?? 0.1, 0.15);
              }
              mat.needsUpdate = true;
            };

            if (Array.isArray(child.material)) {
              child.material.forEach(applyMaterialProps);
            } else {
              applyMaterialProps(child.material);
            }
          }
        });

        this.threeScene.add(this.ramHero);
        console.log(`[GameplayScene] Shri Ram Royal Warrior character added to scene at ground Y=${spawnY.toFixed(3)}m.`);

        // Initialize Player Controller with physics terrain collision
        const canvas = this.sceneManager?.renderer?.domElement || document.getElementById('game-canvas');
        this.playerController = new PlayerController(
          this.ramHero,
          this.camera,
          canvas,
          this.physics
        );

        // 3. Load Weapon Assets (Tribal Bow, Quiver, Arrow) & Shoot / Chant Animations
        try {
          console.log('[GameplayScene] Loading Tribal Bow weapon assets and chant animation...');
          const [bowGltf, shootFbx, chantFbx] = await Promise.all([
            this.assetLoader.loadGLTF(ASSET_PATHS.WEAPONS.TRIBAL_BOW_GLB),
            this.assetLoader.loadFBX(ASSET_PATHS.RAM_WARRIOR.BOW_SHOOT_ANIM),
            this.assetLoader.loadFBX(ASSET_PATHS.RAM_WARRIOR.SKY_CHANT_ANIM)
          ]);

          // Register shoot animation action with AnimationManager
          if (shootFbx && shootFbx.animations && shootFbx.animations.length > 0) {
            this.playerController.animManager.registerClip(shootFbx.animations[0], 'shoot');
            console.log('[GameplayScene] Bow draw & shoot animation registered.');
          }

          // Register chant animation action with AnimationManager
          if (chantFbx && chantFbx.animations && chantFbx.animations.length > 0) {
            this.playerController.animManager.registerClip(chantFbx.animations[0], 'chant');
            console.log('[GameplayScene] Divine Chant (aims bow toward sky) animation registered.');
          }

          // Initialize Weapon Manager and socket bow, quiver, and arrows
          this.weaponManager = new WeaponManager(
            this.ramHero,
            this.threeScene,
            this.camera,
            this.physics
          );

          if (bowGltf && bowGltf.scene) {
            this.weaponManager.initWeapons(bowGltf.scene);
          }

          this.playerController.setWeaponManager(this.weaponManager);
          this.playerController.setEnvironmentReferences(this.environmentModel, this.skyDomeMesh);

          // Initialize Supernatural Sand Dune Ultimate VFX System
          this.sandDuneSystem = new SandDuneSystem(this.threeScene, this.physics);
          if (this.weaponManager.projectileSystem?.arrowTemplate) {
            this.sandDuneSystem.setArrowTemplate(
              this.weaponManager.projectileSystem.arrowTemplate,
              this.weaponManager.projectileSystem.tipGlowTexture
            );
          }

          console.log('[GameplayScene] Weapon and Sand Dune systems successfully initialized.');
        } catch (weapErr) {
          console.error('[GameplayScene] Failed to load weapons:', weapErr);
        }

        // 4. Load Master Aasura Warrior & Initialize Battle Wave (Milestone 5.1 Optimization)
        try {
          console.log('[GameplayScene] Loading and prewarming master Aasura warrior FBX...');
          const enemyFbx = await this.assetLoader.loadFBX(ASSET_PATHS.ENEMY.AASURA_FBX);
          if (enemyFbx) {
            // Optimize master asset: consolidate materials, build LOD0/1/2 geometries, prewarm textures & shaders
            await this.enemyOptimizer.initMasterAsset(
              enemyFbx,
              this.sceneManager?.renderer?.threeRenderer,
              this.threeScene,
              this.camera
            );

            // Initialize Battle Wave Manager
            this.enemyWaveManager = new EnemyWaveManager(
              this.threeScene,
              this.enemyOptimizer,
              this.physics,
              this.assetLoader
            );
            this.enemyWaveManager.setTargetPlayer(this.ramHero);

            if (this.weaponManager && this.playerController) {
              this.enemyWaveManager.setSystemReferences(
                this.weaponManager.projectileSystem,
                this.playerController
              );
            }

            // Sync with Wave UI HUD
            this.enemyWaveManager.onProgressChange = (progress) => {
              this.updateWaveUI(progress);
            };

            // 5. Initialize Divine Ability System (Energy Meter, Bahu-Baan, Sand Dune)
            this.divineAbilitySystem = new DivineAbilitySystem(
              this.playerController,
              this.weaponManager,
              this.enemyWaveManager,
              this.sandDuneSystem
            );
            this.sandDuneCutscene = new SandDuneCutscene(this);
            this.divineAbilitySystem.setCutscene(this.sandDuneCutscene);
            this.playerController.setAbilitySystem(this.divineAbilitySystem);
            this.enemyWaveManager.setAbilitySystem(this.divineAbilitySystem);
            this.divineAbilitySystem.onStateChange = (state) => {
              this.updateDivineHUD(state);
            };
            this.divineAbilitySystem.notifyState();

            console.log('[GameplayScene] Aasura master asset optimized & Divine Abilities initialized.');
          }
        } catch (enemyErr) {
          console.error('[GameplayScene] Failed to load Aasura warrior FBX:', enemyErr);
        }
      }
    } catch (err) {
      console.error('[GameplayScene] Failed to load Shri Ram hero FBX:', err);
    }

    this.isLoaded = true;
  }

  update(delta, elapsed) {
    const frameStart = performance.now();
    const jsStart = performance.now();

    // 1. Step Rapier3D physics
    const pStart = performance.now();
    if (this.physics && this.physics.isInitialized) {
      this.physics.step(delta);
    }
    const pDur = performance.now() - pStart;

    // 2. Update Player Controller & Third-Person Camera
    const plStart = performance.now();
    if (this.playerController) {
      this.playerController.update(delta);
    }
    const plDur = performance.now() - plStart;

    // 3. Update Enemy Wave Manager (spawning, locomotion, AI, LODs, animations)
    const eStart = performance.now();
    if (this.enemyWaveManager) {
      this.enemyWaveManager.update(delta, this.camera);
    }
    const eDur = performance.now() - eStart;

    const jsDur = performance.now() - jsStart;

    // Expose sub-stage timings for flight recorder & profiler
    this.lastFrameTimings = {
      physicsMs: pDur,
      playerMs: plDur,
      enemyMs: eDur,
      jsMs: jsDur
    };

    // 4. Update Sand Dune Ultimate VFX System & Cutscene Director
    if (this.sandDuneSystem) {
      this.sandDuneSystem.update(delta);
    }
    if (this.sandDuneCutscene) {
      this.sandDuneCutscene.update(delta);
    }

    // 5. Record profiler metrics (active only when F2 or ?debug=1 is enabled)
    if (this.profiler && this.profiler.isEnabled) {
      this.profiler.recordFrame(performance.now() - frameStart, jsDur, eDur, pDur, 0);
    }
  }

  onResize(width, height, aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  async exit() {
    this.hudContainer.classList.remove('active');
    this.hudContainer.classList.add('hidden');

    if (this.sandDuneCutscene && this.sandDuneCutscene.isPlaying) {
      this.sandDuneCutscene.completeCutscene();
    }
    audioDirector.stopSandDuneUltimate({ duration: 0.2 });

    if (this.playerController && this.playerController.isPointerLocked) {
      if (document.exitPointerLock) {
        document.exitPointerLock();
      }
    }
  }

  dispose() {
    if (this.playerController) {
      this.playerController.dispose();
      this.playerController = null;
    }

    if (this.weaponManager) {
      this.weaponManager.dispose();
      this.weaponManager = null;
    }

    if (this.enemyWaveManager) {
      this.enemyWaveManager.dispose();
      this.enemyWaveManager = null;
    }

    if (this.sandDuneCutscene) {
      this.sandDuneCutscene.dispose();
      this.sandDuneCutscene = null;
    }

    if (this.sandDuneSystem) {
      this.sandDuneSystem.dispose();
      this.sandDuneSystem = null;
    }

    if (this.divineAbilitySystem) {
      this.divineAbilitySystem.dispose();
      this.divineAbilitySystem = null;
    }

    if (this.profiler) {
      this.profiler.dispose();
      this.profiler = null;
    }

    if (this.hudContainer && this.hudContainer.parentNode) {
      this.hudContainer.parentNode.removeChild(this.hudContainer);
    }

    if (this.physics) {
      this.physics.dispose();
    }

    this.threeScene.traverse((object) => {
      if (object.isMesh) {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => mat.dispose());
        } else if (object.material) {
          object.material.dispose();
        }
      }
    });

    while (this.threeScene.children.length > 0) {
      this.threeScene.remove(this.threeScene.children[0]);
    }
  }
}
