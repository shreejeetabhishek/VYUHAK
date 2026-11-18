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
// Three.js SphereGeometry standard UV mapping:
// At earthMesh.rotation.y = 0:
//   x =  r * cos(lat) * cos(lon)
//   y =  r * sin(lat)
//   z = -r * cos(lat) * sin(lon)
// When earthMesh is rotated around Y by theta = earthMesh.rotation.y,
// a ground point (lat, lon) moves to world angle: lonRad + earthMesh.rotation.y.
function latLonToWorldPosition(latDeg, lonDeg, radius, earthRotationY) {
    const latRad = latDeg * Math.PI / 180;
    const lonRad = (lonDeg * Math.PI / 180) + earthRotationY;
    const x = radius * Math.cos(latRad) * Math.cos(lonRad);
    const y = radius * Math.sin(latRad);
    const z = -radius * Math.cos(latRad) * Math.sin(lonRad);
    return new THREE.Vector3(x, y, z);
}

// Exact inverse of latLonToWorldPosition:
// Given ANY 3D world position (x, y, z) and earthRotationY, returns the exact (lat, lon) on the Earth's surface below it.
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

// Local position on unrotated earthMesh (for attaching 3D beacons directly to earthMesh)
function latLonToLocalEarthPosition(latDeg, lonDeg, radius) {
    return latLonToWorldPosition(latDeg, lonDeg, radius, 0);
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

let orbitTime = -1.35; // Starts near India/Asia
let currentAltitudeKm = 1200;
let orbitRadius = calcOrbitRadius(currentAltitudeKm);
let orbitSpeed = 0.003;
let orbitInclination = 45;
let swathRadius = 0.25; 
let activeEngine = '3D', activeCamera = 'FREE';
let lastScannedTime = 0;

// --- INSTANT SOVEREIGN DEMOGRAPHICS FALLBACK DICTIONARY ---
// Guarantees 0ms instant population/capital/currency/area display even if external APIs are slow
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
    "TD": { name: "Chad", pop: 18278568, cap: "N'Djamena", cur: "Central African CFA Franc", area: 1284000, tz: "UTC+01:00" },
    "NG": { name: "Nigeria", pop: 223804632, cap: "Abuja", cur: "Nigerian Naira (₦)", area: 923768, tz: "UTC+01:00" },
    "EG": { name: "Egypt", pop: 112716598, cap: "Cairo", cur: "Egyptian Pound (E£)", area: 1002450, tz: "UTC+02:00" },
    "ZA": { name: "South Africa", pop: 60414495, cap: "Pretoria", cur: "South African Rand (R)", area: 1221037, tz: "UTC+02:00" },
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
    "AR": { name: "Argentina", pop: 45773884, cap: "Buenos Aires", cur: "Argentine Peso ($)", area: 2780400, tz: "UTC-03:00" }
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
        // Compute exact Lat/Lon from current 3D position so the satellite freezes in place with ZERO jump!
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

// --- API ENGINE (PARALLELIZED FOR ULTRA-FAST UPDATES) ---
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

    document.getElementById('weather-loc').textContent = `Center: ${numLat.toFixed(2)}°, ${numLon.toFixed(2)}° | Radius: ${swathKm} km`;
    document.getElementById('connection-led').classList.add('recording');

    // Run Weather + Reverse Geocoding + Wikipedia Geosearch concurrently for instant responsiveness!
    const weatherPromise = fetch(API_ENDPOINTS.WEATHER(numLat, numLon)).then(r => r.json()).catch(() => null);
    const geoPromise = fetch(API_ENDPOINTS.REVGEO(numLat, numLon)).then(r => r.json()).catch(() => null);

    // 1. Handle Weather immediately when ready
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

    // 2. Handle Reverse Geocoding & Trigger Parallel Sub-Modules
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
        // Over Ocean
        document.getElementById('geo-data').innerHTML = `
            <div class="text-sky-400 font-bold text-sm">🌊 Maritime / Oceanic Sector: ${ocean}</div>
            <div class="text-slate-300 text-xs mt-1">The satellite footprint is currently over open international waters. Monitoring maritime weather, shipping lanes, and subsea seismic activity.</div>
        `;
        document.getElementById('reg-pop').textContent = "0 (Oceanic)";
        document.getElementById('reg-cap').textContent = "Int'l Waters";
        document.getElementById('reg-cur').textContent = "Maritime Trade";
        document.getElementById('reg-area').textContent = "Open Ocean";
        document.getElementById('reg-dens').textContent = "0 / km²";
        document.getElementById('reg-tz').textContent = `UTC ${numLon >= 0 ? '+' : ''}${Math.round(numLon / 15)}h`;
        
        // Fire all sub-modules in parallel!
        Promise.allSettled([
            fetchRegionalNews(ocean, "Maritime Shipping", scanId),
            fetchPublicInterest(ocean, "", "", informative, admin, scanId),
            checkFootprintConflicts(numLat, numLon, swathKm, "", scanId),
            fetchTopLandmarks(numLat, numLon, ocean, informative, admin, scanId)
        ]);
    } else {
        // Over Land
        let summaryText = `The satellite is scanning <strong class="text-emerald-400">${city ? city + ', ' : ''}${state && state !== city ? state + ', ' : ''}${ctry}</strong>.`;
        document.getElementById('geo-data').innerHTML = `<div class="mb-1">${summaryText}</div><div id="region-bio" class="text-[11px] text-slate-300 mt-1.5 leading-relaxed">Loading regional overview...</div>`;

        // INSTANT DEMOGRAPHICS DISPLAY FROM LOCAL DICTIONARY IF AVAILABLE
        if (SOVEREIGN_DB[ctryCode]) {
            const db = SOVEREIGN_DB[ctryCode];
            document.getElementById('reg-pop').textContent = formatPopulation(db.pop);
            document.getElementById('reg-cap').textContent = db.cap;
            document.getElementById('reg-cur').textContent = db.cur;
            document.getElementById('reg-area').textContent = db.area.toLocaleString() + ' km²';
            document.getElementById('reg-dens').textContent = Math.round(db.pop / db.area).toLocaleString() + ' / km²';
            document.getElementById('reg-tz').textContent = db.tz;
        }

        // Fire Country API, Wikipedia Bio, Regional News, Public Interest, Conflicts, and Landmarks IN PARALLEL!
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
        let cRes = ctryCode ? await fetch(API_ENDPOINTS.COUNTRY_ALPHA(ctryCode)) : null;
        if (!cRes || !cRes.ok) {
            cRes = await fetch(API_ENDPOINTS.COUNTRY_NAME(ctryName));
        }
        if (cRes && cRes.ok && scanId === currentScanId) {
            const cArr = await cRes.json();
            const cInfo = Array.isArray(cArr) ? cArr[0] : cArr;
            if (cInfo) {
                const popNum = cInfo.population || 0;
                const areaNum = cInfo.area || 0;
                const pop = formatPopulation(popNum);
                const cap = cInfo.capital && cInfo.capital[0] ? cInfo.capital[0] : 'N/A';
                const curObj = cInfo.currencies ? Object.values(cInfo.currencies)[0] : null;
                const cur = curObj ? `${curObj.name} (${curObj.symbol || ''})` : 'N/A';
                const areaStr = areaNum ? areaNum.toLocaleString() + ' km²' : 'N/A';
                const densStr = (popNum && areaNum) ? Math.round(popNum / areaNum).toLocaleString() + ' / km²' : 'N/A';
                const tz = cInfo.timezones && cInfo.timezones[0] ? cInfo.timezones[0] : `UTC ${numLon >= 0 ? '+' : ''}${Math.round(numLon / 15)}h`;
                
                document.getElementById('reg-pop').textContent = pop;
                document.getElementById('reg-cap').textContent = cap;
                document.getElementById('reg-cur').textContent = cur;
                document.getElementById('reg-area').textContent = areaStr;
                document.getElementById('reg-dens').textContent = densStr;
                document.getElementById('reg-tz').textContent = tz;
            }
        }
    } catch(e) {
        if (scanId === currentScanId && !SOVEREIGN_DB[ctryCode]) {
            document.getElementById('reg-tz').textContent = `UTC ${numLon >= 0 ? '+' : ''}${Math.round(numLon / 15)}h`;
        }
    }
}

async function fetchRegionBio(city, state, ctry, scanId) {
    // Prefer State/Country or non-disambiguation summaries
    const candidates = [state ? `${city ? city + ', ' : ''}${state}` : '', state, ctry].filter(Boolean);
    for (const placeName of candidates) {
        try {
            const sumRes = await fetch(API_ENDPOINTS.WIKI_SUMMARY(placeName));
            if (sumRes.ok) {
                const sumData = await sumRes.json();
                // Skip Wikipedia disambiguation pages (like "Dongargaon may refer to...")
                if (sumData.extract && sumData.type !== 'disambiguation' && !sumData.extract.includes('may refer to:') && scanId === currentScanId) {
                    const bioEl = document.getElementById('region-bio');
                    if (bioEl) bioEl.innerHTML = `<span class="text-sky-300 font-semibold">[${sumData.title || placeName}]:</span> ${sumData.extract}`;
                    return;
                }
            }
        } catch(e) {}
    }
}

async function fetchRegionalNews(primaryQuery, fallbackCountry = '', scanId) {
    const newsContainer = document.getElementById('reg-news');
    try {
        let items = [];
        let sourceTag = primaryQuery;

        const fullQuery = fallbackCountry && primaryQuery !== fallbackCountry ? `${primaryQuery} ${fallbackCountry}` : primaryQuery;
        try {
            let res = await fetch(API_ENDPOINTS.NEWS_REGIONAL_RSS2JSON(fullQuery));
            let data = await res.json();
            if (data && data.items && data.items.length > 0) {
                items = data.items;
                sourceTag = fullQuery;
            }
        } catch(e) {}

        if (items.length === 0 && fallbackCountry) {
            try {
                let res2 = await fetch(API_ENDPOINTS.NEWS_REGIONAL_RSS2JSON(fallbackCountry));
                let data2 = await res2.json();
                if (data2 && data2.items && data2.items.length > 0) {
                    items = data2.items;
                    sourceTag = fallbackCountry;
                }
            } catch(e) {}
        }

        if (items.length === 0 && (fallbackCountry || primaryQuery)) {
            try {
                let gRes = await fetch(API_ENDPOINTS.GDELT_NEWS(fallbackCountry || primaryQuery));
                let gData = await gRes.json();
                if (gData && gData.articles && gData.articles.length > 0) {
                    items = gData.articles.map(a => ({
                        title: a.title,
                        link: a.url,
                        pubDate: a.domain || 'Live Wire'
                    }));
                    sourceTag = fallbackCountry || primaryQuery;
                }
            } catch(e) {}
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
                    <div class="text-[9px] text-slate-400 mt-1">Focus: ${sourceTag} &bull; ${pubDate} &bull; Tap to read full report</div>
                </a>`;
            });
            newsContainer.innerHTML = html;
        } else {
            newsContainer.innerHTML = `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">Quiet media sector for ${primaryQuery}. Monitoring global broadcast feeds.</div>`;
        }
    } catch(e) {
        if (scanId === currentScanId) {
            newsContainer.innerHTML = `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">Regional news feed temporarily unavailable.</div>`;
        }
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
            <div class="text-[10px] font-bold text-amber-300 uppercase mb-1">Geopolitical & Ecological Zones in Swath</div>
            <div class="text-[11px] text-slate-300 leading-relaxed">${tags.slice(0, 5).join(' &bull; ')}</div>
        </div>`;
    }

    const searchTarget = `${state || city} ${country}`.trim();
    if (searchTarget) {
        try {
            const wRes = await fetch(API_ENDPOINTS.WIKI_SEARCH(searchTarget));
            const wData = await wRes.json();
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
        } catch(e) {}
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
            const rwRes = await fetch(API_ENDPOINTS.RELIEFWEB_COUNTRY(countryName));
            const rwData = await rwRes.json();
            if (rwData.data && rwData.data.length > 0) {
                rwData.data.forEach(rep => {
                    alertsHTML += `
                    <div class="bg-amber-950/30 border border-amber-500/30 rounded p-2.5">
                        <div class="font-bold text-amber-400">⚠️ UN Humanitarian / Security Report (${countryName})</div>
                        <div class="text-slate-200 mt-0.5">${rep.fields.title}</div>
                    </div>`;
                });
            }
        } catch(e) {}
    }

    if (scanId !== currentScanId) return;

    if (!alertsHTML) {
        container.innerHTML = `<div class="bg-emerald-950/20 border border-emerald-500/30 rounded p-3 text-emerald-300 font-semibold">✅ No active wars, major earthquakes, or natural disasters detected within this ${radiusKm} km satellite footprint.</div>`;
    } else {
        container.innerHTML = alertsHTML;
    }
}

async function fetchTopLandmarks(lat, lon, fallbackRegion, informative, admin, scanId) {
    const wikiContainer = document.getElementById('wiki-data');
    try {
        const wikiRes = await fetch(API_ENDPOINTS.WIKI_GEO(lat, lon, 10000));
        const wikiData = await wikiRes.json();
        if (scanId !== currentScanId) return;

        let items = (wikiData.query && wikiData.query.geosearch) ? wikiData.query.geosearch : [];

        if (items.length > 0) {
            let wHtml = `<div class="grid grid-cols-1 gap-1.5">`;
            items.forEach(item => {
                const distKm = (item.dist / 1000).toFixed(1);
                wHtml += `
                <div class="bg-slate-900/60 border border-slate-800 rounded p-2 flex justify-between items-center">
                    <span class="font-semibold text-emerald-300">📍 ${item.title}</span>
                    <span class="text-[10px] text-slate-400">${distKm} km from center</span>
                </div>`;
            });
            wHtml += `</div>`;
            wikiContainer.innerHTML = wHtml;
            return;
        }

        let fallbackHTML = `<div class="grid grid-cols-1 gap-1.5">`;
        let count = 0;

        if (fallbackRegion) {
            const searchRes = await fetch(API_ENDPOINTS.WIKI_SEARCH(`landmarks OR mountains OR cities in ${fallbackRegion}`));
            const searchData = await searchRes.json();
            if (searchData.query && searchData.query.search) {
                searchData.query.search.slice(0, 4).forEach(s => {
                    count++;
                    fallbackHTML += `
                    <div class="bg-slate-900/60 border border-slate-800 rounded p-2 flex justify-between items-center">
                        <span class="font-semibold text-emerald-300">📍 ${s.title}</span>
                        <span class="text-[10px] text-slate-400">Regional Landmark (${fallbackRegion})</span>
                    </div>`;
                });
            }
        }

        informative.slice(0, 3).forEach(inf => {
            if (inf.name) {
                count++;
                fallbackHTML += `
                <div class="bg-slate-900/60 border border-slate-800 rounded p-2 flex justify-between items-center">
                    <span class="font-semibold text-sky-300">🗺️ ${inf.name}</span>
                    <span class="text-[10px] text-slate-400">${inf.description || 'Geographic Feature'}</span>
                </div>`;
            }
        });

        fallbackHTML += `</div>`;
        if (scanId === currentScanId) {
            wikiContainer.innerHTML = count > 0 ? fallbackHTML : `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">Uninhabited terrain in ${fallbackRegion || 'sector'}.</div>`;
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

    // Position satellite immediately using unified spherical formula
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

// SMART ADAPTIVE SATELLITE SPOTLIGHT (Night-only illumination, zero daytime glare)
const satSpotLight = new THREE.SpotLight(0xfffbeb, 0.0);
satSpotLight.angle = swathRadius * 0.72;
satSpotLight.penumbra = 0.45;
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
    specular: new THREE.Color(0x1e293b),
    shininess: 8
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

        // Use exact inverse spherical mapping so HUD Lat/Lon matches the 3D position 1:1
        const coords = worldPositionToLatLon(satGroup.position, earthMesh.rotation.y);
        const lat = coords.lat;
        const lon = coords.lon;

        document.getElementById('hud-lat').textContent = lat.toFixed(2);
        document.getElementById('hud-lon').textContent = lon.toFixed(2);
        satMarker.setLatLng([lat, lon]); satCircle.setLatLng([lat, lon]);

        // Fast 3.5-second auto-refresh while Ground Data tab is open
        const now = Date.now();
        if (isDockExpanded && currentTab === 'weather' && now - lastScannedTime > 3500) {
            lastScannedTime = now;
            fetchSubSatData(lat, lon);
        }
    } else {
        // Exact forward spherical mapping: locks satellite in place with ZERO jump when toggled!
        const lockedPos = latLonToWorldPosition(lockedLat, lockedLon, orbitRadius, earthMesh.rotation.y);
        satGroup.position.copy(lockedPos);
        satGroup.lookAt(0,0,0);
        
        coneMesh.position.copy(satGroup.position); coneMesh.lookAt(0,0,0);
        ringMesh.position.copy(satGroup.position).normalize().multiplyScalar(1.003); ringMesh.lookAt(0,0,0); 
    }

    // SMART DAY/NIGHT ADAPTIVE ILLUMINATION
    const satNormal = satGroup.position.clone().normalize();
    const sunAlignment = satNormal.dot(sunDirVector);
    const nightFactor = Math.max(0, Math.min(1, (0.2 - sunAlignment) / 0.7));
    satSpotLight.intensity = nightFactor * 1.35;
    satSpotLight.position.copy(satGroup.position);
    satSpotLight.target.position.set(0, 0, 0);
    const coneDist = Math.max(0.18, orbitRadius - 1.0);
    satSpotLight.angle = Math.atan2(swathRadius * 1.08, coneDist);

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
