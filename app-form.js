// ========== FORM HANDLING ==========

let currentFormData = {};

// Initialize new entry form
function initializeNewEntryForm() {
  const profile = JSON.parse(localStorage.getItem('geoProfile') || '{}');
  
  currentFormData = {
    geoName: profile.name || '',
    designation: profile.designation || '',
    date: new Date().toISOString().split('T')[0],
    village: '',
    taluka: '',
    wellType: '',
    latitude: '',
    longitude: '',
    depth: '',
    remarks: ''
  };
  
  console.log('Form initialized:', currentFormData);
}

// Handle form field changes
function updateFormField(fieldName, value) {
  currentFormData[fieldName] = value;
  console.log('Form updated:', fieldName, value);
}

// Validate and save form
function submitSurveyForm() {
  if (!currentFormData.village || !currentFormData.wellType) {
    showToast('Please fill required fields');
    return;
  }
  
  const record = saveRecord(currentFormData);
  
  // Reset form
  initializeNewEntryForm();
  
  // Switch to records tab
  switchTab('recordsList');
  displayRecords();
}

// Handle GPS location capture
function captureGPS() {
  if (!navigator.geolocation) {
    showToast('GPS not available');
    return;
  }
  
  showToast('Getting GPS location...');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude.toFixed(6);
      const lng = position.coords.longitude.toFixed(6);
      
      currentFormData.latitude = lat;
      currentFormData.longitude = lng;
      
      const latEl = document.getElementById('formLatitude');
      const lngEl = document.getElementById('formLongitude');
      
      if (latEl) latEl.value = lat;
      if (lngEl) lngEl.value = lng;
      
      showToast(`GPS: ${lat}, ${lng}`);
      console.log('GPS captured:', lat, lng);
    },
    (error) => {
      showToast('GPS error: ' + error.message);
      console.error('GPS error:', error);
    }
  );
}

// Handle photo upload
function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    currentFormData.photo = e.target.result; // Base64 encoded
    const preview = document.getElementById('photoPreview');
    if (preview) {
      preview.src = e.target.result;
      preview.style.display = 'block';
    }
    showToast('Photo uploaded');
  };
  reader.readAsDataURL(file);
}
