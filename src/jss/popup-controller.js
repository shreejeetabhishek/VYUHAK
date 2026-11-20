(function () {
  const popup = document.getElementById("vhk-object-popup");
  const domainEl = document.getElementById("vhk-popup-domain");
  const typeEl = document.getElementById("vhk-popup-type");
  const nameEl = document.getElementById("vhk-popup-name");
  const summaryEl = document.getElementById("vhk-popup-summary");
  const deepEl = document.getElementById("vhk-popup-deep");
  const distEl = document.getElementById("vhk-m-dist");
  const velEl = document.getElementById("vhk-m-vel");
  const esiEl = document.getElementById("vhk-m-esi");
  const descEl = document.getElementById("vhk-popup-desc");
  const interiorBtn = document.getElementById("vhk-interior-toggle");

  let lastKey = "";
  let rafId = 0;
  let pending = null;

  function clampPosition(anchorX, anchorY, stageRect) {
    const pad = 10;
    const topSafe = 10;
    const bottomSafe = stageRect.height - 68; // stay clear of scale badge & zoom dock
    const width = popup.offsetWidth || Math.min(stageRect.width * 0.92, 356);
    const height = popup.offsetHeight || 165;

    const left = Math.min(
      Math.max(anchorX - width * 0.5, pad),
      Math.max(pad, stageRect.width - width - pad)
    );

    let top = anchorY + 26;
    if (top + height > bottomSafe) {
      top = anchorY - height - 26;
    }
    top = Math.min(Math.max(top, topSafe), Math.max(topSafe, bottomSafe - height));

    return { left: Math.round(left), top: Math.round(top) };
  }

  function applyPopup(payload) {
    rafId = 0;
    if (!payload || !payload.visible || !payload.body) {
      if (!popup.hidden) popup.hidden = true;
      return;
    }

    const { body, cameraDistance, isInsideInterior, anchor, stageRect } = payload;
    const threshold = body.closeThreshold || 18;
    const isZoomedClose = cameraDistance <= threshold;
    const showDeepDetails = isZoomedClose || Boolean(isInsideInterior);

    const key = `${body.id}|${showDeepDetails}|${Boolean(isInsideInterior)}|${Math.round(anchor.x)}|${Math.round(anchor.y)}`;
    if (key === lastKey && !popup.hidden) return;
    lastKey = key;

    popup.classList.toggle("is-interior", Boolean(isInsideInterior));
    interiorBtn.classList.toggle("is-active", Boolean(isInsideInterior));
    interiorBtn.textContent = isInsideInterior ? "\u2190 Exit Interior" : "Enter Interior \u2192";

    domainEl.textContent = isInsideInterior ? "INTERIOR" : "SOLAR";
    typeEl.textContent = body.type;
    nameEl.textContent = body.name;
    summaryEl.textContent = body.summary;

    deepEl.hidden = !showDeepDetails;
    if (showDeepDetails) {
      distEl.textContent = body.dist;
      velEl.textContent = body.vel;
      esiEl.textContent = body.esi;
      descEl.textContent = isInsideInterior ? body.interiorDesc : body.surfaceDesc;
    }

    popup.hidden = false;
    const pos = clampPosition(anchor.x, anchor.y, stageRect);
    popup.style.transform = `translate3d(${pos.left}px, ${pos.top}px, 0)`;
  }

  window.VYUHAK_POPUP_CTRL = {
    update(payload) {
      pending = payload;
      if (!rafId) {
        rafId = requestAnimationFrame(() => applyPopup(pending));
      }
    },
  };
})();
