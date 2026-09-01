// ========== CORE APPLICATION LOGIC ==========

// Initialize app on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('App initialized');
  loadFromLocalStorage();
  updateRecordCount();
});

// Tab switching function
function switchTab(tabName) {
  const tabs = document.querySelectorAll('.tab-panel');
  const buttons = document.querySelectorAll('.tab-btn');
  
  tabs.forEach(tab => tab.classList.remove('active'));
  buttons.forEach(btn => btn.classList.remove('active'));
  
  document.getElementById(tabName).classList.add('active');
  event.target.closest('.tab-btn').classList.add('active');
  
  console.log('Switched to:', tabName);
}

// Load data from localStorage
function loadFromLocalStorage() {
  const savedProfile = localStorage.getItem('geoProfile');
  if (savedProfile) {
    const profile = JSON.parse(savedProfile);
    document.getElementById('globalGeoName').value = profile.name || '';
    document.getElementById('globalDesig').value = profile.designation || '';
  }
  
  const savedCloudSetup = localStorage.getItem('cloudSetup');
  if (savedCloudSetup) {
    const setup = JSON.parse(savedCloudSetup);
    document.getElementById('cloudSyncUrl').value = setup.url || '';
    document.getElementById('cloudSheetId').value = setup.sheetId || '';
    document.getElementById('cloudFolderId').value = setup.folderId || '';
  }
}

// Update profile
function updateProfile() {
  const profile = {
    name: document.getElementById('globalGeoName').value,
    designation: document.getElementById('globalDesig').value
  };
  localStorage.setItem('geoProfile', JSON.stringify(profile));
}

// Save cloud setup
function saveCloudSetup() {
  const setup = {
    url: document.getElementById('cloudSyncUrl').value,
    sheetId: document.getElementById('cloudSheetId').value,
    folderId: document.getElementById('cloudFolderId').value
  };
  localStorage.setItem('cloudSetup', JSON.stringify(setup));
}

// Theme management
function setTheme(themeName) {
  document.body.setAttribute('data-theme', themeName);
  localStorage.setItem('theme', themeName);
  
  document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('theme-' + themeName).classList.add('active');
}

// Initialize theme on load
const savedTheme = localStorage.getItem('theme') || 'daylight';
setTheme(savedTheme);
