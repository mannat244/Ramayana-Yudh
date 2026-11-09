import * as THREE from 'three';
import { audioDirector } from '../audio/AudioDirector.js';

export class CreditsScene {
  /**
   * @param {import('../core/AssetLoader.js').AssetLoader} assetLoader 
   */
  constructor(assetLoader) {
    this.assetLoader = assetLoader;
    this.sceneManager = null;

    this.threeScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.z = 5;

    this.container = null;
    this.scrollContainer = null;
    this.isTransitioning = false;

    this.initDOM();
  }

  setSceneManager(sceneManager) {
    this.sceneManager = sceneManager;
  }

  initDOM() {
    this.container = document.createElement('div');
    this.container.id = 'credits-scene';
    this.container.className = 'scene-overlay credits-overlay hidden';

    this.container.innerHTML = `
      <div class="credits-backdrop"></div>
      
      <div class="credits-wrapper" id="credits-scroll-container">
        <div class="credits-content">
          
          <!-- SECTION 1: HEADER -->
          <header class="credits-header">
            <div class="credits-diwali-symbol">🪔</div>
            <h1 class="credits-main-title">THANK YOU FOR PLAYING</h1>
            <h2 class="credits-game-title">RAMAYANA YUDH</h2>
            <div class="credits-sanskrit">धर्मक्षेत्रे कुरुक्षेत्रे • यतो धर्मस्ततो जयः</div>
            <div class="credits-divider">❖ ❖ ❖</div>
          </header>

          <!-- SECTION 2: TRIBUTE & INSPIRATION -->
          <section class="credits-section">
            <p class="credits-p lead">
              This little game was created from the heart as a personal celebration of Diwali
              and as a tribute to the timeless story of the Ramayana.
            </p>
            <p class="credits-p">
              It was an independent creative experiment, inspired by the excitement and anticipation
              surrounding the grand cinematic presentation of the Ramayana.
            </p>
            <p class="credits-p">
              It was built out of admiration, curiosity, and the joy of creating something of my own.
            </p>
          </section>

          <!-- SECTION 3: LEGAL & NON-COMMERCIAL NOTICE -->
          <section class="credits-section legal-section">
            <h3 class="credits-subheading">NON-COMMERCIAL NOTICE & ATTRIBUTION</h3>
            <p class="credits-p">
              This is a non-commercial personal project. It is not affiliated with, sponsored by,
              or endorsed by any film production company, studio, or commercial rights holder.
            </p>
            <p class="credits-p">
              All rights to their respective characters, names, trademarks, films, music, and third-party
              materials remain with their respective owners. No ownership of those materials is claimed.
            </p>
            <p class="credits-p">
              There is no intention to infringe upon the rights of any original creator or rights holder.
              Please support the official creators and experience the Ramayana through its official releases.
            </p>
            <p class="credits-p contact-box">
              If you are a rights holder and have concerns about any material used in this personal project, please contact:
              <br />
              <strong class="contact-email"><a href="mailto:mannateducation@gmail.com" class="email-link">mannateducation@gmail.com</a></strong>
              <br />
              <span class="contact-sub">We will review legitimate concerns and cooperate with reasonable requests for removal.</span>
            </p>
          </section>

          <!-- SECTION 4: QUESTION & FEEDBACK -->
          <section class="credits-section question-section">
            <div class="credits-divider">❖ ❖ ❖</div>
            <h3 class="credits-subheading highlight">A LITTLE QUESTION BEFORE YOU GO</h3>
            <p class="credits-p lead">
              Thank you for being part of this experiment. I'd love to hear what you think.
            </p>
            <p class="credits-p question-prompt">
              What should I create next?
            </p>
            <ul class="credits-list">
              <li>Should I improve and expand this Ramayana game?</li>
              <li>Would you like to see another battle from the Ramayana?</li>
              <li>Should I try a different mythological story?</li>
              <li>Or should I explore something completely different?</li>
            </ul>
            <p class="credits-p">
              Your ideas and feedback would mean a lot.
            </p>
            <div class="credits-closing">
              <span class="closing-quote">Created with curiosity, respect and a little Diwali spirit.</span>
              <span class="closing-thanks">THANK YOU.</span>
            </div>
          </section>

          <!-- SECTION 5: NAVIGATION ACTIONS -->
          <footer class="credits-actions">
            <button class="menu-btn primary-btn" id="btn-credits-replay" type="button">
              <span class="btn-bracket">⟨</span>
              <span class="btn-text">PLAY AGAIN</span>
              <span class="btn-bracket">⟩</span>
            </button>

            <button class="menu-btn secondary-btn" id="btn-credits-menu" type="button">
              <span class="btn-bracket">⟨</span>
              <span class="btn-text">RETURN TO MAIN MENU</span>
              <span class="btn-bracket">⟩</span>
            </button>
          </footer>

        </div>
      </div>
    `;

    document.body.appendChild(this.container);
    this.scrollContainer = this.container.querySelector('#credits-scroll-container');

    this.bindEvents();
  }

  bindEvents() {
    const replayBtn = this.container.querySelector('#btn-credits-replay');
    const menuBtn = this.container.querySelector('#btn-credits-menu');

    replayBtn.addEventListener('click', () => this.handlePlayAgain());
    menuBtn.addEventListener('click', () => this.handleReturnToMenu());
  }

  async enter() {
    this.isTransitioning = false;
    this.container.classList.remove('hidden');
    this.container.classList.add('active');

    // Scroll to top
    if (this.scrollContainer) {
      this.scrollContainer.scrollTop = 0;
    }

    // Play End Credits narration & soundtrack
    audioDirector.playCreditsMusic({ fadeIn: true, duration: 2.0 });
  }

  handlePlayAgain() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    audioDirector.stopCreditsMusic({ fadeOut: true, duration: 0.8 });

    if (this.sceneManager) {
      this.sceneManager.switchScene('gameplay', { isRestart: true });
    }
  }

  handleReturnToMenu() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    audioDirector.stopCreditsMusic({ fadeOut: true, duration: 0.8 });

    if (this.sceneManager) {
      this.sceneManager.switchScene('mainMenu');
    }
  }

  update(delta, elapsed) {
    // Elegant presentation
  }

  onResize(width, height, aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  async exit() {
    audioDirector.stopCreditsMusic({ fadeOut: true, duration: 0.6 });
    this.container.classList.remove('active');
    this.container.classList.add('hidden');
  }

  dispose() {
    audioDirector.stopCreditsMusic({ fadeOut: false });
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

