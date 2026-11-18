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

// --- STATE VARIABLES ---
let isDockExpanded = false;
let currentTab = 'intel';
let isGeoLocked = false;
let lockedLat = 20.84;
let lockedLon = 85.10;

function calcOrbitRadius(km) {
    // Guarantees a clear visual gap above the Earth's surface (minimum 1.32 radius at 400km)
    return 1.28 + (parseFloat(km) / 6371) * 0.9;
}

let orbitTime = 0;
let currentAltitudeKm = 1200; // Start with clear separation above Earth
let orbitRadius = calcOrbitRadius(currentAltitudeKm);
let orbitSpeed = 0.003;
let orbitInclination = 45; // degrees
let swathRadius = 0.25; 
let activeEngine = '3D', activeCamera = 'FREE';
let lastScannedTime = 0;

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

function toggleGeoLock() {
    isGeoLocked = !isGeoLocked;
    const btn = document.getElementById('btn-geo-lock');
    const ind = document.getElementById('lock-indicator');
    
    if(isGeoLocked) {
        btn.classList.add('bg-sky-700/50', 'border-sky-400');
        ind.textContent = 'ON'; ind.classList.replace('text-slate-400', 'text-sky-300');
        document.getElementById('hud-sat-name').textContent = 'VK-Hover-02';
        document.getElementById('hud-vel').textContent = '0.00';
        if (orbitLineMesh) orbitLineMesh.visible = false; // Hide orbit line when static
        playSound('lock');
        
        lockedLat = parseFloat(document.getElementById('hud-lat').textContent);
        lockedLon = parseFloat(document.getElementById('hud-lon').textContent);
        fetchSubSatData(lockedLat, lockedLon, true);
    } else {
        btn.classList.remove('bg-sky-700/50', 'border-sky-400');
        ind.textContent = 'OFF'; ind.classList.replace('text-sky-300', 'text-slate-400');
        document.getElementById('hud-sat-name').textContent = 'VK-Tracker-01';
        if (orbitLineMesh) orbitLineMesh.visible = true; // Restore orbit line when orbiting
        
        const speedVal = document.getElementById('speed-slider').value;
        updateSpeed(speedVal); 
        playSound('click');
    }
}

// --- API ENGINE (ALL FREE & KEYLESS) ---
const API_ENDPOINTS = {
    EARTHQUAKES: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
    EONET: 'https://eonet.gsfc.nasa.gov/api/v3/events?limit=15&days=10',
    NEWS_GLOBAL: 'https://api.rss2json.com/v1/api.json?rss_url=http://feeds.bbci.co.uk/news/world/rss.xml',
    NEWS_REGIONAL: (query) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-US&gl=US&ceid=US:en')}`,
    RELIEFWEB_GLOBAL: 'https://api.reliefweb.int/v1/disasters?appname=vyuhak&preset=latest&profile=full&limit=8',
    RELIEFWEB_COUNTRY: (country) => `https://api.reliefweb.int/v1/reports?appname=vyuhak&query[value]=${encodeURIComponent(country)}&limit=3`,
    WEATHER: (lat, lon) => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&current_weather=true`,
    REVGEO: (lat, lon) => `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    COUNTRY_INFO: (code) => `https://restcountries.com/v3.1/alpha/${code}`,
    WIKI_GEO: (lat, lon) => `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=5&format=json&origin=*`,
    WIKI_SUMMARY: (title) => `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
};

function decodeWeatherCode(code) {
    const map = {
        0: 'Clear Sky ☀️', 1: 'Mainly Clear 🌤️', 2: 'Partly Cloudy ⛅', 3: 'Overcast ☁️',
        45: 'Foggy 🌫️', 48: 'Rime Fog 🌫️', 51: 'Light Drizzle 🌦️', 53: 'Moderate Drizzle 🌦️',
        61: 'Slight Rain 🌧️', 63: 'Moderate Rain 🌧️', 65: 'Heavy Rain ⛈️', 71: 'Snowfall ❄️',
        80: 'Rain Showers 🌦️', 95: 'Thunderstorm ⚡', 99: 'Severe Storm 🌩️'
    };
    return map[code] || 'Variable Sky 🌤️';
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
        try {
            const eqRes = await fetch(API_ENDPOINTS.EARTHQUAKES);
            const eqData = await eqRes.json();
            if (eqData.features && eqData.features.length > 0) {
                eqData.features.slice(0, 4).forEach(eq => {
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
        } catch(e) {}

        try {
            const eoRes = await fetch(API_ENDPOINTS.EONET);
            const eoData = await eoRes.json();
            if (eoData.events && eoData.events.length > 0) {
                eoData.events.slice(0, 4).forEach(ev => {
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
        } catch(e) {}

        try {
            const rwRes = await fetch(API_ENDPOINTS.RELIEFWEB_GLOBAL);
            const rwData = await rwRes.json();
            if (rwData.data && rwData.data.length > 0) {
                rwData.data.slice(0, 4).forEach(d => {
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
        } catch(e) {}

        try {
            const newsRes = await fetch(API_ENDPOINTS.NEWS_GLOBAL);
            const newsData = await newsRes.json();
            if (newsData.items && newsData.items.length > 0) {
                newsData.items.slice(0, 3).forEach(n => {
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
        } catch(e) {}

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

let weatherCooldown = false;
async function fetchSubSatData(lat, lon, force = false) {
    if(weatherCooldown && !force) return;
    weatherCooldown = true;
    setTimeout(() => { weatherCooldown = false; }, 2000);

    const numLat = parseFloat(lat);
    const numLon = parseFloat(lon);
    const swathKm = Math.round(swathRadius * 4800);

    document.getElementById('weather-loc').textContent = `Center: ${numLat.toFixed(2)}°, ${numLon.toFixed(2)}° | Radius: ${swathKm} km`;
    document.getElementById('w-temp').textContent = "...";
    document.getElementById('w-wind').textContent = "...";
    document.getElementById('w-hum').textContent = "...";
    document.getElementById('w-cond').textContent = "Scanning...";
    document.getElementById('geo-data').textContent = "Identifying territory, population, and local sector...";
    document.getElementById('reg-conflicts').innerHTML = '<div class="text-slate-400 p-2">Scanning footprint for emergencies...</div>';
    document.getElementById('reg-news').innerHTML = '<div class="text-slate-400 p-2">Pulling regional news & public interest...</div>';
    document.getElementById('wiki-data').innerHTML = '<div class="text-slate-400 p-2">Locating top places & landmarks...</div>';

    // 1. Live Weather (Open-Meteo)
    try {
        const wRes = await fetch(API_ENDPOINTS.WEATHER(numLat, numLon));
        const wData = await wRes.json();
        if (wData.current) {
            document.getElementById('w-temp').innerHTML = `${wData.current.temperature_2m} &deg;C`;
            document.getElementById('w-wind').innerHTML = `${wData.current.wind_speed_10m} km/h`;
            document.getElementById('w-hum').innerHTML = `${wData.current.relative_humidity_2m}%`;
            document.getElementById('w-cond').textContent = decodeWeatherCode(wData.current.weather_code);
        } else if (wData.current_weather) {
            document.getElementById('w-temp').innerHTML = `${wData.current_weather.temperature} &deg;C`;
            document.getElementById('w-wind').innerHTML = `${wData.current_weather.windspeed} km/h`;
            document.getElementById('w-hum').textContent = "N/A";
            document.getElementById('w-cond').textContent = decodeWeatherCode(wData.current_weather.weathercode);
        }
    } catch(e) {
        document.getElementById('w-temp').textContent = "N/A";
    }

    // 2. Reverse Geocoding + Country Demographics + Regional News + Conflicts
    try {
        const geoRes = await fetch(API_ENDPOINTS.REVGEO(numLat, numLon));
        const geoData = await geoRes.json();
        
        const ctry = geoData.countryName || '';
        const ctryCode = geoData.countryCode || '';
        const state = geoData.principalSubdivision || '';
        const city = geoData.city || geoData.locality || '';
        const ocean = geoData.localityInfo && geoData.localityInfo.informative ? geoData.localityInfo.informative[0].name : 'International Waters';

        if (!ctry) {
            document.getElementById('geo-data').innerHTML = `
                <div class="text-sky-400 font-bold text-sm">🌊 Maritime / Oceanic Sector: ${ocean}</div>
                <div class="text-slate-300 text-xs mt-1">The satellite footprint is currently over open water. Monitoring maritime weather and seismic activity.</div>
            `;
            document.getElementById('reg-pop').textContent = "Uninhabited";
            document.getElementById('reg-cap').textContent = "Maritime";
            document.getElementById('reg-cur').textContent = "Int'l Waters";
            document.getElementById('reg-tz').textContent = "UTC";
            
            fetchRegionalNews(ocean);
            checkFootprintConflicts(numLat, numLon, swathKm, "");
        } else {
            let summaryText = `The satellite is scanning <strong class="text-emerald-400">${city ? city + ', ' : ''}${state ? state + ', ' : ''}${ctry}</strong>.`;
            document.getElementById('geo-data').innerHTML = `<div class="mb-1">${summaryText}</div><div id="region-bio" class="text-[11px] text-slate-400 mt-1"></div>`;

            if (ctryCode) {
                try {
                    const cRes = await fetch(API_ENDPOINTS.COUNTRY_INFO(ctryCode));
                    const cArr = await cRes.json();
                    const cInfo = Array.isArray(cArr) ? cArr[0] : cArr;
                    if (cInfo) {
                        const pop = cInfo.population ? (cInfo.population / 1000000).toFixed(2) + ' Million' : 'N/A';
                        const cap = cInfo.capital && cInfo.capital[0] ? cInfo.capital[0] : 'N/A';
                        const curObj = cInfo.currencies ? Object.values(cInfo.currencies)[0] : null;
                        const cur = curObj ? `${curObj.name} (${curObj.symbol || ''})` : 'N/A';
                        const tz = cInfo.timezones && cInfo.timezones[0] ? cInfo.timezones[0] : 'UTC';
                        
                        document.getElementById('reg-pop').textContent = pop;
                        document.getElementById('reg-cap').textContent = cap;
                        document.getElementById('reg-cur').textContent = cur;
                        document.getElementById('reg-tz').textContent = tz;
                    }
                } catch(e) {}
            }

            const targetPlace = city || state || ctry;
            try {
                const sumRes = await fetch(API_ENDPOINTS.WIKI_SUMMARY(targetPlace));
                if (sumRes.ok) {
                    const sumData = await sumRes.json();
                    if (sumData.extract) {
                        document.getElementById('region-bio').textContent = sumData.extract;
                    }
                }
            } catch(e) {}

            const newsQuery = `${state || city} ${ctry}`.trim();
            fetchRegionalNews(newsQuery, ctry);
            checkFootprintConflicts(numLat, numLon, swathKm, ctry);
        }

        fetchTopLandmarks(numLat, numLon, state || ctry);

    } catch(e) {
        document.getElementById('geo-data').textContent = "Unable to resolve ground details at this moment.";
    }
}

async function fetchRegionalNews(query, fallbackCountry = '') {
    const newsContainer = document.getElementById('reg-news');
    try {
        let res = await fetch(API_ENDPOINTS.NEWS_REGIONAL(query));
        let data = await res.json();
        
        if ((!data.items || data.items.length === 0) && fallbackCountry) {
            res = await fetch(API_ENDPOINTS.NEWS_REGIONAL(fallbackCountry));
            data = await res.json();
        }

        if (data.items && data.items.length > 0) {
            let html = '';
            data.items.slice(0, 4).forEach(item => {
                const cleanTitle = item.title.replace(/ - .*$/, '');
                const pubDate = item.pubDate ? item.pubDate.split(' ')[0] : 'Live';
                html += `
                <a href="${item.link}" target="_blank" class="block bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/60 rounded p-2.5 transition">
                    <div class="text-sky-300 font-semibold text-[11px] leading-snug">${cleanTitle}</div>
                    <div class="text-[9px] text-slate-500 mt-1">Source: Regional News Feed &bull; ${pubDate}</div>
                </a>`;
            });
            newsContainer.innerHTML = html;
        } else {
            newsContainer.innerHTML = `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">No major breaking news alerts for ${query}.</div>`;
        }
    } catch(e) {
        newsContainer.innerHTML = `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">Regional news feed temporarily unavailable.</div>`;
    }
}

async function checkFootprintConflicts(lat, lon, radiusKm, countryName) {
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

    if (!alertsHTML) {
        container.innerHTML = `<div class="bg-emerald-950/20 border border-emerald-500/30 rounded p-3 text-emerald-300 font-semibold">✅ No active wars, major earthquakes, or natural disasters detected within this ${radiusKm} km satellite footprint.</div>`;
    } else {
        container.innerHTML = alertsHTML;
    }
}

async function fetchTopLandmarks(lat, lon, fallbackRegion) {
    const wikiContainer = document.getElementById('wiki-data');
    try {
        const wikiRes = await fetch(API_ENDPOINTS.WIKI_GEO(lat, lon));
        const wikiData = await wikiRes.json();
        if(wikiData.query && wikiData.query.geosearch && wikiData.query.geosearch.length > 0) {
            let wHtml = `<div class="grid grid-cols-1 gap-1.5">`;
            wikiData.query.geosearch.forEach(item => {
                const distKm = (item.dist / 1000).toFixed(1);
                wHtml += `
                <div class="bg-slate-900/60 border border-slate-800 rounded p-2 flex justify-between items-center">
                    <span class="font-semibold text-emerald-300">📍 ${item.title}</span>
                    <span class="text-[10px] text-slate-400">${distKm} km away</span>
                </div>`;
            });
            wHtml += `</div>`;
            wikiContainer.innerHTML = wHtml;
        } else {
            wikiContainer.innerHTML = `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">Remote terrain or dense forest/rural sector in ${fallbackRegion || 'this area'}. No major monuments within 10 km of center point.</div>`;
        }
    } catch(e) {
        wikiContainer.innerHTML = `<div class="bg-slate-900/40 border border-slate-800 rounded p-3 text-slate-400">Landmark scanner offline.</div>`;
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
    
    if(!isGeoLocked) {
        isGeoLocked = true;
        const btn = document.getElementById('btn-geo-lock');
        const ind = document.getElementById('lock-indicator');
        btn.classList.add('bg-sky-700/50', 'border-sky-400');
        ind.textContent = 'ON'; ind.classList.replace('text-slate-400', 'text-sky-300');
        document.getElementById('hud-sat-name').textContent = 'VK-Hover-02';
        document.getElementById('hud-vel').textContent = '0.00';
        if (orbitLineMesh) orbitLineMesh.visible = false; // Hide orbit line when static
    }
    
    document.getElementById('hud-lat').textContent = lat.toFixed(2);
    document.getElementById('hud-lon').textContent = lon.toFixed(2);
    satMarker.setLatLng([lat, lon]);
    satCircle.setLatLng([lat, lon]);

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

// Low ambient light so night side is realistically dark, while Sun illuminates day side
scene.add(new THREE.AmbientLight(0xffffff, 0.08));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(5, 2, 3);
scene.add(sunLight);

// SATELLITE FOOTPRINT SUNLIGHT SPOTLIGHT (Illuminates dark/night regions covered by satellite)
const satSpotLight = new THREE.SpotLight(0xfffbeb, 2.8);
satSpotLight.angle = swathRadius * 0.72;
satSpotLight.penumbra = 0.25;
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
    shininess: 18
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
    orbitLineMesh.visible = !isGeoLocked; // Do not show when static
    scene.add(orbitLineMesh);
}
drawOrbitLine();

// --- REALISTIC AEROSPACE SATELLITE 3D MODEL ---
const satGroup = new THREE.Group();

// 1. Octagonal Gold Multi-Layer Insulation (MLI) Main Bus
const foilMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });

const mainBus = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.09, 8), foilMat);
mainBus.rotation.x = Math.PI / 2;
satGroup.add(mainBus);

// 2. Forward Payload Module & Optical Sensor Ring (Points toward Earth along -Z)
const payloadModule = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.04, 16), metalMat);
payloadModule.rotation.x = Math.PI / 2;
payloadModule.position.z = 0.06;
satGroup.add(payloadModule);

// Glowing Optical Camera Lens
const lensGlass = new THREE.Mesh(
    new THREE.CircleGeometry(0.016, 24),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
);
lensGlass.position.z = 0.081;
satGroup.add(lensGlass);

// 3. Aft Ion Thruster Nozzle
const thruster = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.025, 16), darkMetalMat);
thruster.rotation.x = Math.PI / 2;
thruster.position.z = -0.055;
satGroup.add(thruster);

// 4. High-Gain Parabolic Dish Antenna & Feed Horn (Mounted on top)
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

// 5. Articulated Dual Solar Arrays with Photovoltaic Grid
function createSolarWing(side) {
    const wing = new THREE.Group();
    // Strut yoke
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

    // 3 segmented solar panels per wing
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

// 6. Navigation Strobe Beacon
const navBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
navBeacon.position.set(0, -0.032, 0);
satGroup.add(navBeacon);

// Dedicated point light so the metallic 3D satellite is always clearly visible even in Earth's shadow
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
        const phi = (90 - data.lat) * (Math.PI / 180);
        const theta = (data.lon + 180) * (Math.PI / 180);
        const r = 1.0; 
        const x = -(r * Math.sin(phi) * Math.cos(theta));
        const z = (r * Math.sin(phi) * Math.sin(theta));
        const y = (r * Math.cos(phi));
        
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
        
        beacon.position.set(x, y, z); 
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

let coneMesh, ringMesh, sunPatchMesh;
function buildLaser() {
    if(coneMesh) scene.remove(coneMesh);
    if(ringMesh) scene.remove(ringMesh);
    if(sunPatchMesh) scene.remove(sunPatchMesh);

    const coneHeight = Math.max(0.18, orbitRadius - 1.0);
    let visualSwath = Math.min(0.45, swathRadius * (1 + (coneHeight * 0.25)));
    
    const cGeo = new THREE.ConeGeometry(visualSwath, coneHeight, 32, 1, true);
    cGeo.translate(0, -coneHeight/2, 0);
    cGeo.rotateX(-Math.PI / 2); 
    coneMesh = new THREE.Mesh(cGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.16, wireframe: true, depthWrite: false }));
    scene.add(coneMesh);

    ringMesh = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.01, swathRadius - 0.014), swathRadius, 48), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    scene.add(ringMesh);

    // Warm sunlit illumination disc inside footprint
    sunPatchMesh = new THREE.Mesh(
        new THREE.CircleGeometry(swathRadius, 48),
        new THREE.MeshBasicMaterial({
            color: 0xfff7ed,
            transparent: true,
            opacity: 0.14,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    scene.add(sunPatchMesh);
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

    let lat, lon;

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
        sunPatchMesh.position.copy(satGroup.position).normalize().multiplyScalar(1.002); sunPatchMesh.lookAt(0,0,0);

        lat = (Math.asin(satGroup.position.y / orbitRadius) * 180 / Math.PI);
        lon = ((Math.atan2(satGroup.position.z, satGroup.position.x) * 180 / Math.PI) - (earthMesh.rotation.y * 180 / Math.PI)) % 360;
        if (lon < -180) lon += 360; if (lon > 180) lon -= 360;

        document.getElementById('hud-lat').textContent = lat.toFixed(2);
        document.getElementById('hud-lon').textContent = lon.toFixed(2);
        satMarker.setLatLng([lat, lon]); satCircle.setLatLng([lat, lon]);

        const now = Date.now();
        if (isDockExpanded && currentTab === 'weather' && now - lastScannedTime > 8000) {
            lastScannedTime = now;
            fetchSubSatData(lat, lon);
        }
    } else {
        // STATIONARY GEO LOCK: Pinned to exact ground coordinates as Earth spins
        const phi = (90 - lockedLat) * (Math.PI / 180);
        const theta = (lockedLon + 180) * (Math.PI / 180) + earthMesh.rotation.y;

        const r = orbitRadius;
        const x = -(r * Math.sin(phi) * Math.cos(theta));
        const z = (r * Math.sin(phi) * Math.sin(theta));
        const y = (r * Math.cos(phi));
        
        satGroup.position.set(x, y, z);
        satGroup.lookAt(0,0,0);
        
        coneMesh.position.copy(satGroup.position); coneMesh.lookAt(0,0,0);
        ringMesh.position.copy(satGroup.position).normalize().multiplyScalar(1.003); ringMesh.lookAt(0,0,0); 
        sunPatchMesh.position.copy(satGroup.position).normalize().multiplyScalar(1.002); sunPatchMesh.lookAt(0,0,0);
    }

    // Update Satellite Daylight Spotlight to illuminate night side coverage area
    satSpotLight.position.copy(satGroup.position);
    satSpotLight.target.position.set(0, 0, 0);
    const coneDist = Math.max(0.18, orbitRadius - 1.0);
    satSpotLight.angle = Math.atan2(swathRadius * 1.15, coneDist);

    // Blink red navigation strobe on satellite
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
    fetchSubSatData(0, 0, true);
}, 800);

animate();
