import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parseKml } from "./kml-parser.js";
import { STATUS_LABELS } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const kmlPath = resolve(__dirname, "..", "doc.kml");
const outPath = resolve(__dirname, "..", "map.html");

const { places } = parseKml(kmlPath);

// 193 UN member states + 2 observers (Holy See, Palestine) = 195
const UN_CODES = new Set([
  "AF","AL","DZ","AD","AO","AG","AR","AM","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BT",
  "BO","BA","BW","BR","BN","BG","BF","BI","CV","KH","CM","CA","CF","TD","CL","CN","CO","KM","CG","CD",
  "CR","CI","HR","CU","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","SZ","ET","FJ","FI",
  "FR","GA","GM","GE","DE","GH","GR","GD","GT","GN","GW","GY","HT","HN","HU","IS","IN","ID","IR","IQ",
  "IE","IL","IT","JM","JP","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI",
  "LT","LU","MG","MW","MY","MV","ML","MT","MH","MR","MU","MX","FM","MD","MC","MN","ME","MA","MZ","MM",
  "NA","NR","NP","NL","NZ","NI","NE","NG","MK","NO","OM","PK","PW","PA","PG","PY","PE","PH","PL","PT",
  "QA","RO","RU","RW","KN","LC","VC","WS","SM","ST","SA","SN","RS","SC","SL","SG","SK","SI","SB","SO",
  "ZA","SS","ES","LK","SD","SR","SE","CH","SY","TJ","TZ","TH","TL","TG","TO","TT","TN","TR","TM","TV",
  "UG","UA","AE","GB","US","UY","UZ","VU","VE","VN","YE","ZM","ZW",
  "VA","PS", // observers
]);

// Normalize status IDs — corrupted values (e.g. 916343000) represent "Transited"
function normalizeStatus(statusId: number): number {
  if (statusId === 0 || statusId === 1 || statusId === 4) {
    return statusId;
  }
  return 5; // Transited
}

interface CountryData {
  code: string;
  name: string;
  statusId: number;
  subRegions: { code: string; name: string; statusId: number }[];
}

const countryMap = new Map<string, CountryData>();
const subRegions: { code: string; name: string; statusId: number; description: string }[] = [];

for (const p of places) {
  if (!p.code) continue;
  if (p.description.startsWith("World") && UN_CODES.has(p.code)) {
    countryMap.set(p.code, {
      code: p.code,
      name: p.name,
      statusId: normalizeStatus(p.statusId),
      subRegions: [],
    });
  } else if (!p.description.startsWith("World")) {
    subRegions.push({ code: p.code, name: p.name, statusId: normalizeStatus(p.statusId), description: p.description });
  }
}

// Assign sub-regions to their parent country (code prefix before '-')
for (const sr of subRegions) {
  const countryCode = sr.code.split("-")[0];
  const country = countryMap.get(countryCode);
  if (country) {
    country.subRegions.push({ code: sr.code, name: sr.name, statusId: sr.statusId });
  }
}

const countriesArray = Array.from(countryMap.values());
const travelData = JSON.stringify(countriesArray);
const statusLabelsJson = JSON.stringify(STATUS_LABELS);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mark O'Travel Map</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  #stats-bar {
    background: #1a1a2e; color: #fff; padding: 10px 20px;
    display: flex; gap: 20px; align-items: center; flex-wrap: wrap;
    font-size: 14px;
  }
  #stats-bar .stat { display: flex; align-items: center; gap: 6px; }
  #stats-bar .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
  @media (max-width: 768px) {
    #stats-bar { font-size: 11px; gap: 8px; padding: 8px 12px; }
    #stats-bar .dot { width: 8px; height: 8px; }
  }
  #map-container { display: flex; height: calc(100vh - 44px); }
  #map { flex: 1; }
  #panel {
    width: 320px; background: #f8f9fa; border-left: 1px solid #ddd;
    overflow-y: auto; padding: 20px; display: none;
  }
  #panel.open { display: block; }
  #panel h2 { margin-bottom: 4px; font-size: 18px; }
  #panel .country-status { margin-bottom: 16px; font-size: 14px; }
  #panel .sr-list { list-style: none; }
  #panel .sr-list li {
    padding: 6px 0; border-bottom: 1px solid #eee;
    display: flex; align-items: center; gap: 8px; font-size: 13px;
  }
  #panel .badge {
    display: inline-block; padding: 2px 8px; border-radius: 10px;
    color: #fff; font-size: 11px; white-space: nowrap;
  }
  #panel .close-btn {
    float: right; cursor: pointer; background: none; border: none;
    font-size: 20px; color: #666;
  }
  .legend {
    background: white; padding: 10px 14px; border-radius: 6px;
    box-shadow: 0 1px 5px rgba(0,0,0,0.3); font-size: 13px; line-height: 22px;
  }
  .legend i {
    width: 14px; height: 14px; display: inline-block; margin-right: 6px;
    border-radius: 3px; vertical-align: middle;
  }
</style>
</head>
<body>
<div id="stats-bar"></div>
<div id="map-container">
  <div id="map"></div>
  <div id="panel">
    <button class="close-btn" onclick="closePanel()">&times;</button>
    <h2 id="panel-title"></h2>
    <div class="country-status" id="panel-status"></div>
    <ul class="sr-list" id="panel-regions"></ul>
  </div>
</div>
<script>
const travelData = ${travelData};
const STATUS_LABELS = ${statusLabelsJson};

const STATUS_COLORS = {
  0: '#9e9e9e', // Not visited - gray
  1: '#e53935', // Lived - red
  4: '#43a047', // Visited - green
  5: '#ff9800', // Transited - orange
};

// Build lookup by country code
const countryLookup = {};
travelData.forEach(c => { countryLookup[c.code] = c; });

// Stats bar
const counts = {};
travelData.forEach(c => { counts[c.statusId] = (counts[c.statusId] || 0) + 1; });
const statsBar = document.getElementById('stats-bar');
const statsTitle = document.createElement('span');
statsTitle.style.fontWeight = 'bold';
statsTitle.textContent = "Mark O'Travel";
statsBar.appendChild(statsTitle);
[4, 1, 5, 0].forEach(id => {
  if (!counts[id]) return;
  const stat = document.createElement('span');
  stat.className = 'stat';
  stat.innerHTML = '<span class="dot" style="background:' + STATUS_COLORS[id] + '"></span>' +
    STATUS_LABELS[id] + ': ' + counts[id];
  statsBar.appendChild(stat);
});
const totalStat = document.createElement('span');
totalStat.className = 'stat';
totalStat.style.marginLeft = 'auto';
totalStat.textContent = 'Total: ' + travelData.length + ' countries';
statsBar.appendChild(totalStat);

// Map
const map = L.map('map', { worldCopyJump: true }).setView([20, 0], 2);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  maxZoom: 18,
}).addTo(map);

// Load GeoJSON
fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
  .then(r => r.json())
  .then(geojson => {
    L.geoJSON(geojson, {
      style: feature => {
        const iso = feature.properties['ISO3166-1-Alpha-2'];
        const country = countryLookup[iso];
        const statusId = country ? country.statusId : -1;
        return {
          fillColor: STATUS_COLORS[statusId] || '#e0e0e0',
          weight: 1,
          color: '#fff',
          fillOpacity: country ? 0.7 : 0.2,
        };
      },
      onEachFeature: (feature, layer) => {
        const iso = feature.properties['ISO3166-1-Alpha-2'];
        const country = countryLookup[iso];
        if (country) {
          layer.bindTooltip(country.name, { sticky: true });
        }
        layer.on('click', () => {
          if (country) openPanel(country);
        });
      },
    }).addTo(map);
  });

// Legend
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function() {
  const div = L.DomUtil.create('div', 'legend');
  div.innerHTML = '<strong>Status</strong><br>';
  [4, 1, 5, 0].forEach(id => {
    div.innerHTML += '<i style="background:' + STATUS_COLORS[id] + '"></i>' +
      STATUS_LABELS[id] + '<br>';
  });
  return div;
};
legend.addTo(map);

// Panel
function openPanel(country) {
  const panel = document.getElementById('panel');
  document.getElementById('panel-title').textContent = country.name;
  const statusBadge = '<span class="badge" style="background:' +
    STATUS_COLORS[country.statusId] + '">' + STATUS_LABELS[country.statusId] + '</span>';
  document.getElementById('panel-status').innerHTML = statusBadge;
  const list = document.getElementById('panel-regions');
  list.innerHTML = '';
  if (country.subRegions.length === 0) {
    list.innerHTML = '<li style="color:#999">No sub-region data</li>';
  } else {
    country.subRegions.forEach(sr => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="badge" style="background:' +
        STATUS_COLORS[sr.statusId] + '">' + STATUS_LABELS[sr.statusId] + '</span>' + sr.name;
      list.appendChild(li);
    });
  }
  panel.classList.add('open');
  map.invalidateSize();
}

function closePanel() {
  document.getElementById('panel').classList.remove('open');
  map.invalidateSize();
}
<\/script>
</body>
</html>`;

writeFileSync(outPath, html, "utf-8");
console.log(`Generated ${outPath}`);
console.log(`Countries: ${countriesArray.length}, Sub-regions: ${subRegions.length}`);
