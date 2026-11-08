import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export class AssetLoader {
  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.fbxLoader = new FBXLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.cache = new Map();
  }

  /**
   * Load a single FBX file
   * @param {string} url 
   * @param {function} [onProgress] 
   * @returns {Promise<THREE.Group>}
   */
  async loadFBX(url, onProgress) {
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    return new Promise((resolve, reject) => {
      this.fbxLoader.load(
        url,
        (fbx) => {
          this.cache.set(url, fbx);
          resolve(fbx);
        },
        (xhr) => {
          if (onProgress && xhr.total > 0) {
            onProgress(xhr.loaded / xhr.total);
          }
        },
        (error) => {
          console.error(`[AssetLoader] Failed to load FBX from ${url}:`, error);
          reject(new Error(`Failed to load FBX model: ${url} (${error.message || error})`));
        }
      );
    });
  }

  /**
   * Load a single GLTF/GLB file
   * @param {string} url 
   * @param {function} [onProgress] 
   * @returns {Promise<any>}
   */
  async loadGLTF(url, onProgress) {
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          this.cache.set(url, gltf);
          resolve(gltf);
        },
        (xhr) => {
          if (onProgress && xhr.total > 0) {
            onProgress(xhr.loaded / xhr.total);
          }
        },
        (error) => {
          console.error(`[AssetLoader] Failed to load GLTF from ${url}:`, error);
          reject(new Error(`Failed to load 3D model: ${url} (${error.message || error})`));
        }
      );
    });
  }

  /**
   * Load a Texture
   * @param {string} url 
   * @param {function} [onProgress] 
   * @returns {Promise<THREE.Texture>}
   */
  async loadTexture(url, onProgress) {
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          this.cache.set(url, texture);
          resolve(texture);
        },
        (xhr) => {
          if (onProgress && xhr.total > 0) {
            onProgress(xhr.loaded / xhr.total);
          }
        },
        (error) => {
          console.error(`[AssetLoader] Failed to load texture from ${url}:`, error);
          reject(new Error(`Failed to load texture: ${url}`));
        }
      );
    });
  }

  /**
   * Load a standard Image HTML element
   * @param {string} url 
   * @returns {Promise<HTMLImageElement>}
   */
  async loadImage(url) {
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(url, img);
        resolve(img);
      };
      img.onerror = (err) => {
        console.error(`[AssetLoader] Failed to load image from ${url}:`, err);
        reject(new Error(`Failed to load image: ${url}`));
      };
      img.src = url;
    });
  }

  /**
   * Batch load multiple assets with aggregated progress
   * @param {Array<{ id: string, path: string, type: 'glb'|'image'|'texture' }>} items 
   * @param {function(number, string): void} onProgressCallback (ratio: 0..1, currentAssetId: string)
   * @returns {Promise<Map<string, any>>}
   */
  async loadBatch(items, onProgressCallback) {
    const results = new Map();
    const totalCount = items.length;
    let completedCount = 0;

    for (const item of items) {
      if (onProgressCallback) {
        onProgressCallback(completedCount / totalCount, item.id);
      }

      let data = null;
      try {
        if (item.type === 'glb') {
          data = await this.loadGLTF(item.path);
        } else if (item.type === 'image') {
          data = await this.loadImage(item.path);
        } else if (item.type === 'texture') {
          data = await this.loadTexture(item.path);
        } else {
          throw new Error(`Unknown asset type: ${item.type}`);
        }
      } catch (err) {
        console.warn(`[AssetLoader] Non-fatal error loading asset "${item.id}":`, err);
        data = null;
      }

      results.set(item.id, data);
      completedCount++;
      if (onProgressCallback) {
        onProgressCallback(completedCount / totalCount, item.id);
      }
    }

    return results;
  }

  get(url) {
    return this.cache.get(url);
  }

  clear() {
    this.cache.clear();
  }
}

