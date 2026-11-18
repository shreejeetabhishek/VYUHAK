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

// --- UI LOGIC ---
let isDockExpanded = false;
let currentTab = 'intel';

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
}

let isGeoLocked = false;
let lockedLat = 0;
let lockedLon = 0;

function toggleGeoLock() {
    isGeoLocked = !isGeoLocked;
    const btn = document.getElementById('btn-geo-lock');
    const ind = document.getElementById('lock-indicator');
    
    if(isGeoLocked) {
        btn.classList.add('bg-sky-700/50', 'border-sky-400');
        ind.textContent = 'ON'; ind.classList.replace('text-slate-400', 'text-sky-300');
        document.getElementById('hud-sat-name').textContent = 'VK-Hover-02';
        document.getElementById('hud-vel').textContent = '0.00';
        playSound('lock');
        
        lockedLat = parseFloat(document.getElementById('hud-lat').textContent);
        lockedLon = parseFloat(document.getElementById('hud-lon').textContent);
        fetchSubSatData(lockedLat, lockedLon);
    } else {
        btn.classList.remove('bg-sky-700/50', 'border-sky-400');
        ind.textContent = 'OFF'; ind.classList.replace('text-sky-300', 'text-slate-400');
        document.getElementById('hud-sat-name').textContent = 'VK-Tracker-01';
        updateSpeed(orbitSpeed); 
        playSound('click');
    }
}

// --- API ENGINE ---
const API_ENDPOINTS = {
    EARTHQUAKES: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
    EONET: 'https://eonet.gsfc.nasa.gov/api/v3/events?limit=5&days=7',
    NEWS: 'https://api.rss2json.com/v1/api.json?rss_url=http://feeds.bbci.co.uk/news/world/rss.xml',
    RELIEFWEB: 'https://api.reliefweb.int/v1/disasters?appname=vyuhak&preset=latest&profile=full&limit=3',
    WEATHER: (lat, lon) => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
    REVGEO: (lat, lon) => `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`, // Reliable client-side free API
    WIKI: (lat, lon) => `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=3&format=json&origin=*`
};

let liveIntelData = [];
let apiCooldown = false;

async function fetchLiveIntel() {
    if(apiCooldown) return;
    apiCooldown = true;
    setTimeout(() => { apiCooldown = false; }, 15000); 
    
    document.getElementById('connection-led').classList.add('recording');
    const feed = document.getElementById('intel-feed');
    feed.innerHTML = '<div class="text-center p-4 text-[12px] text-sky-400 font-bold loading-pulse">Scanning global networks for breaking events...</div>';
    
    liveIntelData = [];
    let newItemsHTML = '';
    let alertCount = 0;

    try {
        const eqRes = await fetch(API_ENDPOINTS.EARTHQUAKES);
        const eqData = await eqRes.json();
        if (eqData.features && eqData.features.length > 0) {
            const topEQs = eqData.features.slice(0, 2);
            topEQs.forEach(eq => {
                alertCount++;
                const mag = eq.properties.mag.toFixed(1);
                const place = eq.properties.place;
                const [lon, lat] = eq.geometry.coordinates;
                liveIntelData.push({ type: 'eq', lat, lon, title: `Earthquake (${mag})` });
                newItemsHTML += `
                <div class="api-item bg-red-900/20 border border-red-500/30 rounded-lg p-3 flex gap-3 items-start cursor-pointer hover:bg-red-900/40 transition" onclick="parkSatelliteAt(${lat}, ${lon})">
                    <div class="text-xl">🌋</div>
                    <div>
                        <div class="text-[12px] font-bold text-red-400 mb-1">Earthquake Detected (Magnitude ${mag})</div>
                        <div class="text-[11px] text-slate-200">Near ${place}</div>
                        <div class="text-[10px] text-slate-500 mt-1">Tap to deploy satellite overhead</div>
                    </div>
                </div>`;
            });
        }

        try {
            const newsRes = await fetch(API_ENDPOINTS.NEWS);
            const newsData = await newsRes.json();
            if (newsData.items && newsData.items.length > 0) {
                const topNews = newsData.items.slice(0, 2);
                topNews.forEach(n => {
                    alertCount++;
                    newItemsHTML += `
                    <div class="api-item bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 flex gap-3 items-start cursor-pointer hover:bg-blue-900/40 transition">
                        <div class="text-xl">📰</div>
                        <div>
                            <div class="text-[12px] font-bold text-blue-400 mb-1">Breaking Global News</div>
                            <div class="text-[11px] text-slate-200">${n.title}</div>
                        </div>
                    </div>`;
                });
            }
        } catch(e) {}

        try {
            const rwRes = await fetch(API_ENDPOINTS.RELIEFWEB);
            const rwData = await rwRes.json();
            if (rwData.data && rwData.data.length > 0) {
                rwData.data.slice(0, 2).forEach(report => {
                    alertCount++;
                    newItemsHTML += `
                    <div class="api-item bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 flex gap-3 items-start cursor-pointer hover:bg-amber-900/40 transition">
                        <div class="text-xl">⚠️</div>
                        <div>
                            <div class="text-[12px] font-bold text-amber-400 mb-1">Humanitarian Alert</div>
                            <div class="text-[11px] text-slate-200">${report.fields.title}</div>
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
            if(!isDockExpanded || currentTab !== 'intel') playSound('alert');
        } else {
            badge.classList.add('hidden');
        }
        
        renderIntelMarkers();
    } catch(e) {
        feed.innerHTML = '<div class="text-center p-4 text-[12px] text-red-500 font-bold">Failed to connect to global networks.</div>';
    } finally {
        document.getElementById('connection-led').classList.remove('recording');
    }
}

let weatherCooldown = false;
async function fetchSubSatData(lat, lon) {
    if(weatherCooldown) return;
    weatherCooldown = true;
    setTimeout(() => { weatherCooldown = false; }, 1500); // 1.5s fast cooldown

    document.getElementById('weather-loc').textContent = `${parseFloat(lat).toFixed(1)}, ${parseFloat(lon).toFixed(1)}`;
    document.getElementById('w-temp').textContent = "Scanning...";
    document.getElementById('w-wind').textContent = "Scanning...";
    document.getElementById('geo-data').textContent = "Scanning the ground below for territory data...";
    document.getElementById('wiki-data').innerHTML = "";

    try {
        const wRes = await fetch(API_ENDPOINTS.WEATHER(lat, lon));
        const wData = await wRes.json();
        if (wData.current_weather) {
            document.getElementById('w-temp').innerHTML = `${wData.current_weather.temperature} &deg;C`;
            document.getElementById('w-wind').innerHTML = `${wData.current_weather.windspeed} km/h`;
        }

        // Reliable Free Reverse Geocoding
        const geoRes = await fetch(API_ENDPOINTS.REVGEO(lat, lon));
        const geoData = await geoRes.json();
        
        if (!geoData.countryName) {
            document.getElementById('geo-data').innerHTML = `<span class="text-sky-400 font-bold">Oceanic Sector</span><br>The satellite is currently flying over open water. No sovereign territory detected.`;
        } else {
            const ctry = geoData.countryName || '';
            const state = geoData.principalSubdivision || '';
            const city = geoData.locality || geoData.city || '';
            document.getElementById('geo-data').innerHTML = `
                The satellite is flying over <strong class="text-emerald-400">${ctry}</strong>.<br>
                Specific region: <span class="text-white">${city || state || 'Unknown limits'}</span>
            `;
            
            try {
                const wikiRes = await fetch(API_ENDPOINTS.WIKI(lat, lon));
                const wikiData = await wikiRes.json();
                if(wikiData.query && wikiData.query.geosearch && wikiData.query.geosearch.length > 0) {
                    let wHtml = `<div class="mt-3 text-[11px] text-sky-300 font-bold uppercase">Notable Landmarks Nearby:</div><ul class="list-disc pl-4 mt-1">`;
                    wikiData.query.geosearch.forEach(item => {
                        wHtml += `<li>${item.title}</li>`;
                    });
                    wHtml += `</ul>`;
                    document.getElementById('wiki-data').innerHTML = wHtml;
                }
            } catch(e) {}
        }
    } catch(e) {
        document.getElementById('w-temp').textContent = "Error";
        document.getElementById('w-wind').textContent = "Error";
        document.getElementById('geo-data').textContent = "Could not identify the ground below.";
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
    }
    
    // UI Updates
    document.getElementById('hud-lat').textContent = lat.toFixed(2);
    document.getElementById('hud-lon').textContent = lon.toFixed(2);
    satMarker.setLatLng([lat, lon]);
    satCircle.setLatLng([lat, lon]);

    // Fast Camera Follow
    if (activeCamera !== 'FREE') {
        setTimeout(() => {
            const targetCamPos = satGroup.position.clone().multiplyScalar(1.5);
            camera.position.copy(targetCamPos);
            camera.lookAt(satGroup.position);
        }, 50);
    }
    
    fetchSubSatData(lat, lon);
}

// --- 3D ENGINE & PHYSICS ---
let orbitTime = 0;
let orbitRadius = 1.06; // Start at 400km (Earth r=1.0 + 400/6371)
let orbitSpeed = 0.003;
let orbitInclination = 45; // degrees
let swathRadius = 0.25; 
let activeEngine = '3D', activeCamera = 'FREE';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.5, window.innerWidth < window.innerHeight ? 4.0 : 2.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('globe-viewport').appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.05;
controls.minDistance = 1.1; controls.maxDistance = 12;

scene.add(new THREE.AmbientLight(0xffffff, 0.15));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(5, 2, 3);
scene.add(sunLight);

// Earth Textures
const texLoader = new THREE.TextureLoader();
const earthDayTex = texLoader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
const earthNightTex = texLoader.load('https://unpkg.com/three-globe/example/img/earth-night.jpg');
const earthMat = new THREE.MeshPhongMaterial({ color: 0xffffff, map: earthDayTex, shininess: 15 });
const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), earthMat);
scene.add(earthMesh);

// Atmosphere
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.02, 32, 32), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.15, side: THREE.BackSide, depthWrite: false })));

// --- VISIBLE ORBIT LINE TRACTORY ---
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
    scene.add(orbitLineMesh);
}
drawOrbitLine();

const satGroup = new THREE.Group();
const busMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.4 });
satGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), busMat));
const panelMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, side: THREE.DoubleSide });
const panelGeo = new THREE.PlaneGeometry(0.25, 0.08);
const pL = new THREE.Mesh(panelGeo, panelMat); pL.position.x = -0.15; satGroup.add(pL);
const pR = new THREE.Mesh(panelGeo, panelMat); pR.position.x = 0.15; satGroup.add(pR);
const dish = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
dish.position.z = 0.04; dish.rotateX(Math.PI/2);
satGroup.add(dish);
scene.add(satGroup);

let markerMeshes = [];
let mapMarkers = [];
function renderIntelMarkers() {
    markerMeshes.forEach(m => earthMesh.remove(m));
    markerMeshes = [];
    mapMarkers.forEach(m => map.removeLayer(m));
    mapMarkers = [];

    liveIntelData.forEach(data => {
        // Convert to Cartesian (Markers live on rotating earthMesh)
        const phi = (90 - data.lat) * (Math.PI / 180);
        const theta = (data.lon + 180) * (Math.PI / 180);
        const r = 1.0; 
        const x = -(r * Math.sin(phi) * Math.cos(theta));
        const z = (r * Math.sin(phi) * Math.sin(theta));
        const y = (r * Math.cos(phi));
        
        let color = 0xef4444; // Default red
        let hexColor = '#ef4444';
        if (data.type === 'eonet') { color = 0xf59e0b; hexColor = '#f59e0b'; } // Amber
        if (data.type === 'rw') { color = 0xd946ef; hexColor = '#d946ef'; } // Fuchsia
        
        // Render 3D Beacon (Glowing Pillar)
        const beacon = new THREE.Group();
        
        const pGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.15, 8);
        const pMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
        const pillar = new THREE.Mesh(pGeo, pMat);
        pillar.translateY(0.075); // Push up so base is at 0
        beacon.add(pillar);
        
        // Add glowing ring at base
        const ringGeo = new THREE.RingGeometry(0.015, 0.025, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotateX(Math.PI/2);
        ring.translateZ(-0.001); // Prevent z-fighting
        beacon.add(ring);
        
        beacon.position.set(x, y, z); 
        beacon.lookAt(0,0,0); // Orient away from center
        beacon.rotateX(Math.PI/2); 
        
        earthMesh.add(beacon); 
        markerMeshes.push(beacon);

        // Render 2D Map Marker
        const mIcon = L.divIcon({ html: `<div style="width:12px;height:12px;background:${hexColor};border-radius:50%;border:2px solid white;box-shadow:0 0 8px ${hexColor};"></div>`, className: '', iconSize: [12, 12] });
        const m = L.marker([data.lat, data.lon], {icon: mIcon}).addTo(map);
        
        // Click 2D marker to deploy
        m.on('click', function() { parkSatelliteAt(data.lat, data.lon); });
        mapMarkers.push(m);
    });
}

const map = L.map('map-viewport', { zoomControl: false, attributionControl: false }).setView([0, 0], 3);
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
    const coneHeight = orbitRadius - 1.0;
    
    // Scale cone base (swath) visually if orbit gets very high so it doesn't look ridiculous
    // At orbitRadius = 1.06 (400km), visual swath is standard. 
    // At GEO (6.6), visual swath expands if we don't constrain it.
    let visualSwath = swathRadius * (coneHeight * 1.5); 
    
    const cGeo = new THREE.ConeGeometry(visualSwath, coneHeight, 32, 1, true);
    cGeo.translate(0, -coneHeight/2, 0); cGeo.rotateX(-Math.PI / 2); 
    coneMesh = new THREE.Mesh(cGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.15, wireframe: true, depthWrite: false }));
    scene.add(coneMesh);
    ringMesh = new THREE.Mesh(new THREE.RingGeometry(visualSwath - 0.015, visualSwath, 32), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
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

// Sliders and Settings Math
function updateAltitude(km) {
    // Earth radius = 6371km. r = 1 + (km / 6371)
    orbitRadius = 1.0 + (parseFloat(km) / 6371);
    document.getElementById('alt-val').textContent = km + " km";
    document.getElementById('hud-alt').textContent = km;
    
    // Scale satellite speed down physically as it gets higher (Kepler's third law approximate)
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
    // Base speed modified by orbit radius altitude
    orbitSpeed = baseSpeed / (orbitRadius * 0.5);
    
    const mult = (baseSpeed / 0.003).toFixed(1);
    document.getElementById('speed-val').textContent = mult + "x " + (mult == 1.0 ? "(Real-time)" : "(Fast)");
}

function animate() {
    requestAnimationFrame(animate);
    earthMesh.rotation.y += 0.0005;

    if (!isGeoLocked) {
        // FREE ORBIT PHYSICS
        orbitTime += orbitSpeed;
        const inclRad = orbitInclination * Math.PI / 180;
        
        const x = Math.cos(orbitTime) * orbitRadius;
        const z = Math.sin(orbitTime) * Math.cos(inclRad) * orbitRadius;
        const y = Math.sin(orbitTime) * Math.sin(inclRad) * orbitRadius;
        
        satGroup.position.set(x, y, z);
        satGroup.lookAt(0,0,0);
        
        coneMesh.position.copy(satGroup.position); coneMesh.lookAt(0,0,0);
        ringMesh.position.copy(satGroup.position).normalize().multiplyScalar(1.002); ringMesh.lookAt(0,0,0); 

        let lat = (Math.asin(satGroup.position.y / orbitRadius) * 180 / Math.PI).toFixed(2);
        let lon = ((Math.atan2(satGroup.position.z, satGroup.position.x) * 180 / Math.PI) - (earthMesh.rotation.y * 180 / Math.PI)) % 360;
        if (lon < -180) lon += 360; if (lon > 180) lon -= 360; lon = lon.toFixed(2);

        document.getElementById('hud-lat').textContent = lat; document.getElementById('hud-lon').textContent = lon;
        satMarker.setLatLng([lat, lon]); satCircle.setLatLng([lat, lon]);
        document.getElementById('hud-time').textContent = 'UTC ' + new Date().toISOString().substr(11,8);
    } else {
        // GEO STATIONARY PHYSICS (LOCKED TO GROUND)
        const phi = (90 - lockedLat) * (Math.PI / 180);
        const earthRotDegrees = (earthMesh.rotation.y * 180 / Math.PI) % 360;
        const theta = (lockedLon + earthRotDegrees + 180) * (Math.PI / 180);

        const r = orbitRadius;
        const x = -(r * Math.sin(phi) * Math.cos(theta));
        const z = (r * Math.sin(phi) * Math.sin(theta));
        const y = (r * Math.cos(phi));
        
        satGroup.position.set(x, y, z);
        satGroup.lookAt(0,0,0);
        
        coneMesh.position.copy(satGroup.position); coneMesh.lookAt(0,0,0);
        ringMesh.position.copy(satGroup.position).normalize().multiplyScalar(1.002); ringMesh.lookAt(0,0,0); 
    }

    // CAMERA PHYSICS
    if (activeCamera === 'FREE') {
        controls.update();
    } else if (activeCamera === 'CHASE') {
        const inclRad = orbitInclination * Math.PI / 180;
        let forward;
        
        if (!isGeoLocked) {
            forward = new THREE.Vector3(
                -Math.sin(orbitTime), 
                Math.cos(orbitTime) * Math.sin(inclRad), 
                Math.cos(orbitTime) * Math.cos(inclRad)
            ).normalize();
        } else {
            // When locked, look east (direction of rotation)
            const phi = (90 - lockedLat) * (Math.PI / 180);
            const earthRotDegrees = (earthMesh.rotation.y * 180 / Math.PI) % 360;
            const theta = (lockedLon + earthRotDegrees + 180) * (Math.PI / 180);
            
            forward = new THREE.Vector3(
                Math.sin(phi) * Math.sin(theta), 
                0, 
                Math.sin(phi) * Math.cos(theta)
            ).normalize();
        }
        
        const up = new THREE.Vector3(0,1,0);
        const right = new THREE.Vector3().crossVectors(forward, up).normalize();
        
        // Scale offset based on altitude so we don't clip into satellite at GEO
        const scale = 1.0 + ((orbitRadius - 1.0) * 0.5);
        const offset = new THREE.Vector3().addScaledVector(forward, -0.6 * scale).addScaledVector(up, 0.4 * scale).addScaledVector(right, 0.1 * scale);
        
        camera.position.lerp(satGroup.position.clone().add(offset), 0.1);
        camera.lookAt(satGroup.position);
    } else if (activeCamera === 'NADIR') {
        // Mount camera on back of satellite looking down
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

setTimeout(fetchLiveIntel, 1000);
animate();
