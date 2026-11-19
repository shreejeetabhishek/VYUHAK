# VYUHAK v17 COSMOS // Real-Time Earth, ISS & Solar System Intelligence

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is a serverless 3D/2D orbital intelligence and astronomical visualization platform built with Three.js custom GLSL shaders, Leaflet.js, and 100% free, keyless live APIs.

## What's New in v17 COSMOS
- **Realistic International Space Station (ISS) 3D Model:** Switching `ISS Live` ON swaps the spacecraft to a detailed ISS model with an integrated truss backbone, pressurized cylindrical modules, thermal radiators, and 8 copper-gold solar wing arrays tracked live via `api.wheretheiss.at`.
- **Proportional Spacecraft Scaling & Controls:** Both `VK-Tracker-01` and the `ISS` default to realistic proportions relative to Earth, with dedicated **VK-Tracker Size** and **ISS Station Size** sliders in Settings.
- **Realistic Sun-Lit Clouds:** Custom GLSL cloud shader that illuminates clouds on the sunlit day side and dims them naturally across the twilight terminator and night side.
- **Real-Time Solar System, Catalog Stars & Meteors:** Renders the Sun, Moon (real-time synodic phase), all major planets (Mercury through Neptune with Saturn's rings) positioned via J2000 Keplerian orbital elements, real bright catalog stars (Sirius, Rigel, Betelgeuse, Vega, Polaris, etc.), and periodic streaking space meteors.
- **Expanded Artificial Satellite Settings:** Includes Orbit Eccentricity (circular to elliptical), Prograde/Retrograde orbit direction, Live Clouds toggle, Scan Beam toggle, and Space Meteors toggle.

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
