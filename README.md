# VYUHAK Full Application Package (Solar View + Zoom/Interior Pop-Up)

Complete standalone web bundle with:
- `index.html`: Top HUD, body selector chips, heliocentric canvas stage, camera zoom scrubber, and object pop-up.
- `src/css/main.css`: Responsive dark-mode HUD and viewport-clamped pop-up styles without GPU-heavy blur.
- `src/js/bodies-data.js`: Solar system body telemetry, geological/interior descriptions, and close-zoom thresholds.
- `src/js/popup-controller.js`: Shows `DIST`, `VEL`, `ESI/INFO`, and interior/geological text inside the pop-up only when zoomed close (`cameraDistance <= closeThreshold`) or inside interior mode (`isInsideInterior === true`).
- `src/js/solar-renderer.js`: Lightweight 2D canvas renderer with interior cross-section view.
- `src/js/app.js`: State wiring for body selection, zoom presets/slider, and `Enter Interior ->` / `<- Exit Interior`.
