// GeoJSON coordinate transformations, geometry validation, deduplication, and marker icons

/**
 * Sensible Indian maritime fallback center (Central Peninsular EEZ)
 * Covers coastal Arabian Sea, Lakshadweep, and Bay of Bengal approaches.
 */
export const INDIAN_MARITIME_DEFAULT_CENTER = [14.8, 76.0];
export const INDIAN_MARITIME_DEFAULT_ZOOM = 6;

/**
 * Convert backend map_bounds [min_lon, min_lat, max_lon, max_lat]
 * to Leaflet bounds format [[min_lat, min_lon], [max_lat, max_lon]]
 */
export function convertBoundsToLeaflet(mapBounds) {
  if (!mapBounds || !Array.isArray(mapBounds) || mapBounds.length !== 4) {
    return null;
  }
  const [minLon, minLat, maxLon, maxLat] = mapBounds;
  if (isNaN(minLon) || isNaN(minLat) || isNaN(maxLon) || isNaN(maxLat)) {
    return null;
  }
  // Sanity check: lat in [-90, 90], lon in [-180, 180], min <= max
  if (minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180 || minLat > maxLat || minLon > maxLon) {
    return null;
  }
  return [
    [minLat, minLon],
    [maxLat, maxLon]
  ];
}


/**
 * Validate that a GeoJSON feature has valid geometry
 */
export function isValidFeature(feature) {
  if (!feature || typeof feature !== 'object') return false;
  const geom = feature.geometry;
  if (!geom || typeof geom !== 'object') return false;

  const validTypes = ['Point', 'LineString', 'Polygon', 'MultiPolygon', 'MultiPoint', 'MultiLineString'];
  if (!validTypes.includes(geom.type)) return false;

  const coords = geom.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) return false;

  return true;
}

/**
 * Validate and filter an entire FeatureCollection
 */
export function sanitizeFeatureCollection(fc) {
  if (!fc || typeof fc !== 'object') return null;
  if (fc.type !== 'FeatureCollection') return null;
  if (!Array.isArray(fc.features)) return null;

  return {
    ...fc,
    features: fc.features.filter(isValidFeature)
  };
}

/**
 * Helper: Calculate approximate polygon centroid and envelope for geometric comparison
 */
function getPolygonEnvelope(coords) {
  if (!Array.isArray(coords) || coords.length === 0) return null;
  const ring = Array.isArray(coords[0]) && Array.isArray(coords[0][0]) ? coords[0] : coords;
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  let sumLon = 0, sumLat = 0, count = 0;

  for (const pt of ring) {
    if (Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1])) {
      const lon = pt[0];
      const lat = pt[1];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      sumLon += lon;
      sumLat += lat;
      count++;
    }
  }

  if (count === 0) return null;
  return {
    centroid: [+(sumLon / count).toFixed(3), +(sumLat / count).toFixed(3)],
    envelope: [+(minLon).toFixed(2), +(minLat).toFixed(2), +(maxLon).toFixed(2), +(maxLat).toFixed(2)],
    pointCount: count
  };
}

/**
 * Generate a multi-tier deduplication fingerprint for a restricted zone feature.
 * Priority:
 * 1. Stable ID if available
 * 2. Normalized stable identifier/name combined with zone_type + state
 * 3. Geometry centroid & point count comparison
 *
 * Prevents false-merges of distinct zones while guaranteeing that duplicate
 * catalog and query polygons are rendered strictly once.
 */
export function getZoneFingerprint(feature) {
  if (!feature) return null;
  const props = feature.properties || {};
  const id = String(feature.id || props.id || '').trim();
  const title = String(props.title || props.name || '').toLowerCase().trim();
  const zoneType = String(props.zone_type || props.type || '').toLowerCase().trim();
  const state = String(props.state || '').toLowerCase().trim();

  // Extract geometry characteristics
  const env = getPolygonEnvelope(feature.geometry?.coordinates);
  const geomSig = env ? `${env.centroid.join(',')}_${env.envelope.join(',')}` : 'no_geom';

  // 1. If feature has standard restricted prefix or catalog ID, normalize it
  // e.g. "restricted-Karwar Nav" and "catalog-zone-0" referring to Karwar
  const cleanTitle = title.replace(/^restricted[-_:\s]*/i, '').replace(/[^a-z0-9]/g, '');

  return {
    id,
    cleanTitle,
    zoneType,
    state,
    geomSig,
    // Combined hash key
    compositeKey: `${cleanTitle}|${zoneType}|${geomSig}`
  };
}

/**
 * Deduplicate a list of restricted zone features combining query GeoJSON and catalog zones.
 *
 * @param {Array<Object>} queryFeatures - Features from response.visualization.geojson
 * @param {Array<Object>} catalogFeatures - Features generated from GET /zones
 * @returns {Array<Object>} Strictly deduplicated feature list
 */
export function deduplicateRestrictedZones(queryFeatures = [], catalogFeatures = []) {
  const existingKeys = new Set();
  const existingGeomSigs = new Set();
  const result = [];

  // Pass 1: Add all valid query restricted features first (they take precedence for specific query context)
  for (const feature of queryFeatures) {
    if (!isValidFeature(feature)) continue;
    const isRestricted =
      feature.properties?.category === 'restricted_zone' ||
      String(feature.id || feature.properties?.id || '').startsWith('restricted-');

    if (isRestricted) {
      const fp = getZoneFingerprint(feature);
      if (fp) {
        existingKeys.add(fp.compositeKey);
        if (fp.cleanTitle) existingKeys.add(fp.cleanTitle);
        if (fp.geomSig !== 'no_geom') existingGeomSigs.add(fp.geomSig);
      }
    }
  }

  // Pass 2: Filter catalog features that are already present in query visualization
  for (const feature of catalogFeatures) {
    if (!isValidFeature(feature)) continue;
    const fp = getZoneFingerprint(feature);
    if (!fp) continue;

    // Check Priority 1 & 2: Composite key or exact clean title match
    const titleMatch = fp.cleanTitle && existingKeys.has(fp.cleanTitle);
    const compositeMatch = existingKeys.has(fp.compositeKey);

    // Check Priority 3: Geometry signature match (same physical polygon)
    const geomMatch = fp.geomSig !== 'no_geom' && existingGeomSigs.has(fp.geomSig);

    if (!titleMatch && !compositeMatch && !geomMatch) {
      result.push(feature);
      // Mark as seen so duplicates inside catalog itself are also filtered
      existingKeys.add(fp.compositeKey);
      if (fp.cleanTitle) existingKeys.add(fp.cleanTitle);
      if (fp.geomSig !== 'no_geom') existingGeomSigs.add(fp.geomSig);
    }
  }

  return result;
}

/**
 * Convert GET /zones catalog array into a RFC 7946 FeatureCollection
 */
export function convertZonesCatalogToGeoJSON(zonesArray) {
  if (!Array.isArray(zonesArray)) return null;

  return {
    type: 'FeatureCollection',
    features: zonesArray
      .map((zone, idx) => {
        const coords = zone.coordinates || [];
        if (!Array.isArray(coords) || coords.length < 3) return null;
        return {
          type: 'Feature',
          id: `catalog-zone-${idx}`,
          geometry: {
            type: 'Polygon',
            coordinates: [coords]
          },
          properties: {
            id: `catalog-zone-${idx}`,
            title: zone.name || 'Restricted Marine Zone',
            name: zone.name || 'Restricted Marine Zone',
            category: 'restricted_zone',
            zone_type: zone.type || 'Restricted Area',
            state: zone.state || 'National Maritime Boundary',
            buffer_km: zone.buffer_km || 2.0,
            isCatalogZone: true,
            fill: '#dc2626',
            'fill-opacity': 0.22,
            stroke: '#b91c1c',
            'stroke-width': 2
          }
        };
      })
      .filter(Boolean)
  };
}

/**
 * SVG Vessel Marker Icon HTML string for L.divIcon
 */
export function getVesselMarkerSvg() {
  return `
    <div style="
      background: #2563eb;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2.5px solid #ffffff;
      box-shadow: 0 0 14px rgba(37, 99, 235, 0.7);
      cursor: pointer;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
        <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.23"/>
        <path d="M12 10V4"/>
        <path d="M12 2l5 4-5 2"/>
      </svg>
    </div>
  `;
}

/**
 * SVG PFZ Marker Icon HTML string for L.divIcon
 * Distinguishes Rank 1 (emerald star) from Ranks 2-4 (teal circle with rank badge)
 */
export function getPfzMarkerSvg(rank = 1) {
  if (rank === 1) {
    return `
    <div style="
      background: #059669;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2.5px solid #ffffff;
      box-shadow: 0 0 14px rgba(5, 150, 105, 0.75);
      cursor: pointer;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </div>
  `;
  }
  return `
    <div style="
      background: #0284c7;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #ffffff;
      box-shadow: 0 0 10px rgba(2, 132, 199, 0.75);
      cursor: pointer;
      color: #ffffff;
      font-family: monospace;
      font-size: 13px;
      font-weight: 800;
    ">
      ${rank}
    </div>
  `;
}

/**
 * SVG User GPS Location Beacon Icon HTML string for L.divIcon
 * Visually subtle radar/pulse ring, distinct from vessel origin (#2563eb) and PFZ (#059669).
 */
export function getUserGpsMarkerSvg() {
  return `
    <div style="
      position: relative;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    ">
      <!-- Radar Wave Pulse -->
      <div style="
        position: absolute;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(6, 182, 212, 0.25);
        border: 1.5px solid #06b6d4;
        animation: pulse-subtle 2s infinite ease-out;
      "></div>
      <!-- Center Core Pin -->
      <div style="
        position: relative;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #06b6d4;
        border: 2.5px solid #ffffff;
        box-shadow: 0 0 10px rgba(6, 182, 212, 0.9);
      "></div>
    </div>
  `;
}

/**
 * Standalone SVG Data URL for Maritime Vessel / Port Origin Marker
 */
export function getVesselMarkerSvgDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <circle cx="18" cy="18" r="15" fill="#1B5E7A" stroke="#ffffff" stroke-width="2.5" filter="url(#shadow)"/>
    <g transform="translate(6, 6) scale(1)" stroke="#ffffff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
      <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.23"/>
      <path d="M12 10V4"/>
      <path d="M12 2l5 4-5 2"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
}

/**
 * Standalone SVG Data URL for PFZ Marker
 * Rank 1: Seafoam teal star
 * Ranks 2-4: Deep marine blue numbered circle
 */
export function getPfzMarkerSvgDataUrl(rank = 1) {
  let svg;
  if (rank === 1) {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
      <defs>
        <filter id="pfz1-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#1F7A6C" flood-opacity="0.5"/>
        </filter>
      </defs>
      <circle cx="19" cy="19" r="16" fill="#1F7A6C" stroke="#ffffff" stroke-width="2.5" filter="url(#pfz1-glow)"/>
      <polygon points="19 7 22.3 14 30 15 24.5 20.5 26 28 19 24.3 12 28 13.5 20.5 8 15 15.7 14 19 7" fill="#ffffff"/>
    </svg>`;
  } else {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
      <defs>
        <filter id="pfz-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <circle cx="17" cy="17" r="14" fill="#1B5E7A" stroke="#ffffff" stroke-width="2.5" filter="url(#pfz-shadow)"/>
      <text x="17" y="22.5" text-anchor="middle" fill="#ffffff" font-size="16" font-family="'JetBrains Mono', monospace, sans-serif" font-weight="800">${rank}</text>
    </svg>`;
  }
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
}

/**
 * Standalone SVG Data URL for User GPS Marker
 */
export function getUserGpsMarkerSvgDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="14" fill="rgba(31, 122, 108, 0.2)" stroke="#1F7A6C" stroke-width="2"/>
    <circle cx="18" cy="18" r="6" fill="#1F7A6C" stroke="#ffffff" stroke-width="2"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
}
