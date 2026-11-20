// ============================================================================
// VYUHAK v43 DEEP-ZOOM // ULTRA-DEEP ZOOM-OUT ACROSS ALL STAGES & CLEARER POCKET UNIVERSES
// ============================================================================

// --- 1. AUDIO ENGINE WITH MUTE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isMuted = false;

function toggleMute() {
    isMuted = !isMuted;
    document.getElementById('icon-sound-on').classList.toggle('hidden', isMuted);
    document.getElementById('icon-sound-off').classList.toggle('hidden', !isMuted);
    showToast(isMuted ? 'Audio Muted' : 'Audio Enabled');
}

function playSound(type) {
    if (isMuted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    if (type === 'click') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.07, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        osc.start(); osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'lock') {
        osc.type = 'square'; osc.frequency.setValueAtTime(440, audioCtx.currentTime); osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0.035, audioCtx.currentTime + 0.04); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.22);
        osc.start(); osc.stop(audioCtx.currentTime + 0.22);
    } else if (type === 'warp-out') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(150, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(480, audioCtx.currentTime + 0.78);
        gain.gain.setValueAtTime(0, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0.042, audioCtx.currentTime + 0.16); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.90);
        osc.start(); osc.stop(audioCtx.currentTime + 0.90);
    } else if (type === 'warp-in') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(480, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(140, audioCtx.currentTime + 0.78);
        gain.gain.setValueAtTime(0, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0.042, audioCtx.currentTime + 0.16); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.90);
        osc.start(); osc.stop(audioCtx.currentTime + 0.90);
    }
    osc.connect(gain); gain.connect(audioCtx.destination);
}

let toastTimer = null;
function showToast(message) {
    const container = document.getElementById('toast-container');
    container.innerHTML = '';
    if (toastTimer) clearTimeout(toastTimer);
    const el = document.createElement('div');
    el.className = 'toast-msg';
    el.textContent = message;
    container.appendChild(el);
    toastTimer = setTimeout(() => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.25s';
        setTimeout(() => { if (el.parentNode) el.remove(); }, 250);
    }, 2000);
}

// --- 2. CLIENT-SIDE API CACHE ---
const apiCache = new Map();
async function cachedFetchJSON(url, ttlMs = 300000) {
    const now = Date.now();
    const hit = apiCache.get(url);
    if (hit && (now - hit.time < ttlMs)) return hit.data;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    apiCache.set(url, { time: now, data });
    if (apiCache.size > 90) apiCache.delete(apiCache.keys().next().value);
    return data;
}

// --- 3. MATHEMATICAL ASTRODYNAMICS & KEPLERIAN EPHEMERIS ENGINE ---
const MU_EARTH = 398600.4418; // Earth gravitational parameter (km^3/s^2)
const R_EARTH_KM = 6371.0;    // Mean Earth radius (km)
const AU_KM = 149597870.7;    // 1 Astronomical Unit in km
const C_KM_MIN = 17987547.48; // Speed of light in km/min

// Exact Circular Orbital Velocity v = sqrt(GM / (R + h))
function calcOrbitalVelocityKps(altKm) {
    return Math.sqrt(MU_EARTH / (R_EARTH_KM + parseFloat(altKm)));
}

function latLonToWorldPosition(latDeg, lonDeg, radius, earthRotationY) {
    const latRad = latDeg * Math.PI / 180;
    const lonRad = (lonDeg * Math.PI / 180) + earthRotationY;
    return new THREE.Vector3(
        radius * Math.cos(latRad) * Math.cos(lonRad),
        radius * Math.sin(latRad),
        -radius * Math.cos(latRad) * Math.sin(lonRad)
    );
}

function worldPositionToLatLon(pos, earthRotationY) {
    const r = pos.length();
    if (r === 0) return { lat: 0, lon: 0 };
    const latRad = Math.asin(Math.max(-1, Math.min(1, pos.y / r)));
    const worldLonRad = Math.atan2(-pos.z, pos.x);
    let lonDeg = ((worldLonRad - earthRotationY) * 180 / Math.PI) % 360;
    if (lonDeg < -180) lonDeg += 360;
    if (lonDeg > 180) lonDeg -= 360;
    return { lat: latRad * 180 / Math.PI, lon: lonDeg };
}

function latLonToLocalEarthPosition(latDeg, lonDeg, radius) {
    return latLonToWorldPosition(latDeg, lonDeg, radius, 0);
}

// Julian centuries since J2000.0 (Jan 1, 2000 12:00 TT)
function getDaysSinceJ2000() {
    return (Date.now() - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000;
}

// Solve Kepler's Equation M = E - e*sin(E) via high-precision Newton-Raphson (supports e up to 0.99+)
function solveKepler(M, e) {
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 18; i++) {
        const f = E - e * Math.sin(E) - M;
        const fp = 1 - e * Math.cos(E);
        const delta = f / fp;
        E -= delta;
        if (Math.abs(delta) < 1e-11) break;
    }
    return E;
}

// Piecewise-linear radial scale mapping real AU -> compressed Solar System visual units
const AU_VIS_ANCHORS = [
    [0.000, 0.0], [0.387, 5.5], [0.723, 8.2], [1.000, 11.5], [1.524, 15.2],
    [5.203, 23.0], [9.555, 31.5], [19.218, 39.5], [30.110, 47.0], [40.000, 53.5], [70.000, 66.0]
];
function auToVisualDist(rAU) {
    if (rAU <= 0) return 0;
    for (let i = 1; i < AU_VIS_ANCHORS.length; i++) {
        const [a0, v0] = AU_VIS_ANCHORS[i - 1];
        const [a1, v1] = AU_VIS_ANCHORS[i];
        if (rAU <= a1) {
            return v0 + ((rAU - a0) / (a1 - a0)) * (v1 - v0);
        }
    }
    const [aLast, vLast] = AU_VIS_ANCHORS[AU_VIS_ANCHORS.length - 1];
    return vLast + (rAU - aLast) * 0.25;
}

// NASA JPL Horizons J2000.0 Orbital Elements for Comet 1P/Halley
const HALLEY_ELEMENTS = {
    a: 17.834144,          // Semi-major axis (AU)
    e: 0.9671429,          // Eccentricity (q = 0.586 AU, Q = 35.08 AU)
    I: 162.26269,          // Inclination (deg, retrograde!)
    Omega: 58.42008,       // Longitude of ascending node (deg)
    omega: 111.33249,      // Argument of perihelion (deg)
    tpDaysJ2000: -5077.6047, // 1986-02-09 09:29 UTC in days since J2000.0
    periodDays: 27510.0    // 75.32 Julian years (next perihelion: July 28, 2061)
};

function computeHalleyAtEccentricAnomaly(E) {
    const { a, e } = HALLEY_ELEMENTS;
    const I = HALLEY_ELEMENTS.I * Math.PI / 180;
    const Omega = HALLEY_ELEMENTS.Omega * Math.PI / 180;
    const omega = HALLEY_ELEMENTS.omega * Math.PI / 180;

    const sqrt1me2 = Math.sqrt(1 - e * e);
    const xP = a * (Math.cos(E) - e);
    const yP = a * sqrt1me2 * Math.sin(E);

    // Orbital plane velocity direction (d/dE proportional to true velocity vector)
    const vxP = -Math.sin(E);
    const vyP = sqrt1me2 * Math.cos(E);

    const cosO = Math.cos(Omega), sinO = Math.sin(Omega);
    const cosW = Math.cos(omega), sinW = Math.sin(omega);
    const cosI = Math.cos(I), sinI = Math.sin(I);

    const Px = cosO * cosW - sinO * sinW * cosI;
    const Py = sinO * cosW + cosO * sinW * cosI;
    const Pz = sinW * sinI;
    const Qx = -cosO * sinW - sinO * cosW * cosI;
    const Qy = -sinO * sinW + cosO * cosW * cosI;
    const Qz = cosW * sinI;

    const xEcl = Px * xP + Qx * yP;
    const yEcl = Py * xP + Qy * yP;
    const zEcl = Pz * xP + Qz * yP;

    const vxEcl = Px * vxP + Qx * vyP;
    const vyEcl = Py * vxP + Qy * vyP;
    const vzEcl = Pz * vxP + Qz * vyP;

    const vecAU = new THREE.Vector3(xEcl, zEcl, -yEcl);
    const rAU = vecAU.length();
    const visPos = vecAU.clone().normalize().multiplyScalar(auToVisualDist(rAU));
    const velDir = new THREE.Vector3(vxEcl, vzEcl, -vyEcl).normalize();
    const vKps = 29.7847 * Math.sqrt(Math.max(0.0001, 2 / rAU - 1 / a));

    return { vec: vecAU, visPos, velDir, rAU, vKps };
}

function computeHalleyState(daysSinceJ2000) {
    const { tpDaysJ2000, periodDays, e } = HALLEY_ELEMENTS;
    let phase = ((daysSinceJ2000 - tpDaysJ2000) / periodDays) % 1;
    if (phase < 0) phase += 1;
    let M = phase * Math.PI * 2;
    if (M > Math.PI) M -= Math.PI * 2;
    const E = solveKepler(M, e);
    return computeHalleyAtEccentricAnomaly(E);
}

// Compute True Heliocentric Ecliptic Position (in AU) from NASA JPL J2000 Elements
function computePlanetHeliocentricAU(p, days) {
    const T = days / 36525.0; // Julian centuries
    const a = p.a;
    const e = p.e;
    const I = p.I * Math.PI / 180;
    const L = ((p.L0 + p.LRate * T) % 360) * Math.PI / 180;
    const wBar = (p.wBar * Math.PI) / 180;
    const Omega = (p.Omega * Math.PI) / 180;
    const omega = wBar - Omega;

    let M = L - wBar;
    M = ((M + Math.PI) % (2 * Math.PI)) - Math.PI;
    const E = solveKepler(M, e);

    // Coordinates in orbital plane
    const xPrime = a * (Math.cos(E) - e);
    const yPrime = a * Math.sqrt(1 - e * e) * Math.sin(E);

    // Transform to 3D Heliocentric Ecliptic (X, Z ecliptic plane, Y north)
    const cosO = Math.cos(Omega), sinO = Math.sin(Omega);
    const cosW = Math.cos(omega), sinW = Math.sin(omega);
    const cosI = Math.cos(I), sinI = Math.sin(I);

    const xEcl = (cosO * cosW - sinO * sinW * cosI) * xPrime + (-cosO * sinW - sinO * cosW * cosI) * yPrime;
    const yEcl = (sinO * cosW + cosO * sinW * cosI) * xPrime + (-sinO * sinW + cosO * cosW * cosI) * yPrime;
    const zEcl = (sinW * sinI) * xPrime + (cosW * sinI) * yPrime;

    // Map Ecliptic -> Three.js (x = xEcl, y = zEcl, z = -yEcl)
    const rAU = Math.sqrt(xEcl * xEcl + yEcl * yEcl + zEcl * zEcl);
    // Vis-viva orbital velocity in km/s: v = sqrt(mu_sun * (2/r - 1/a))
    const vKps = 29.7847 * Math.sqrt(2 / rAU - 1 / a);
    return { vec: new THREE.Vector3(xEcl, zEcl, -yEcl), rAU, vKps };
}

function getRealTimeSunDirection(earthRotationY) {
    const now = new Date();
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
    const dayOfYear = Math.floor((now - startOfYear) / 86400000);
    const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const sunLon = (12 - utcHours) * 15;
    return latLonToWorldPosition(declination, sunLon, 1.0, earthRotationY).normalize();
}

// --- 4. STATE VARIABLES ---
let isDockExpanded = false;
let currentTab = 'intel';
let isGeoLocked = false;
let isISSMode = false;
let isSolarSystemView = false;
let isGalaxyView = false;
let isUniverseView = false;
let isMultiverseView = false;
let focusedUniverseRegion = 'Cosmic Web';
let lastAutoScaleSwitch = 0;
let showMilkyWaySky = true;
let showConstellations = true;
let showLabels = true;
let constellationLinesMesh = null;
const constellationLabelAnchors = [];
const galLandmarkAnchors = [];
const uniLandmarkAnchors = [];
let focusedGalaxyRegion = 'Milky Way';
let focusedCosmosBody = 'Sun';
let cosmosWarpIdx = 0;
const cosmosWarpModes = [
    { label: '1x Live', daysPerSec: 1 / 86400 },
    { label: '1 Day/s', daysPerSec: 1.0 },
    { label: '15 Days/s', daysPerSec: 15.0 },
    { label: '60 Days/s', daysPerSec: 60.0 },
    { label: '1 Yr/s', daysPerSec: 365.25 },
    { label: '5 Yrs/s', daysPerSec: 1826.25 }
];
let simDaysOffset = 0;

function cycleCosmosWarp() {
    playSound('click');
    cosmosWarpIdx = (cosmosWarpIdx + 1) % cosmosWarpModes.length;
    if (cosmosWarpIdx === 0) simDaysOffset = 0;
    document.getElementById('btn-cosmos-warp').textContent = cosmosWarpModes[cosmosWarpIdx].label;
    showToast('Cosmos Time: ' + cosmosWarpModes[cosmosWarpIdx].label);
}

// Crisp Circular Soft-Glow Sprite Texture (Eliminates square WebGL points!)
function createCircleSpriteTexture(innerColor, outerColor) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0.0, innerColor);
    grad.addColorStop(0.28, innerColor);
    grad.addColorStop(0.65, outerColor);
    grad.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}
let isRainRadarOn = false;
let is2DCloudsOn = false;
let showClouds = true;
let showLaserCone = true;
let showMeteors = true;
let orbitDirection = 1;

let lockedLat = 20.84;
let lockedLon = 85.10;

function calcOrbitRadius(km) {
    return 1.24 + (parseFloat(km) / 6371) * 0.88;
}

let orbitTime = -1.35;
let currentAltitudeKm = 1200;
let orbitRadius = calcOrbitRadius(currentAltitudeKm);
let orbitEccentricity = 0.0;
let baseOrbitSpeed = 0.035;
let orbitSpeed = baseOrbitSpeed;
let orbitInclination = 45;
let swathRadius = 0.22;
let vkScale = 0.45;
let issScale = 0.55;

let activeEngine = '3D';
const camModes = ['FREE', 'CHASE', 'NADIR'];
let camModeIdx = 0;
let activeCamera = 'FREE';
let lastScannedTime = 0;

// Smooth Camera Fly-To & Continuous Scale Warp Controller
let flyAnim = null;
let scaleAnim = null;

function smoothFlyTo(targetPos, lookAtPos, durationMs = 900) {
    flyAnim = {
        startPos: camera.position.clone(),
        endPos: targetPos.clone(),
        startTarget: controls.target.clone(),
        endTarget: lookAtPos.clone(),
        startTime: performance.now(),
        duration: durationMs
    };
}

function getCurrentScale() {
    if (isMultiverseView) return 'MULTIVERSE';
    if (isUniverseView) return 'UNIVERSE';
    if (isGalaxyView) return 'GALAXY';
    if (isSolarSystemView) return 'COSMOS';
    return 'EARTH';
}

function getEarthIndiaCameraPos(customDist = null) {
    // Center camera squarely over India (21.5° N, 79.0° E) at any time of day or Earth rotation
    const indiaDir = latLonToWorldPosition(21.5, 79.0, 1.0, earthMesh.rotation.y).normalize();
    const dist = customDist !== null ? customDist : (window.innerWidth < window.innerHeight ? 4.2 : 2.9);
    return indiaDir.multiplyScalar(dist);
}

function resetAllGroupScales() {
    earthSystemGroup.scale.setScalar(1);
    heliocentricGroup.scale.setScalar(1);
    galaxyGroup.scale.setScalar(1);
    universeGroup.scale.setScalar(1);
    camera.fov = 45;
    camera.updateProjectionMatrix();
    const veil = document.getElementById('scale-warp-veil');
    if (veil) veil.classList.remove('active');
}

function applyScaleDOMAndVisibility(targetScale) {
    const earthBtn = document.getElementById('btn-earth-view');
    const earthDot = document.getElementById('earth-dot');
    const solarBtn = document.getElementById('btn-solar-view');
    const solarDot = document.getElementById('solar-dot');
    const cosmosBar = document.getElementById('cosmos-bar');
    const galBtn = document.getElementById('btn-galaxy-view');
    const galDot = document.getElementById('galaxy-dot');
    const galBar = document.getElementById('galaxy-bar');
    const uniBtn = document.getElementById('btn-universe-view');
    const uniDot = document.getElementById('universe-dot');
    const uniBar = document.getElementById('universe-bar');
    const multiBtn = document.getElementById('btn-multiverse-view');
    const multiDot = document.getElementById('multiverse-dot');
    const multiBar = document.getElementById('multiverse-bar');

    const isEarth = (targetScale === 'EARTH');
    isSolarSystemView = (targetScale === 'COSMOS');
    isGalaxyView = (targetScale === 'GALAXY');
    isUniverseView = (targetScale === 'UNIVERSE');
    isMultiverseView = (targetScale === 'MULTIVERSE');

    earthBtn.classList.toggle('on', isEarth);
    earthDot.classList.toggle('bg-sky-400', isEarth);
    earthDot.classList.toggle('bg-slate-500', !isEarth);

    solarBtn.classList.toggle('on-purple', isSolarSystemView);
    solarDot.classList.toggle('bg-purple-400', isSolarSystemView);
    solarDot.classList.toggle('bg-slate-500', !isSolarSystemView);
    cosmosBar.classList.toggle('hidden', !isSolarSystemView);

    galBtn.classList.toggle('on-indigo', isGalaxyView);
    galDot.classList.toggle('bg-indigo-400', isGalaxyView);
    galDot.classList.toggle('bg-slate-500', !isGalaxyView);
    galBar.classList.toggle('hidden', !isGalaxyView);

    uniBtn.classList.toggle('on-gold', isUniverseView);
    uniDot.classList.toggle('bg-amber-400', isUniverseView);
    uniDot.classList.toggle('bg-slate-500', !isUniverseView);
    uniBar.classList.toggle('hidden', !isUniverseView);

    multiBtn.classList.toggle('on-rose', isMultiverseView);
    multiDot.classList.toggle('bg-rose-400', isMultiverseView);
    multiDot.classList.toggle('bg-slate-500', !isMultiverseView);
    multiBar.classList.toggle('hidden', !isMultiverseView);

    earthSystemGroup.visible = isEarth;
    heliocentricGroup.visible = isSolarSystemView;
    galaxyGroup.visible = isGalaxyView;
    universeGroup.visible = (isUniverseView || isMultiverseView);
    if (milkyWaySkyMesh) milkyWaySkyMesh.visible = (isEarth || isSolarSystemView) && showMilkyWaySky;
    if (constellationLinesMesh) constellationLinesMesh.visible = (isEarth || isSolarSystemView) && showConstellations;

    document.getElementById('earth-dossier').classList.toggle('hidden', !isEarth);
    document.getElementById('cosmos-dossier').classList.toggle('hidden', !isSolarSystemView);
    document.getElementById('galaxy-dossier').classList.toggle('hidden', !isGalaxyView);
    document.getElementById('universe-dossier').classList.toggle('hidden', !(isUniverseView || isMultiverseView));

    const dossierTab = document.getElementById('tab-btn-dossier');
    if (isEarth) {
        dossierTab.textContent = 'Ground Data';
        controls.minDistance = 1.15;
        controls.maxDistance = 48;
    } else if (isSolarSystemView) {
        dossierTab.textContent = 'Solar Data';
        activeCamera = 'FREE'; camModeIdx = 0;
        document.getElementById('cam-label').textContent = 'Free';
        controls.minDistance = 1.1;
        controls.maxDistance = 320;
        fetchLiveSpaceWeather();
    } else if (isGalaxyView) {
        dossierTab.textContent = 'Galaxy Data';
        activeCamera = 'FREE'; camModeIdx = 0;
        document.getElementById('cam-label').textContent = 'Free';
        controls.minDistance = 1.8;
        controls.maxDistance = 320;
    } else if (isUniverseView) {
        dossierTab.textContent = 'Universe Data';
        activeCamera = 'FREE'; camModeIdx = 0;
        document.getElementById('cam-label').textContent = 'Free';
        controls.minDistance = 2.2;
        controls.maxDistance = 185;
    } else if (isMultiverseView) {
        dossierTab.textContent = 'Multiverse Data';
        activeCamera = 'FREE'; camModeIdx = 0;
        document.getElementById('cam-label').textContent = 'Free';
        controls.minDistance = 54;
        controls.maxDistance = 950;
    }
}

// Continuous Sequential "Powers of Ten" Scale Journey (EARTH <-> COSMOS <-> GALAXY <-> UNIVERSE)
// Visibly traverses EVERY intermediate scale in sequence (e.g., Earth -> Cosmos -> Galaxy -> Universe)
const SCALE_ORDER = ['EARTH', 'COSMOS', 'GALAXY', 'UNIVERSE', 'MULTIVERSE'];

function selectScale(targetScale) {
    if (activeEngine !== '3D') switchEngine('3D');
    const labels = {
        EARTH: 'Earth Orbital View',
        COSMOS: 'Solar System (Live Keplerian UTC)',
        GALAXY: 'Milky Way Barred Spiral Galaxy (105,700 ly)',
        UNIVERSE: 'Observable Universe & Cosmic Web (93B ly)',
        MULTIVERSE: 'Hypothetical Multiverse Bubbles (> 100B ly)'
    };
    transitionToScale(targetScale, { toastMsg: labels[targetScale] });
}

function getScaleGroup(scaleName) {
    if (scaleName === 'EARTH') return earthSystemGroup;
    if (scaleName === 'COSMOS') return heliocentricGroup;
    if (scaleName === 'GALAXY') return galaxyGroup;
    return universeGroup;
}

function syncScaleHeaderUI(scaleName) {
    if (scaleName === 'COSMOS') {
        focusedCosmosBody = 'Sun';
        document.querySelectorAll('.planet-chip').forEach(ch => ch.classList.toggle('active', ch.dataset.body === 'Sun'));
        const sunEntry = cosmosBodiesMap.get('Sun');
        if (sunEntry) {
            document.getElementById('pt-name').textContent = sunEntry.name;
            document.getElementById('pt-type').textContent = sunEntry.type;
            document.getElementById('pt-stats').innerHTML = sunEntry.statsHTML;
            updateCosmosDossier('Sun', getDaysSinceJ2000() + simDaysOffset);
        }
    } else if (scaleName === 'GALAXY') {
        focusedGalaxyRegion = 'Milky Way';
        const mw = GALAXY_REGIONS['Milky Way'];
        document.querySelectorAll('#galaxy-chips .planet-chip').forEach(ch => ch.classList.toggle('active', ch.dataset.region === 'Milky Way'));
        document.getElementById('gt-name').textContent = 'Milky Way';
        document.getElementById('gt-type').textContent = mw.type;
        document.getElementById('gt-stats').innerHTML = mw.stats;
        document.getElementById('gd-title').textContent = mw.title;
        document.getElementById('gd-subtitle').innerHTML = mw.subtitle;
    } else if (scaleName === 'UNIVERSE') {
        focusedUniverseRegion = 'Cosmic Web';
        const u = UNIVERSE_REGIONS['Cosmic Web'];
        document.querySelectorAll('#universe-chips .planet-chip').forEach(ch => ch.classList.toggle('active', ch.dataset.region === 'Cosmic Web'));
        document.getElementById('ut-name').textContent = 'Cosmic Web';
        document.getElementById('ut-type').textContent = u.type;
        document.getElementById('ut-stats').innerHTML = u.stats;
        document.getElementById('ud-title').textContent = u.title;
        document.getElementById('ud-subtitle').innerHTML = u.subtitle;
        updateUniverseBio('Cosmic Web');
    } else if (scaleName === 'MULTIVERSE') {
        focusedUniverseRegion = 'Multiverse';
        const m = UNIVERSE_REGIONS['Multiverse'];
        document.getElementById('ud-title').textContent = m.title;
        document.getElementById('ud-subtitle').innerHTML = m.subtitle;
        updateUniverseBio('Multiverse');
    }
}

function computeStageTrajectory(stage, zoomingOut, options) {
    const scale = stage.scale;
    const kind = stage.kind; // 'DEPART' | 'TRANSIT' | 'ARRIVE'

    // Helper world positions of home anchors
    const getCosmosEarthPos = () => {
        const p = new THREE.Vector3(11.5, 0, 0);
        if (cosmosBodiesMap.has('Earth')) cosmosBodiesMap.get('Earth').obj.getWorldPosition(p);
        return p;
    };
    const getGalaxySunPos = () => {
        const p = new THREE.Vector3(13.335, 0, 0);
        if (solarSystemPinObj) solarSystemPinObj.getWorldPosition(p);
        return p;
    };

    if (kind === 'DEPART') {
        const startPos = camera.position.clone();
        const startTarget = controls.target.clone();
        let endPos = startPos.clone();
        let endTarget = startTarget.clone();

        if (zoomingOut) {
            const radial = camera.position.clone().sub(controls.target);
            if (radial.lengthSq() < 0.001) radial.set(0, 1, 2);
            radial.normalize();
            const pullDist = scale === 'EARTH' ? 16.5 : (scale === 'UNIVERSE' ? 88.0 : 112.0);
            endPos = controls.target.clone().add(radial.multiplyScalar(pullDist));
            endTarget = new THREE.Vector3(0, 0, 0);
        } else {
            if (scale === 'MULTIVERSE') {
                const dir = camera.position.clone().normalize();
                endTarget = new THREE.Vector3(0, 0, 0);
                endPos = dir.multiplyScalar(92.0);
            } else if (scale === 'UNIVERSE') {
                const dir = camera.position.clone().normalize();
                endTarget = new THREE.Vector3(0, 0, 0);
                endPos = dir.multiplyScalar(1.8);
            } else if (scale === 'GALAXY') {
                const pin = getGalaxySunPos();
                const dir = camera.position.clone().sub(pin).normalize();
                endTarget = pin.clone();
                endPos = pin.clone().add(dir.multiplyScalar(1.15));
            } else if (scale === 'COSMOS') {
                const ep = getCosmosEarthPos();
                const dir = camera.position.clone().sub(ep).normalize();
                endTarget = ep.clone();
                endPos = ep.clone().add(dir.multiplyScalar(1.05));
            }
        }
        return { startPos, startTarget, endPos, endTarget };
    }

    if (kind === 'TRANSIT') {
        // Full visible zoom-through of an intermediate scale (COSMOS or GALAXY)
        if (scale === 'COSMOS') {
            const ep = getCosmosEarthPos();
            const closePos = ep.clone().add(new THREE.Vector3(1.3, 0.95, 1.65));
            const farPos = new THREE.Vector3(76, 52, 92);
            return zoomingOut
                ? { startPos: closePos, startTarget: ep.clone(), endPos: farPos, endTarget: new THREE.Vector3(0, 0, 0) }
                : { startPos: farPos, startTarget: new THREE.Vector3(0, 0, 0), endPos: closePos, endTarget: ep.clone() };
        }
        if (scale === 'GALAXY') {
            const pin = getGalaxySunPos();
            const closePos = pin.clone().add(new THREE.Vector3(1.7, 1.4, 2.1));
            const farPos = new THREE.Vector3(0, 74, 94);
            return zoomingOut
                ? { startPos: closePos, startTarget: pin.clone(), endPos: farPos, endTarget: new THREE.Vector3(0, 0, 0) }
                : { startPos: farPos, startTarget: new THREE.Vector3(0, 0, 0), endPos: closePos, endTarget: pin.clone() };
        }
        if (scale === 'UNIVERSE') {
            const closePos = new THREE.Vector3(0, 2.6, 4.2);
            const farPos = new THREE.Vector3(0, 56, 86);
            return zoomingOut
                ? { startPos: closePos, startTarget: new THREE.Vector3(0, 0, 0), endPos: farPos, endTarget: new THREE.Vector3(0, 0, 0) }
                : { startPos: farPos, startTarget: new THREE.Vector3(0, 0, 0), endPos: closePos, endTarget: new THREE.Vector3(0, 0, 0) };
        }
    }

    // kind === 'ARRIVE'
    if (scale === 'COSMOS') {
        const ep = getCosmosEarthPos();
        const sunOverviewPos = new THREE.Vector3(26.6, 17.1, 32.3);
        const startTarget = zoomingOut ? ep.clone() : new THREE.Vector3(0, 0, 0);
        const startPos = zoomingOut ? ep.clone().add(new THREE.Vector3(1.3, 0.95, 1.65)) : new THREE.Vector3(78, 54, 96);
        return { startPos, startTarget, endPos: sunOverviewPos, endTarget: new THREE.Vector3(0, 0, 0) };
    }
    if (scale === 'GALAXY') {
        const pin = getGalaxySunPos();
        const mw = GALAXY_REGIONS['Milky Way'];
        const startTarget = zoomingOut ? pin.clone() : new THREE.Vector3(0, 0, 0);
        const startPos = zoomingOut ? pin.clone().add(new THREE.Vector3(1.7, 1.4, 2.1)) : new THREE.Vector3(0, 78, 98);
        return { startPos, startTarget, endPos: mw.camPos.clone(), endTarget: mw.lookAt.clone() };
    }
    if (scale === 'UNIVERSE') {
        const u = UNIVERSE_REGIONS['Cosmic Web'];
        const startPos = zoomingOut ? new THREE.Vector3(0, 2.4, 3.8) : new THREE.Vector3(0, 62, 92);
        return {
            startPos,
            startTarget: new THREE.Vector3(0, 0, 0),
            endPos: u.camPos.clone(),
            endTarget: u.lookAt.clone()
        };
    }
    if (scale === 'MULTIVERSE') {
        const m = UNIVERSE_REGIONS['Multiverse'];
        return {
            startPos: new THREE.Vector3(0, 62, 96),
            startTarget: new THREE.Vector3(0, 0, 0),
            endPos: m.camPos.clone(),
            endTarget: m.lookAt.clone()
        };
    }
    // EARTH arrival (zooming in from Cosmos)
    const finalPos = options.earthTargetCamPos ? options.earthTargetCamPos.clone() : getEarthIndiaCameraPos();
    const farDir = finalPos.clone().normalize();
    return {
        startPos: farDir.multiplyScalar(15.8),
        startTarget: new THREE.Vector3(0, 0, 0),
        endPos: finalPos,
        endTarget: new THREE.Vector3(0, 0, 0)
    };
}

function transitionToScale(targetScale, options = {}) {
    const fromScale = getCurrentScale();
    if (fromScale === targetScale && !scaleAnim) {
        if (options.onArrived) options.onArrived();
        return;
    }

    flyAnim = null;
    if (scaleAnim) {
        scaleAnim = null;
        resetAllGroupScales();
    }

    const fromIdx = SCALE_ORDER.indexOf(fromScale);
    const toIdx = SCALE_ORDER.indexOf(targetScale);
    const zoomingOut = toIdx > fromIdx;
    const step = zoomingOut ? 1 : -1;
    const isAuto = !!options.isAutoScroll;

    // Build sequential path visiting EVERY intermediate scale
    const path = [];
    for (let i = fromIdx; ; i += step) {
        path.push(SCALE_ORDER[i]);
        if (i === toIdx) break;
    }

    const stages = path.map((scaleName, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === path.length - 1;
        const kind = isFirst ? 'DEPART' : (isLast ? 'ARRIVE' : 'TRANSIT');
        let duration;
        if (isAuto) {
            duration = kind === 'DEPART' ? 620 : 980;
        } else {
            // Slower, majestic pacing so every in/out sequence is clearly visible
            if (kind === 'DEPART') duration = 1350;
            else if (kind === 'TRANSIT') duration = 1750;
            else duration = 1850;
        }
        return { scale: scaleName, kind, duration, group: getScaleGroup(scaleName) };
    });

    playSound(zoomingOut ? 'warp-out' : 'warp-in');

    const firstTraj = computeStageTrajectory(stages[0], zoomingOut, options);
    scaleAnim = {
        stages,
        stageIdx: 0,
        zoomingOut,
        options,
        startTime: performance.now(),
        traj: firstTraj,
        onArrived: options.onArrived || null,
        toastMsg: options.toastMsg || null
    };
}

let issInterval = null;
let issTargetLat = 20.0, issTargetLon = 78.0, issCurrentLat = 20.0, issCurrentLon = 78.0;
let issAltKm = 420, issVelKps = 7.66;

const SOVEREIGN_DB = {
    "IN": { name: "India", pop: 1428627663, cap: "New Delhi", cur: "Indian Rupee (₹)", area: 3287263, tz: "UTC+05:30" },
    "US": { name: "United States", pop: 339996563, cap: "Washington, D.C.", cur: "US Dollar ($)", area: 9372610, tz: "UTC-05:00" },
    "CN": { name: "China", pop: 1411750000, cap: "Beijing", cur: "Chinese Yuan (¥)", area: 9596961, tz: "UTC+08:00" },
    "BR": { name: "Brazil", pop: 216422446, cap: "Brasília", cur: "Brazilian Real (R$)", area: 8515767, tz: "UTC-03:00" },
    "RU": { name: "Russia", pop: 144444359, cap: "Moscow", cur: "Russian Ruble (₽)", area: 17098242, tz: "UTC+03:00" },
    "JP": { name: "Japan", pop: 123294513, cap: "Tokyo", cur: "Japanese Yen (¥)", area: 377930, tz: "UTC+09:00" },
    "GB": { name: "United Kingdom", pop: 67736802, cap: "London", cur: "British Pound (£)", area: 242900, tz: "UTC+00:00" },
    "FR": { name: "France", pop: 64756584, cap: "Paris", cur: "Euro (€)", area: 551695, tz: "UTC+01:00" },
    "DE": { name: "Germany", pop: 83294633, cap: "Berlin", cur: "Euro (€)", area: 357114, tz: "UTC+01:00" },
    "AU": { name: "Australia", pop: 26439111, cap: "Canberra", cur: "Australian Dollar ($)", area: 7692024, tz: "UTC+10:00" },
    "CA": { name: "Canada", pop: 40097761, cap: "Ottawa", cur: "Canadian Dollar ($)", area: 9984670, tz: "UTC-05:00" },
    "KH": { name: "Cambodia", pop: 16944826, cap: "Phnom Penh", cur: "Cambodian Riel (៛)", area: 181035, tz: "UTC+07:00" },
    "TH": { name: "Thailand", pop: 71801279, cap: "Bangkok", cur: "Thai Baht (฿)", area: 513120, tz: "UTC+07:00" },
    "VN": { name: "Vietnam", pop: 98858950, cap: "Hanoi", cur: "Vietnamese Dong (₫)", area: 331212, tz: "UTC+07:00" },
    "TD": { name: "Chad", pop: 18278568, cap: "N'Djamena", cur: "CFA Franc", area: 1284000, tz: "UTC+01:00" },
    "NG": { name: "Nigeria", pop: 223804632, cap: "Abuja", cur: "Naira (₦)", area: 923768, tz: "UTC+01:00" },
    "EG": { name: "Egypt", pop: 112716598, cap: "Cairo", cur: "Egyptian Pound", area: 1002450, tz: "UTC+02:00" },
    "ID": { name: "Indonesia", pop: 277534122, cap: "Jakarta", cur: "Rupiah (Rp)", area: 1904569, tz: "UTC+07:00" },
    "PK": { name: "Pakistan", pop: 240485658, cap: "Islamabad", cur: "Pakistani Rupee", area: 881912, tz: "UTC+05:00" },
    "UA": { name: "Ukraine", pop: 36744634, cap: "Kyiv", cur: "Hryvnia (₴)", area: 603500, tz: "UTC+02:00" }
};

// --- 5. UI, SWIPEABLE DOCK & COMPACT TOGGLES ---
function toggleDockCollapse(forceState) {
    const dock = document.getElementById('fixed-bottom-dock');
    isDockExpanded = (typeof forceState === 'boolean') ? forceState : !isDockExpanded;
    dock.classList.toggle('expanded', isDockExpanded);
}

// Native Thumb-Swipe Gesture on Bottom Dock Handle
(function initDockSwipe() {
    const handle = document.getElementById('fixed-bottom-dock');
    let startY = 0;
    handle.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
    handle.addEventListener('touchend', (e) => {
        const dy = e.changedTouches[0].clientY - startY;
        if (dy < -35 && !isDockExpanded) toggleDockCollapse(true);
        else if (dy > 45 && isDockExpanded) {
            const activeContent = document.querySelector('.tab-content.active');
            if (!activeContent || activeContent.scrollTop <= 2) toggleDockCollapse(false);
        }
    }, { passive: true });
})();

function openTab(tabName, btnEl) {
    playSound('click');
    const dock = document.getElementById('fixed-bottom-dock');
    if (isDockExpanded && currentTab === tabName) {
        dock.classList.remove('expanded');
        isDockExpanded = false;
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        return;
    }
    dock.classList.add('expanded');
    isDockExpanded = true;
    currentTab = tabName;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    btnEl.classList.add('active');
    if (tabName === 'intel') document.getElementById('intel-badge').classList.add('hidden');
    if (tabName === 'weather') {
        const curLat = parseFloat(document.getElementById('hud-lat').textContent);
        const curLon = parseFloat(document.getElementById('hud-lon').textContent);
        fetchSubSatData(curLat, curLon, true);
    }
}

function scanCurrentFootprint() {
    playSound('lock');
    const curLat = parseFloat(document.getElementById('hud-lat').textContent);
    const curLon = parseFloat(document.getElementById('hud-lon').textContent);
    fetchSubSatData(curLat, curLon, true);
}

function updateLockUI(locked) {
    const btn = document.getElementById('btn-geo-lock');
    const ind = document.getElementById('lock-indicator');
    const topBtn = document.getElementById('top-geo-lock');
    const topDot = document.getElementById('top-lock-dot');

    if (locked) {
        btn.classList.add('bg-sky-700/50', 'border-sky-400');
        ind.textContent = 'ON'; ind.classList.replace('text-slate-400', 'text-sky-300');
        topBtn.classList.add('on');
        topDot.classList.replace('bg-slate-500', 'bg-emerald-400');
        document.getElementById('hud-sat-name').textContent = 'VK-Hover-02';
        document.getElementById('hud-vel').textContent = '0.00';
        if (orbitLineMesh) orbitLineMesh.visible = false;
    } else {
        btn.classList.remove('bg-sky-700/50', 'border-sky-400');
        ind.textContent = 'OFF'; ind.classList.replace('text-sky-300', 'text-slate-400');
        topBtn.classList.remove('on');
        topDot.classList.replace('bg-emerald-400', 'bg-slate-500');
        if (!isISSMode) {
            document.getElementById('hud-sat-name').textContent = 'VK-Tracker-01';
            document.getElementById('hud-vel').textContent = calcOrbitalVelocityKps(currentAltitudeKm).toFixed(2);
            if (orbitLineMesh) orbitLineMesh.visible = !isSolarSystemView;
            updateSpeed(document.getElementById('speed-slider').value);
        }
    }
}

function toggleGeoLock() {
    if (isMultiverseView || isUniverseView || isGalaxyView || isSolarSystemView) {
        transitionToScale('EARTH', {
            toastMsg: 'Zooming In to Earth & Locking Hover',
            onArrived: () => { if (!isGeoLocked) toggleGeoLock(); }
        });
        return;
    }
    if (isISSMode) toggleISSMode();
    isGeoLocked = !isGeoLocked;
    if (isGeoLocked) {
        const exactCoords = worldPositionToLatLon(activeSpacecraft.position, earthMesh.rotation.y);
        lockedLat = exactCoords.lat;
        lockedLon = exactCoords.lon;
        document.getElementById('hud-lat').textContent = lockedLat.toFixed(2);
        document.getElementById('hud-lon').textContent = lockedLon.toFixed(2);
        updateLockUI(true);
        playSound('lock');
        showToast(`Hover Locked at ${lockedLat.toFixed(2)}°, ${lockedLon.toFixed(2)}°`);
        fetchSubSatData(lockedLat, lockedLon, true);
    } else {
        const p = activeSpacecraft.position;
        orbitTime = Math.atan2(Math.hypot(p.y, p.z) * (p.z >= 0 ? 1 : -1), p.x);
        const absLat = Math.abs(lockedLat);
        if (absLat > orbitInclination) {
            orbitInclination = Math.min(90, Math.ceil(absLat));
            document.getElementById('inc-slider').value = orbitInclination;
            document.getElementById('inc-val').textContent = orbitInclination + "°";
            drawOrbitLine();
        }
        updateLockUI(false);
        playSound('click');
        showToast('Resumed Free Orbit');
    }
}

// --- 6. LIVE ISS TRACKING ---
async function pollLiveISS() {
    if (!isISSMode) return;
    try {
        const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
        const data = await res.json();
        if (data && typeof data.latitude === 'number') {
            issTargetLat = data.latitude;
            issTargetLon = data.longitude;
            issAltKm = Math.round(data.altitude);
            issVelKps = (data.velocity / 3600).toFixed(2);
            document.getElementById('hud-alt').textContent = issAltKm;
            document.getElementById('hud-vel').textContent = issVelKps;
            orbitRadius = calcOrbitRadius(issAltKm);
            buildLaser();
        }
    } catch (e) {}
}

function toggleISSMode() {
    if (isMultiverseView || isUniverseView || isGalaxyView || isSolarSystemView) {
        transitionToScale('EARTH', {
            toastMsg: 'Zooming In to Live ISS Orbit',
            onArrived: () => { if (!isISSMode) toggleISSMode(); }
        });
        return;
    }
    isISSMode = !isISSMode;
    const btn = document.getElementById('btn-iss-mode');
    const dot = document.getElementById('iss-dot');

    if (isISSMode) {
        if (isGeoLocked) { isGeoLocked = false; updateLockUI(false); }
        btn.classList.add('on-amber');
        dot.classList.replace('bg-slate-500', 'bg-amber-400');
        document.getElementById('hud-sat-name').textContent = 'ISS (ZARYA LIVE)';
        if (orbitLineMesh) orbitLineMesh.visible = false;
        
        vkSatGroup.visible = false;
        issGroup.visible = true;
        activeSpacecraft = issGroup;

        playSound('lock');
        showToast('Tracking Real-Time International Space Station');
        pollLiveISS().then(() => {
            issCurrentLat = issTargetLat;
            issCurrentLon = issTargetLon;
            fetchSubSatData(issCurrentLat, issCurrentLon, true);
        });
        issInterval = setInterval(pollLiveISS, 4500);
    } else {
        clearInterval(issInterval);
        btn.classList.remove('on-amber');
        dot.classList.replace('bg-amber-400', 'bg-slate-500');
        document.getElementById('hud-sat-name').textContent = 'VK-Tracker-01';
        orbitRadius = calcOrbitRadius(currentAltitudeKm);
        document.getElementById('hud-alt').textContent = currentAltitudeKm;
        document.getElementById('hud-vel').textContent = calcOrbitalVelocityKps(currentAltitudeKm).toFixed(2);
        if (orbitLineMesh) orbitLineMesh.visible = true;

        issGroup.visible = false;
        vkSatGroup.visible = true;
        activeSpacecraft = vkSatGroup;

        buildLaser();
        playSound('click');
        showToast('Returned to VK-Tracker-01');
    }
}

// --- 7. TRUE HELIOCENTRIC SOLAR SYSTEM MODE & SMOOTH CAMERA ---
function positionCameraOnDaySide(instant = false) {
    const camDir = getEarthIndiaCameraPos();
    if (instant) {
        camera.position.copy(camDir);
        controls.target.set(0, 0, 0);
        controls.update();
    } else {
        smoothFlyTo(camDir, new THREE.Vector3(0, 0, 0), 950);
    }
}

function toggleSolarSystemView() {
    if (isSolarSystemView) {
        transitionToScale('EARTH', { toastMsg: 'Zoomed In to Earth Orbital View' });
    } else {
        transitionToScale('COSMOS', { toastMsg: 'Heliocentric Keplerian Solar System (Live UTC)' });
    }
}

function focusCosmosBody(name) {
    focusedCosmosBody = name;
    document.querySelectorAll('.planet-chip').forEach(ch => ch.classList.toggle('active', ch.dataset.body === name));
    const entry = cosmosBodiesMap.get(name);
    if (!entry) return;

    document.getElementById('pt-name').textContent = entry.name;
    document.getElementById('pt-type').textContent = entry.type;
    document.getElementById('pt-stats').innerHTML = entry.statsHTML;

    updateCosmosDossier(name, getDaysSinceJ2000() + simDaysOffset);

    const worldPos = new THREE.Vector3();
    entry.obj.getWorldPosition(worldPos);
    const offsetDist = name === 'Sun' ? 38 : Math.max(2.6, entry.radius * 5.2);
    const camPos = worldPos.clone().add(new THREE.Vector3(offsetDist * 0.7, offsetDist * 0.45, offsetDist * 0.85));
    smoothFlyTo(camPos, worldPos, 900);
}


function exitCosmosModeSilent() {
    isSolarSystemView = false;
    document.getElementById('btn-solar-view').classList.remove('on-purple');
    document.getElementById('solar-dot').classList.replace('bg-purple-400', 'bg-slate-500');
    document.getElementById('cosmos-bar').classList.add('hidden');
    heliocentricGroup.visible = false;
    document.getElementById('cosmos-dossier').classList.add('hidden');
}

function exitGalaxyModeSilent(restoreEarth = false) {
    isGalaxyView = false;
    document.getElementById('btn-galaxy-view').classList.remove('on-indigo');
    document.getElementById('galaxy-dot').classList.replace('bg-indigo-400', 'bg-slate-500');
    document.getElementById('galaxy-bar').classList.add('hidden');
    galaxyGroup.visible = false;
    if (milkyWaySkyMesh) milkyWaySkyMesh.visible = showMilkyWaySky;
    document.getElementById('galaxy-dossier').classList.add('hidden');
    if (restoreEarth) {
        earthSystemGroup.visible = true;
        document.getElementById('earth-dossier').classList.remove('hidden');
        document.getElementById('tab-btn-dossier').textContent = 'Ground Data';
        controls.minDistance = 1.15;
        controls.maxDistance = 16;
        positionCameraOnDaySide(false);
    }
}


function toggleUniverseView() {
    if (isUniverseView) {
        transitionToScale('EARTH', { toastMsg: 'Zoomed In to Earth Orbital View' });
    } else {
        transitionToScale('UNIVERSE', { toastMsg: 'Cosmic Web, CMB Horizon & Multiverse (93B ly)' });
    }
}

const UNIVERSE_REGIONS = {
    'Cosmic Web': {
        title: 'COSMIC WEB // LARGE-SCALE STRUCTURE', subtitle: 'Interconnected Supercluster Filaments &amp; Voids',
        type: 'Supercluster Filaments', stats: '10B+ ly &bull; ~2T Galaxies',
        wiki: 'Observable_universe', camPos: new THREE.Vector3(0, 24, 38), lookAt: new THREE.Vector3(0, 0, 0)
    },
    'Laniakea': {
        title: 'LANIAKEA // HOME SUPERCLUSTER', subtitle: '100,000 Galaxies &bull; 520 Million Light-Years',
        type: 'Local Supercluster', stats: '520M ly &bull; Great Attractor',
        wiki: 'Laniakea_Supercluster', camPos: new THREE.Vector3(4, 9, 14), lookAt: new THREE.Vector3(0, 0, 0)
    },
    'Virgo': {
        title: 'VIRGO SUPERCLUSTER // LOCAL NODE', subtitle: 'Core Cluster of ~1,300–2,000 Galaxies',
        type: 'Galaxy Supercluster', stats: '110M ly &bull; M87 Core',
        wiki: 'Virgo_Supercluster', camPos: new THREE.Vector3(8, 8, 12), lookAt: new THREE.Vector3(4.5, 1.5, 3.0)
    },
    'Great Attractor': {
        title: 'GREAT ATTRACTOR // GRAVITATIONAL ANOMALY', subtitle: 'Central Gravitational Hub of Laniakea',
        type: 'Gravitational Anomaly', stats: '150–250M ly &bull; ~10¹⁶ M☉',
        wiki: 'Great_Attractor', camPos: new THREE.Vector3(-10, 7, 13), lookAt: new THREE.Vector3(-6.2, -1.8, 4.5)
    },
    'Shapley': {
        title: 'SHAPLEY SUPERCLUSTER // MASSIVE NODE', subtitle: 'Largest Galaxy Concentration in Local Universe',
        type: 'Supercluster', stats: '650M ly &bull; 8,000+ Galaxies',
        wiki: 'Shapley_Supercluster', camPos: new THREE.Vector3(-16, 12, -14), lookAt: new THREE.Vector3(-12.5, 4.2, -9.5)
    },
    'Sloan Great Wall': {
        title: 'SLOAN GREAT WALL // COSMIC FILAMENT', subtitle: '1.38 Billion Light-Year Galaxy Filament',
        type: 'Supercluster Filament', stats: '1.38B ly Long &bull; 1B ly Away',
        wiki: 'Sloan_Great_Wall', camPos: new THREE.Vector3(22, 16, -20), lookAt: new THREE.Vector3(16.0, 5.5, -14.0)
    },
    'Boötes Void': {
        title: 'BOÖTES VOID // THE GREAT NOTHING', subtitle: '330 Million Light-Year Spherical Supervoid',
        type: 'Cosmic Supervoid', stats: '330M ly Wide &bull; ~60 Galaxies',
        wiki: 'Boötes_Void', camPos: new THREE.Vector3(16, -10, 22), lookAt: new THREE.Vector3(11.0, -6.5, 13.5)
    },
    'GN-z11': {
        title: 'GN-z11 // EARLY UNIVERSE GALAXY', subtitle: 'Observed 400M Years After the Big Bang',
        type: 'High-Redshift Galaxy (z=10.6)', stats: '32B ly Proper Dist.',
        wiki: 'GN-z11', camPos: new THREE.Vector3(-24, 18, 28), lookAt: new THREE.Vector3(-21.0, 12.0, 20.0)
    },
    'CMB Horizon': {
        title: 'OBSERVABLE UNIVERSE // CMB HORIZON', subtitle: 'Cosmic Microwave Background (93 Billion ly)',
        type: '2.725 K Horizon Sphere', stats: '93B ly &bull; 13.8B yrs Old',
        wiki: 'Cosmic_microwave_background', camPos: new THREE.Vector3(0, 44, 72), lookAt: new THREE.Vector3(0, 0, 0)
    },
    'Multiverse': {
        title: 'MULTIVERSE // HYPOTHETICAL BUBBLES', subtitle: 'Eternal Inflation — An idea, not a measurement',
        type: 'Theoretical Cosmology', stats: '> 100B ly &bull; Unverified',
        wiki: 'Multiverse', camPos: new THREE.Vector3(0, 210, 380), lookAt: new THREE.Vector3(0, 0, 0)
    }
};

const MULTIVERSE_BUBBLES = {
    'Multiverse': {
        title: 'MULTIVERSE // ETERNAL INFLATION', subtitle: 'Hypothetical Bubble Universes — An idea, not a measurement',
        type: 'Theoretical Cosmology', stats: '> 100B ly &bull; Unverified',
        bio: 'In eternal inflation models, quantum fluctuations keep space inflating outside our observable horizon, continuously spawning separate pocket universes with potentially different physical constants.',
        camPos: new THREE.Vector3(0, 210, 380), lookAt: new THREE.Vector3(0, 0, 0)
    },
    'Pocket α': {
        title: 'POCKET UNIVERSE α // ALTERNATE CONSTANTS', subtitle: 'Hypothetical Inflaton Bubble (Bubble #1)',
        type: 'Eternal Inflation Pocket', stats: 'Hypothetical &bull; Different α',
        bio: 'A theoretical neighboring pocket universe where the fine-structure constant or dark energy density settled into a different vacuum state during symmetry breaking.',
        camPos: new THREE.Vector3(52, 34, -12), lookAt: new THREE.Vector3(78, 22, -45)
    },
    'Quantum Branch': {
        title: 'QUANTUM BRANCH // MANY-WORLDS', subtitle: 'Everettian Decoherence Branch (Bubble #2)',
        type: 'Quantum Cosmology', stats: 'Hypothetical &bull; Hilbert Space',
        bio: 'Represents the Many-Worlds interpretation of quantum mechanics, where every quantum measurement branches the universal wavefunction into non-interacting histories.',
        camPos: new THREE.Vector3(-42, -4, -22), lookAt: new THREE.Vector3(-74, -18, -55)
    },
    'Brane Bulk': {
        title: 'BRANE BULK // STRING LANDSCAPE', subtitle: 'Higher-Dimensional M-Theory Brane (Bubble #3)',
        type: 'String Theory Hypothesis', stats: '10⁵⁰⁰ Vacua &bull; Theoretical',
        bio: 'In string theory and brane cosmology, our 3D universe could be a membrane floating in a higher-dimensional bulk alongside other parallel brane-worlds.',
        camPos: new THREE.Vector3(24, -26, 98), lookAt: new THREE.Vector3(45, -42, 68)
    },
    'High-Entropy': {
        title: 'HIGH-ENTROPY POCKET // THERMAL VOID', subtitle: 'Rapidly Decayed Vacuum Bubble (Bubble #4)',
        type: 'Theoretical Vacuum State', stats: 'Short-Lived &bull; Unverified',
        bio: 'A hypothetical pocket universe with a much larger cosmological constant, causing matter to disperse before stars or galaxies could ever form.',
        camPos: new THREE.Vector3(-26, 62, 82), lookAt: new THREE.Vector3(-52, 48, 52)
    }
};

function focusMultiverseBubble(name) {
    const b = MULTIVERSE_BUBBLES[name];
    if (!b) return;
    document.querySelectorAll('#multiverse-chips .planet-chip').forEach(ch => ch.classList.toggle('active', ch.dataset.bubble === name));
    document.getElementById('mt-name').textContent = name;
    document.getElementById('mt-type').textContent = b.type;
    document.getElementById('mt-stats').innerHTML = b.stats;
    document.getElementById('ud-title').textContent = b.title;
    document.getElementById('ud-subtitle').innerHTML = b.subtitle;
    document.getElementById('ud-bio').textContent = b.bio;
    smoothFlyTo(b.camPos, b.lookAt, 950);
}

async function updateUniverseBio(name) {
    const r = UNIVERSE_REGIONS[name];
    if (!r) return;
    const bioEl = document.getElementById('ud-bio');
    bioEl.textContent = 'Fetching live cosmological dossier...';
    try {
        const sumData = await cachedFetchJSON(API_ENDPOINTS.WIKI_SUMMARY(r.wiki), 600000);
        if (focusedUniverseRegion === name && sumData && sumData.extract) {
            bioEl.textContent = sumData.extract;
        }
    } catch (e) {
        if (focusedUniverseRegion === name) bioEl.textContent = r.title;
    }
}

function focusUniverseRegion(name) {
    focusedUniverseRegion = name;
    const r = UNIVERSE_REGIONS[name];
    if (!r) return;
    document.querySelectorAll('#universe-chips .planet-chip').forEach(ch => ch.classList.toggle('active', ch.dataset.region === name));
    document.getElementById('ut-name').textContent = name;
    document.getElementById('ut-type').textContent = r.type;
    document.getElementById('ut-stats').innerHTML = r.stats;
    document.getElementById('ud-title').textContent = r.title;
    document.getElementById('ud-subtitle').innerHTML = r.subtitle;
    smoothFlyTo(r.camPos, r.lookAt, 950);
    updateUniverseBio(name);
}

function toggleGalaxyView() {
    if (isGalaxyView) {
        transitionToScale('EARTH', { toastMsg: 'Zoomed In to Earth Orbital View' });
    } else {
        transitionToScale('GALAXY', { toastMsg: '3D Milky Way Barred Spiral Galaxy (105,700 ly)' });
    }
}

const GALAXY_REGIONS = {
    'Milky Way': {
        title: 'MILKY WAY // SBbc BARRED SPIRAL', subtitle: 'Local Group &bull; 105,700 ly Diameter',
        type: 'SBbc Barred Spiral', stats: '105,700 ly &bull; ~250B Stars',
        dist: '0 – 52,850 ly', vel: '230 km/s (Sun)', year: '230M yrs', diam: '105,700 ly', mass: '1.15 × 10¹² M☉', tilt: '60.2°',
        wiki: 'Milky_Way', camPos: new THREE.Vector3(0, 34, 42), lookAt: new THREE.Vector3(0, 0, 0)
    },
    'Sagittarius A*': {
        title: 'SAGITTARIUS A* // GALACTIC CORE', subtitle: 'Supermassive Black Hole & Central Bar',
        type: 'Supermassive Black Hole', stats: '4.154M M☉ &bull; 26,673 ly',
        dist: '0 ly (Center)', vel: 'Relativistic Core', year: 'N/A', diam: '0.082 AU (Horizon)', mass: '4.154 × 10⁶ M☉', tilt: '60.2°',
        wiki: 'Sagittarius_A*', camPos: new THREE.Vector3(6, 7, 10), lookAt: new THREE.Vector3(0, 0, 0)
    },
    'Solar System': {
        title: 'SOLAR SYSTEM // ORION-CYGNUS SPUR', subtitle: 'Our Home Star System in the Milky Way',
        type: 'Orion Spur (Inner Edge)', stats: '26,670 ly from Core &bull; 230 km/s',
        dist: '26,670 ly (8.18 kpc)', vel: '230 km/s', year: '230M yrs', diam: '~2 ly (Oort Cloud)', mass: '1.0014 M☉', tilt: '60.2°',
        wiki: 'Solar_System', camPos: new THREE.Vector3(13.3, 6.5, 9.5), lookAt: new THREE.Vector3(13.335, 0, 0)
    },
    'Perseus Arm': {
        title: 'PERSEUS ARM // MAJOR SPIRAL ARM', subtitle: 'Primary Outer Spiral Arm of the Milky Way',
        type: 'Major Logarithmic Arm', stats: '~6,400 ly Outer from Sun',
        dist: '~33,000 ly', vel: '225 km/s', year: '~280M yrs', diam: 'Outer Disk Span', mass: 'High OB Star Density', tilt: '60.2°',
        wiki: 'Perseus_Arm', camPos: new THREE.Vector3(-18, 14, 24), lookAt: new THREE.Vector3(-14, 0, 10)
    },
    'Scutum-Centaurus': {
        title: 'SCUTUM-CENTAURUS ARM // MAJOR ARM', subtitle: 'Primary Inner Spiral Arm of the Milky Way',
        type: 'Major Spiral Arm', stats: 'Inner Galactic Disk &bull; Dense Starburst',
        dist: '~18,000 ly', vel: '235 km/s', year: '~180M yrs', diam: 'Inner Disk Span', mass: 'Rich Red Supergiants', tilt: '60.2°',
        wiki: 'Scutum–Centaurus_Arm', camPos: new THREE.Vector3(12, 12, -16), lookAt: new THREE.Vector3(8.5, 0, -9.5)
    },
    'Alpha Centauri': {
        title: 'ALPHA CENTAURI // NEAREST STAR SYSTEM', subtitle: 'Proxima Centauri b &bull; 4.37 Light-Years from Sun',
        type: 'Triple Star System', stats: '4.37 ly &bull; Closest Exoplanet',
        dist: '26,668 ly (Core)', vel: '230 km/s', year: '230M yrs', diam: 'Triple System', mass: '2.18 M☉ Total', tilt: '60.2°',
        wiki: 'Alpha_Centauri', camPos: new THREE.Vector3(15.2, 4.5, 5.2), lookAt: new THREE.Vector3(13.6, 0.1, 0.5)
    },
    'Orion Nebula': {
        title: 'ORION NEBULA (M42) // STELLAR NURSERY', subtitle: 'Closest Massive Star-Forming Region (1,344 ly)',
        type: 'Diffuse H-II Nebula', stats: '1,344 ly from Earth &bull; 24 ly Wide',
        dist: '27,800 ly (Core)', vel: '228 km/s', year: '235M yrs', diam: '24 ly', mass: '~2,000 M☉', tilt: '60.2°',
        wiki: 'Orion_Nebula', camPos: new THREE.Vector3(17.5, 5.2, 7.8), lookAt: new THREE.Vector3(14.6, -0.2, 2.2)
    },
    'Pillars of Creation': {
        title: 'EAGLE NEBULA (M16) // PILLARS OF CREATION', subtitle: 'Sagittarius Arm Star-Forming Columns (5,700 ly)',
        type: 'H-II Molecular Pillars', stats: '5,700 ly &bull; Sagittarius Arm',
        dist: '21,200 ly (Core)', vel: '232 km/s', year: '205M yrs', diam: '70 × 55 ly', mass: '~12,000 M☉', tilt: '60.2°',
        wiki: 'Pillars_of_Creation', camPos: new THREE.Vector3(11.5, 5.8, -6.5), lookAt: new THREE.Vector3(10.2, 0.2, -3.2)
    },
    'LMC': {
        title: 'LARGE MAGELLANIC CLOUD // SATELLITE GALAXY', subtitle: 'Largest Dwarf Satellite of the Milky Way',
        type: 'Magellanic Spiral', stats: '163,000 ly &bull; ~30B Stars',
        dist: '163,000 ly', vel: '327 km/s', year: '~1.5B yrs', diam: '32,200 ly', mass: '1.38 × 10¹¹ M☉', tilt: '35°',
        wiki: 'Large_Magellanic_Cloud', camPos: new THREE.Vector3(-22, -12, -26), lookAt: new THREE.Vector3(-32, -18, -36)
    },
    'Andromeda (M31)': {
        title: 'ANDROMEDA (M31) // LOCAL GROUP', subtitle: 'Nearest Major Spiral Galaxy (2.537M ly)',
        type: 'SA(s)b Spiral Galaxy', stats: '2.537M ly &bull; ~1 Trillion Stars',
        dist: '2,537,000 ly', vel: '-110 km/s (Approach)', year: 'Collision in ~4.5B yrs', diam: '152,000 ly', mass: '1.5 × 10¹² M☉', tilt: '77°',
        wiki: 'Andromeda_Galaxy', camPos: new THREE.Vector3(38, 22, -45), lookAt: new THREE.Vector3(55, 16, -65)
    },
    'Triangulum (M33)': {
        title: 'TRIANGULUM (M33) // LOCAL GROUP', subtitle: 'Third-Largest Galaxy in the Local Group',
        type: 'SA(s)cd Spiral Galaxy', stats: '2.73M ly &bull; ~40B Stars',
        dist: '2,730,000 ly', vel: '-179 km/s', year: 'Local Group', diam: '61,100 ly', mass: '5 × 10¹⁰ M☉', tilt: '54°',
        wiki: 'Triangulum_Galaxy', camPos: new THREE.Vector3(56, 26, -34), lookAt: new THREE.Vector3(72, 24, -48)
    }
};

async function focusGalaxyRegion(name) {
    focusedGalaxyRegion = name;
    const r = GALAXY_REGIONS[name];
    if (!r) return;
    document.querySelectorAll('#galaxy-chips .planet-chip').forEach(ch => ch.classList.toggle('active', ch.dataset.region === name));
    document.getElementById('gt-name').textContent = name;
    document.getElementById('gt-type').textContent = r.type;
    document.getElementById('gt-stats').innerHTML = r.stats;

    document.getElementById('gd-title').textContent = r.title;
    document.getElementById('gd-subtitle').innerHTML = r.subtitle;
    document.getElementById('gd-dist').textContent = r.dist;
    document.getElementById('gd-vel').textContent = r.vel;
    document.getElementById('gd-year').textContent = r.year;
    document.getElementById('gd-diam').textContent = r.diam;
    document.getElementById('gd-mass').textContent = r.mass;
    document.getElementById('gd-tilt').textContent = r.tilt;

    // Dynamically track rotating Solar System pin or static Andromeda world position
    let targetLook = r.lookAt.clone();
    let targetCam = r.camPos.clone();
    if (name === 'Solar System' && solarSystemPinObj) {
        solarSystemPinObj.getWorldPosition(targetLook);
        const radial = targetLook.clone().normalize();
        targetCam = targetLook.clone().add(radial.multiplyScalar(7.5)).add(new THREE.Vector3(0, 6.2, 0));
    } else if (name === 'Andromeda (M31)' && andromedaGroupObj) {
        andromedaGroupObj.getWorldPosition(targetLook);
        targetCam = targetLook.clone().add(new THREE.Vector3(-12, 7, 14));
    }
    smoothFlyTo(targetCam, targetLook, 950);

    const bioEl = document.getElementById('gd-bio');
    bioEl.textContent = 'Fetching live astrophysical dossier...';
    try {
        const sumData = await cachedFetchJSON(API_ENDPOINTS.WIKI_SUMMARY(r.wiki), 600000);
        if (focusedGalaxyRegion === name && sumData && sumData.extract) {
            bioEl.textContent = sumData.extract;
        }
    } catch (e) {
        if (focusedGalaxyRegion === name) bioEl.textContent = r.title;
    }
}

function toggleMilkyWaySky() {
    showMilkyWaySky = !showMilkyWaySky;
    if (milkyWaySkyMesh && !isGalaxyView && !isUniverseView && !isMultiverseView) milkyWaySkyMesh.visible = showMilkyWaySky;
    const btn = document.getElementById('btn-toggle-mw');
    btn.textContent = `Milky Way Sky: ${showMilkyWaySky ? 'ON' : 'OFF'}`;
    btn.classList.toggle('btn-active', showMilkyWaySky);
    playSound('click');
}

function toggleConstellations() {
    showConstellations = !showConstellations;
    if (constellationLinesMesh && !isGalaxyView && !isUniverseView && !isMultiverseView) {
        constellationLinesMesh.visible = showConstellations;
    }
    const btn = document.getElementById('btn-toggle-constellations');
    btn.textContent = `Constellations: ${showConstellations ? 'ON' : 'OFF'}`;
    btn.classList.toggle('btn-active', showConstellations);
    playSound('click');
}

function toggleLabels() {
    showLabels = !showLabels;
    const btn = document.getElementById('btn-toggle-labels');
    btn.textContent = `3D Labels: ${showLabels ? 'ON' : 'OFF'}`;
    btn.classList.toggle('btn-active', showLabels);
    const layer = document.getElementById('labels-layer');
    if (layer && !showLabels) layer.style.display = 'none';
    playSound('click');
}

async function fetchLiveSpaceWeather(force = false) {
    try {
        const [windRes, kpRes] = await Promise.allSettled([
            cachedFetchJSON(API_ENDPOINTS.NOAA_SOLAR_WIND, force ? 0 : 180000),
            cachedFetchJSON(API_ENDPOINTS.NOAA_KP, force ? 0 : 180000)
        ]);
        if (windRes.status === 'fulfilled' && windRes.value && windRes.value.WindSpeed) {
            document.getElementById('sw-wind').textContent = `${windRes.value.WindSpeed} km/s`;
        } else {
            document.getElementById('sw-wind').textContent = '410 km/s (Nominal)';
        }
        if (kpRes.status === 'fulfilled' && Array.isArray(kpRes.value) && kpRes.value.length > 1) {
            const latest = kpRes.value[kpRes.value.length - 1];
            const kp = parseFloat(latest[1]);
            const status = kp >= 5 ? 'Storm ⚡' : (kp >= 4 ? 'Active' : 'Quiet');
            document.getElementById('sw-kp').textContent = `Kp ${kp.toFixed(1)} (${status})`;
        } else {
            document.getElementById('sw-kp').textContent = 'Kp 2.3 (Quiet)';
        }
    } catch (e) {}
}

async function updateCosmosDossier(name, simDays) {
    const entry = cosmosBodiesMap.get(name);
    if (!entry) return;
    const p = entry.meta;
    const earthHelio = computePlanetHeliocentricAU(JPL_PLANETS[2], simDays);

    document.getElementById('cd-title').textContent = `${entry.name.toUpperCase()} // ${entry.type.toUpperCase()}`;

    if (name === 'Sun') {
        const eDistMkm = (earthHelio.rAU * AU_KM / 1e6).toFixed(2);
        const lm = (earthHelio.rAU * AU_KM / C_KM_MIN).toFixed(2);
        document.getElementById('cd-subtitle').textContent = `Heliocentric Origin &bull; ${earthHelio.rAU.toFixed(4)} AU from Earth`;
        document.getElementById('cd-sun-dist').textContent = '0.0000 AU';
        document.getElementById('cd-earth-dist').textContent = `${eDistMkm}M km`;
        document.getElementById('cd-light-time').textContent = `${lm} min`;
        document.getElementById('cd-vel').textContent = '230 km/s (Galactic)';
        document.getElementById('cd-ecc-inc').textContent = 'Origin Frame';
        document.getElementById('cd-obliq').textContent = '7.25°';
        document.getElementById('cd-radius').textContent = '696,340 km';
        document.getElementById('cd-grav').textContent = '274 m/s² | 617.7 km/s';
        document.getElementById('cd-temp').textContent = '5,505 °C | 25.4d';
        document.getElementById('cd-atmo').innerHTML = '<strong>Composition:</strong> 73.46% Hydrogen, 24.85% Helium, 0.77% Oxygen, 0.29% Carbon.';
        document.getElementById('cd-moon-count').textContent = '8 Planets';
        document.getElementById('cd-moons').innerHTML = '<div class="bg-slate-900/50 border border-slate-800 rounded p-2.5 text-slate-300">Gravitational anchor for 8 major planets, 5+ dwarf planets, the Main Asteroid Belt, and the outer Kuiper Belt.</div>';
    } else if (p) {
        const res = p.isComet ? computeHalleyState(simDays) : computePlanetHeliocentricAU(p, simDays);
        const distEarthAU = res.vec.distanceTo(earthHelio.vec);
        const distEarthMkm = (distEarthAU * AU_KM / 1e6).toFixed(2);
        const lightMin = (distEarthAU * AU_KM / C_KM_MIN).toFixed(2);

        document.getElementById('cd-subtitle').textContent = `Live J2000 Ephemeris &bull; ${res.rAU.toFixed(4)} AU from Sun`;
        document.getElementById('cd-sun-dist').textContent = `${res.rAU.toFixed(3)} AU`;
        document.getElementById('cd-earth-dist').textContent = p.isEarth ? '0.00 km (Home)' : `${distEarthMkm}M km`;
        document.getElementById('cd-light-time').textContent = p.isEarth ? '0.00 min' : `${lightMin} min`;
        document.getElementById('cd-vel').textContent = `${res.vKps.toFixed(2)} km/s`;
        document.getElementById('cd-ecc-inc').textContent = `e=${p.e.toFixed(3)} | I=${p.I.toFixed(1)}°`;
        document.getElementById('cd-obliq').textContent = `${p.tilt}°`;
        document.getElementById('cd-radius').textContent = `${p.radiusKm.toLocaleString()} km`;
        document.getElementById('cd-grav').textContent = `${p.gravity} m/s² | ${p.escapeKps} km/s`;
        document.getElementById('cd-temp').textContent = `${p.temp} | ${p.dayLen}`;
        document.getElementById('cd-atmo').innerHTML = `<strong>Atmosphere:</strong> ${p.atmo}`;
        document.getElementById('cd-moon-count').textContent = `${p.moonCount} Known`;

        if (p.moons && p.moons.length > 0) {
            let mHtml = '';
            p.moons.forEach(m => {
                const dirLabel = m.period < 0 ? 'Retrograde' : 'Prograde';
                mHtml += `
                <div class="bg-slate-900/60 border border-slate-800 rounded p-2 flex justify-between items-center">
                    <span class="font-semibold text-emerald-300">🌑 ${m.name}</span>
                    <span class="text-[10px] text-slate-400 mono-telemetry">Period: ${Math.abs(m.period)}d (${dirLabel})</span>
                </div>`;
            });
            document.getElementById('cd-moons').innerHTML = mHtml;
        } else {
            document.getElementById('cd-moons').innerHTML = '<div class="bg-slate-900/40 border border-slate-800 rounded p-2.5 text-slate-400">No natural moons orbit this planet.</div>';
        }
    }

    // Fetch live Wikipedia summary for the selected celestial body
    const bioEl = document.getElementById('cd-bio');
    bioEl.textContent = 'Fetching live astronomical dossier...';
    const wikiKey = name === 'Sun' ? 'Sun' : (p && p.wikiTitle ? p.wikiTitle : name);
    try {
        const sumData = await cachedFetchJSON(API_ENDPOINTS.WIKI_SUMMARY(wikiKey), 600000);
        if (focusedCosmosBody === name && sumData && sumData.extract) {
            bioEl.textContent = sumData.extract;
        }
    } catch (e) {
        if (focusedCosmosBody === name) bioEl.textContent = `${name} — ${entry.type} in the Solar System.`;
    }
}

// --- 8. API ENDPOINTS & DATA EXTRACTION (INCLUDING NASA JPL NEAR-EARTH ASTEROIDS) ---
const API_ENDPOINTS = {
    EARTHQUAKES: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
    EONET: 'https://eonet.gsfc.nasa.gov/api/v3/events?limit=15&days=10',
    JPL_ASTEROIDS: 'https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.05&date-min=now&sort=date&limit=3',
    NOAA_KP: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
    NOAA_SOLAR_WIND: 'https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json',
    NEWS_GLOBAL: 'https://api.rss2json.com/v1/api.json?rss_url=http://feeds.bbci.co.uk/news/world/rss.xml',
    NEWS_REGIONAL_RSS2JSON: (query) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-US&gl=US&ceid=US:en')}`,
    GDELT_NEWS: (query) => `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=5&format=json&sort=DateDesc`,
    WIKI_SEARCH: (query) => `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*&srlimit=4`,
    RELIEFWEB_GLOBAL: 'https://api.reliefweb.int/v1/disasters?appname=vyuhak&preset=latest&profile=full&limit=8',
    RELIEFWEB_COUNTRY: (country) => `https://api.reliefweb.int/v1/reports?appname=vyuhak&query[value]=${encodeURIComponent(country)}&limit=3`,
    WEATHER: (lat, lon) => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=relativehumidity_2m&current_weather=true`,
    AIR_QUALITY: (lat, lon) => `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,uv_index`,
    GEOCODE: (name) => `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`,
    REVGEO: (lat, lon) => `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    COUNTRY_ALPHA: (code) => `https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}?fields=name,population,capital,currencies,area,timezones`,
    COUNTRY_NAME: (name) => `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=name,population,capital,currencies,area,timezones`,
    WIKI_GEO: (lat, lon, rad) => `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=${rad}&gslimit=6&format=json&origin=*`,
    WIKI_SUMMARY: (title) => `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
};

function decodeWeatherCode(code) {
    const map = {
        0: 'Clear Sky ☀️', 1: 'Mainly Clear 🌤️', 2: 'Partly Cloudy ⛅', 3: 'Overcast ☁️',
        45: 'Foggy 🌫️', 48: 'Rime Fog 🌫️', 51: 'Light Drizzle 🌦️', 53: 'Moderate Drizzle 🌦️',
        61: 'Slight Rain 🌧️', 63: 'Moderate Rain 🌧️', 65: 'Heavy Rain ⛈️', 71: 'Snowfall ❄️',
        80: 'Rain Showers 🌦️', 95: 'Thunderstorm ⚡', 99: 'Severe Storm 🌩️'
    };
    return map[code] || 'Clear / Variable 🌤️';
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatPopulation(num) {
    if (!num || isNaN(num)) return 'N/A';
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + ' Billion';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + ' Million';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
}

let liveIntelData = [];
async function fetchLiveIntel(force = false) {
    document.getElementById('connection-led').classList.add('recording');
    const feed = document.getElementById('intel-feed');
    if (force) feed.innerHTML = '<div class="skeleton-card h-14 rounded-lg"></div><div class="skeleton-card h-14 rounded-lg"></div>';
    
    liveIntelData = [];
    let newItemsHTML = '';
    let alertCount = 0;

    try {
        const [eqRes, eoRes, rwRes, newsRes, jplRes] = await Promise.allSettled([
            cachedFetchJSON(API_ENDPOINTS.EARTHQUAKES, 120000),
            cachedFetchJSON(API_ENDPOINTS.EONET, 300000),
            cachedFetchJSON(API_ENDPOINTS.RELIEFWEB_GLOBAL, 300000),
            cachedFetchJSON(API_ENDPOINTS.NEWS_GLOBAL, 300000),
            cachedFetchJSON(API_ENDPOINTS.JPL_ASTEROIDS, 600000)
        ]);

        // NASA JPL Real-Time Near-Earth Asteroids
        if (jplRes.status === 'fulfilled' && jplRes.value.data && jplRes.value.data.length > 0) {
            jplRes.value.data.slice(0, 2).forEach(row => {
                alertCount++;
                const des = row[0], date = row[3], distAU = parseFloat(row[4]), velKps = parseFloat(row[7]).toFixed(1);
                const lunarDist = (distAU * 389.17).toFixed(1);
                newItemsHTML += `
                <div class="api-item bg-purple-900/20 border border-purple-500/35 rounded-lg p-3 flex gap-3 items-start cursor-pointer hover:bg-purple-900/35 transition" onclick="if(!isSolarSystemView) toggleSolarSystemView()">
                    <div class="text-xl">☄️</div>
                    <div>
                        <div class="text-[12px] font-bold text-purple-300 mb-0.5">Near-Earth Asteroid: ${des}</div>
                        <div class="text-[11px] text-slate-200">Approach: ${date} &bull; ${lunarDist} Lunar Distances (${velKps} km/s)</div>
                        <div class="text-[10px] text-purple-400 mt-0.5 font-semibold">Tap to view Heliocentric Solar System &rarr;</div>
                    </div>
                </div>`;
            });
        }

        if (eqRes.status === 'fulfilled' && eqRes.value.features) {
            eqRes.value.features.slice(0, 4).forEach(eq => {
                alertCount++;
                const mag = eq.properties.mag.toFixed(1);
                const place = eq.properties.place;
                const [lon, lat] = eq.geometry.coordinates;
                liveIntelData.push({ type: 'eq', lat, lon, title: `Magnitude ${mag} Earthquake near ${place}` });
                newItemsHTML += `
                <div class="api-item bg-red-900/20 border border-red-500/30 rounded-lg p-3 flex gap-3 items-start cursor-pointer hover:bg-red-900/40 transition" onclick="parkSatelliteAt(${lat}, ${lon})">
                    <div class="text-xl">🌋</div>
                    <div>
                        <div class="text-[12px] font-bold text-red-400 mb-0.5">Earthquake (Magnitude ${mag})</div>
                        <div class="text-[11px] text-slate-200">${place}</div>
                        <div class="text-[10px] text-sky-400 mt-1 font-semibold">Tap to lock satellite &rarr;</div>
                    </div>
                </div>`;
            });
        }

        if (eoRes.status === 'fulfilled' && eoRes.value.events) {
            eoRes.value.events.slice(0, 4).forEach(ev => {
                if (ev.geometry && ev.geometry.length > 0) {
                    alertCount++;
                    const title = ev.title;
                    const coords = ev.geometry[0].coordinates;
                    let lon = coords[0], lat = coords[1];
                    if (Array.isArray(lon)) { lon = coords[0][0][0]; lat = coords[0][0][1]; } 
                    liveIntelData.push({ type: 'eonet', lat, lon, title });
                    newItemsHTML += `
                    <div class="api-item bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 flex gap-3 items-start cursor-pointer hover:bg-amber-900/40 transition" onclick="parkSatelliteAt(${lat}, ${lon})">
                        <div class="text-xl">🔥</div>
                        <div>
                            <div class="text-[12px] font-bold text-amber-400 mb-0.5">Active Wildfire / Storm</div>
                            <div class="text-[11px] text-slate-200">${title}</div>
                            <div class="text-[10px] text-sky-400 mt-1 font-semibold">Tap to lock satellite &rarr;</div>
                        </div>
                    </div>`;
                }
            });
        }

        if (rwRes.status === 'fulfilled' && rwRes.value.data) {
            rwRes.value.data.slice(0, 4).forEach(d => {
                if (d.fields && d.fields.primary_country && d.fields.primary_country.location) {
                    alertCount++;
                    const lat = d.fields.primary_country.location.lat;
                    const lon = d.fields.primary_country.location.lon;
                    const title = d.fields.name;
                    liveIntelData.push({ type: 'rw', lat, lon, title });
                    newItemsHTML += `
                    <div class="api-item bg-fuchsia-900/20 border border-fuchsia-500/30 rounded-lg p-3 flex gap-3 items-start cursor-pointer hover:bg-fuchsia-900/40 transition" onclick="parkSatelliteAt(${lat}, ${lon})">
                        <div class="text-xl">⚠️</div>
                        <div>
                            <div class="text-[12px] font-bold text-fuchsia-400 mb-0.5">Conflict / Humanitarian Crisis</div>
                            <div class="text-[11px] text-slate-200">${title}</div>
                            <div class="text-[10px] text-sky-400 mt-1 font-semibold">Tap to lock satellite &rarr;</div>
                        </div>
                    </div>`;
                }
            });
        }

        if (newsRes.status === 'fulfilled' && newsRes.value.items) {
            newsRes.value.items.slice(0, 3).forEach(n => {
                alertCount++;
                newItemsHTML += `
                <div class="api-item bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 flex gap-3 items-start">
                    <div class="text-xl">📰</div>
                    <div>
                        <div class="text-[12px] font-bold text-blue-400 mb-0.5">World Headline</div>
                        <div class="text-[11px] text-slate-200">${n.title}</div>
                    </div>
                </div>`;
            });
        }

        feed.innerHTML = newItemsHTML || '<div class="text-center p-4 text-[12px] text-slate-500">No major global alerts right now.</div>';
        const badge = document.getElementById('intel-badge');
        if (alertCount > 0) { badge.textContent = alertCount; badge.classList.remove('hidden'); }
        renderIntelMarkers();
    } catch (e) {
        feed.innerHTML = '<div class="text-center p-4 text-[12px] text-red-500 font-bold">Failed to connect to global networks.</div>';
    } finally {
        document.getElementById('connection-led').classList.remove('recording');
    }
}

let currentScanId = 0;
async function fetchSubSatData(lat, lon, force = false) {
    const scanId = ++currentScanId;
    const numLat = parseFloat(lat);
    const numLon = parseFloat(lon);
    const swathKm = Math.round(swathRadius * 4800);

    document.getElementById('weather-loc').textContent = `Center: ${numLat.toFixed(2)}°, ${numLon.toFixed(2)}° | Radius: ${swathKm} km`;
    document.getElementById('connection-led').classList.add('recording');

    ['reg-pop', 'reg-cap', 'reg-cur', 'reg-area', 'reg-dens', 'reg-tz'].forEach(id => {
        document.getElementById(id).textContent = 'Scanning...';
    });

    const weatherPromise = cachedFetchJSON(API_ENDPOINTS.WEATHER(numLat.toFixed(2), numLon.toFixed(2)), 180000).catch(() => null);
    const aqiPromise = cachedFetchJSON(API_ENDPOINTS.AIR_QUALITY(numLat.toFixed(2), numLon.toFixed(2)), 180000).catch(() => null);
    const geoPromise = cachedFetchJSON(API_ENDPOINTS.REVGEO(numLat.toFixed(2), numLon.toFixed(2)), 300000).catch(() => null);

    weatherPromise.then(wData => {
        if (scanId !== currentScanId || !wData) return;
        let temp = '--', wind = '--', hum = '--', code = 0;
        if (wData.current) {
            temp = wData.current.temperature_2m; wind = wData.current.wind_speed_10m;
            hum = wData.current.relative_humidity_2m; code = wData.current.weather_code;
        } else if (wData.current_weather) {
            temp = wData.current_weather.temperature; wind = wData.current_weather.windspeed;
            code = wData.current_weather.weathercode;
            hum = (wData.hourly && wData.hourly.relativehumidity_2m) ? wData.hourly.relativehumidity_2m[0] : 55;
        }
        document.getElementById('w-temp').innerHTML = `${temp} &deg;C`;
        document.getElementById('w-wind').innerHTML = `${wind} km/h`;
        document.getElementById('w-hum').innerHTML = `${hum}%`;
        document.getElementById('w-cond').textContent = decodeWeatherCode(code);
    });

    aqiPromise.then(aData => {
        if (scanId !== currentScanId) return;
        if (aData && aData.current) {
            const aqi = aData.current.us_aqi ?? '--';
            const pm25 = aData.current.pm2_5 ?? '--';
            const uv = aData.current.uv_index ?? '--';
            const label = aqi <= 50 ? 'Good' : (aqi <= 100 ? 'Moderate' : (aqi <= 150 ? 'Sensitive' : 'Unhealthy'));
            document.getElementById('w-aqi').textContent = aqi !== '--' ? `${aqi} (${label})` : 'N/A';
            document.getElementById('w-pm').textContent = `${pm25} µg/m³ | UV ${uv}`;
        } else {
            document.getElementById('w-aqi').textContent = 'N/A';
            document.getElementById('w-pm').textContent = 'N/A';
        }
    });

    const geoData = await geoPromise;
    if (scanId !== currentScanId) return;
    document.getElementById('connection-led').classList.remove('recording');

    if (!geoData) {
        document.getElementById('geo-data').textContent = "Unable to resolve ground details at this moment.";
        return;
    }

    const ctry = geoData.countryName || '';
    const ctryCode = (geoData.countryCode || '').toUpperCase();
    const state = geoData.principalSubdivision || '';
    const city = geoData.city || geoData.locality || '';
    const informative = (geoData.localityInfo && geoData.localityInfo.informative) ? geoData.localityInfo.informative : [];
    const admin = (geoData.localityInfo && geoData.localityInfo.administrative) ? geoData.localityInfo.administrative : [];
    const ocean = informative.length > 0 ? informative[0].name : 'International Waters';

    if (!ctry) {
        document.getElementById('geo-data').innerHTML = `
            <div class="text-sky-400 font-bold text-sm">🌊 Maritime / Oceanic Sector: ${ocean}</div>
            <div class="text-slate-300 text-xs mt-1">Satellite footprint is over open international waters. Monitoring maritime weather and subsea seismic activity.</div>
        `;
        document.getElementById('reg-pop-label').textContent = "Sector Population";
        document.getElementById('reg-pop').textContent = "0 (Oceanic)";
        document.getElementById('reg-cap').textContent = "Int'l Waters";
        document.getElementById('reg-cur').textContent = "Maritime Trade";
        document.getElementById('reg-area').textContent = "Open Ocean";
        document.getElementById('reg-dens').textContent = "0 / km²";
        document.getElementById('reg-tz').textContent = `UTC ${numLon >= 0 ? '+' : ''}${Math.round(numLon / 15)}h`;
        
        Promise.allSettled([
            fetchRegionalNews(ocean, "Maritime Shipping", scanId),
            fetchPublicInterest(ocean, "", "", informative, admin, scanId),
            checkFootprintConflicts(numLat, numLon, swathKm, "", scanId),
            fetchTopLandmarks(numLat, numLon, ocean, informative, admin, scanId)
        ]);
    } else {
        let summaryText = `The satellite is scanning <strong class="text-emerald-400">${city ? city + ', ' : ''}${state && state !== city ? state + ', ' : ''}${ctry}</strong>.`;
        document.getElementById('geo-data').innerHTML = `<div class="mb-1">${summaryText}</div><div id="region-bio" class="text-[11px] text-slate-300 mt-1.5 leading-relaxed"></div>`;
        document.getElementById('reg-pop-label').textContent = "Country Population";

        if (SOVEREIGN_DB[ctryCode]) {
            const db = SOVEREIGN_DB[ctryCode];
            document.getElementById('reg-pop').textContent = formatPopulation(db.pop);
            document.getElementById('reg-cap').textContent = db.cap;
            document.getElementById('reg-cur').textContent = db.cur;
            document.getElementById('reg-area').textContent = db.area.toLocaleString() + ' km²';
            document.getElementById('reg-dens').textContent = Math.round(db.pop / db.area).toLocaleString() + ' / km²';
            document.getElementById('reg-tz').textContent = db.tz;
        }

        Promise.allSettled([
            fetchCountryMetrics(ctryCode, ctry, numLon, scanId),
            fetchRegionBio(city, state, ctry, scanId),
            fetchRegionalNews(state || city || ctry, ctry, scanId),
            fetchPublicInterest(ctry, state, city, informative, admin, scanId),
            checkFootprintConflicts(numLat, numLon, swathKm, ctry, scanId),
            fetchTopLandmarks(numLat, numLon, state || ctry, informative, admin, scanId)
        ]);
    }
}

async function fetchCountryMetrics(ctryCode, ctryName, numLon, scanId) {
    try {
        let cArr = null;
        if (ctryCode) cArr = await cachedFetchJSON(API_ENDPOINTS.COUNTRY_ALPHA(ctryCode), 600000).catch(() => null);
        if (!cArr) cArr = await cachedFetchJSON(API_ENDPOINTS.COUNTRY_NAME(ctryName), 600000).catch(() => null);
        if (cArr && scanId === currentScanId) {
            const cInfo = Array.isArray(cArr) ? cArr[0] : cArr;
            if (cInfo) {
                const popNum = cInfo.population || 0;
                const areaNum = cInfo.area || 0;
                document.getElementById('reg-pop').textContent = formatPopulation(popNum);
                document.getElementById('reg-cap').textContent = (cInfo.capital && cInfo.capital[0]) ? cInfo.capital[0] : 'N/A';
                const curObj = cInfo.currencies ? Object.values(cInfo.currencies)[0] : null;
                document.getElementById('reg-cur').textContent = curObj ? `${curObj.name} (${curObj.symbol || ''})` : 'N/A';
                document.getElementById('reg-area').textContent = areaNum ? areaNum.toLocaleString() + ' km²' : 'N/A';
                document.getElementById('reg-dens').textContent = (popNum && areaNum) ? Math.round(popNum / areaNum).toLocaleString() + ' / km²' : 'N/A';
                document.getElementById('reg-tz').textContent = (cInfo.timezones && cInfo.timezones[0]) ? cInfo.timezones[0] : `UTC ${numLon >= 0 ? '+' : ''}${Math.round(numLon / 15)}h`;
                return;
            }
        }
    } catch (e) {}
    if (scanId === currentScanId && !SOVEREIGN_DB[ctryCode]) {
        ['reg-pop', 'reg-cap', 'reg-cur', 'reg-area', 'reg-dens'].forEach(id => {
            if (document.getElementById(id).textContent === 'Scanning...') document.getElementById(id).textContent = 'N/A';
        });
        document.getElementById('reg-tz').textContent = `UTC ${numLon >= 0 ? '+' : ''}${Math.round(numLon / 15)}h`;
    }
}

async function fetchRegionBio(city, state, ctry, scanId) {
    const candidates = [state ? `${city ? city + ', ' : ''}${state}` : '', state, ctry].filter(Boolean);
    for (const placeName of candidates) {
        try {
            const sumData = await cachedFetchJSON(API_ENDPOINTS.WIKI_SUMMARY(placeName), 600000);
            if (sumData.extract && sumData.type !== 'disambiguation' && !sumData.extract.includes('may refer to:') && scanId === currentScanId) {
                const bioEl = document.getElementById('region-bio');
                if (bioEl) bioEl.innerHTML = `<span class="text-sky-300 font-semibold">[${sumData.title || placeName}]:</span> ${sumData.extract}`;
                return;
            }
        } catch (e) {}
    }
}

async function fetchRegionalNews(primaryQuery, fallbackCountry = '', scanId) {
    const newsContainer = document.getElementById('reg-news');
    try {
        let items = [];
        let sourceTag = primaryQuery;
        const fullQuery = fallbackCountry && primaryQuery !== fallbackCountry ? `${primaryQuery} ${fallbackCountry}` : primaryQuery;

        try {
            const gData = await cachedFetchJSON(API_ENDPOINTS.GDELT_NEWS(fullQuery), 300000);
            if (gData && gData.articles && gData.articles.length > 0) {
                items = gData.articles.map(a => ({ title: a.title, link: a.url, pubDate: a.domain || 'Live Wire' }));
                sourceTag = fullQuery;
            }
        } catch (e) {}

        if (items.length === 0) {
            try {
                const data = await cachedFetchJSON(API_ENDPOINTS.NEWS_REGIONAL_RSS2JSON(fullQuery), 300000);
                if (data && data.items && data.items.length > 0) { items = data.items; sourceTag = fullQuery; }
            } catch (e) {}
        }

        if (items.length === 0 && fallbackCountry) {
            try {
                const gData2 = await cachedFetchJSON(API_ENDPOINTS.GDELT_NEWS(fallbackCountry), 300000);
                if (gData2 && gData2.articles && gData2.articles.length > 0) {
                    items = gData2.articles.map(a => ({ title: a.title, link: a.url, pubDate: a.domain || 'Live Wire' }));
                    sourceTag = fallbackCountry;
                }
            } catch (e) {}
        }

        if (scanId !== currentScanId) return;

        if (items.length > 0) {
            let html = '';
            items.slice(0, 4).forEach(item => {
                const cleanTitle = (item.title || '').replace(/ - .*$/, '');
                const pubDate = item.pubDate ? item.pubDate.split(' ')[0] : 'Live';
                html += `
                <a href="${item.link || '#'}" target="_blank" class="block bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/60 rounded p-2.5 transition">
                    <div class="text-sky-300 font-semibold text-[11px] leading-snug">📰 ${cleanTitle}</div>
                    <div class="text-[9px] text-slate-400 mt-1">Focus: ${sourceTag} &bull; ${pubDate}</div>
                </a>`;
            });
            newsContainer.innerHTML = html;
        } else {
            newsContainer.innerHTML = `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">Quiet media sector for ${primaryQuery}.</div>`;
        }
    } catch (e) {
        if (scanId === currentScanId) newsContainer.innerHTML = `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">Regional news feed temporarily unavailable.</div>`;
    }
}

async function fetchPublicInterest(country, state, city, informative, admin, scanId) {
    const container = document.getElementById('reg-interest');
    let html = '';
    const tags = [];
    admin.forEach(a => { if (a.name && a.description) tags.push(`${a.name} (${a.description})`); });
    informative.forEach(i => { if (i.name && i.description && !i.name.includes('UTC')) tags.push(`${i.name} — ${i.description}`); });

    if (tags.length > 0) {
        html += `
        <div class="bg-slate-900/60 border border-slate-800 rounded p-2.5">
            <div class="text-[10px] font-bold text-amber-300 uppercase mb-1">Geopolitical & Ecological Zones</div>
            <div class="text-[11px] text-slate-300 leading-relaxed">${tags.slice(0, 5).join(' &bull; ')}</div>
        </div>`;
    }

    const searchTarget = `${state || city} ${country}`.trim();
    if (searchTarget) {
        try {
            const wData = await cachedFetchJSON(API_ENDPOINTS.WIKI_SEARCH(searchTarget), 600000);
            if (scanId !== currentScanId) return;
            if (wData.query && wData.query.search && wData.query.search.length > 0) {
                wData.query.search.slice(0, 3).forEach(s => {
                    const cleanSnippet = s.snippet.replace(/<\/?[^>]+(>|$)/g, "");
                    html += `
                    <div class="bg-slate-900/50 border border-slate-800/80 rounded p-2.5">
                        <div class="font-bold text-amber-400 text-[11px]">🔍 Public Interest: ${s.title}</div>
                        <div class="text-[11px] text-slate-300 mt-0.5 leading-snug">${cleanSnippet}...</div>
                    </div>`;
                });
            }
        } catch (e) {}
    }

    if (scanId === currentScanId) {
        container.innerHTML = html || `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">Standard civilian and ecological sector.</div>`;
    }
}

async function checkFootprintConflicts(lat, lon, radiusKm, countryName, scanId) {
    const container = document.getElementById('reg-conflicts');
    let alertsHTML = '';

    liveIntelData.forEach(item => {
        const dist = getDistanceKm(lat, lon, item.lat, item.lon);
        if (dist <= radiusKm) {
            const badge = item.type === 'eq' ? '🌋 Seismic Alert' : (item.type === 'eonet' ? '🔥 Wildfire / Storm' : '⚠️ Conflict / Crisis');
            alertsHTML += `
            <div class="bg-red-950/40 border border-red-500/40 rounded p-2.5">
                <div class="font-bold text-red-400">${badge} (${Math.round(dist)} km from center)</div>
                <div class="text-slate-200 mt-0.5">${item.title}</div>
            </div>`;
        }
    });

    if (countryName) {
        try {
            const rwData = await cachedFetchJSON(API_ENDPOINTS.RELIEFWEB_COUNTRY(countryName), 300000);
            if (rwData.data && rwData.data.length > 0) {
                rwData.data.forEach(rep => {
                    alertsHTML += `
                    <div class="bg-amber-950/30 border border-amber-500/30 rounded p-2.5">
                        <div class="font-bold text-amber-400">⚠️ UN Humanitarian / Security Report (${countryName})</div>
                        <div class="text-slate-200 mt-0.5">${rep.fields.title}</div>
                    </div>`;
                });
            }
        } catch (e) {}
    }

    if (scanId !== currentScanId) return;
    container.innerHTML = alertsHTML || `<div class="bg-emerald-950/20 border border-emerald-500/30 rounded p-3 text-emerald-300 font-semibold">✅ No active wars, major earthquakes, or disasters detected within this ${radiusKm} km footprint.</div>`;
}

async function fetchTopLandmarks(lat, lon, fallbackRegion, informative, admin, scanId) {
    const wikiContainer = document.getElementById('wiki-data');
    try {
        const wikiData = await cachedFetchJSON(API_ENDPOINTS.WIKI_GEO(lat.toFixed(2), lon.toFixed(2), 10000), 600000);
        if (scanId !== currentScanId) return;

        let items = (wikiData.query && wikiData.query.geosearch) ? wikiData.query.geosearch : [];
        if (items.length > 0) {
            let wHtml = `<div class="grid grid-cols-1 gap-1.5">`;
            items.forEach(item => {
                wHtml += `
                <div class="bg-slate-900/60 border border-slate-800 rounded p-2 flex justify-between items-center">
                    <span class="font-semibold text-emerald-300">📍 ${item.title}</span>
                    <span class="text-[10px] text-slate-400">${(item.dist / 1000).toFixed(1)} km away</span>
                </div>`;
            });
            wikiContainer.innerHTML = wHtml + `</div>`;
            return;
        }

        let fallbackHTML = `<div class="grid grid-cols-1 gap-1.5">`;
        let count = 0;
        if (fallbackRegion) {
            const searchData = await cachedFetchJSON(API_ENDPOINTS.WIKI_SEARCH(`landmarks OR mountains OR cities in ${fallbackRegion}`), 600000);
            if (searchData.query && searchData.query.search) {
                searchData.query.search.slice(0, 4).forEach(s => {
                    count++;
                    fallbackHTML += `
                    <div class="bg-slate-900/60 border border-slate-800 rounded p-2 flex justify-between items-center">
                        <span class="font-semibold text-emerald-300">📍 ${s.title}</span>
                        <span class="text-[10px] text-slate-400">${fallbackRegion}</span>
                    </div>`;
                });
            }
        }
        if (scanId === currentScanId) {
            wikiContainer.innerHTML = count > 0 ? fallbackHTML + `</div>` : `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">Remote sector in ${fallbackRegion || 'area'}.</div>`;
        }
    } catch (e) {
        if (scanId === currentScanId) wikiContainer.innerHTML = `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">Landmark scanner offline.</div>`;
    }
}

async function searchAndDeploy() {
    const raw = document.getElementById('search-location').value.trim();
    if (!raw) return showToast('Enter a city, country, or lat, lon');

    const coordMatch = raw.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
        const lat = parseFloat(coordMatch[1]), lon = parseFloat(coordMatch[3]);
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            parkSatelliteAt(lat, lon);
            return;
        }
    }

    try {
        showToast(`Searching "${raw}"...`);
        const geo = await cachedFetchJSON(API_ENDPOINTS.GEOCODE(raw), 600000);
        if (geo && geo.results && geo.results.length > 0) {
            const loc = geo.results[0];
            parkSatelliteAt(loc.latitude, loc.longitude);
            showToast(`Deployed over ${loc.name}, ${loc.country || ''}`);
            if (loc.population) {
                setTimeout(() => {
                    document.getElementById('reg-pop-label').textContent = `${loc.name} Population`;
                    document.getElementById('reg-pop').textContent = formatPopulation(loc.population);
                }, 400);
            }
        } else {
            showToast('Location not found. Try a larger city or lat, lon.');
        }
    } catch (e) {
        showToast('Search service offline.');
    }
}

function parkSatelliteAt(lat, lon) {
    if (isMultiverseView || isUniverseView || isGalaxyView || isSolarSystemView) {
        const targetPos = latLonToWorldPosition(lat, lon, orbitRadius, earthMesh.rotation.y);
        transitionToScale('EARTH', {
            earthTargetCamPos: targetPos.clone().multiplyScalar(1.75),
            onArrived: () => parkSatelliteAt(lat, lon)
        });
        return;
    }
    if (isISSMode) toggleISSMode();
    playSound('lock');
    lockedLat = lat;
    lockedLon = lon;
    isGeoLocked = true;
    updateLockUI(true);
    
    document.getElementById('hud-lat').textContent = lat.toFixed(2);
    document.getElementById('hud-lon').textContent = lon.toFixed(2);
    satMarker.setLatLng([lat, lon]);
    satCircle.setLatLng([lat, lon]);

    const newPos = latLonToWorldPosition(lockedLat, lockedLon, orbitRadius, earthMesh.rotation.y);
    activeSpacecraft.position.copy(newPos);
    activeSpacecraft.lookAt(0,0,0);

    const groundTabBtn = document.querySelectorAll('.tab-btn')[1];
    if (!isDockExpanded || currentTab !== 'weather') {
        openTab('weather', groundTabBtn);
    } else {
        fetchSubSatData(lat, lon, true);
    }

    const targetCamPos = activeSpacecraft.position.clone().multiplyScalar(1.75);
    smoothFlyTo(targetCamPos, new THREE.Vector3(0, 0, 0), 750);
}

// ============================================================================
// 9. 3D ENGINE: EARTH ORBITAL FRAME + TRUE HELIOCENTRIC SOLAR SYSTEM
// ============================================================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 3600);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
document.getElementById('globe-viewport').appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.06;
controls.minDistance = 1.15; controls.maxDistance = 16;

// Two Cleanly Separated Scene Frames (Zero Floating-Point Jitter!)
const earthSystemGroup = new THREE.Group();
const heliocentricGroup = new THREE.Group();
heliocentricGroup.visible = false;
const galaxyGroup = new THREE.Group();
galaxyGroup.visible = false;
const universeGroup = new THREE.Group();
universeGroup.visible = false;
scene.add(earthSystemGroup);
scene.add(heliocentricGroup);
scene.add(galaxyGroup);
scene.add(universeGroup);

// --- A. REAL CATALOG STARS + 12 MAJOR CONSTELLATIONS WITH STAR-CONNECTING LINES ---
(function createRealStarfieldAndConstellations() {
    // Real astronomical stars [RA_hours, Dec_deg, hexColor]
    const CONSTELLATION_STARS = {
        // Orion
        betelgeuse: [5.919, 7.407, 0xfb923c], bellatrix: [5.419, 6.350, 0xbae6fd],
        mintaka: [5.533, -0.299, 0xe0f2fe], alnilam: [5.603, -1.202, 0xe0f2fe], alnitak: [5.679, -1.943, 0xbae6fd],
        saiph: [5.796, -9.670, 0xbae6fd], rigel: [5.242, -8.202, 0x93c5fd], meissa: [5.585, 9.934, 0xbae6fd],
        // Ursa Major (Big Dipper)
        dubhe: [11.062, 61.751, 0xfdba74], merak: [11.031, 56.382, 0xf8fafc], phecda: [11.897, 53.695, 0xf8fafc],
        megrez: [12.257, 57.033, 0xf8fafc], alioth: [12.900, 55.960, 0xf8fafc], mizar: [13.399, 54.925, 0xf8fafc],
        alkaid: [13.792, 49.313, 0xbae6fd],
        // Ursa Minor (Little Dipper / Polaris)
        polaris: [2.530, 89.264, 0xfef9c3], yildun: [17.537, 86.586, 0xf8fafc], epsUMi: [16.766, 82.037, 0xfef08a],
        zetaUMi: [15.734, 77.794, 0xf8fafc], kochab: [14.845, 74.156, 0xfdba74], pherkad: [15.345, 71.834, 0xf8fafc],
        etaUMi: [16.292, 75.755, 0xfef9c3],
        // Cassiopeia (W shape)
        caph: [0.153, 59.150, 0xfef9c3], schedar: [0.675, 56.537, 0xfdba74], gammaCas: [0.945, 60.717, 0xbae6fd],
        ruchbah: [1.430, 60.235, 0xf8fafc], segin: [1.907, 63.670, 0xbae6fd],
        // Scorpius
        acrab: [16.091, -19.805, 0xbae6fd], dschubba: [16.005, -22.622, 0xbae6fd], piSco: [15.981, -26.114, 0xbae6fd],
        antares: [16.490, -26.432, 0xf87171], tauSco: [16.598, -28.216, 0xbae6fd], epsSco: [16.836, -34.293, 0xfdba74],
        zetaSco: [16.909, -42.361, 0xfdba74], sargas: [17.622, -42.998, 0xfef9c3], shaula: [17.560, -37.104, 0xbae6fd],
        // Leo
        regulus: [10.139, 11.967, 0xbae6fd], etaLeo: [10.122, 16.763, 0xf8fafc], algieba: [10.333, 19.841, 0xfdba74],
        adhafera: [10.278, 23.417, 0xfef9c3], rasalas: [9.879, 26.007, 0xfdba74], zosma: [11.235, 20.524, 0xf8fafc],
        chertan: [11.237, 15.429, 0xf8fafc], denebola: [11.818, 14.572, 0xf8fafc],
        // Cygnus (Northern Cross)
        deneb: [20.690, 45.280, 0xe0f2fe], sadr: [20.370, 40.257, 0xfef9c3], albireo: [19.512, 27.960, 0xfdba74],
        gienahCyg: [20.770, 33.970, 0xfdba74], deltaCyg: [19.750, 45.131, 0xbae6fd],
        // Crux (Southern Cross)
        acrux: [12.443, -63.099, 0xbae6fd], gacrux: [12.519, -57.113, 0xfb923c],
        mimosa: [12.795, -59.689, 0xbae6fd], imai: [12.252, -58.749, 0xbae6fd],
        // Canis Major
        sirius: [6.752, -16.716, 0xbae6fd], mirzam: [6.378, -17.956, 0xbae6fd], wezen: [7.140, -26.393, 0xfef9c3],
        adhara: [6.977, -28.972, 0xbae6fd], aludra: [7.401, -29.303, 0xbae6fd], muliphein: [7.063, -15.633, 0xbae6fd],
        // Taurus
        aldebaran: [4.599, 16.509, 0xfb923c], elnath: [5.438, 28.607, 0xbae6fd], zetaTau: [5.627, 21.143, 0xbae6fd],
        ain: [4.477, 19.180, 0xfdba74], hyadumI: [4.330, 15.628, 0xfdba74],
        // Gemini
        castor: [7.577, 31.888, 0xf8fafc], pollux: [7.755, 28.026, 0xfdba74], alhena: [6.629, 16.399, 0xf8fafc],
        wasat: [7.335, 21.982, 0xfef9c3], mebsuta: [6.732, 25.131, 0xfdba74], tejat: [6.383, 22.514, 0xfb923c],
        // Pegasus (Great Square)
        markab: [23.079, 15.205, 0xbae6fd], scheat: [23.063, 28.083, 0xfb923c],
        algenib: [0.220, 15.184, 0xbae6fd], alpheratz: [0.140, 29.091, 0xbae6fd]
    };

    const CONSTELLATION_EDGES = [
        // Orion
        ['meissa','betelgeuse'], ['meissa','bellatrix'], ['betelgeuse','bellatrix'],
        ['betelgeuse','alnitak'], ['bellatrix','mintaka'], ['mintaka','alnilam'], ['alnilam','alnitak'],
        ['mintaka','rigel'], ['alnitak','saiph'], ['rigel','saiph'],
        // Ursa Major
        ['dubhe','merak'], ['merak','phecda'], ['phecda','megrez'], ['megrez','dubhe'],
        ['megrez','alioth'], ['alioth','mizar'], ['mizar','alkaid'],
        // Ursa Minor
        ['polaris','yildun'], ['yildun','epsUMi'], ['epsUMi','zetaUMi'],
        ['zetaUMi','kochab'], ['kochab','pherkad'], ['pherkad','etaUMi'], ['etaUMi','zetaUMi'],
        // Cassiopeia
        ['caph','schedar'], ['schedar','gammaCas'], ['gammaCas','ruchbah'], ['ruchbah','segin'],
        // Scorpius
        ['acrab','dschubba'], ['dschubba','piSco'], ['dschubba','antares'], ['antares','tauSco'],
        ['tauSco','epsSco'], ['epsSco','zetaSco'], ['zetaSco','sargas'], ['sargas','shaula'],
        // Leo
        ['regulus','etaLeo'], ['etaLeo','algieba'], ['algieba','adhafera'], ['adhafera','rasalas'],
        ['algieba','zosma'], ['zosma','denebola'], ['denebola','chertan'], ['chertan','regulus'], ['zosma','chertan'],
        // Cygnus
        ['deneb','sadr'], ['sadr','albireo'], ['deltaCyg','sadr'], ['sadr','gienahCyg'],
        // Crux
        ['acrux','gacrux'], ['mimosa','imai'],
        // Canis Major
        ['sirius','mirzam'], ['sirius','muliphein'], ['sirius','wezen'], ['wezen','adhara'], ['wezen','aludra'],
        // Taurus
        ['elnath','ain'], ['ain','hyadumI'], ['hyadumI','aldebaran'], ['aldebaran','zetaTau'],
        // Gemini
        ['castor','pollux'], ['castor','mebsuta'], ['mebsuta','tejat'], ['pollux','wasat'], ['wasat','alhena'],
        // Pegasus Square
        ['markab','scheat'], ['scheat','alpheratz'], ['alpheratz','algenib'], ['algenib','markab']
    ];

    const starPosMap = {};
    const starKeys = Object.keys(CONSTELLATION_STARS);
    const rSphere = 240;

    function raDecToVec3(raHours, decDeg, r) {
        const raRad = (raHours * 15) * Math.PI / 180;
        const decRad = decDeg * Math.PI / 180;
        return new THREE.Vector3(
            r * Math.cos(decRad) * Math.cos(raRad),
            r * Math.sin(decRad),
            -r * Math.cos(decRad) * Math.sin(raRad)
        );
    }

    const totalStars = 3400 + starKeys.length;
    const positions = new Float32Array(totalStars * 3);
    const colors = new Float32Array(totalStars * 3);
    const palette = [new THREE.Color(0xffffff), new THREE.Color(0xbae6fd), new THREE.Color(0xfef08a), new THREE.Color(0xfed7aa)];

    starKeys.forEach((key, idx) => {
        const [ra, dec, hex] = CONSTELLATION_STARS[key];
        const v = raDecToVec3(ra, dec, rSphere);
        starPosMap[key] = v;
        positions[idx*3] = v.x; positions[idx*3+1] = v.y; positions[idx*3+2] = v.z;
        const c = new THREE.Color(hex);
        colors[idx*3] = c.r; colors[idx*3+1] = c.g; colors[idx*3+2] = c.b;
    });

    for (let i = starKeys.length; i < totalStars; i++) {
        const r = 220 + Math.random() * 180;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i*3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i*3+2] = r * Math.cos(phi);
        const c = palette[Math.floor(Math.random() * palette.length)];
        colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const starSpriteTex = createCircleSpriteTexture('rgba(255,255,255,1)', 'rgba(186,230,253,0.35)');
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
        size: 1.4,
        map: starSpriteTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.94,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    })));

    // Single-draw-call Constellation Star-Connecting Lines (Visible in Earth & Solar views!)
    const linePositions = [];
    CONSTELLATION_EDGES.forEach(([a, b]) => {
        if (starPosMap[a] && starPosMap[b]) {
            linePositions.push(starPosMap[a], starPosMap[b]);
        }
    });
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePositions);
    constellationLinesMesh = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    }));
    scene.add(constellationLinesMesh);

    // Compute centroid anchor for each of the 12 constellations for subtle floating sky labels
    const CONSTELLATION_GROUPS = [
        ['Orion', ['betelgeuse','bellatrix','rigel','saiph','alnilam']],
        ['Ursa Major', ['dubhe','merak','phecda','megrez','alioth','mizar','alkaid']],
        ['Ursa Minor', ['polaris','kochab','pherkad','zetaUMi']],
        ['Cassiopeia', ['caph','schedar','gammaCas','ruchbah','segin']],
        ['Scorpius', ['acrab','antares','epsSco','sargas','shaula']],
        ['Leo', ['regulus','algieba','zosma','denebola']],
        ['Cygnus', ['deneb','sadr','albireo','gienahCyg']],
        ['Crux', ['acrux','gacrux','mimosa','imai']],
        ['Canis Major', ['sirius','mirzam','wezen','adhara']],
        ['Taurus', ['aldebaran','elnath','zetaTau','ain']],
        ['Gemini', ['castor','pollux','alhena','mebsuta']],
        ['Pegasus', ['markab','scheat','algenib','alpheratz']]
    ];
    CONSTELLATION_GROUPS.forEach(([cname, keys]) => {
        const sum = new THREE.Vector3();
        let cnt = 0;
        keys.forEach(k => { if (starPosMap[k]) { sum.add(starPosMap[k]); cnt++; } });
        if (cnt > 0) {
            sum.divideScalar(cnt).normalize().multiplyScalar(rSphere);
            constellationLabelAnchors.push({ name: cname, pos: sum });
        }
    });
})();

// --- A2. 360° REALISTIC MILKY WAY SKYBAND (TILTED 60.2° GALACTIC PLANE + GREAT RIFT DUST LANES) ---
const milkyWaySkyMat = new THREE.ShaderMaterial({
    vertexShader: `
        varying vec3 vDir;
        void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec3 vDir;
        float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float noise(vec3 x) {
            vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
            return mix(
                mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z
            );
        }
        float fbm(vec3 p) {
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.08; a *= 0.5; }
            return v;
        }
        void main() {
            vec3 d = normalize(vDir);
            // Galactic latitude b (band lies along y = 0 in tilted local sphere)
            float band = exp(-pow(d.y * 5.2, 2.0));
            // Galactic core bulge toward +X (Sagittarius direction)
            float coreAngle = max(dot(d, vec3(1.0, 0.0, 0.0)), 0.0);
            float coreBulge = pow(coreAngle, 4.0) * exp(-pow(d.y * 3.2, 2.0));

            // Multi-scale star clouds & Great Rift dark dust lanes
            float clouds = fbm(d * 5.5 + vec3(1.2, 0.4, -0.8));
            float fineDust = fbm(d * 14.0 + clouds * 1.4);
            float rift = smoothstep(0.36, 0.64, fineDust) * exp(-pow(d.y * 10.5, 2.0));

            // Color palette: Deep indigo-blue outer band -> warm golden-white Sagittarius core
            vec3 outerCol = vec3(0.16, 0.24, 0.44);
            vec3 midCol   = vec3(0.42, 0.48, 0.66);
            vec3 coreCol  = vec3(0.96, 0.78, 0.54);
            vec3 nebulaCol = vec3(0.68, 0.22, 0.46) * smoothstep(0.64, 0.85, fbm(d * 9.0 + 3.1)) * band * 0.32;

            vec3 col = mix(outerCol, midCol, smoothstep(0.3, 0.75, clouds)) * band * (0.45 + 0.85 * clouds);
            col += coreCol * coreBulge * (0.55 + 0.5 * clouds);
            col += nebulaCol;

            // Carve out the Great Rift dark dust lanes
            col *= (1.0 - rift * 0.78);

            float alpha = clamp((band * 0.48 + coreBulge * 0.55) * (0.6 + 0.6 * clouds), 0.0, 0.82);
            gl_FragColor = vec4(col, alpha);
        }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false
});
const milkyWaySkyMesh = new THREE.Mesh(new THREE.SphereGeometry(520, 48, 32), milkyWaySkyMat);
// Real astronomical tilt of the Galactic Plane relative to Earth's Ecliptic (60.2 deg)
milkyWaySkyMesh.rotation.z = 60.2 * Math.PI / 180;
milkyWaySkyMesh.rotation.y = 0.45;
scene.add(milkyWaySkyMesh);

// --- B. LIGHTING ---
scene.add(new THREE.AmbientLight(0xffffff, 0.22));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
earthSystemGroup.add(sunLight);

// --- C. FBM PLASMA SOLAR PHOTOSPHERE + VOLUMETRIC CORONA FLARE ---
const solarTimeUniform = { value: 0 };
const sunGlowTex = createCircleSpriteTexture('rgba(255,248,220,0.95)', 'rgba(251,146,60,0.38)');
function createRadiantSun(coreRadius) {
    const g = new THREE.Group();
    const photosphereMat = new THREE.ShaderMaterial({
        uniforms: { uTime: solarTimeUniform },
        vertexShader: `
            varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
            void main() {
                vPos = normalize(position);
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vNormal = normalize(mat3(modelMatrix) * normal);
                vView = normalize(cameraPosition - wp.xyz);
                gl_Position = projectionMatrix * viewMatrix * wp;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
            float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
            float noise(vec3 x) {
                vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                    mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z
                );
            }
            float fbm(vec3 p) {
                float v = 0.0, a = 0.5;
                for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.05; a *= 0.5; }
                return v;
            }
            void main() {
                vec3 p = vPos * 4.5 + vec3(uTime * 0.08, -uTime * 0.05, uTime * 0.06);
                float n = fbm(p + fbm(p * 1.4));
                float spots = smoothstep(0.26, 0.38, n);
                float limb = pow(max(dot(normalize(vNormal), normalize(vView)), 0.0), 0.45);
                vec3 deepOrange = vec3(0.88, 0.24, 0.02);
                vec3 brightGold = vec3(1.0, 0.72, 0.18);
                vec3 hotCore = vec3(1.0, 0.97, 0.86);
                vec3 col = mix(deepOrange, brightGold, spots);
                col = mix(col, hotCore, clamp(n * 0.75 + limb * 0.55 - 0.35, 0.0, 1.0));
                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(coreRadius, 40, 40), photosphereMat));

    // Billboard Volumetric Solar Corona Sprite (Radiates softly with zero hard edge)
    const spriteMat = new THREE.SpriteMaterial({
        map: sunGlowTex,
        color: 0xfdba74,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const coronaSprite = new THREE.Sprite(spriteMat);
    coronaSprite.scale.set(coreRadius * 6.5, coreRadius * 6.5, 1);
    g.add(coronaSprite);
    return g;
}

// --- D. PHOTOREALISTIC EARTH + RELIEF + SOFT WISPY CLOUDS ---
const texLoader = new THREE.TextureLoader();
const earthDayTex = texLoader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
const earthNightTex = texLoader.load('https://unpkg.com/three-globe/example/img/earth-night.jpg');
const earthWaterTex = texLoader.load('https://unpkg.com/three-globe/example/img/earth-water.png');
const earthBumpTex = texLoader.load('https://unpkg.com/three-globe/example/img/earth-topology.png');
const earthCloudsTex = texLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png');
earthCloudsTex.minFilter = THREE.LinearMipmapLinearFilter;
earthCloudsTex.magFilter = THREE.LinearFilter;

const earthUniforms = {
    dayTexture: { value: earthDayTex },
    nightTexture: { value: earthNightTex },
    specularTexture: { value: earthWaterTex },
    bumpTexture: { value: earthBumpTex },
    sunDir: { value: new THREE.Vector3(1, 0, 0) },
    satDir: { value: new THREE.Vector3(0, 0, 1) },
    satSpotCos: { value: Math.cos(0.22) },
    opticsMode: { value: 0 }
};

const earthShaderMat = new THREE.ShaderMaterial({
    uniforms: earthUniforms,
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
            vUv = uv;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `,
    fragmentShader: `
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform sampler2D specularTexture;
        uniform sampler2D bumpTexture;
        uniform vec3 sunDir;
        uniform vec3 satDir;
        uniform float satSpotCos;
        uniform int opticsMode;

        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;

        void main() {
            vec3 N = normalize(vWorldNormal);
            vec3 L = normalize(sunDir);
            vec3 V = normalize(cameraPosition - vWorldPos);

            vec3 dayCol = texture2D(dayTexture, vUv).rgb;
            vec3 nightCol = texture2D(nightTexture, vUv).rgb * 1.48;
            float waterMask = texture2D(specularTexture, vUv).r;

            float hL = texture2D(bumpTexture, vUv + vec2(-0.0015, 0.0)).r;
            float hR = texture2D(bumpTexture, vUv + vec2( 0.0015, 0.0)).r;
            float hD = texture2D(bumpTexture, vUv + vec2(0.0, -0.0015)).r;
            float hU = texture2D(bumpTexture, vUv + vec2(0.0,  0.0015)).r;
            float relief = ((hR - hL) + (hU - hD)) * (1.0 - waterMask) * 0.45;

            float NdotL = dot(N, L);
            float dayFactor = smoothstep(-0.14, 0.22, NdotL);
            float litDiffuse = clamp(0.24 + 0.86 * max(NdotL + relief * 0.35, 0.0), 0.0, 1.15);

            vec3 H = normalize(L + V);
            float spec = pow(max(dot(N, H), 0.0), 38.0) * waterMask * max(NdotL, 0.0) * 0.52;

            float twilight = exp(-pow((NdotL + 0.03) * 14.5, 2.0)) * 0.13;
            vec3 twilightCol = vec3(0.95, 0.44, 0.22) * twilight;

            float satDot = dot(N, normalize(satDir));
            float inSwath = smoothstep(satSpotCos - 0.012, satSpotCos + 0.012, satDot);
            float nightOnly = 1.0 - dayFactor;
            vec3 satDaylight = dayCol * 0.92 * inSwath * nightOnly;

            vec3 finalCol = mix(nightCol, dayCol * litDiffuse, dayFactor) + twilightCol + vec3(spec) + satDaylight;

            if (opticsMode == 1) {
                float lum = dot(finalCol, vec3(0.299, 0.587, 0.114));
                finalCol = mix(vec3(0.05, 0.02, 0.18), vec3(1.0, 0.45, 0.05), lum * 1.4);
            } else if (opticsMode == 2) {
                float lum = dot(finalCol, vec3(0.299, 0.587, 0.114));
                finalCol = vec3(0.05, lum * 1.35 + 0.05, 0.08);
            }

            gl_FragColor = vec4(finalCol, 1.0);
        }
    `
});

const earthWireMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.35 });
const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), earthShaderMat);
earthSystemGroup.add(earthMesh);

const cloudShaderMat = new THREE.ShaderMaterial({
    uniforms: { cloudTexture: { value: earthCloudsTex }, sunDir: earthUniforms.sunDir },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
            vUv = uv;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D cloudTexture;
        uniform vec3 sunDir;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
            vec4 c = texture2D(cloudTexture, vUv);
            float mask = smoothstep(0.08, 0.88, c.a * c.r);
            float NdotL = dot(normalize(vWorldNormal), normalize(sunDir));
            float light = smoothstep(-0.22, 0.32, NdotL);
            float twilight = exp(-pow(NdotL * 6.0, 2.0)) * 0.25;
            vec3 col = mix(vec3(0.04, 0.06, 0.12), vec3(1.0, 0.99, 0.97), light) + vec3(0.95, 0.45, 0.18) * twilight;
            gl_FragColor = vec4(col, mask * (0.08 + 0.62 * light));
        }
    `,
    transparent: true, depthWrite: false
});
const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(1.008, 48, 48), cloudShaderMat);
earthSystemGroup.add(cloudMesh);

const atmosMat = new THREE.ShaderMaterial({
    uniforms: { sunDir: earthUniforms.sunDir },
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vNormal = normalize(mat3(modelMatrix) * normal);
            vViewDir = normalize(cameraPosition - worldPos.xyz);
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `,
    fragmentShader: `
        uniform vec3 sunDir;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
            float rim = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.2);
            float sunSide = smoothstep(-0.35, 0.6, dot(vNormal, normalize(sunDir)));
            vec3 col = mix(vec3(0.08, 0.25, 0.6), vec3(0.32, 0.72, 1.0), sunSide);
            gl_FragColor = vec4(col, rim * (0.22 + 0.78 * sunSide));
        }
    `,
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false
});
earthSystemGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1.032, 48, 48), atmosMat));

// Earth-Frame Distant Sun & Cratered Moon
const earthSunVisual = createRadiantSun(2.4);
earthSystemGroup.add(earthSunVisual);

const moonMat = new THREE.ShaderMaterial({
    uniforms: { sunDir: earthUniforms.sunDir },
    vertexShader: `
        varying vec3 vNormal; varying vec3 vPos;
        void main() { vPos = position; vNormal = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
        uniform vec3 sunDir; varying vec3 vNormal; varying vec3 vPos;
        float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float noise(vec3 x) {
            vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
            return mix(
                mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z
            );
        }
        void main() {
            vec3 p = normalize(vPos) * 5.5;
            float maria = noise(p * 0.65);
            float craters = noise(p * 2.8) * 0.5 + noise(p * 6.5) * 0.25;
            vec3 baseCol = mix(vec3(0.32, 0.34, 0.38), vec3(0.76, 0.78, 0.80), smoothstep(0.32, 0.68, maria)) * (0.8 + 0.35 * craters);
            float lit = max(dot(normalize(vNormal), normalize(sunDir)), 0.0);
            gl_FragColor = vec4(baseCol * (0.06 + 0.98 * lit), 1.0);
        }
    `
});
const earthFrameMoon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 36, 36), moonMat);
earthSystemGroup.add(earthFrameMoon);

// --- E. TRUE HELIOCENTRIC KEPLERIAN SOLAR SYSTEM ORRERY (NASA JPL J2000 ELEMENTS) ---
const cosmosBodiesMap = new Map();
const helioSun = createRadiantSun(2.4);
heliocentricGroup.add(helioSun);
const helioPointLight = new THREE.PointLight(0xfff7ed, 2.2, 260, 0.5);
heliocentricGroup.add(helioPointLight);

// NASA JPL J2000 Keplerian Elements for all 8 Planets
// a (AU), e (eccentricity), I (deg), L0 (deg at J2000), LRate (deg/century), wBar (deg), Omega (deg)
const JPL_PLANETS = [
    { name: 'Mercury', wikiTitle: 'Mercury_(planet)', type: 'Terrestrial Planet', a: 0.38710, e: 0.20563, I: 7.005, L0: 252.25, LRate: 149472.67, wBar: 77.46, Omega: 48.33, visR: 0.32, visDist: 5.5, c1: 0x6b7280, c2: 0x9ca3af, band: false,
      tilt: 0.03, radiusKm: 2440, gravity: 3.7, escapeKps: 4.25, temp: '167 °C', dayLen: '58.6d', atmo: 'Trace Exosphere (O₂, Na, H₂, He)', moonCount: 0, moons: [] },
    { name: 'Venus', wikiTitle: 'Venus', type: 'Terrestrial Planet', a: 0.72333, e: 0.00677, I: 3.395, L0: 181.98, LRate: 58517.82, wBar: 131.56, Omega: 76.68, visR: 0.48, visDist: 8.2, c1: 0xd97706, c2: 0xfef08a, band: true,
      tilt: 177.36, radiusKm: 6052, gravity: 8.87, escapeKps: 10.36, temp: '464 °C', dayLen: '243d (Retro)', atmo: '96.5% CO₂, 3.5% N₂ (Dense Sulfuric Clouds)', moonCount: 0, moons: [] },
    { name: 'Earth', wikiTitle: 'Earth', type: 'Home World (3rd)', a: 1.00000, e: 0.01671, I: 0.000, L0: 100.46, LRate: 35999.37, wBar: 102.94, Omega: 0.00, visR: 0.54, visDist: 11.5, isEarth: true,
      tilt: 23.44, radiusKm: 6371, gravity: 9.81, escapeKps: 11.19, temp: '15 °C', dayLen: '23h 56m', atmo: '78% N₂, 21% O₂, 0.93% Ar, 0.04% CO₂', moonCount: 1,
      moons: [{ name: 'Moon (Luna)', r: 0.14, dist: 1.18, period: 27.32, color: 0xcbd5e1 }] },
    { name: 'Mars', wikiTitle: 'Mars', type: 'Terrestrial Planet', a: 1.52368, e: 0.09340, I: 1.850, L0: 355.45, LRate: 19140.30, wBar: 336.06, Omega: 49.56, visR: 0.40, visDist: 15.2, c1: 0x9a3412, c2: 0xea580c, band: false,
      tilt: 25.19, radiusKm: 3390, gravity: 3.72, escapeKps: 5.03, temp: '-65 °C', dayLen: '24h 37m', atmo: '95.3% CO₂, 2.6% N₂, 1.9% Ar', moonCount: 2,
      moons: [
          { name: 'Phobos', r: 0.055, dist: 0.72, period: 0.32, color: 0xa8a29e },
          { name: 'Deimos', r: 0.045, dist: 1.02, period: 1.26, color: 0xd6d3d1 }
      ] },
    { name: 'Jupiter', wikiTitle: 'Jupiter', type: 'Gas Giant', a: 5.20260, e: 0.04849, I: 1.303, L0: 34.40, LRate: 3034.91, wBar: 14.33, Omega: 100.46, visR: 1.35, visDist: 23.0, c1: 0x92400e, c2: 0xfde68a, band: true,
      tilt: 3.13, radiusKm: 69911, gravity: 24.79, escapeKps: 59.5, temp: '-110 °C', dayLen: '9h 56m', atmo: '89.8% H₂, 10.2% He, Trace CH₄ & NH₃', moonCount: 95,
      moons: [
          { name: 'Io', r: 0.11, dist: 1.85, period: 1.77, color: 0xfacc15 },
          { name: 'Europa', r: 0.10, dist: 2.25, period: 3.55, color: 0xe2e8f0 },
          { name: 'Ganymede', r: 0.15, dist: 2.72, period: 7.15, color: 0x94a3b8 },
          { name: 'Callisto', r: 0.13, dist: 3.25, period: 16.69, color: 0x64748b }
      ] },
    { name: 'Saturn', wikiTitle: 'Saturn', type: 'Ringed Gas Giant', a: 9.55491, e: 0.05551, I: 2.489, L0: 49.94, LRate: 1222.11, wBar: 93.06, Omega: 113.67, visR: 1.12, visDist: 31.5, c1: 0xb45309, c2: 0xfef3c7, band: true, rings: true,
      tilt: 26.73, radiusKm: 58232, gravity: 10.44, escapeKps: 35.5, temp: '-140 °C', dayLen: '10h 42m', atmo: '96.3% H₂, 3.25% He, Trace CH₄', moonCount: 146,
      moons: [
          { name: 'Enceladus', r: 0.07, dist: 2.75, period: 1.37, color: 0xf8fafc },
          { name: 'Rhea', r: 0.09, dist: 3.18, period: 4.52, color: 0xcbd5e1 },
          { name: 'Titan', r: 0.16, dist: 3.78, period: 15.95, color: 0xf59e0b }
      ] },
    { name: 'Uranus', wikiTitle: 'Uranus', type: 'Ice Giant', a: 19.2184, e: 0.04630, I: 0.773, L0: 313.23, LRate: 428.47, wBar: 173.01, Omega: 74.01, visR: 0.78, visDist: 39.5, c1: 0x0891b2, c2: 0xa5f3fc, band: true,
      tilt: 97.77, radiusKm: 25362, gravity: 8.69, escapeKps: 21.3, temp: '-195 °C', dayLen: '17h 14m (Retro)', atmo: '82.5% H₂, 15.2% He, 2.3% CH₄', moonCount: 28,
      moons: [
          { name: 'Titania', r: 0.085, dist: 1.45, period: 8.71, color: 0xcbd5e1 },
          { name: 'Oberon', r: 0.08, dist: 1.85, period: 13.46, color: 0x94a3b8 }
      ] },
    { name: 'Neptune', wikiTitle: 'Neptune', type: 'Ice Giant', a: 30.1104, e: 0.00899, I: 1.770, L0: 304.88, LRate: 218.46, wBar: 48.12, Omega: 131.78, visR: 0.75, visDist: 47.0, c1: 0x1d4ed8, c2: 0x60a5fa, band: true,
      tilt: 28.32, radiusKm: 24622, gravity: 11.15, escapeKps: 23.5, temp: '-200 °C', dayLen: '16h 06m', atmo: '80% H₂, 19% He, 1.5% CH₄', moonCount: 16,
      moons: [
          { name: 'Triton', r: 0.11, dist: 1.55, period: -5.88, color: 0xe2e8f0 }
      ] }
];

function createHelioPlanetMat(colA, colB, banded, hasPolarCaps = false, rimHex = 0x000000) {
    return new THREE.ShaderMaterial({
        uniforms: {
            colorA: { value: new THREE.Color(colA) },
            colorB: { value: new THREE.Color(colB) },
            rimCol: { value: new THREE.Color(rimHex) },
            isBanded: { value: banded ? 1.0 : 0.0 },
            polarCaps: { value: hasPolarCaps ? 1.0 : 0.0 }
        },
        vertexShader: `
            varying vec3 vNormal; varying vec3 vLocal; varying vec3 vWorldPos;
            void main() {
                vLocal = normalize(position);
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vWorldPos = wp.xyz;
                vNormal = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * wp;
            }
        `,
        fragmentShader: `
            uniform vec3 colorA; uniform vec3 colorB; uniform vec3 rimCol;
            uniform float isBanded; uniform float polarCaps;
            varying vec3 vNormal; varying vec3 vLocal; varying vec3 vWorldPos;
            float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
            float noise(vec3 x) {
                vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                    mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z
                );
            }
            float fbm(vec3 p) {
                float v = 0.0, a = 0.5;
                for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
                return v;
            }
            void main() {
                vec3 N = normalize(vNormal);
                vec3 L = normalize(-vWorldPos);
                vec3 V = normalize(cameraPosition - vWorldPos);
                float turb = fbm(vLocal * 4.5);
                float pat = isBanded > 0.5
                    ? fbm(vec3(vLocal.x * 1.4, vLocal.y * 8.5 + turb * 1.6, vLocal.z * 1.4))
                    : fbm(vLocal * 5.2 + turb * 0.8);
                vec3 col = mix(colorA, colorB, smoothstep(0.22, 0.78, pat));
                if (polarCaps > 0.5) {
                    float cap = smoothstep(0.82, 0.94, abs(vLocal.y) + turb * 0.08);
                    col = mix(col, vec3(0.92, 0.94, 0.98), cap);
                }
                float lit = max(dot(N, L), 0.0);
                float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * smoothstep(-0.2, 0.6, dot(N, L));
                vec3 finalCol = col * (0.12 + 0.96 * lit) + rimCol * rim * 0.55;
                gl_FragColor = vec4(finalCol, 1.0);
            }
        `
    });
}

(function buildHeliocentricSolarSystem() {
    const days = getDaysSinceJ2000();
    const earthHelio = computePlanetHeliocentricAU(JPL_PLANETS[2], days);
    const chipsContainer = document.getElementById('planet-chips');

    // Register Sun
    cosmosBodiesMap.set('Sun', {
        name: 'Sun', type: 'G2V Main-Sequence Star', obj: helioSun, radius: 2.4,
        statsHTML: `Earth Dist: ${earthHelio.rAU.toFixed(4)} AU &bull; Light-Time: ${(earthHelio.rAU * AU_KM / C_KM_MIN).toFixed(2)} min`
    });
    chipsContainer.innerHTML += `<button class="planet-chip active" data-body="Sun" onclick="focusCosmosBody('Sun')">☀️ Sun</button>`;

    JPL_PLANETS.forEach(p => {
        const res = computePlanetHeliocentricAU(p, days);
        const dir = res.vec.clone().normalize();
        const pos = dir.multiplyScalar(p.visDist);

        // Draw true inclined Keplerian orbital path ring
        const orbitPts = [];
        const I = p.I * Math.PI / 180, Omega = p.Omega * Math.PI / 180;
        for (let i = 0; i <= 128; i++) {
            const th = (i / 128) * Math.PI * 2;
            const rVis = p.visDist * (1 - p.e * p.e) / (1 + p.e * Math.cos(th));
            const x0 = Math.cos(th) * rVis, z0 = -Math.sin(th) * rVis;
            const yInc = Math.sin(th - Omega) * Math.sin(I) * rVis;
            orbitPts.push(new THREE.Vector3(x0, yInc, z0));
        }
        heliocentricGroup.add(new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(orbitPts),
            new THREE.LineBasicMaterial({ color: p.isEarth ? 0x38bdf8 : 0x475569, transparent: true, opacity: p.isEarth ? 0.55 : 0.28 })
        ));

        const pGroup = new THREE.Group();
        pGroup.position.copy(pos);

        const spinMesh = p.isEarth
            ? new THREE.Mesh(new THREE.SphereGeometry(p.visR, 32, 32), new THREE.MeshStandardMaterial({ map: earthDayTex, roughness: 0.6, metalness: 0.1 }))
            : new THREE.Mesh(new THREE.SphereGeometry(p.visR, 36, 36), createHelioPlanetMat(p.c1, p.c2, p.band, p.name === 'Mars', p.name === 'Neptune' || p.name === 'Uranus' ? 0x38bdf8 : (p.name === 'Venus' ? 0xfde68a : 0x000000)));
        spinMesh.rotation.z = (p.tilt || 0) * Math.PI / 180;
        pGroup.add(spinMesh);

        if (p.rings) {
            const ringMat = new THREE.ShaderMaterial({
                vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
                fragmentShader: `
                    varying vec3 vPos;
                    void main() {
                        float r = length(vPos.xy);
                        float t = clamp((r - 1.48) / 1.12, 0.0, 1.0);
                        float bands = 0.65 + 0.35 * sin(t * 42.0) * cos(t * 17.0);
                        float cassini = 1.0 - smoothstep(0.56, 0.60, t) * (1.0 - smoothstep(0.64, 0.68, t));
                        vec3 col = mix(vec3(0.68, 0.56, 0.42), vec3(0.95, 0.88, 0.72), bands);
                        float edgeFade = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.92, 1.0, t));
                        gl_FragColor = vec4(col, edgeFade * cassini * 0.78);
                    }
                `,
                transparent: true, side: THREE.DoubleSide, depthWrite: false
            });
            const ring = new THREE.Mesh(new THREE.RingGeometry(p.visR * 1.32, p.visR * 2.32, 72), ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.rotation.y = (p.tilt || 26.73) * Math.PI / 180;
            pGroup.add(ring);
        }

        // Build 3D Natural Satellites (Moons) & Orbital Rings for every planet
        const moonEntries = [];
        if (p.moons && p.moons.length > 0) {
            p.moons.forEach((m, mIdx) => {
                const mOrbitPts = [];
                for (let j = 0; j <= 48; j++) {
                    const a = (j / 48) * Math.PI * 2;
                    mOrbitPts.push(new THREE.Vector3(Math.cos(a) * m.dist, 0, -Math.sin(a) * m.dist));
                }
                pGroup.add(new THREE.LineLoop(
                    new THREE.BufferGeometry().setFromPoints(mOrbitPts),
                    new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.25 })
                ));
                const mMesh = new THREE.Mesh(
                    new THREE.SphereGeometry(m.r, 18, 18),
                    new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.85, metalness: 0.08 })
                );
                const phase = ((days / m.period) * Math.PI * 2) + mIdx * 1.3;
                mMesh.position.set(Math.cos(phase) * m.dist, 0, -Math.sin(phase) * m.dist);
                pGroup.add(mMesh);
                moonEntries.push({ mesh: mMesh, dist: m.dist, period: m.period, seed: mIdx * 1.3 });
            });
        }

        heliocentricGroup.add(pGroup);

        const distFromEarthAU = res.vec.distanceTo(earthHelio.vec);
        const distFromEarthMkm = (distFromEarthAU * AU_KM / 1e6).toFixed(1);
        const lightMin = (distFromEarthAU * AU_KM / C_KM_MIN).toFixed(1);
        const statsHTML = p.isEarth
            ? `Sun: ${res.rAU.toFixed(3)} AU &bull; ${res.vKps.toFixed(2)} km/s`
            : `Sun: ${res.rAU.toFixed(2)} AU &bull; ${distFromEarthMkm}M km (${lightMin} lm)`;

        cosmosBodiesMap.set(p.name, { name: p.name, type: p.type, obj: pGroup, spinMesh, moons: moonEntries, meta: p, radius: p.visR, statsHTML });
        chipsContainer.innerHTML += `<button class="planet-chip" data-body="${p.name}" onclick="focusCosmosBody('${p.name}')">${p.name}</button>`;
    });

    // Main Asteroid Belt between Mars (15.2) and Jupiter (23.0)
    const beltCount = 1200;
    const beltPos = new Float32Array(beltCount * 3);
    for (let i = 0; i < beltCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 17.5 + Math.random() * 3.4;
        beltPos[i*3] = Math.cos(a) * r;
        beltPos[i*3+1] = (Math.random() - 0.5) * 0.7;
        beltPos[i*3+2] = -Math.sin(a) * r;
    }
    const beltGeo = new THREE.BufferGeometry();
    beltGeo.setAttribute('position', new THREE.BufferAttribute(beltPos, 3));
    const asteroidSpriteTex = createCircleSpriteTexture('rgba(203,213,225,0.9)', 'rgba(100,116,139,0.2)');
    heliocentricGroup.add(new THREE.Points(beltGeo, new THREE.PointsMaterial({
        color: 0x94a3b8, size: 0.28, map: asteroidSpriteTex, transparent: true, opacity: 0.65, depthWrite: false
    })));

    // Outer Kuiper Belt (1,000 Icy Bodies beyond Neptune)
    const kuiperCount = 1000;
    const kuiperPos = new Float32Array(kuiperCount * 3);
    for (let i = 0; i < kuiperCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 51.0 + Math.random() * 11.0;
        kuiperPos[i*3] = Math.cos(a) * r;
        kuiperPos[i*3+1] = (Math.random() - 0.5) * 1.8;
        kuiperPos[i*3+2] = -Math.sin(a) * r;
    }
    const kuiperGeo = new THREE.BufferGeometry();
    kuiperGeo.setAttribute('position', new THREE.BufferAttribute(kuiperPos, 3));
    heliocentricGroup.add(new THREE.Points(kuiperGeo, new THREE.PointsMaterial({
        color: 0x7dd3fc, size: 0.34, map: asteroidSpriteTex, transparent: true, opacity: 0.42, depthWrite: false
    })));

    // Habitable (Goldilocks) Zone Ring around Earth's orbit (r = 10.2 to 13.4)
    const hzRing = new THREE.Mesh(
        new THREE.RingGeometry(10.2, 13.4, 96),
        new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.08, depthWrite: false })
    );
    hzRing.rotation.x = Math.PI / 2;
    heliocentricGroup.add(hzRing);

    // Outer Oort Cloud Spherical Shell (r = 72 to 92)
    const oortCount = 700;
    const oortPos = new Float32Array(oortCount * 3);
    for (let i = 0; i < oortCount; i++) {
        const r = 72 + Math.random() * 20;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        oortPos[i*3] = r * Math.sin(ph) * Math.cos(th);
        oortPos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
        oortPos[i*3+2] = r * Math.cos(ph);
    }
    const oortGeo = new THREE.BufferGeometry();
    oortGeo.setAttribute('position', new THREE.BufferAttribute(oortPos, 3));
    heliocentricGroup.add(new THREE.Points(oortGeo, new THREE.PointsMaterial({
        color: 0x93c5fd, size: 0.42, map: asteroidSpriteTex, transparent: true, opacity: 0.28, depthWrite: false
    })));

    // Major Dwarf Planets & Deep-Space Probe
    const EXTRA_SOLAR = [
        { name: 'Ceres', wikiTitle: 'Ceres_(dwarf_planet)', type: 'Main Belt Dwarf Planet', visR: 0.22, pos: new THREE.Vector3(-14.5, 0.9, 12.2), color: 0x94a3b8,
          statsHTML: 'Sun: 2.77 AU &bull; Main Asteroid Belt', a: 2.77, e: 0.076, I: 10.6, L0: 95, LRate: 7800, wBar: 73, Omega: 80, tilt: 4, radiusKm: 473, gravity: 0.28, escapeKps: 0.51, temp: '-105 °C', dayLen: '9h 04m', atmo: 'Transient Water Vapor Exosphere', moonCount: 0, moons: [] },
        { name: 'Pluto', wikiTitle: 'Pluto', type: 'Kuiper Belt Dwarf Planet', visR: 0.28, pos: new THREE.Vector3(36.0, 6.2, 41.5), color: 0xd6b59c,
          statsHTML: 'Sun: 39.48 AU &bull; Kuiper Belt', a: 39.48, e: 0.249, I: 17.16, L0: 238, LRate: 145, wBar: 224, Omega: 110, tilt: 122.5, radiusKm: 1188, gravity: 0.62, escapeKps: 1.21, temp: '-229 °C', dayLen: '6.39d (Retro)', atmo: 'Thin N₂, CH₄, CO Atmosphere', moonCount: 5, moons: [{ name: 'Charon', r: 0.08, dist: 0.55, period: 6.39, color: 0x94a3b8 }] },
        { name: 'Eris', wikiTitle: 'Eris_(dwarf_planet)', type: 'Scattered Disc Dwarf Planet', visR: 0.27, pos: new THREE.Vector3(-46.0, -14.0, -38.0), color: 0xe2e8f0,
          statsHTML: 'Sun: 67.86 AU &bull; Scattered Disc', a: 67.86, e: 0.436, I: 44.04, L0: 205, LRate: 64, wBar: 151, Omega: 36, tilt: 78, radiusKm: 1163, gravity: 0.82, escapeKps: 1.38, temp: '-243 °C', dayLen: '25.9h', atmo: 'Frozen Methane Surface', moonCount: 1, moons: [{ name: 'Dysnomia', r: 0.06, dist: 0.52, period: 15.79, color: 0xcbd5e1 }] },
        { name: 'Voyager 1', wikiTitle: 'Voyager_1', type: 'Interstellar Space Probe', visR: 0.22, pos: new THREE.Vector3(58.0, 26.0, -28.0), color: 0xfbbf24,
          statsHTML: 'Sun: ~165 AU &bull; Interstellar Space', a: 165.0, e: 0.0, I: 35.0, L0: 255, LRate: 0, wBar: 0, Omega: 0, tilt: 0, radiusKm: 0.003, gravity: 0, escapeKps: 0, temp: '-270 °C', dayLen: 'Launched 1977', atmo: 'Interstellar Medium (Beyond Heliopause)', moonCount: 0, moons: [] }
    ];

    EXTRA_SOLAR.forEach(item => {
        const g = new THREE.Group();
        g.position.copy(item.pos);
        const m = new THREE.Mesh(
            new THREE.SphereGeometry(item.visR, 20, 20),
            new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.7, metalness: 0.15 })
        );
        g.add(m);
        heliocentricGroup.add(g);
        cosmosBodiesMap.set(item.name, { name: item.name, type: item.type, obj: g, spinMesh: m, moons: [], meta: item, radius: item.visR, statsHTML: item.statsHTML });
        chipsContainer.innerHTML += `<button class="planet-chip" data-body="${item.name}" onclick="focusCosmosBody(this.dataset.body)">${item.name}</button>`;
    });

    // --- PHOTOREALISTIC COMET 1P/HALLEY (JPL J2000 RETROGRADE ORBIT + GIOTTO NUCLEUS + FLOWING DUAL TAILS) ---
    const halleyOrbitPts = [];
    for (let i = 0; i <= 320; i++) {
        const E = (i / 320) * Math.PI * 2;
        halleyOrbitPts.push(computeHalleyAtEccentricAnomaly(E).visPos);
    }
    heliocentricGroup.add(new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(halleyOrbitPts),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.26 })
    ));

    const halleyGroup = new THREE.Group();
    const halleyInit = computeHalleyState(days);
    halleyGroup.position.copy(halleyInit.visPos);

    // 1. Giotto/Rosetta-Grade Craggy Bilobed Carbonaceous Nucleus (15 x 8 km irregular peanut)
    const nucGeo = new THREE.IcosahedronGeometry(0.115, 4);
    const nPos = nucGeo.attributes.position;
    for (let i = 0; i < nPos.count; i++) {
        const vx = nPos.getX(i), vy = nPos.getY(i), vz = nPos.getZ(i);
        // Bilobed peanut silhouette + multi-frequency rock ridges & crater depressions
        const pinch = 1.0 - 0.28 * Math.exp(-vx * vx * 220.0);
        const crag = 1.0
            + 0.16 * Math.sin(vx * 32.0 + vy * 18.0) * Math.cos(vz * 26.0)
            + 0.09 * Math.sin(vy * 54.0 - vz * 42.0)
            + 0.05 * Math.cos(vx * 78.0 + vz * 65.0);
        nPos.setXYZ(i, vx * 1.48 * crag, vy * 0.84 * pinch * crag, vz * 0.90 * pinch * crag);
    }
    nucGeo.computeVertexNormals();

    const halleyNucleusMat = new THREE.ShaderMaterial({
        uniforms: { uTime: solarTimeUniform, uActivity: { value: 0.55 } },
        vertexShader: `
            varying vec3 vNormal; varying vec3 vLocal; varying vec3 vWorldPos;
            void main() {
                vLocal = position;
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vWorldPos = wp.xyz;
                vNormal = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * wp;
            }
        `,
        fragmentShader: `
            uniform float uTime; uniform float uActivity;
            varying vec3 vNormal; varying vec3 vLocal; varying vec3 vWorldPos;

            float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
            float noise(vec3 x) {
                vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                    mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z
                );
            }
            float fbm(vec3 p) {
                float v = 0.0, a = 0.5;
                for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.15; a *= 0.5; }
                return v;
            }
            void main() {
                vec3 N = normalize(vNormal);
                vec3 L = normalize(-vWorldPos); // Sun is at world origin (0,0,0)
                vec3 V = normalize(cameraPosition - vWorldPos);

                float rock = fbm(vLocal * 38.0);
                float craters = smoothstep(0.32, 0.68, noise(vLocal * 75.0));
                // Real Halley nucleus has ultra-dark charcoal-carbonaceous crust with bright icy sublimation fissures
                vec3 darkCrust = vec3(0.055, 0.062, 0.078);
                vec3 dustyGrey = vec3(0.22, 0.24, 0.28);
                vec3 iceFissure = vec3(0.78, 0.94, 1.0);

                float lit = max(dot(N, L), 0.0);
                float ventMask = smoothstep(0.68, 0.84, rock) * smoothstep(0.25, 0.85, lit);
                vec3 baseCol = mix(darkCrust, dustyGrey, rock * 0.75 + craters * 0.25);
                vec3 col = baseCol * (0.10 + 1.15 * lit);
                // Glowing sunlit outgassing ice vents
                col += iceFissure * ventMask * (0.45 + 0.65 * uActivity);
                // Subtle sunlit coma rim scattering
                float rim = pow(1.0 - max(dot(N, V), 0.0), 2.8) * smoothstep(-0.15, 0.7, dot(N, L));
                col += vec3(0.42, 0.84, 1.0) * rim * (0.35 + 0.45 * uActivity);

                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
    const halleyNucleus = new THREE.Mesh(nucGeo, halleyNucleusMat);
    halleyGroup.add(halleyNucleus);

    // 2. Multi-Layered Photorealistic Coma (Sharp sunlit core + dusty inner glow + expansive cyan-blue H2 envelope)
    const halleyComaCore = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createCircleSpriteTexture('rgba(255,255,255,0.98)', 'rgba(186,230,253,0.42)'),
        transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halleyComaCore.scale.set(0.46, 0.46, 1);
    halleyGroup.add(halleyComaCore);

    const halleyComaInner = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createCircleSpriteTexture('rgba(254,249,235,0.62)', 'rgba(125,211,252,0.18)'),
        transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halleyComaInner.scale.set(1.05, 1.05, 1);
    halleyGroup.add(halleyComaInner);

    const halleyComaOuter = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createCircleSpriteTexture('rgba(56,189,248,0.34)', 'rgba(14,165,233,0.0)'),
        transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halleyComaOuter.scale.set(2.4, 2.4, 1);
    halleyGroup.add(halleyComaOuter);

    // Helper: 3-Axis Volumetric Tail Plume (0°, 60°, 120° crossed GLSL ribbons — silky from EVERY 3D angle!)
    function createVolumetricTailRibbon(length, width, colorCoreHex, colorEdgeHex, curveStrength, raySharpness) {
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: solarTimeUniform,
                uColCore: { value: new THREE.Color(colorCoreHex) },
                uColEdge: { value: new THREE.Color(colorEdgeHex) },
                uIntensity: { value: 0.65 },
                uCurve: { value: curveStrength },
                uSharp: { value: raySharpness }
            },
            vertexShader: `
                varying vec2 vUv;
                uniform float uCurve;
                void main() {
                    vUv = uv;
                    vec3 p = position;
                    // Parabolic radiation-pressure sweep for dust tail
                    p.y += uCurve * uv.x * uv.x;
                    // Smooth natural flare from tight coma out into deep space
                    float flare = 0.16 + 1.35 * pow(uv.x, 0.78);
                    p.y *= flare;
                    p.z *= flare;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                uniform float uTime;
                uniform vec3 uColCore;
                uniform vec3 uColEdge;
                uniform float uIntensity;
                uniform float uSharp;

                float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
                float noise(vec2 p) {
                    vec2 i = floor(p), f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
                }
                float fbm(vec2 p) {
                    float v = 0.0, a = 0.5;
                    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.05; a *= 0.5; }
                    return v;
                }
                void main() {
                    float along = vUv.x;
                    float across = abs(vUv.y - 0.5) * 2.0;

                    // Soft Gaussian cross-section (zero geometric seam)
                    float crossFade = exp(-across * across * uSharp) * (1.0 - smoothstep(0.72, 1.0, across));
                    // Smooth emergence from coma + long delicate fade into space
                    float lengthFade = smoothstep(0.0, 0.055, along) * pow(1.0 - along, 1.85);

                    // Fine longitudinal solar-wind plasma streamers & wispy dust bands
                    float streamers = fbm(vec2(along * 4.5 - uTime * 1.1, vUv.y * 18.0));
                    float fineRays  = noise(vec2(along * 11.0 - uTime * 2.2, vUv.y * 36.0));
                    float wisps = 0.45 + 0.55 * (streamers * 0.68 + fineRays * 0.32);

                    vec3 col = mix(uColCore, uColEdge, smoothstep(0.04, 0.68, along + across * 0.32));
                    float alpha = crossFade * lengthFade * wisps * uIntensity;
                    gl_FragColor = vec4(col, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const group = new THREE.Group();
        [0, Math.PI / 3, (2 * Math.PI) / 3].forEach(rotX => {
            const geo = new THREE.PlaneGeometry(length, width, 28, 1);
            geo.translate(length / 2, 0, 0);
            geo.rotateX(rotX);
            group.add(new THREE.Mesh(geo, mat));
        });
        return { group, mat };
    }

    // 3. Type I Ion (Plasma) Tail — Straight Anti-Solar Electric-Blue Filamentary Streamers + Live Flowing Particles
    const ionTail = createVolumetricTailRibbon(8.2, 0.72, 0xf0f9ff, 0x0284c7, 0.0, 6.2);
    const ionPartCount = 260;
    const ionPartPos = new Float32Array(ionPartCount * 3);
    const ionPartMeta = [];
    for (let i = 0; i < ionPartCount; i++) {
        const prog = Math.random();
        const speed = 0.22 + Math.random() * 0.35;
        const angle = Math.random() * Math.PI * 2;
        const radScale = 0.05 + Math.random() * 0.24;
        ionPartMeta.push({ prog, speed, angle, radScale });
        const x = prog * 7.8;
        const r = radScale * (0.18 + prog * 1.15);
        ionPartPos[i*3] = x;
        ionPartPos[i*3+1] = Math.cos(angle) * r;
        ionPartPos[i*3+2] = Math.sin(angle) * r;
    }
    const ionPartGeo = new THREE.BufferGeometry();
    ionPartGeo.setAttribute('position', new THREE.BufferAttribute(ionPartPos, 3));
    const ionParticles = new THREE.Points(ionPartGeo, new THREE.PointsMaterial({
        color: 0x7dd3fc, size: 0.14, map: asteroidSpriteTex, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    ionTail.group.add(ionParticles);
    halleyGroup.add(ionTail.group);

    // 4. Type II Dust Tail — Broad, Silky Curved Golden-White Fan + Live Drifting Dust Motes
    const dustTail = createVolumetricTailRibbon(6.4, 1.55, 0xfffbeb, 0xf59e0b, 0.85, 3.8);
    const dustPartCount = 200;
    const dustPartPos = new Float32Array(dustPartCount * 3);
    const dustPartMeta = [];
    for (let i = 0; i < dustPartCount; i++) {
        const prog = Math.random();
        const speed = 0.11 + Math.random() * 0.18;
        const angle = Math.random() * Math.PI * 2;
        const radScale = 0.08 + Math.random() * 0.42;
        dustPartMeta.push({ prog, speed, angle, radScale });
        const x = prog * 6.0;
        const r = radScale * (0.2 + prog * 1.25);
        dustPartPos[i*3] = x;
        dustPartPos[i*3+1] = 0.85 * prog * prog + Math.cos(angle) * r;
        dustPartPos[i*3+2] = Math.sin(angle) * r;
    }
    const dustPartGeo = new THREE.BufferGeometry();
    dustPartGeo.setAttribute('position', new THREE.BufferAttribute(dustPartPos, 3));
    const dustParticles = new THREE.Points(dustPartGeo, new THREE.PointsMaterial({
        color: 0xfef3c7, size: 0.17, map: asteroidSpriteTex, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    dustTail.group.add(dustParticles);
    halleyGroup.add(dustTail.group);

    // 5. Sun-Side Sublimation Outgassing Jet Plume (Erupts sunward from nucleus before sweeping back)
    const sunJet = createVolumetricTailRibbon(0.75, 0.34, 0xffffff, 0x7dd3fc, 0.0, 5.0);
    halleyGroup.add(sunJet.group);

    heliocentricGroup.add(halleyGroup);

    const halleyMeta = {
        name: "Halley's Comet", wikiTitle: "Halley's_Comet", type: '1P/Halley Periodic Comet (75.3 yrs)',
        visR: 0.38, isComet: true,
        a: HALLEY_ELEMENTS.a, e: HALLEY_ELEMENTS.e, I: HALLEY_ELEMENTS.I,
        tilt: 0, radiusKm: 5.5, gravity: 0.0005, escapeKps: 0.002, temp: '-70 °C (Active)', dayLen: '2.2d–7.4d (Tumbling)',
        atmo: 'Sublimating H₂O (80%), CO (10%), CO₂, CH₄ — Dual Ion & Dust Tails',
        moonCount: 0, moons: []
    };
    const halleyStatsHTML = `Sun: ${halleyInit.rAU.toFixed(2)} AU &bull; ${halleyInit.vKps.toFixed(2)} km/s &bull; Next Perihelion 2061`;

    cosmosBodiesMap.set("Halley's Comet", {
        name: "Halley's Comet", type: halleyMeta.type, obj: halleyGroup, spinMesh: halleyNucleus,
        moons: [], meta: halleyMeta, radius: 0.45, statsHTML: halleyStatsHTML,
        halleyRig: {
            nucleusMat: halleyNucleusMat,
            comaCore: halleyComaCore, comaInner: halleyComaInner, comaOuter: halleyComaOuter,
            ionTail, dustTail, sunJet,
            ionParticles, ionPartMeta, dustParticles, dustPartMeta
        }
    });
    chipsContainer.innerHTML += `<button class="planet-chip" data-body="Halley's Comet" onclick="focusCosmosBody(this.dataset.body)">☄️ Halley's Comet</button>`;
})();


// --- E2. VOLUMETRIC FBM MILKY WAY GALAXY (CONTINUOUS SPIRAL GAS + DARK DUST LANES + 55K STARS) ---
let milkyWayDiskGroup = new THREE.Group();
let solarSystemMarkerRing = null;
let solarSystemPinObj = null;
let andromedaGroupObj = new THREE.Group();

function gaussianRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

(function buildMilkyWay3D() {
    galaxyGroup.add(milkyWayDiskGroup);

    const gChips = document.getElementById('galaxy-chips');
    Object.keys(GALAXY_REGIONS).forEach((key, idx) => {
        gChips.innerHTML += `<button class="planet-chip ${idx === 0 ? 'active' : ''}" data-region="${key}" onclick="focusGalaxyRegion('${key}')">${key}</button>`;
    });

    // LAYER 1: CONTINUOUS VOLUMETRIC GALACTIC DISK SHADER (Eliminates dotty/grainy look!)
    // Renders smooth logarithmic spiral arms, warm galactic bar, pink H-II nebulae, and dark absorbing dust lanes
    const diskShaderMat = new THREE.ShaderMaterial({
        uniforms: { uTime: solarTimeUniform },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform float uTime;

            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
            float noise(vec2 p) {
                vec2 i = floor(p), f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
                    f.y
                );
            }
            float fbm(vec2 p) {
                float v = 0.0, a = 0.5;
                mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
                for (int i = 0; i < 3; i++) {
                    v += a * noise(p);
                    p = rot * p * 2.05;
                    a *= 0.5;
                }
                return v;
            }

            void main() {
                vec2 p = (vUv - 0.5) * 2.0;
                float r = length(p);
                if (r > 1.0) discard;

                float angle = atan(p.y, p.x);

                // Central 27-degree Galactic Bar + Gaussian Bulge
                float barAng = 0.47;
                vec2 bp = vec2(p.x * cos(barAng) - p.y * sin(barAng), p.x * sin(barAng) + p.y * cos(barAng));
                float bar = exp(- (bp.x * bp.x * 16.0 + bp.y * bp.y * 55.0));
                float bulge = exp(-r * r * 14.0);

                // 4 Logarithmic Spiral Arms (2 primary bright + 2 secondary)
                float logR = log(max(r, 0.025) * 8.5 + 1.0);
                float spiralPhase2 = angle * 2.0 - logR * 3.1;
                float spiralPhase4 = angle * 4.0 - logR * 6.2;

                // Domain-warped FBM turbulence for realistic interstellar gas clouds
                vec2 warp = vec2(fbm(p * 3.8 + 1.2), fbm(p * 3.8 - 2.4));
                float gas = fbm(p * 5.5 + warp * 1.15);
                float fineDust = fbm(p * 11.0 + warp * 1.6);

                float primaryArms = pow(0.5 + 0.5 * cos(spiralPhase2 + (gas - 0.5) * 1.4), 2.4);
                float secondaryArms = pow(0.5 + 0.5 * cos(spiralPhase4 + (gas - 0.5) * 1.1), 3.0) * 0.55;
                float arms = clamp(primaryArms + secondaryArms, 0.0, 1.0);

                // Dark absorbing dust lanes hugging the inner edge of the spiral arms
                float dustRidge = pow(0.5 + 0.5 * cos(spiralPhase2 + 0.65 + (fineDust - 0.5) * 1.6), 3.2);
                float dustMask = smoothstep(0.28, 0.78, dustRidge * fineDust) * smoothstep(0.08, 0.25, r) * (1.0 - smoothstep(0.65, 0.98, r));

                // Radial disk falloff
                float diskFalloff = smoothstep(1.0, 0.12, r) * (0.28 + 0.72 * arms);

                // Realistic Astrophysical Color Palette
                vec3 coreCol   = vec3(1.00, 0.93, 0.80);
                vec3 barCol    = vec3(0.98, 0.72, 0.42);
                vec3 armBlue   = vec3(0.36, 0.58, 0.98);
                vec3 armCyan   = vec3(0.65, 0.84, 1.00);
                vec3 h2Pink    = vec3(0.95, 0.34, 0.58);

                vec3 col = mix(armBlue, armCyan, gas) * diskFalloff * (0.45 + 0.85 * gas);
                col += h2Pink * smoothstep(0.62, 0.86, fineDust) * arms * smoothstep(0.15, 0.35, r) * (1.0 - smoothstep(0.6, 0.9, r)) * 0.55;
                col = mix(col, barCol, clamp(bar * 0.85 + bulge * 0.55, 0.0, 1.0));
                col += coreCol * bulge * 1.15;

                // Apply dark dust lane absorption for high-contrast depth
                col *= (1.0 - dustMask * 0.72);

                float alpha = clamp(diskFalloff * (0.38 + 0.45 * gas) + bulge * 0.75 + bar * 0.45, 0.0, 0.92);
                alpha *= smoothstep(1.0, 0.78, r); // Seamless outer edge fade
                gl_FragColor = vec4(col, alpha * 0.82);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    // Stack 2 subtle volumetric planes for 3D thickness when viewed at oblique angles
    const diskGeo = new THREE.PlaneGeometry(58, 58, 1, 1);
    const mainDisk = new THREE.Mesh(diskGeo, diskShaderMat);
    mainDisk.rotation.x = -Math.PI / 2;
    milkyWayDiskGroup.add(mainDisk);

    // LAYER 2: 55,000 CRISP MULTI-SCALE STELLAR POPULATION STARS
    const starCount = 35000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    const colCore = new THREE.Color(0xfff5e4);
    const colBulge = new THREE.Color(0xfdba74);
    const colArmBlue = new THREE.Color(0x93c5fd);
    const colArmWhite = new THREE.Color(0xe0f2fe);
    const colNebula = new THREE.Color(0xf472b6);

    const numArms = 4;
    const maxR = 27.5;

    for (let i = 0; i < starCount; i++) {
        let x, y, z, col;
        const rnd = Math.random();

        if (rnd < 0.24) {
            // Soft 3D Gaussian Galactic Bulge & Bar
            const barAngle = 27 * Math.PI / 180;
            const localX = gaussianRandom() * 3.0;
            const localZ = gaussianRandom() * 1.75;
            x = localX * Math.cos(barAngle) - localZ * Math.sin(barAngle);
            z = localX * Math.sin(barAngle) + localZ * Math.cos(barAngle);
            const distC = Math.hypot(x, z);
            y = gaussianRandom() * (1.35 * Math.exp(-distC * 0.18) + 0.14);
            col = colCore.clone().lerp(colBulge, Math.min(1, distC / 6.5));
            sizes[i] = 0.42 + Math.random() * 0.72;
        } else if (rnd < 0.86) {
            // Stars tightly hugging the 4 logarithmic spiral arm ridges
            const armIdx = i % numArms;
            const r = 1.8 + Math.pow(Math.random(), 1.15) * (maxR - 1.8);
            const spinAngle = Math.log(r * 0.31 + 1.0) * 3.1;
            const armAngle = (armIdx / numArms) * Math.PI * 2 + spinAngle;
            const spread = gaussianRandom() * (0.24 + r * 0.012);
            const angle = armAngle + spread;

            x = Math.cos(angle) * r;
            z = Math.sin(angle) * r;
            y = gaussianRandom() * (0.42 * Math.exp(-r * 0.07) + 0.12);

            const tCol = Math.min(1, r / maxR);
            if (Math.random() < 0.028 && r > 5 && r < 22) {
                col = colNebula;
                sizes[i] = 0.95 + Math.random() * 1.1;
            } else {
                col = colBulge.clone().lerp(Math.random() < 0.55 ? colArmBlue : colArmWhite, Math.pow(tCol, 0.6));
                sizes[i] = 0.34 + Math.random() * 0.68;
            }
        } else {
            // Diffuse Stellar Halo & Globular Clusters
            const r = Math.pow(Math.random(), 0.85) * maxR;
            const a = Math.random() * Math.PI * 2;
            x = Math.cos(a) * r;
            z = Math.sin(a) * r;
            y = gaussianRandom() * (1.6 * Math.exp(-r * 0.06) + 0.45);
            col = colBulge.clone().lerp(colArmWhite, Math.min(1, r / maxR));
            sizes[i] = 0.28 + Math.random() * 0.45;
        }

        positions[i*3] = x;
        positions[i*3+1] = y;
        positions[i*3+2] = z;
        colors[i*3] = col.r;
        colors[i*3+1] = col.g;
        colors[i*3+2] = col.b;
    }

    const galGeo = new THREE.BufferGeometry();
    galGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    galGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    galGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const galMat = new THREE.ShaderMaterial({
        uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.75) } },
        vertexShader: `
            attribute float aSize;
            varying vec3 vColor;
            varying float vDist;
            uniform float uPixelRatio;
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vDist = -mvPosition.z;
                gl_PointSize = clamp(aSize * uPixelRatio * (82.0 / max(vDist, 1.5)), 1.0, 9.0);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vDist;
            void main() {
                float d = length(gl_PointCoord - vec2(0.5));
                if (d > 0.5) discard;
                float core = exp(-d * d * 22.0);
                float halo = pow(max(0.0, 1.0 - d * 2.0), 2.4) * 0.55;
                float alpha = clamp(core + halo, 0.0, 1.0) * smoothstep(0.8, 3.0, vDist);
                gl_FragColor = vec4(vColor, alpha * 0.85);
            }
        `,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    milkyWayDiskGroup.add(new THREE.Points(galGeo, galMat));

    // LAYER 3: SAGITTARIUS A* RADIANT CORE
    const sgrCore = new THREE.Sprite(new THREE.SpriteMaterial({
        map: sunGlowTex, color: 0xffedd5, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sgrCore.scale.set(12.0, 12.0, 1);
    milkyWayDiskGroup.add(sgrCore);

    // Solar System Pinpoint at 26,670 ly (13.335 units from Sgr A*) + Galactic Orbit Ring
    const sunGalR = 13.335;
    const sunOrbitPts = [];
    for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        sunOrbitPts.push(new THREE.Vector3(Math.cos(a) * sunGalR, 0, Math.sin(a) * sunGalR));
    }
    milkyWayDiskGroup.add(new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(sunOrbitPts),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.28 })
    ));

    solarSystemPinObj = new THREE.Group();
    solarSystemPinObj.position.set(sunGalR, 0, 0);
    // Photorealistic G2V Sun star + soft Local Bubble nebula glow (no geometric flat rings!)
    const galSunCore = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createCircleSpriteTexture('rgba(255,253,240,1.0)', 'rgba(253,224,71,0.55)'),
        transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    galSunCore.scale.set(0.42, 0.42, 1);
    solarSystemPinObj.add(galSunCore);
    const localBubbleGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createCircleSpriteTexture('rgba(125,211,252,0.45)', 'rgba(56,189,248,0.0)'),
        transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    localBubbleGlow.scale.set(1.35, 1.35, 1);
    solarSystemPinObj.add(localBubbleGlow);
    milkyWayDiskGroup.add(solarSystemPinObj);
    solarSystemMarkerRing = localBubbleGlow;

    // --- NON-ROTATING LOCAL GROUP: VOLUMETRIC + 4,000-STAR ANDROMEDA (M31) ---
    andromedaGroupObj.position.set(55, 16, -65);
    andromedaGroupObj.rotation.set(0.95, 0.4, 0.35);

    const m31Disk = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), diskShaderMat);
    m31Disk.rotation.x = -Math.PI / 2;
    andromedaGroupObj.add(m31Disk);

    const m31Count = 4000;
    const m31Pos = new Float32Array(m31Count * 3);
    const m31Col = new Float32Array(m31Count * 3);
    const m31Sizes = new Float32Array(m31Count);
    for (let i = 0; i < m31Count; i++) {
        const arm = i % 2;
        const r = Math.pow(Math.random(), 1.3) * 11.5;
        const angle = arm * Math.PI + r * 0.42 + gaussianRandom() * 0.32;
        m31Pos[i*3] = Math.cos(angle) * r;
        m31Pos[i*3+1] = gaussianRandom() * (0.42 * Math.exp(-r * 0.15) + 0.08);
        m31Pos[i*3+2] = Math.sin(angle) * r;
        const c = colCore.clone().lerp(new THREE.Color(0xa5b4fc), Math.min(1, r / 10.5));
        m31Col[i*3] = c.r; m31Col[i*3+1] = c.g; m31Col[i*3+2] = c.b;
        m31Sizes[i] = 0.4 + Math.random() * 0.7;
    }
    const m31Geo = new THREE.BufferGeometry();
    m31Geo.setAttribute('position', new THREE.BufferAttribute(m31Pos, 3));
    m31Geo.setAttribute('color', new THREE.BufferAttribute(m31Col, 3));
    m31Geo.setAttribute('aSize', new THREE.BufferAttribute(m31Sizes, 1));
    andromedaGroupObj.add(new THREE.Points(m31Geo, galMat));

    const m31Core = new THREE.Sprite(new THREE.SpriteMaterial({
        map: sunGlowTex, color: 0xe0e7ff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    m31Core.scale.set(7.0, 7.0, 1);
    andromedaGroupObj.add(m31Core);
    galaxyGroup.add(andromedaGroupObj);

    // Extra Galactic Landmarks: Orion Nebula (M42), Pillars of Creation (M16), Alpha Centauri, LMC & Triangulum (M33)
    const galLandmarks = [
        { name: 'Orion Nebula',        pos: [14.6, -0.2, 2.2], color: 0xf472b6, size: 1.8, parent: milkyWayDiskGroup, prio: 70 },
        { name: 'Pillars of Creation', pos: [10.2, 0.2, -3.2], color: 0xfb7185, size: 1.6, parent: milkyWayDiskGroup, prio: 68 },
        { name: 'Alpha Centauri',      pos: [13.6, 0.1, 0.5],  color: 0xfef08a, size: 0.9, parent: milkyWayDiskGroup, prio: 65 },
        { name: 'LMC',                 pos: [-32, -18, -36],   color: 0x7dd3fc, size: 5.5, parent: galaxyGroup,       prio: 82 },
        { name: 'Triangulum (M33)',    pos: [72, 24, -48],     color: 0xc084fc, size: 6.2, parent: galaxyGroup,       prio: 80 }
    ];
    galLandmarks.forEach(lm => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: sunGlowTex, color: lm.color, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        sp.position.set(lm.pos[0], lm.pos[1], lm.pos[2]);
        sp.scale.set(lm.size, lm.size, 1);
        lm.parent.add(sp);
        galLandmarkAnchors.push({ name: lm.name, obj: sp, prio: lm.prio });
    });
    // Add invisible anchor nodes on rotating disk for Perseus Arm & Scutum-Centaurus Arm
    [
        ['Perseus Arm', -14, 0.4, 10, 74],
        ['Scutum-Centaurus', 8.5, 0.4, -9.5, 72]
    ].forEach(([armName, x, y, z, prio]) => {
        const n = new THREE.Object3D();
        n.position.set(x, y, z);
        milkyWayDiskGroup.add(n);
        galLandmarkAnchors.push({ name: armName, obj: n, prio });
    });
})();


// --- E3. 3D COSMIC WEB, OBSERVABLE UNIVERSE (CMB HORIZON) & HYPOTHETICAL MULTIVERSE ---
let universeHomePin = null;
(function buildUniverse3D() {
    const uChips = document.getElementById('universe-chips');
    ['Cosmic Web', 'Laniakea', 'Virgo', 'Great Attractor', 'Shapley', 'Sloan Great Wall', 'Boötes Void', 'GN-z11', 'CMB Horizon'].forEach((key, idx) => {
        uChips.innerHTML += `<button class="planet-chip ${idx === 0 ? 'active' : ''}" data-region="${key}" onclick="focusUniverseRegion('${key}')">${key}</button>`;
    });

    const mChips = document.getElementById('multiverse-chips');
    Object.keys(MULTIVERSE_BUBBLES).forEach((key, idx) => {
        mChips.innerHTML += `<button class="planet-chip ${idx === 0 ? 'active' : ''}" data-bubble="${key}" onclick="focusMultiverseBubble('${key}')">${key}</button>`;
    });

    // 1. 3D Cosmic Web Nodes & Supercluster Filaments (Inside radius 34)
    const hubCount = 60;
    const hubs = [new THREE.Vector3(0, 0, 0)];
    for (let i = 1; i < hubCount; i++) {
        const r = 4.5 + Math.pow(Math.random(), 0.75) * 28.0;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        hubs.push(new THREE.Vector3(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph)));
    }

    const linePts = [];
    const webStarPositions = [];
    const webStarColors = [];
    const cGold = new THREE.Color(0xfdba74);
    const cCyan = new THREE.Color(0x7dd3fc);
    const cPurp = new THREE.Color(0xc084fc);

    for (let i = 0; i < hubs.length; i++) {
        for (let j = i + 1; j < hubs.length; j++) {
            const d = hubs[i].distanceTo(hubs[j]);
            if (d < 11.2) {
                linePts.push(hubs[i], hubs[j]);
                const steps = 15;
                for (let k = 0; k < steps; k++) {
                    const t = Math.random();
                    const px = hubs[i].x + (hubs[j].x - hubs[i].x) * t + gaussianRandom() * 0.65;
                    const py = hubs[i].y + (hubs[j].y - hubs[i].y) * t + gaussianRandom() * 0.65;
                    const pz = hubs[i].z + (hubs[j].z - hubs[i].z) * t + gaussianRandom() * 0.65;
                    if (Math.hypot(px, py, pz) < 33.5) {
                        webStarPositions.push(px, py, pz);
                        const c = Math.random() < 0.5 ? cGold : (Math.random() < 0.5 ? cCyan : cPurp);
                        webStarColors.push(c.r, c.g, c.b);
                    }
                }
            }
        }
    }

    const filGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    universeGroup.add(new THREE.LineSegments(filGeo, new THREE.LineBasicMaterial({
        color: 0xf59e0b, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false
    })));

    const webGeo = new THREE.BufferGeometry();
    webGeo.setAttribute('position', new THREE.Float32BufferAttribute(webStarPositions, 3));
    webGeo.setAttribute('color', new THREE.Float32BufferAttribute(webStarColors, 3));
    const webSprite = createCircleSpriteTexture('rgba(255,248,230,0.95)', 'rgba(251,146,60,0.28)');
    universeGroup.add(new THREE.Points(webGeo, new THREE.PointsMaterial({
        size: 0.72, map: webSprite, vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
    })));

    // Home Supercluster Anchor (Laniakea / Milky Way)
    universeHomePin = new THREE.Group();
    const uniMilkySprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createCircleSpriteTexture('rgba(255,250,235,1.0)', 'rgba(147,197,253,0.45)'),
        transparent: true, opacity: 0.96, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    uniMilkySprite.scale.set(0.95, 0.95, 1);
    universeHomePin.add(uniMilkySprite);
    const laniakeaHalo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createCircleSpriteTexture('rgba(251,191,36,0.38)', 'rgba(56,189,248,0.0)'),
        transparent: true, opacity: 0.68, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    laniakeaHalo.scale.set(2.6, 2.6, 1);
    universeHomePin.add(laniakeaHalo);
    universeGroup.add(universeHomePin);

    // Boötes Void — smooth dark cosmic void cloud
    const bootesVoid = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createCircleSpriteTexture('rgba(1,2,6,0.92)', 'rgba(15,23,42,0.0)'),
        transparent: true, opacity: 0.85, depthWrite: false
    }));
    bootesVoid.scale.set(7.5, 7.5, 1);
    bootesVoid.position.set(11.0, -6.5, 13.5);
    universeGroup.add(bootesVoid);
    uniLandmarkAnchors.push({ name: 'Boötes Void', region: 'Boötes Void', scale: 'UNIVERSE', obj: bootesVoid, prio: 86 });

    // Glowing markers for Virgo, Great Attractor, Shapley, Sloan Great Wall & GN-z11
    [
        ['Virgo',           4.5, 1.5, 3.0,    0x7dd3fc, 1.8, 84],
        ['Great Attractor', -6.2, -1.8, 4.5,  0xf59e0b, 2.2, 85],
        ['Shapley',         -12.5, 4.2, -9.5, 0xc084fc, 2.4, 82],
        ['Sloan Great Wall',16.0, 5.5, -14.0, 0xfdba74, 2.6, 80],
        ['GN-z11',          -21.0, 12.0, 20.0,0xf43f5e, 2.0, 78]
    ].forEach(([uName, x, y, z, col, sz, prio]) => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: sunGlowTex, color: col, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        sp.position.set(x, y, z);
        sp.scale.set(sz, sz, 1);
        universeGroup.add(sp);
        uniLandmarkAnchors.push({ name: uName, region: uName, scale: 'UNIVERSE', obj: sp, prio });
    });

    // 2. Fast, Lag-Free CMB Horizon Shell with Baked Vertex Anisotropy
    const cmbGeo = new THREE.SphereGeometry(36, 32, 24);
    const cmbPos = cmbGeo.attributes.position;
    const cmbCols = new Float32Array(cmbPos.count * 3);
    const cCold = new THREE.Color(0x1e40af);
    const cWarm = new THREE.Color(0xf59e0b);
    const cHot = new THREE.Color(0xfde68a);
    for (let i = 0; i < cmbPos.count; i++) {
        const vx = cmbPos.getX(i), vy = cmbPos.getY(i), vz = cmbPos.getZ(i);
        const w = 0.5 + 0.5 * Math.sin(vx * 0.16 + vy * 0.11) * Math.cos(vz * 0.14 - vy * 0.09);
        const col = w < 0.55 ? cCold.clone().lerp(cWarm, w / 0.55) : cWarm.clone().lerp(cHot, (w - 0.55) / 0.45);
        cmbCols[i*3] = col.r; cmbCols[i*3+1] = col.g; cmbCols[i*3+2] = col.b;
    }
    cmbGeo.setAttribute('color', new THREE.BufferAttribute(cmbCols, 3));
    universeGroup.add(new THREE.Mesh(cmbGeo, new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.13, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
    })));

    // 3. Surrounding Multiverse Pocket Universes — Lightweight Soft Nebula Sprites + Internal Galaxy Clusters (60 FPS on Mobile!)
    const bubbleCoords = [
        [88, 26, -52, 24, 0x38bdf8], [-84, -22, -62, 27, 0xc084fc],
        [52, -48, 76, 21, 0xf59e0b], [-60, 54, 58, 23, 0x34d399],
        [18, 78, -70, 20, 0xf472b6], [-96, 12, 34, 22, 0x60a5fa],
        [118, -28, -22, 28, 0xa78bfa], [-34, -88, -38, 24, 0xfb7185],
        [76, 64, 54, 22, 0x2dd4bf], [-110, 48, -76, 26, 0xfbbf24],
        [138, 54, -86, 30, 0x818cf8], [-142, -58, 50, 29, 0xf43f5e],
        [22, -108, -94, 26, 0x38bdf8], [-50, 108, -42, 27, 0xc084fc]
    ];
    const pocketWebPositions = [];
    const pocketWebColors = [];
    const namedBubbles = {
        '88,26,-52': 'Pocket α',
        '-84,-22,-62': 'Quantum Branch',
        '52,-48,76': 'Brane Bulk',
        '-60,54,58': 'High-Entropy'
    };

    const sharedPocketShellGeo = new THREE.SphereGeometry(1, 24, 18);
    const pocketFilamentPts = [];

    bubbleCoords.forEach(([x, y, z, r, hex]) => {
        // 1. Crisp, translucent horizon shell so every pocket universe is clearly readable as a distinct bubble,
        //    yet noticeably softer/more translucent than Our Universe's rich golden-blue CMB sphere!
        const pocketShell = new THREE.Mesh(sharedPocketShellGeo, new THREE.MeshBasicMaterial({
            color: hex, transparent: true, opacity: 0.11, side: THREE.FrontSide, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        pocketShell.position.set(x, y, z);
        pocketShell.scale.setScalar(r);
        universeGroup.add(pocketShell);

        // 2. Soft outer cosmic glow halo
        const bubbleAura = new THREE.Sprite(new THREE.SpriteMaterial({
            map: createCircleSpriteTexture('rgba(255,255,255,0.34)', 'rgba(148,163,184,0.0)'),
            color: hex, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        bubbleAura.position.set(x, y, z);
        bubbleAura.scale.set(r * 2.25, r * 2.25, 1);
        universeGroup.add(bubbleAura);

        // 3. Internal cosmic web galaxy nodes & filament strands inside each pocket universe
        const baseCol = new THREE.Color(hex);
        const localNodes = [];
        for (let k = 0; k < 44; k++) {
            const rr = Math.pow(Math.random(), 0.72) * (r * 0.80);
            const th = Math.random() * Math.PI * 2;
            const ph = Math.acos(2 * Math.random() - 1);
            const nx = x + rr * Math.sin(ph) * Math.cos(th);
            const ny = y + rr * Math.sin(ph) * Math.sin(th);
            const nz = z + rr * Math.cos(ph);
            pocketWebPositions.push(nx, ny, nz);
            if (k < 14) localNodes.push(new THREE.Vector3(nx, ny, nz));
            const c = baseCol.clone().lerp(new THREE.Color(0xffffff), 0.58);
            pocketWebColors.push(c.r, c.g, c.b);
        }
        for (let a = 0; a < localNodes.length; a++) {
            for (let b = a + 1; b < localNodes.length; b++) {
                if (localNodes[a].distanceTo(localNodes[b]) < r * 0.78) {
                    pocketFilamentPts.push(localNodes[a], localNodes[b]);
                }
            }
        }

        const bKey = `${x},${y},${z}`;
        if (namedBubbles[bKey]) {
            uniLandmarkAnchors.push({ name: namedBubbles[bKey], region: namedBubbles[bKey], scale: 'MULTIVERSE', obj: pocketShell, prio: 90 });
        }
    });

    if (pocketFilamentPts.length > 0) {
        universeGroup.add(new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(pocketFilamentPts),
            new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false })
        ));
    }

    const pWebGeo = new THREE.BufferGeometry();
    pWebGeo.setAttribute('position', new THREE.Float32BufferAttribute(pocketWebPositions, 3));
    pWebGeo.setAttribute('color', new THREE.Float32BufferAttribute(pocketWebColors, 3));
    universeGroup.add(new THREE.Points(pWebGeo, new THREE.PointsMaterial({
        size: 1.15, map: webSprite, vertexColors: true, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false
    })));
})();

// --- F. SPACE METEORS ---
const meteors = [];
function spawnMeteor() {
    if (!showMeteors || meteors.length >= 3) return;
    const start = new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 18, -10 - Math.random() * 25);
    const dir = new THREE.Vector3((Math.random() - 0.5) * 2, -0.4 - Math.random() * 0.8, (Math.random() - 0.5) * 2).normalize();
    const len = 1.2 + Math.random() * 1.8;
    const pts = [new THREE.Vector3(0, 0, 0), dir.clone().multiplyScalar(-len)];
    const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.95 })
    );
    line.position.copy(start);
    scene.add(line);
    meteors.push({ mesh: line, vel: dir.multiplyScalar(18 + Math.random() * 14), life: 1.0 });
}
setInterval(spawnMeteor, 2600);

// --- G. VISIBLE ORBIT LINE ---
let orbitLineMesh;
function drawOrbitLine() {
    if (orbitLineMesh) earthSystemGroup.remove(orbitLineMesh);
    const orbitPoints = [];
    const inclRad = orbitInclination * Math.PI / 180;
    for (let i = 0; i <= 200; i++) {
        const t = (i / 200) * Math.PI * 2;
        const r = orbitRadius * (1 - orbitEccentricity * orbitEccentricity) / (1 + orbitEccentricity * Math.cos(t));
        orbitPoints.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * Math.sin(inclRad) * r, Math.sin(t) * Math.cos(inclRad) * r));
    }
    orbitLineMesh = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(orbitPoints),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.32 })
    );
    orbitLineMesh.visible = !isGeoLocked && !isISSMode;
    earthSystemGroup.add(orbitLineMesh);
}
drawOrbitLine();

// --- H. REALISTIC PROPORTIONAL VK-TRACKER-01 SATELLITE ---
const vkSatGroup = new THREE.Group();
const foilMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.88, roughness: 0.22 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.18 });
const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });

const mainBus = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.09, 8), foilMat);
mainBus.rotation.x = Math.PI / 2; vkSatGroup.add(mainBus);
const radiator = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.01, 0.038), metalMat);
radiator.position.set(0, -0.024, -0.01); vkSatGroup.add(radiator);
const payloadBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.023, 0.044, 16), metalMat);
payloadBarrel.rotation.x = Math.PI / 2; payloadBarrel.position.z = 0.06; vkSatGroup.add(payloadBarrel);
const lensGlass = new THREE.Mesh(new THREE.CircleGeometry(0.015, 24), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
lensGlass.position.z = 0.083; vkSatGroup.add(lensGlass);
const thruster = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.024, 16), darkMetalMat);
thruster.rotation.x = Math.PI / 2; thruster.position.z = -0.056; vkSatGroup.add(thruster);
const dishParabolic = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.65, roughness: 0.25, side: THREE.DoubleSide })
);
dishParabolic.position.set(0, 0.04, 0.008); dishParabolic.rotation.x = -Math.PI / 3; vkSatGroup.add(dishParabolic);

function createVKSolarWing(side) {
    const wing = new THREE.Group();
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.26, 8), metalMat);
    strut.rotation.z = Math.PI / 2; strut.position.x = side * 0.13; wing.add(strut);
    const cellMat = new THREE.MeshStandardMaterial({ color: 0x0f2952, emissive: 0x071630, metalness: 0.78, roughness: 0.18, side: THREE.DoubleSide });
    const frameMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.22 });
    for (let i = 0; i < 4; i++) {
        const xPos = side * (0.058 + i * 0.052);
        const segGeo = new THREE.BoxGeometry(0.046, 0.002, 0.072);
        const panel = new THREE.Mesh(segGeo, cellMat); panel.position.x = xPos; wing.add(panel);
        const grid = new THREE.Mesh(segGeo, frameMat); grid.position.x = xPos; wing.add(grid);
    }
    return wing;
}
vkSatGroup.add(createVKSolarWing(-1));
vkSatGroup.add(createVKSolarWing(1));

const navBeaconRed = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
navBeaconRed.position.set(-0.25, 0, 0); vkSatGroup.add(navBeaconRed);
const navBeaconGreen = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8), new THREE.MeshBasicMaterial({ color: 0x10b981 }));
navBeaconGreen.position.set(0.25, 0, 0); vkSatGroup.add(navBeaconGreen);

vkSatGroup.scale.setScalar(vkScale);
earthSystemGroup.add(vkSatGroup);

// --- I. REALISTIC INTERNATIONAL SPACE STATION (ISS) 3D MODEL ---
const issGroup = new THREE.Group();
const issWhiteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.45, roughness: 0.35 });
const issTrussMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.3 });
const issSolarMat = new THREE.MeshStandardMaterial({ color: 0xb45309, emissive: 0x451a03, metalness: 0.75, roughness: 0.25, side: THREE.DoubleSide });
const issSolarGrid = new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true, transparent: true, opacity: 0.25 });

issGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.012, 0.012), issTrussMat));
const coreModules = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 16), issWhiteMat);
coreModules.rotation.x = Math.PI / 2; issGroup.add(coreModules);
const labModules = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 16), issWhiteMat);
labModules.rotation.z = Math.PI / 2; labModules.position.z = 0.045; issGroup.add(labModules);

const radL = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.002, 0.075), issWhiteMat);
radL.position.set(-0.09, 0.015, -0.04); issGroup.add(radL);
const radR = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.002, 0.075), issWhiteMat);
radR.position.set(0.09, 0.015, -0.04); issGroup.add(radR);

[-0.25, -0.18, 0.18, 0.25].forEach(xPos => {
    [-1, 1].forEach(zSide => {
        const wingGeo = new THREE.BoxGeometry(0.042, 0.002, 0.15);
        const wing = new THREE.Mesh(wingGeo, issSolarMat); wing.position.set(xPos, 0, zSide * 0.088); issGroup.add(wing);
        const grid = new THREE.Mesh(wingGeo, issSolarGrid); grid.position.set(xPos, 0, zSide * 0.088); issGroup.add(grid);
    });
});

issGroup.scale.setScalar(issScale);
issGroup.visible = false;
earthSystemGroup.add(issGroup);

let activeSpacecraft = vkSatGroup;

// --- PULSING 3D EVENT BEACONS ---
let markerMeshes = [];
let beaconRings = [];
let mapMarkers = [];
function renderIntelMarkers() {
    markerMeshes.forEach(m => earthMesh.remove(m));
    markerMeshes = [];
    beaconRings = [];
    mapMarkers.forEach(m => map.removeLayer(m));
    mapMarkers = [];

    liveIntelData.forEach(data => {
        const localPos = latLonToLocalEarthPosition(data.lat, data.lon, 1.0);
        let color = 0xef4444, hexColor = '#ef4444';
        if (data.type === 'eonet') { color = 0xf59e0b; hexColor = '#f59e0b'; }
        if (data.type === 'rw') { color = 0xd946ef; hexColor = '#d946ef'; }
        
        const beacon = new THREE.Group();
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.11, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82 }));
        pillar.position.y = 0.055; beacon.add(pillar);
        
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.022, 20), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.004; beacon.add(ring);
        beaconRings.push(ring);
        
        beacon.position.copy(localPos);
        beacon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), localPos.clone().normalize());
        earthMesh.add(beacon);
        markerMeshes.push(beacon);

        const mIcon = L.divIcon({ html: `<div style="width:14px;height:14px;background:${hexColor};border-radius:50%;border:2px solid white;box-shadow:0 0 10px ${hexColor};"></div>`, className: '', iconSize: [14, 14] });
        const m = L.marker([data.lat, data.lon], { icon: mIcon }).addTo(map);
        m.on('click', () => parkSatelliteAt(data.lat, data.lon));
        mapMarkers.push(m);
    });
}

// --- 2D LEAFLET MAP + RAINVIEWER RADAR & LIVE IR CLOUDS ---
const map = L.map('map-viewport', { zoomControl: false, attributionControl: false }).setView([20, 78], 3);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 17 }).addTo(map);
const satMarker = L.marker([0, 0], { icon: L.divIcon({ html: `<div style="width:16px;height:16px;background:#38bdf8;border-radius:50%;border:2px solid white;box-shadow:0 0 10px #38bdf8;"></div>`, className: '', iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(map);
const satCircle = L.circle([0, 0], { radius: 1056000, color: '#38bdf8', weight: 1, fillOpacity: 0.1 }).addTo(map);
map.on('click', e => parkSatelliteAt(e.latlng.lat, e.latlng.lng));

let rainRadarLayer = null;
async function toggleRainRadar() {
    isRainRadarOn = !isRainRadarOn;
    const btn = document.getElementById('btn-radar');
    const dot = document.getElementById('radar-dot');
    playSound('click');

    if (isRainRadarOn) {
        btn.classList.add('on-emerald');
        dot.classList.replace('bg-slate-500', 'bg-emerald-400');
        try {
            const rvData = await cachedFetchJSON('https://api.rainviewer.com/public/weather-maps.json', 300000);
            if (rvData && rvData.radar && rvData.radar.past && rvData.radar.past.length > 0) {
                const latest = rvData.radar.past[rvData.radar.past.length - 1];
                const tileUrl = `${rvData.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`;
                if (rainRadarLayer) map.removeLayer(rainRadarLayer);
                rainRadarLayer = L.tileLayer(tileUrl, { opacity: 0.65, maxNativeZoom: 7, maxZoom: 12 }).addTo(map);
                showToast('Live RainViewer Precipitation Radar Active');
            }
        } catch (e) { showToast('RainViewer Radar temporarily unavailable'); }
    } else {
        btn.classList.remove('on-emerald');
        dot.classList.replace('bg-emerald-400', 'bg-slate-500');
        if (rainRadarLayer) { map.removeLayer(rainRadarLayer); rainRadarLayer = null; }
        showToast('Rain Radar Disabled');
    }
}

let clouds2DLayer = null;
async function toggle2DClouds() {
    is2DCloudsOn = !is2DCloudsOn;
    const btn = document.getElementById('btn-2d-clouds');
    const dot = document.getElementById('clouds2d-dot');
    playSound('click');

    if (is2DCloudsOn) {
        btn.classList.add('on');
        dot.classList.replace('bg-slate-500', 'bg-sky-400');
        try {
            const rvData = await cachedFetchJSON('https://api.rainviewer.com/public/weather-maps.json', 300000);
            if (rvData && rvData.satellite && rvData.satellite.infrared && rvData.satellite.infrared.length > 0) {
                const latest = rvData.satellite.infrared[rvData.satellite.infrared.length - 1];
                const tileUrl = `${rvData.host}${latest.path}/256/{z}/{x}/{y}/0/0_0.png`;
                if (clouds2DLayer) map.removeLayer(clouds2DLayer);
                clouds2DLayer = L.tileLayer(tileUrl, { opacity: 0.58, maxNativeZoom: 7, maxZoom: 12 }).addTo(map);
                showToast('Live Satellite Infrared Clouds Active');
            }
        } catch (e) { showToast('Satellite Cloud feed temporarily unavailable'); }
    } else {
        btn.classList.remove('on');
        dot.classList.replace('bg-sky-400', 'bg-slate-500');
        if (clouds2DLayer) { map.removeLayer(clouds2DLayer); clouds2DLayer = null; }
        showToast('2D Satellite Clouds Disabled');
    }
}

// --- VOLUMETRIC GRADIENT SCAN BEAM ---
let coneMesh, ringMesh;
const coneShaderMat = new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
        varying vec2 vUv;
        void main() {
            float grad = smoothstep(0.0, 0.85, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
            gl_FragColor = vec4(0.22, 0.74, 0.97, 0.04 + 0.14 * grad);
        }
    `,
    transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
});

function buildLaser() {
    if (coneMesh) earthSystemGroup.remove(coneMesh);
    if (ringMesh) earthSystemGroup.remove(ringMesh);

    const angularRad = swathRadius;
    const surfaceCircleRadius = Math.sin(angularRad) * 1.004;
    const surfaceZDist = Math.cos(angularRad) * 1.004;

    const cGeo = new THREE.ConeGeometry(surfaceCircleRadius, Math.max(0.1, orbitRadius - surfaceZDist), 48, 1, true);
    cGeo.translate(0, -Math.max(0.1, orbitRadius - surfaceZDist) / 2, 0);
    cGeo.rotateX(-Math.PI / 2);
    coneMesh = new THREE.Mesh(cGeo, coneShaderMat);
    coneMesh.visible = showLaserCone;
    earthSystemGroup.add(coneMesh);

    const ringPts = [];
    for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        ringPts.push(new THREE.Vector3(Math.cos(a) * surfaceCircleRadius, Math.sin(a) * surfaceCircleRadius, surfaceZDist));
    }
    ringMesh = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(ringPts),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
    );
    ringMesh.visible = showLaserCone;
    earthSystemGroup.add(ringMesh);
    earthUniforms.satSpotCos.value = Math.cos(angularRad);
}
buildLaser();

// --- MULTI-TOUCH SAFE DOUBLE-TAP RAYCASTER + AUTO-CANCEL FLY ---
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const activePointers = new Map();
let gestureWasMultiTouch = false;
let lastCleanTapTime = 0, lastCleanTapX = 0, lastCleanTapY = 0;

renderer.domElement.addEventListener('pointerdown', (e) => {
    flyAnim = null; // User touch immediately takes control!
    if (scaleAnim && scaleAnim.stages[scaleAnim.stageIdx].kind === 'ARRIVE') {
        scaleAnim = null;
        resetAllGroupScales();
    }
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: false });
    if (activePointers.size > 1) gestureWasMultiTouch = true;
});

renderer.domElement.addEventListener('pointermove', (e) => {
    const p = activePointers.get(e.pointerId);
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) p.moved = true;
});

renderer.domElement.addEventListener('pointerup', (e) => {
    const p = activePointers.get(e.pointerId);
    activePointers.delete(e.pointerId);

    if (!isSolarSystemView && !isGalaxyView && !isUniverseView && !isMultiverseView && !gestureWasMultiTouch && p && !p.moved && activePointers.size === 0) {
        const now = Date.now();
        const dist = Math.hypot(e.clientX - lastCleanTapX, e.clientY - lastCleanTapY);
        if (now - lastCleanTapTime < 300 && dist < 32) {
            pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
            pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObject(earthMesh);
            if (hits.length > 0) {
                const coords = worldPositionToLatLon(hits[0].point, earthMesh.rotation.y);
                parkSatelliteAt(coords.lat, coords.lon);
                showToast(`3D Lock: ${coords.lat.toFixed(2)}°, ${coords.lon.toFixed(2)}°`);
            }
            lastCleanTapTime = 0;
        } else {
            lastCleanTapTime = now; lastCleanTapX = e.clientX; lastCleanTapY = e.clientY;
        }
    }
    if (activePointers.size === 0) gestureWasMultiTouch = false;
});

renderer.domElement.addEventListener('pointercancel', (e) => {
    activePointers.delete(e.pointerId);
    if (activePointers.size === 0) gestureWasMultiTouch = false;
});

// --- SETTINGS & SLIDER HANDLERS ---
function updateVKScale(val) {
    vkScale = parseFloat(val);
    vkSatGroup.scale.setScalar(vkScale);
    document.getElementById('vk-scale-val').textContent = `${vkScale.toFixed(2)}x ${vkScale <= 0.6 ? '(Realistic)' : '(Magnified)'}`;
}

function updateISSScale(val) {
    issScale = parseFloat(val);
    issGroup.scale.setScalar(issScale);
    document.getElementById('iss-scale-val').textContent = `${issScale.toFixed(2)}x ${issScale <= 0.7 ? '(Realistic)' : '(Magnified)'}`;
}

function toggleClouds() {
    showClouds = !showClouds;
    cloudMesh.visible = showClouds;
    const btn = document.getElementById('btn-toggle-clouds');
    btn.textContent = `3D Clouds: ${showClouds ? 'ON' : 'OFF'}`;
    btn.classList.toggle('btn-active', showClouds);
    playSound('click');
}

function toggleLaserCone() {
    showLaserCone = !showLaserCone;
    if (coneMesh) coneMesh.visible = showLaserCone;
    if (ringMesh) ringMesh.visible = showLaserCone;
    const btn = document.getElementById('btn-toggle-cone');
    btn.textContent = `Scan Beam: ${showLaserCone ? 'ON' : 'OFF'}`;
    btn.classList.toggle('btn-active', showLaserCone);
    playSound('click');
}

function toggleMeteors() {
    showMeteors = !showMeteors;
    const btn = document.getElementById('btn-toggle-meteors');
    btn.textContent = `Space Meteors: ${showMeteors ? 'ON' : 'OFF'}`;
    btn.classList.toggle('btn-active', showMeteors);
    playSound('click');
}

function toggleOrbitDirection() {
    orbitDirection *= -1;
    document.getElementById('btn-toggle-retro').textContent = `Orbit: ${orbitDirection === 1 ? 'Prograde' : 'Retrograde'}`;
    playSound('click');
}

function updateEccentricity(val) {
    orbitEccentricity = parseFloat(val);
    document.getElementById('ecc-val').textContent = `${orbitEccentricity.toFixed(2)} ${orbitEccentricity === 0 ? '(Circular)' : '(Elliptical)'}`;
    drawOrbitLine();
}

function switchEngine(mode) {
    if (scaleAnim) { scaleAnim = null; resetAllGroupScales(); }
    playSound('click'); activeEngine = mode;
    document.getElementById('globe-viewport').style.display = (mode === '3D') ? 'block' : 'none';
    document.getElementById('map-viewport').style.display = (mode === '2D') ? 'block' : 'none';
    document.getElementById('btn-cam-cycle').classList.toggle('hidden', mode !== '3D');
    document.getElementById('cosmos-bar').classList.toggle('hidden', mode !== '3D' || !isSolarSystemView);
    document.getElementById('galaxy-bar').classList.toggle('hidden', mode !== '3D' || !isGalaxyView);
    document.getElementById('universe-bar').classList.toggle('hidden', mode !== '3D' || !isUniverseView);
    document.getElementById('multiverse-bar').classList.toggle('hidden', mode !== '3D' || !isMultiverseView);
    document.getElementById('scale-bar-hud').classList.toggle('hidden', mode !== '3D');
    if (mode !== '3D') document.getElementById('you-are-here-pin').classList.add('hidden');
    document.getElementById('btn-radar').classList.toggle('hidden', mode !== '2D');
    document.getElementById('btn-2d-clouds').classList.toggle('hidden', mode !== '2D');
    document.getElementById('btn-3d').classList.toggle('active', mode === '3D');
    document.getElementById('btn-2d').classList.toggle('active', mode === '2D');
    if (mode === '2D') setTimeout(() => map.invalidateSize(), 100);
}

function cycleCamera() {
    if (isMultiverseView || isUniverseView || isGalaxyView || isSolarSystemView) {
        transitionToScale('EARTH', { toastMsg: 'Zoomed In to Earth View' });
        return;
    }
    playSound('click');
    camModeIdx = (camModeIdx + 1) % camModes.length;
    activeCamera = camModes[camModeIdx];
    const labels = { FREE: 'Free', CHASE: 'Follow', NADIR: 'Nadir' };
    document.getElementById('cam-label').textContent = labels[activeCamera];
}

const opticsNames = ['True Color', 'Thermal (Heat)', 'Night Vision', 'Radar'];
function setOptics(idx) {
    playSound('click');
    document.getElementById('hud-optics').textContent = opticsNames[idx];
    document.querySelectorAll('.optics-btn').forEach((btn, i) => {
        btn.classList.toggle('btn-active', i === idx);
        btn.classList.toggle('bg-slate-800/80', i !== idx);
    });
    if (idx === 3) {
        earthMesh.material = earthWireMat;
        cloudMesh.visible = false;
    } else {
        earthMesh.material = earthShaderMat;
        earthUniforms.opticsMode.value = idx;
        cloudMesh.visible = (idx === 0 && showClouds);
    }
}

function updateAltitude(km) {
    currentAltitudeKm = parseFloat(km);
    orbitRadius = calcOrbitRadius(currentAltitudeKm);
    document.getElementById('alt-val').textContent = km + " km";
    document.getElementById('hud-alt').textContent = km;
    if (!isGeoLocked && !isISSMode) {
        document.getElementById('hud-vel').textContent = calcOrbitalVelocityKps(currentAltitudeKm).toFixed(2);
    }
    updateSpeed(document.getElementById('speed-slider').value);
    buildLaser();
    drawOrbitLine();
}

function updateInclination(deg) {
    orbitInclination = parseFloat(deg);
    document.getElementById('inc-val').textContent = deg + "°";
    drawOrbitLine();
}

function updateSwath(val) {
    swathRadius = parseFloat(val);
    buildLaser();
    const km = Math.round(swathRadius * 4800);
    document.getElementById('swath-val').textContent = km + " km";
    satCircle.setRadius(km * 1000);
}

function updateSpeed(val) {
    baseOrbitSpeed = parseFloat(val);
    orbitSpeed = baseOrbitSpeed / Math.max(0.6, orbitRadius * 0.65);
    const mult = (baseOrbitSpeed / 0.035).toFixed(1);
    document.getElementById('speed-val').textContent = mult + "x " + (mult == 1.0 ? "(Realistic)" : "");
}

// --- 9B. SMART 3D-TO-2D FLOATING LABEL ENGINE (OVERLAP CULLING + TAP-TO-FLY) ---
const smartLabels = [];
const _lblVec = new THREE.Vector3();
const _lblCamDir = new THREE.Vector3();
const _lblNormal = new THREE.Vector3();

function registerSmartLabel(cfg) {
    const layer = document.getElementById('labels-layer');
    const el = document.createElement('div');
    el.className = 'cosmic-label ' + (cfg.cssClass || '');
    el.textContent = cfg.text;
    if (cfg.onClick) {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            playSound('click');
            cfg.onClick();
        });
    }
    layer.appendChild(el);
    smartLabels.push({
        ...cfg,
        el,
        approxW: Math.max(42, cfg.text.length * 6.2 + 16),
        approxH: 18
    });
}

(function initSmartLabels() {
    // 1. EARTH VIEW: Moon + Major World Cities
    registerSmartLabel({
        text: 'Moon',
        scale: 'EARTH',
        cssClass: 'lbl-planet',
        priority: 95,
        getWorldPos: () => earthFrameMoon.getWorldPosition(_lblVec),
        onClick: () => {
            const mp = earthFrameMoon.getWorldPosition(new THREE.Vector3());
            smoothFlyTo(mp.clone().add(new THREE.Vector3(0.6, 0.35, 0.9)), mp, 850);
            showToast('Focused on Moon (Luna)');
        }
    });

    const MAJOR_CITIES = [
        ['New Delhi', 28.61, 77.21, 86],
        ['Tokyo', 35.68, 139.65, 84],
        ['London', 51.51, -0.13, 84],
        ['New York', 40.71, -74.01, 84],
        ['Sydney', -33.87, 151.21, 80],
        ['Cairo', 30.04, 31.24, 78],
        ['São Paulo', -23.55, -46.63, 78],
        ['Paris', 48.86, 2.35, 76],
        ['Singapore', 1.35, 103.82, 76]
    ];
    MAJOR_CITIES.forEach(([cityName, lat, lon, prio]) => {
        registerSmartLabel({
            text: cityName,
            scale: 'EARTH',
            cssClass: 'lbl-city',
            priority: prio,
            isVisibleExtra: (camDist) => {
                if (camDist > 7.5) return false;
                const p = latLonToWorldPosition(lat, lon, 1.015, earthMesh.rotation.y);
                _lblNormal.copy(p).normalize();
                _lblCamDir.copy(camera.position).sub(p).normalize();
                return _lblNormal.dot(_lblCamDir) > 0.24;
            },
            getWorldPos: () => {
                const p = latLonToWorldPosition(lat, lon, 1.02, earthMesh.rotation.y);
                return _lblVec.copy(p);
            },
            onClick: () => parkSatelliteAt(lat, lon)
        });
    });

    // 2. SKY CONSTELLATIONS (Visible in Earth & Solar views when Constellations are ON)
    constellationLabelAnchors.forEach(c => {
        registerSmartLabel({
            text: c.name,
            scale: 'SKY',
            cssClass: 'lbl-constellation',
            priority: 30,
            isVisibleExtra: () => showConstellations,
            getWorldPos: () => _lblVec.copy(c.pos)
        });
    });

    // 3. SOLAR SYSTEM VIEW: Sun, Planets, Dwarf Planets, Comet, Voyager 1 + Close-up Moons
    cosmosBodiesMap.forEach((entry, name) => {
        const isMajor = ['Sun','Mercury','Venus','Earth','Mars','Jupiter','Saturn','Uranus','Neptune'].includes(name);
        registerSmartLabel({
            text: name,
            scale: 'COSMOS',
            cssClass: name === "Halley's Comet" ? 'lbl-comet' : 'lbl-planet',
            priority: name === 'Sun' ? 100 : (name === 'Earth' ? 98 : (isMajor ? 88 : 74)),
            getWorldPos: () => {
                entry.obj.getWorldPosition(_lblVec);
                _lblVec.y += (entry.radius || 0.4) * 1.15;
                return _lblVec;
            },
            onClick: () => focusCosmosBody(name)
        });

        // Planetary moons appear only when zoomed close to their parent planet!
        if (entry.moons && entry.moons.length > 0 && entry.meta && entry.meta.moons) {
            entry.moons.forEach((mObj, idx) => {
                const mMeta = entry.meta.moons[idx];
                if (!mMeta) return;
                registerSmartLabel({
                    text: mMeta.name.replace(' (Luna)', ''),
                    scale: 'COSMOS',
                    cssClass: 'lbl-moon',
                    priority: 62,
                    isVisibleExtra: () => {
                        const pWorld = new THREE.Vector3();
                        entry.obj.getWorldPosition(pWorld);
                        return camera.position.distanceTo(pWorld) < 10.5;
                    },
                    getWorldPos: () => {
                        mObj.mesh.getWorldPosition(_lblVec);
                        _lblVec.y += 0.16;
                        return _lblVec;
                    },
                    onClick: () => focusCosmosBody(name)
                });
            });
        }
    });

    // 4. GALAXY VIEW: Core, Arms, Nebulae, Andromeda, LMC, Triangulum
    registerSmartLabel({
        text: 'Sagittarius A*',
        scale: 'GALAXY',
        cssClass: 'lbl-galaxy',
        priority: 98,
        getWorldPos: () => _lblVec.set(0, 1.2, 0),
        onClick: () => focusGalaxyRegion('Sagittarius A*')
    });
    registerSmartLabel({
        text: 'Andromeda (M31)',
        scale: 'GALAXY',
        cssClass: 'lbl-galaxy',
        priority: 92,
        getWorldPos: () => {
            andromedaGroupObj.getWorldPosition(_lblVec);
            _lblVec.y += 3.5;
            return _lblVec;
        },
        onClick: () => focusGalaxyRegion('Andromeda (M31)')
    });
    galLandmarkAnchors.forEach(lm => {
        registerSmartLabel({
            text: lm.name,
            scale: 'GALAXY',
            cssClass: 'lbl-galaxy',
            priority: lm.prio,
            getWorldPos: () => {
                lm.obj.getWorldPosition(_lblVec);
                _lblVec.y += 0.6;
                return _lblVec;
            },
            onClick: () => focusGalaxyRegion(lm.name)
        });
    });

    // 5. UNIVERSE & MULTIVERSE VIEWS
    registerSmartLabel({
        text: 'Laniakea',
        scale: 'UNIVERSE',
        cssClass: 'lbl-universe',
        priority: 95,
        getWorldPos: () => _lblVec.set(0, 1.4, 0),
        onClick: () => focusUniverseRegion('Laniakea')
    });
    registerSmartLabel({
        text: 'Our Universe',
        scale: 'MULTIVERSE',
        cssClass: 'lbl-multiverse',
        priority: 100,
        getWorldPos: () => _lblVec.set(0, 38, 0),
        onClick: () => selectScale('UNIVERSE')
    });
    uniLandmarkAnchors.forEach(lm => {
        registerSmartLabel({
            text: lm.name,
            scale: lm.scale,
            cssClass: lm.scale === 'MULTIVERSE' ? 'lbl-multiverse' : 'lbl-universe',
            priority: lm.prio,
            getWorldPos: () => {
                lm.obj.getWorldPosition(_lblVec);
                _lblVec.y += lm.scale === 'MULTIVERSE' ? 22 : 1.5;
                return _lblVec;
            },
            onClick: () => lm.scale === 'MULTIVERSE' ? focusMultiverseBubble(lm.region) : focusUniverseRegion(lm.region)
        });
    });

    // Sort once by priority descending so overlap culling always keeps major objects visible
    smartLabels.sort((a, b) => b.priority - a.priority);
})();

function updateSmartLabels(camDist) {
    const layer = document.getElementById('labels-layer');
    if (!layer) return;
    if (!showLabels || activeEngine !== '3D' || scaleAnim) {
        layer.style.display = 'none';
        return;
    }
    layer.style.display = 'block';

    const curScale = getCurrentScale();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const topSafe = curScale === 'EARTH' ? 140 : 215;
    const bottomSafe = h - 78;
    const placedBoxes = [];

    // Reserve space around the YOU ARE HERE pin if visible so labels never overlap it
    const yahEl = document.getElementById('you-are-here-pin');
    if (yahEl && !yahEl.classList.contains('hidden')) {
        const yx = parseFloat(yahEl.style.left) || -999;
        const yy = parseFloat(yahEl.style.top) || -999;
        placedBoxes.push({ x1: yx - 10, y1: yy - 14, x2: yx + 115, y2: yy + 14 });
    }

    for (let i = 0; i < smartLabels.length; i++) {
        const item = smartLabels[i];
        const scaleMatch = item.scale === curScale || (item.scale === 'SKY' && (curScale === 'EARTH' || curScale === 'COSMOS'));
        if (!scaleMatch || (item.isVisibleExtra && !item.isVisibleExtra(camDist))) {
            item.el.style.display = 'none';
            continue;
        }

        const worldPos = item.getWorldPos();
        worldPos.project(camera);
        if (worldPos.z >= 1.0) {
            item.el.style.display = 'none';
            continue;
        }

        const sx = (worldPos.x * 0.5 + 0.5) * w;
        const sy = (-worldPos.y * 0.5 + 0.5) * h;

        if (sx < 34 || sx > w - 34 || sy < topSafe || sy > bottomSafe) {
            item.el.style.display = 'none';
            continue;
        }

        const halfW = item.approxW * 0.5 + 5;
        const box = { x1: sx - halfW, y1: sy - item.approxH - 4, x2: sx + halfW, y2: sy + 4 };
        let overlaps = false;
        for (let j = 0; j < placedBoxes.length; j++) {
            const b = placedBoxes[j];
            if (box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1) {
                overlaps = true;
                break;
            }
        }
        if (overlaps) {
            item.el.style.display = 'none';
            continue;
        }

        placedBoxes.push(box);
        item.el.style.display = 'block';
        item.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -125%)`;
    }
}

// --- 10. FRAME-RATE INDEPENDENT ANIMATION LOOP + ADAPTIVE TOUCH SENSITIVITY ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.elapsedTime;
    solarTimeUniform.value = elapsed;

    // Continuous Sequential Multi-Stage Scale Journey Engine
    if (scaleAnim) {
        const nowMs = performance.now();
        const veil = document.getElementById('scale-warp-veil');
        const st = scaleAnim.stages[scaleAnim.stageIdx];
        const t = Math.min(1, (nowMs - scaleAnim.startTime) / st.duration);

        let ease;
        if (st.kind === 'DEPART') {
            // Smooth accelerating zoom-out / dive-in (starts moving immediately, no dead lag)
            ease = Math.pow(t, 1.85);
            camera.fov = 45 + 13 * ease;
            camera.updateProjectionMatrix();
            const nextSt = scaleAnim.stages[scaleAnim.stageIdx + 1];
            const samePhysicalSpace = nextSt && ((st.scale === 'UNIVERSE' && nextSt.scale === 'MULTIVERSE') || (st.scale === 'MULTIVERSE' && nextSt.scale === 'UNIVERSE'));
            if (scaleAnim.zoomingOut && st.group && !samePhysicalSpace) {
                st.group.scale.setScalar(1.0 - 0.35 * ease);
            }
            if (t > 0.84 && veil && !samePhysicalSpace) veil.classList.add('active');
        } else if (st.kind === 'TRANSIT') {
            // Continuous flowing pass-through of intermediate scale (zero stop/stall)
            const sCurve = t * t * (3.0 - 2.0 * t);
            ease = t * 0.45 + sCurve * 0.55;
            camera.fov = 58 - 6 * Math.sin(t * Math.PI);
            camera.updateProjectionMatrix();
            if (t > 0.12 && t < 0.84 && veil) veil.classList.remove('active');
            if (t >= 0.84 && veil) veil.classList.add('active');
        } else {
            // Smooth lingering cubic deceleration into final destination
            ease = 1.0 - Math.pow(1.0 - t, 3);
            camera.fov = 58 - 13 * ease;
            camera.updateProjectionMatrix();
            if (t > 0.14 && veil) veil.classList.remove('active');
        }

        camera.position.lerpVectors(scaleAnim.traj.startPos, scaleAnim.traj.endPos, ease);
        controls.target.lerpVectors(scaleAnim.traj.startTarget, scaleAnim.traj.endTarget, ease);

        if (t >= 1) {
            if (st.group) st.group.scale.setScalar(1.0);
            scaleAnim.stageIdx++;
            if (scaleAnim.stageIdx < scaleAnim.stages.length) {
                const nextStage = scaleAnim.stages[scaleAnim.stageIdx];
                applyScaleDOMAndVisibility(nextStage.scale);
                syncScaleHeaderUI(nextStage.scale);
                scaleAnim.traj = computeStageTrajectory(nextStage, scaleAnim.zoomingOut, scaleAnim.options);
                camera.position.copy(scaleAnim.traj.startPos);
                controls.target.copy(scaleAnim.traj.startTarget);
                scaleAnim.startTime = nowMs;
                if (nextStage.kind === 'ARRIVE' && scaleAnim.toastMsg) showToast(scaleAnim.toastMsg);
            } else {
                const cb = scaleAnim.onArrived;
                scaleAnim = null;
                resetAllGroupScales();
                if (cb) cb();
            }
        }
    }

    // Smooth Cubic Ease-Out Camera Fly-To
    if (flyAnim) {
        const t = Math.min(1, (performance.now() - flyAnim.startTime) / flyAnim.duration);
        const ease = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(flyAnim.startPos, flyAnim.endPos, ease);
        controls.target.lerpVectors(flyAnim.startTarget, flyAnim.endTarget, ease);
        if (t >= 1) flyAnim = null;
    }

    // Dynamic Zoom-Adaptive Touch Sensitivity (Surgical precision close up, effortless sweep far out!)
    const camDist = camera.position.distanceTo(controls.target);
    controls.rotateSpeed = Math.max(0.32, Math.min(0.9, (camDist - 1.0) * 0.18 + 0.32));
    controls.zoomSpeed = Math.max(0.65, Math.min(1.2, camDist * 0.08 + 0.6));

    // Update Heliocentric Planets, Moons & Live Comet 1P/Halley Physics
    if (isSolarSystemView) {
        const warp = cosmosWarpModes[cosmosWarpIdx].daysPerSec;
        if (cosmosWarpIdx > 0) simDaysOffset += warp * dt;
        const simDays = getDaysSinceJ2000() + simDaysOffset;
        JPL_PLANETS.forEach(p => {
            const entry = cosmosBodiesMap.get(p.name);
            if (!entry) return;
            if (entry.spinMesh) entry.spinMesh.rotation.y += 0.35 * dt;
            if (cosmosWarpIdx > 0) {
                const res = computePlanetHeliocentricAU(p, simDays);
                entry.obj.position.copy(res.vec.normalize().multiplyScalar(p.visDist));
            }
            if (entry.moons && entry.moons.length > 0) {
                entry.moons.forEach(m => {
                    const moonSpeed = cosmosWarpIdx > 0 ? simDays : (simDays + elapsed * 0.08);
                    const phase = ((moonSpeed / m.period) * Math.PI * 2) + m.seed;
                    m.mesh.position.set(Math.cos(phase) * m.dist, 0, -Math.sin(phase) * m.dist);
                });
            }
        });

        // Live 1P/Halley Keplerian Propagation & Photorealistic Solar-Wind Dual Tail Physics
        const hEntry = cosmosBodiesMap.get("Halley's Comet");
        if (hEntry && hEntry.halleyRig) {
            const hState = computeHalleyState(simDays);
            hEntry.obj.position.copy(hState.visPos);
            hEntry.spinMesh.rotation.x += 0.38 * dt;
            hEntry.spinMesh.rotation.y += 0.62 * dt;

            // Activity factor: crisp delicate glow at 35 AU -> blazing dual-tail spectacle inside 6 AU!
            const activity = Math.max(0.32, Math.min(1.75, Math.pow(4.6 / Math.max(0.55, hState.rAU), 0.72)));
            const rig = hEntry.halleyRig;
            rig.nucleusMat.uniforms.uActivity.value = activity;

            rig.comaCore.scale.setScalar(0.34 + 0.32 * activity);
            rig.comaInner.scale.setScalar(0.75 + 0.72 * activity);
            rig.comaOuter.scale.setScalar(1.55 + 1.85 * activity);
            rig.comaOuter.material.opacity = Math.min(0.85, 0.28 + 0.42 * activity);

            // Type I Blue Ion Tail points strictly anti-solar (+rHat directly away from Sun)
            const antiSun = hState.visPos.clone().normalize();
            const qIon = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), antiSun);
            rig.ionTail.group.quaternion.copy(qIon);
            rig.ionTail.group.scale.set(0.38 + 0.92 * activity, 0.50 + 0.65 * activity, 0.50 + 0.65 * activity);
            rig.ionTail.mat.uniforms.uIntensity.value = Math.min(0.95, 0.28 + 0.52 * activity);
            rig.ionParticles.material.opacity = Math.min(0.85, 0.26 + 0.42 * activity);

            // Type II Golden-White Dust Tail lags behind orbital velocity vector (radiation pressure)
            const dustDir = antiSun.clone().multiplyScalar(0.82).addScaledVector(hState.velDir, -0.40).normalize();
            const qDust = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dustDir);
            rig.dustTail.group.quaternion.copy(qDust);
            rig.dustTail.group.scale.set(0.34 + 0.88 * activity, 0.48 + 0.62 * activity, 0.48 + 0.62 * activity);
            rig.dustTail.mat.uniforms.uIntensity.value = Math.min(0.82, 0.20 + 0.46 * activity);
            rig.dustParticles.material.opacity = Math.min(0.75, 0.18 + 0.38 * activity);

            // Sunward Outgassing Jet points directly toward the Sun (-antiSun)
            const toSun = antiSun.clone().negate();
            rig.sunJet.group.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), toSun);
            rig.sunJet.group.scale.setScalar(0.45 + 0.65 * activity);
            rig.sunJet.mat.uniforms.uIntensity.value = Math.min(0.78, 0.20 + 0.42 * activity);

            // Animate live flowing ion & dust particles streaming out of the coma!
            const iArr = rig.ionParticles.geometry.attributes.position.array;
            for (let i = 0; i < rig.ionPartMeta.length; i++) {
                const pm = rig.ionPartMeta[i];
                pm.prog = (pm.prog + pm.speed * dt * (0.7 + 0.6 * activity)) % 1.0;
                const r = pm.radScale * (0.14 + pm.prog * 1.15);
                iArr[i*3] = pm.prog * 7.8;
                iArr[i*3+1] = Math.cos(pm.angle) * r;
                iArr[i*3+2] = Math.sin(pm.angle) * r;
            }
            rig.ionParticles.geometry.attributes.position.needsUpdate = true;

            const dArr = rig.dustParticles.geometry.attributes.position.array;
            for (let i = 0; i < rig.dustPartMeta.length; i++) {
                const pm = rig.dustPartMeta[i];
                pm.prog = (pm.prog + pm.speed * dt * (0.6 + 0.5 * activity)) % 1.0;
                const r = pm.radScale * (0.16 + pm.prog * 1.28);
                dArr[i*3] = pm.prog * 6.0;
                dArr[i*3+1] = 0.85 * pm.prog * pm.prog + Math.cos(pm.angle) * r;
                dArr[i*3+2] = Math.sin(pm.angle) * r;
            }
            rig.dustParticles.geometry.attributes.position.needsUpdate = true;

            // Keep top bar stats live when Halley's Comet is focused
            if (focusedCosmosBody === "Halley's Comet") {
                const simYear = new Date(Date.UTC(2000, 0, 1, 12, 0, 0) + simDays * 86400000).getUTCFullYear();
                document.getElementById('pt-stats').innerHTML = `Sun: ${hState.rAU.toFixed(2)} AU &bull; ${hState.vKps.toFixed(2)} km/s &bull; ${simYear}`;
            }
        }
    }


    // --- UNIFIED SINGLE-SYSTEM LOGARITHMIC PINCH/SCROLL CONTINUITY ---
    // Every transition glides smoothly with cubic ease-out (zero hard camera cuts) and lets you zoom far out in every stage!
    if (activeEngine === '3D' && !scaleAnim && !flyAnim && activeCamera === 'FREE') {
        const nowMs = performance.now();
        if (nowMs - lastAutoScaleSwitch > 520) {
            const performSeamlessZoomHandoff = (nextScale, toastText, startPos, startTarget, endPos, endTarget) => {
                lastAutoScaleSwitch = nowMs;
                applyScaleDOMAndVisibility(nextScale);
                syncScaleHeaderUI(nextScale);
                controls.target.copy(startTarget);
                camera.position.copy(startPos);
                controls.update();
                smoothFlyTo(endPos, endTarget, 680);
                if (toastText) showToast(toastText);
            };

            if (!isSolarSystemView && !isGalaxyView && !isUniverseView && !isMultiverseView) {
                // EARTH VIEW -> Zooming OUT past 24.5 units glides smoothly behind Earth into the Solar System
                if (camDist > 42.0) {
                    const earthEntry = cosmosBodiesMap.get('Earth');
                    const earthWorld = new THREE.Vector3(11.5, 0, 0);
                    if (earthEntry) earthEntry.obj.getWorldPosition(earthWorld);
                    const outwardDir = camera.position.clone().sub(controls.target);
                    if (outwardDir.lengthSq() < 1e-6) outwardDir.set(0, 0.35, 0.9);
                    outwardDir.normalize();
                    const sPos = earthWorld.clone().addScaledVector(outwardDir, 2.2);
                    const ePos = earthWorld.clone().addScaledVector(outwardDir, 6.8).add(new THREE.Vector3(0, 2.2, 0));
                    const eTgt = earthWorld.clone().lerp(new THREE.Vector3(0, 0, 0), 0.35);
                    performSeamlessZoomHandoff('COSMOS', 'Solar System Scale', sPos, earthWorld, ePos, eTgt);
                }
            } else if (isSolarSystemView) {
                // SOLAR VIEW -> Zooming OUT past 188 units glides smoothly out of our Solar System in the Milky Way
                if (camDist > 285) {
                    const solarWorld = new THREE.Vector3(13.335, 0, 0);
                    if (solarSystemPinObj) solarSystemPinObj.getWorldPosition(solarWorld);
                    const outDir = camera.position.clone().sub(controls.target);
                    if (outDir.lengthSq() < 1e-6) outDir.set(0.4, 0.5, 0.7);
                    outDir.normalize();
                    const sPos = solarWorld.clone().addScaledVector(outDir, 3.2);
                    const ePos = solarWorld.clone().addScaledVector(outDir, 12.0).add(new THREE.Vector3(0, 6.5, 0));
                    performSeamlessZoomHandoff('GALAXY', 'Milky Way Galaxy Scale', sPos, solarWorld, ePos, solarWorld.clone().multiplyScalar(0.35));
                } else {
                    // Zooming IN -> enter Earth View ONLY when pinching directly into Earth's 3D globe
                    const earthEntry = cosmosBodiesMap.get('Earth');
                    if (earthEntry) {
                        const earthWorld = new THREE.Vector3();
                        earthEntry.obj.getWorldPosition(earthWorld);
                        if (camera.position.distanceTo(earthWorld) < 1.65) {
                            const indiaFar = getEarthIndiaCameraPos(18.0);
                            const indiaNear = getEarthIndiaCameraPos(6.8);
                            performSeamlessZoomHandoff('EARTH', 'Earth Orbital Scale', indiaFar, new THREE.Vector3(0, 0, 0), indiaNear, new THREE.Vector3(0, 0, 0));
                        }
                    }
                }
            } else if (isGalaxyView) {
                // GALAXY VIEW -> Zooming OUT past 188 units glides smoothly out of Laniakea into the Cosmic Web
                if (camDist > 285) {
                    const outDir = camera.position.clone().sub(controls.target);
                    if (outDir.lengthSq() < 1e-6) outDir.set(0.2, 0.5, 0.8);
                    outDir.normalize();
                    performSeamlessZoomHandoff('UNIVERSE', 'Observable Universe Scale', outDir.clone().multiplyScalar(6.5), new THREE.Vector3(0, 0, 0), outDir.clone().multiplyScalar(22.0), new THREE.Vector3(0, 0, 0));
                } else if (solarSystemPinObj) {
                    // Zooming IN -> enter Solar System ONLY when pinching into our Solar System's G2V star node
                    const solarWorld = new THREE.Vector3();
                    solarSystemPinObj.getWorldPosition(solarWorld);
                    if (camera.position.distanceTo(solarWorld) < 2.6) {
                        const inDir = camera.position.clone().sub(solarWorld).normalize();
                        if (inDir.lengthSq() < 1e-6) inDir.set(0.4, 0.4, 0.8);
                        performSeamlessZoomHandoff('COSMOS', 'Solar System Scale', inDir.clone().multiplyScalar(145.0), new THREE.Vector3(0, 0, 0), inDir.clone().multiplyScalar(68.0), new THREE.Vector3(0, 0, 0));
                    }
                }
            } else if (isUniverseView) {
                // UNIVERSE VIEW -> Zooming OUT past 132 units glides smoothly outside the CMB horizon into the Multiverse
                if (camDist > 168) {
                    const outDir = camera.position.clone().sub(controls.target);
                    if (outDir.lengthSq() < 1e-6) outDir.set(0, 0.5, 0.85);
                    outDir.normalize();
                    performSeamlessZoomHandoff('MULTIVERSE', 'Multiverse Scale', outDir.clone().multiplyScalar(170.0), new THREE.Vector3(0, 0, 0), outDir.clone().multiplyScalar(320.0), new THREE.Vector3(0, 0, 0));
                } else if (universeHomePin) {
                    // Zooming IN -> enter Milky Way Galaxy ONLY when pinching into Laniakea / Home Galaxy spiral node
                    const homeWorld = new THREE.Vector3();
                    universeHomePin.getWorldPosition(homeWorld);
                    if (camera.position.distanceTo(homeWorld) < 3.0) {
                        const inDir = camera.position.clone().sub(homeWorld).normalize();
                        if (inDir.lengthSq() < 1e-6) inDir.set(0, 0.6, 0.8);
                        performSeamlessZoomHandoff('GALAXY', 'Milky Way Galaxy Scale', inDir.clone().multiplyScalar(145.0), new THREE.Vector3(0, 0, 0), inDir.clone().multiplyScalar(54.0), new THREE.Vector3(0, 0, 0));
                    }
                }
            } else if (isMultiverseView) {
                // MULTIVERSE VIEW -> Zooming IN -> enter Observable Universe ONLY when pinching inside Our Universe's CMB horizon
                const distToOurUniverse = camera.position.length();
                if (distToOurUniverse < 58.0) {
                    const inDir = camera.position.clone().normalize();
                    if (inDir.lengthSq() < 1e-6) inDir.set(0, 0.5, 0.85);
                    performSeamlessZoomHandoff('UNIVERSE', 'Observable Universe Scale', inDir.clone().multiplyScalar(68.0), new THREE.Vector3(0, 0, 0), inDir.clone().multiplyScalar(42.0), new THREE.Vector3(0, 0, 0));
                }
            }
        }
    }

    // --- LIVE LOGARITHMIC SCALE BAR & "YOU ARE HERE" 2D CALLOUT ---
    if (activeEngine === '3D') {
        const sLabel = document.getElementById('scale-bar-label');
        const sRealm = document.getElementById('scale-bar-realm');
        if (isMultiverseView) {
            const bLy = (camDist * 1.25).toFixed(0);
            sLabel.textContent = `${bLy}B+ ly (Multiverse)`;
            sRealm.textContent = 'Hypothetical Multiverse';
        } else if (isUniverseView) {
            const bLy = (camDist * 1.15).toFixed(1);
            sLabel.textContent = `${bLy} billion light-years`;
            sRealm.textContent = camDist > 50 ? 'Observable Universe (CMB)' : 'Cosmic Web Superclusters';
        } else if (isGalaxyView) {
            const kLy = (camDist * 1.95).toFixed(1);
            sLabel.textContent = `${kLy} thousand light-years`;
            sRealm.textContent = 'Milky Way Galaxy';
        } else if (isSolarSystemView) {
            const au = (camDist * 0.14).toFixed(2);
            const bKm = (camDist * 0.021).toFixed(2);
            sLabel.textContent = camDist > 18 ? `${bKm} billion km` : `${au} AU`;
            sRealm.textContent = 'Heliocentric Solar System';
        } else {
            const km = Math.round(camDist * 4250);
            sLabel.textContent = `${km.toLocaleString()} km`;
            sRealm.textContent = 'Earth Orbital Scale';
        }

        // Update "YOU ARE HERE" 3D-to-2D screen projection in Cosmos, Galaxy & Universe views
        const yahEl = document.getElementById('you-are-here-pin');
        let anchorObj = null;
        if (isSolarSystemView && cosmosBodiesMap.has('Earth') && !(focusedCosmosBody === 'Earth' && camDist < 6.0)) anchorObj = cosmosBodiesMap.get('Earth').obj;
        else if (isGalaxyView && solarSystemPinObj) anchorObj = solarSystemPinObj;
        else if ((isUniverseView || isMultiverseView) && universeHomePin) anchorObj = universeHomePin;

        if (anchorObj && !scaleAnim) {
            const proj = new THREE.Vector3();
            anchorObj.getWorldPosition(proj);
            proj.project(camera);
            if (proj.z < 1.0 && Math.abs(proj.x) < 0.92 && Math.abs(proj.y) < 0.86) {
                const sx = (proj.x * 0.5 + 0.5) * window.innerWidth;
                const sy = (-proj.y * 0.5 + 0.5) * window.innerHeight;
                yahEl.style.left = `${sx}px`;
                yahEl.style.top = `${sy}px`;
                yahEl.classList.remove('hidden');
            } else {
                yahEl.classList.add('hidden');
            }
        } else {
            yahEl.classList.add('hidden');
        }
    }

    // Gentle rotation of Cosmic Web in Universe view
    if (isUniverseView || isMultiverseView) {
        universeGroup.rotation.y += 0.006 * dt;
    }

    // Update 3D Milky Way Galaxy Rotation & Solar System Pin Pulse
    if (isGalaxyView) {
        milkyWayDiskGroup.rotation.y += 0.012 * dt;
        if (solarSystemMarkerRing) {
            const gPulse = 1.0 + 0.28 * Math.sin(elapsed * 3.8);
            solarSystemMarkerRing.scale.set(gPulse, gPulse, 1);
        }
    }

    // Update Earth & Clouds
    earthMesh.rotation.y += 0.008 * dt;
    cloudMesh.rotation.y += 0.011 * dt;

    const liveSunDir = getRealTimeSunDirection(earthMesh.rotation.y);
    earthUniforms.sunDir.value.copy(liveSunDir);
    sunLight.position.copy(liveSunDir).multiplyScalar(15);
    earthSunVisual.position.copy(liveSunDir).multiplyScalar(78);

    const moonPhaseRad = ((getDaysSinceJ2000() % 29.53059) / 29.53059) * Math.PI * 2;
    earthFrameMoon.position.set(Math.cos(moonPhaseRad) * 6.8, Math.sin(moonPhaseRad) * 0.6, -Math.sin(moonPhaseRad) * 6.8);
    earthFrameMoon.rotation.y += 0.02 * dt;

    // Pulse 3D Event Beacons
    const pulse = 1.0 + 0.32 * Math.sin(elapsed * 3.5);
    for (let i = 0; i < beaconRings.length; i++) beaconRings[i].scale.set(pulse, pulse, 1);

    // Update Meteors
    for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.mesh.position.addScaledVector(m.vel, dt);
        m.life -= dt * 0.85;
        m.mesh.material.opacity = Math.max(0, m.life);
        if (m.life <= 0) { scene.remove(m.mesh); meteors.splice(i, 1); }
    }

    // Active Spacecraft Physics
    if (isISSMode) {
        issCurrentLat += (issTargetLat - issCurrentLat) * Math.min(1, dt * 1.5);
        let dLon = issTargetLon - issCurrentLon;
        if (dLon > 180) dLon -= 360;
        if (dLon < -180) dLon += 360;
        issCurrentLon += dLon * Math.min(1, dt * 1.5);

        const issPos = latLonToWorldPosition(issCurrentLat, issCurrentLon, orbitRadius, earthMesh.rotation.y);
        issGroup.position.copy(issPos);
        issGroup.lookAt(0,0,0);

        document.getElementById('hud-lat').textContent = issCurrentLat.toFixed(2);
        document.getElementById('hud-lon').textContent = issCurrentLon.toFixed(2);
        satMarker.setLatLng([issCurrentLat, issCurrentLon]);
        satCircle.setLatLng([issCurrentLat, issCurrentLon]);
    } else if (!isGeoLocked) {
        orbitTime += orbitSpeed * orbitDirection * dt;
        const inclRad = orbitInclination * Math.PI / 180;
        const r = orbitRadius * (1 - orbitEccentricity * orbitEccentricity) / (1 + orbitEccentricity * Math.cos(orbitTime));
        vkSatGroup.position.set(
            Math.cos(orbitTime) * r,
            Math.sin(orbitTime) * Math.sin(inclRad) * r,
            Math.sin(orbitTime) * Math.cos(inclRad) * r
        );
        vkSatGroup.lookAt(0,0,0);

        const coords = worldPositionToLatLon(vkSatGroup.position, earthMesh.rotation.y);
        document.getElementById('hud-lat').textContent = coords.lat.toFixed(2);
        document.getElementById('hud-lon').textContent = coords.lon.toFixed(2);
        satMarker.setLatLng([coords.lat, coords.lon]);
        satCircle.setLatLng([coords.lat, coords.lon]);

        const now = Date.now();
        if (isDockExpanded && currentTab === 'weather' && now - lastScannedTime > 4500) {
            lastScannedTime = now;
            fetchSubSatData(coords.lat, coords.lon);
        }
    } else {
        const lockedPos = latLonToWorldPosition(lockedLat, lockedLon, orbitRadius, earthMesh.rotation.y);
        vkSatGroup.position.copy(lockedPos);
        vkSatGroup.lookAt(0,0,0);
    }

    coneMesh.position.copy(activeSpacecraft.position);
    coneMesh.lookAt(0,0,0);
    ringMesh.lookAt(activeSpacecraft.position);
    earthUniforms.satDir.value.copy(activeSpacecraft.position).normalize();

    const strobe = Math.floor(Date.now() / 550) % 2 === 0;
    navBeaconRed.visible = strobe;
    navBeaconGreen.visible = !strobe;

    document.getElementById('hud-time').textContent = 'UTC ' + new Date().toISOString().substr(11,8);

    if (isSolarSystemView || isGalaxyView || isUniverseView || isMultiverseView || activeCamera === 'FREE') {
        controls.update();
    } else if (activeCamera === 'CHASE') {
        const inclRad = orbitInclination * Math.PI / 180;
        const forward = (!isGeoLocked && !isISSMode)
            ? new THREE.Vector3(-Math.sin(orbitTime) * orbitDirection, Math.cos(orbitTime) * Math.sin(inclRad) * orbitDirection, Math.cos(orbitTime) * Math.cos(inclRad) * orbitDirection).normalize()
            : new THREE.Vector3(-activeSpacecraft.position.z, 0, activeSpacecraft.position.x).normalize();
        const up = new THREE.Vector3(0,1,0);
        const right = new THREE.Vector3().crossVectors(forward, up).normalize();
        const scale = 0.75 + ((orbitRadius - 1.0) * 0.35);
        const offset = new THREE.Vector3().addScaledVector(forward, -0.55 * scale).addScaledVector(up, 0.28 * scale).addScaledVector(right, 0.08 * scale);
        camera.position.lerp(activeSpacecraft.position.clone().add(offset), 0.08);
        camera.lookAt(activeSpacecraft.position);
    } else if (activeCamera === 'NADIR') {
        camera.position.lerp(activeSpacecraft.position.clone().multiplyScalar(1.06), 0.1);
        camera.lookAt(0,0,0);
    }

    updateSmartLabels(camDist);
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (activeEngine === '2D') map.invalidateSize();
});

// Boot Initialization
document.getElementById('hud-vel').textContent = calcOrbitalVelocityKps(currentAltitudeKm).toFixed(2);
positionCameraOnDaySide(true);
updateSpeed(document.getElementById('speed-slider').value);
setTimeout(() => {
    fetchLiveIntel(true);
    const coords = worldPositionToLatLon(activeSpacecraft.position, earthMesh.rotation.y);
    fetchSubSatData(coords.lat, coords.lon, true);
}, 350);

animate();
