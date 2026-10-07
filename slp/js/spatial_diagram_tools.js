/**
 * ============================================================================
 * SPATIAL DIAGRAM & BATCH COORDINATES ENGINE
 * 1. Built-in Study Area / Watershed Grid Diagram (Polygon + 3 Paths + 10 Points)
 * 2. Instant Toggle: Appear / Disappear on Map & GeoPDF Overlay
 * 3. Batch Coordinates Plotter: Paste multiple Lat/Longs (e.g. 10 lines) & plot
 * ============================================================================
 */

(function(window) {
  'use strict';

  // 1. Built-in Study Area / Toposheet Grid Data
  const STUDY_AREA_DATA = {
    title: "Study Area / Watershed Grid",
    polygon: [
      [17.549994, 76.100016],
      [17.550136, 76.149936],
      [17.599953, 76.149804],
      [17.599997, 76.100037],
      [17.549994, 76.100016]
    ],
    paths: [
      {
        name: "Lineament / Drainage Path 1",
        coords: [
          [17.550054, 76.100126],
          [17.599863, 76.149905]
        ],
        color: "#dc2626", // Red lineament
        dashArray: "6, 4"
      },
      {
        name: "Lineament / Drainage Path 2",
        coords: [
          [17.599934, 76.100046],
          [17.550156, 76.14992]
        ],
        color: "#7c3aed", // Purple path
        dashArray: "6, 4"
      },
      {
        name: "Lineament / Drainage Path 3",
        coords: [
          [17.599979, 76.123695],
          [17.575523, 76.149872],
          [17.549933, 76.125533],
          [17.576895, 76.10016],
          [17.599947, 76.123362]
        ],
        color: "#059669", // Emerald drainage loop
        dashArray: "5, 5"
      }
    ],
    points: [
      { name: "Station 1", lat: 17.592949, lon: 76.105265 },
      { name: "Station 2", lat: 17.593420, lon: 76.121594 },
      { name: "Station 3", lat: 17.579940, lon: 76.105929 },
      { name: "Station 4", lat: 17.567362, lon: 76.114001 },
      { name: "Station 5", lat: 17.553140, lon: 76.110575 },
      { name: "Station 6", lat: 17.561666, lon: 76.134234 },
      { name: "Station 7", lat: 17.557223, lon: 76.147873 },
      { name: "Station 8", lat: 17.570362, lon: 76.143407 },
      { name: "Station 9", lat: 17.581775, lon: 76.128190 },
      { name: "Station 10", lat: 17.593199, lon: 76.140927 }
    ]
  };

  // State
  let diagramLayerGroup = null;
  let batchMarkersGroup = null;
  let isDiagramVisible = false;

  /**
   * Helper to get active map instance
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
   * Toggle Study Area / Toposheet Grid Diagram on Map
   */
  function toggleStudyAreaDiagram(show) {
    if (typeof show === 'undefined') {
      isDiagramVisible = !isDiagramVisible;
    } else {
      isDiagramVisible = !!show;
    }

    // Sync toggle checkbox UI if exists
    const chk = document.getElementById('chkToggleStudyAreaDiagram');
    if (chk) chk.checked = isDiagramVisible;

    const map = getActiveMap();
    if (!map) {
      if (isDiagramVisible) {
        if (typeof showToast === 'function') {
          showToast("📐 Study Area diagram enabled. Switch to GIS Map tab to view.");
        }
      }
      return;
    }

    if (diagramLayerGroup) {
      map.removeLayer(diagramLayerGroup);
      diagramLayerGroup = null;
    }

    if (!isDiagramVisible) {
      if (typeof showToast === 'function') showToast("Study Area Diagram hidden.");
      return;
    }

    if (typeof L === 'undefined') return;

    diagramLayerGroup = L.featureGroup();

    // 1. Draw 1 Polygon Boundary
    const polyLayer = L.polygon(STUDY_AREA_DATA.polygon, {
      color: '#1d4ed8',
      weight: 3,
      opacity: 0.9,
      fillColor: '#3b82f6',
      fillOpacity: 0.12,
      dashArray: null
    }).bindPopup(`
      <div style="font-family: inherit; font-size: 0.85rem; line-height: 1.4;">
        <strong style="color: #1d4ed8; font-size: 0.95rem;">📐 Study Area Boundary</strong><br/>
        <span>Watershed / Toposheet Grid Quadrant</span><br/>
        <span style="font-size: 0.75rem; color: #64748b;">Lat: 17.5500° to 17.6000°<br/>Lon: 76.1000° to 76.1500°</span>
      </div>
    `);
    diagramLayerGroup.addLayer(polyLayer);

    // 2. Draw 3 Internal Paths / Lineaments
    STUDY_AREA_DATA.paths.forEach((p, idx) => {
      const lineLayer = L.polyline(p.coords, {
        color: p.color,
        weight: 3,
        opacity: 0.85,
        dashArray: p.dashArray
      }).bindPopup(`
        <div style="font-family: inherit; font-size: 0.85rem;">
          <strong style="color: ${p.color};">Path ${idx + 1}</strong><br/>
          <span>${p.name}</span>
        </div>
      `);
      diagramLayerGroup.addLayer(lineLayer);
    });

    // 3. Draw 10 Points as numbered badge markers
    STUDY_AREA_DATA.points.forEach((pt, idx) => {
      const num = idx + 1;
      const icon = L.divIcon({
        className: 'diagram-station-icon',
        html: `<div style="background: #1e293b; color: #fff; width: 24px; height: 24px; border-radius: 50%; border: 2px solid #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">${num}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const m = L.marker([pt.lat, pt.lon], { icon: icon }).bindPopup(`
        <div style="font-family: inherit; font-size: 0.85rem; line-height: 1.4;">
          <strong style="color: #0284c7;">📍 ${pt.name}</strong><br/>
          <span>Lat: <strong>${pt.lat.toFixed(5)}</strong></span><br/>
          <span>Lon: <strong>${pt.lon.toFixed(5)}</strong></span><br/>
          <button type="button" onclick="copyBatchPointToFormGps(${pt.lat}, ${pt.lon})" style="margin-top: 6px; background: #0284c7; color: #fff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer;">
            ✏️ Use in Survey Form
          </button>
        </div>
      `);
      diagramLayerGroup.addLayer(m);
    });

    diagramLayerGroup.addTo(map);

    // Zoom and pan to fit diagram
    try {
      map.fitBounds(diagramLayerGroup.getBounds().pad(0.1));
    } catch(e) {}

    if (typeof showToast === 'function') {
      showToast("📐 Study Area Diagram visible (1 Polygon, 3 Paths, 10 Stations).");
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

      // Extract all floating point numbers
      const matches = line.match(/[-+]?[0-9]*\.?[0-9]+/g);
      if (matches && matches.length >= 2) {
        let lat = parseFloat(matches[0]);
        let lon = parseFloat(matches[1]);

        // If coordinates were reversed (e.g. Lon Lat in Maharashtra Lon is ~73-78, Lat is ~15-22)
        if (lat > 70 && lat < 85 && lon > 14 && lon < 25) {
          const tmp = lat;
          lat = lon;
          lon = tmp;
        }

        // Validity check for Maharashtra / India
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
      } else {
        alert("Please paste valid coordinates (e.g. 17.5929, 76.1052)");
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

      const m = L.marker([pt.lat, pt.lon], { icon: icon }).bindPopup(`
        <div style="font-family: inherit; font-size: 0.85rem; line-height: 1.4;">
          <strong style="color: #059669; font-size: 0.95rem;">📍 Location #${num}</strong><br/>
          <span>Lat: <strong>${pt.lat.toFixed(6)}</strong></span><br/>
          <span>Lon: <strong>${pt.lon.toFixed(6)}</strong></span><br/>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">${pt.rawText}</div>
          <button type="button" onclick="copyBatchPointToFormGps(${pt.lat}, ${pt.lon})" style="margin-top: 8px; background: #059669; color: #fff; border: none; padding: 5px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
            ✏️ Copy to Form GPS
          </button>
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

  /**
   * Clear all plotted batch coordinates
   */
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

  /**
   * Pre-populate 10 sample coordinates from study area
   */
  function pasteSampleCoordinates() {
    const txtArea = document.getElementById('batchCoordsInput');
    if (!txtArea) return;

    const lines = STUDY_AREA_DATA.points.map(p => `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`);
    txtArea.value = lines.join('\n');
    plotBatchCoordinates();
  }

  /**
   * Copy specific plotted coordinate to Form GPS field and switch to form tab
   */
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

  /**
   * Overlay diagram schematic onto GeoPDF canvas or report
   */
  function drawDiagramOnPdfCanvas(canvas, bounds) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const minLat = 17.5499, maxLat = 17.6000;
    const minLon = 76.1000, maxLon = 76.1500;
    const w = canvas.width, h = canvas.height;

    function toX(lon) { return ((lon - minLon) / (maxLon - minLon)) * w; }
    function toY(lat) { return h - (((lat - minLat) / (maxLat - minLat)) * h); }

    ctx.save();

    // 1. Polygon
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
    ctx.beginPath();
    STUDY_AREA_DATA.polygon.forEach((pt, i) => {
      const x = toX(pt[1]), y = toY(pt[0]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Paths
    STUDY_AREA_DATA.paths.forEach(p => {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      p.coords.forEach((pt, i) => {
        const x = toX(pt[1]), y = toY(pt[0]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // 3. Points
    ctx.setLineDash([]);
    STUDY_AREA_DATA.points.forEach((pt, i) => {
      const x = toX(pt.lon), y = toY(pt.lat);
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x, y);
    });

    ctx.restore();
  }

  // Export globally
  window.SpatialDiagramEngine = {
    STUDY_AREA_DATA,
    toggleStudyAreaDiagram,
    plotBatchCoordinates,
    clearBatchCoordinates,
    pasteSampleCoordinates,
    copyBatchPointToFormGps,
    drawDiagramOnPdfCanvas
  };

  window.toggleStudyAreaDiagram = toggleStudyAreaDiagram;
  window.plotBatchCoordinates = plotBatchCoordinates;
  window.clearBatchCoordinates = clearBatchCoordinates;
  window.pasteSampleCoordinates = pasteSampleCoordinates;
  window.copyBatchPointToFormGps = copyBatchPointToFormGps;

})(window);
