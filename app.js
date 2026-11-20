const BODIES = {
  sun: {
    id: "sun",
    name: "Sun",
    type: "G2V Main-Sequence Star",
    radius: 10,
    compact: "Center of System • 1.00 AU ref",
    dist: "0.00 AU",
    vel: "220 km/s (Galactic)",
    esi: "N/A (Star)",
    description:
      "Radiative and convective plasma envelopes surrounding a ~1,392,700 km diameter star powered by core hydrogen fusion.",
    interiorDescription:
      "Core (~0–0.25 R☉ at ~15M K) fuses hydrogen into helium, feeding the radiative zone and convective outer shell.",
    screenPos: { x: 110, y: 260 },
  },
  mercury: {
    id: "mercury",
    name: "Mercury",
    type: "Terrestrial Planet",
    radius: 2.4,
    compact: "Sun: 0.39 AU • 57.9M km",
    dist: "0.39 AU",
    vel: "47.4 km/s",
    esi: "ESI 0.39",
    description:
      "Oversized metallic core (~85% of planetary radius) beneath a thin silicate mantle and heavily cratered crust.",
    interiorDescription:
      "Partially molten iron-sulfur outer core surrounding a solid inner core, wrapped by a shallow silicate mantle.",
    screenPos: { x: 165, y: 210 },
  },
  venus: {
    id: "venus",
    name: "Venus",
    type: "Terrestrial Planet",
    radius: 5.2,
    compact: "Sun: 0.72 AU • 53.9M km",
    dist: "0.72 AU",
    vel: "35.2 km/s",
    esi: "ESI 0.44",
    description:
      "Iron-nickel core (~3,000 km radius), rocky silicate mantle, and a single-plate basaltic crust shaped by global volcanism.",
    interiorDescription:
      "Interior cross-section: iron-nickel core (~3,000 km radius), convective rocky mantle, and thick volcanic basalt crust.",
    screenPos: { x: 225, y: 235 },
  },
  earth: {
    id: "earth",
    name: "Earth",
    type: "Terrestrial Planet",
    radius: 5.5,
    compact: "Sun: 1.00 AU • 149.6M km",
    dist: "1.00 AU",
    vel: "29.8 km/s",
    esi: "ESI 1.00",
    description:
      "Solid inner core, liquid outer iron-nickel core driving the geodynamo, silicate mantle, and fragmented tectonic crust.",
    interiorDescription:
      "Solid inner core (~1,220 km), liquid outer core (~2,260 km), viscous silicate mantle, and continental/oceanic crust.",
    screenPos: { x: 295, y: 255 },
  },
  mars: {
    id: "mars",
    name: "Mars",
    type: "Terrestrial Planet",
    radius: 3.2,
    compact: "Sun: 1.52 AU • 227.9M km",
    dist: "1.52 AU",
    vel: "24.1 km/s",
    esi: "ESI 0.64",
    description:
      "Iron-rich core enriched in lighter elements, silicate mantle, and ancient basaltic crust with towering shield volcanoes.",
    interiorDescription:
      "Liquid iron-alloy core (~1,830 km radius) beneath a silicate mantle and thick volcanic crust.",
    screenPos: { x: 345, y: 205 },
  },
};

const viewState = {
  selectedBodyId: "venus",
  cameraDistance: 120,
  baseCloseThreshold: 18,
  isInsideInterior: false,
  popupVisible: true,
};

const els = {
  stage: document.getElementById("stage"),
  targetBtn: document.getElementById("body-target"),
  targetLabel: document.getElementById("body-target-label"),
  popup: document.getElementById("object-popup"),
  popupDomain: document.getElementById("popup-domain"),
  popupType: document.getElementById("popup-type"),
  popupName: document.getElementById("popup-name"),
  popupCompact: document.getElementById("popup-compact-line"),
  deepSection: document.querySelector("[data-deep-details]"),
  interiorBtn: document.querySelector("[data-interior-toggle]"),
  tDist: document.getElementById("t-dist"),
  tVel: document.getElementById("t-vel"),
  tEsi: document.getElementById("t-esi"),
  popupDesc: document.getElementById("popup-description"),
  zoomSlider: document.getElementById("zoom-slider"),
  zoomReadout: document.getElementById("zoom-readout"),
  thresholdReadout: document.getElementById("threshold-readout"),
};

function getCloseThreshold(body) {
  if (!body || !body.radius) return viewState.baseCloseThreshold;
  return Math.max(body.radius * 3.5, 12);
}

function computeInspectionState(state, body) {
  const threshold = getCloseThreshold(body);
  const isZoomedClose = state.cameraDistance <= threshold;
  const showDeepDetails = isZoomedClose || state.isInsideInterior;
  return { threshold, isZoomedClose, showDeepDetails };
}

function positionPopupNearTarget(targetPos, stageRect) {
  const margin = 12;
  const topSafe = 12;
  const bottomSafe = stageRect.height - 76; // keep clear of zoom slider & bottom bar
  const popupWidth = els.popup.offsetWidth || Math.min(stageRect.width * 0.92, 370);
  const popupHeight = els.popup.offsetHeight || 150;

  const clampedX = Math.min(
    Math.max(targetPos.x - popupWidth / 2, margin),
    Math.max(margin, stageRect.width - popupWidth - margin)
  );

  let targetY = targetPos.y + 34;
  if (targetY + popupHeight > bottomSafe) {
    targetY = targetPos.y - popupHeight - 34;
  }
  targetY = Math.min(Math.max(targetY, topSafe), Math.max(topSafe, bottomSafe - popupHeight));

  els.popup.style.transform = `translate3d(${Math.round(clampedX)}px, ${Math.round(targetY)}px, 0)`;
}

function render() {
  const body = BODIES[viewState.selectedBodyId] || BODIES.venus;
  const { threshold, showDeepDetails } = computeInspectionState(viewState, body);
  const stageRect = els.stage.getBoundingClientRect();

  // Scale demo screen coordinates gently to stage dimensions
  const posX = Math.min(Math.max(body.screenPos.x * (stageRect.width / 420), 40), stageRect.width - 40);
  const posY = Math.min(Math.max(body.screenPos.y * (stageRect.height / 520), 48), stageRect.height - 120);

  els.targetBtn.style.transform = `translate3d(${Math.round(posX)}px, ${Math.round(posY)}px, 0) translate(-50%, -50%)`;
  els.targetLabel.textContent = body.name.toUpperCase();

  document.body.classList.toggle("mode-deep-inspect", showDeepDetails);
  document.body.classList.toggle("mode-interior", viewState.isInsideInterior);

  els.zoomReadout.textContent = String(viewState.cameraDistance);
  els.thresholdReadout.textContent = threshold.toFixed(1);

  els.popup.hidden = !viewState.popupVisible;
  if (!viewState.popupVisible) return;

  els.popupDomain.textContent = viewState.isInsideInterior ? "INTERIOR" : "SOLAR";
  els.popupType.textContent = body.type;
  els.popupName.textContent = body.name;
  els.popupCompact.textContent = body.compact;

  // Deep telemetry & geological/interior description stay hidden until zoomed in close or inside interior
  els.deepSection.hidden = !showDeepDetails;
  if (showDeepDetails) {
    els.tDist.textContent = body.dist;
    els.tVel.textContent = body.vel;
    els.tEsi.textContent = body.esi;
    els.popupDesc.textContent = viewState.isInsideInterior
      ? body.interiorDescription
      : body.description;
  }

  els.interiorBtn.textContent = viewState.isInsideInterior ? "← Exit Interior" : "Enter Interior →";

  // Measure after toggling hidden state so clamping uses accurate height
  positionPopupNearTarget({ x: posX, y: posY }, stageRect);
}

// Event bindings
els.zoomSlider.addEventListener("input", (e) => {
  viewState.cameraDistance = Number(e.target.value);
  render();
});

els.interiorBtn.addEventListener("click", () => {
  viewState.isInsideInterior = !viewState.isInsideInterior;
  if (viewState.isInsideInterior) {
    const threshold = Math.floor(getCloseThreshold(BODIES[viewState.selectedBodyId]));
    if (viewState.cameraDistance > threshold) {
      viewState.cameraDistance = Math.max(4, threshold - 2);
      els.zoomSlider.value = String(viewState.cameraDistance);
    }
  }
  render();
});

els.targetBtn.addEventListener("click", () => {
  viewState.popupVisible = !viewState.popupVisible;
  render();
});

document.querySelectorAll("[data-select-body]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-select-body]").forEach((el) => el.classList.remove("is-active"));
    btn.classList.add("is-active");
    viewState.selectedBodyId = btn.dataset.selectBody;
    viewState.isInsideInterior = false;
    viewState.popupVisible = true;
    render();
  });
});

window.addEventListener("resize", render);
render();
