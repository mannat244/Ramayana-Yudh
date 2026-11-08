# Ramayana Yudh (रामायण युद्ध)
### 3D Mythological Action Game — Three.js • Rapier3D • Vite

A high-performance 3D mythological action game depicting Shri Ram's battle against the Rakshasa horde in the Dandakaranya forest.

---

## 🎮 Gameplay Features

- **Hero Character Controller:** Realistic third-person locomotion (walk, run, sprint, jump, turn in-place) with full bone armature animation and grounded terrain elevation.
- **GTA-Style Over-the-Shoulder Archery:** Precision crosshair raycasting, smooth shoulder camera transition, draw-and-release ballistic trajectory.
- **Rapid-Fire Archery:** Responsive arrow replenishment from back quiver.
- **Dynamic Enemy AI & Wave Manager:** Two-wave encounter with perimeter fog emergence, spatial separation steering, and directional death physics.
- **Divine Abilities:**
  - **Divya Bahu-Baan (Key Q, 50% Energy):** One arrow transforms and multiplies in mid-air into 3–4 divine arrows targeting distinct living enemies.
  - **Divya Sand Dune Ultimate (Key R, 100% Energy):** Celestial mantra chant, sky arrow launch, and a 29.16-second cinematic cutscene where a rolling supernatural sand wave sweeps the arena conforming to Rapier terrain elevation.
- **Cinematic Audio System:**
  - Seamless loopable atmospheric BGM on the Main Menu with smooth fade-in/fade-out.
  - Dedicated epic orchestral soundtrack for the Divya Sand Dune Ultimate cutscene.
  - Celestial arrow woosh SFX.
  - Volume sliders in the Settings modal.

---

## 🕹️ Controls

| Action | Key / Input |
| :--- | :--- |
| **Move** | `W`, `A`, `S`, `D` |
| **Sprint** | `Shift` (while moving) |
| **Equip / Stow Bow** | `E` |
| **Aim** | Hold `Right Mouse Button (RMB)` |
| **Shoot** | `Left Mouse Button (LMB)` |
| **Divya Bahu-Baan (Multi-Arrow)** | `Q` (requires 50% Divine Energy) |
| **Divya Sand Dune (Ultimate Cutscene)** | `R` (requires 100% Divine Energy in Wave 2) |
| **Settings / Audio** | Click Settings on Main Menu |

---

## 🛠️ Tech Stack

- **Rendering Engine:** [Three.js](https://threejs.org/) (WebGL / PBR materials / PCF Shadows)
- **Physics Engine:** [@dimforge/rapier3d-compat](https://rapier.rs/) (WebAssembly rigid bodies & trimesh terrain collision)
- **Bundler:** [Vite](https://vitejs.dev/)
- **Audio Architecture:** HTML5 Audio & Web Audio API (zero external audio dependencies)

---

## 🚀 Running Locally

```bash
# Clone the repository
git clone https://github.com/mannat244/Ramayana-Yudh.git
cd Ramayana-Yudh

# Install dependencies
npm install

# Start local dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📦 Building for Production

```bash
npm run build
```
Outputs static production-ready files to the `dist/` folder.

