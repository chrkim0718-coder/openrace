export interface BuildingFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    height: number;
    min_height: number;
    levels: number;
    type: string;
    color?: string;
  };
}

export interface RoadSegment {
  lat: number;
  lng: number;
  width: number; // meters
}

// ── Caching ──────────────────────────────────────────────
interface CacheEntry {
  buildings: BuildingFeature[];
  roads: RoadSegment[];
  timestamp: number;
}

const cellCache = new Map<string, CacheEntry>();
const CELL_SIZE = 0.008; // ~800m per cell

function cellKey(lat: number, lng: number): string {
  const cLat = Math.floor(lat / CELL_SIZE);
  const cLng = Math.floor(lng / CELL_SIZE);
  return `${cLat},${cLng}`;
}

function nearbyCellKeys(lat: number, lng: number): string[] {
  const cLat = Math.floor(lat / CELL_SIZE);
  const cLng = Math.floor(lng / CELL_SIZE);
  const keys: string[] = [];
  for (let dl = -1; dl <= 1; dl++) {
    for (let dr = -1; dr <= 1; dr++) {
      keys.push(`${cLat + dl},${cLng + dr}`);
    }
  }
  return keys;
}

export function getCachedData(
  lat: number,
  lng: number,
): { buildings: BuildingFeature[]; roads: RoadSegment[] } {
  const keys = nearbyCellKeys(lat, lng);
  const buildings: BuildingFeature[] = [];
  const roads: RoadSegment[] = [];
  const seenB = new Set<string>();
  const seenR = new Set<string>();
  for (const k of keys) {
    const entry = cellCache.get(k);
    if (!entry) continue;
    for (const b of entry.buildings) {
      const id = b.geometry.coordinates[0]
        .map((c) => `${c[0].toFixed(5)},${c[1].toFixed(5)}`)
        .join('|');
      if (!seenB.has(id)) {
        seenB.add(id);
        buildings.push(b);
      }
    }
    for (const r of entry.roads) {
      const id = `${r.lat.toFixed(5)},${r.lng.toFixed(5)}`;
      if (!seenR.has(id)) {
        seenR.add(id);
        roads.push(r);
      }
    }
  }
  return { buildings, roads };
}

export function hasCellData(lat: number, lng: number): boolean {
  return cellCache.has(cellKey(lat, lng));
}

// ── Height parsing ───────────────────────────────────────
function parseHeight(tags: Record<string, string>): number {
  if (tags['height']) {
    const h = parseFloat(tags['height']);
    if (!isNaN(h)) return h;
  }
  if (tags['building:levels']) {
    const levels = parseInt(tags['building:levels'], 10);
    if (!isNaN(levels)) return levels * 3.5;
  }
  const building = tags['building'] || '';
  const defaults: Record<string, number> = {
    apartments: 18,
    residential: 9,
    commercial: 15,
    retail: 6,
    industrial: 8,
    school: 12,
    hospital: 20,
    office: 25,
    hotel: 30,
    yes: 8,
  };
  return defaults[building] ?? 8;
}

// ── Geometry helpers ──────────────────────────────────────

// Haversine distance in meters
export function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Point-in-polygon (ray casting). Polygon is array of [lng, lat]
export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: number[][],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Distance from point to polygon edge (meters, approximate)
export function distToPolygon(
  lat: number,
  lng: number,
  polygon: number[][],
): number {
  let minDist = Infinity;
  for (let i = 0; i < polygon.length - 1; i++) {
    const d = haversine(lat, lng, polygon[i][1], polygon[i][0]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// Distance from point to nearest road segment (meters)
export function distToNearestRoad(
  lat: number,
  lng: number,
  roads: RoadSegment[],
): number {
  let minDist = Infinity;
  for (const r of roads) {
    const d = haversine(lat, lng, r.lat, r.lng);
    // Account for road width — being within half-width counts as "on road"
    const effective = Math.max(0, d - r.width / 2);
    if (effective < minDist) minDist = effective;
  }
  return minDist;
}

// Calculate a beautiful pastel color based on building type, height, and coordinate hash
export function getPastelBuildingColor(
  buildingType: string,
  height: number,
  firstCoord: number[],
): string {
  const b = (buildingType || '').toLowerCase();

  // Deterministic seed for palette index based on building coordinate
  let hash = 0;
  const key = `${firstCoord[0].toFixed(5)},${firstCoord[1].toFixed(5)}`;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) & 0x7fffffff;
  }
  const variant = hash % 4;

  // Commercial / Retail / Hotel / Mall (Pastel Rose / Coral / Pink)
  if (
    b === 'commercial' ||
    b === 'retail' ||
    b === 'hotel' ||
    b === 'supermarket' ||
    b === 'mall' ||
    b === 'kiosk'
  ) {
    const palette = ['#f472b6', '#fda4af', '#fb7185', '#f43f5e'];
    return palette[variant];
  }

  // Office / Skyscraper / High-rise (Pastel Sky Blue / Cyan / Ice)
  if (b === 'office' || b === 'skyscraper' || height >= 35) {
    const palette = ['#60a5fa', '#38bdf8', '#7dd3fc', '#93c5fd'];
    return palette[variant];
  }

  // Apartments / Residential / House (Pastel Cream / Warm Peach / Sand)
  if (
    b === 'apartments' ||
    b === 'residential' ||
    b === 'house' ||
    b === 'detached' ||
    b === 'terrace' ||
    b === 'dormitory'
  ) {
    const palette = ['#fcd34d', '#fed7aa', '#fde68a', '#fef08a'];
    return palette[variant];
  }

  // School / Hospital / Public / Civic / Religion (Pastel Mint / Emerald / Sage)
  if (
    b === 'school' ||
    b === 'hospital' ||
    b === 'university' ||
    b === 'kindergarten' ||
    b === 'civic' ||
    b === 'church' ||
    b === 'public'
  ) {
    const palette = ['#6ee7b7', '#a7f3d0', '#34d399', '#4ade80'];
    return palette[variant];
  }

  // Industrial / Warehouse / Garage / Service (Pastel Lavender / Violet / Lilac)
  if (
    b === 'industrial' ||
    b === 'warehouse' ||
    b === 'service' ||
    b === 'manufacture' ||
    b === 'garage'
  ) {
    const palette = ['#c084fc', '#ddd6fe', '#a78bfa', '#c4b5fd'];
    return palette[variant];
  }

  // General default buildings (Soft pastel slate / mauve / teal tones)
  const defaultPalette = ['#94a3b8', '#cbd5e1', '#a1a1aa', '#99f6e4'];
  return defaultPalette[variant];
}

// Check if a point (lat, lng) is inside any building in the provided building list
export function isPointInsideBuilding(
  lat: number,
  lng: number,
  buildings: BuildingFeature[],
): boolean {
  for (const b of buildings) {
    const poly = b.geometry.coordinates[0];
    if (!poly || poly.length < 3) continue;
    let minLat = 90,
      maxLat = -90,
      minLng = 180,
      maxLng = -180;
    for (const c of poly) {
      if (c[1] < minLat) minLat = c[1];
      if (c[1] > maxLat) maxLat = c[1];
      if (c[0] < minLng) minLng = c[0];
      if (c[0] > maxLng) maxLng = c[0];
    }
    if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) continue;
    if (pointInPolygon(lat, lng, poly)) return true;
  }
  return false;
}

// Find a safe position on a nearby road outside any building
export function findSafeRoadPosition(
  lat: number,
  lng: number,
  buildings: BuildingFeature[],
  roads: RoadSegment[],
): { lat: number; lng: number } | null {
  if (!isPointInsideBuilding(lat, lng, buildings)) {
    return { lat, lng };
  }

  let bestPoint: { lat: number; lng: number } | null = null;
  let minDist = Infinity;

  // 1. Try to find the closest road segment that is not inside any building
  for (const r of roads) {
    const d = haversine(lat, lng, r.lat, r.lng);
    if (d < minDist && !isPointInsideBuilding(r.lat, r.lng, buildings)) {
      minDist = d;
      bestPoint = { lat: r.lat, lng: r.lng };
    }
  }

  // 2. If all road segments are inside buildings, fallback to nearest road segment
  if (!bestPoint && roads.length > 0) {
    for (const r of roads) {
      const d = haversine(lat, lng, r.lat, r.lng);
      if (d < minDist) {
        minDist = d;
        bestPoint = { lat: r.lat, lng: r.lng };
      }
    }
  }

  // 3. Fallback: search in expanding concentric rings for a point outside any building
  if (!bestPoint) {
    const R_STEPS = [5, 10, 15, 20, 30, 50, 80, 120];
    const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
    for (const distMeters of R_STEPS) {
      for (const deg of ANGLES) {
        const rad = (deg * Math.PI) / 180;
        const dLat = (distMeters * Math.cos(rad)) / 111111;
        const dLng =
          (distMeters * Math.sin(rad)) /
          (111111 * Math.cos((lat * Math.PI) / 180));
        const testLat = lat + dLat;
        const testLng = lng + dLng;
        if (!isPointInsideBuilding(testLat, testLng, buildings)) {
          return { lat: testLat, lng: testLng };
        }
      }
    }
  }

  return bestPoint;
}


// ── Data fetching ─────────────────────────────────────────
export async function fetchAreaData(
  lat: number,
  lng: number,
  radius = 500,
): Promise<{ buildings: BuildingFeature[]; roads: RoadSegment[] }> {
  const key = cellKey(lat, lng);
  const cached = cellCache.get(key);
  if (cached) {
    return { buildings: cached.buildings, roads: cached.roads };
  }

  const query = `[out:json][timeout:10];
    (
      way[building](around:${radius},${lat},${lng});
      way[highway](around:${radius},${lat},${lng});
    );
    out geom;`;

  const ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ];

  let data: any = null;
  for (const ep of ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(ep, {
        method: 'POST',
        body: query,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        data = await res.json();
        if (data && data.elements) break;
      }
    } catch {
      // try next mirror endpoint
    }
  }

  const elements: any[] = data?.elements || [];

  const buildings: BuildingFeature[] = [];
  const roads: RoadSegment[] = [];

  for (const el of elements) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const tags = el.tags || {};

    if (tags['building']) {
      if (el.geometry.length < 3) continue;
      const coords = el.geometry.map((p: any) => [p.lon, p.lat]);
      if (
        coords[0][0] !== coords[coords.length - 1][0] ||
        coords[0][1] !== coords[coords.length - 1][1]
      ) {
        coords.push(coords[0]);
      }
      const height = parseHeight(tags);
      const minHeight = tags['min_height']
        ? parseFloat(tags['min_height']) || 0
        : 0;
      const bType = tags['building'] || 'yes';

      const color = getPastelBuildingColor(bType, height, coords[0]);

      buildings.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: {
          height,
          min_height: minHeight,
          levels: parseInt(tags['building:levels'] || '0', 10),
          type: bType,
          color,
        },
      });
    } else if (tags['highway']) {
      // Road width estimation
      const hwClass = tags['highway'];
      const widthMap: Record<string, number> = {
        motorway: 30,
        trunk: 25,
        primary: 18,
        secondary: 14,
        tertiary: 10,
        residential: 7,
        unclassified: 6,
        service: 5,
        living_street: 5,
        pedestrian: 4,
      };
      const width = tags['width']
        ? parseFloat(tags['width']) || widthMap[hwClass] || 7
        : widthMap[hwClass] || 7;

      for (const p of el.geometry) {
        roads.push({ lat: p.lat, lng: p.lon, width });
      }
    }
  }

  cellCache.set(key, {
    buildings,
    roads,
    timestamp: Date.now(),
  });

  return { buildings, roads };
}

// ── Backward compat: fetchBuildings ───────────────────────
export async function fetchBuildings(
  lat: number,
  lng: number,
  radius = 300,
): Promise<BuildingFeature[]> {
  const { buildings } = await fetchAreaData(lat, lng, radius);
  return buildings;
}
