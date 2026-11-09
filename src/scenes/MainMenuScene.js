import * as THREE from 'three';
import { ASSET_PATHS } from '../assets/assetManifest.js';
import { MainMenuUI } from '../ui/MainMenuUI.js';
import { audioDirector } from '../audio/AudioDirector.js';
import { gameSettings } from '../core/GameSettings.js';

export class MainMenuScene {
  /**
   * @param {import('../core/AssetLoader.js').AssetLoader} assetLoader 
   */
  constructor(assetLoader) {
    this.assetLoader = assetLoader;
    this.sceneManager = null;

    // Three.js Scene & Camera
    this.threeScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 1.45, 4.2);

    // Groups & Object references
    this.skyDome = null;
    this.ramModel = null;
    this.ramGroup = new THREE.Group();
    this.threeScene.add(this.ramGroup);

    this.particles = null;
    this.particlePositions = null;
    this.particleCount = 200;

    // Lights
    this.keyLight = null;
    this.fillLight = null;
    this.rimLight = null;
    this.divineGlowLight = null;

    // UI
    this.ui = new MainMenuUI({
      onPlay: () => this.handlePlay(),
      onSettings: () => this.handleSettings()
    });

    this.isLoaded = false;
    
    // Rotation configuration
    // Initial orientation: facing slightly away from camera (showing back/side),
    // rotating smoothly into a 3/4 and front-facing presentation.
    this.initialRotationY = -0.95;
    this.rotationSpeed = 0.16; // radians per second
    this.skyRotationSpeed = 0.012;

    this.ramGroup.rotation.y = this.initialRotationY;

    this.setupLighting();
    this.setupParticles();
  }

  setSceneManager(sceneManager) {
    this.sceneManager = sceneManager;
  }

  setupLighting() {
    // Ambient cosmic fill light (royal sapphire/indigo)
    const ambientLight = new THREE.AmbientLight(0x222a45, 1.8);
    this.threeScene.add(ambientLight);

    // Warm golden key light (divine sun illumination)
    this.keyLight = new THREE.DirectionalLight(0xffdf9e, 3.5);
    this.keyLight.position.set(3, 4, 3);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.bias = -0.0005;
    this.threeScene.add(this.keyLight);

    // Saffron/golden rim light from behind Shri Ram (silhouette halo)
    this.rimLight = new THREE.DirectionalLight(0xff9436, 4.2);
    this.rimLight.position.set(-2, 3, -3);
    this.threeScene.add(this.rimLight);

    // Subtle divine aura point light near the hero
    this.divineGlowLight = new THREE.PointLight(0xffc107, 2.2, 6, 1.2);
    this.divineGlowLight.position.set(1.2, 1.5, 0.5);
    this.threeScene.add(this.divineGlowLight);
  }

  setupParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);

    for (let i = 0; i < this.particleCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = Math.random() * 4 - 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particlePositions = positions;

    // Golden divine embers material: subtle, non-intrusive glow
    const material = new THREE.PointsMaterial({
      color: 0xffd54f,
      size: 0.038,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particles = new THREE.Points(geometry, material);
    this.threeScene.add(this.particles);
  }

  async enter() {
    this.ui.show();
    audioDirector.playMainMenuMusic({ fadeIn: true });
    this.ramGroup.rotation.y = this.initialRotationY;
    if (this.sceneManager?.renderer) {
      gameSettings.applyToRenderer(this.sceneManager.renderer);
    }
    if (!this.isLoaded) {
      await this.loadSceneAssets();
    }
  }

  async loadSceneAssets() {
    try {
      // 1. Load Celestial Galaxy Sky Photosphere
      // The GLB contains an embedded Sketchfab root node scaled to ~308.78.
      // Scaling by 1.0 positions the sphere at radius ~310 units, well within the camera far plane (2000).
      const skyGltf = await this.assetLoader.loadGLTF(ASSET_PATHS.MAIN_MENU.STARRY_SKY);
      if (skyGltf && skyGltf.scene) {
        this.skyDome = skyGltf.scene;
        this.skyDome.scale.setScalar(1.0);
        this.skyDome.position.set(0, 0, 0);

        this.skyDome.traverse((child) => {
          if (child.isMesh && child.material) {
            const starTexture = child.material.emissiveMap || child.material.map;
            if (starTexture) {
              starTexture.colorSpace = THREE.SRGBColorSpace;
              child.material = new THREE.MeshBasicMaterial({
                map: starTexture,
                side: THREE.BackSide,
                depthWrite: false
              });
            } else {
              child.material.side = THREE.BackSide;
              child.material.depthWrite = false;
            }
            child.renderOrder = -1000; // Always render behind all objects
          }
        });

        this.threeScene.add(this.skyDome);
        console.log('[MainMenuScene] Celestial galaxy sky photosphere loaded and visible.');
      }
    } catch (err) {
      console.warn('[MainMenuScene] Sky photosphere fallback to deep cosmic background:', err);
      this.threeScene.background = new THREE.Color(0x060814);
    }

    try {
      // 2. Load 3D Shri Ram Model
      const ramGltf = await this.assetLoader.loadGLTF(ASSET_PATHS.MAIN_MENU.SHREE_RAM);
      if (ramGltf && ramGltf.scene) {
        this.ramModel = ramGltf.scene;

        // Compute natural bounding box
        const bbox = new THREE.Box3().setFromObject(this.ramModel);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        bbox.getCenter(center);
        bbox.getSize(size);

        // Center model geometry at its feet / base
        this.ramModel.position.x = -center.x;
        this.ramModel.position.y = -bbox.min.y;
        this.ramModel.position.z = -center.z;

        // Normalize height to aesthetic scale ~2.45 units
        const targetHeight = 2.45;
        const scaleFactor = targetHeight / (size.y || 1);
        this.ramGroup.scale.setScalar(scaleFactor);

        // Optimize materials & enable shadows
        this.ramModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.roughness = Math.max(child.material.roughness, 0.35);
              child.material.needsUpdate = true;
            }
          }
        });

        this.ramGroup.add(this.ramModel);
        this.updateCharacterFraming(window.innerWidth / window.innerHeight);
        console.log('[MainMenuScene] Shri Ram model positioned with initial yaw:', this.initialRotationY);
      }
    } catch (err) {
      console.error('[MainMenuScene] Failed to load Shri Ram model:', err);
    }

    this.isLoaded = true;
  }

  updateCharacterFraming(aspect) {
    if (!this.ramGroup) return;

    if (aspect > 1.2) {
      // Desktop / Widescreen: position gracefully on the right
      this.ramGroup.position.set(1.15, 0.05, 0);
      this.camera.position.set(0, 1.45, 4.2);
      this.camera.lookAt(0.35, 1.35, 0);
    } else if (aspect > 0.8) {
      // Tablet / Medium aspect ratio
      this.ramGroup.position.set(0.65, 0.05, 0);
      this.camera.position.set(0, 1.45, 4.6);
      this.camera.lookAt(0.2, 1.3, 0);
    } else {
      // Mobile / Portrait: center Shri Ram with adapted camera distance
      this.ramGroup.position.set(0, 0.05, 0);
      this.camera.position.set(0, 1.35, 5.2);
      this.camera.lookAt(0, 1.25, 0);
    }
  }

  update(delta, elapsed) {
    // 1. Continuous rotation of Shri Ram from initial back/side angle into front/3-quarter presentation
    if (this.ramGroup) {
      this.ramGroup.rotation.y += delta * this.rotationSpeed;
      // Gentle breathing / vertical hover float
      this.ramGroup.position.y = 0.05 + Math.sin(elapsed * 1.5) * 0.02;
    }

    // 2. Slow celestial rotation of the starry galaxy photosphere
    if (this.skyDome) {
      this.skyDome.rotation.y += delta * this.skyRotationSpeed;
    }

    // 3. Animate divine glowing particle embers
    if (this.particles && this.particlePositions) {
      const positions = this.particlePositions;
      for (let i = 0; i < this.particleCount; i++) {
        // Upward drift
        positions[i * 3 + 1] += delta * (0.18 + (i % 5) * 0.04);
        // Subtle sinusoidal sway
        positions[i * 3 + 0] += Math.sin(elapsed + i) * delta * 0.04;

        // Loop back when reaching top
        if (positions[i * 3 + 1] > 3.8) {
          positions[i * 3 + 1] = -0.5;
          positions[i * 3 + 0] = (Math.random() - 0.5) * 8;
        }
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }

    // 4. Subtle pulsating divine key & aura light
    if (this.divineGlowLight) {
      this.divineGlowLight.intensity = 2.2 + Math.sin(elapsed * 2.2) * 0.4;
    }
  }

  onResize(width, height, aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.updateCharacterFraming(aspect);
    this.ui.onResize(width, height, aspect);
  }

  handlePlay() {
    audioDirector.stopMainMenuMusic({ fadeOut: true, duration: 1.0 });
    if (this.sceneManager) {
      this.sceneManager.switchScene('loading', { target: 'gameplay' });
    }
  }

  handleSettings() {
    this.ui.openSettings();
  }

  async exit() {
    audioDirector.stopMainMenuMusic({ fadeOut: true, duration: 0.8 });
    this.ui.hide();
  }

  dispose() {
    this.ui.dispose();

    if (this.particles) {
      this.particles.geometry.dispose();
      this.particles.material.dispose();
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
