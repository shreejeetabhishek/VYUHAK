# VYUHAK v28 INFINITY // Clean HUD & Cinematic Multi-Scale Intelligence

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is a serverless, mobile-first 3D/2D Earth Observation, Heliocentric Solar System, Volumetric Milky Way Galaxy, and Observable Universe platform.

## What's Fixed in v28
- **Fixed "YOU ARE HERE" Pin Showing on Earth View:** Resolved a CSS specificity conflict where `#you-are-here-pin { display: flex; }` and `#scale-bar-hud { display: flex; }` overrode Tailwind's `.hidden` class. Both overlays now hide cleanly in Earth view, 2D view, during warp transitions, and when zoomed right up to Earth in Cosmos view.
- **Accurate Dot-Anchored Callout Alignment:** Shifted the callout transform (`translate(-3.5px, -50%)`) so the glowing dot locks onto Earth/Solar System/Laniakea while the label extends cleanly off to the side without covering the object.

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
