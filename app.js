// ============================================================================
// VYUHAK v17 COSMOS // REAL-TIME EARTH, ISS, SOLAR SYSTEM & METEOR ENGINE
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
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        osc.start(); osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'lock') {
        osc.type = 'square'; osc.frequency.setValueAtTime(440, audioCtx.currentTime); osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 0.04); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start(); osc.stop(audioCtx.currentTime + 0.25);
    } else if (type === 'alert') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(220, audioCtx.currentTime); osc.frequency.setValueAtTime(440, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0.07, audioCtx.currentTime + 0.04); gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    }
    osc.connect(gain); gain.connect(audioCtx.destination);
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast-msg';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 2400);
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
    if (apiCache.size > 80) apiCache.delete(apiCache.keys().next().value);
    return data;
}

// --- 3. ASTRONOMICAL & SPHERICAL COORDINATE MATH ---
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

// Days since J2000.0 epoch (Jan 1, 2000 12:00 UTC) for real-time ephemeris
function getDaysSinceJ2000() {
    const now = Date.now();
    const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
    return (now - j2000) / 86400000;
}

// Real-time UTC Sub-Solar Vector
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
let isRainRadarOn = false;
let showClouds = true;
let showLaserCone = true;
let showMeteors = true;
let orbitDirection = 1; // 1 = Prograde, -1 = Retrograde

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
let vkScale = 0.45;  // Realistic proportional scale relative to Earth
let issScale = 0.55; // Realistic proportional scale relative to Earth

let activeEngine = '3D';
const camModes = ['FREE', 'CHASE', 'NADIR'];
let camModeIdx = 0;
let activeCamera = 'FREE';
let lastScannedTime = 0;

// Live ISS State
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
    "TD": { name: "Chad", pop: 18278568, cap: "N'Djamena", cur: "CFA Franc", area: 1284000, tz: "UTC+01:00" },
    "NG": { name: "Nigeria", pop: 223804632, cap: "Abuja", cur: "Naira (₦)", area: 923768, tz: "UTC+01:00" },
    "EG": { name: "Egypt", pop: 112716598, cap: "Cairo", cur: "Egyptian Pound", area: 1002450, tz: "UTC+02:00" },
    "ID": { name: "Indonesia", pop: 277534122, cap: "Jakarta", cur: "Rupiah (Rp)", area: 1904569, tz: "UTC+07:00" },
    "PK": { name: "Pakistan", pop: 240485658, cap: "Islamabad", cur: "Pakistani Rupee", area: 881912, tz: "UTC+05:00" },
    "UA": { name: "Ukraine", pop: 36744634, cap: "Kyiv", cur: "Hryvnia (₴)", area: 603500, tz: "UTC+02:00" }
};

// --- 5. UI & DOCK CONTROLS ---
function toggleDockCollapse() {
    const dock = document.getElementById('fixed-bottom-dock');
    isDockExpanded = !isDockExpanded;
    dock.classList.toggle('expanded', isDockExpanded);
}

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
    const topInd = document.getElementById('top-lock-ind');

    if (locked) {
        btn.classList.add('bg-sky-700/50', 'border-sky-400');
        ind.textContent = 'ON'; ind.classList.replace('text-slate-400', 'text-sky-300');
        topBtn.classList.add('bg-sky-900/60', 'border-sky-400');
        topInd.textContent = 'ON'; topInd.classList.replace('text-slate-400', 'text-emerald-400');
        document.getElementById('hud-sat-name').textContent = 'VK-Hover-02';
        document.getElementById('hud-vel').textContent = '0.00';
        if (orbitLineMesh) orbitLineMesh.visible = false;
    } else {
        btn.classList.remove('bg-sky-700/50', 'border-sky-400');
        ind.textContent = 'OFF'; ind.classList.replace('text-sky-300', 'text-slate-400');
        topBtn.classList.remove('bg-sky-900/60', 'border-sky-400');
        topInd.textContent = 'OFF'; topInd.classList.replace('text-emerald-400', 'text-slate-400');
        if (!isISSMode) {
            document.getElementById('hud-sat-name').textContent = 'VK-Tracker-01';
            if (orbitLineMesh) orbitLineMesh.visible = true;
            updateSpeed(document.getElementById('speed-slider').value);
        }
    }
}

function toggleGeoLock() {
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

// --- 6. LIVE ISS TRACKING (REALISTIC ISS 3D MODEL + LIVE TELEMETRY) ---
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
    isISSMode = !isISSMode;
    const btn = document.getElementById('btn-iss-mode');
    const ind = document.getElementById('iss-ind');

    if (isISSMode) {
        if (isGeoLocked) { isGeoLocked = false; updateLockUI(false); }
        btn.classList.add('bg-amber-900/50', 'border-amber-400');
        ind.textContent = 'ON'; ind.classList.replace('text-slate-400', 'text-amber-300');
        document.getElementById('hud-sat-name').textContent = 'ISS (ZARYA LIVE)';
        if (orbitLineMesh) orbitLineMesh.visible = false;
        
        // Swap to the Realistic ISS 3D Station Model
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
        btn.classList.remove('bg-amber-900/50', 'border-amber-400');
        ind.textContent = 'OFF'; ind.classList.replace('text-amber-300', 'text-slate-400');
        document.getElementById('hud-sat-name').textContent = 'VK-Tracker-01';
        orbitRadius = calcOrbitRadius(currentAltitudeKm);
        document.getElementById('hud-alt').textContent = currentAltitudeKm;
        document.getElementById('hud-vel').textContent = '7.3';
        if (orbitLineMesh) orbitLineMesh.visible = true;

        // Swap back to VK-Tracker Satellite
        issGroup.visible = false;
        vkSatGroup.visible = true;
        activeSpacecraft = vkSatGroup;

        buildLaser();
        playSound('click');
        showToast('Returned to VK-Tracker-01');
    }
}

// --- 7. SOLAR SYSTEM VIEW TOGGLE ---
function toggleSolarSystemView() {
    isSolarSystemView = !isSolarSystemView;
    const btn = document.getElementById('btn-solar-view');
    const ind = document.getElementById('solar-ind');
    playSound('click');

    if (isSolarSystemView) {
        btn.classList.add('bg-purple-900/50', 'border-purple-400');
        ind.textContent = 'ON'; ind.classList.replace('text-slate-400', 'text-purple-300');
        activeCamera = 'FREE';
        camModeIdx = 0;
        document.getElementById('cam-label').textContent = 'Free';
        controls.maxDistance = 65;
        camera.position.set(0, 14, 28);
        controls.update();
        showToast('Solar System Real-Time Alignment View');
    } else {
        btn.classList.remove('bg-purple-900/50', 'border-purple-400');
        ind.textContent = 'OFF'; ind.classList.replace('text-purple-300', 'text-slate-400');
        controls.maxDistance = 16;
        camera.position.set(0, 1.5, window.innerWidth < window.innerHeight ? 4.4 : 2.9);
        controls.update();
        showToast('Returned to Earth Orbital View');
    }
}

// --- 8. API ENDPOINTS & DATA EXTRACTION ---
const API_ENDPOINTS = {
    EARTHQUAKES: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
    EONET: 'https://eonet.gsfc.nasa.gov/api/v3/events?limit=15&days=10',
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
        const [eqRes, eoRes, rwRes, newsRes] = await Promise.allSettled([
            cachedFetchJSON(API_ENDPOINTS.EARTHQUAKES, 120000),
            cachedFetchJSON(API_ENDPOINTS.EONET, 300000),
            cachedFetchJSON(API_ENDPOINTS.RELIEFWEB_GLOBAL, 300000),
            cachedFetchJSON(API_ENDPOINTS.NEWS_GLOBAL, 300000)
        ]);

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
            }
        }
    } catch (e) {}
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
    if (isISSMode) toggleISSMode();
    if (isSolarSystemView) toggleSolarSystemView();
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

    setTimeout(() => {
        const targetCamPos = activeSpacecraft.position.clone().multiplyScalar(1.65);
        camera.position.lerp(targetCamPos, 0.5);
        camera.lookAt(0,0,0);
    }, 60);
}

// ============================================================================
// 9. PHOTOREALISTIC 3D EARTH, REAL-TIME SOLAR SYSTEM, STARS & METEORS
// ============================================================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 1200);
camera.position.set(0, 1.5, window.innerWidth < window.innerHeight ? 4.4 : 2.9);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
document.getElementById('globe-viewport').appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.05;
controls.minDistance = 1.15; controls.maxDistance = 16;

// --- A. REAL CATALOG BRIGHT STARS (RA / DEC) + DEEP-SPACE STARFIELD ---
(function createRealStarfield() {
    // Major real-world catalog stars [RA hours, Dec deg, Color Hex]
    const brightStars = [
        [6.75, -16.71, 0xbae6fd], // Sirius
        [6.40, -52.70, 0xfef9c3], // Canopus
        [14.26, 19.18, 0xfdba74], // Arcturus
        [18.62, 38.78, 0xe0f2fe], // Vega
        [5.28, 46.00, 0xfef08a],  // Capella
        [5.24, -8.20, 0x93c5fd],  // Rigel
        [5.92, 7.41, 0xfb923c],   // Betelgeuse
        [2.53, 89.26, 0xfef9c3],  // Polaris
        [16.49, -26.43, 0xf87171],// Antares
        [19.85, 8.87, 0xf8fafc]   // Altair
    ];
    const totalStars = 3200 + brightStars.length;
    const positions = new Float32Array(totalStars * 3);
    const colors = new Float32Array(totalStars * 3);
    const palette = [new THREE.Color(0xffffff), new THREE.Color(0xbae6fd), new THREE.Color(0xfef08a), new THREE.Color(0xfed7aa)];

    // Add real catalog stars first
    brightStars.forEach((s, idx) => {
        const raRad = (s[0] * 15) * Math.PI / 180;
        const decRad = s[1] * Math.PI / 180;
        const r = 180;
        positions[idx*3] = r * Math.cos(decRad) * Math.cos(raRad);
        positions[idx*3+1] = r * Math.sin(decRad);
        positions[idx*3+2] = -r * Math.cos(decRad) * Math.sin(raRad);
        const c = new THREE.Color(s[2]);
        colors[idx*3] = c.r; colors[idx*3+1] = c.g; colors[idx*3+2] = c.b;
    });

    // Background celestial sphere stars
    for (let i = brightStars.length; i < totalStars; i++) {
        const r = 160 + Math.random() * 140;
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
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.45, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })));
})();

// --- B. LIGHTING ---
scene.add(new THREE.AmbientLight(0xffffff, 0.22));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
scene.add(sunLight);

// --- C. PHOTOREALISTIC EARTH + REALISTIC SUN-LIT CLOUDS ---
const texLoader = new THREE.TextureLoader();
const earthDayTex = texLoader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
const earthNightTex = texLoader.load('https://unpkg.com/three-globe/example/img/earth-night.jpg');
const earthWaterTex = texLoader.load('https://unpkg.com/three-globe/example/img/earth-water.png');
const earthCloudsTex = texLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png');

const earthUniforms = {
    dayTexture: { value: earthDayTex },
    nightTexture: { value: earthNightTex },
    specularTexture: { value: earthWaterTex },
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
            vec3 nightCol = texture2D(nightTexture, vUv).rgb * 1.45;
            float waterMask = texture2D(specularTexture, vUv).r;

            float NdotL = dot(N, L);
            float dayFactor = smoothstep(-0.14, 0.22, NdotL);

            vec3 H = normalize(L + V);
            float spec = pow(max(dot(N, H), 0.0), 36.0) * waterMask * max(NdotL, 0.0) * 0.52;

            float twilight = exp(-pow(NdotL * 6.5, 2.0)) * 0.28;
            vec3 twilightCol = vec3(1.0, 0.42, 0.14) * twilight;

            float satDot = dot(N, normalize(satDir));
            float inSwath = smoothstep(satSpotCos - 0.015, satSpotCos + 0.015, satDot);
            float nightOnly = 1.0 - dayFactor;
            vec3 satDaylight = dayCol * 0.92 * inSwath * nightOnly;

            vec3 finalCol = mix(nightCol, dayCol * (0.25 + 0.85 * max(NdotL, 0.0)), dayFactor) + twilightCol + vec3(spec) + satDaylight;

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
scene.add(earthMesh);

// Realistic Sun-Lit Cloud Shader (Darkens naturally on the night side instead of glowing white!)
const cloudShaderMat = new THREE.ShaderMaterial({
    uniforms: {
        cloudTexture: { value: earthCloudsTex },
        sunDir: earthUniforms.sunDir
    },
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
            float NdotL = dot(normalize(vWorldNormal), normalize(sunDir));
            float light = smoothstep(-0.2, 0.35, NdotL);
            vec3 col = mix(vec3(0.04, 0.06, 0.12), vec3(1.0, 0.99, 0.97), light);
            float alpha = c.r * (0.12 + 0.55 * light);
            gl_FragColor = vec4(col, alpha);
        }
    `,
    transparent: true,
    depthWrite: false
});
const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(1.008, 48, 48), cloudShaderMat);
scene.add(cloudMesh);

// Volumetric Fresnel Atmosphere Rim-Glow
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
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    depthWrite: false
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.032, 48, 48), atmosMat));

// --- D. REAL-TIME SOLAR SYSTEM (SUN, MOON & PLANETS BY KEPLERIAN EPHEMERIS) ---
const solarSystemGroup = new THREE.Group();
scene.add(solarSystemGroup);

// 1. The Sun (Positioned dynamically along liveSunDir)
const sunGroup = new THREE.Group();
const sunCore = new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 32), new THREE.MeshBasicMaterial({ color: 0xfff7ed }));
const sunCorona = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })
);
sunGroup.add(sunCore);
sunGroup.add(sunCorona);
solarSystemGroup.add(sunGroup);

// 2. The Moon (Real-time synodic lunar phase around Earth)
const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.92, metalness: 0.05 })
);
solarSystemGroup.add(moonMesh);

// 3. Real-Time Major Planets (J2000 Mean Longitude + Orbital Period in Days)
const PLANET_DATA = [
    { name: 'Mercury', r: 0.16, dist: 14, color: 0x9ca3af, L0: 252.25, period: 87.97 },
    { name: 'Venus',   r: 0.26, dist: 18, color: 0xfde68a, L0: 181.98, period: 224.70 },
    { name: 'Mars',    r: 0.22, dist: 23, color: 0xea580c, L0: 355.45, period: 686.98 },
    { name: 'Jupiter', r: 0.72, dist: 31, color: 0xd97706, L0: 34.40,  period: 4332.59 },
    { name: 'Saturn',  r: 0.62, dist: 39, color: 0xfcd34d, L0: 49.94,  period: 10759.22, rings: true },
    { name: 'Uranus',  r: 0.42, dist: 46, color: 0x67e8f9, L0: 313.23, period: 30688.5 },
    { name: 'Neptune', r: 0.40, dist: 52, color: 0x3b82f6, L0: 304.88, period: 60182.0 }
];

const planetMeshes = [];
(function buildPlanets() {
    const days = getDaysSinceJ2000();
    PLANET_DATA.forEach(p => {
        const pGroup = new THREE.Group();
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(p.r, 24, 24),
            new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.7, metalness: 0.1 })
        );
        pGroup.add(mesh);

        if (p.rings) {
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(p.r * 1.35, p.r * 2.25, 36),
                new THREE.MeshBasicMaterial({ color: 0xe2c799, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
            );
            ring.rotation.x = Math.PI / 2.3;
            pGroup.add(ring);
        }

        // Compute real-time heliocentric angle for today's UTC date
        const angleDeg = (p.L0 + (360 / p.period) * days) % 360;
        const rad = angleDeg * Math.PI / 180;
        pGroup.position.set(Math.cos(rad) * p.dist, (Math.sin(rad * 2) * 1.2), -Math.sin(rad) * p.dist);
        solarSystemGroup.add(pGroup);
        planetMeshes.push(pGroup);
    });
})();

// --- E. REALISTIC SPACE METEORS / SHOOTING STARS ---
const meteors = [];
function spawnMeteor() {
    if (!showMeteors || meteors.length >= 3) return;
    const start = new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 18, -10 - Math.random() * 25);
    const dir = new THREE.Vector3((Math.random() - 0.5) * 2, -0.4 - Math.random() * 0.8, (Math.random() - 0.5) * 2).normalize();
    const len = 1.2 + Math.random() * 1.8;
    const pts = [new THREE.Vector3(0, 0, 0), dir.clone().multiplyScalar(-len)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.95 });
    const line = new THREE.Line(geo, mat);
    line.position.copy(start);
    scene.add(line);
    meteors.push({ mesh: line, vel: dir.multiplyScalar(18 + Math.random() * 14), life: 1.0 });
}
setInterval(spawnMeteor, 2600);

// --- F. VISIBLE ORBIT LINE (SUPPORTS ECCENTRICITY) ---
let orbitLineMesh;
function drawOrbitLine() {
    if (orbitLineMesh) scene.remove(orbitLineMesh);
    const orbitPoints = [];
    const inclRad = orbitInclination * Math.PI / 180;
    for (let i = 0; i <= 200; i++) {
        const t = (i / 200) * Math.PI * 2;
        const r = orbitRadius * (1 - orbitEccentricity * orbitEccentricity) / (1 + orbitEccentricity * Math.cos(t));
        orbitPoints.push(new THREE.Vector3(
            Math.cos(t) * r,
            Math.sin(t) * Math.sin(inclRad) * r,
            Math.sin(t) * Math.cos(inclRad) * r
        ));
    }
    orbitLineMesh = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(orbitPoints),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 })
    );
    orbitLineMesh.visible = !isGeoLocked && !isISSMode;
    scene.add(orbitLineMesh);
}
drawOrbitLine();

// --- G. REALISTIC PROPORTIONAL VK-TRACKER-01 SATELLITE ---
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
scene.add(vkSatGroup);

// --- H. REALISTIC INTERNATIONAL SPACE STATION (ISS) 3D MODEL ---
const issGroup = new THREE.Group();
const issWhiteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.45, roughness: 0.35 });
const issTrussMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.3 });
const issSolarMat = new THREE.MeshStandardMaterial({ color: 0xb45309, emissive: 0x451a03, metalness: 0.75, roughness: 0.25, side: THREE.DoubleSide });
const issSolarGrid = new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true, transparent: true, opacity: 0.25 });

// Main Integrated Truss Backbone (Spans X-axis)
const mainTruss = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.012, 0.012), issTrussMat);
issGroup.add(mainTruss);

// Pressurized Cylindrical Modules (Zvezda, Zarya, Unity, Destiny, Harmony along Z-axis)
const coreModules = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 16), issWhiteMat);
coreModules.rotation.x = Math.PI / 2;
issGroup.add(coreModules);

// Columbus & Kibo Lab Cross-Modules
const labModules = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 16), issWhiteMat);
labModules.rotation.z = Math.PI / 2;
labModules.position.z = 0.045;
issGroup.add(labModules);

// White Thermal Radiator Panels
const radL = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.002, 0.075), issWhiteMat);
radL.position.set(-0.09, 0.015, -0.04); issGroup.add(radL);
const radR = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.002, 0.075), issWhiteMat);
radR.position.set(0.09, 0.015, -0.04); issGroup.add(radR);

// 8 Large Copper-Gold ISS Solar Array Wings (4 Port, 4 Starboard)
[-0.25, -0.18, 0.18, 0.25].forEach(xPos => {
    [-1, 1].forEach(zSide => {
        const wingGeo = new THREE.BoxGeometry(0.042, 0.002, 0.15);
        const wing = new THREE.Mesh(wingGeo, issSolarMat);
        wing.position.set(xPos, 0, zSide * 0.088);
        issGroup.add(wing);
        const grid = new THREE.Mesh(wingGeo, issSolarGrid);
        grid.position.set(xPos, 0, zSide * 0.088);
        issGroup.add(grid);
    });
});

issGroup.scale.setScalar(issScale);
issGroup.visible = false;
scene.add(issGroup);

let activeSpacecraft = vkSatGroup;

// --- 3D EVENT BEACONS ---
let markerMeshes = [];
let mapMarkers = [];
function renderIntelMarkers() {
    markerMeshes.forEach(m => earthMesh.remove(m));
    markerMeshes = [];
    mapMarkers.forEach(m => map.removeLayer(m));
    mapMarkers = [];

    liveIntelData.forEach(data => {
        const localPos = latLonToLocalEarthPosition(data.lat, data.lon, 1.0);
        let color = 0xef4444, hexColor = '#ef4444';
        if (data.type === 'eonet') { color = 0xf59e0b; hexColor = '#f59e0b'; }
        if (data.type === 'rw') { color = 0xd946ef; hexColor = '#d946ef'; }
        
        const beacon = new THREE.Group();
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
        pillar.position.y = 0.06; beacon.add(pillar);
        
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.022, 16), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.003; beacon.add(ring);
        
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

// --- 2D LEAFLET MAP + RAINVIEWER RADAR ---
const map = L.map('map-viewport', { zoomControl: false, attributionControl: false }).setView([20, 78], 3);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 17 }).addTo(map);
const satMarker = L.marker([0, 0], { icon: L.divIcon({ html: `<div style="width:16px;height:16px;background:#38bdf8;border-radius:50%;border:2px solid white;box-shadow:0 0 10px #38bdf8;"></div>`, className: '', iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(map);
const satCircle = L.circle([0, 0], { radius: 1056000, color: '#38bdf8', weight: 1, fillOpacity: 0.1 }).addTo(map);
map.on('click', e => parkSatelliteAt(e.latlng.lat, e.latlng.lng));

let rainRadarLayer = null;
async function toggleRainRadar() {
    isRainRadarOn = !isRainRadarOn;
    const btn = document.getElementById('btn-radar');
    const ind = document.getElementById('radar-ind');
    playSound('click');

    if (isRainRadarOn) {
        btn.classList.add('bg-emerald-900/50', 'border-emerald-400');
        ind.textContent = 'ON'; ind.classList.replace('text-slate-400', 'text-emerald-300');
        try {
            const rvData = await cachedFetchJSON('https://api.rainviewer.com/public/weather-maps.json', 300000);
            if (rvData && rvData.radar && rvData.radar.past && rvData.radar.past.length > 0) {
                const latest = rvData.radar.past[rvData.radar.past.length - 1];
                const tileUrl = `${rvData.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`;
                if (rainRadarLayer) map.removeLayer(rainRadarLayer);
                rainRadarLayer = L.tileLayer(tileUrl, { opacity: 0.65, maxNativeZoom: 7, maxZoom: 12 }).addTo(map);
                showToast('Live RainViewer Weather Radar Active');
            }
        } catch (e) {
            showToast('RainViewer Radar temporarily unavailable');
        }
    } else {
        btn.classList.remove('bg-emerald-900/50', 'border-emerald-400');
        ind.textContent = 'OFF'; ind.classList.replace('text-emerald-300', 'text-slate-400');
        if (rainRadarLayer) { map.removeLayer(rainRadarLayer); rainRadarLayer = null; }
        showToast('Rain Radar Disabled');
    }
}

// --- CURVED SURFACE SWATH FOOTPRINT & LASER CONE ---
let coneMesh, ringMesh;
function buildLaser() {
    if (coneMesh) scene.remove(coneMesh);
    if (ringMesh) scene.remove(ringMesh);

    const angularRad = swathRadius;
    const surfaceCircleRadius = Math.sin(angularRad) * 1.004;
    const surfaceZDist = Math.cos(angularRad) * 1.004;

    const cGeo = new THREE.ConeGeometry(surfaceCircleRadius, Math.max(0.1, orbitRadius - surfaceZDist), 24, 1, true);
    cGeo.translate(0, -Math.max(0.1, orbitRadius - surfaceZDist) / 2, 0);
    cGeo.rotateX(-Math.PI / 2);
    coneMesh = new THREE.Mesh(cGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.08, wireframe: true, depthWrite: false }));
    coneMesh.visible = showLaserCone;
    scene.add(coneMesh);

    const ringPts = [];
    for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        ringPts.push(new THREE.Vector3(Math.cos(a) * surfaceCircleRadius, Math.sin(a) * surfaceCircleRadius, surfaceZDist));
    }
    ringMesh = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(ringPts),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 })
    );
    ringMesh.visible = showLaserCone;
    scene.add(ringMesh);
    earthUniforms.satSpotCos.value = Math.cos(angularRad);
}
buildLaser();

// --- 3D DOUBLE-TAP RAYCASTER ---
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let lastTapTime = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
    const now = Date.now();
    if (now - lastTapTime < 320) {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObject(earthMesh);
        if (hits.length > 0) {
            const coords = worldPositionToLatLon(hits[0].point, earthMesh.rotation.y);
            parkSatelliteAt(coords.lat, coords.lon);
            showToast(`3D Lock: ${coords.lat.toFixed(2)}°, ${coords.lon.toFixed(2)}°`);
        }
    }
    lastTapTime = now;
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
    btn.textContent = `Live Clouds: ${showClouds ? 'ON' : 'OFF'}`;
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
    const btn = document.getElementById('btn-toggle-retro');
    btn.textContent = `Orbit: ${orbitDirection === 1 ? 'Prograde' : 'Retrograde'}`;
    playSound('click');
}

function updateEccentricity(val) {
    orbitEccentricity = parseFloat(val);
    document.getElementById('ecc-val').textContent = `${orbitEccentricity.toFixed(2)} ${orbitEccentricity === 0 ? '(Circular)' : '(Elliptical)'}`;
    drawOrbitLine();
}

function switchEngine(mode) {
    playSound('click'); activeEngine = mode;
    document.getElementById('globe-viewport').style.display = (mode === '3D') ? 'block' : 'none';
    document.getElementById('map-viewport').style.display = (mode === '2D') ? 'block' : 'none';
    document.getElementById('btn-cam-cycle').classList.toggle('hidden', mode !== '3D');
    document.getElementById('btn-solar-view').classList.toggle('hidden', mode !== '3D');
    document.getElementById('btn-radar').classList.toggle('hidden', mode !== '2D');
    document.getElementById('btn-3d').className = (mode === '3D') ? 'btn-active px-3 py-1.5 rounded text-[10px] font-bold' : 'px-3 py-1.5 rounded text-[10px] font-bold text-slate-400 hover:text-white';
    document.getElementById('btn-2d').className = (mode === '2D') ? 'btn-active px-3 py-1.5 rounded text-[10px] font-bold' : 'px-3 py-1.5 rounded text-[10px] font-bold text-slate-400 hover:text-white';
    if (mode === '2D') setTimeout(() => map.invalidateSize(), 100);
}

function cycleCamera() {
    playSound('click');
    camModeIdx = (camModeIdx + 1) % camModes.length;
    activeCamera = camModes[camModeIdx];
    const labels = { FREE: 'Free', CHASE: 'Follow', NADIR: 'Look Down' };
    document.getElementById('cam-label').textContent = labels[activeCamera];
}

const opticsNames = ['Standard Color', 'Thermal (Heat)', 'Night Vision', 'Radar (Wireframe)'];
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

// --- 10. FRAME-RATE INDEPENDENT ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    earthMesh.rotation.y += 0.008 * dt;
    cloudMesh.rotation.y += 0.011 * dt;

    // Real-Time UTC Sun & Moon Positions
    const liveSunDir = getRealTimeSunDirection(earthMesh.rotation.y);
    earthUniforms.sunDir.value.copy(liveSunDir);
    sunLight.position.copy(liveSunDir).multiplyScalar(15);
    sunGroup.position.copy(liveSunDir).multiplyScalar(68);

    // Moon synodic orbit (29.53 days)
    const moonPhaseRad = ((getDaysSinceJ2000() % 29.53059) / 29.53059) * Math.PI * 2;
    moonMesh.position.set(Math.cos(moonPhaseRad) * 6.8, Math.sin(moonPhaseRad) * 0.6, -Math.sin(moonPhaseRad) * 6.8);
    moonMesh.rotation.y += 0.02 * dt;

    // Update Meteors
    for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.mesh.position.addScaledVector(m.vel, dt);
        m.life -= dt * 0.85;
        m.mesh.material.opacity = Math.max(0, m.life);
        if (m.life <= 0) {
            scene.remove(m.mesh);
            meteors.splice(i, 1);
        }
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

    // Align laser cone & curved surface swath ring to active spacecraft
    coneMesh.position.copy(activeSpacecraft.position);
    coneMesh.lookAt(0,0,0);
    ringMesh.lookAt(activeSpacecraft.position);
    earthUniforms.satDir.value.copy(activeSpacecraft.position).normalize();

    const strobe = Math.floor(Date.now() / 550) % 2 === 0;
    navBeaconRed.visible = strobe;
    navBeaconGreen.visible = !strobe;

    document.getElementById('hud-time').textContent = 'UTC ' + new Date().toISOString().substr(11,8);

    // Camera Modes
    if (activeCamera === 'FREE') {
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

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (activeEngine === '2D') map.invalidateSize();
});

// Boot initialization
updateSpeed(document.getElementById('speed-slider').value);
setTimeout(() => {
    fetchLiveIntel(true);
    const coords = worldPositionToLatLon(activeSpacecraft.position, earthMesh.rotation.y);
    fetchSubSatData(coords.lat, coords.lon, true);
}, 350);

animate();
