# VYUHAK v40 TRUE-CONTINUOUS // Every Pinch/Scroll Handoff Across All Scales

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is a serverless, mobile-first 3D/2D Earth Observation, Heliocentric Solar System, Volumetric Milky Way Galaxy, Observable Universe, and Multiverse platform.

## What's Upgraded in v40 TRUE-CONTINUOUS
- **Every Outward Pinch/Scroll Stage Anchored to Your Current View:**
  - **Earth → Solar:** Steps out behind Earth's orbital node (`earthWorld + outwardDir * 4.4`) instead of snapping onto the Sun.
  - **Solar → Galaxy:** Steps out around the Solar System pin (`solarWorld + outDir * 7.5`) so you see the Solar System within the Milky Way disk rather than jumping to an unrelated spot.
  - **Galaxy → Universe:** Preserves your outward direction into the Cosmic Web (`outDir * 18.0`).
  - **Universe → Multiverse:** Expands outward smoothly outside the CMB horizon (`outDir * 165.0`).
- **Every Inward Pinch/Scroll Stage Anchored to the Target:**
  - Pinching inward transitions only when diving directly into the home anchor (`Earth`, `Solar System pin`, `Laniakea / Home Galaxy`, or `Our Universe`), placing your camera at a natural entry distance (`getEarthIndiaCameraPos(13.5)`, `12.0` from Solar pin, `22.0` from home galaxy, or `64.0` from Universe center).

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
