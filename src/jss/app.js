(function () {
  const appState = {
    selectedBodyId: "venus",
    cameraDistance: 120,
    isInsideInterior: false,
    popupVisible: true,
  };

  const zoomSlider = document.getElementById("vhk-zoom-slider");
  const zoomStatus = document.getElementById("vhk-zoom-status");
  const distReadout = document.getElementById("vhk-dist-readout");
  const scaleValue = document.getElementById("vhk-scale-value");
  const interiorBtn = document.getElementById("vhk-interior-toggle");
  const bodyPills = Array.from(document.querySelectorAll(".vhk-body-pill"));
  const presetBtns = Array.from(document.querySelectorAll("[data-zoom-preset]"));

  function syncUI() {
    const body = window.VYUHAK_BODIES[appState.selectedBodyId] || window.VYUHAK_BODIES.venus;
    const threshold = body.closeThreshold || 18;
    const isClose = appState.cameraDistance <= threshold;

    zoomSlider.value = String(appState.cameraDistance);
    distReadout.textContent = `DIST ${appState.cameraDistance.toFixed(1)} (Close <= ${threshold})`;

    if (appState.isInsideInterior) {
      zoomStatus.textContent = `Inside ${body.name} Interior`;
      scaleValue.textContent = `${body.name} Core View`;
    } else if (isClose) {
      zoomStatus.textContent = `Close Zoom on ${body.name}`;
      scaleValue.textContent = "48,000 km scale";
    } else {
      zoomStatus.textContent = "System View (Zoomed Out)";
      scaleValue.textContent = "1.12 billion km";
    }

    if (window.VYUHAK_RENDERER) {
      window.VYUHAK_RENDERER.render(appState);
    }
  }

  zoomSlider.addEventListener("input", (e) => {
    appState.cameraDistance = Number(e.target.value);
    if (appState.cameraDistance > (window.VYUHAK_BODIES[appState.selectedBodyId]?.closeThreshold || 18)) {
      appState.isInsideInterior = false;
    }
    syncUI();
  });

  interiorBtn.addEventListener("click", () => {
    const body = window.VYUHAK_BODIES[appState.selectedBodyId] || window.VYUHAK_BODIES.venus;
    appState.isInsideInterior = !appState.isInsideInterior;
    appState.popupVisible = true;
    if (appState.isInsideInterior && appState.cameraDistance > body.closeThreshold) {
      appState.cameraDistance = Math.max(3, body.closeThreshold - 4);
    }
    syncUI();
  });

  bodyPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      bodyPills.forEach((p) => p.classList.remove("is-active"));
      pill.classList.add("is-active");
      appState.selectedBodyId = pill.dataset.body;
      appState.isInsideInterior = false;
      appState.popupVisible = true;
      syncUI();
    });
  });

  presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.zoomPreset;
      const body = window.VYUHAK_BODIES[appState.selectedBodyId] || window.VYUHAK_BODIES.venus;
      if (mode === "close") {
        appState.cameraDistance = Math.max(3, body.closeThreshold - 4);
      } else {
        appState.cameraDistance = 120;
        appState.isInsideInterior = false;
      }
      appState.popupVisible = true;
      syncUI();
    });
  });

  syncUI();
})();
