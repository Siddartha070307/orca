# ORCA — Realistic Coastal Ocean Simulation & Interactive Commercial Vessel

A real-time 3D coastal ocean simulator built with Three.js, WebGL GLSL shaders, procedural Gerstner waves, dynamic weather transitions, dual-layer volumetric clouds, precipitation and lightning, day/night celestial illumination, and a fully controllable commercial fishing trawler.

---

## Key Features

### 1. Dynamic Weather & Atmospheric Engine
- **4 Cinematic Weather Presets**:
  - **Sunny**: Elevated warm sun (26°), luminous cyan water, gentle swells, soft drifting cumulus clouds, and golden sun glints.
  - **Cloudy**: Diffused ambient daylight, low heavy overcast cloud deck, muted ocean reflections, and gentle rolling waves.
  - **Night**: Atmospheric moonlight path on ocean swells, cratered moon disc with glowing corona halo, 1,200 twinkling celestial stars, illuminated coastal skyscraper windows, beachfront promenade streetlights, and vessel navigation lanterns.
  - **Storm**: Dark atmospheric tempest, violent towering Gerstner waves with intense crest foam, heavy particle rain with wind slant, ocean surface impact ripples, and procedural multi-pulse branched lightning strikes.
- **Gradual Seamless Transitions**: All lighting parameters (sun position, directional colors, hemispheric ambient, sky turbidity/Rayleigh, exposure, bloom threshold, wave amplitude/foam) interpolate smoothly without jarring jumps.
- **Glassmorphism Weather UI & Shortcuts**: Interactive UI buttons (`☀ Sunny`, `☁ Cloudy`, `🌙 Night`, `⛈ Storm`) plus numeric hotkeys `1`–`4`.

### 2. Dual-Layer 3D Cloud System
- **Lower Cumulus/Stratus Layer**: Procedural multi-frequency FBM cloud deck at $Y = 1,450$ drifting with wind currents.
- **Upper Cirrus Veil Layer**: High-altitude wispy veil at $Y = 2,450$ creating parallax depth against the sky.
- **Weather Reactive**: Clouds dynamically darken, thicken, and shift tint between fair skies, overcast, and storm conditions.

### 3. Precipitation & Thunderstorm System
- **3D Particle Rain**: 4,500 particles falling at high terminal velocity with storm wind drift, recycled inside a bounding cylinder surrounding the vessel.
- **Surface Impact Ripples**: Expanding concentric ripple rings on the water surface around the boat hull during rainfall.
- **Procedural 3D Lightning**: Procedurally generated jagged branched lightning bolts discharging across the sky with multi-pulse ambient flashes, horizon point lights, and exposure bursts.

### 4. Night Environment & Celestial Illumination
- **Textured Moon**: High-resolution lunar surface sphere with dark basaltic maria and impact craters.
- **Atmospheric Corona Halo**: Additive-blended radial glow disc facing the camera.
- **Directional Moonlight Specular Path**: Casts a silvery shimmering reflection beam across Gerstner wave crests towards the camera.
- **Twinkling Starfield**: 1,200 celestial stars distributed across the northern sky dome with subtle scintillating twinkle.
- **Illuminated Coastal Skyline**: Hundreds of glowing skyscraper windows (warm residential amber and cool commercial white) and illuminated beachfront promenade streetlights.

### 5. Modern Commercial Fishing Trawler (~41m)
- **Engineered Hull**: Raked clipper stem, hydrodynamic bulbous bow, wide flared foredeck, and rounded working stern.
- **Active Rotating Marine Radar**: Open-array scanner bar rotating continuously atop the main lattice mast.
- **Commercial Fishing Hardware**: Heavy tubular steel stern trawl gallows arch, hydraulic net drum reel with diamond-mesh netting, twin heavy-duty warp winches, and palletized plastic fish crates (royal blue, industrial yellow, crisp white).
- **Navigation & Night Lighting**: Port (red), starboard (green), and masthead (white) navigation lanterns, twin halogen aft working floodlights illuminating the net drum, and warm incandescent bridge cabin interior illumination.
- **High Performance Navigation**: Up to 31 knots top speed with proportional 5-probe wave buoyancy, dynamic bow planing lift, centrifugal roll heel, V-shaped trailing wake, and bow spray foam.

---

## Controls

| Key / Action | Function |
|---|---|
| `W` / `Arrow Up` | Throttle Forward (smooth acceleration up to ~31 kts) |
| `S` / `Arrow Down` | Throttle Reverse (smooth braking & reverse propulsion) |
| `A` / `Arrow Left` | Steer Port (Left) |
| `D` / `Arrow Right` | Steer Starboard (Right) |
| `W+A` / `W+D` / `S+A` / `S+D` | Coordinated turn navigation |
| `1` | Switch to **Sunny** Weather |
| `2` | Switch to **Cloudy** Weather |
| `3` | Switch to **Night** Weather |
| `4` | Switch to **Storm** Weather |
| `C` | Toggle Camera Mode (`FOLLOW` ⇄ `ORBIT`) |
| `Mouse Drag` | Orbit camera view 360° |
| `Scroll Wheel` | Smooth zoom in / zoom out (8m to 3,500m) |

---

## How to Run

### Option 1: VS Code Live Server
1. Open this folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html` and select **Open with Live Server**.

### Option 2: Any Local HTTP Server
Using Python:
```bash
python -m http.server 8080
```
Then open `http://localhost:8080/` in Google Chrome, Microsoft Edge, or any modern WebGL2 browser.

