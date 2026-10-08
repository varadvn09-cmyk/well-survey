/**
 * ============================================================================
 * SPATIAL DIAGRAM & DYNAMIC STUDY AREA ENGINE (v4.2.0)
 * 1. Dynamic Study Area / 10K Toposheet Grid (Dynamically adapts to uploaded GeoPDF / Map)
 * 2. Real Survey Well Markers (Plots from active survey database & KML 2 spots)
 * 3. 1-Tap Google Maps Navigation & 100% Offline Radar / Compass Bearing
 * 4. Batch Coordinates Plotter & Canvas Overlay
 * ============================================================================
 */

(function(window) {
  'use strict';

  // State
  let diagramLayerGroup = null;
  let batchMarkersGroup = null;
  let isDiagramVisible = false;
  let radarWatchId = null;
  let radarPolyline = null;
  let radarHudElement = null;

  /**
   * Helper to get active Leaflet map instance
   */
  function getActiveMap() {
    if (window.geoPdfLeafletMap && typeof window.geoPdfLeafletMap.hasLayer === 'function') {
      return window.geoPdfLeafletMap;
    }
    if (window.mapPickerMap && typeof window.mapPickerMap.hasLayer === 'function') {
      return window.mapPickerMap;
    }
    return null;
  }

  /**
   * Dynamically calculate Study Area bounds from active GeoPDF or map view
   */
  function getStudyAreaBounds() {
    if (window.ACTIVE_GEOPDF && window.ACTIVE_GEOPDF.bounds) {
      const b = window.ACTIVE_GEOPDF.bounds;
      const latMin = Math.min(b[0][0], b[1][0]);
      const latMax = Math.max(b[0][0], b[1][0]);
      const lonMin = Math.min(b[0][1], b[1][1]);
      const lonMax = Math.max(b[0][1], b[1][1]);
      return {
        latMin, latMax, lonMin, lonMax,
        source: window.ACTIVE_GEOPDF.mapsheet ? `10K Sheet: ${window.ACTIVE_GEOPDF.mapsheet}` : 'Uploaded GeoPDF Map'
      };
    }
    const map = getActiveMap();
    if (map) {
      const mb = map.getBounds();
      return {
        latMin: mb.getSouth(),
        latMax: mb.getNorth(),
        lonMin: mb.getWest(),
        lonMax: mb.getEast(),
        source: 'Active Map Viewport'
      };
    }
    return { latMin: 17.5500, latMax: 17.6000, lonMin: 76.1000, lonMax: 76.1500, source: 'Default Extent' };
  }

  /**
   * Navigate to Point in Google Maps (1-Tap Native GPS Navigation)
   */
  function navigateToPointInGoogleMaps(lat, lon) {
    if (!lat || !lon) {
      if (typeof showToast === 'function') showToast("⚠️ Invalid destination coordinates.");
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
    window.open(url, '_blank');
  }
  window.navigateToPointInGoogleMaps = navigateToPointInGoogleMaps;

  /**
   * Calculate haversine distance in kilometers
   */
  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Calculate initial compass bearing in degrees
   */
  function calculateBearing(lat1, lon1, lat2, lon2) {
    const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  }

  /**
   * 100% Offline Radar / Compass Bearing Navigation (For Remote Fields)
   */
  function startOfflineRadarNavigation(targetLat, targetLon, targetLabel) {
    if (!navigator.geolocation) {
      if (typeof showToast === 'function') showToast("⚠️ GPS Geolocation hardware not available.");
      return;
    }
    const map = getActiveMap();
    if (!map) return;

    stopOfflineRadarNavigation();

    // Create radar HUD overlay if missing
    if (!radarHudElement) {
      radarHudElement = document.createElement('div');
      radarHudElement.id = 'geoDraftRadarHud';
      radarHudElement.style.cssText = 'position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:9999; background:rgba(15,23,42,0.92); backdrop-filter:blur(10px); color:#fff; padding:10px 18px; border-radius:30px; border:1.5px solid #0284c7; box-shadow:0 8px 24px rgba(0,0,0,0.5); font-family:sans-serif; display:flex; align-items:center; gap:12px; font-size:0.85rem; font-weight:800;';
      document.body.appendChild(radarHudElement);
    }
    radarHudElement.style.display = 'flex';

    radarPolyline = L.polyline([], {
      color: '#0284c7',
      dashArray: '8, 6',
      weight: 3.5,
      opacity: 0.95
    }).addTo(map);

    if (typeof showToast === 'function') {
      showToast(`📡 Offline Radar started to ${targetLabel || 'well target'}!`);
    }

    radarWatchId = navigator.geolocation.watchPosition(
      pos => {
        const myLat = pos.coords.latitude;
        const myLon = pos.coords.longitude;
        const distM = Math.round(haversineKm(myLat, myLon, targetLat, targetLon) * 1000);
        const brng = Math.round(calculateBearing(myLat, myLon, targetLat, targetLon));

        radarPolyline.setLatLngs([[myLat, myLon], [targetLat, targetLon]]);

        radarHudElement.innerHTML = `
          <span style="color:#38bdf8;">🎯 ${targetLabel || 'Target'}: <strong>${distM >= 1000 ? (distM/1000).toFixed(2) + ' km' : distM + ' m'}</strong></span>
          <span style="color:#a78bfa;">🧭 ${brng}°</span>
          <button type="button" onclick="stopOfflineRadarNavigation()" style="background:#ef4444; color:#fff; border:none; padding:4px 10px; border-radius:14px; font-weight:800; cursor:pointer; font-size:0.75rem;">Stop</button>
        `;
      },
      err => {
        if (typeof showToast === 'function') showToast("⚠️ Waiting for satellite GPS lock...");
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }
  window.startOfflineRadarNavigation = startOfflineRadarNavigation;

  function stopOfflineRadarNavigation() {
    if (radarWatchId !== null) {
      navigator.geolocation.clearWatch(radarWatchId);
      radarWatchId = null;
    }
    const map = getActiveMap();
    if (map && radarPolyline) {
      map.removeLayer(radarPolyline);
      radarPolyline = null;
    }
    if (radarHudElement) {
      radarHudElement.style.display = 'none';
    }
    if (typeof showToast === 'function') showToast("Radar navigation stopped.");
  }
  window.stopOfflineRadarNavigation = stopOfflineRadarNavigation;

  /**
   * Toggle Dynamic Study Area & 10K Quadrant Grid on Map
   */
  function toggleStudyAreaDiagram(show) {
    if (typeof show === 'undefined') {
      isDiagramVisible = !isDiagramVisible;
    } else {
      isDiagramVisible = !!show;
    }

    const chk = document.getElementById('chkToggleStudyAreaDiagram');
    if (chk) chk.checked = isDiagramVisible;

    const map = getActiveMap();
    if (!map) {
      if (isDiagramVisible && typeof showToast === 'function') {
        showToast("📐 Study Area enabled. Switch to GIS Map tab to view.");
      }
      return;
    }

    if (diagramLayerGroup) {
      map.removeLayer(diagramLayerGroup);
      diagramLayerGroup = null;
    }

    if (!isDiagramVisible) {
      if (typeof showToast === 'function') showToast("Study Area Grid hidden.");
      return;
    }

    if (typeof L === 'undefined') return;

    diagramLayerGroup = L.featureGroup();

    // 1. Compute dynamic bounding box from active GeoPDF or map
    const b = getStudyAreaBounds();
    const polygonCoords = [
      [b.latMin, b.lonMin],
      [b.latMin, b.lonMax],
      [b.latMax, b.lonMax],
      [b.latMax, b.lonMin],
      [b.latMin, b.lonMin]
    ];

    const polyLayer = L.polygon(polygonCoords, {
      color: '#0284c7',
      weight: 3,
      opacity: 0.9,
      fillColor: '#38bdf8',
      fillOpacity: 0.08
    }).bindPopup(`
      <div style="font-family: inherit; font-size: 0.85rem; line-height: 1.4;">
        <strong style="color: #0284c7; font-size: 0.95rem;">📐 Dynamic Study Area</strong><br/>
        <span>${b.source}</span><br/>
        <span style="font-size: 0.75rem; color: #64748b;">
          Lat: ${b.latMin.toFixed(4)}° to ${b.latMax.toFixed(4)}°<br/>
          Lon: ${b.lonMin.toFixed(4)}° to ${b.lonMax.toFixed(4)}°
        </span>
      </div>
    `);
    diagramLayerGroup.addLayer(polyLayer);

    // 2. Draw 5x5 Quadrant Grid Lines (A1 to E5)
    const latStep = (b.latMax - b.latMin) / 5;
    const lonStep = (b.lonMax - b.lonMin) / 5;
    const cols = ['A', 'B', 'C', 'D', 'E'];

    for (let c = 0; c < 5; c++) {
      for (let r = 0; r < 5; r++) {
        const qLatMin = b.latMax - (r + 1) * latStep;
        const qLatMax = b.latMax - r * latStep;
        const qLonMin = b.lonMin + c * lonStep;
        const qLonMax = b.lonMin + (c + 1) * lonStep;
        const quadCode = `${cols[c]}${r + 1}`;

        const quadRect = L.rectangle([[qLatMin, qLonMin], [qLatMax, qLonMax]], {
          color: '#0284c7',
          weight: 1,
          opacity: 0.5,
          fillOpacity: 0,
          dashArray: '4, 4'
        }).bindTooltip(`<b>Quad: ${quadCode}</b>`, { permanent: false, direction: 'center' });
        diagramLayerGroup.addLayer(quadRect);
      }
    }

    // 3. Plot Real Surveyed Wells from Local Records & KML 2 Spots (No Fake Points!)
    const realRecords = (typeof getStoredRecords === 'function') ? getStoredRecords() : [];
    let plottedRealCount = 0;

    realRecords.forEach(rec => {
      let lat = null, lon = null;
      if (rec.gpsCoords && rec.gpsCoords.includes(',')) {
        const p = rec.gpsCoords.split(',').map(s => parseFloat(s.trim()));
        if (!isNaN(p[0]) && !isNaN(p[1])) { lat = p[0]; lon = p[1]; }
      } else if (rec.latitude && rec.longitude) {
        lat = parseFloat(rec.latitude);
        lon = parseFloat(rec.longitude);
      }
      if (lat && lon && lat >= b.latMin - 0.05 && lat <= b.latMax + 0.05 && lon >= b.lonMin - 0.05 && lon <= b.lonMax + 0.05) {
        plottedRealCount++;
        const icon = L.divIcon({
          className: 'real-well-icon',
          html: `<div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color:#fff; width:26px; height:26px; border-radius:50%; border:2px solid #fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; box-shadow:0 3px 8px rgba(0,0,0,0.4);">W${rec.srNo || plottedRealCount}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        const wellMarker = L.marker([lat, lon], { icon }).bindPopup(`
          <div style="font-family: inherit; font-size: 0.85rem; line-height: 1.4; min-width: 200px;">
            <strong style="color: #0284c7;">💧 Well #${rec.srNo || ''} (Gat: ${rec.gatNo || '--'})</strong><br/>
            <span>Village: <strong>${rec.village || '--'}</strong></span><br/>
            <span>Category: <strong>${rec.surveyGateCategory || 'Irrigation'}</strong></span><br/>
            <span style="font-size: 0.75rem; color: #64748b;">${lat.toFixed(6)}, ${lon.toFixed(6)}</span>
            <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">
              <button type="button" onclick="navigateToPointInGoogleMaps(${lat}, ${lon})" style="background: #0284c7; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                🧭 Navigate (Google Maps)
              </button>
              <button type="button" onclick="startOfflineRadarNavigation(${lat}, ${lon}, 'Well #${rec.srNo || ''}')" style="background: #10b981; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                📡 Start Offline Radar
              </button>
            </div>
          </div>
        `);
        diagramLayerGroup.addLayer(wellMarker);
      }
    });

    diagramLayerGroup.addTo(map);

    try {
      map.fitBounds(polyLayer.getBounds().pad(0.08));
    } catch(e) {}

    if (typeof showToast === 'function') {
      showToast(`📐 Dynamic Study Area active (${plottedRealCount} surveyed wells plotted).`);
    }
  }

  /**
   * Parse arbitrary text into list of { lat, lon, label }
   */
  function parseCoordinatesText(text) {
    if (!text || typeof text !== 'string') return [];
    const lines = text.split(/\r?\n/);
    const results = [];

    lines.forEach((rawLine, idx) => {
      const line = rawLine.trim();
      if (!line) return;

      const matches = line.match(/[-+]?[0-9]*\.?[0-9]+/g);
      if (matches && matches.length >= 2) {
        let lat = parseFloat(matches[0]);
        let lon = parseFloat(matches[1]);

        if (lat > 70 && lat < 85 && lon > 14 && lon < 25) {
          const tmp = lat;
          lat = lon;
          lon = tmp;
        }

        if (!isNaN(lat) && !isNaN(lon) && lat >= 8 && lat <= 38 && lon >= 68 && lon <= 98) {
          results.push({
            id: idx + 1,
            lat: lat,
            lon: lon,
            rawText: line
          });
        }
      }
    });
    return results;
  }

  /**
   * Plot multiple coordinates from textarea onto active map
   */
  function plotBatchCoordinates() {
    const txtArea = document.getElementById('batchCoordsInput');
    const text = txtArea ? txtArea.value : '';

    const coords = parseCoordinatesText(text);
    if (coords.length === 0) {
      if (typeof showToast === 'function') {
        showToast("⚠️ No valid coordinates found. Please paste lines like: 17.5929, 76.1052");
      }
      return;
    }

    const map = getActiveMap();
    if (!map) {
      if (typeof showToast === 'function') {
        showToast("Map is initializing... Please open the GIS Map tab first.");
      }
      return;
    }

    if (batchMarkersGroup) {
      map.removeLayer(batchMarkersGroup);
      batchMarkersGroup = null;
    }

    batchMarkersGroup = L.featureGroup();

    coords.forEach((pt, idx) => {
      const num = idx + 1;
      const icon = L.divIcon({
        className: 'batch-coord-marker',
        html: `<div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; width: 26px; height: 26px; border-radius: 50%; border: 2.5px solid #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; box-shadow: 0 3px 8px rgba(0,0,0,0.4);">${num}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const m = L.marker([pt.lat, pt.lon], { icon }).bindPopup(`
        <div style="font-family: inherit; font-size: 0.85rem; line-height: 1.4;">
          <strong style="color: #059669; font-size: 0.95rem;">📍 Location #${num}</strong><br/>
          <span>Lat: <strong>${pt.lat.toFixed(6)}</strong></span><br/>
          <span>Lon: <strong>${pt.lon.toFixed(6)}</strong></span><br/>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">${pt.rawText}</div>
          <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">
            <button type="button" onclick="copyBatchPointToFormGps(${pt.lat}, ${pt.lon})" style="background: #059669; color: #fff; border: none; padding: 5px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
              ✏️ Copy to Form GPS
            </button>
            <button type="button" onclick="navigateToPointInGoogleMaps(${pt.lat}, ${pt.lon})" style="background: #0284c7; color: #fff; border: none; padding: 5px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
              🧭 Navigate (Google Maps)
            </button>
          </div>
        </div>
      `);
      batchMarkersGroup.addLayer(m);
    });

    batchMarkersGroup.addTo(map);

    try {
      map.fitBounds(batchMarkersGroup.getBounds().pad(0.15));
    } catch(e) {}

    const badge = document.getElementById('batchCoordsBadge');
    if (badge) {
      badge.innerText = `⚡ ${coords.length} Plotted`;
      badge.style.display = 'inline-block';
    }

    if (typeof showToast === 'function') {
      showToast(`✅ Plotted ${coords.length} locations on the map!`);
    }
  }

  function clearBatchCoordinates() {
    const map = getActiveMap();
    if (map && batchMarkersGroup) {
      map.removeLayer(batchMarkersGroup);
    }
    batchMarkersGroup = null;

    const txtArea = document.getElementById('batchCoordsInput');
    if (txtArea) txtArea.value = '';

    const badge = document.getElementById('batchCoordsBadge');
    if (badge) badge.style.display = 'none';

    if (typeof showToast === 'function') {
      showToast("Cleared plotted coordinates.");
    }
  }

  function copyBatchPointToFormGps(lat, lon) {
    const gpsEl = document.getElementById('gpsCoords');
    if (gpsEl) {
      gpsEl.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      if (typeof onGpsCoordsManualChange === 'function') {
        onGpsCoordsManualChange();
      }
    }
    if (typeof switchTab === 'function') {
      switchTab('newEntry');
    }
    if (typeof showToast === 'function') {
      showToast(`✅ Loaded GPS (${lat.toFixed(4)}, ${lon.toFixed(4)}) into survey form.`);
    }
  }

  // Export globally
  window.SpatialDiagramEngine = {
    getStudyAreaBounds,
    toggleStudyAreaDiagram,
    plotBatchCoordinates,
    clearBatchCoordinates,
    copyBatchPointToFormGps,
    navigateToPointInGoogleMaps,
    startOfflineRadarNavigation,
    stopOfflineRadarNavigation
  };

  window.toggleStudyAreaDiagram = toggleStudyAreaDiagram;
  window.plotBatchCoordinates = plotBatchCoordinates;
  window.clearBatchCoordinates = clearBatchCoordinates;
  window.copyBatchPointToFormGps = copyBatchPointToFormGps;

})(window);
