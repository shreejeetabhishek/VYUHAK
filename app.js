// --- AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    if(type === 'click') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        osc.start(); osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'lock') {
        osc.type = 'square'; osc.frequency.setValueAtTime(440, audioCtx.currentTime); osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.05); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'alert') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(220, audioCtx.currentTime); osc.frequency.setValueAtTime(440, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05); gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    }
    osc.connect(gain); gain.connect(audioCtx.destination);
}

// --- EXACT SPHERICAL COORDINATE CONVERSIONS ---
function latLonToWorldPosition(latDeg, lonDeg, radius, earthRotationY) {
    const latRad = latDeg * Math.PI / 180;
    const lonRad = (lonDeg * Math.PI / 180) + earthRotationY;
    const x = radius * Math.cos(latRad) * Math.cos(lonRad);
    const y = radius * Math.sin(latRad);
    const z = -radius * Math.cos(latRad) * Math.sin(lonRad);
    return new THREE.Vector3(x, y, z);
}

function worldPositionToLatLon(pos, earthRotationY) {
    const r = pos.length();
    if (r === 0) return { lat: 0, lon: 0 };
    const latRad = Math.asin(Math.max(-1, Math.min(1, pos.y / r)));
    const worldLonRad = Math.atan2(-pos.z, pos.x);
    let lonDeg = ((worldLonRad - earthRotationY) * 180 / Math.PI) % 360;
    if (lonDeg < -180) lonDeg += 360;
    if (lonDeg > 180) lonDeg -= 360;
    const latDeg = latRad * 180 / Math.PI;
    return { lat: latDeg, lon: lonDeg };
}

function latLonToLocalEarthPosition(latDeg, lonDeg, radius) {
    return latLonToWorldPosition(latDeg, lonDeg, radius, 0);
}

// Compute 5-Point Satellite Swath Grid (Center, North, South, East, West at 55% swath radius)
function getSwathSamplePoints(centerLat, centerLon, radiusKm) {
    const sampleDistKm = Math.max(120, radiusKm * 0.55);
    const dLat = sampleDistKm / 111.0;
    const cosLat = Math.max(0.2, Math.cos(centerLat * Math.PI / 180));
    const dLon = sampleDistKm / (111.0 * cosLat);

    const clampLat = (l) => Math.max(-85, Math.min(85, l));
    const wrapLon = (ln) => {
        let v = ln % 360;
        if (v < -180) v += 360;
        if (v > 180) v -= 360;
        return v;
    };

    return [
        { label: "Center", lat: centerLat, lon: centerLon },
        { label: "North Sector", lat: clampLat(centerLat + dLat), lon: centerLon },
        { label: "South Sector", lat: clampLat(centerLat - dLat), lon: centerLon },
        { label: "East Sector", lat: centerLat, lon: wrapLon(centerLon + dLon) },
        { label: "West Sector", lat: centerLat, lon: wrapLon(centerLon - dLon) }
    ];
}

// --- STATE VARIABLES ---
let isDockExpanded = false;
let currentTab = 'intel';
let isGeoLocked = false;
let lockedLat = 20.84;
let lockedLon = 85.10;

function calcOrbitRadius(km) {
    return 1.28 + (parseFloat(km) / 6371) * 0.9;
}

let orbitTime = -1.35;
let currentAltitudeKm = 1200;
let orbitRadius = calcOrbitRadius(currentAltitudeKm);
let orbitSpeed = 0.003;
let orbitInclination = 45;
let swathRadius = 0.25; 
let activeEngine = '3D', activeCamera = 'FREE';
let lastScannedTime = 0;

// --- EXPANDED GLOBAL SOVEREIGN DEMOGRAPHICS DATABASE (INSTANT 0ms LOOKUP) ---
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
    "NA": { name: "Namibia", pop: 2604172, cap: "Windhoek", cur: "Namibian Dollar (N$)", area: 825615, tz: "UTC+02:00" },
    "BW": { name: "Botswana", pop: 2675352, cap: "Gaborone", cur: "Botswana Pula (P)", area: 581730, tz: "UTC+02:00" },
    "AO": { name: "Angola", pop: 36684202, cap: "Luanda", cur: "Angolan Kwanza (Kz)", area: 1246700, tz: "UTC+01:00" },
    "ZM": { name: "Zambia", pop: 20569737, cap: "Lusaka", cur: "Zambian Kwacha (ZK)", area: 752612, tz: "UTC+02:00" },
    "ZW": { name: "Zimbabwe", pop: 16665409, cap: "Harare", cur: "ZiG / USD ($)", area: 390757, tz: "UTC+02:00" },
    "TD": { name: "Chad", pop: 18278568, cap: "N'Djamena", cur: "Central African CFA Franc", area: 1284000, tz: "UTC+01:00" },
    "NG": { name: "Nigeria", pop: 223804632, cap: "Abuja", cur: "Nigerian Naira (₦)", area: 923768, tz: "UTC+01:00" },
    "EG": { name: "Egypt", pop: 112716598, cap: "Cairo", cur: "Egyptian Pound (E£)", area: 1002450, tz: "UTC+02:00" },
    "ZA": { name: "South Africa", pop: 60414495, cap: "Pretoria", cur: "South African Rand (R)", area: 1221037, tz: "UTC+02:00" },
    "KE": { name: "Kenya", pop: 55100586, cap: "Nairobi", cur: "Kenyan Shilling (KSh)", area: 580367, tz: "UTC+03:00" },
    "ET": { name: "Ethiopia", pop: 126527060, cap: "Addis Ababa", cur: "Ethiopian Birr (Br)", area: 1104300, tz: "UTC+03:00" },
    "SD": { name: "Sudan", pop: 48109006, cap: "Khartoum", cur: "Sudanese Pound (SDG)", area: 1886068, tz: "UTC+02:00" },
    "CD": { name: "DR Congo", pop: 102262808, cap: "Kinshasa", cur: "Congolese Franc (FC)", area: 2344858, tz: "UTC+01:00" },
    "TZ": { name: "Tanzania", pop: 67438106, cap: "Dodoma", cur: "Tanzanian Shilling (TSh)", area: 945087, tz: "UTC+03:00" },
    "MA": { name: "Morocco", pop: 37840044, cap: "Rabat", cur: "Moroccan Dirham (MAD)", area: 446550, tz: "UTC+01:00" },
    "DZ": { name: "Algeria", pop: 45606480, cap: "Algiers", cur: "Algerian Dinar (DA)", area: 2381741, tz: "UTC+01:00" },
    "LY": { name: "Libya", pop: 6888388, cap: "Tripoli", cur: "Libyan Dinar (LD)", area: 1759540, tz: "UTC+02:00" },
    "NE": { name: "Niger", pop: 27202843, cap: "Niamey", cur: "West African CFA Franc", area: 1267000, tz: "UTC+01:00" },
    "ML": { name: "Mali", pop: 23293698, cap: "Bamako", cur: "West African CFA Franc", area: 1240192, tz: "UTC+00:00" },
    "ID": { name: "Indonesia", pop: 277534122, cap: "Jakarta", cur: "Indonesian Rupiah (Rp)", area: 1904569, tz: "UTC+07:00" },
    "PK": { name: "Pakistan", pop: 240485658, cap: "Islamabad", cur: "Pakistani Rupee (₨)", area: 881912, tz: "UTC+05:00" },
    "BD": { name: "Bangladesh", pop: 172954319, cap: "Dhaka", cur: "Bangladeshi Taka (৳)", area: 147570, tz: "UTC+06:00" },
    "MX": { name: "Mexico", pop: 128455567, cap: "Mexico City", cur: "Mexican Peso ($)", area: 1964375, tz: "UTC-06:00" },
    "TR": { name: "Turkey", pop: 85816199, cap: "Ankara", cur: "Turkish Lira (₺)", area: 783562, tz: "UTC+03:00" },
    "IR": { name: "Iran", pop: 89172767, cap: "Tehran", cur: "Iranian Rial (﷼)", area: 1648195, tz: "UTC+03:30" },
    "SA": { name: "Saudi Arabia", pop: 36947025, cap: "Riyadh", cur: "Saudi Riyal (SR)", area: 2149690, tz: "UTC+03:00" },
    "AE": { name: "United Arab Emirates", pop: 9516871, cap: "Abu Dhabi", cur: "UAE Dirham (AED)", area: 83600, tz: "UTC+04:00" },
    "UA": { name: "Ukraine", pop: 36744634, cap: "Kyiv", cur: "Ukrainian Hryvnia (₴)", area: 603500, tz: "UTC+02:00" },
    "IL": { name: "Israel", pop: 9174520, cap: "Jerusalem", cur: "Israeli New Shekel (₪)", area: 20770, tz: "UTC+02:00" },
    "AR": { name: "Argentina", pop: 45773884, cap: "Buenos Aires", cur: "Argentine Peso ($)", area: 2780400, tz: "UTC-03:00" },
    "CL": { name: "Chile", pop: 19629590, cap: "Santiago", cur: "Chilean Peso ($)", area: 756102, tz: "UTC-04:00" },
    "CO": { name: "Colombia", pop: 52085168, cap: "Bogotá", cur: "Colombian Peso ($)", area: 1141748, tz: "UTC-05:00" },
    "PE": { name: "Peru", pop: 34352719, cap: "Lima", cur: "Peruvian Sol (S/)", area: 1285216, tz: "UTC-05:00" },
    "VE": { name: "Venezuela", pop: 28838499, cap: "Caracas", cur: "Venezuelan Bolívar", area: 916445, tz: "UTC-04:00" },
    "IT": { name: "Italy", pop: 58870762, cap: "Rome", cur: "Euro (€)", area: 301336, tz: "UTC+01:00" },
    "ES": { name: "Spain", pop: 47519628, cap: "Madrid", cur: "Euro (€)", area: 505992, tz: "UTC+01:00" },
    "PL": { name: "Poland", pop: 41026067, cap: "Warsaw", cur: "Polish Złoty (zł)", area: 312679, tz: "UTC+01:00" },
    "KR": { name: "South Korea", pop: 51784059, cap: "Seoul", cur: "South Korean Won (₩)", area: 100210, tz: "UTC+09:00" },
    "TH": { name: "Thailand", pop: 71801279, cap: "Bangkok", cur: "Thai Baht (฿)", area: 513120, tz: "UTC+07:00" },
    "VN": { name: "Vietnam", pop: 98858950, cap: "Hanoi", cur: "Vietnamese Đồng (₫)", area: 331212, tz: "UTC+07:00" },
    "PH": { name: "Philippines", pop: 117337368, cap: "Manila", cur: "Philippine Peso (₱)", area: 342353, tz: "UTC+08:00" },
    "MY": { name: "Malaysia", pop: 34308525, cap: "Kuala Lumpur", cur: "Malaysian Ringgit (RM)", area: 330803, tz: "UTC+08:00" },
    "MM": { name: "Myanmar", pop: 54577997, cap: "Naypyidaw", cur: "Myanmar Kyat (K)", area: 676578, tz: "UTC+06:30" },
    "NP": { name: "Nepal", pop: 30896590, cap: "Kathmandu", cur: "Nepalese Rupee (₨)", area: 147181, tz: "UTC+05:45" },
    "LK": { name: "Sri Lanka", pop: 21893579, cap: "Colombo / Sri Jayawardenepura", cur: "Sri Lankan Rupee (Rs)", area: 65610, tz: "UTC+05:30" }
};

// --- UI LOGIC ---
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
    if(tabName === 'intel') document.getElementById('intel-badge').classList.add('hidden');
    if(tabName === 'weather') {
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
        document.getElementById('hud-sat-name').textContent = 'VK-Tracker-01';
        if (orbitLineMesh) orbitLineMesh.visible = true;
        const speedVal = document.getElementById('speed-slider').value;
        updateSpeed(speedVal);
    }
}

function toggleGeoLock() {
    isGeoLocked = !isGeoLocked;
    if(isGeoLocked) {
        const exactCoords = worldPositionToLatLon(satGroup.position, earthMesh.rotation.y);
        lockedLat = exactCoords.lat;
        lockedLon = exactCoords.lon;
        document.getElementById('hud-lat').textContent = lockedLat.toFixed(2);
        document.getElementById('hud-lon').textContent = lockedLon.toFixed(2);
        updateLockUI(true);
        playSound('lock');
        fetchSubSatData(lockedLat, lockedLon, true);
    } else {
        updateLockUI(false);
        playSound('click');
    }
}

// --- API ENGINE (MULTI-POINT FULL SWATH AGGREGATION) ---
const API_ENDPOINTS = {
    EARTHQUAKES: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
    EONET: 'https://eonet.gsfc.nasa.gov/api/v3/events?limit=15&days=10',
    NEWS_GLOBAL: 'https://api.rss2json.com/v1/api.json?rss_url=http://feeds.bbci.co.uk/news/world/rss.xml',
    NEWS_REGIONAL_RSS2JSON: (query) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-US&gl=US&ceid=US:en')}`,
    GDELT_NEWS: (query) => `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=5&format=json&sort=DateDesc`,
    WIKI_SEARCH: (query) => `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*&srlimit=5`,
    RELIEFWEB_GLOBAL: 'https://api.reliefweb.int/v1/disasters?appname=vyuhak&preset=latest&profile=full&limit=8',
    RELIEFWEB_COUNTRY: (country) => `https://api.reliefweb.int/v1/reports?appname=vyuhak&query[value]=${encodeURIComponent(country)}&limit=3`,
    WEATHER: (lat, lon) => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=relativehumidity_2m&current_weather=true`,
    REVGEO: (lat, lon) => `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    COUNTRY_ALPHA: (code) => `https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}?fields=name,population,capital,currencies,area,timezones`,
    COUNTRY_NAME: (name) => `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=name,population,capital,currencies,area,timezones`,
    WIKI_GEO: (lat, lon, rad) => `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=${rad}&gslimit=4&format=json&origin=*`,
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
let apiCooldown = false;

async function fetchLiveIntel(force = false) {
    if(apiCooldown && !force) return;
    apiCooldown = true;
    setTimeout(() => { apiCooldown = false; }, 10000); 
    
    document.getElementById('connection-led').classList.add('recording');
    const feed = document.getElementById('intel-feed');
    feed.innerHTML = '<div class="text-center p-4 text-[12px] text-sky-400 font-bold loading-pulse">Scanning global networks for breaking events...</div>';
    
    liveIntelData = [];
    let newItemsHTML = '';
    let alertCount = 0;

    try {
        const [eqRes, eoRes, rwRes, newsRes] = await Promise.allSettled([
            fetch(API_ENDPOINTS.EARTHQUAKES).then(r => r.json()),
            fetch(API_ENDPOINTS.EONET).then(r => r.json()),
            fetch(API_ENDPOINTS.RELIEFWEB_GLOBAL).then(r => r.json()),
            fetch(API_ENDPOINTS.NEWS_GLOBAL).then(r => r.json())
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
                        <div class="text-[12px] font-bold text-red-400 mb-1">Earthquake (Magnitude ${mag})</div>
                        <div class="text-[11px] text-slate-200">${place}</div>
                        <div class="text-[10px] text-sky-400 mt-1 font-semibold">Tap to lock satellite & view Ground Data &rarr;</div>
                    </div>
                </div>`;
            });
        }

        if (eoRes.status === 'fulfilled' && eoRes.value.events) {
            eoRes.value.events.slice(0, 4).forEach(ev => {
                if(ev.geometry && ev.geometry.length > 0) {
                    alertCount++;
                    const title = ev.title;
                    const coords = ev.geometry[0].coordinates;
                    let lon = coords[0], lat = coords[1];
                    if(Array.isArray(lon)) { lon = coords[0][0][0]; lat = coords[0][0][1]; } 
                    liveIntelData.push({ type: 'eonet', lat, lon, title: title });
                    newItemsHTML += `
                    <div class="api-item bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 flex gap-3 items-start cursor-pointer hover:bg-amber-900/40 transition" onclick="parkSatelliteAt(${lat}, ${lon})">
                        <div class="text-xl">🔥</div>
                        <div>
                            <div class="text-[12px] font-bold text-amber-400 mb-1">Active Wildfire / Storm</div>
                            <div class="text-[11px] text-slate-200">${title}</div>
                            <div class="text-[10px] text-sky-400 mt-1 font-semibold">Tap to lock satellite & view Ground Data &rarr;</div>
                        </div>
                    </div>`;
                }
            });
        }

        if (rwRes.status === 'fulfilled' && rwRes.value.data) {
            rwRes.value.data.slice(0, 4).forEach(d => {
                if(d.fields && d.fields.primary_country && d.fields.primary_country.location) {
                    alertCount++;
                    const lat = d.fields.primary_country.location.lat;
                    const lon = d.fields.primary_country.location.lon;
                    const title = d.fields.name;
                    liveIntelData.push({ type: 'rw', lat, lon, title: title });
                    newItemsHTML += `
                    <div class="api-item bg-fuchsia-900/20 border border-fuchsia-500/30 rounded-lg p-3 flex gap-3 items-start cursor-pointer hover:bg-fuchsia-900/40 transition" onclick="parkSatelliteAt(${lat}, ${lon})">
                        <div class="text-xl">⚠️</div>
                        <div>
                            <div class="text-[12px] font-bold text-fuchsia-400 mb-1">Conflict / Humanitarian Crisis</div>
                            <div class="text-[11px] text-slate-200">${title}</div>
                            <div class="text-[10px] text-sky-400 mt-1 font-semibold">Tap to lock satellite & view Ground Data &rarr;</div>
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
                        <div class="text-[12px] font-bold text-blue-400 mb-1">World Headline</div>
                        <div class="text-[11px] text-slate-200">${n.title}</div>
                    </div>
                </div>`;
            });
        }

        feed.innerHTML = newItemsHTML || '<div class="text-center p-4 text-[12px] text-slate-500">No major global alerts right now.</div>';
        
        const badge = document.getElementById('intel-badge');
        if (alertCount > 0) {
            badge.textContent = alertCount;
            badge.classList.remove('hidden');
        }
        
        renderIntelMarkers();
    } catch(e) {
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
    const swathAreaKm2 = Math.round(Math.PI * swathKm * swathKm);

    // 5-Point Full Swath Sampling Grid (Center, North, South, East, West)
    const samplePoints = getSwathSamplePoints(numLat, numLon, swathKm);

    document.getElementById('weather-loc').textContent = `Center: ${numLat.toFixed(2)}°, ${numLon.toFixed(2)}° | Swath Radius: ${swathKm} km (5-Point Array)`;
    document.getElementById('connection-led').classList.add('recording');

    // Clear stale "0 (Oceanic)" or old metrics immediately when starting a new scan!
    document.getElementById('reg-pop').textContent = "Scanning...";
    document.getElementById('reg-cap').textContent = "Scanning...";
    document.getElementById('reg-cur').textContent = "Scanning...";
    document.getElementById('reg-area').textContent = `${swathAreaKm2.toLocaleString()} km²`;
    document.getElementById('reg-dens').textContent = "Scanning...";
    document.getElementById('reg-tz').textContent = "Scanning...";

    // 1. Fetch Weather + 5-Point Reverse Geocoding in Parallel
    const weatherPromise = fetch(API_ENDPOINTS.WEATHER(numLat, numLon)).then(r => r.json()).catch(() => null);
    const multiGeoPromises = Promise.allSettled(
        samplePoints.map(pt => fetch(API_ENDPOINTS.REVGEO(pt.lat, pt.lon)).then(r => r.json()))
    );

    weatherPromise.then(wData => {
        if (scanId !== currentScanId || !wData) return;
        let temp = '--', wind = '--', hum = '--', code = 0;
        if (wData.current) {
            temp = wData.current.temperature_2m;
            wind = wData.current.wind_speed_10m;
            hum = wData.current.relative_humidity_2m;
            code = wData.current.weather_code;
        } else if (wData.current_weather) {
            temp = wData.current_weather.temperature;
            wind = wData.current_weather.windspeed;
            code = wData.current_weather.weathercode;
            hum = (wData.hourly && wData.hourly.relativehumidity_2m) ? wData.hourly.relativehumidity_2m[0] : Math.round(45 + Math.abs(Math.sin(numLat)) * 35);
        }
        document.getElementById('w-temp').innerHTML = `${temp} &deg;C`;
        document.getElementById('w-wind').innerHTML = `${wind} km/h`;
        document.getElementById('w-hum').innerHTML = `${hum}%`;
        document.getElementById('w-cond').textContent = decodeWeatherCode(code);
    });

    const geoResults = await multiGeoPromises;
    if (scanId !== currentScanId) return;
    document.getElementById('connection-led').classList.remove('recording');

    // Aggregate all countries, states/provinces, cities, oceans across all 5 points in the satellite footprint
    const countriesMap = new Map(); // code -> name
    const statesSet = new Set();
    const citiesSet = new Set();
    const oceansSet = new Set();
    const informativeList = [];
    const adminList = [];
    const sectorBreakdown = [];

    geoResults.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value) {
            const g = res.value;
            const ptLabel = samplePoints[idx].label;
            const cName = g.countryName || '';
            // CRITICAL FIX: BigDataCloud uses "NA" for Namibia, which JS treats as valid string, ensure uppercase trim
            const cCode = (g.countryCode || '').trim().toUpperCase();
            const st = g.principalSubdivision || '';
            const ct = g.city || g.locality || '';
            const inf = (g.localityInfo && g.localityInfo.informative) ? g.localityInfo.informative : [];
            const adm = (g.localityInfo && g.localityInfo.administrative) ? g.localityInfo.administrative : [];

            if (cName) {
                countriesMap.set(cCode || cName, cName);
                if (st) statesSet.add(st);
                if (ct && ct !== st) citiesSet.add(ct);
                sectorBreakdown.push(`<span class="text-slate-400">${ptLabel}:</span> <strong class="text-emerald-300">${ct ? ct + ', ' : ''}${st ? st + ', ' : ''}${cName}</strong>`);
            } else {
                const ocName = inf.length > 0 ? inf[0].name : 'Open Ocean';
                oceansSet.add(ocName);
                sectorBreakdown.push(`<span class="text-slate-400">${ptLabel}:</span> <strong class="text-sky-300">🌊 ${ocName}</strong>`);
            }

            inf.forEach(i => informativeList.push(i));
            adm.forEach(a => adminList.push(a));
        }
    });

    const uniqueCountryCodes = Array.from(countriesMap.keys());
    const uniqueCountries = Array.from(countriesMap.values());
    const uniqueStates = Array.from(statesSet);
    const uniqueCities = Array.from(citiesSet);
    const uniqueOceans = Array.from(oceansSet);

    if (uniqueCountries.length === 0) {
        // 100% Oceanic Swath
        const oceanTitle = uniqueOceans.join(', ') || 'International Waters';
        document.getElementById('geo-data').innerHTML = `
            <div class="text-sky-400 font-bold text-sm">🌊 Full Swath Maritime Sector: ${oceanTitle}</div>
            <div class="text-slate-300 text-xs mt-1">All 5 sensor points inside the ${swathKm} km footprint are over open water. Monitoring maritime weather, shipping lanes, and subsea seismic activity.</div>
        `;
        document.getElementById('reg-pop').textContent = "0 (Maritime Swath)";
        document.getElementById('reg-cap').textContent = "Int'l Waters";
        document.getElementById('reg-cur').textContent = "Maritime Trade";
        document.getElementById('reg-area').textContent = `${swathAreaKm2.toLocaleString()} km²`;
        document.getElementById('reg-dens').textContent = "0 / km²";
        document.getElementById('reg-tz').textContent = `UTC ${numLon >= 0 ? '+' : ''}${Math.round(numLon / 15)}h`;

        Promise.allSettled([
            fetchSwathNews([oceanTitle, "Maritime Shipping"], [], scanId),
            fetchSwathPublicInterest([], [], [], informativeList, adminList, scanId),
            checkFootprintConflicts(numLat, numLon, swathKm, [], scanId),
            fetchSwathLandmarks(samplePoints, oceanTitle, informativeList, scanId)
        ]);
    } else {
        // Land or Coastal Multi-Country Swath
        const countriesText = uniqueCountries.join(', ');
        const statesText = uniqueStates.slice(0, 6).join(', ');
        const oceanNote = uniqueOceans.length > 0 ? ` + Coastal Waters (<span class="text-sky-300">${uniqueOceans.slice(0, 2).join(', ')}</span>)` : '';

        document.getElementById('geo-data').innerHTML = `
            <div class="mb-1.5">
                <span class="text-[10px] uppercase tracking-wider bg-sky-900/60 text-sky-300 px-2 py-0.5 rounded font-bold">Swath Coverage</span>
                <span class="ml-1.5">Countries in Footprint: <strong class="text-emerald-400">${countriesText}</strong>${oceanNote}</span>
            </div>
            ${statesText ? `<div class="text-[11px] text-slate-300 mb-1.5"><strong>Covered States / Provinces:</strong> ${statesText}</div>` : ''}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px] bg-slate-950/60 p-2 rounded border border-slate-800/80 mb-2">
                ${sectorBreakdown.join('<div></div>')}
            </div>
            <div id="region-bio" class="text-[11px] text-slate-300 mt-1.5 leading-relaxed">Loading multi-region overview...</div>
        `;

        // Fire Multi-Country Demographics, Bio, Swath News, Public Interest, Conflicts, and Multi-Point Landmarks in Parallel!
        Promise.allSettled([
            fetchMultiCountryMetrics(uniqueCountryCodes, uniqueCountries, swathAreaKm2, numLon, scanId),
            fetchRegionBio(uniqueCities[0] || '', uniqueStates[0] || '', uniqueCountries[0], scanId),
            fetchSwathNews(uniqueStates, uniqueCountries, scanId),
            fetchSwathPublicInterest(uniqueCountries, uniqueStates, uniqueCities, informativeList, adminList, scanId),
            checkFootprintConflicts(numLat, numLon, swathKm, uniqueCountries, scanId),
            fetchSwathLandmarks(samplePoints, uniqueStates[0] || uniqueCountries[0], informativeList, scanId)
        ]);
    }
}

async function fetchMultiCountryMetrics(codes, names, swathAreaKm2, numLon, scanId) {
    let totalPop = 0;
    let totalCountryArea = 0;
    const capitals = [];
    const currencies = [];
    const timezones = [];

    // 1. Instant lookup from SOVEREIGN_DB first
    const missingCodes = [];
    codes.forEach((code, idx) => {
        if (SOVEREIGN_DB[code]) {
            const db = SOVEREIGN_DB[code];
            totalPop += db.pop;
            totalCountryArea += db.area;
            if (!capitals.includes(db.cap)) capitals.push(db.cap);
            if (!currencies.includes(db.cur)) currencies.push(db.cur);
            if (!timezones.includes(db.tz)) timezones.push(db.tz);
        } else {
            missingCodes.push({ code, name: names[idx] || code });
        }
    });

    // Render instant DB results right away if we have any
    if (totalPop > 0 && scanId === currentScanId) {
        document.getElementById('reg-pop').textContent = formatPopulation(totalPop);
        document.getElementById('reg-cap').textContent = capitals.slice(0, 3).join(' / ');
        document.getElementById('reg-cur').textContent = currencies.slice(0, 2).join(' / ');
        document.getElementById('reg-area').textContent = `${swathAreaKm2.toLocaleString()} km² Swath`;
        document.getElementById('reg-dens').textContent = totalCountryArea > 0 ? `${Math.round(totalPop / totalCountryArea).toLocaleString()} / km²` : 'N/A';
        document.getElementById('reg-tz').textContent = timezones.slice(0, 2).join(', ');
    }

    // 2. Fetch any remaining countries from REST Countries API
    if (missingCodes.length > 0) {
        const apiResults = await Promise.allSettled(
            missingCodes.map(async (item) => {
                let res = await fetch(API_ENDPOINTS.COUNTRY_ALPHA(item.code));
                if (!res.ok) res = await fetch(API_ENDPOINTS.COUNTRY_NAME(item.name));
                if (res.ok) return res.json();
                return null;
            })
        );

        apiResults.forEach(r => {
            if (r.status === 'fulfilled' && r.value) {
                const cInfo = Array.isArray(r.value) ? r.value[0] : r.value;
                if (cInfo) {
                    totalPop += (cInfo.population || 0);
                    totalCountryArea += (cInfo.area || 0);
                    const cap = cInfo.capital && cInfo.capital[0] ? cInfo.capital[0] : '';
                    if (cap && !capitals.includes(cap)) capitals.push(cap);
                    const curObj = cInfo.currencies ? Object.values(cInfo.currencies)[0] : null;
                    const cur = curObj ? `${curObj.name} (${curObj.symbol || ''})` : '';
                    if (cur && !currencies.includes(cur)) currencies.push(cur);
                    const tz = cInfo.timezones && cInfo.timezones[0] ? cInfo.timezones[0] : '';
                    if (tz && !timezones.includes(tz)) timezones.push(tz);
                }
            }
        });
    }

    if (scanId !== currentScanId) return;

    document.getElementById('reg-pop').textContent = totalPop > 0 ? formatPopulation(totalPop) : 'N/A';
    document.getElementById('reg-cap').textContent = capitals.length > 0 ? capitals.slice(0, 3).join(' / ') : 'N/A';
    document.getElementById('reg-cur').textContent = currencies.length > 0 ? currencies.slice(0, 2).join(' / ') : 'N/A';
    document.getElementById('reg-area').textContent = `${swathAreaKm2.toLocaleString()} km² Swath`;
    document.getElementById('reg-dens').textContent = (totalPop > 0 && totalCountryArea > 0) ? `${Math.round(totalPop / totalCountryArea).toLocaleString()} / km²` : 'N/A';
    document.getElementById('reg-tz').textContent = timezones.length > 0 ? timezones.slice(0, 2).join(', ') : `UTC ${numLon >= 0 ? '+' : ''}${Math.round(numLon / 15)}h`;
}

async function fetchRegionBio(city, state, ctry, scanId) {
    const candidates = [state, ctry, city].filter(Boolean);
    for (const placeName of candidates) {
        try {
            const sumRes = await fetch(API_ENDPOINTS.WIKI_SUMMARY(placeName));
            if (sumRes.ok) {
                const sumData = await sumRes.json();
                if (sumData.extract && sumData.type !== 'disambiguation' && !sumData.extract.includes('may refer to:') && scanId === currentScanId) {
                    const bioEl = document.getElementById('region-bio');
                    if (bioEl) bioEl.innerHTML = `<span class="text-sky-300 font-semibold">[${sumData.title || placeName} Dossier]:</span> ${sumData.extract}`;
                    return;
                }
            }
        } catch(e) {}
    }
}

async function fetchSwathNews(states, countries, scanId) {
    const newsContainer = document.getElementById('reg-news');
    const primaryCountry = countries[0] || '';
    const primaryState = states[0] || '';
    const queryList = [];

    if (primaryCountry) queryList.push(primaryCountry);
    if (countries[1]) queryList.push(countries[1]);
    if (primaryState && primaryState !== primaryCountry) queryList.push(`${primaryState} ${primaryCountry}`);

    let allArticles = [];
    const seenTitles = new Set();

    // 1. Query Google News RSS + GDELT concurrently for covered countries/states
    const promises = [];
    queryList.slice(0, 2).forEach(q => {
        promises.push(
            fetch(API_ENDPOINTS.NEWS_REGIONAL_RSS2JSON(q))
                .then(r => r.json())
                .then(d => ({ type: 'rss', query: q, items: (d && d.items) ? d.items : [] }))
                .catch(() => ({ type: 'rss', query: q, items: [] }))
        );
        promises.push(
            fetch(API_ENDPOINTS.GDELT_NEWS(q))
                .then(r => r.json())
                .then(d => ({
                    type: 'gdelt',
                    query: q,
                    items: (d && d.articles) ? d.articles.map(a => ({ title: a.title, link: a.url, pubDate: a.domain || 'Live Wire' })) : []
                }))
                .catch(() => ({ type: 'gdelt', query: q, items: [] }))
        );
    });

    const results = await Promise.allSettled(promises);
    if (scanId !== currentScanId) return;

    results.forEach(r => {
        if (r.status === 'fulfilled' && r.value && r.value.items) {
            r.value.items.forEach(item => {
                const cleanTitle = (item.title || '').replace(/ - .*$/, '').trim();
                if (cleanTitle && !seenTitles.has(cleanTitle)) {
                    seenTitles.add(cleanTitle);
                    allArticles.push({
                        title: cleanTitle,
                        link: item.link || '#',
                        pubDate: item.pubDate ? item.pubDate.split(' ')[0] : 'Live',
                        tag: r.value.query
                    });
                }
            });
        }
    });

    // 2. Guaranteed Fallback: If RSS2JSON and GDELT are rate-limited or blocked, pull live UN ReliefWeb & Global headlines for the country
    if (allArticles.length === 0 && primaryCountry) {
        try {
            const rwRes = await fetch(API_ENDPOINTS.RELIEFWEB_COUNTRY(primaryCountry));
            const rwData = await rwRes.json();
            if (rwData.data && rwData.data.length > 0) {
                rwData.data.forEach(rep => {
                    allArticles.push({
                        title: rep.fields.title,
                        link: `https://reliefweb.int/node/${rep.id}`,
                        pubDate: 'UN Dispatch',
                        tag: primaryCountry
                    });
                });
            }
        } catch(e) {}
    }

    if (allArticles.length === 0) {
        try {
            const gNews = await fetch(API_ENDPOINTS.NEWS_GLOBAL).then(r => r.json());
            if (gNews && gNews.items) {
                gNews.items.slice(0, 3).forEach(n => {
                    allArticles.push({
                        title: n.title,
                        link: n.link || '#',
                        pubDate: 'World Desk',
                        tag: primaryCountry || 'Global Swath'
                    });
                });
            }
        } catch(e) {}
    }

    if (scanId !== currentScanId) return;

    if (allArticles.length > 0) {
        let html = '';
        allArticles.slice(0, 5).forEach(art => {
            html += `
            <a href="${art.link}" target="_blank" class="block bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/60 rounded p-2.5 transition">
                <div class="text-sky-300 font-semibold text-[11px] leading-snug">📰 ${art.title}</div>
                <div class="text-[9px] text-slate-400 mt-1">Swath Sector: ${art.tag} &bull; ${art.pubDate} &bull; Tap to open report</div>
            </a>`;
        });
        newsContainer.innerHTML = html;
    } else {
        newsContainer.innerHTML = `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">Monitoring regional broadcast feeds across ${countries.join(', ') || 'swath'}.</div>`;
    }
}

async function fetchSwathPublicInterest(countries, states, cities, informative, admin, scanId) {
    const container = document.getElementById('reg-interest');
    let html = '';

    // 1. Deduplicated Geopolitical & Ecological Zones across the entire 5-point swath
    const tagSet = new Set();
    admin.forEach(a => {
        if (a.name && a.description && !a.name.includes('UTC')) {
            tagSet.add(`${a.name} (${a.description})`);
        }
    });
    informative.forEach(i => {
        if (i.name && i.description && !i.name.includes('UTC') && !i.name.includes('Century')) {
            tagSet.add(`${i.name} — ${i.description}`);
        }
    });

    const uniqueTags = Array.from(tagSet);
    if (uniqueTags.length > 0) {
        html += `
        <div class="bg-slate-900/60 border border-slate-800 rounded p-2.5">
            <div class="text-[10px] font-bold text-amber-300 uppercase mb-1">Geopolitical, Administrative & Ecological Zones in Swath</div>
            <div class="text-[11px] text-slate-300 leading-relaxed">${uniqueTags.slice(0, 8).join(' &bull; ')}</div>
        </div>`;
    }

    // 2. Query Wikipedia Search for Economy, Public Interest & Strategic Profile across covered states/countries
    const searchQuery = countries.length > 0 ? `${states.slice(0, 2).join(' ')} ${countries.slice(0, 2).join(' ')} economy geography`.trim() : '';
    if (searchQuery) {
        try {
            const wRes = await fetch(API_ENDPOINTS.WIKI_SEARCH(searchQuery));
            const wData = await wRes.json();
            if (scanId !== currentScanId) return;

            if (wData.query && wData.query.search && wData.query.search.length > 0) {
                const seen = new Set();
                wData.query.search.slice(0, 4).forEach(s => {
                    if (!seen.has(s.title)) {
                        seen.add(s.title);
                        const cleanSnippet = s.snippet.replace(/<\/?[^>]+(>|$)/g, "");
                        html += `
                        <div class="bg-slate-900/50 border border-slate-800/80 rounded p-2.5">
                            <div class="font-bold text-amber-400 text-[11px]">🔍 Public Interest: ${s.title}</div>
                            <div class="text-[11px] text-slate-300 mt-0.5 leading-snug">${cleanSnippet}...</div>
                        </div>`;
                    }
                });
            }
        } catch(e) {}
    }

    if (scanId === currentScanId) {
        container.innerHTML = html || `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">Standard civilian and ecological sector.</div>`;
    }
}

async function checkFootprintConflicts(lat, lon, radiusKm, countriesList, scanId) {
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

    if (countriesList && countriesList.length > 0) {
        const rwPromises = countriesList.slice(0, 2).map(c =>
            fetch(API_ENDPOINTS.RELIEFWEB_COUNTRY(c)).then(r => r.json()).then(d => ({ country: c, data: d.data || [] })).catch(() => null)
        );
        const rwResults = await Promise.allSettled(rwPromises);
        rwResults.forEach(res => {
            if (res.status === 'fulfilled' && res.value && res.value.data.length > 0) {
                res.value.data.slice(0, 2).forEach(rep => {
                    alertsHTML += `
                    <div class="bg-amber-950/30 border border-amber-500/30 rounded p-2.5">
                        <div class="font-bold text-amber-400">⚠️ UN Humanitarian / Security Report (${res.value.country})</div>
                        <div class="text-slate-200 mt-0.5">${rep.fields.title}</div>
                    </div>`;
                });
            }
        });
    }

    if (scanId !== currentScanId) return;

    if (!alertsHTML) {
        container.innerHTML = `<div class="bg-emerald-950/20 border border-emerald-500/30 rounded p-3 text-emerald-300 font-semibold">✅ No active wars, major earthquakes, or natural disasters detected within this ${radiusKm} km satellite footprint.</div>`;
    } else {
        container.innerHTML = alertsHTML;
    }
}

async function fetchSwathLandmarks(samplePoints, fallbackRegion, informative, scanId) {
    const wikiContainer = document.getElementById('wiki-data');
    try {
        // Query Wikipedia Geosearch at all 5 sample points across the satellite footprint concurrently!
        const geoPromises = samplePoints.map(pt =>
            fetch(API_ENDPOINTS.WIKI_GEO(pt.lat, pt.lon, 10000))
                .then(r => r.json())
                .then(d => ({ sector: pt.label, items: (d.query && d.query.geosearch) ? d.query.geosearch : [] }))
                .catch(() => ({ sector: pt.label, items: [] }))
        );

        const geoResults = await Promise.allSettled(geoPromises);
        if (scanId !== currentScanId) return;

        const seenPlaces = new Set();
        const placesList = [];

        geoResults.forEach(r => {
            if (r.status === 'fulfilled' && r.value.items) {
                r.value.items.forEach(item => {
                    if (!seenPlaces.has(item.title)) {
                        seenPlaces.add(item.title);
                        placesList.push({
                            title: item.title,
                            badge: `${r.value.sector} (${(item.dist / 1000).toFixed(1)} km)`
                        });
                    }
                });
            }
        });

        // Also supplement with regional cities/landmarks if sparse
        if (placesList.length < 4 && fallbackRegion) {
            try {
                const searchRes = await fetch(API_ENDPOINTS.WIKI_SEARCH(`cities OR landmarks OR national parks in ${fallbackRegion}`));
                const searchData = await searchRes.json();
                if (searchData.query && searchData.query.search) {
                    searchData.query.search.slice(0, 5).forEach(s => {
                        if (!seenPlaces.has(s.title)) {
                            seenPlaces.add(s.title);
                            placesList.push({
                                title: s.title,
                                badge: `Swath Landmark (${fallbackRegion})`
                            });
                        }
                    });
                }
            } catch(e) {}
        }

        // Add clean natural features (filtering out timezone strings like "Africa/Windhoek" or "Africa continent")
        const bannedWords = ['time zone', 'continent', 'century', 'utc'];
        informative.forEach(inf => {
            const desc = (inf.description || '').toLowerCase();
            if (inf.name && !seenPlaces.has(inf.name) && !inf.name.includes('/') && !bannedWords.some(b => desc.includes(b))) {
                seenPlaces.add(inf.name);
                placesList.push({
                    title: inf.name,
                    badge: inf.description || 'Geographic Feature'
                });
            }
        });

        if (scanId !== currentScanId) return;

        if (placesList.length > 0) {
            let wHtml = `<div class="grid grid-cols-1 gap-1.5">`;
            placesList.slice(0, 7).forEach(p => {
                wHtml += `
                <div class="bg-slate-900/60 border border-slate-800 rounded p-2 flex justify-between items-center">
                    <span class="font-semibold text-emerald-300">📍 ${p.title}</span>
                    <span class="text-[10px] text-slate-400">${p.badge}</span>
                </div>`;
            });
            wHtml += `</div>`;
            wikiContainer.innerHTML = wHtml;
        } else {
            wikiContainer.innerHTML = `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">Open terrain across ${fallbackRegion || 'swath'}.</div>`;
        }
    } catch(e) {
        if (scanId === currentScanId) {
            wikiContainer.innerHTML = `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">Landmark scanner offline.</div>`;
        }
    }
}

function applyManualCoords() {
    const lat = parseFloat(document.getElementById('manual-lat').value);
    const lon = parseFloat(document.getElementById('manual-lon').value);
    
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        alert("Please enter valid coordinates (Lat: -90 to 90, Lon: -180 to 180)");
        return;
    }
    parkSatelliteAt(lat, lon);
}

function parkSatelliteAt(lat, lon) {
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
    satGroup.position.copy(newPos);
    satGroup.lookAt(0,0,0);

    const groundTabBtn = document.querySelectorAll('.tab-btn')[1];
    if (!isDockExpanded || currentTab !== 'weather') {
        openTab('weather', groundTabBtn);
    } else {
        fetchSubSatData(lat, lon, true);
    }

    setTimeout(() => {
        const targetCamPos = satGroup.position.clone().multiplyScalar(1.65);
        camera.position.lerp(targetCamPos, 0.5);
        camera.lookAt(0,0,0);
    }, 60);
}

// --- 3D ENGINE & PHYSICS ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, window.innerWidth < window.innerHeight ? 4.3 : 2.8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('globe-viewport').appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.05;
controls.minDistance = 1.15; controls.maxDistance = 12;

scene.add(new THREE.AmbientLight(0xffffff, 0.12));
const sunDirVector = new THREE.Vector3(5, 2, 3).normalize();
const sunLight = new THREE.DirectionalLight(0xffffff, 1.35);
sunLight.position.set(5, 2, 3);
scene.add(sunLight);

// SMART ADAPTIVE SATELLITE SPOTLIGHT (Strictly night-side only: 0 intensity on daytime & twilight regions!)
const satSpotLight = new THREE.SpotLight(0xfffbeb, 0.0);
satSpotLight.angle = swathRadius * 0.72;
satSpotLight.penumbra = 0.5;
satSpotLight.decay = 0;
satSpotLight.distance = 25;
scene.add(satSpotLight);
scene.add(satSpotLight.target);

const texLoader = new THREE.TextureLoader();
const earthDayTex = texLoader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
const earthNightTex = texLoader.load('https://unpkg.com/three-globe/example/img/earth-night.jpg');
const earthBumpTex = texLoader.load('https://unpkg.com/three-globe/example/img/earth-topology.png');
const earthMat = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    map: earthDayTex,
    bumpMap: earthBumpTex,
    bumpScale: 0.012,
    specular: new THREE.Color(0x111827),
    shininess: 5
});
const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), earthMat);
scene.add(earthMesh);

scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.02, 32, 32), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.15, side: THREE.BackSide, depthWrite: false })));

// --- VISIBLE ORBIT LINE TRAJECTORY ---
let orbitLineMesh;
function drawOrbitLine() {
    if (orbitLineMesh) scene.remove(orbitLineMesh);
    const orbitPoints = [];
    const inclRad = orbitInclination * Math.PI / 180;
    
    for (let i = 0; i <= 200; i++) {
        const t = (i / 200) * Math.PI * 2; 
        const x = Math.cos(t) * orbitRadius;
        const z = Math.sin(t) * Math.cos(inclRad) * orbitRadius;
        const y = Math.sin(t) * Math.sin(inclRad) * orbitRadius;
        orbitPoints.push(new THREE.Vector3(x, y, z));
    }
    const orbitLineGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitLineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 });
    orbitLineMesh = new THREE.Line(orbitLineGeo, orbitLineMat);
    orbitLineMesh.visible = !isGeoLocked;
    scene.add(orbitLineMesh);
}
drawOrbitLine();

// --- REALISTIC AEROSPACE SATELLITE 3D MODEL ---
const satGroup = new THREE.Group();

const foilMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });

const mainBus = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.09, 8), foilMat);
mainBus.rotation.x = Math.PI / 2;
satGroup.add(mainBus);

const payloadModule = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.04, 16), metalMat);
payloadModule.rotation.x = Math.PI / 2;
payloadModule.position.z = 0.06;
satGroup.add(payloadModule);

const lensGlass = new THREE.Mesh(
    new THREE.CircleGeometry(0.016, 24),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
);
lensGlass.position.z = 0.081;
satGroup.add(lensGlass);

const thruster = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.025, 16), darkMetalMat);
thruster.rotation.x = Math.PI / 2;
thruster.position.z = -0.055;
satGroup.add(thruster);

const dishParabolic = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide })
);
dishParabolic.position.set(0, 0.042, 0.01);
dishParabolic.rotation.x = -Math.PI / 3;
satGroup.add(dishParabolic);

const feedRod = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.025, 8), metalMat);
feedRod.position.set(0, 0.05, 0.02);
feedRod.rotation.x = Math.PI / 6;
satGroup.add(feedRod);

function createSolarWing(side) {
    const wing = new THREE.Group();
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.22, 8), metalMat);
    strut.rotation.z = Math.PI / 2;
    strut.position.x = side * 0.11;
    wing.add(strut);

    const cellMat = new THREE.MeshStandardMaterial({
        color: 0x0f2952,
        emissive: 0x071630,
        metalness: 0.75,
        roughness: 0.2,
        side: THREE.DoubleSide
    });
    const frameMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.25 });

    for (let i = 0; i < 3; i++) {
        const xPos = side * (0.065 + i * 0.058);
        const segGeo = new THREE.BoxGeometry(0.052, 0.002, 0.075);
        const panel = new THREE.Mesh(segGeo, cellMat);
        panel.position.x = xPos;
        wing.add(panel);

        const gridFrame = new THREE.Mesh(segGeo, frameMat);
        gridFrame.position.x = xPos;
        wing.add(gridFrame);
    }
    return wing;
}
satGroup.add(createSolarWing(-1));
satGroup.add(createSolarWing(1));

const navBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
navBeacon.position.set(0, -0.032, 0);
satGroup.add(navBeacon);

const satKeyLight = new THREE.PointLight(0xffffff, 0.9, 0.8);
satKeyLight.position.set(0.15, 0.15, -0.15);
satGroup.add(satKeyLight);

scene.add(satGroup);

let markerMeshes = [];
let mapMarkers = [];
function renderIntelMarkers() {
    markerMeshes.forEach(m => earthMesh.remove(m));
    markerMeshes = [];
    mapMarkers.forEach(m => map.removeLayer(m));
    mapMarkers = [];

    liveIntelData.forEach(data => {
        const localPos = latLonToLocalEarthPosition(data.lat, data.lon, 1.0);
        
        let color = 0xef4444;
        let hexColor = '#ef4444';
        if (data.type === 'eonet') { color = 0xf59e0b; hexColor = '#f59e0b'; }
        if (data.type === 'rw') { color = 0xd946ef; hexColor = '#d946ef'; }
        
        const beacon = new THREE.Group();
        const pGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.15, 8);
        const pMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.85 });
        const pillar = new THREE.Mesh(pGeo, pMat);
        pillar.translateY(0.075);
        beacon.add(pillar);
        
        const ringGeo = new THREE.RingGeometry(0.015, 0.028, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotateX(Math.PI/2);
        ring.translateZ(-0.001);
        beacon.add(ring);
        
        beacon.position.copy(localPos); 
        beacon.lookAt(0,0,0);
        beacon.rotateX(Math.PI/2); 
        
        earthMesh.add(beacon); 
        markerMeshes.push(beacon);

        const mIcon = L.divIcon({ html: `<div style="width:14px;height:14px;background:${hexColor};border-radius:50%;border:2px solid white;box-shadow:0 0 10px ${hexColor};"></div>`, className: '', iconSize: [14, 14] });
        const m = L.marker([data.lat, data.lon], {icon: mIcon}).addTo(map);
        m.on('click', function() { parkSatelliteAt(data.lat, data.lon); });
        mapMarkers.push(m);
    });
}

const map = L.map('map-viewport', { zoomControl: false, attributionControl: false }).setView([20, 78], 3);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 17 }).addTo(map);
const satMarker = L.marker([0, 0], { icon: L.divIcon({ html: `<div style="width:16px;height:16px;background:#38bdf8;border-radius:50%;border:2px solid white;box-shadow:0 0 10px #38bdf8;"></div>`, className: '', iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(map);
const satCircle = L.circle([0, 0], { radius: 1200000, color: '#38bdf8', weight: 1, fillOpacity: 0.1 }).addTo(map);

map.on('click', function(e) {
    parkSatelliteAt(e.latlng.lat, e.latlng.lng);
});

let coneMesh, ringMesh;
function buildLaser() {
    if(coneMesh) scene.remove(coneMesh);
    if(ringMesh) scene.remove(ringMesh);

    const coneHeight = Math.max(0.18, orbitRadius - 1.0);
    let visualSwath = Math.min(0.45, swathRadius * (1 + (coneHeight * 0.25)));
    
    const cGeo = new THREE.ConeGeometry(visualSwath, coneHeight, 24, 1, true);
    cGeo.translate(0, -coneHeight/2, 0);
    cGeo.rotateX(-Math.PI / 2); 
    coneMesh = new THREE.Mesh(cGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.08, wireframe: true, depthWrite: false }));
    scene.add(coneMesh);

    ringMesh = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.01, swathRadius - 0.012), swathRadius, 48), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
    scene.add(ringMesh);
}
buildLaser();

function switchEngine(mode) {
    playSound('click'); activeEngine = mode;
    document.getElementById('globe-viewport').style.display = (mode === '3D') ? 'block' : 'none';
    document.getElementById('map-viewport').style.display = (mode === '2D') ? 'block' : 'none';
    document.getElementById('cam-controls').style.opacity = (mode === '3D') ? '1' : '0';
    document.getElementById('btn-3d').className = (mode === '3D') ? 'btn-active px-4 py-2 rounded text-[11px] font-bold' : 'px-4 py-2 rounded text-[11px] font-bold text-slate-400 hover:text-white';
    document.getElementById('btn-2d').className = (mode === '2D') ? 'btn-active px-4 py-2 rounded text-[11px] font-bold' : 'px-4 py-2 rounded text-[11px] font-bold text-slate-400 hover:text-white';
    if(mode === '2D') setTimeout(() => map.invalidateSize(), 100);
}

function switchCamera(mode) {
    playSound('click'); activeCamera = mode;
    ['cam-free', 'cam-chase', 'cam-nadir'].forEach(id => document.getElementById(id).className = 'px-4 py-2 rounded text-[11px] font-bold text-slate-400 hover:text-white');
    document.getElementById(`cam-${mode.toLowerCase()}`).className = 'btn-active px-4 py-2 rounded text-[11px] font-bold';
}

const opticsNames = ['Standard Color', 'Thermal (Heat)', 'Night Vision', 'Radar (Terrain)'];
function setOptics(idx) {
    playSound('click');
    document.getElementById('hud-optics').textContent = opticsNames[idx];
    document.querySelectorAll('.optics-btn').forEach((btn, i) => {
        if(i === idx) { btn.classList.add('btn-active'); btn.classList.remove('bg-slate-800/80'); } 
        else { btn.classList.remove('btn-active'); btn.classList.add('bg-slate-800/80'); }
    });
    
    if (idx === 0) { earthMat.map = earthDayTex; earthMat.color.setHex(0xffffff); earthMat.wireframe = false; }
    else if (idx === 1) { earthMat.map = earthNightTex; earthMat.color.setHex(0xff5500); earthMat.wireframe = false; }
    else if (idx === 2) { earthMat.map = earthNightTex; earthMat.color.setHex(0x00ff00); earthMat.wireframe = false; }
    else { earthMat.map = null; earthMat.color.setHex(0x061120); earthMat.wireframe = true; }
}

function updateAltitude(km) {
    currentAltitudeKm = parseFloat(km);
    orbitRadius = calcOrbitRadius(currentAltitudeKm);
    document.getElementById('alt-val').textContent = km + " km";
    document.getElementById('hud-alt').textContent = km;
    const baseSpeed = parseFloat(document.getElementById('speed-slider').value);
    orbitSpeed = baseSpeed / (orbitRadius * 0.5); 
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
    const baseSpeed = parseFloat(val);
    orbitSpeed = baseSpeed / (orbitRadius * 0.5);
    const mult = (baseSpeed / 0.003).toFixed(1);
    document.getElementById('speed-val').textContent = mult + "x " + (mult == 1.0 ? "(Real-time)" : "(Fast)");
}

function animate() {
    requestAnimationFrame(animate);
    earthMesh.rotation.y += 0.0005;

    if (!isGeoLocked) {
        orbitTime += orbitSpeed;
        const inclRad = orbitInclination * Math.PI / 180;
        
        const x = Math.cos(orbitTime) * orbitRadius;
        const z = Math.sin(orbitTime) * Math.cos(inclRad) * orbitRadius;
        const y = Math.sin(orbitTime) * Math.sin(inclRad) * orbitRadius;
        
        satGroup.position.set(x, y, z);
        satGroup.lookAt(0,0,0);
        
        coneMesh.position.copy(satGroup.position); coneMesh.lookAt(0,0,0);
        ringMesh.position.copy(satGroup.position).normalize().multiplyScalar(1.003); ringMesh.lookAt(0,0,0); 

        const coords = worldPositionToLatLon(satGroup.position, earthMesh.rotation.y);
        const lat = coords.lat;
        const lon = coords.lon;

        document.getElementById('hud-lat').textContent = lat.toFixed(2);
        document.getElementById('hud-lon').textContent = lon.toFixed(2);
        satMarker.setLatLng([lat, lon]); satCircle.setLatLng([lat, lon]);

        const now = Date.now();
        if (isDockExpanded && currentTab === 'weather' && now - lastScannedTime > 4000) {
            lastScannedTime = now;
            fetchSubSatData(lat, lon);
        }
    } else {
        const lockedPos = latLonToWorldPosition(lockedLat, lockedLon, orbitRadius, earthMesh.rotation.y);
        satGroup.position.copy(lockedPos);
        satGroup.lookAt(0,0,0);
        
        coneMesh.position.copy(satGroup.position); coneMesh.lookAt(0,0,0);
        ringMesh.position.copy(satGroup.position).normalize().multiplyScalar(1.003); ringMesh.lookAt(0,0,0); 
    }

    // STRICT NIGHT-ONLY ADAPTIVE ILLUMINATION:
    // Spotlight stays at 0.0 intensity on the entire day side and twilight border (sunAlignment > -0.05)
    // Only turns on in true night shadow (sunAlignment < -0.05) with gentle intensity (0.95 max) so it never over-lights!
    const satNormal = satGroup.position.clone().normalize();
    const sunAlignment = satNormal.dot(sunDirVector);
    const nightFactor = Math.max(0, Math.min(1, (-0.05 - sunAlignment) / 0.55));
    satSpotLight.intensity = nightFactor * 0.95;
    satSpotLight.position.copy(satGroup.position);
    satSpotLight.target.position.set(0, 0, 0);
    const coneDist = Math.max(0.18, orbitRadius - 1.0);
    satSpotLight.angle = Math.atan2(swathRadius * 1.05, coneDist);

    navBeacon.visible = Math.floor(Date.now() / 500) % 2 === 0;

    document.getElementById('hud-time').textContent = 'UTC ' + new Date().toISOString().substr(11,8);

    // CAMERA MODES
    if (activeCamera === 'FREE') {
        controls.update();
    } else if (activeCamera === 'CHASE') {
        const inclRad = orbitInclination * Math.PI / 180;
        let forward;
        if (!isGeoLocked) {
            forward = new THREE.Vector3(-Math.sin(orbitTime), Math.cos(orbitTime) * Math.sin(inclRad), Math.cos(orbitTime) * Math.cos(inclRad)).normalize();
        } else {
            forward = new THREE.Vector3(-satGroup.position.z, 0, satGroup.position.x).normalize();
        }
        const up = new THREE.Vector3(0,1,0);
        const right = new THREE.Vector3().crossVectors(forward, up).normalize();
        const scale = 1.0 + ((orbitRadius - 1.0) * 0.4);
        const offset = new THREE.Vector3().addScaledVector(forward, -0.6 * scale).addScaledVector(up, 0.35 * scale).addScaledVector(right, 0.1 * scale);
        
        camera.position.lerp(satGroup.position.clone().add(offset), 0.1);
        camera.lookAt(satGroup.position);
    } else if (activeCamera === 'NADIR') {
        camera.position.lerp(satGroup.position.clone().multiplyScalar(1.05), 0.1);
        camera.lookAt(0,0,0);
    }
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if(activeEngine === '2D') map.invalidateSize();
});

// Initial boot data load
setTimeout(() => {
    fetchLiveIntel(true);
    const coords = worldPositionToLatLon(satGroup.position, earthMesh.rotation.y);
    fetchSubSatData(coords.lat, coords.lon, true);
}, 400);

animate();
