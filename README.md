# VYUHAK v35 UNIFIED // Seamless Nested Multiverse Pinch-Zoom & Scroll Continuity

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is a serverless, mobile-first 3D/2D Earth Observation, Heliocentric Solar System, Volumetric Milky Way Galaxy, Observable Universe, and Multiverse platform.

## What's Upgraded in v35 UNIFIED
- **Seamless Same-Direction Pinch/Scroll Continuity Across All Scales:**
  - When zooming in or out with pinch/scroll gestures, the camera now preserves its exact radial viewing direction and keeps `controls.target` at `(0, 0, 0)` while stepping into the adjacent scale at a matched distance (`13.5` on Earth entry, `13.8` on Cosmos entry, `24.0` / `112.0` on Galaxy, `18.0` / `70.0` on Universe, `94.0` on Multiverse)—eliminating jarring target snaps and direction flips.
  - Pinching inward in Solar view now seamlessly transitions into Earth view regardless of whether you first clicked the `Earth` chip or pinched directly inward.
  - Reduced the auto-scale debounce cooldown (`450ms`) so rapid pinch-zooming across multiple nested scales feels fluid and continuous.

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
