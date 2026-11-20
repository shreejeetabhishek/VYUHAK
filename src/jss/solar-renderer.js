(function () {
  const canvas = document.getElementById("vhk-solar-canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const stage = document.getElementById("vhk-stage");

  // Pre-generated static starfield (zero per-frame allocation)
  const STARS = Array.from({ length: 90 }, (_, i) => ({
    rx: ((i * 73) % 1000) / 1000,
    ry: ((i * 197) % 1000) / 1000,
    r: (i % 3 === 0 ? 1.3 : 0.85),
    a: 0.25 + ((i * 37) % 55) / 100,
  }));

  let width = 0;
  let height = 0;
  let dpr = 1;

  function resize() {
    const rect = stage.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function getBodyScreenPos(body, state) {
    const baseX = body.screenRatio.x * width;
    const baseY = body.screenRatio.y * height;

    // When zoomed close or inside interior, smoothly bring selected body closer to center-left inspection area
    const threshold = body.closeThreshold || 18;
    const closeFactor = state.isInsideInterior
      ? 1
      : Math.max(0, Math.min(1, (threshold - state.cameraDistance) / threshold));

    const focusX = width * 0.42;
    const focusY = height * 0.44;

    return {
      x: baseX + (focusX - baseX) * closeFactor,
      y: baseY + (focusY - baseY) * closeFactor,
      closeFactor,
    };
  }

  function drawInteriorCrossSection(cx, cy, r, body) {
    // Outer crust
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = body.color;
    ctx.fill();

    // Silicate mantle ring
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.74, 0, Math.PI * 2);
    ctx.fillStyle = "#b84a27";
    ctx.fill();

    // Outer core
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.46, 0, Math.PI * 2);
    ctx.fillStyle = "#ff8c24";
    ctx.fill();

    // Inner core
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe89e";
    ctx.fill();
  }

  function renderFrame(state) {
    if (!width || !height) resize();

    ctx.fillStyle = "#050814";
    ctx.fillRect(0, 0, width, height);

    // Stars
    for (let i = 0; i < STARS.length; i++) {
      const s = STARS[i];
      ctx.fillStyle = `rgba(220, 232, 255, ${s.a})`;
      ctx.fillRect(s.rx * width, s.ry * height, s.r, s.r);
    }

    const sunPos = { x: width * 0.22, y: height * 0.56 };

    // Faint orbital arcs from Sun
    const orbits = [0.34, 0.47, 0.62, 0.74];
    ctx.strokeStyle = "rgba(120, 175, 220, 0.16)";
    ctx.lineWidth = 1;
    for (let i = 0; i < orbits.length; i++) {
      const rx = Math.abs(width * orbits[i] - sunPos.x) * 1.15;
      const ry = rx * 0.55;
      ctx.beginPath();
      ctx.ellipse(sunPos.x, sunPos.y, Math.max(24, rx), Math.max(16, ry), -0.15, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Sun glow & disc
    ctx.beginPath();
    ctx.arc(sunPos.x, sunPos.y, 26, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 168, 52, 0.22)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sunPos.x, sunPos.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#ffae42";
    ctx.fill();

    ctx.fillStyle = "#e8eefc";
    ctx.font = "600 10px system-ui, sans-serif";
    ctx.fillText("SUN • G2V", sunPos.x - 22, sunPos.y + 28);
    ctx.fillText("YOU ARE HERE", width * 0.72, height * 0.58);

    const activeBody = window.VYUHAK_BODIES[state.selectedBodyId] || window.VYUHAK_BODIES.venus;
    const targetPos = getBodyScreenPos(activeBody, state);

    // Draw other bodies as lightweight dots
    const keys = Object.keys(window.VYUHAK_BODIES);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k === "sun" || k === activeBody.id) continue;
      const b = window.VYUHAK_BODIES[k];
      const p = getBodyScreenPos(b, state);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
    }

    // Selected body (scales up when zoomed close or inside interior)
    const baseRadius = activeBody.id === "sun" ? 16 : 7;
    const zoomedRadius = state.isInsideInterior
      ? 48
      : baseRadius + targetPos.closeFactor * 26;

    if (state.isInsideInterior || targetPos.closeFactor > 0.65) {
      drawInteriorCrossSection(targetPos.x, targetPos.y, zoomedRadius, activeBody);
    } else {
      ctx.beginPath();
      ctx.arc(targetPos.x, targetPos.y, zoomedRadius, 0, Math.PI * 2);
      ctx.fillStyle = activeBody.color;
      ctx.fill();
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 11px system-ui, sans-serif";
    ctx.fillText(activeBody.name.toUpperCase(), targetPos.x - 18, targetPos.y - zoomedRadius - 8);

    // Push pop-up update
    if (window.VYUHAK_POPUP_CTRL) {
      window.VYUHAK_POPUP_CTRL.update({
        visible: state.popupVisible,
        body: activeBody,
        cameraDistance: state.cameraDistance,
        isInsideInterior: state.isInsideInterior,
        anchor: { x: targetPos.x, y: targetPos.y },
        stageRect: { width, height },
      });
    }
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();

  window.VYUHAK_RENDERER = {
    render(state) {
      renderFrame(state);
    },
  };
})();
