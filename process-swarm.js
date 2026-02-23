#!/usr/bin/env node
// Converts Swarm data export JSON files → swarm/data.json (GeoJSON)
// Usage: node process-swarm.js <path-to-swarm-data-dir>

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const dataDir = process.argv[2];
if (!dataDir) {
  console.error('Usage: node process-swarm.js <path-to-swarm-data-dir>');
  process.exit(1);
}

const outputFile = join(process.cwd(), 'swarm', 'data.json');

const checkinFiles = readdirSync(dataDir)
  .filter(f => /^checkins\d+\.json$/.test(f))
  .sort();

if (checkinFiles.length === 0) {
  console.error('No checkin JSON files found in', dataDir);
  process.exit(1);
}

console.log(`Found ${checkinFiles.length} checkin files...\n`);

const features = [];

for (const file of checkinFiles) {
  const { items } = JSON.parse(readFileSync(join(dataDir, file), 'utf-8'));
  let added = 0;

  for (const item of items) {
    const lat = item.lat;
    const lng = item.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    const createdAt = item.createdAt;
    const year  = parseInt(createdAt.slice(0, 4));
    const month = parseInt(createdAt.slice(5, 7));
    const venueName = item.venue?.name || '';

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [+lng.toFixed(5), +lat.toFixed(5)] },
      properties: { y: year, m: month, v: venueName },
    });
    added++;
  }

  console.log(`  ${file}: ${added} checkins`);
}

const geojson = { type: 'FeatureCollection', features };
writeFileSync(outputFile, JSON.stringify(geojson));

const years = [...new Set(features.map(f => f.properties.y))].sort();
console.log(`\n✓ ${features.length.toLocaleString()} checkins written to swarm/data.json`);
console.log(`  Year range: ${years[0]} – ${years[years.length - 1]}`);
