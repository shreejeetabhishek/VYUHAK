# VYUHAK v25 WARP // Seamless Multi-Scale Earth, Solar System & Milky Way

VYUHAK (*Virtual Yield Uplink & Heuristic Aerospace Kinematics*) is a serverless, mobile-first 3D/2D Earth Observation, Heliocentric Solar System, and Volumetric Milky Way Galaxy platform powered by Three.js custom GLSL shaders, Leaflet.js, and 100% free, keyless live APIs.

## What's New in v25 WARP
- **Continuous "Powers of Ten" Scale Zoom Transitions:** Jumping between **Earth**, **Cosmos**, and **Galaxy** now executes a smooth two-phase zoom-out or zoom-in warp rather than a hard cut:
  - **Zooming Out (`Earth -> Cosmos`, `Earth -> Galaxy`, `Cosmos -> Galaxy`):** Accelerates outward with a dynamic FOV warp (`45° -> 64° -> 45°`), smoothly hands off at Earth's real-time Keplerian position (in Cosmos) or the Solar System pinpoint at `26,670 ly` (in Galaxy), and glides back to the grand overview.
  - **Zooming In (`Galaxy -> Cosmos`, `Galaxy -> Earth`, `Cosmos -> Earth`):** Dives straight into the pulsing Solar System pinpoint (in Galaxy) or Earth's live position (in Cosmos), then decelerates smoothly into Earth's sunlit orbital view.
- **Audio Warp Feedback & Instant Touch Override:** Subtle synthesized warp sweeps (respecting Mute) and instant manual control if you touch the screen during arrival.

## Deployment
Upload `index.html`, `styles.css`, `app.js`, and `README.md` directly to your GitHub Pages repository.
