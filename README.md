# VYUHAK v19 APEX // Real-Time Earth, ISS & Keplerian Solar System

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is a serverless 3D/2D orbital intelligence and heliocentric Solar System platform built with Three.js custom GLSL shaders, Leaflet.js, and 100% free, keyless live APIs.

## What's New in v19 APEX
- **True Heliocentric Keplerian Solar System (`Cosmos` Mode):** Computes real-time 3D heliocentric positions, AU distances from the Sun & Earth, light-time in minutes, and vis-viva orbital velocities for all 8 planets using NASA JPL J2000 orbital elements and Newton-Raphson Kepler's Equation (`M = E - e sin E`), complete with inclined elliptical orbital paths, a 1,200-body Main Asteroid Belt, and an interactive Planet Selector bar with smooth cubic fly-to camera transitions.
- **Animated Solar Photosphere & Volumetric Corona:** Replaced the flat Sun sphere with a live animated plasma granulation GLSL shader and soft additive volumetric corona.
- **Real-Time NASA JPL Near-Earth Asteroids:** Integrates NASA's keyless Close-Approach Data API (`ssd-api.jpl.nasa.gov/cad.api`) into the Live Events feed.
- **Ultra-Compact Single-Strip Top HUD & One-Row Quick-Toggle Rail:** Cut top UI vertical height by >45% with sleek status-dot pill toggles (`3D/2D`, `Free`, `Hover`, `ISS`, `Cosmos`, `Radar`, `Clouds`).
- **Dynamic Zoom-Adaptive Touch Sensitivity & Swipeable Bottom Dock:** Touch rotation speed scales smoothly with camera distance for surgical close-up precision and effortless wide-space navigation, plus thumb-swipe open/close on the bottom dock.
- **True Keplerian Satellite Velocity:** Real-time orbital speed `v = sqrt(GM / (R + h))` updates accurately across all altitudes and never gets stuck at `0.00 km/s` after unlocking Hover.

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
