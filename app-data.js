// ========== DATA MANAGEMENT ==========

let wellRecords = [];
let villages = [];
let talukas = [];
let crops = [];

// Load databases from Excel file
function loadDatabases(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Load villages sheet
      if (workbook.SheetNames.includes('villages')) {
        villages = XLSX.utils.sheet_to_json(workbook.Sheets['villages']);
      }
      
      // Load talukas sheet
      if (workbook.SheetNames.includes('talukas')) {
        talukas = XLSX.utils.sheet_to_json(workbook.Sheets['talukas']);
      }
      
      // Load crops sheet
      if (workbook.SheetNames.includes('crops')) {
        crops = XLSX.utils.sheet_to_json(workbook.Sheets['crops']);
      }
      
      populateFilters();
      showToast('Database loaded successfully!');
      console.log('Databases loaded:', { villages, talukas, crops });
    } catch (err) {
      console.error('Error loading database:', err);
      showToast('Error loading database');
    }
  };
  reader.readAsArrayBuffer(file);
}

// Populate filter dropdowns
function populateFilters() {
  const talukaSelect = document.getElementById('filterTaluka');
  if (talukas.length > 0 && talukaSelect) {
    talukas.forEach(taluka => {
      const option = document.createElement('option');
      option.value = taluka.name || taluka.Taluka || '';
      option.textContent = taluka.name || taluka.Taluka || '';
      talukaSelect.appendChild(option);
    });
  }
}

// Save a new well record
function saveRecord(recordData) {
  const timestamp = new Date().toISOString();
  const record = {
    id: Date.now(),
    timestamp: timestamp,
    ...recordData
  };
  
  wellRecords.push(record);
  localStorage.setItem('wellRecords', JSON.stringify(wellRecords));
  updateRecordCount();
  showToast('Record saved successfully!');
  console.log('Record saved:', record);
  return record;
}

// Load all records from localStorage
function loadRecords() {
  const saved = localStorage.getItem('wellRecords');
  wellRecords = saved ? JSON.parse(saved) : [];
  return wellRecords;
}

// Update record count badge
function updateRecordCount() {
  loadRecords();
  const badge = document.getElementById('recordCountBadge');
  if (badge) badge.textContent = wellRecords.length;
}

// Export records to Excel
function exportToExcel() {
  if (wellRecords.length === 0) {
    showToast('No records to export');
    return;
  }
  
  const worksheet = XLSX.utils.json_to_sheet(wellRecords);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Well Records');
  XLSX.writeFile(workbook, 'well-survey-records.xlsx');
  showToast('Records exported to Excel');
}

// Sync records to Google Drive (placeholder)
function syncAllToCloud() {
  const cloudSetup = JSON.parse(localStorage.getItem('cloudSetup') || '{}');
  if (!cloudSetup.url) {
    showToast('Please configure cloud sync URL first');
    return;
  }
  
  showToast('Syncing to cloud...');
  console.log('Sync initiated with:', cloudSetup);
  // Integration with Google Apps Script would go here
}
