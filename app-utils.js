// ========== UTILITY FUNCTIONS ==========

// Show toast notification
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Open offline guide modal
function openOfflineGuide() {
  const modal = document.getElementById('offlineGuideModal');
  if (modal) modal.classList.add('active');
}

// Close offline guide modal
function closeOfflineGuide(event) {
  if (event && event.target.id !== 'offlineGuideModal') return;
  const modal = document.getElementById('offlineGuideModal');
  if (modal) modal.classList.remove('active');
}

// Photo modal functions
function openPhotoModal(photoUrl, info) {
  const modal = document.getElementById('photoModalBackdrop');
  if (!modal) return;
  
  document.getElementById('photoModalImg').src = photoUrl;
  document.getElementById('photoModalInfo').textContent = info || '';
  modal.classList.add('active');
}

function closePhotoModal(event) {
  if (event && event.target.id !== 'photoModalBackdrop') return;
  const modal = document.getElementById('photoModalBackdrop');
  if (modal) modal.classList.remove('active');
}

function downloadModalPhoto() {
  const img = document.getElementById('photoModalImg');
  if (!img || !img.src) return;
  
  const link = document.createElement('a');
  link.href = img.src;
  link.download = 'photo_' + Date.now() + '.jpg';
  link.click();
  showToast('Photo downloaded');
}

// Select root folder for backup (placeholder)
function selectRootFolderFallback() {
  if (typeof showDirectoryPicker === 'undefined') {
    showToast('Folder linking requires supporting browser (Chrome/Edge)');
    return;
  }
  
  showDirectoryPicker()
    .then(handle => {
      localStorage.setItem('backupFolderHandle', JSON.stringify(handle));
      showToast('Folder linked successfully!');
    })
    .catch(err => {
      console.log('Folder selection cancelled or failed:', err);
    });
}

// Format date helper
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Get query parameter
function getQueryParam(param) {
  const params = new URLSearchParams(window.location.search);
  return params.get(param);
}
