// ========== RECORDS DISPLAY & MANAGEMENT ==========

// Display all records
function displayRecords() {
  const container = document.getElementById('recordsContainer');
  if (!container) return;
  
  loadRecords();
  
  if (wellRecords.length === 0) {
    container.innerHTML = '<div class="empty-state">No records yet. Create your first survey entry.</div>';
    return;
  }
  
  container.innerHTML = wellRecords.map(record => `
    <div class="record-card">
      <div class="record-top">
        <div>
          <div class="record-title">${record.village || 'Unknown Village'}</div>
          <div class="record-meta">${record.date || ''} | ${record.wellType || ''}</div>
        </div>
        <div class="record-badge">${record.geoName || 'Unknown'}</div>
      </div>
      <div style="margin-top: 8px; font-size: 0.8rem; color: var(--text-muted);">
        Depth: ${record.depth || 'N/A'} | Lat: ${record.latitude || 'N/A'}
      </div>
      <div style="display: flex; gap: 8px; margin-top: 10px;">
        <button class="btn-sm" onclick="editRecord(${record.id})" style="flex:1;">✏️ Edit</button>
        <button class="btn-sm" onclick="deleteRecord(${record.id})" style="flex:1; background:var(--card-subtle);">🗑️ Delete</button>
      </div>
    </div>
  `).join('');
}

// Edit record (placeholder)
function editRecord(recordId) {
  const record = wellRecords.find(r => r.id === recordId);
  if (!record) return;
  
  currentFormData = { ...record };
  switchTab('newEntry');
  showToast('Edit mode activated');
}

// Delete record
function deleteRecord(recordId) {
  if (!confirm('Delete this record?')) return;
  
  wellRecords = wellRecords.filter(r => r.id !== recordId);
  localStorage.setItem('wellRecords', JSON.stringify(wellRecords));
  updateRecordCount();
  displayRecords();
  showToast('Record deleted');
}

// Apply filters to records
function applyFiltersDebounced() {
  clearTimeout(window.filterTimeout);
  window.filterTimeout = setTimeout(applyFilters, 300);
}

function applyFilters() {
  const searchTerm = (document.getElementById('searchBar')?.value || '').toLowerCase();
  const talukaFilter = document.getElementById('filterTaluka')?.value || '';
  const wellTypeFilter = document.getElementById('filterWellType')?.value || '';
  
  const filtered = wellRecords.filter(record => {
    const matchesSearch = (record.village || '').toLowerCase().includes(searchTerm) ||
                          (record.geoName || '').toLowerCase().includes(searchTerm);
    const matchesTaluka = !talukaFilter || record.taluka === talukaFilter;
    const matchesWellType = !wellTypeFilter || record.wellType === wellTypeFilter;
    
    return matchesSearch && matchesTaluka && matchesWellType;
  });
  
  const container = document.getElementById('recordsContainer');
  if (!container) return;
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No records match your filters.</div>';
    return;
  }
  
  container.innerHTML = filtered.map(record => `
    <div class="record-card">
      <div class="record-top">
        <div>
          <div class="record-title">${record.village || 'Unknown'}</div>
          <div class="record-meta">${record.date || ''} | ${record.wellType || ''}</div>
        </div>
        <div class="record-badge">${record.geoName || 'Unknown'}</div>
      </div>
    </div>
  `).join('');
}
