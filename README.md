# VYUHAK v18 COSMOS // Real-Time Earth, ISS & Solar System Intelligence

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is a serverless 3D/2D orbital intelligence and astronomical visualization platform powered by Three.js custom GLSL shaders, Leaflet.js, and 100% free, keyless live APIs.

## What's Fixed & Upgraded in v18
- **Pinch-to-Zoom Touch Fix:** Rewrote the 3D double-tap raycaster to track active multi-touch pointers and drag distance—pinching with two fingers to zoom in/out never triggers accidental 3D Lock or pops open Ground Data.
- **Soft, Wispy 3D Clouds + 2D Live Infrared Satellite Clouds:** Fixed the blocky cloud artifact by sampling the proper PNG alpha mask (`c.a * c.r`) with smooth twilight tinting, and added a live **IR Clouds** overlay on the 2D map via RainViewer.
- **Volumetric Gradient Scan Beam & Terrain Relief Shading:** Replaced the wireframe cone with a smooth additive GLSL gradient beam and added elevation relief shading in `earthShaderMat` so mountain ranges catch angled sunlight.
- **Sunlit Opening Camera & Procedural Moon/Planets:** The camera opens facing the live sunlit hemisphere and twilight terminator, while the Moon (cratered maria shader) and all Solar System planets (banded atmospheric shaders) render with rich surface detail.
- **Stale Ocean Card Reset & Pulsing Event Beacons:** Demographic cards reset cleanly on every new scan so ocean data never lingers over land, and 3D event beacons pulse smoothly on the globe surface.

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
