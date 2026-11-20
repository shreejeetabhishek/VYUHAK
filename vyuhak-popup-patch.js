/**
 * VYUHAK Non-Destructive Pop-Up & Zoom/Interior Controller
 * Drop this file into your existing app and include <script src="vyuhak-popup-patch.js" defer></script>
 * It does NOT overwrite your 3D/2D canvas, markers, or existing HUD layout.
 */
(function () {
  const BODY_DETAILS = {
    sun: {
      dist: "0.00 AU",
      vel: "220 km/s",
      esi: "Star G2V",
      desc: "Radiative and convective plasma envelopes surrounding a ~1,392,700 km diameter star powered by core hydrogen fusion.",
      interior: "Core (~0-0.25 R_sun at ~15M K) fuses hydrogen into helium, feeding the radiative and convective layers.",
    },
    mercury: {
      dist: "0.39 AU",
      vel: "47.4 km/s",
      esi: "ESI 0.39",
      desc: "Oversized metallic core (~85% of planetary radius) beneath a thin silicate mantle and cratered crust.",
      interior: "Partially molten iron-sulfur outer core around a solid inner core beneath a shallow silicate mantle.",
    },
    venus: {
      dist: "0.72 AU",
      vel: "35.2 km/s",
      esi: "ESI 0.44",
      desc: "Iron-nickel core (~3,000 km radius), rocky silicate mantle, and a single-plate basaltic crust shaped by global volcanism.",
      interior: "Interior cross-section: iron-nickel core (~3,000 km radius), rocky mantle, and thick basaltic crust.",
    },
    earth: {
      dist: "1.00 AU",
      vel: "29.8 km/s",
      esi: "ESI 1.00",
      desc: "Solid inner core, liquid outer iron-nickel core driving the geodynamo, silicate mantle, and tectonic crust.",
      interior: "Solid inner core (~1,220 km), liquid outer core (~2,260 km), silicate mantle, and crust.",
    },
    mars: {
      dist: "1.52 AU",
      vel: "24.1 km/s",
      esi: "ESI 0.64",
      desc: "Iron-rich core enriched in lighter elements, silicate mantle, and ancient basaltic crust with shield volcanoes.",
      interior: "Liquid iron-alloy core (~1,830 km radius) beneath a silicate mantle and thick volcanic crust.",
    },
  };

  const state = {
    bodyKey: "venus",
    cameraDistance: 120,
    closeThreshold: 18,
    isInsideInterior: false,
    anchor: null, // optional { x, y } screen coords over the selected object
  };

  // Inject minimal scoped styles so we never break existing dark-mode layout or CSS
  const style = document.createElement("style");
  style.id = "vyuhak-popup-patch-style";
  style.textContent = `
    .vhk-floating-popup {
      position: fixed;
      z-index: 40;
      width: min(92vw, 360px);
      background: rgba(13, 18, 36, 0.9);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(154, 112, 255, 0.55);
      border-radius: 14px;
      padding: 12px 14px;
      color: #f3f6ff;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55);
      font-family: inherit;
    }
    .vhk-floating-popup[hidden] {
      display: none !important;
    }
    .vhk-popup-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .vhk-popup-title {
      font-size: 15px;
      font-weight: 700;
    }
    .vhk-popup-btn {
      background: rgba(125, 78, 242, 0.28);
      color: #efe8ff;
      border: 1px solid rgba(168, 128, 255, 0.6);
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }
    .vhk-popup-deep {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
    }
    .vhk-popup-deep[hidden] {
      display: none !important;
    }
    .vhk-popup-metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 8px;
      font-size: 11px;
    }
    .vhk-popup-metric {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 6px 8px;
    }
    .vhk-popup-metric span {
      display: block;
      font-size: 10px;
      opacity: 0.72;
    }
    .vhk-popup-desc {
      margin: 0;
      font-size: 12px;
      line-height: 1.42;
      color: #dce4ff;
    }
  `;
  document.head.appendChild(style);

  // Create lightweight pop-up container if not already present
  let popup = document.getElementById("vhk-object-popup");
  if (!popup) {
    popup = document.createElement("aside");
    popup.id = "vhk-object-popup";
    popup.className = "vhk-floating-popup";
    popup.hidden = true;
    popup.innerHTML = `
      <div class="vhk-popup-top">
        <div class="vhk-popup-title" data-vhk-title>Venus</div>
        <button type="button" class="vhk-popup-btn" data-vhk-interior-btn>Enter Interior &rarr;</button>
      </div>
      <div class="vhk-popup-deep" data-vhk-deep hidden>
        <div class="vhk-popup-metrics">
          <div class="vhk-popup-metric"><span>DIST</span><strong data-vhk-dist>0.72 AU</strong></div>
          <div class="vhk-popup-metric"><span>VEL</span><strong data-vhk-vel>35.2 km/s</strong></div>
          <div class="vhk-popup-metric"><span>ESI/INFO</span><strong data-vhk-esi>ESI 0.44</strong></div>
        </div>
        <p class="vhk-popup-desc" data-vhk-desc></p>
      </div>
    `;
    document.body.appendChild(popup);
  }

  // Hide old top-level blocking telemetry banner if present while keeping layout intact
  function hideBlockingTelemetryBanner() {
    const candidates = Array.from(document.querySelectorAll("div, section, aside, p"));
    for (const el of candidates) {
      if (el.closest("#vhk-object-popup")) continue;
      const text = (el.textContent || "").trim();
      const hasTelemetryTokens =
        text.includes("DIST") && text.includes("VEL") && text.includes("ESI/INFO");
      const hasCoreText = text.includes("Iron-nickel core (~3,000 km radius)");
      if ((hasTelemetryTokens || hasCoreText) && el.children.length <= 6 && text.length < 420) {
        el.style.display = "none";
      }
    }
  }

  function positionPopup() {
    if (popup.hidden) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = popup.offsetWidth || Math.min(vw * 0.92, 360);
    const ph = popup.offsetHeight || 130;
    const pad = 12;

    const ax = state.anchor && typeof state.anchor.x === "number" ? state.anchor.x : vw * 0.5;
    const ay = state.anchor && typeof state.anchor.y === "number" ? state.anchor.y : vh * 0.42;

    let left = Math.min(Math.max(ax - pw / 2, pad), Math.max(pad, vw - pw - pad));
    let top = ay + 24;
    if (top + ph > vh - 76) {
      top = ay - ph - 24;
    }
    top = Math.min(Math.max(top, 96), Math.max(96, vh - ph - 76));

    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;
  }

  function sync() {
    hideBlockingTelemetryBanner();

    const info = BODY_DETAILS[state.bodyKey] || BODY_DETAILS.venus;
    const isZoomedClose = state.cameraDistance <= state.closeThreshold;
    const showDeep = isZoomedClose || state.isInsideInterior;

    const titleEl = popup.querySelector("[data-vhk-title]");
    const deepEl = popup.querySelector("[data-vhk-deep]");
    const distEl = popup.querySelector("[data-vhk-dist]");
    const velEl = popup.querySelector("[data-vhk-vel]");
    const esiEl = popup.querySelector("[data-vhk-esi]");
    const descEl = popup.querySelector("[data-vhk-desc]");
    const btnEl = popup.querySelector("[data-vhk-interior-btn]");

    const labelBase = state.bodyKey.charAt(0).toUpperCase() + state.bodyKey.slice(1);
    titleEl.textContent = state.isInsideInterior ? `${labelBase} • Interior` : labelBase;
    btnEl.textContent = state.isInsideInterior ? "<- Exit Interior" : "Enter Interior ->";

    // Keep telemetry & interior description hidden unless zoomed in close or inside interior
    deepEl.hidden = !showDeep;
    if (showDeep) {
      distEl.textContent = info.dist;
      velEl.textContent = info.vel;
      esiEl.textContent = info.esi;
      descEl.textContent = state.isInsideInterior ? info.interior : info.desc;
    }

    popup.hidden = false;
    positionPopup();
  }

  popup.querySelector("[data-vhk-interior-btn]").addEventListener("click", () => {
    state.isInsideInterior = !state.isInsideInterior;
    if (state.isInsideInterior && state.cameraDistance > state.closeThreshold) {
      state.cameraDistance = Math.max(1, state.closeThreshold - 2);
    }
    sync();
  });

  // Listen for planet chip clicks in existing UI
  document.addEventListener("click", (e) => {
    const target = e.target.closest("button, [role='button']");
    if (!target || target.closest("#vhk-object-popup")) return;
    const txt = (target.textContent || "").trim().toLowerCase();
    if (BODY_DETAILS[txt]) {
      state.bodyKey = txt;
      state.isInsideInterior = false;
      sync();
    }
  });

  window.addEventListener("resize", positionPopup);

  // Public hook so your existing 3D/2D camera & object projection can update zoom/position directly
  window.VYUHAK_POPUP = {
    setState(next = {}) {
      if (typeof next.bodyKey === "string") state.bodyKey = next.bodyKey.toLowerCase();
      if (typeof next.cameraDistance === "number") state.cameraDistance = next.cameraDistance;
      if (typeof next.closeThreshold === "number") state.closeThreshold = next.closeThreshold;
      if (typeof next.isInsideInterior === "boolean") state.isInsideInterior = next.isInsideInterior;
      if (next.anchor && typeof next.anchor.x === "number" && typeof next.anchor.y === "number") {
        state.anchor = next.anchor;
      }
      sync();
    },
    show() {
      popup.hidden = false;
      positionPopup();
    },
    hide() {
      popup.hidden = true;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sync);
  } else {
    sync();
  }
})();
