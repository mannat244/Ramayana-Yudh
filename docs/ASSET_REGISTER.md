# Ramayana Yudh — Asset Register

**Version:** 1.0.0  
**Date of Inspection:** November 2026  
**Status:** Complete Initial Inventory & Technical Audit  

---

## 1. Executive Summary

This asset register documents all collected source assets found in the `Assets` root directory of the workspace. Every asset has been inspected in-place without altering, moving, or deleting the original files.

### Key Inspection Findings:
1. **Enemy Asset (`simple.zip`):** Contains a nested archive `source/Sam.zip` containing `Sam.fbx` (10.2 MB), `Sam.blend` (1.5 MB), and 29 PNG texture maps. Not directly web-loadable without extraction and material wiring or GLTF conversion.
2. **Environment Asset (`landscape_forest__mountains.glb`):** High-density glTF 2.0 binary model (14.96 MB) featuring **3,687 meshes** and **7,380 scene nodes**. Must NOT be loaded on the Main Menu to preserve load times and frame rate.
3. **Main Menu Background:** The asset named `starry_galaxy_sky_hdri_background_photosphere.glb` is a 3D photosphere GLB model (957 KB) rather than a flat image or HDR panorama file.
4. **Shri Ram Main Menu Model (`shree_ram.glb`):** A static 3D sculpture model (26.70 MB) comprising 28 meshes, 30 nodes, and 23 materials. It does not contain an armature/rig or embedded skeletal animations.
5. **Shri Ram Rig & Animations (`Assets/Ram/`):** Three FBX binary files (v7400). `Shree_Ram_-_Royal_Warrior.fbx` contains the rigged character model with standard Mixamo-compatible hierarchy (`Armature`, `Hips`, `Spine`). `bow_draw_and_shoot.fbx` and `Warrior_aims_bow_toward_sky.fbx` contain dedicated skeletal animation takes.
6. **Weapons:** `tribal_basic_bow.glb` is modeled in centimeter units (126.8 cm tall), requiring scale normalization (~0.01) when parenting to the character hand in future milestones.

---

## 2. Comprehensive Asset Inventory

| Category | File Name | Extension | Size (Bytes) | Human Size | Technical Format | Status / Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Enemy** | `Aasura.fbx` | `.fbx` | 10,955,820 | 10.45 MB | FBX 7400 Binary | Primary Rakshasa Warrior Character with 16 embedded combat animations & sword skinned to `WeaponR` (Milestone 4.5) |
| **Enemy** | `simple.zip` | `.zip` | 19,838,718 | 18.92 MB | Compressed Zip Archive | Archived Prototype Enemy Archive (Sam.fbx - Superseded) |
| **VFX** | `sparksexplosion.glb` | `.glb` | 2,812,052 | 2.68 MB | glTF 2.0 Binary | Source explosion/sparks VFX asset with embedded RGBA burst maps |
| **VFX** | `fire_tornado.glb` | `.glb` | 1,001,552 | 978.08 KB | glTF 2.0 Binary | Authentic tornado smoke & fire vortex asset |
| **VFX** | `sparks_burst.png` / `impact_burst_wood.png` | `.png` | 766,688 | 748.72 KB | 1024 × 1024 RGBA PNG | Authentic wood/flesh impact spark burst directly extracted from `sparksexplosion.glb` |
| **VFX** | `sparks_emissive.png` | `.png` | 1,999,339 | 1.91 MB | 1024 × 1024 RGB PNG | High-intensity emissive spark glow texture from `sparksexplosion.glb` |
| **VFX** | `tornado_smoke.png` / `impact_dust_soil.png` | `.png` | 304,014 | 296.89 KB | 512 × 512 RGBA PNG | Authentic billowing atmospheric smoke/dust plume directly extracted from `fire_tornado.glb` |
| **VFX** | `fire_flame.png` / `arrow_tip_glow.png` | `.png` | 310,956 | 303.67 KB | 1000 × 640 RGBA PNG | Authentic transparent fire sprite directly extracted from `jetpack-effect.zip` |
| **Environment** | `pine-forest.zip` | `.zip` | 10,696,905 | 10.20 MB | Compressed Zip Archive (containing `pine.glb`) | Active Gameplay Environment (Milestone 2.1) |
| **Environment** | `landscape_forest__mountains.glb` | `.glb` | 15,695,700 | 14.97 MB | glTF 2.0 Binary | Superseded & Archived Source Asset |
| **Main Menu** | `Logo.png` | `.png` | 171,022 | 167.01 KB | PNG Image (800 × 231) | Primary Game Logo |
| **Main Menu** | `shree_ram.glb` | `.glb` | 27,999,980 | 26.70 MB | glTF 2.0 Binary | Showcase Character for Main Menu Scene |
| **Main Menu** | `starry_galaxy_sky_hdri_background_photosphere.glb` | `.glb` | 980,280 | 957.30 KB | glTF 2.0 Binary | 3D Cosmic Sky Photosphere Dome |
| **Ram** | `Shree_Ram_-_Royal_Warrior.fbx` | `.fbx` | 11,395,916 | 10.87 MB | FBX 7400 Binary | Playable Hero Rigged Mesh with updated hairstyle and natural complexion (Milestone 3.2) |
| **Ram** | `bow_draw_and_shoot.fbx` | `.fbx` | 32,362,732 | 30.86 MB | FBX 7400 Binary | Bow Draw & Release Animation (Milestone 4) |
| **Ram** | `Warrior_aims_bow_toward_sky.fbx` | `.fbx` | 32,400,876 | 30.90 MB | FBX 7400 Binary | Divine Sky-Aiming Chant Animation (Milestone 6) |
| **Weapons** | `bow_asset.png` | `.png` | 38,748 | 37.84 KB | PNG Image (1017 × 572) | 2D Weapon Reference Art |
| **Weapons** | `tribal_basic_bow.glb` | `.glb` | 2,459,224 | 2.35 MB | glTF 2.0 Binary | 3D Equippable Bow Mesh (Milestone 4) |
| **Audio** | `main_menu.mp3` | `.mp3` | 321,069 | 313.54 KB | MPEG-1 Layer 3, 48 kHz, 128 kbps | Main Menu Atmospheric BGM (20.06s loopable) |
| **Audio** | `sand_ability.mp3` | `.mp3` | 466,413 | 455.48 KB | MPEG-1 Layer 3, 48 kHz, 64 kbps | Divya Sand Dune Cinematic Ultimate Track (29.16s) |
| **Audio** | `woosh.wav` | `.wav` | 193,972 | 189.43 KB | RIFF WAVE, 44.1 kHz, 16-bit PCM | Celestial Arrow & Ground Wave Eruption SFX (1.10s) |
| **Audio** | `end_credits.mp3` | `.mp3` | 1,576,609 | 1.50 MB | MPEG-1 Layer 3, 44.1 kHz, 192 kbps | Final Game Credits Soundtrack & Narration (~65.4s) |

---

## 3. Deep Asset Inspection Findings

### 3.1 Enemy: `Assets/Enemy/Aasura.fbx` (Active Enemy Character)
- **Source Location:** `Assets/Enemy/Aasura.fbx` (10,955,820 bytes)
- **Runtime Staged Model:** `public/assets/Enemy/Aasura.fbx` (10,955,820 bytes)
- **Specification:** FBX 7400 Binary
- **Model & Bounding Box:**
  - Raw Bounding Box: $161.57\text{ cm} \times 256.00\text{ cm} \times 122.26\text{ cm}$
  - Raw Height: $256.00\text{ cm}$ ($2.56\text{ m}$ scaled by $0.01\times$, standing as an imposing Rakshasa warrior relative to Shri Ram's $1.95\text{ m}$ height)
  - Ground Origin: Pivot located exactly at feet ($y = 0.00\text{ m}$).
- **Mesh & Skinning Structure:**
  - Mesh: `The_Priest` (SkinnedMesh with 206,985 non-indexed vertices / 68,995 triangles)
  - Armature: 69 bones total
  - Right Arm / Weapon Hierarchy: `RightShoulder` -> `RightArm` -> `RightForeArm` -> `RightHand` -> `WeaponR`
  - **Sword Rigging:** The sword is natively skinned directly to the `WeaponR` bone (rigid offset $0.12\text{ m}$ from `RightHand`). No duplicate sword asset or external socketing is required.
- **Original Materials (18 total):**
  - Character: `Skin`, `Skin details`, `Eyes`, `Eyebrows`, `Eyelashes`, `Teeth`, `Tongue`, `Pencil skirt` (Groups 7 & 8), `Hair`, `Beard`
  - Royal Gold Jewelry: `Gold pendant`, `Gold chains`, `Cuban chain`, `Gold ring` ($0xe8b838$, roughness $0.30$, metalness $0.85$)
  - Sword Materials: `Blade steel` ($0xd0d8e2$, roughness $0.22$, metalness $0.90$), `Brass` ($0xd4a044$, crossguard & pommel), `Grip leather` ($0x1a120c$, handle wrap)
- **16 Embedded Skeletal Animations:**
  1. `Idle` ($3.200\text{ s}$, 104 tracks) — Standard idle
  2. `Walk` ($1.067\text{ s}$, 104 tracks) — Walking locomotion
  3. `Run` ($0.733\text{ s}$, 104 tracks) — Running locomotion
  4. `Crouch idle` ($3.000\text{ s}$, 104 tracks) — Low crouching stance
  5. `Hit reaction` ($0.800\text{ s}$, 104 tracks) — Flinch from impact
  6. `Hit from back` ($0.800\text{ s}$, 104 tracks) — Rear impact reaction
  7. `Hit from front` ($0.800\text{ s}$, 104 tracks) — Frontal impact reaction
  8. `Open door` ($2.800\text{ s}$, 104 tracks) — Interaction
  9. `Jump` ($2.800\text{ s}$, 104 tracks) — Jump cycle
  10. `Low punch` ($2.033\text{ s}$, 104 tracks) — Unarmed low strike
  11. `Punch` ($0.900\text{ s}$, 104 tracks) — Unarmed punch strike
  12. `Sword slash` ($1.000\text{ s}$, 104 tracks) — Dynamic forward sword slash attack
  13. `Sword idle (guard)` ($3.000\text{ s}$, 104 tracks) — Combat-ready sword stance
  14. `Sword block` ($0.800\text{ s}$, 104 tracks) — Defensive sword parry
  15. `Death (fall forward)` ($1.700\text{ s}$, 104 tracks) — Forward knockdown death
  16. `Death (fall backward)` ($1.800\text{ s}$, 104 tracks) — Backward collapse death

### 3.1.1 Milestone 5.1 Optimization & Performance Overhaul
- **Performance Hitch Root Cause Diagnosed:**
  - `PlayerController.getTargetAimPoint()` was previously testing `this.aimRaycaster.intersectObjects(this.hittableEnvironment, true)` on every frame while aiming.
  - Placing `The_Priest` (206,985 vertices, 68,995 triangles, 69-bone SkinnedMesh) directly into `hittableEnvironment` forced Three.js to compute CPU skinning transformations across all 68,995 triangles in JavaScript on every frame when the ray entered the character's bounding volume.
  - Measured execution time: **151.04 ms per frame** (~6.6 FPS) when looking directly at Aasura!
  - Resolution: Created an independent, ultra-lightweight 64-triangle capsule combat hitbox (`Aasura_Combat_Hitbox`, radius $0.45\text{ m}$, length $1.6\text{ m}$) parented to character root. Reticle raycast time dropped from $151.04\text{ ms}$ to **$< 0.005\text{ ms}$** (a **30,000× speedup** with zero frame stuttering).
- **Consolidated Materials (18 -> 13 Materials):**
  - Combined `Gold pendant`, `Gold chains`, `Cuban chain`, and `Gold ring` into one shared PBR material (`Aasura_Gold_Shared`, color `$0xe8b838`, roughness $0.30$, metalness $0.85$).
  - Consolidated duplicate `Pencil skirt` materials.
  - Standardized sword blade steel, brass, and leather materials.
  - Reduced draw call count by 28% per mesh instance.
- **Runtime LOD Geometries (`EnemyLODBuilder.js`):**
  - **LOD0:** $68,995$ triangles ($206,985$ indexed vertices) — Full original close-range fidelity ($0\text{ m} - 14\text{ m}$).
  - **LOD1:** $30,647$ triangles ($55.6\%$ triangle reduction) — Medium distance ($14\text{ m} - 28\text{ m}$). Subsamples hyper-dense micro-chain links (groups 10 & 11 from 30,871 to 7,718 tris), beard (group 14 from 14,706 to 4,853 tris), and teeth (group 5 from 7,120 to 1,780 tris) while preserving $100\%$ sword and facial silhouette.
  - **LOD2:** $14,592$ triangles ($78.9\%$ triangle reduction) — Distant silhouette ($> 28\text{ m}$).
  - All 3 LODs preserve exact 69-bone armature, 4 skin weights/indices per vertex, UV coordinates, normals, and `WeaponR` sword tracking.
- **Reusable Enemy Multi-Instance Pipeline (`EnemyOptimizer.js`):**
  - Single master FBX cached once; master geometries, materials, and textures are shared in GPU memory.
  - Cloned instances generated with `SkeletonUtils.clone()`, providing independent skeletons and independent `AnimationMixer` instances.
  - Supports 10 active enemies running at **$241.9\text{ FPS}$** (median frame time $3.80\text{ ms}$, 0 long frames).
- **GPU Texture & Shader Prewarming:**
  - Textures initialized via `renderer.initTexture()`.
  - Shaders precompiled via `renderer.compileAsync()` before wave begins, completely eliminating first-visible frame spikes.

### 3.1.2 Superseded Enemy: `Assets/Enemy/simple.zip` (Sam.fbx)
- **Status:** Archived prototype asset. Fully removed from runtime pipeline in Milestone 4.5. Source file preserved untouched.

### 3.1.3 Impact Visual Effects (VFX Assets):
- **`public/assets/VFX/impact_burst_wood.png`:**
  - $256 \times 256$ RGBA PNG ($76.7\text{ KB}$), derived from `sparksexplosion.glb`.
  - Replaces all procedural square geometry with authentic transparent spark burst texture.
- **`public/assets/VFX/impact_dust_soil.png`:**
  - $256 \times 256$ RGBA PNG ($71.0\text{ KB}$), soft multi-layered radial soil dust cloud with transparent alpha.
  - Used for soil/terrain impacts, creating gentle billowing earth puffs without flat polygons.
- **`public/assets/VFX/arrow_tip_glow.png`:**
  - $128 \times 128$ RGBA PNG ($8.2\text{ KB}$), warm golden divine aura sprite.
  - Preserves subtle golden tip glow on flying arrows and remains visible at arrow tip while embedded in trees/ground.

### 3.2 Environment: `Assets/Enviornment/pine-forest.zip` (Active Gameplay Environment)
- **Source Archive:** `Assets/Enviornment/pine-forest.zip` (10,696,905 bytes)
- **Staged Runtime Model:** `public/assets/Environment/pine_forest.glb` (5,595,664 bytes)
- **glTF Specification:** glTF 2.0 Binary (self-contained with 4 embedded bufferViews)
- **Scene Hierarchy & Mesh Breakdown:**
  - Total Meshes: 3 | Total Nodes: 3 | Materials: 3 | Textures: 4 embedded
  - **`pine1` (Mesh 0):** Pine trees with needle/bark textures and normal map.
    - Dimensions: `[-24.00, 0.02, -22.98]` to `[27.39, 9.97, 23.44]` (~51.4m × 9.95m × 46.4m).
    - Pine canopy rises up to ~10m height. Double-sided material rendering applied for foliage.
  - **`obj1` (Mesh 1):** Forest floor terrain with moss/soil texture.
    - Dimensions: `[-27.16, -0.51, -27.16]` to `[27.16, 1.88, 27.16]` (~54.3m × 2.39m × 54.3m).
    - Centered at ground origin `y = 0..1m`.
  - **`obj2` (Mesh 2):** Enclosing sky dome sphere.
    - Dimensions: `[-70.64, -70.64, -70.64]` to `[70.64, 70.64, 70.64]` (radius ~70.64m).
    - Normals face **inward** (`dot = -70.6`).
    - **Integration Strategy:** Configured with `renderOrder = -1000`, `depthWrite = false`, `castShadow = false`, and unlit `MeshBasicMaterial` with `side: THREE.DoubleSide` so it surrounds the forest without occluding terrain or trees.
- **Performance Characteristics:**
  - Extremely lightweight: only 3 draw calls for environment geometry.
  - Replaces the 3,687-mesh landscape model, eliminating GPU bottlenecks.

### 3.2.1 Superseded Environment: `Assets/Enviornment/landscape_forest__mountains.glb`
- **Location:** `Assets/Enviornment/landscape_forest__mountains.glb` (15,695,700 bytes)
- **Status:** Archived source asset; removed from active runtime pipeline due to excessive draw call density (3,687 meshes). Original file preserved untouched.

### 3.3 Main Menu: `Assets/Main Menu/Logo.png`
- **Location:** `Assets/Main Menu/Logo.png`
- **Size:** 171,022 bytes
- **Image Dimensions:** 800 × 231 pixels (Aspect Ratio: ~3.46:1)
- **Format:** RGBA PNG with alpha transparency
- **Visuals:** Gold and bronze stylized "Ramayana Yudh" title typography with ornate Indian motifs.
- **Usage:** Positioned prominently at the upper/left portion of the Main Menu interface.

### 3.4 Main Menu: `Assets/Main Menu/shree_ram.glb`
- **Location:** `Assets/Main Menu/shree_ram.glb`
- **Size:** 27,999,980 bytes
- **glTF Specification:** glTF 2.0 Binary
- **Scene Hierarchy:**
  - Root Node: `Sketchfab_model` -> `Shree Ram 3D.obj.cleaner.materialmerger.gles`
  - Meshes: 28 sub-meshes (`Object_2` through `Object_29`)
  - Nodes: 30
  - Materials: 23 PBR materials
  - Textures: 9 embedded texture maps
  - Animations: None (Static sculpt / showcase mesh)
  - Rig/Skins: None
- **Bounding Box:**
  - Minimum: `[-0.469, -1.896, -1.116]`
  - Maximum: `[0.374, 0.048, 0.624]`
  - Dimensions: `0.843m (width) × 1.944m (height) × 1.739m (depth)`
- **Integration Notes:**
  - The model's origin has Y coordinates spanning `[-1.90, +0.05]`. When loading, the model must be normalized and centered using `THREE.Box3().setFromObject()`, with the base aligned to ground `y = 0` and placed on the right side of the screen.

### 3.5 Main Menu: `Assets/Main Menu/starry_galaxy_sky_hdri_background_photosphere.glb`
- **Location:** `Assets/Main Menu/starry_galaxy_sky_hdri_background_photosphere.glb`
- **Size:** 980,280 bytes
- **glTF Specification:** glTF 2.0 Binary
- **Scene Hierarchy:**
  - Meshes: 1 (`Object_4`)
  - Nodes: 5
  - Materials: 1
  - Textures: 1 (embedded high-resolution panoramic cosmic starfield)
- **Bounding Box:**
  - Minimum: `[-1.0, -1.0, -1.0]`
  - Maximum: `[1.0, 1.0, 1.0]` (Unit sphere)
- **Integration Strategy:**
  - Scale up to encompass the scene (e.g. `scale.setScalar(500)`).
  - Configure `material.side = THREE.BackSide` (or double-sided) and disable depth writing so it functions as a celestial background dome with slow continuous rotation.

### 3.6 Ram FBX Suite: `Assets/Ram/`
- **Files & Roles:**
  1. `Shree_Ram_-_Royal_Warrior.fbx` (12,191,692 bytes / 11.63 MB) — Latest Hero Character Rig exported from Ara 3D Studio (Milestone 3.3). Verified identical across `Assets/` and `public/assets/` (SHA-256: `34BDF526DE9D3B14C22930C988A8321C426C6EADDC6C2C3548C17A661F18A5CA`). Hair is Material Group 16 (`Hair`) rendered with double-sided black hair cards (`0x181818`, `specular: 0x282828`, `shininess: 25`, `side: THREE.DoubleSide`, `transparent: false`, `depthWrite: true`), flawlessly reproducing the textured short hairstyle from Ara 3D Studio. Staged at `public/assets/Ram/Shree_Ram_-_Royal_Warrior.fbx`.
  2. `bow_draw_and_shoot.fbx` (32,362,732 bytes / 30.86 MB) — Full skeletal animation stack for drawing, aiming, and releasing arrows (Milestone 4).
  3. `Warrior_aims_bow_toward_sky.fbx` (32,400,876 bytes / 30.90 MB) — Skeletal animation stack for invoking celestial astral weapons (Milestone 6).
- **Format:** FBX 7400 Binary format.
- **Skeletal Hierarchy & Rig Audit:**
  - Total Bones: **69 bones**.
  - Root Bone: `Hips`.
  - Spine & Upper Body: `Spine`, `Spine1`, `Spine2`, `Neck`, `Head`, `HeadTop_End`, `Jaw`, `LeftEye`, `RightEye`.
  - Limbs: Standard Mixamo-compatible hierarchy (`LeftShoulder`, `LeftArm`, `LeftHand`, `RightShoulder`, `RightArm`, `RightHand`, `LeftUpLeg`, `LeftFoot`, `RightUpLeg`, `RightFoot`).
  - Compatibility: Both `bow_draw_and_shoot.fbx` and `Warrior_aims_bow_toward_sky.fbx` share this identical 69-bone skeletal hierarchy.
- **Embedded Animation Clips in `Shree_Ram_-_Royal_Warrior.fbx` (15 Tracks):**
  1. `Idle` — 3.20s duration, looping hero breathing/idle stance.
  2. `Walk` — 1.07s duration, looping forward movement (calibrated cadence: $2.5\text{ m/s}$).
  3. `Run` — 0.73s duration, looping sprint movement (calibrated cadence: $6.0\text{ m/s}$).
  4. `Jump` — 2.80s duration, single-shot jump/leap action.
  5. `Crouch idle` — 3.00s duration.
  6. `Hit reaction` — 0.80s duration.
  7. `Hit from back` — 0.80s duration.
  8. `Hit from front` — 0.80s duration.
  9. `Open door` — 2.80s duration.
  10. `Rifle walk (aiming)` — 1.07s duration.
  11. `Low punch` — 2.03s duration.
  12. `Punch` — 0.90s duration.
  13. `Sword slash` — 1.00s duration.
  14. `Sword idle (guard)` — 3.00s duration.
  15. `Sword block` — 0.80s duration.
- **Model Geometry & Natural Dimensions:**
  - Mesh: `Shree_Ram_-_Royal_Warrior` (SkinnedMesh).
  - Bounding Box in FBX coordinates: `[-63.92, 0.00, -14.19]` to `[63.92, 194.68, 41.59]`.
  - Natural Height: **194.68 cm** ($1.95\text{ m}$).
  - Scale Factor: `0.01` yields an authentic 1.95m character height in Three.js meter units.
  - Base Alignment: `min.y = 0.00` naturally aligns feet with the ground terrain without vertical offsets.
  - Materials: 18 sub-materials with un-tinted diffuse mapping and `sRGBColorSpace` rendering (`hair_short01` for hair, `skin_old_caucasian_male` for skin).

### 3.7 Weapons: `Assets/Weapons/` (Staged in `public/assets/Weapons/`)
- **`bow_asset.png`:**
  - Size: 38,748 bytes | Dimensions: 1017 × 572 pixels.
  - 2D concept and UI reference art for weapon inventory/selection.
- **`tribal_basic_bow.glb` (Deployed & Verified in Milestone 4):**
  - Size: 2,459,224 bytes | glTF 2.0 Binary with embedded textures (`Simple_Bow_mat`).
  - Staged at `public/assets/Weapons/tribal_basic_bow.glb`.
  - **Modular Sub-Meshes Extracted:**
    1. **`ectra1_Simple_Bow_mat_0` (Bow Mesh):**
       - 1,108 vertices | Dimensions: $33.1\text{ cm} \times 126.8\text{ cm} \times 5.65\text{ cm}$.
       - Geometry centered around central grip handle.
       - Socketed to bone `LeftHand` with calibrated upright orientation (`rotation: (0, Math.PI / 2, 0)`, `position: (0, 4, 0)`).
       - Toggled visible/hidden via key `E` (Equip / Stow).
    2. **`quiver_Simple_Bow_mat_0` (Quiver Mesh):**
       - 646 vertices | Dimensions: $20.2\text{ cm} \times 66.4\text{ cm} \times 12.9\text{ cm}$.
       - Geometry centered and socketed to upper back bone `Spine2` (`position: (-8, 6, -14)`, `rotation: (0.2, 0.15, -0.65)`).
       - Slung diagonally across the right shoulder so the opening aligns with Shri Ram's reaching right hand.
       - Remains continuously equipped on the back.
    3. **`arrow_Simple_Bow_mat_0` (Arrow Mesh):**
       - 176 vertices | Dimensions: $8.9\text{ cm} \times 80.2\text{ cm} \times 7.5\text{ cm}$ (authentic $80\text{ cm}$ arrow shaft).
       - Serves 3 distinct roles:
         - **Quiver Arrow:** Exactly 1 visible arrow resting in the quiver opening (`position: (0, 16, 0)`).
         - **Infinite Quiver Replenishment:** When an arrow is drawn, a new arrow immediately appears in the quiver ($120\text{ ms}$), maintaining infinite supply with exactly 1 arrow visible.
         - **Drawn Arrow:** Mounted through bow arrow-rest while drawing the bowstring ($t = 0.24\text{s} \to 1.05\text{s}$).
         - **Ballistic Projectile:** Scaled by $0.01$ ($0.80\text{ m}$ in world space) with subtle golden aura light and launched at $52\text{ m/s}$ along aim ray under gravity.
- **`bow_draw_and_shoot.fbx` (Deployed & Verified in Milestone 4):**
  - Size: 32,362,732 bytes | Staged at `public/assets/Ram/bow_draw_and_shoot.fbx`.
  - Duration: $2.43\text{ s}$ | 71 tracks matching character 69-bone armature.
  - Phase 1: Reach for arrow ($t = 0.0\text{s} \to 0.24\text{s}$).
  - Phase 2: Arrow extracted & quiver replenished ($t = 0.24\text{s}$).
  - Phase 3: Nock and draw ($t = 0.24\text{s} \to 1.05\text{s}$).
  - Phase 4: Release string & launch projectile ($t = 1.05\text{s}$).
  - Phase 5: Follow-through and blend back to idle ($t = 1.55\text{s}$).

---

## 4. Asset Deployment in Application

- **Main Menu Assets:** Staged under `public/assets/Main Menu/` (`Logo.png`, `shree_ram.glb`, `starry_galaxy_sky_hdri_background_photosphere.glb`).
- **Environment Assets (Milestone 2.1):** Staged under `public/assets/Environment/pine_forest.glb` (5.59 MB self-contained glTF). Old landscape archived.
- **Hero Rig & Animations (Milestone 3 & 3.3):** Staged under `public/assets/Ram/Shree_Ram_-_Royal_Warrior.fbx` (12.19 MB, SHA-256: `34BDF526DE9D3B14C22930C988A8321C426C6EADDC6C2C3548C17A661F18A5CA`).
- **Weapons Assets (Milestone 4):** Staged under `public/assets/Weapons/tribal_basic_bow.glb` (2.46 MB) and `public/assets/Ram/bow_draw_and_shoot.fbx` (32.36 MB). Fully deployed and functional.
- **VFX Assets (Milestone 4.5 & 6):** Staged under `public/assets/VFX/` (`impact_burst_wood.png`, `impact_dust_soil.png`, `arrow_tip_glow.png`, `fire_flame.png`, `tornado_smoke.png`, `sparks_burst.png`, `sparks_emissive.png`, `jetpack_effect.glb`). Transparent textures and particles deployed for Divya Bahu-Baan mid-air splitting and Divya Sand Dune supernatural wave.
- **Divine Chant Animation (Milestone 6):** `Warrior_aims_bow_toward_sky.fbx` (32.40 MB) staged under `public/assets/Ram/Warrior_aims_bow_toward_sky.fbx` and loaded into active gameplay for the Divya Sand Dune invocation with normalized coordinate scaling.
- **Enemy Assets (Milestone 4.5 & 5):** `Aasura.fbx` (10.96 MB) staged under `public/assets/Enemy/Aasura.fbx` and loaded into active gameplay with combat animations and sword. Old `Sam.fbx` fully removed.

---

## 5. Milestone 6 Divine Ability VFX Audit

### 5.1 Jetpack Effect Archive (`Assets/VFX/jetpack-effect.zip`)
- **Extracted Contents:**
  - `source/Jetpack effect.glb` (324,356 bytes): Twin crossed textured planes with PBR emissive factor `[1, 1, 1]`. Staged to `public/assets/VFX/jetpack_effect.glb`.
  - `textures/fire__png__by_ivaxxx_d86iymh_0.png` (310,956 bytes): $1000 \times 640$ pixels, 8-bit RGBA with smooth flame transparency. Staged to `public/assets/VFX/fire_flame.png` and `public/assets/VFX/arrow_tip_glow.png`.
- **Role in Milestone 6:** Provides the authentic golden divine flame aura for arrow tips and the celestial sky arrow.

### 5.2 Sparks Explosion Asset (`Assets/VFX/sparksexplosion.glb`)
- **Extracted Contents:**
  - `sparks_burst.png` (766,688 bytes): $1024 \times 1024$ RGBA authentic spark burst with alpha.
  - `sparks_emissive.png` (1,999,339 bytes): $1024 \times 1024$ RGB emissive spark core.
- **Role in Milestone 6:** Pre-allocated mid-air transformation burst sprite for Divya Bahu-Baan arrow multiplication.

### 5.3 Fire Tornado Smoke Plume (`Assets/VFX/fire_tornado.glb`)
- **Extracted Contents:**
  - `tornado_smoke.png` (304,014 bytes): $512 \times 512$ RGBA authentic billowing smoke/dust plume with smooth edge transparency.
- **Role in Milestone 6:** 28 rolling ground-hugging dust billow sprites for the Divya Sand Dune supernatural wave, conforming to Rapier terrain trimesh elevation.

---

## 6. Milestone 6.5 Cinematic Audio & Divine Sand Dune Assets

### 6.1 Audio Assets (`Assets/Music/` staged to `public/assets/audio/`)
- **`main_menu.mp3` (Main Menu Atmospheric BGM):**
  - File Size: 321,069 bytes.
  - Duration: **20.06 seconds** (seamlessly loopable).
  - Format: MPEG-1 Audio Layer 3, Stereo (2 channels), 48,000 Hz, 128 kbps.
  - Deployment: Managed by `AudioDirector.js`. Fades in softly on menu load, smoothly loops, fades out over 1.0s when Play is selected, and resumes upon returning to main menu. Master and music volume sliders in Settings dynamically control gain.
- **`sand_ability.mp3` (Divya Sand Dune Cinematic Soundtrack):**
  - File Size: 466,413 bytes.
  - Duration: **29.16 seconds** (exact timeline duration).
  - Format: MPEG-1 Audio Layer 3, Stereo (2 channels), 48,000 Hz, 64 kbps.
  - Deployment: Managed by `AudioDirector.js` and `SandDuneCutscene.js`. Orchestrates the entire 29.16s cinematic sequence, transitioning through invocation, chant, sky release, rolling sand wave, and encounter resolution.
- **`woosh.wav` (Celestial Release & Eruption SFX):**
  - File Size: 193,972 bytes.
  - Duration: **1.10 seconds**.
  - Format: RIFF WAVE, Stereo (2 channels), 44,100 Hz, 16-bit PCM, 1411 kbps.
  - Deployment: Triggered at apex celestial arrow release ($t = 13.0\text{s}$) and sand wave ground eruption ($t = 18.0\text{s}$).
- **`seething_sandstorm.glb` (Sandstorm 3D Asset):**
  - File Size: 33,287,868 bytes ($33.28\text{ MB}$).
  - Format: glTF 2.0 Binary with 13 meshes, 7 materials (`sand`, `material`, `frame`), 3 embedded images, and 14.0s looping animation sampler.

### 6.2 Cinematic Orchestration (`src/cinematics/SandDuneCutscene.js`)
- **Cutscene Timeline (29.16s total duration):**
  - **Scene 1 — The Invocation ($0.0\text{s} - 5.0\text{s}$):** Camera glides from gameplay aiming perspective into a dramatic close-up of Shri Ram's face (FOV 42°). Environmental lighting shifts to warm amber gold. Subtle sand particles ($140$ pre-allocated points) swirl around his feet.
  - **Scene 2 — Divine Chant ($5.0\text{s} - 13.0\text{s}$):** Shri Ram invokes the celestial mantra with `Warrior_aims_bow_toward_sky.fbx`, grounded firmly. Multi-angle cinematic framing (medium 3/4 shot transitioning to low-angle hero shot looking up past the raised bow). Swirling sand accelerates into a dense golden vortex.
  - **Scene 3 — Celestial Arrow Ascent ($13.0\text{s} - 18.0\text{s}$):** Apex release at $t = 13.0\text{s}$ accompanied by woosh SFX. Radiant golden arrow ascends vertically into the heavens ($v_y = 42\text{ m/s}$), camera tilts up tracking its ascent into the cloud layer.
  - **Scene 4 — Divine Sand Dune Manifestation ($18.0\text{s} - 25.5\text{s}$):** Wide panoramic battlefield shot (FOV 56°). Massive rolling sand wave ($28$ billow sprites + $80$ tumbling debris stones) sweeps 48 meters across the forest clearing conforming to Rapier terrain elevation.
  - **Scene 5 — Enemy Destruction & Aftermath ($25.5\text{s} - 29.16\text{s}$):** Advancing wave front strikes all living Aasura enemies, triggering authentic directional fall/death animations and incrementing defeat counters. Unspawned wave spawns cancelled. Dust settles, lighting smoothly returns to pine forest daylight, camera glides back behind Shri Ram's shoulder, controls restored, and victory banner displayed.

---

## 7. Milestone 7 Final UI, Audio & Credits Assets

### 7.1 Final Credits Audio
- **`end_credits.mp3` (Final Game Credits Narration & Soundtrack):**
  - Source Location: `Assets/music/end_credits.mp3`
  - Runtime Staged: `public/assets/audio/end_credits.mp3`
  - File Size: 1,576,609 bytes ($1.50\text{ MB}$).
  - Audio Format: MPEG-1 Audio Layer 3, Stereo, 44,100 Hz, 192 kbps.
  - Duration: **~65.4 seconds**.
  - Deployment: Managed by `AudioDirector.js` and `CreditsScene.js`. Initiated smoothly after the post-Wave-2 fade to black. Fades in over 2.0s, plays throughout the ending presentation, and fades out cleanly upon selecting **PLAY AGAIN** or **RETURN TO MAIN MENU**.

### 7.2 Visual & Typography Assets
- **Fonts:**
  - `Cinzel Decorative` (Google Fonts): Used for primary game titles, cinematic headers, and Sanskrit shloka headers.
  - `Cinzel` (Google Fonts): Used for navigation buttons, UI labels, subheadings, and narrative prose.
- **UI & Presentation Sprites:**
  - `Logo.png`: Staged at `public/assets/Main Menu/Logo.png` (800 × 231 PNG). Used on the Main Menu and Loading Screen.
  - Vector Chakras & Ornaments: Embedded SVG divine chakras and unicode mythic glyphs (`❖`, `ॐ`, `🪔`, `« »`, `⟨ ⟩`).





