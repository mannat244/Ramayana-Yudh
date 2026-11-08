/**
 * Ramayana Yudh — Central Asset Manifest
 * Single source of truth for all game assets, paths, and metadata.
 */

export const ASSET_PATHS = {
  // Main Menu Assets (Ready in public/assets/)
  MAIN_MENU: {
    LOGO: '/assets/Main Menu/Logo.png',
    SHREE_RAM: '/assets/Main Menu/shree_ram.glb',
    STARRY_SKY: '/assets/Main Menu/starry_galaxy_sky_hdri_background_photosphere.glb'
  },
  
  // Environment Assets (Pine Forest — Active Gameplay Environment)
  ENVIRONMENT: {
    PINE_FOREST: '/assets/Environment/pine_forest.glb'
  },
  RAM_WARRIOR: {
    HERO_FBX: '/assets/Ram/Shree_Ram_-_Royal_Warrior.fbx?v=3.3',
    BOW_SHOOT_ANIM: '/assets/Ram/bow_draw_and_shoot.fbx',
    SKY_CHANT_ANIM: '/assets/Ram/Warrior_aims_bow_toward_sky.fbx'
  },
  WEAPONS: {
    TRIBAL_BOW_GLB: '/assets/Weapons/tribal_basic_bow.glb',
    BOW_REF_PNG: '/assets/Weapons/bow_asset.png'
  },
  ENEMY: {
    AASURA_FBX: '/assets/Enemy/Aasura.fbx'
  },
  VFX: {
    ARROW_TIP_GLOW: '/assets/VFX/arrow_tip_glow.png',
    IMPACT_BURST_WOOD: '/assets/VFX/impact_burst_wood.png',
    IMPACT_DUST_SOIL: '/assets/VFX/impact_dust_soil.png',
    FIRE_FLAME: '/assets/VFX/fire_flame.png',
    TORNADO_SMOKE: '/assets/VFX/tornado_smoke.png',
    SAND_GROUND: '/assets/VFX/sand_ground.png',
    SAND_STORM: '/assets/VFX/sand_strom.png',
    SAND_SKY: '/assets/VFX/sand_sky.png',
    SPARKS_BURST: '/assets/VFX/sparks_burst.png',
    SPARKS_EMISSIVE: '/assets/VFX/sparks_emissive.png',
    SPARKS_EXPLOSION_GLB: '/assets/VFX/sparksexplosion.glb',
    FIRE_TORNADO_GLB: '/assets/VFX/fire_tornado.glb'
  },
  AUDIO: {
    MAIN_MENU_BGM: '/assets/audio/main_menu.mp3',
    SAND_ABILITY_BGM: '/assets/audio/sand_ability.mp3',
    WOOSH_SFX: '/assets/audio/woosh.wav'
  }
};

export const MAIN_MENU_ASSET_LIST = [
  { id: 'logo', path: ASSET_PATHS.MAIN_MENU.LOGO, type: 'image' },
  { id: 'shreeRam', path: ASSET_PATHS.MAIN_MENU.SHREE_RAM, type: 'glb' },
  { id: 'starrySky', path: ASSET_PATHS.MAIN_MENU.STARRY_SKY, type: 'glb' }
];

