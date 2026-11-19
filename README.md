# VYUHAK v37 INDIA // India-Centered Orbital Home View & Seamless Multiverse

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is a serverless, mobile-first 3D/2D Earth Observation, Heliocentric Solar System, Volumetric Milky Way Galaxy, Observable Universe, and Multiverse platform.

## What's Upgraded in v37 INDIA
- **India-Centered Globe Framing (`21.5° N, 79.0° E`):**
  - Replaced the sun-longitude camera offset with `getEarthIndiaCameraPos()`, which computes India's exact live world vector (`latLonToWorldPosition(21.5, 79.0, 1.0, earthMesh.rotation.y)`) so the Indian subcontinent always faces directly toward you on initial load, page refresh, top-bar `Earth` button transitions, and pinch-zoom returns into Earth view.
- **Cache-Busted Entry (`?v=37`):** Ensures mobile browsers immediately apply the new India-centered framing.

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
