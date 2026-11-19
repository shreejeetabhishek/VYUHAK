# VYUHAK v36 TARGETED // Anchor-Targeted Nested Pinch-Zoom & Spatial Continuity

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is a serverless, mobile-first 3D/2D Earth Observation, Heliocentric Solar System, Volumetric Milky Way Galaxy, Observable Universe, and Multiverse platform.

## What's Upgraded in v36 TARGETED
- **Anchor-Targeted Spatial Pinch-In Across Every Scale:**
  - Pinching inward now transitions to an inner scale **only when your camera actually dives into the nested home anchor** (`camera.position.distanceTo(anchorWorldPos)`), whether or not you tapped a top chip:
    - **Solar → Earth:** Only transitions when pinching close to **Earth's live 3D position** (`< 1.85` units)—pinching into the Sun, Jupiter, Saturn, or Halley's Comet lets you inspect them up close without accidentally dropping into Earth view.
    - **Galaxy → Solar:** Only transitions when pinching into the **Solar System pin** (`< 3.2` units) on the Orion-Cygnus Spur—pinching into Sagittarius A* or Andromeda lets you inspect them closely.
    - **Universe → Galaxy:** Only transitions when pinching into the **Laniakea / Home Galaxy anchor** (`< 3.8` units)—pinching into Boötes Void or Sloan Great Wall keeps you inside Universe view.
    - **Multiverse → Universe:** Only transitions when pinching inside **Our Universe's CMB horizon** (`< 66.0` units)—pinching into neighboring bubble universes keeps you in Multiverse view.
  - Zooming outward remains completely seamless across every scale boundary.

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
