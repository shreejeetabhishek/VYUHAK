# VYUHAK Solar Pop-Up Zoom & Interior Wiring

This package provides a working reference implementation for hiding deep telemetry (`DIST`, `VEL`, `ESI/INFO`) and interior/geological descriptions at system zoom, revealing them inside the selected body's pop-up only when zoomed in close (`cameraDistance <= closeThreshold`) or when inside interior mode (`isInsideInterior === true`).

## Files Included
- `index.html`: Mobile-first HUD, celestial target marker, and object pop-up markup.
- `styles.css`: Dark-mode layout, viewport clamping, and `.mode-deep-inspect` / `.mode-interior` styling.
- `app.js`: Camera zoom threshold calculation, interior toggle state, and bounds-clamped pop-up positioning.
