# VYUHAK v39 CONTINUOUS // Earth-Anchored Manual Zoom-Out & Seamless Multiverse

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is a serverless, mobile-first 3D/2D Earth Observation, Heliocentric Solar System, Volumetric Milky Way Galaxy, Observable Universe, and Multiverse platform.

## What's Upgraded in v39 CONTINUOUS
- **Earth-Anchored Manual Zoom-Out into Solar System:**
  - When manually zooming out past `camDist > 15.6` in Earth view, the camera now smoothly steps into the Solar System **behind Earth's live 3D orbital position** (`earthWorld + outwardDir * 4.2`) rather than resetting `controls.target` to `(0, 0, 0)` and snapping onto the Sun.
  - Pinching back inward onto Earth returns cleanly to Earth orbital scale facing India.
- **Cache-Busted Entry (`?v=39`):** Ensures mobile browsers immediately load the updated zoom handoff.

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
