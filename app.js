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
        const curLat = document.getElementById('hud-lat').textContent;
        const curLon = document.getElementById('hud-lon').textContent;
        fetchSubSatData(curLat, curLon);
    } else {
        btn.classList.remove('bg-sky-700/50', 'border-sky-400');
        ind.textContent = 'OFF'; ind.classList.replace('text-sky-300', 'text-slate-400');
        document.getElementById('hud-sat-name').textContent = 'VK-Tracker-01';
        document.getElementById('hud-vel').textContent = '7.6';
        playSound('click');
    }
}

// --- API ENGINE ---
const API_ENDPOINTS = {
    EARTHQUAKES: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
    EONET: 'https://eonet.gsfc.nasa.gov/api/v3/events?limit=3&days=5',
    NEWS: 'https://api.rss2json.com/v1/api.json?rss_url=http://feeds.bbci.co.uk/news/world/rss.xml',
    RELIEFWEB: 'https://api.reliefweb.int/v1/reports?appname=vyuhak&preset=latest&slim=1&limit=3',
    WEATHER: (lat, lon) => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
    REVGEO: (lat, lon) => `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
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
        // 1. Earthquakes
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
                        <div class="text-[10px] text-slate-500 mt-1">Tap to point satellite here</div>
                    </div>
                </div>`;
            });
        }

        // 2. Global News (BBC World)
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

        // 3. Humanitarian / Geopolitics (ReliefWeb)
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
    setTimeout(() => { weatherCooldown = false; }, 5000); 

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

        const geoRes = await fetch(API_ENDPOINTS.REVGEO(lat, lon), { headers: { 'Accept-Language': 'en' } });
        const geoData = await geoRes.json();
        
        if (geoData.error) {
            document.getElementById('geo-data').innerHTML = `<span class="text-sky-400 font-bold">Oceanic Sector</span><br>The satellite is currently flying over open water. No sovereign territory detected.`;
        } else {
            const d = geoData.address;
            const ctry = d.country || '';
            const state = d.state || d.region || '';
            const city = d.city || d.town || d.county || '';
            document.getElementById('geo-data').innerHTML = `
                The satellite is flying over <strong class="text-emerald-400">${ctry}</strong>.<br>
                Specific region: <span class="text-white">${city || state || 'Unknown limits'}</span>
            `;
            
            try {
                const wikiRes = await fetch(API_ENDPOINTS.WIKI(lat, lon));
                const wikiData = await wikiRes.json();
                if(wikiData.query && wikiData.query.geosearch && wikiData.query.geosearch.length > 0) {
                    let wHtml = `<div class="mt-3 text-[10px] text-sky-300 font-bold uppercase">Notable Landmarks Nearby:</div><ul class="list-disc pl-4 mt-1">`;
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

function parkSatelliteAt(lat, lon) {
    playSound('lock');
    if(!isGeoLocked) toggleGeoLock(); 
    
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const r = orbitRadius;
    const x = -(r * Math.sin(phi) * Math.cos(theta));
    const z = (r * Math.sin(phi) * Math.sin(theta));
    const y = (r * Math.cos(phi));
    
    satGroup.position.set(x, y, z);
    satGroup.lookAt(0,0,0);
    
    document.getElementById('hud-lat').textContent = lat.toFixed(2);
    document.getElementById('hud-lon').textContent = lon.toFixed(2);
    satMarker.setLatLng([lat, lon]);
    satCircle.setLatLng([lat, lon]);

    fetchSubSatData(lat, lon);
}

// --- 3D ENGINE & PHYSICS ---
let orbitTime = 0, orbitRadius = 1.4, orbitSpeed = 0.003, swathRadius = 0.25;
let activeEngine = '3D', activeCamera = 'FREE';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.5, window.innerWidth < window.innerHeight ? 5.0 : 3.0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('globe-viewport').appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.05;
controls.minDistance = 1.1; controls.maxDistance = 6;

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
const orbitPoints = [];
for (let i = 0; i <= 500; i++) {
    const t = (i / 500) * Math.PI * 20; 
    const x = Math.cos(t) * orbitRadius;
    const z = Math.sin(t) * orbitRadius;
    const y = Math.sin(t * 0.7) * orbitRadius * 0.4;
    orbitPoints.push(new THREE.Vector3(x, y, z));
}
const orbitLineGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
const orbitLineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.3 });
scene.add(new THREE.Line(orbitLineGeo, orbitLineMat));

// Satellite Mesh
const satGroup = new THREE.Group();
const busMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.4 });
satGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), busMat));
const panelMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, side: THREE.DoubleSide });
const panelGeo = new THREE.PlaneGeometry(0.25, 0.08);
const pL = new THREE.Mesh(panelGeo, panelMat); pL.position.x = -0.15; satGroup.add(pL);
const pR = new THREE.Mesh(panelGeo, panelMat); pR.position.x = 0.15; satGroup.add(pR);
const dish = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
dish.position.z = 0.06; dish.rotateX(Math.PI/2);
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
        const phi = (90 - data.lat) * (Math.PI / 180);
        const theta = (data.lon + 180) * (Math.PI / 180);
        const r = 1.0; 
        const x = -(r * Math.sin(phi) * Math.cos(theta));
        const z = (r * Math.sin(phi) * Math.sin(theta));
        const y = (r * Math.cos(phi));
        const color = data.type === 'eq' ? 0xef4444 : 0xf59e0b;
        
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 8), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 }));
        pillar.position.set(x, y, z); pillar.lookAt(0,0,0); pillar.rotateX(Math.PI/2); pillar.translateY(0.05);
        earthMesh.add(pillar); markerMeshes.push(pillar);

        const mIcon = L.divIcon({ html: `<div style="width:12px;height:12px;background:${data.type === 'eq' ? '#ef4444' : '#f59e0b'};border-radius:50%;border:2px solid white;"></div>`, className: '', iconSize: [12, 12] });
        mapMarkers.push(L.marker([data.lat, data.lon], {icon: mIcon}).addTo(map));
    });
}

const map = L.map('map-viewport', { zoomControl: false, attributionControl: false }).setView([0, 0], 3);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 17 }).addTo(map);
const satMarker = L.marker([0, 0], { icon: L.divIcon({ html: `<div style="width:16px;height:16px;background:#38bdf8;border-radius:50%;border:2px solid white;box-shadow:0 0 10px #38bdf8;"></div>`, className: '', iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(map);
const satCircle = L.circle([0, 0], { radius: 1200000, color: '#38bdf8', weight: 1, fillOpacity: 0.1 }).addTo(map);

let coneMesh, ringMesh;
function buildLaser() {
    if(coneMesh) scene.remove(coneMesh);
    if(ringMesh) scene.remove(ringMesh);
    const coneHeight = orbitRadius - 1.0;
    const cGeo = new THREE.ConeGeometry(swathRadius, coneHeight, 32, 1, true);
    cGeo.translate(0, -coneHeight/2, 0); cGeo.rotateX(-Math.PI / 2); 
    coneMesh = new THREE.Mesh(cGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.15, wireframe: true, depthWrite: false }));
    scene.add(coneMesh);
    ringMesh = new THREE.Mesh(new THREE.RingGeometry(swathRadius - 0.015, swathRadius, 32), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
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

function updateSwath(val) {
    swathRadius = parseFloat(val);
    buildLaser();
    const km = Math.round(swathRadius * 4800);
    document.getElementById('swath-val').textContent = km + " km";
    satCircle.setRadius(km * 1000);
}

function updateSpeed(val) {
    orbitSpeed = parseFloat(val);
    const mult = (orbitSpeed / 0.003).toFixed(1);
    document.getElementById('speed-val').textContent = mult + "x " + (mult == 1.0 ? "(Real-time)" : "(Fast)");
}

function animate() {
    requestAnimationFrame(animate);
    earthMesh.rotation.y += 0.0005;

    if (!isGeoLocked) {
        orbitTime += orbitSpeed;
        satGroup.position.set(Math.cos(orbitTime) * orbitRadius, Math.sin(orbitTime * 0.7) * orbitRadius * 0.4, Math.sin(orbitTime) * orbitRadius);
        satGroup.lookAt(0,0,0);
        
        coneMesh.position.copy(satGroup.position); coneMesh.lookAt(0,0,0);
        ringMesh.position.copy(satGroup.position).normalize().multiplyScalar(1.002); ringMesh.lookAt(0,0,0); 

        let lat = (Math.asin(satGroup.position.y / orbitRadius) * 180 / Math.PI).toFixed(2);
        let lon = ((Math.atan2(satGroup.position.z, satGroup.position.x) * 180 / Math.PI) - (earthMesh.rotation.y * 180 / Math.PI)) % 360;
        if (lon < -180) lon += 360; if (lon > 180) lon -= 360; lon = lon.toFixed(2);

        document.getElementById('hud-lat').textContent = lat; document.getElementById('hud-lon').textContent = lon;
        satMarker.setLatLng([lat, lon]); satCircle.setLatLng([lat, lon]);
        document.getElementById('hud-time').textContent = 'UTC ' + new Date().toISOString().substr(11,8);
    }

    if (activeCamera === 'FREE') {
        controls.update();
    } else if (activeCamera === 'CHASE') {
        const forward = new THREE.Vector3(-Math.sin(orbitTime), Math.cos(orbitTime * 0.7) * 0.4 * 0.7, Math.cos(orbitTime)).normalize();
        const up = new THREE.Vector3(0,1,0);
        const right = new THREE.Vector3().crossVectors(forward, up).normalize();
        const offset = new THREE.Vector3().addScaledVector(forward, -0.6).addScaledVector(up, 0.4).addScaledVector(right, 0.1);
        camera.position.lerp(satGroup.position.clone().add(offset), 0.1);
        camera.lookAt(satGroup.position);
    } else if (activeCamera === 'NADIR') {
        camera.position.lerp(satGroup.position.clone().multiplyScalar(1.06), 0.1);
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
