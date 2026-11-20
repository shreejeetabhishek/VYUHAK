# Non-Destructive Patch for VYUHAK

My previous full-page replacement broke your existing styling and layout. This archive contains only `vyuhak-popup-patch.js`, a non-destructive patch designed to sit on top of your existing page without replacing your CSS or canvas.

## How to Use
1. Add `vyuhak-popup-patch.js` to your project folder.
2. Include `<script src="vyuhak-popup-patch.js" defer></script>` at the end of `<body>` in your existing `index.html`.
3. Optionally call `window.VYUHAK_POPUP.setState({ cameraDistance, isInsideInterior, bodyKey, anchor: { x, y } })` from your camera/zoom loop when zooming close or entering an object's interior.
