# VYUHAK v16 // Photorealistic Real-Time Orbital Intelligence Platform

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is a serverless, browser-based 3D/2D Earth Observation Platform powered by Three.js custom GLSL shaders, Leaflet.js, and 100% free, keyless live global APIs.

## What's New in v16
- **Photorealistic Real-Time Earth Shader:** Custom GLSL shader blending NASA Blue Marble daytime imagery, glowing night-side city lights, ocean-only specular sun reflections, a warm twilight sunset terminator synchronized to real-time UTC solar coordinates, a drifting 3D cloud layer, a volumetric Fresnel atmosphere rim glow, and a 2,200-star deep-space starfield.
- **Live ISS Real-Time Tracking:** Toggle `ISS Live` on the top bar to track the actual International Space Station (`api.wheretheiss.at`) in real time with live altitude, velocity, and Ground Data.
- **2D RainViewer Weather Radar:** Switch to `2D` and toggle `Rain Radar` to overlay live global precipitation radar tiles from the RainViewer API.
- **Slower, Frame-Rate Independent Orbital Physics:** Uses `THREE.Clock` (`deltaTime`) with a smooth initial glide speed (`0.035 rad/s`) so motion is identical on 60Hz and 120Hz displays.
- **Zero-Jump Hover Lock & Unlock + 3D Double-Tap Raycaster:** Double-tap anywhere on the 3D globe (or tap the 2D map) to deploy instantly; unlocking Hover Lock resumes smoothly from the exact spot.
- **City Search, AQI & Caching:** Search any city, country, or coordinate via Open-Meteo Geocoding, view live US AQI / PM2.5 / UV Index, and enjoy fast mobile performance with 5-minute in-memory API caching.

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
