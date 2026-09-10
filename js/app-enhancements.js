// ========== ENHANCEMENT 1: SETTINGS COLUMN MANAGEMENT ==========
// Adds dynamic column visibility toggle in Settings tab for Master Data (MRSCA sheet)
class ColumnToggleManager {
  constructor() {
    this.visibleColumns = this.loadColumnSettings();
    this.availableColumns = [
      'topo_no',
      'crop',
      'mapsheet_no'
    ];
    this.columnLabels = {
      'topo_no': 'Topo No',
      'crop': 'Crop',
      'mapsheet_no': 'Mapsheet No'
    };
  }

  loadColumnSettings() {
    const saved = localStorage.getItem('mrsca_visible_columns');
    if (saved) return JSON.parse(saved);
    return {
      'topo_no': true,
      'crop': true,
      'mapsheet_no': true
    };
  }

  saveColumnSettings() {
    localStorage.setItem('mrsca_visible_columns', JSON.stringify(this.visibleColumns));
  }

  toggleColumn(columnId) {
    this.visibleColumns[columnId] = !this.visibleColumns[columnId];
    this.saveColumnSettings();
    this.renderColumnUI();
    this.applyColumnVisibility();
  }

  renderColumnUI() {
    const settingsPanel = document.querySelector('[data-settings-columns]');
    if (!settingsPanel) return;

    settingsPanel.innerHTML = `
      <div class="settings-column-panel">
        <div class="settings-section-title">Master Data Columns (MRSCA)</div>
        <div class="column-toggles">
          ${this.availableColumns.map(col => `
            <div class="column-toggle-item">
              <label class="toggle-switch">
                <input 
                  type="checkbox" 
                  ${this.visibleColumns[col] ? 'checked' : ''} 
                  onchange="columnManager.toggleColumn('${col}')"
                  class="toggle-input"
                >
                <span class="toggle-label">${this.columnLabels[col]}</span>
              </label>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  applyColumnVisibility() {
    // Apply to master data tables when displaying MRSCA sheet data
    const tables = document.querySelectorAll('[data-sheet="mrsca"] table');
    tables.forEach(table => {
      const headers = table.querySelectorAll('th');
      const rows = table.querySelectorAll('tr');
      
      headers.forEach((header, idx) => {
        const colName = header.getAttribute('data-column');
        if (colName && this.availableColumns.includes(colName)) {
          const shouldShow = this.visibleColumns[colName];
          header.style.display = shouldShow ? '' : 'none';
        }
      });

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, idx) => {
          const colName = cell.getAttribute('data-column');
          if (colName && this.availableColumns.includes(colName)) {
            const shouldShow = this.visibleColumns[colName];
            cell.style.display = shouldShow ? '' : 'none';
          }
        });
      });
    });
  }
}

window.columnManager = new ColumnToggleManager();

// ========== ENHANCEMENT 2: PWS PRINT PREVIEW WITH SCALING & COLUMN ADJUSTMENT ==========
class PWSPrintPreview {
  constructor() {
    this.scale = 100;
    this.columnWidth = 100;
  }

  initPrintPreview() {
    const previewModal = document.createElement('div');
    previewModal.id = 'pws-print-preview-modal';
    previewModal.className = 'print-preview-modal';
    previewModal.innerHTML = `
      <div class="print-preview-container">
        <div class="preview-controls">
          <div class="control-group">
            <label>Scale (%)</label>
            <div class="scale-slider">
              <input 
                type="range" 
                id="printScale" 
                min="50" 
                max="150" 
                value="100" 
                step="5"
                onchange="pwsPrinter.updateScale(this.value)"
                class="slider"
              >
              <span id="scaleValue" class="scale-display">100%</span>
            </div>
          </div>
          
          <div class="control-group">
            <label>Column Width (%)</label>
            <div class="width-slider">
              <input 
                type="range" 
                id="columnWidth" 
                min="70" 
                max="120" 
                value="100" 
                step="5"
                onchange="pwsPrinter.updateColumnWidth(this.value)"
                class="slider"
              >
              <span id="widthValue" class="width-display">100%</span>
            </div>
          </div>

          <div class="button-group">
            <button onclick="pwsPrinter.printPreview()" class="btn-print">Print</button>
            <button onclick="pwsPrinter.closePrintPreview()" class="btn-close">Cancel</button>
          </div>
        </div>

        <div class="preview-viewport" id="printViewport">
          <!-- PWS form will be rendered here -->
        </div>
      </div>
    `;

    document.body.appendChild(previewModal);
    this.modal = previewModal;
  }

  openPrintPreview(formHtml) {
    if (!this.modal) this.initPrintPreview();
    
    const viewport = this.modal.querySelector('#printViewport');
    viewport.innerHTML = formHtml;
    this.modal.classList.add('active');
    
    // Apply initial styles
    this.applyPreviewStyles();
  }

  updateScale(value) {
    this.scale = value;
    document.getElementById('scaleValue').textContent = value + '%';
    this.applyPreviewStyles();
  }

  updateColumnWidth(value) {
    this.columnWidth = value;
    document.getElementById('widthValue').textContent = value + '%';
    this.applyPreviewStyles();
  }

  applyPreviewStyles() {
    const viewport = document.getElementById('printViewport');
    if (!viewport) return;

    // Apply scale transform
    viewport.style.transform = `scale(${this.scale / 100})`;
    viewport.style.transformOrigin = 'top center';

    // Apply column width to all table cells
    const cells = viewport.querySelectorAll('td, th');
    cells.forEach(cell => {
      cell.style.width = (parseFloat(cell.style.width || '100') * this.columnWidth / 100) + '%';
      cell.style.fontSize = (this.scale / 100) + 'rem';
    });

    // Adjust page breaks to prevent content overflow
    const pages = viewport.querySelectorAll('.legal-page');
    pages.forEach(page => {
      page.style.width = (this.columnWidth / 100 * 850) + 'px';
      page.style.pageBreakAfter = 'always';
    });
  }

  printPreview() {
    window.print();
  }

  closePrintPreview() {
    if (this.modal) {
      this.modal.classList.remove('active');
    }
  }
}

window.pwsPrinter = new PWSPrintPreview();

// ========== ENHANCEMENT 3: PWS SURVEY CALCULATED FIELDS ==========
class PWSSurveyFields {
  constructor() {
    this.fields = {
      villageDistance: { label: 'Distance and Direction of Village from Water Supply Well', value: '', readonly: true },
      storageCapacity: { label: 'Storage Capacity of ESR/GSR (Cum)', value: '', readonly: true },
      populationWaterReq: { label: 'Population covered Water requirement in m³/day (@55 lpcd)', value: '', readonly: true, calculation: 'population * 55 / 1000' },
      cattleWaterReq: { label: 'Cattles covered Water requirement in m³/day (@30 lpcd)', value: '', readonly: true, calculation: 'cattle * 30 / 1000' }
    };
  }

  calculateWaterRequirement(populationCount, cattleCount) {
    const populationReq = (populationCount * 55) / 1000; // 55 LPCD per capita
    const cattleReq = (cattleCount * 30) / 1000; // 30 LPCD per cattle
    
    return {
      populationWaterReq: populationReq.toFixed(2),
      cattleWaterReq: cattleReq.toFixed(2),
      totalWaterReq: (populationReq + cattleReq).toFixed(2)
    };
  }

  injectFieldsIntoForm() {
    const pwsForm = document.querySelector('[data-form="pws-survey"]');
    if (!pwsForm) return;

    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'pws-calculated-fields';
    fieldsContainer.innerHTML = `
      <div class="form-section">
        <div class="section-header">
          <span class="section-title">Water Supply Calculations</span>
          <span class="section-code">CALC</span>
        </div>
        <div class="section-body">
          
          <div class="field-group full-width">
            <label>Distance and Direction of Village from Water Supply Well</label>
            <div class="input-wrapper">
              <input 
                type="text" 
                id="villageDistance" 
                placeholder="e.g., 2 km North"
                class="field-input"
              >
            </div>
          </div>

          <div class="field-group">
            <label>Storage Capacity of ESR/GSR</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                id="storageCapacity" 
                placeholder="0"
                readonly
                class="field-input field-readonly"
              >
              <span class="input-unit">Cum</span>
            </div>
          </div>

          <div class="field-group">
            <label>Population Served</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                id="populationServed" 
                placeholder="0"
                onchange="pwsFields.recalculateWaterRequirements()"
                class="field-input"
              >
            </div>
          </div>

          <div class="field-group">
            <label>Population Water Requirement</label>
            <div class="input-wrapper">
              <input 
                type="text" 
                id="populationWaterReq" 
                placeholder="0"
                readonly
                class="field-input field-readonly"
              >
              <span class="input-unit">m³/day</span>
            </div>
          </div>

          <div class="field-group">
            <label>Cattle Served</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                id="cattleServed" 
                placeholder="0"
                onchange="pwsFields.recalculateWaterRequirements()"
                class="field-input"
              >
            </div>
          </div>

          <div class="field-group">
            <label>Cattle Water Requirement</label>
            <div class="input-wrapper">
              <input 
                type="text" 
                id="cattleWaterReq" 
                placeholder="0"
                readonly
                class="field-input field-readonly"
              >
              <span class="input-unit">m³/day</span>
            </div>
          </div>

        </div>
      </div>
    `;

    pwsForm.appendChild(fieldsContainer);
  }

  recalculateWaterRequirements() {
    const populationInput = document.getElementById('populationServed');
    const cattleInput = document.getElementById('cattleServed');
    
    if (!populationInput || !cattleInput) return;

    const population = parseInt(populationInput.value) || 0;
    const cattle = parseInt(cattleInput.value) || 0;

    const requirements = this.calculateWaterRequirement(population, cattle);

    document.getElementById('populationWaterReq').value = requirements.populationWaterReq;
    document.getElementById('cattleWaterReq').value = requirements.cattleWaterReq;
  }

  loadFieldValues(recordData) {
    if (recordData.villageDistance) 
      document.getElementById('villageDistance').value = recordData.villageDistance;
    if (recordData.storageCapacity) 
      document.getElementById('storageCapacity').value = recordData.storageCapacity;
    if (recordData.populationServed) {
      document.getElementById('populationServed').value = recordData.populationServed;
      this.recalculateWaterRequirements();
    }
    if (recordData.cattleServed) {
      document.getElementById('cattleServed').value = recordData.cattleServed;
      this.recalculateWaterRequirements();
    }
  }

  getFieldValues() {
    return {
      villageDistance: document.getElementById('villageDistance').value,
      storageCapacity: document.getElementById('storageCapacity').value,
      populationServed: document.getElementById('populationServed').value,
      populationWaterReq: document.getElementById('populationWaterReq').value,
      cattleServed: document.getElementById('cattleServed').value,
      cattleWaterReq: document.getElementById('cattleWaterReq').value
    };
  }
}

window.pwsFields = new PWSSurveyFields();

// ========== ENHANCEMENT 4: QUADRANT NUMBER PERSISTENCE ==========
class QuadrantPersistence {
  constructor() {
    this.storageKey = 'quadrantData_';
  }

  saveQuadrantData(recordId, quadrantNo) {
    const key = this.storageKey + recordId;
    const data = {
      quadrantNo: quadrantNo,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`✓ Quadrant ${quadrantNo} saved for record ${recordId}`);
  }

  loadQuadrantData(recordId) {
    const key = this.storageKey + recordId;
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved).quadrantNo;
    }
    return null;
  }

  persistToDatabase(recordId, quadrantNo) {
    // Store in IndexedDB as backup
    const dbRequest = indexedDB.open('HydroGeoSurveyDB', 1);
    
    dbRequest.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['quadrants'], 'readwrite');
      const objectStore = transaction.objectStore('quadrants');
      
      const data = {
        recordId: recordId,
        quadrantNo: quadrantNo,
        timestamp: new Date().toISOString()
      };
      
      objectStore.put(data);
    };

    dbRequest.onerror = (event) => {
      console.error('Error saving to IndexedDB:', event);
    };
  }

  initializeDatabase() {
    const dbRequest = indexedDB.open('HydroGeoSurveyDB', 1);
    
    dbRequest.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('quadrants')) {
        const objectStore = db.createObjectStore('quadrants', { keyPath: 'recordId' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  }

  restoreQuadrantOnEdit(recordId) {
    const savedQuadrant = this.loadQuadrantData(recordId);
    if (savedQuadrant) {
      const quadrantInput = document.querySelector('[name="quadrantNo"]');
      if (quadrantInput) {
        quadrantInput.value = savedQuadrant;
        quadrantInput.disabled = false;
        console.log(`✓ Quadrant ${savedQuadrant} restored for record ${recordId}`);
      }
    }
  }

  watchQuadrantField() {
    const quadrantInput = document.querySelector('[name="quadrantNo"]');
    if (quadrantInput) {
      quadrantInput.addEventListener('blur', (e) => {
        const recordId = document.querySelector('[data-record-id]')?.getAttribute('data-record-id');
        if (recordId && e.target.value) {
          this.saveQuadrantData(recordId, e.target.value);
          this.persistToDatabase(recordId, e.target.value);
        }
      });
    }
  }
}

window.quadrantPersistence = new QuadrantPersistence();
window.quadrantPersistence.initializeDatabase();

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
  // Initialize all enhancements
  columnManager.renderColumnUI();
  pwsFields.injectFieldsIntoForm();
  quadrantPersistence.watchQuadrantField();
  
  console.log('✓ All enhancements initialized');
});
