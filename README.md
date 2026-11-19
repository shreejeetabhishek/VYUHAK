# VYUHAK v20 ULTRA // Photorealistic Earth, ISS & Keplerian Solar System

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is a serverless 3D/2D orbital intelligence and heliocentric Solar System platform built with Three.js custom GLSL shaders, Leaflet.js, and 100% free, keyless live APIs.

## What's Upgraded in v20 ULTRA
- **Pinpoint Circular Stars & Asteroids:** Replaced default square WebGL point sprites with custom radial-gradient `CanvasTexture` glow sprites so every star and Main Belt asteroid renders as a crisp luminous orb—never a square.
- **Refined Atmospheric Twilight Terminator:** Eliminated the harsh brown terminator stripe on Earth in favor of a subtle, physically blended Rayleigh twilight transition.
- **FBM Solar Photosphere & Volumetric Corona Flare:** Upgraded the Sun with a 4-octave Fractal Brownian Motion plasma granulation shader, darker sunspots, and an additive billboard volumetric corona.
- **FBM Atmospheric Planets & Cassini-Division Saturn Rings:** Replaced sine-striped planets with 3D FBM turbulent atmosphere shaders, polar ice caps on Mars, atmospheric Fresnel rims on Neptune/Uranus/Venus, and a custom multi-band Cassini-division ring shader for Saturn.
- **Cosmos Time-Warp (`1x Live`, `1 Day/s`, `15 Days/s`, `60 Days/s`):** Watch all 8 planets spin on their axes and orbit the Sun dynamically along their true NASA JPL J2000 Keplerian paths.

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
