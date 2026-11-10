import * as THREE from 'three';
import './style.css';
import { Renderer } from './core/Renderer.js';
import { AssetLoader } from './core/AssetLoader.js';
import { SceneManager } from './core/SceneManager.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { LoadingScene } from './scenes/LoadingScene.js';
import { GameplayScene } from './scenes/GameplayScene.js';
import { CreditsScene } from './scenes/CreditsScene.js';
import { pwaManager } from './pwa/PWAManager.js';

// Expose THREE and PWA Manager globally for dev tools and test suites
window.THREE = THREE;
window.__pwaManager = pwaManager;

async function bootstrap() {
  console.log('%c⚔ RAMAYANA YUDH — Technical Foundation Initializing...', 'color: #ffd54f; font-weight: bold; font-size: 14px;');

  const container = document.getElementById('app') || document.body;
  const renderer = new Renderer(container);
  const assetLoader = new AssetLoader();
  const sceneManager = new SceneManager(renderer);

  // Register Scenes
  const mainMenuScene = new MainMenuScene(assetLoader);
  const loadingScene = new LoadingScene(assetLoader);
  const gameplayScene = new GameplayScene(assetLoader);
  const creditsScene = new CreditsScene(assetLoader);

  sceneManager.registerScene('mainMenu', mainMenuScene);
  sceneManager.registerScene('loading', loadingScene);
  sceneManager.registerScene('gameplay', gameplayScene);
  sceneManager.registerScene('credits', creditsScene);

  // For test suite debugging access
  window.__sceneManager = sceneManager;

  // Start the main game render loop
  sceneManager.start();

  // Enter initial Main Menu scene
  await sceneManager.switchScene('mainMenu');

  // Register Progressive Web App Service Worker for Chrome installability
  pwaManager.registerServiceWorker();

  console.log('%c✓ Main Menu successfully initialized & rendering.', 'color: #2ed573; font-weight: bold;');
}

window.addEventListener('DOMContentLoaded', bootstrap);
