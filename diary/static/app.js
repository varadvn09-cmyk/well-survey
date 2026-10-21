/**
 * Official Daily Diary Web Application (GSDA Latur)
 * Officer: Shri Vinayak Navnath Nimbalkar
 * JavaScript Controller
 */

// Application State
let appState = {
  sheets: [],
  currentSheetName: '',
  monthData: null,
  activeFilter: 'all',
  constants: null,
  activeTab: 'tab-entries',
  profile: null,
  mobileViewMode: 'cards'
};

// DOM Elements
const monthSelect = document.getElementById('monthSelect');
const activeMonthTitle = document.getElementById('activeMonthTitle');
const activeSheetBadge = document.getElementById('activeSheetBadge');
const entriesTableBody = document.getElementById('entriesTableBody');
const mobileCardsContainer = document.getElementById('mobileCardsContainer');
const desktopTableContainer = document.getElementById('desktopTableContainer');
const calendarGrid = document.getElementById('calendarGrid');
const calMonthTitle = document.getElementById('calMonthTitle');
const fieldProgressTableBody = document.getElementById('fieldProgressTableBody');

// Helper to normalize travel modes to full official Marathi names
function formatTravelMode(val) {
  if (!val || val === '-') return '-';
  const s = String(val).trim();
  if (s.includes('शा') || s === 'शा वा' || s === 'शावा') return 'शासकीय वाहन';
  if (s.includes('खा') || s === 'खा वा' || s === 'खावा') return 'खाजगी वाहन';
  return s;
}

// Helper to display time cleanly (stacks date on next line to prevent column widening)
function formatTimeDisplay(val) {
  if (!val || val === '-') return '-';
  let s = String(val).trim();
  if (s.includes('<span')) return s;
  s = s.replace(/\r?\n/g, '<br>');
  s = s.replace(/(?:<br>|\s+)?(\([^\)]+\))/g, '<br><span style="font-size: 0.82em; opacity: 0.9; line-height: 1; display: inline-block;">$1</span>');
  return s;
}

// Helper to extract clean numeric value from English or Marathi numeral input
function parseDistanceNumber(val) {
  if (!val) return NaN;
  let s = String(val).trim();
  const marathiDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  marathiDigits.forEach((ch, idx) => {
    s = s.replaceAll(ch, String(idx));
  });
  const match = s.match(/[0-9]+(?:\.[0-9]+)?/);
  return match ? parseFloat(match[0]) : NaN;
}

// Statistics Elements
const statTotalDays = document.getElementById('statTotalDays');
const statOfficeDays = document.getElementById('statOfficeDays');
const statTourDays = document.getElementById('statTourDays');
const statMeetingDays = document.getElementById('statMeetingDays');
const statHolidayDays = document.getElementById('statHolidayDays');
const statTotalWells = document.getElementById('statTotalWells');
const statTotalBorewells = document.getElementById('statTotalBorewells');

// Modal Helper Functions
function showModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  el.classList.remove('hidden');
  el.style.display = 'flex';
}

function hideModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  el.classList.add('hidden');
  el.style.display = 'none';
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  checkDeviceActivation();
  initThemeAndZoom();
  initTabs();
  initModals();
  initFilters();
  initSearch();
  initMobileViewToggle();
  await loadProfile();
  await loadConstants();
  await loadSheets();
});

// Load Profile
async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.profile) {
        appState.profile = data.profile;
        try { localStorage.setItem('gsda_profile', JSON.stringify(data.profile)); } catch(e){}
        updateProfileDisplay(data.profile);
        populateTabProfileFields();
        return;
      }
    }
  } catch (err) {
    console.warn('Backend profile unavailable, checking offline storage:', err);
  }

  // Offline fallback
  try {
    const savedProf = localStorage.getItem('gsda_profile');
    if (savedProf) {
      appState.profile = JSON.parse(savedProf);
    } else if (window.GSDA_DEFAULT_DATA && window.GSDA_DEFAULT_DATA.profile) {
      appState.profile = JSON.parse(JSON.stringify(window.GSDA_DEFAULT_DATA.profile));
      try { localStorage.setItem('gsda_profile', JSON.stringify(appState.profile)); } catch(e){}
    }
  } catch (e) {
    console.error('Offline profile load error:', e);
  }
  if (appState.profile) {
    updateProfileDisplay(appState.profile);
    populateTabProfileFields();
  }
}

// Update Profile Display on page & Print
function updateProfileDisplay(prof) {
  if (!prof) return;
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setEl('printOfficerName', `नाव: ${prof.name}`);
  setEl('printOfficerDesig', `पदनाम: ${prof.designation}`);
  setEl('printOfficerBudget', `लेखाशीर्ष: ${prof.budget_head}`);
  setEl('printOfficerSalary', `वेतन: ${prof.salary}`);
  setEl('printSigOfficer', `(${prof.name})`);
  setEl('printSigDesig', prof.designation);
  const dept = prof.department || 'भूजल सर्वेक्षण आणि विकास यंत्रणा, सोलापूर';
  const hq = prof.headquarters || 'सोलापूर';
  setEl('printSigOffice', dept);
  setEl('printSubmissionOffice', `मा. वरिष्ठ भूवैज्ञानिक, ${dept} यांना माहितीस्तव व मंजूरीस्तव सविनय सादर.`);
  setEl('printBottomSig', `(${prof.name})`);
  setEl('printBottomDesigCity', `${prof.designation}, ${hq}`);
}

// Mobile View Toggle
function initMobileViewToggle() {
  const btnCards = document.getElementById('btnViewCards');
  const btnTable = document.getElementById('btnViewTable');
  if (!btnCards || !btnTable) return;

  btnCards.addEventListener('click', () => {
    appState.mobileViewMode = 'cards';
    btnCards.className = 'px-2 py-1 bg-blue-900 text-white font-semibold';
    btnTable.className = 'px-2 py-1 bg-white text-slate-600';
    mobileCardsContainer.classList.remove('hidden');
    desktopTableContainer.classList.add('hidden');
    desktopTableContainer.classList.remove('block');
  });

  btnTable.addEventListener('click', () => {
    appState.mobileViewMode = 'table';
    btnTable.className = 'px-2 py-1 bg-blue-900 text-white font-semibold';
    btnCards.className = 'px-2 py-1 bg-white text-slate-600';
    mobileCardsContainer.classList.add('hidden');
    desktopTableContainer.classList.remove('hidden');
    desktopTableContainer.classList.add('block');
  });
}

// Load App Constants
async function loadConstants() {
  try {
    const res = await fetch('/api/constants');
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        appState.constants = data;
        renderSuggestionChips(data.tasks);
        return;
      }
    }
  } catch (err) {
    console.warn('Backend constants not reachable, using offline constants:', err);
  }

  if (window.GSDA_DEFAULT_DATA && window.GSDA_DEFAULT_DATA.constants) {
    appState.constants = window.GSDA_DEFAULT_DATA.constants;
    renderSuggestionChips(appState.constants.tasks);
  }
}

// Render Suggestion Chips
function renderSuggestionChips(tasks) {
  const container = document.getElementById('suggestionChips');
  if (!container || !tasks) return;
  container.innerHTML = '';
  tasks.slice(0, 14).forEach(task => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suggestion-chip text-[10px] sm:text-[11px]';
    btn.textContent = task;
    btn.onclick = () => {
      document.getElementById('entryWorkDetail').value = task;
      if (task.includes('सुट्टी')) {
        document.getElementById('chkHoliday').checked = true;
        document.getElementById('chkTour').checked = false;
        document.getElementById('chkMeeting').checked = false;
      } else if (task.includes('दौरा') || task.includes('सर्वेक्षण') || task.includes('फिरती') || task.includes('पाहणी')) {
        document.getElementById('chkTour').checked = true;
        document.getElementById('chkHoliday').checked = false;
        document.getElementById('chkMeeting').checked = false;
      } else if (task.includes('बैठक') || task.includes('कार्यशाळा') || task.includes('प्रशिक्षण')) {
        document.getElementById('chkMeeting').checked = true;
        document.getElementById('chkHoliday').checked = false;
      } else if (task.includes('रजा')) {
        document.getElementById('chkLeave').checked = true;
        document.getElementById('chkHoliday').checked = false;
      }
    };
    container.appendChild(btn);
  });
}

// Load All Sheets
async function loadSheets() {
  let loadedSheets = null;
  try {
    const res = await fetch('/api/sheets');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.sheets && data.sheets.length > 0) {
        loadedSheets = data.sheets;
        try { localStorage.setItem('gsda_sheets', JSON.stringify(data.sheets)); } catch(e){}
      }
    }
  } catch (err) {
    console.warn('Backend sheets not reachable, checking offline sheets:', err);
  }

  if (!loadedSheets) {
    try {
      const savedSheets = localStorage.getItem('gsda_sheets');
      if (savedSheets) {
        loadedSheets = JSON.parse(savedSheets);
      }
    } catch(e){}
  }

  if (!loadedSheets && window.GSDA_DEFAULT_DATA && window.GSDA_DEFAULT_DATA.sheets) {
    loadedSheets = window.GSDA_DEFAULT_DATA.sheets;
  }

  if (loadedSheets && loadedSheets.length > 0) {
    appState.sheets = loadedSheets;
    populateMonthDropdown(loadedSheets);
    
    const nonDriverSheets = loadedSheets.filter(s => !s.is_driver);
    const savedSheet = localStorage.getItem('gsda_active_sheet');
    const defaultSheet = (savedSheet && nonDriverSheets.find(s => s.name === savedSheet)) || nonDriverSheets[0];
    if (defaultSheet) {
      monthSelect.value = defaultSheet.name;
      await loadMonthData(defaultSheet.name);
    }
  } else {
    showToast('पत्रके लोड करण्यास अडचण आली.', 'error');
  }
}

// Populate Month Select Dropdown
function populateMonthDropdown(sheets) {
  monthSelect.innerHTML = '';
  sheets.forEach(s => {
    if (s.is_driver) return;
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = `${s.title}`;
    opt.className = 'text-slate-900';
    monthSelect.appendChild(opt);
  });
  
  monthSelect.onchange = (e) => {
    loadMonthData(e.target.value);
  };
}

// Load Specific Month Data
async function loadMonthData(sheetName) {
  try {
    appState.currentSheetName = sheetName;
    try { localStorage.setItem('gsda_active_sheet', sheetName); } catch(e){}

    let monthDataLoaded = null;
    let fetchedFromBackend = false;

    // 1. Try to fetch from backend
    try {
      const res = await fetch(`/api/month/${encodeURIComponent(sheetName)}`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          monthDataLoaded = result.data;
          fetchedFromBackend = true;
        }
      }
    } catch (netErr) {
      console.warn(`Backend fetch for month ${sheetName} failed, using local/default storage:`, netErr);
    }

    // 2. If not loaded from backend, check localStorage draft
    if (!monthDataLoaded) {
      const draftStr = localStorage.getItem(`gsda_draft_${sheetName}`);
      if (draftStr) {
        try {
          monthDataLoaded = JSON.parse(draftStr);
        } catch(e) {}
      }
    }

    // 3. If still not loaded, check window.GSDA_DEFAULT_DATA.months
    if (!monthDataLoaded && window.GSDA_DEFAULT_DATA && window.GSDA_DEFAULT_DATA.months && window.GSDA_DEFAULT_DATA.months[sheetName]) {
      try {
        monthDataLoaded = JSON.parse(JSON.stringify(window.GSDA_DEFAULT_DATA.months[sheetName]));
      } catch(e) {}
    }

    if (monthDataLoaded) {
      appState.monthData = monthDataLoaded;

      // Recover and merge any return journey fields from localStorage draft if fetched from backend
      if (fetchedFromBackend) {
        const draftStr = localStorage.getItem(`gsda_draft_${sheetName}`);
        if (draftStr) {
          try {
            const draft = JSON.parse(draftStr);
            if (draft && draft.entries && appState.monthData && appState.monthData.entries) {
              let recovered = false;
              draft.entries.forEach((de, i) => {
                const be = appState.monthData.entries[i];
                if (be && (de.from_loc2 || de.to_loc2 || de.distance_km2 || (de.travel_mode2 && de.travel_mode2 !== '-'))) {
                  if (!be.from_loc2 && !be.to_loc2) {
                    be.travel_mode2 = de.travel_mode2 || be.travel_mode2;
                    be.from_loc2 = de.from_loc2;
                    be.from_time2 = de.from_time2;
                    be.to_loc2 = de.to_loc2;
                    be.to_time2 = de.to_time2;
                    be.distance_km2 = de.distance_km2;
                    be.travel_fare2 = de.travel_fare2;
                    recovered = true;
                  }
                }
              });
              if (recovered) {
                autoSaveMonthToBackend();
              }
            }
          } catch(e) {}
        }
      }

      recalculateMonthlySummary();
      renderActiveMonth();
    } else {
      showToast('या महिन्याचा डेटा सापडला नाही: ' + sheetName, 'error');
    }
  } catch (err) {
    showToast('डेटा लोड करताना त्रुटी आली: ' + err.message, 'error');
  }
}

// Render Active Month across all views
function renderActiveMonth() {
  if (!appState.monthData) return;
  
  const m = appState.monthData;
  activeMonthTitle.textContent = m.title;
  activeSheetBadge.textContent = m.sheet_name;
  calMonthTitle.textContent = m.title;
  document.getElementById('printMonthTitle').textContent = m.title;
  
  renderEntriesTable();
  renderMobileCards();
  renderCalendarView();
  renderFieldProgress();
  renderSummaryCards();
  renderPrintView();
}

// Recalculate Totals & Counters
function recalculateMonthlySummary() {
  if (!appState.monthData || !appState.monthData.entries) return;
  
  let total = 0, holiday = 0, leave = 0, tour = 0, meeting = 0, training = 0;
  let wells = 0, borewells = 0, km = 0.0;
  
  const schemeAgg = {};
  (appState.constants ? appState.constants.standard_schemes : []).forEach(s => {
    schemeAgg[s] = { villages: 0, cases: 0 };
  });

  appState.monthData.entries.forEach(e => {
    if (e.total == '1' || e.total == 1) total++;
    if (e.holiday == '1' || e.holiday == 1) holiday++;
    if (e.leave == '1' || e.leave == 1) leave++;
    if (e.tour == '1' || e.tour == 1) tour++;
    if (e.meeting == '1' || e.meeting == 1) meeting++;
    if (e.training == '1' || e.training == 1 || (e.work_detail && (e.work_detail.includes('प्रशिक्षण') || e.work_detail.includes('कार्यशाळा')))) {
      training++;
    }
    
    const wVal = parseInt(e.wells, 10);
    if (!isNaN(wVal) && wVal > 0) wells += wVal;

    const bwVal = parseInt(e.borewells, 10);
    if (!isNaN(bwVal) && bwVal > 0) borewells += bwVal;

    const dVal = parseFloat(e.distance_km);
    if (!isNaN(dVal)) km += dVal;
    const dVal2 = parseFloat(e.distance_km2);
    if (!isNaN(dVal2)) km += dVal2;

    // Aggregate scheme progress from daily entries
    if (e.scheme && schemeAgg[e.scheme]) {
      const isMap = e.scheme.includes('1:10') || e.scheme.toLowerCase().includes('mapsheet');
      const v = parseInt(e.villages, 10) || (isMap ? parseInt(e.cases, 10) : 0) || 0;
      const c = (isMap ? parseInt(e.wells, 10) : (parseInt(e.cases, 10) || parseInt(e.wells, 10))) || 0;
      schemeAgg[e.scheme].villages += v;
      schemeAgg[e.scheme].cases += c;
    }
  });
  
  const office = Math.max(0, total - (holiday + tour + leave));
  
  appState.monthData.summary = {
    total_days: total,
    office_days: office,
    tour_days: tour,
    holiday_days: holiday,
    meeting_days: meeting,
    leave_days: leave,
    training_days: training,
    total_wells: wells,
    total_borewells: borewells,
    total_travel_km: km
  };

  // Sync to field_progress if daily entries have progress
  if (appState.monthData.field_progress) {
    appState.monthData.field_progress.forEach(fp => {
      if (schemeAgg[fp.scheme] && (schemeAgg[fp.scheme].villages > 0 || schemeAgg[fp.scheme].cases > 0)) {
        fp.villages = schemeAgg[fp.scheme].villages;
        fp.cases = schemeAgg[fp.scheme].cases;
      }
    });
  }
}

// Render Summary Badges & Cards
function renderSummaryCards() {
  const sum = appState.monthData.summary;
  
  statTotalDays.textContent = sum.total_days;
  statOfficeDays.textContent = sum.office_days;
  statTourDays.textContent = sum.tour_days;
  statMeetingDays.textContent = sum.meeting_days;
  statHolidayDays.textContent = sum.holiday_days;
  statTotalWells.textContent = sum.total_wells;
  statTotalBorewells.textContent = sum.total_borewells;
  
  // Tab 3 Summary inputs
  document.getElementById('sumTotalDays').textContent = sum.total_days;
  document.getElementById('sumOfficeDays').textContent = sum.office_days;
  document.getElementById('sumTourDays').textContent = sum.tour_days;
  document.getElementById('sumHolidayDays').textContent = sum.holiday_days;
  document.getElementById('sumMeetingDays').textContent = sum.meeting_days;
  document.getElementById('sumTrainingDays').textContent = sum.training_days;
  document.getElementById('sumLeaveDays').textContent = sum.leave_days;
  document.getElementById('sumWells').textContent = sum.total_wells;
  document.getElementById('sumBorewells').textContent = sum.total_borewells;
  document.getElementById('sumTravelKm').textContent = sum.total_travel_km.toFixed(1) + ' कि.मी.';
  
  // Table Footer Totals
  document.getElementById('tfootTotalDays').textContent = sum.total_days;
  document.getElementById('tfootTotalHoliday').textContent = sum.holiday_days;
  document.getElementById('tfootTotalLeave').textContent = sum.leave_days;
  document.getElementById('tfootTotalTour').textContent = sum.tour_days;
  document.getElementById('tfootTotalMeeting').textContent = sum.meeting_days;
  document.getElementById('tfootTotalTraining').textContent = sum.training_days;
  document.getElementById('tfootTotalWells').textContent = sum.total_wells;
  document.getElementById('tfootTotalBorewells').textContent = sum.total_borewells;
  document.getElementById('tfootTotalKm').textContent = sum.total_travel_km.toFixed(0);
}

// Render Mobile Card View
function renderMobileCards() {
  if (!mobileCardsContainer) return;
  mobileCardsContainer.innerHTML = '';
  const entries = appState.monthData.entries || [];
  
  entries.forEach((e, idx) => {
    if (appState.activeFilter === 'tour' && !(e.tour == '1' || e.tour == 1)) return;
    if (appState.activeFilter === 'meeting' && !(e.meeting == '1' || e.meeting == 1)) return;
    if (appState.activeFilter === 'holiday' && !(e.holiday == '1' || e.holiday == 1)) return;
    if (appState.activeFilter === 'leave' && !(e.leave == '1' || e.leave == 1)) return;
    if (appState.activeFilter === 'wells' && !(parseInt(e.wells) > 0 || parseInt(e.borewells) > 0)) return;

    let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    let badgeText = 'कार्यालय';
    let borderClass = 'border-slate-200';

    if (e.holiday == '1' || e.holiday == 1) {
      badgeClass = 'bg-red-100 text-red-800 border-red-300';
      badgeText = 'सुट्टी';
      borderClass = 'border-red-200 bg-red-50/20';
    } else if (e.tour == '1' || e.tour == 1) {
      badgeClass = 'bg-green-100 text-green-900 border-green-400';
      badgeText = 'दौरा';
      borderClass = 'border-green-300 bg-green-50/30';
    } else if (e.meeting == '1' || e.meeting == 1) {
      badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
      badgeText = 'बैठक';
      borderClass = 'border-amber-200 bg-amber-50/20';
    } else if (e.leave == '1' || e.leave == 1) {
      badgeClass = 'bg-purple-100 text-purple-800 border-purple-300';
      badgeText = 'रजा';
      borderClass = 'border-purple-200 bg-purple-50/20';
    }

    const card = document.createElement('div');
    card.className = `p-2.5 rounded-xl border ${borderClass} bg-white shadow-sm flex flex-col justify-between transition active:scale-[0.99]`;

    const dateFormatted = formatDateDisplay(e.date, e.weekday_marathi);

    let extraPills = '';
    if (parseInt(e.wells) > 0) extraPills += `<span class="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-[10px] font-bold">विहिर: ${e.wells}</span>`;
    if (parseInt(e.borewells) > 0) extraPills += `<span class="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">विंधण: ${e.borewells}</span>`;

    let journeyHtml = '';
    if (e.to_loc && e.to_loc !== '-') {
      journeyHtml = `
        <div class="mt-1 flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded">
          <i class="fa-solid fa-route text-green-700"></i>
          <span>${e.from_loc || '-'} ➔ ${e.to_loc}</span>
          ${e.distance_km && e.distance_km !== '-' ? `<span class="font-mono text-indigo-700 font-bold ml-auto">${e.distance_km} km</span>` : ''}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="flex items-center justify-between pb-1 border-b border-slate-100">
        <div class="font-bold text-slate-800 text-xs">
          ${dateFormatted}
        </div>
        <div class="flex items-center gap-1">
          ${extraPills}
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeClass}">
            ${badgeText}
          </span>
          <button onclick="openEntryModal(${idx})" class="text-blue-600 p-1" title="संपादित करा">
            <i class="fa-solid fa-pen-to-square text-xs"></i>
          </button>
        </div>
      </div>
      <div class="py-1.5 text-xs text-slate-800 cursor-pointer" onclick="openEntryModal(${idx})">
        ${e.work_detail || '<span class="text-slate-300 italic">नोंद रिकामी आहे...</span>'}
      </div>
      ${journeyHtml}
    `;

    mobileCardsContainer.appendChild(card);
  });
}

// Render Desktop Table
function renderEntriesTable() {
  entriesTableBody.innerHTML = '';
  const entries = appState.monthData.entries || [];
  
  entries.forEach((e, idx) => {
    if (appState.activeFilter === 'tour' && !(e.tour == '1' || e.tour == 1)) return;
    if (appState.activeFilter === 'meeting' && !(e.meeting == '1' || e.meeting == 1)) return;
    if (appState.activeFilter === 'holiday' && !(e.holiday == '1' || e.holiday == 1)) return;
    if (appState.activeFilter === 'leave' && !(e.leave == '1' || e.leave == 1)) return;
    if (appState.activeFilter === 'wells' && !(parseInt(e.wells) > 0 || parseInt(e.borewells) > 0)) return;
    
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';
    
    if (e.holiday == '1' || e.holiday == 1) tr.classList.add('bg-red-50/40');
    else if (e.tour == '1' || e.tour == 1) tr.classList.add('bg-green-50/40');
    else if (e.meeting == '1' || e.meeting == 1) tr.classList.add('bg-amber-50/30');
    else if (e.leave == '1' || e.leave == 1) tr.classList.add('bg-emerald-50/30');

    const dateFormatted = formatDateDisplay(e.date, e.weekday_marathi);

    let fromDisp = isHeadquartersLocation(e.from_loc) ? getActiveHQ() : (e.from_loc || '-');
    let fromTimeDisp = formatTimeDisplay(e.from_time);
    let toDisp = e.to_loc || '-';
    let toTimeDisp = formatTimeDisplay(e.to_time);
    let modeDisp = formatTravelMode(e.travel_mode);
    let kmDisp = e.distance_km || '-';
    let fareDisp = e.travel_fare || '-';

    if (e.from_loc2 || e.to_loc2) {
      fromDisp = `<div class="rt-cell"><div class="rt-leg1 font-bold">${fromDisp}</div><div class="rt-leg2 font-bold">${e.from_loc2 || '-'}</div></div>`;
      fromTimeDisp = `<div class="rt-cell"><div class="rt-leg1 font-mono">${fromTimeDisp}</div><div class="rt-leg2 font-mono">${formatTimeDisplay(e.from_time2)}</div></div>`;
      toDisp = `<div class="rt-cell"><div class="rt-leg1 font-bold">${toDisp}</div><div class="rt-leg2 font-bold">${e.to_loc2 || '-'}</div></div>`;
      toTimeDisp = `<div class="rt-cell"><div class="rt-leg1 font-mono">${toTimeDisp}</div><div class="rt-leg2 font-mono">${formatTimeDisplay(e.to_time2)}</div></div>`;
      modeDisp = `<div class="rt-cell"><div class="rt-leg1 font-bold">${modeDisp}</div><div class="rt-leg2 font-bold">${formatTravelMode(e.travel_mode2)}</div></div>`;
      const k2 = (e.distance_km2 && e.distance_km2 !== '-') ? `+${e.distance_km2}` : '-';
      kmDisp = `<div class="rt-cell"><div class="rt-leg1 font-mono">${kmDisp}</div><div class="rt-leg2 font-mono">${k2}</div></div>`;
      const f2 = (e.travel_fare2 && e.travel_fare2 !== '-') ? `+₹${e.travel_fare2}` : '-';
      fareDisp = `<div class="rt-cell"><div class="rt-leg1 font-mono">${fareDisp}</div><div class="rt-leg2 font-mono">${f2}</div></div>`;

      tr.innerHTML = `
        <td class="p-1.5 text-center text-slate-400 font-mono border-r border-slate-100">${idx + 1}</td>
        <td class="p-1.5 font-medium text-slate-800 border-r border-slate-100 whitespace-nowrap">
          ${dateFormatted}
        </td>
        <td class="rt-td text-center border-r border-slate-100">${fromDisp}</td>
        <td class="rt-td text-center text-slate-500 border-r border-slate-100 font-mono">${fromTimeDisp}</td>
        <td class="rt-td text-center border-r border-slate-100 font-medium">${toDisp}</td>
        <td class="rt-td text-center text-slate-500 border-r border-slate-100 font-mono">${toTimeDisp}</td>
        <td class="rt-td text-center border-r border-slate-100 font-semibold text-slate-700 whitespace-nowrap">${modeDisp}</td>
        <td class="rt-td text-center border-r border-slate-100 font-mono text-indigo-700">${kmDisp}</td>
        <td class="rt-td text-center border-r border-slate-100 font-mono text-slate-500">${fareDisp}</td>
        <td class="p-1.5 text-slate-800 border-r border-slate-100 max-w-[220px] truncate cursor-pointer hover:text-blue-700" title="${e.work_detail || ''}" onclick="openEntryModal(${idx})">
          ${e.work_detail || '<span class="text-slate-300 italic">नोंद रिकामी आहे...</span>'}
        </td>
        
        <!-- Columns matching user colors -->
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-total ${e.total == '1' ? 'text-slate-800' : 'text-slate-300'}">${e.total || '-'}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-holiday ${e.holiday == '1' ? 'text-red-600' : 'text-slate-300'}">${e.holiday || '-'}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-leave ${e.leave == '1' ? 'text-emerald-800' : 'text-slate-300'}">${e.leave || '-'}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-tour ${e.tour == '1' ? 'text-green-900' : 'text-slate-300'}">${e.tour || '-'}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-meeting ${e.meeting == '1' ? 'text-amber-800' : 'text-slate-300'}">${e.meeting || '-'}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-training ${e.training == '1' ? 'text-blue-700' : 'text-slate-300'}">${e.training || '-'}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-well ${parseInt(e.wells) > 0 ? 'text-purple-800 font-mono' : 'text-slate-300'}">${e.wells || '-'}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-borewell ${parseInt(e.borewells) > 0 ? 'text-emerald-800 font-mono' : 'text-slate-300'}">${e.borewells || '-'}</td>
        
        <td class="p-1.5 text-center whitespace-nowrap">
          <button onclick="openEntryModal(${idx})" class="text-blue-600 hover:text-blue-800 p-1 mr-1" title="संपादित करा">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="deleteEntry(${idx})" class="text-red-500 hover:text-red-700 p-1" title="हटवा">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td class="p-1.5 text-center text-slate-400 font-mono border-r border-slate-100">${idx + 1}</td>
        <td class="p-1.5 font-medium text-slate-800 border-r border-slate-100 whitespace-nowrap">
          ${dateFormatted}
        </td>
        <td class="p-1.5 text-center border-r border-slate-100">${fromDisp}</td>
        <td class="p-1.5 text-center text-slate-500 border-r border-slate-100 font-mono">${fromTimeDisp}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-medium">${toDisp}</td>
        <td class="p-1.5 text-center text-slate-500 border-r border-slate-100 font-mono">${toTimeDisp}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-semibold text-slate-700 whitespace-nowrap">${modeDisp}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-mono text-indigo-700">${kmDisp}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-mono text-slate-500">${fareDisp}</td>
        <td class="p-1.5 text-slate-800 border-r border-slate-100 max-w-[220px] truncate cursor-pointer hover:text-blue-700" title="${e.work_detail || ''}" onclick="openEntryModal(${idx})">
          ${e.work_detail || '<span class="text-slate-300 italic">नोंद रिकामी आहे...</span>'}
        </td>
        
        <!-- Columns matching user colors -->
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-total ${e.total == '1' ? 'text-slate-800' : 'text-slate-300'}">${e.total || '-'}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-holiday ${e.holiday == '1' ? 'text-red-600' : 'text-slate-300'}">${e.holiday || '-'}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-leave ${e.leave == '1' ? 'text-emerald-800' : 'text-slate-300'}">${e.leave || '-'}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-tour ${e.tour == '1' ? 'text-green-900' : 'text-slate-300'}">${e.tour || '-'}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-meeting ${e.meeting == '1' ? 'text-amber-800' : 'text-slate-300'}">${e.meeting || '-'}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-training ${e.training == '1' ? 'text-blue-700' : 'text-slate-300'}">${e.training || '-'}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-well ${parseInt(e.wells) > 0 ? 'text-purple-800 font-mono' : 'text-slate-300'}">${e.wells || '-'}</td>
        <td class="p-1.5 text-center border-r border-slate-100 font-bold th-borewell ${parseInt(e.borewells) > 0 ? 'text-emerald-800 font-mono' : 'text-slate-300'}">${e.borewells || '-'}</td>
        
        <td class="p-1.5 text-center whitespace-nowrap">
          <button onclick="openEntryModal(${idx})" class="text-blue-600 hover:text-blue-800 p-1 mr-1" title="संपादित करा">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="deleteEntry(${idx})" class="text-red-500 hover:text-red-700 p-1" title="हटवा">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;
    }
    entriesTableBody.appendChild(tr);
  });
}

function formatDateDisplay(dStr, weekdayMarathi) {
  if (!dStr) return '-';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    const day = parts[2];
    const month = parts[1];
    return `${day}/${month} <span class="text-[10px] text-slate-500">(${weekdayMarathi || ''})</span>`;
  }
  return dStr;
}

// Render Calendar Grid View
function renderCalendarView() {
  calendarGrid.innerHTML = '';
  const entries = appState.monthData.entries || [];
  if (!entries.length) return;
  
  const firstEntry = entries[0];
  let firstDayIdx = 0;
  if (firstEntry && firstEntry.date) {
    try {
      const dt = new Date(firstEntry.date);
      firstDayIdx = dt.getDay();
    } catch (e) {}
  }

  for (let i = 0; i < firstDayIdx; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'cal-day-cell is-empty';
    calendarGrid.appendChild(emptyCell);
  }

  entries.forEach((e, idx) => {
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell';
    
    let badgeClass = 'bg-emerald-100 text-emerald-800';
    let badgeText = 'कार्यालय';

    if (e.holiday == '1' || e.holiday == 1) {
      cell.classList.add('is-holiday');
      badgeClass = 'bg-red-100 text-red-800';
      badgeText = 'सुट्टी';
    } else if (e.tour == '1' || e.tour == 1) {
      cell.classList.add('is-tour');
      badgeClass = 'bg-green-100 text-green-900 border-green-300';
      badgeText = 'दौरा';
    } else if (e.meeting == '1' || e.meeting == 1) {
      cell.classList.add('is-meeting');
      badgeClass = 'bg-amber-100 text-amber-800';
      badgeText = 'बैठक';
    } else if (e.leave == '1' || e.leave == 1) {
      cell.classList.add('is-leave');
      badgeClass = 'bg-purple-100 text-purple-800';
      badgeText = 'रजा';
    }

    const dayNum = e.date ? e.date.split('-')[2] : (idx + 1);

    let wellBadge = '';
    if (parseInt(e.wells) > 0 || parseInt(e.borewells) > 0) {
      wellBadge = `<span class="text-[9px] font-bold text-purple-700 bg-purple-50 px-1 rounded">वि:${e.wells||0} बो:${e.borewells||0}</span>`;
    }

    cell.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs sm:text-sm font-bold text-slate-800 font-mono">${dayNum}</span>
        <div class="flex items-center gap-0.5">
          ${wellBadge}
          <span class="text-[9px] sm:text-[10px] font-semibold px-1 py-0.2 rounded font-marathi ${badgeClass}">
            ${badgeText}
          </span>
        </div>
      </div>
      <div class="my-1 text-[10px] sm:text-[11px] font-marathi text-slate-700 line-clamp-2 leading-tight">
        ${e.work_detail || '-'}
      </div>
      <div class="flex justify-between items-center text-[9px] text-slate-500 font-mono">
        <span class="truncate">${e.to_loc && e.to_loc !== '-' ? e.to_loc : ''}</span>
        <span>${e.distance_km && e.distance_km !== '-' ? e.distance_km + 'k' : ''}</span>
      </div>
    `;

    cell.onclick = () => openEntryModal(idx);
    calendarGrid.appendChild(cell);
  });
}

// Render Field Progress Table
function renderFieldProgress() {
  if (!fieldProgressTableBody) return;
  fieldProgressTableBody.innerHTML = '';
  const list = appState.monthData.field_progress || [];
  
  list.forEach((fp, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-100 hover:bg-slate-50/50';
    const isMapsheet = fp.scheme && (fp.scheme.includes('1:10') || fp.scheme.includes('Mapsheet') || fp.scheme.includes('नकाशा'));

    if (isMapsheet) {
      tr.innerHTML = `
        <td class="p-1.5 text-slate-900 font-bold">
          <span>${fp.scheme}</span>
        </td>
        <td class="p-1.5 text-center">
          <input type="text" value="${fp.villages || '-'}" placeholder="Mapsheet" title="Mapsheet संख्या" class="w-24 p-1 text-center border-2 border-blue-400 bg-blue-50/60 rounded font-mono text-xs font-bold text-blue-950 focus:bg-white" onchange="updateProgressVillages(${idx}, this.value)">
        </td>
        <td class="p-1.5 text-center">
          <input type="text" value="${fp.cases || '-'}" placeholder="Wells" title="Wells संख्या" class="w-24 p-1 text-center border-2 border-blue-400 bg-blue-50/60 rounded font-mono text-xs font-bold text-blue-950 focus:bg-white" onchange="updateProgressCases(${idx}, this.value)">
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td class="p-1.5 text-slate-800 font-medium">${fp.scheme}</td>
        <td class="p-1.5 text-center">
          <input type="text" value="${fp.villages || '-'}" placeholder="गावे" class="w-16 p-1 text-center border border-slate-300 rounded font-mono text-xs" onchange="updateProgressVillages(${idx}, this.value)">
        </td>
        <td class="p-1.5 text-center">
          <input type="text" value="${fp.cases || '-'}" placeholder="प्रकरणे" class="w-16 p-1 text-center border border-slate-300 rounded font-mono text-xs" onchange="updateProgressCases(${idx}, this.value)">
        </td>
      `;
    }
    fieldProgressTableBody.appendChild(tr);
  });
}

function updateProgressVillages(idx, val) {
  if (appState.monthData.field_progress[idx]) {
    appState.monthData.field_progress[idx].villages = val;
  }
}

function updateProgressCases(idx, val) {
  if (appState.monthData.field_progress[idx]) {
    appState.monthData.field_progress[idx].cases = val;
  }
}

// Render Print Preview View (Rows 1 to 50 on 1-Page A4 Portrait)
function renderPrintView() {
  if (!appState.monthData) return;
  const entries = appState.monthData.entries || [];
  const prof = appState.profile || {};
  const officerName = prof.name || 'विनायक नवनाथ निंबाळकर';
  const officerDesig = prof.designation || 'सहाय्यक भूवैज्ञानिक';
  const officerDept = prof.department || 'भूजल सर्वेक्षण आणि विकास यंत्रणा, सोलापूर';
  const officerHq = prof.headquarters || 'सोलापूर';
  const officerBudget = prof.budget_head || '२७०२';
  const officerSalary = prof.salary || '६४०००/-';

  // Officer Meta in Header
  const nameEl = document.getElementById('printOfficerName');
  if (nameEl) nameEl.textContent = `नाव- ${officerName}`;
  const desigEl = document.getElementById('printOfficerDesig');
  if (desigEl) desigEl.textContent = `पदनाम- ${officerDesig}`;
  const budgetEl = document.getElementById('printOfficerBudget');
  if (budgetEl) budgetEl.textContent = `लेखाशीर्ष- ${officerBudget}`;
  const salaryEl = document.getElementById('printOfficerSalary');
  if (salaryEl) salaryEl.textContent = `वेतन:${officerSalary}`;

  // 1-Page vs 2-Page Print Format mode
  const printFormat = (prof.print_format) || '1page';
  const printSheetEl = document.getElementById('printDocument') || document.querySelector('.print-document');
  const sumContainer = document.getElementById('printBottomSummarySection');
  const p2Header = document.getElementById('printPage2Header');

  const p2Name = document.getElementById('printP2OfficerName');
  const p2Desig = document.getElementById('printP2OfficerDesig');
  const p2Dept = document.getElementById('printP2OfficerDept');
  if (p2Name) p2Name.textContent = `नाव: ${officerName}`;
  if (p2Desig) p2Desig.textContent = `पदनाम: ${officerDesig}`;
  if (p2Dept) p2Dept.textContent = officerDept;

  const btnQ1 = document.getElementById('btnQuickFormat1Page');
  const btnQ2 = document.getElementById('btnQuickFormat2Page');
  const fitBadge = document.getElementById('fitToPageBadge');
  const fitText = document.getElementById('fitToPageBadgeText');
  const sec1Page = document.getElementById('printSummary1PageSection');
  const sec2Page = document.getElementById('printSummary2PageSection');

  if (printFormat === '2page') {
    if (printSheetEl) { printSheetEl.classList.remove('mode-1page'); printSheetEl.classList.add('mode-2page'); }
    if (sumContainer) sumContainer.classList.add('page2-container');
    if (sec1Page) sec1Page.style.display = 'none';
    if (sec2Page) sec2Page.style.display = 'block';
    if (btnQ1) btnQ1.className = 'px-2.5 py-1 rounded-md font-medium text-slate-600 hover:text-slate-900 transition';
    if (btnQ2) btnQ2.className = 'px-2.5 py-1 rounded-md font-bold transition bg-white text-emerald-700 shadow-sm border border-emerald-300';
    if (fitBadge) {
      fitBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-300 rounded-lg text-xs font-bold font-marathi';
      if (fitText) fitText.textContent = '२ पाने सविस्तर (2-Page Varad: पान १ नोंदी + पान २ गोषवारा)';
    }
  } else {
    if (printSheetEl) { printSheetEl.classList.remove('mode-2page'); printSheetEl.classList.add('mode-1page'); }
    if (sumContainer) sumContainer.classList.remove('page2-container');
    if (sec1Page) sec1Page.style.display = 'block';
    if (sec2Page) sec2Page.style.display = 'none';
    if (btnQ1) btnQ1.className = 'px-2.5 py-1 rounded-md font-bold transition bg-white text-blue-700 shadow-sm border border-blue-300';
    if (btnQ2) btnQ2.className = 'px-2.5 py-1 rounded-md font-medium text-slate-600 hover:text-slate-900 transition';
    if (fitBadge) {
      fitBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold font-marathi';
      if (fitText) fitText.textContent = '१००% १ पान A4 अचूक फिट (Fit to 1 Page A4)';
    }
  }

  // Official A1:J50 Table Body (9 Columns matching Varad Excel Sheet 1)
  const tbodyA1J = document.getElementById('printTableA1JBody');
  if (tbodyA1J) {
    tbodyA1J.innerHTML = '';
    entries.forEach((e, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'text-center';
      
      let dateDisplay = '';
      if (e.date) {
        const d = e.date.split(' ')[0];
        const p = d.split('-');
        dateDisplay = p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
      }

      const formatLocationNames = (loc) => {
        if (!loc || loc === '-') return '-';
        return String(loc).replace(/,([^\s])/g, ', $1').replace(/\s+/g, ' ').trim();
      };

      let fromDisp = isHeadquartersLocation(e.from_loc) ? getActiveHQ() : (e.from_loc || '-');
      let fromTimeDisp = formatTimeDisplay(e.from_time);
      let toDisp = e.to_loc || '-';
      let toTimeDisp = formatTimeDisplay(e.to_time);
      let modeDisp = formatTravelMode(e.travel_mode);
      let distDisp = e.distance_km || '-';
      let fareDisp = e.travel_fare || '-';

      let cleanFrom = formatLocationNames(fromDisp);
      let cleanTo = formatLocationNames(toDisp);

      if (e.from_loc2 || e.to_loc2) {
        tr.className = 'text-center rt-tr';
        let cleanFrom2 = formatLocationNames(e.from_loc2);
        let cleanTo2 = formatLocationNames(e.to_loc2);

        fromDisp = `<div class="rt-cell"><div class="rt-leg1 break-words">${cleanFrom}</div><div class="rt-leg2 break-words">${cleanFrom2}</div></div>`;
        fromTimeDisp = `<div class="rt-cell"><div class="rt-leg1 font-mono">${fromTimeDisp}</div><div class="rt-leg2 font-mono">${formatTimeDisplay(e.from_time2)}</div></div>`;
        toDisp = `<div class="rt-cell"><div class="rt-leg1 break-words text-[9.5px] leading-tight">${cleanTo}</div><div class="rt-leg2 break-words text-[9.5px] leading-tight">${cleanTo2}</div></div>`;
        toTimeDisp = `<div class="rt-cell"><div class="rt-leg1 font-mono">${toTimeDisp}</div><div class="rt-leg2 font-mono">${formatTimeDisplay(e.to_time2)}</div></div>`;
        modeDisp = `<div class="rt-cell"><div class="rt-leg1">${modeDisp}</div><div class="rt-leg2">${formatTravelMode(e.travel_mode2)}</div></div>`;
        const k2 = (e.distance_km2 && e.distance_km2 !== '-') ? `+${e.distance_km2}` : '-';
        distDisp = `<div class="rt-cell"><div class="rt-leg1 font-mono">${distDisp}</div><div class="rt-leg2 font-mono">${k2}</div></div>`;
        const f2 = (e.travel_fare2 && e.travel_fare2 !== '-') ? `+${e.travel_fare2}` : '-';
        fareDisp = `<div class="rt-cell"><div class="rt-leg1 font-mono">${fareDisp}</div><div class="rt-leg2 font-mono">${f2}</div></div>`;

        tr.innerHTML = `
          <td class="border border-black p-0.5 whitespace-nowrap font-mono text-[9px] text-center">${dateDisplay}</td>
          <td class="rt-td border border-black text-center">${fromDisp}</td>
          <td class="rt-td border border-black text-center">${fromTimeDisp}</td>
          <td class="rt-td border border-black text-center">${toDisp}</td>
          <td class="rt-td border border-black text-center">${toTimeDisp}</td>
          <td class="rt-td border border-black text-center whitespace-nowrap">${modeDisp}</td>
          <td class="rt-td border border-black text-center">${distDisp}</td>
          <td class="rt-td border border-black text-center">${fareDisp}</td>
          <td class="border border-black p-0.5 text-left max-w-[50mm] break-words">${e.work_detail || ''}</td>
        `;
      } else {
        tr.innerHTML = `
          <td class="border border-black p-0.5 whitespace-nowrap font-mono text-[9px] text-center">${dateDisplay}</td>
          <td class="border border-black p-0.5 text-center break-words">${cleanFrom}</td>
          <td class="border border-black p-0.5 font-mono text-[9px] text-center">${fromTimeDisp}</td>
          <td class="border border-black p-0.5 text-center break-words text-[9.5px] leading-tight">${cleanTo}</td>
          <td class="border border-black p-0.5 font-mono text-[9px] text-center">${toTimeDisp}</td>
          <td class="border border-black p-0.5 text-center whitespace-nowrap">${modeDisp}</td>
          <td class="border border-black p-0.5 font-mono text-center">${distDisp}</td>
          <td class="border border-black p-0.5 font-mono text-center">${fareDisp}</td>
          <td class="border border-black p-0.5 text-left max-w-[50mm] break-words">${e.work_detail || ''}</td>
        `;
      }
      tbodyA1J.appendChild(tr);
    });
  }

  // Extended Table Body (All Columns)
  const tbodyAll = document.getElementById('printTableAllBody');
  if (tbodyAll) {
    tbodyAll.innerHTML = '';
    entries.forEach((e, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'text-center';
      
      let dateDisplay = '';
      if (e.date) {
        const d = e.date.split(' ')[0];
        const p = d.split('-');
        dateDisplay = p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
      }

      tr.innerHTML = `
        <td class="border border-black p-0.5 text-center font-mono">${idx + 1}</td>
        <td class="border border-black p-0.5 whitespace-nowrap font-mono text-[9px] text-center">${dateDisplay}</td>
        <td class="border border-black p-0.5 text-center">${isHeadquartersLocation(e.from_loc) ? getActiveHQ() : e.from_loc}</td>
        <td class="border border-black p-0.5 font-mono text-[9px] text-center">${formatTimeDisplay(e.from_time)}</td>
        <td class="border border-black p-0.5 text-center">${e.to_loc || '-'}</td>
        <td class="border border-black p-0.5 font-mono text-[9px] text-center">${formatTimeDisplay(e.to_time)}</td>
        <td class="border border-black p-0.5 text-center whitespace-nowrap">${formatTravelMode(e.travel_mode)}</td>
        <td class="border border-black p-0.5 font-mono text-center">${e.distance_km || '-'}</td>
        <td class="border border-black p-0.5 font-mono text-center">${e.travel_fare || '-'}</td>
        <td class="border border-black p-0.5 text-left">${e.work_detail || ''}</td>
        <td class="border border-black p-0.5 font-bold">${e.total || ''}</td>
        <td class="border border-black p-0.5 font-bold">${e.holiday || ''}</td>
        <td class="border border-black p-0.5 font-bold">${e.leave || ''}</td>
        <td class="border border-black p-0.5 font-bold">${e.tour || ''}</td>
        <td class="border border-black p-0.5 font-bold">${e.meeting || ''}</td>
        <td class="border border-black p-0.5 font-bold">${e.training || ''}</td>
        <td class="border border-black p-0.5 font-bold font-mono">${e.wells || ''}</td>
        <td class="border border-black p-0.5 font-bold font-mono">${e.borewells || ''}</td>
      `;
      tbodyAll.appendChild(tr);
    });
  }

  // Field progress list
  const progressList = appState.monthData.field_progress && appState.monthData.field_progress.length > 0
    ? appState.monthData.field_progress
    : (appState.constants ? appState.constants.standard_schemes.map(s => ({ scheme: s, villages: '-', cases: '-' })) : []);

  // 1-Page Field Progress Table (Rows 36-45 Left)
  const progBody = document.getElementById('printProgressBody');
  if (progBody) {
    progBody.innerHTML = '';
    progressList.forEach(p => {
      const ptr = document.createElement('tr');
      const isMapsheet = p.scheme && (p.scheme.includes('1:10') || p.scheme.includes('Mapsheet') || p.scheme.includes('नकाशा'));
      ptr.innerHTML = `
        <td class="border border-black p-0.5 text-left ${isMapsheet ? 'font-bold' : ''}">${p.scheme}</td>
        <td class="border border-black p-0.5 font-mono text-center font-semibold">${p.villages || '-'}</td>
        <td class="border border-black p-0.5 font-mono text-center font-semibold">${p.cases || '-'}</td>
      `;
      progBody.appendChild(ptr);
    });
  }

  // Monthly summary values
  const sum = appState.monthData.summary || {
    total_days: 31,
    office_days: 0,
    tour_days: 0,
    holiday_days: 0,
    training_days: 0,
    leave_days: 0
  };

  // 1-Page Monthly summary print (Rows 36-43 Right)
  const sumBody = document.getElementById('printSummaryBody');
  if (sumBody) {
    sumBody.innerHTML = `
      <tr><td class="border border-black p-0.5">महिन्याचे एकूण दिवस</td><td class="border border-black p-0.5 text-center font-bold font-mono w-12">${sum.total_days}</td></tr>
      <tr><td class="border border-black p-0.5">कार्यालयीन कामकाजाचे दिवस</td><td class="border border-black p-0.5 text-center font-bold font-mono w-12">${sum.office_days}</td></tr>
      <tr><td class="border border-black p-0.5">सर्वेक्षणास्तव फिरतीचे दिवस</td><td class="border border-black p-0.5 text-center font-bold font-mono w-12">${sum.tour_days}</td></tr>
      <tr><td class="border border-black p-0.5">शासकीय सुट्टीचे दिवस</td><td class="border border-black p-0.5 text-center font-bold font-mono w-12">${sum.holiday_days}</td></tr>
      <tr><td class="border border-black p-0.5">प्रशिक्षण / कार्यशाळा दिवस</td><td class="border border-black p-0.5 text-center font-bold font-mono w-12">${sum.training_days}</td></tr>
      <tr><td class="border border-black p-0.5">रजेचे दिवस</td><td class="border border-black p-0.5 text-center font-bold font-mono w-12">${sum.leave_days}</td></tr>
    `;
  }

  // ========================================================
  // 2-PAGE VARAD FORMAT: Sheet 2 Up and Down Tables
  // ========================================================
  const p2SumBody = document.getElementById('printP2SummaryBody');
  if (p2SumBody) {
    p2SumBody.innerHTML = `
      <tr class="h-6"><td class="border border-black p-1 text-center font-mono">1</td><td class="border border-black p-1 text-left pl-2.5 font-semibold">महिन्यातील एकुण दिवस</td><td class="border border-black p-1 text-center font-bold font-mono">${sum.total_days}</td><td class="border border-black p-1 text-center font-mono">-</td></tr>
      <tr class="h-6"><td class="border border-black p-1 text-center font-mono">2</td><td class="border border-black p-1 text-left pl-2.5 font-semibold">फिरतीचे दिवस</td><td class="border border-black p-1 text-center font-bold font-mono">${sum.tour_days}</td><td class="border border-black p-1 text-center font-mono">-</td></tr>
      <tr class="h-6"><td class="border border-black p-1 text-center font-mono">3</td><td class="border border-black p-1 text-left pl-2.5 font-semibold">कार्यालयीन कामाचे दिवस</td><td class="border border-black p-1 text-center font-bold font-mono">${sum.office_days}</td><td class="border border-black p-1 text-center font-mono">-</td></tr>
      <tr class="h-6"><td class="border border-black p-1 text-center font-mono">4</td><td class="border border-black p-1 text-left pl-2.5 font-semibold">मुक्कामाचे दिवस</td><td class="border border-black p-1 text-center font-bold font-mono">0</td><td class="border border-black p-1 text-center font-mono">-</td></tr>
      <tr class="h-6"><td class="border border-black p-1 text-center font-mono">5</td><td class="border border-black p-1 text-left pl-2.5 font-semibold">रजेचे दिवस</td><td class="border border-black p-1 text-center font-bold font-mono">${sum.leave_days}</td><td class="border border-black p-1 text-center font-mono">-</td></tr>
      <tr class="h-6"><td class="border border-black p-1 text-center font-mono">6</td><td class="border border-black p-1 text-left pl-2.5 font-semibold">सुट्टीचे दिवस</td><td class="border border-black p-1 text-center font-bold font-mono">${sum.holiday_days}</td><td class="border border-black p-1 text-center font-mono">-</td></tr>
      <tr class="h-6"><td class="border border-black p-1 text-center font-mono">7</td><td class="border border-black p-1 text-left pl-2.5 font-semibold">प्रशिक्षण/ कार्यशाळा दिवस</td><td class="border border-black p-1 text-center font-bold font-mono">${sum.training_days}</td><td class="border border-black p-1 text-center font-mono">-</td></tr>
    `;
  }

  const p2ProgBody = document.getElementById('printP2ProgressBody');
  if (p2ProgBody) {
    p2ProgBody.innerHTML = '';
    progressList.forEach((p, idx) => {
      const ptr = document.createElement('tr');
      ptr.className = 'h-6';
      const isMapsheet = p.scheme && (p.scheme.includes('1:10') || p.scheme.includes('Mapsheet') || p.scheme.includes('mapsheet') || p.scheme.includes('नकाशा'));
      ptr.innerHTML = `
        <td class="border border-black p-1 text-center font-mono">${idx + 1}</td>
        <td class="border border-black p-1 text-left ${isMapsheet ? 'font-bold' : ''}">
          ${p.scheme}
        </td>
        <td class="border border-black p-1 font-mono text-center font-semibold">${p.villages || '-'}</td>
        <td class="border border-black p-1 font-mono text-center font-semibold">${p.cases || '-'}</td>
        <td class="border border-black p-1 font-mono text-center">-</td>
        <td class="border border-black p-1 text-center">-</td>
      `;
      p2ProgBody.appendChild(ptr);
    });
  }

  // Sheet 2 Headers and Signatures
  if (p2Name) p2Name.textContent = `नाव : ${officerName}`;
  if (p2Desig) p2Desig.textContent = `पदनाम : ${officerDesig}`;
  if (p2Dept) p2Dept.textContent = officerDept;

  const p2SubLine = document.getElementById('printP2SubmissionLine');
  const monthTitleVal = (appState.monthData && appState.monthData.title) || 'मे २०२६';
  if (p2SubLine) p2SubLine.textContent = `उपरोक्त ${monthTitleVal} ची मासिक दैनंदिनी मंजूरीसाठी सविनय सादर.`;

  const p2SigName = document.getElementById('printP2SigName');
  const p2SigDesig = document.getElementById('printP2SigDesig');
  const p2SigDept = document.getElementById('printP2SigDept');
  const p2SigCity = document.getElementById('printP2SigCity');
  if (p2SigName) p2SigName.textContent = `(${officerName})`;
  if (p2SigDesig) p2SigDesig.textContent = officerDesig;
  if (p2SigDept) p2SigDept.textContent = 'भूजल सर्वेक्षण आणि विकास यंत्रणा,';
  if (p2SigCity) p2SigCity.textContent = officerHq;

  // 1-Page Signatures & End Date (Rows 44 to 54)
  const sigOfficer = document.getElementById('printSigOfficer');
  if (sigOfficer) sigOfficer.textContent = `(${officerName})`;
  const sigDesig = document.getElementById('printSigDesig');
  if (sigDesig) sigDesig.textContent = officerDesig;
  const sigOffice = document.getElementById('printSigOffice');
  if (sigOffice) sigOffice.textContent = officerDept;

  // Submission remark using actual Controlling Officer field
  const subOffice = document.getElementById('printSubmissionOffice');
  let co = (prof.controlling_officer || '').trim();
  if (!co) {
    co = `वरिष्ठ भूवैज्ञानिक, ${officerDept}`.trim();
  }
  if (!co.startsWith('मा.') && !co.startsWith('मा ')) {
    co = 'मा. ' + co;
  }
  if (subOffice) subOffice.textContent = `${co} यांना माहितीस्तव व मंजूरीस्तव सविनय सादर.`;

  const bottomSig = document.getElementById('printBottomSig');
  if (bottomSig) bottomSig.textContent = `(${officerName})`;
  const bottomDesigCity = document.getElementById('printBottomDesigCity');
  if (bottomDesigCity) bottomDesigCity.textContent = `${officerDesig}, ${officerHq}`;
  const bottomOffice = document.getElementById('printBottomOffice');
  if (bottomOffice) bottomOffice.textContent = officerDept;

  let lastDateStr = '';
  if (entries.length > 0) {
    const lastEntry = entries[entries.length - 1];
    if (lastEntry && lastEntry.date) {
      const parts = lastEntry.date.split(' ')[0].split('-');
      if (parts.length === 3) {
        lastDateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
  }
  
  const LEGACY_MONTH_END_DATES = [
    '31/01/2026', '28/02/2026', '29/02/2026', '31/03/2026', '30/04/2026',
    '31/05/2026', '30/06/2026', '31/07/2026', '31/08/2026', '30/09/2026',
    '31/10/2026', '30/11/2026', '31/12/2026',
    '31-01-2026', '28-02-2026', '31-03-2026', '30-04-2026', '31-07-2026'
  ];
  function isLegacySubmissionDate(val) {
    if (!val || !String(val).trim()) return true;
    const s = String(val).trim();
    return LEGACY_MONTH_END_DATES.includes(s);
  }

  function getDefaultSubmissionDate() {
    if (appState.monthData && appState.monthData.entries && appState.monthData.entries.length > 0) {
      const firstE = appState.monthData.entries[0];
      if (firstE && firstE.date) {
        const parts = firstE.date.split(' ')[0].split('-');
        if (parts.length === 3) {
          let y = parseInt(parts[0], 10) || 2026;
          let m = parseInt(parts[1], 10) || 1;
          m += 1;
          if (m > 12) {
            m = 1;
            y += 1;
          }
          const mm = m < 10 ? '0' + m : '' + m;
          return `05/${mm}/${y}`;
        }
      }
    }
    // Fallback using currentSheetName
    if (appState.currentSheetName) {
      const s = appState.currentSheetName.toLowerCase();
      let m = 1;
      if (s.includes('jan') || s.includes('जानेवारी')) m = 1;
      else if (s.includes('feb') || s.includes('फेब्रुवारी')) m = 2;
      else if (s.includes('mar') || s.includes('मार्च')) m = 3;
      else if (s.includes('apr') || s.includes('एप्रिल')) m = 4;
      else if (s.includes('may') || s.includes('मे')) m = 5;
      else if (s.includes('jun') || s.includes('जून')) m = 6;
      else if (s.includes('jul') || s.includes('जुलै')) m = 7;
      else if (s.includes('aug') || s.includes('ऑगस्ट')) m = 8;
      else if (s.includes('sep') || s.includes('सप्टेंबर')) m = 9;
      else if (s.includes('oct') || s.includes('ऑक्टोबर')) m = 10;
      else if (s.includes('nov') || s.includes('नोव्हेंबर')) m = 11;
      else if (s.includes('dec') || s.includes('डिसेंबर')) m = 12;
      let nextM = m + 1;
      let y = 2026;
      if (nextM > 12) { nextM = 1; y = 2027; }
      const mm = nextM < 10 ? '0' + nextM : '' + nextM;
      return `05/${mm}/${y}`;
    }
    return '05/02/2026';
  }

  const dateInput = document.getElementById('printBottomDateInput');
  const dateInputP2 = document.getElementById('printP2DateInput');
  let chosenSubDate = '05/02/2026';
  if (appState.monthData && appState.monthData.submission_date && !isLegacySubmissionDate(appState.monthData.submission_date)) {
    chosenSubDate = appState.monthData.submission_date;
  } else {
    chosenSubDate = getDefaultSubmissionDate();
    if (appState.monthData) appState.monthData.submission_date = chosenSubDate;
  }
  if (dateInput) dateInput.value = chosenSubDate;
  if (dateInputP2) dateInputP2.value = chosenSubDate;
  const p2DateDisp = document.getElementById('printP2DateDisplay');
  if (p2DateDisp) p2DateDisp.textContent = chosenSubDate;
  setTimeout(() => checkPageFit(), 60);
}

function onSubmissionDateChange(val) {
  if (appState.monthData) {
    appState.monthData.submission_date = val;
  }
  const dateInput = document.getElementById('printBottomDateInput');
  const dateInputP2 = document.getElementById('printP2DateInput');
  const p2DateDisp = document.getElementById('printP2DateDisplay');
  if (dateInput && dateInput.value !== val) dateInput.value = val;
  if (dateInputP2 && dateInputP2.value !== val) dateInputP2.value = val;
  if (p2DateDisp) p2DateDisp.textContent = val;
}

function openSubmissionDateModal() {
  const currentVal = (document.getElementById('printBottomDateInput') && document.getElementById('printBottomDateInput').value) ||
                     (document.getElementById('printP2DateInput') && document.getElementById('printP2DateInput').value) ||
                     (appState.monthData && appState.monthData.submission_date) || '05/08/2026';
  const modalInput = document.getElementById('modalSubDateInput');
  if (modalInput) modalInput.value = currentVal;
  showModal('subDateModal');
}

function setSubDateToNextMonth5() {
  if (appState.monthData && appState.monthData.entries && appState.monthData.entries.length > 0) {
    const firstE = appState.monthData.entries[0];
    if (firstE && firstE.date) {
      const parts = firstE.date.split(' ')[0].split('-');
      if (parts.length === 3) {
        let y = parseInt(parts[0], 10) || 2026;
        let m = parseInt(parts[1], 10) || 1;
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
        const mm = m < 10 ? '0' + m : '' + m;
        document.getElementById('modalSubDateInput').value = `05/${mm}/${y}`;
        return;
      }
    }
  }
  document.getElementById('modalSubDateInput').value = '05/08/2026';
}

function setSubDateToMonthEnd() {
  if (appState.monthData && appState.monthData.entries && appState.monthData.entries.length > 0) {
    const lastE = appState.monthData.entries[appState.monthData.entries.length - 1];
    if (lastE && lastE.date) {
      const parts = lastE.date.split(' ')[0].split('-');
      if (parts.length === 3) {
        document.getElementById('modalSubDateInput').value = `${parts[2]}/${parts[1]}/${parts[0]}`;
        return;
      }
    }
  }
  document.getElementById('modalSubDateInput').value = '31/07/2026';
}

function setSubDateToToday() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  document.getElementById('modalSubDateInput').value = `${d}/${m}/${y}`;
}

function saveSubmissionDateFromModal() {
  const val = document.getElementById('modalSubDateInput').value.trim();
  if (val) {
    onSubmissionDateChange(val);
    showToast(`सादर दिनांक "${val}" जतन केला!`);
  }
  hideModal('subDateModal');
}

// Switch between A1:J50 (A4 Portrait) and All Columns (A4 Landscape)
function switchPrintMode(mode) {
  let styleEl = document.getElementById('dynamicPrintStyle');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamicPrintStyle';
    document.head.appendChild(styleEl);
  }

  const btnA1J = document.getElementById('btnPrintModeA1J');
  const btnAll = document.getElementById('btnPrintModeAll');
  const tableA1J = document.getElementById('tableA1J');
  const tableAll = document.getElementById('tableAllCols');

  if (mode === 'all') {
    styleEl.innerHTML = `@media print { @page { size: A4 landscape; margin: 3.5mm 4mm; } }`;
    document.body.classList.remove('print-portrait');
    document.body.classList.add('print-landscape');
    if (tableA1J) tableA1J.classList.add('hidden');
    if (tableAll) tableAll.classList.remove('hidden');
    if (btnAll) btnAll.className = 'px-2.5 py-1.5 bg-blue-900 text-white font-semibold';
    if (btnA1J) btnA1J.className = 'px-2.5 py-1.5 bg-white text-slate-700';
  } else {
    styleEl.innerHTML = `@media print { @page { size: A4 portrait; margin: 3.5mm 4mm; } }`;
    document.body.classList.remove('print-landscape');
    document.body.classList.add('print-portrait');
    if (tableA1J) tableA1J.classList.remove('hidden');
    if (tableAll) tableAll.classList.add('hidden');
    if (btnA1J) btnA1J.className = 'px-2.5 py-1.5 bg-blue-900 text-white font-semibold';
    if (btnAll) btnAll.className = 'px-2.5 py-1.5 bg-white text-slate-700';
  }
}

// User Validation Rule: 1 village 2 wells possible, 0 village 1 well not possible!
function validateVillagesAndWells() {
  const wells = parseInt(document.getElementById('entryWells').value, 10) || 0;
  const borewells = parseInt(document.getElementById('entryBorewells').value, 10) || 0;
  const cases = parseInt(document.getElementById('entryCases').value, 10) || 0;
  const villagesInput = document.getElementById('entryVillages');
  let villages = parseInt(villagesInput.value, 10) || 0;

  if (wells > 0 || borewells > 0 || cases > 0) {
    if (villages < 1) {
      villagesInput.value = 1;
    }
    // Auto-select दौरा
    document.getElementById('chkTour').checked = true;
    document.getElementById('chkHoliday').checked = false;
  }
}

// Initialize Tabs
function initTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      if (!targetId) return; // Do not switch tabs if button has no data-tab (e.g. Profile action)

      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active-tab'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active-tab');
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.add('active');
      appState.activeTab = targetId;

      if (targetId === 'tab-entries') {
        renderEntriesTable();
        renderMobileCards();
      } else if (targetId === 'tab-calendar') {
        renderCalendarView();
      } else if (targetId === 'tab-summary') {
        recalculateMonthlySummary();
        renderSummaryCards();
        renderFieldProgress();
      } else if (targetId === 'tab-official') {
        renderPrintView();
      } else if (targetId === 'tab-holidays') {
        loadAndRenderHolidays();
      } else if (targetId === 'tab-profile') {
        populateTabProfileFields();
      }
    });
  });

  const btnApplyHolidays = document.getElementById('btnApplyHolidaysToMonth');
  if (btnApplyHolidays) {
    btnApplyHolidays.onclick = applyHolidaysToCurrentMonth;
  }
}

// Switch between Govt and Solapur holiday subtabs
function switchHolidaySubtab(type) {
  const btnGovt = document.getElementById('btnSubtabGovt');
  const btnSolapur = document.getElementById('btnSubtabSolapur');
  const secGovt = document.getElementById('subtabGovtContent');
  const secSolapur = document.getElementById('subtabSolapurContent');

  if (type === 'solapur') {
    if (btnSolapur) btnSolapur.className = 'px-3 py-2 border-b-2 border-red-600 text-red-700 font-bold flex items-center gap-1.5';
    if (btnGovt) btnGovt.className = 'px-3 py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1.5';
    if (secGovt) secGovt.classList.add('hidden');
    if (secSolapur) secSolapur.classList.remove('hidden');
  } else {
    if (btnGovt) btnGovt.className = 'px-3 py-2 border-b-2 border-blue-900 text-blue-900 font-bold flex items-center gap-1.5';
    if (btnSolapur) btnSolapur.className = 'px-3 py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1.5';
    if (secGovt) secGovt.classList.remove('hidden');
    if (secSolapur) secSolapur.classList.add('hidden');
  }
}

// Fetch and render Maharashtra Govt & Solapur District holidays
async function loadAndRenderHolidays() {
  let data = null;
  try {
    const res = await fetch('/api/holidays');
    if (res.ok) {
      data = await res.json();
    }
  } catch (err) {
    console.warn('API holidays fetch fallback:', err);
  }

  if (!data || !data.success) {
    if (window.GSDA_DEFAULT_DATA && window.GSDA_DEFAULT_DATA.constants) {
      data = {
        success: true,
        maharashtra_govt_2026: window.GSDA_DEFAULT_DATA.constants.maharashtra_govt_2026 || [],
        solapur_local_2026: window.GSDA_DEFAULT_DATA.constants.solapur_local_2026 || []
      };
    }
  }
  if (!data || !data.success) return;

  // Render Maharashtra Govt Holidays
  const govtTbody = document.getElementById('govtHolidaysTableBody');
  if (govtTbody) {
    govtTbody.innerHTML = '';
    (data.maharashtra_govt_2026 || []).forEach((h, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50';
      tr.innerHTML = `
        <td class="p-2 text-center font-mono border-r border-slate-200">${idx + 1}</td>
        <td class="p-2 text-center font-mono border-r border-slate-200 text-blue-800 font-semibold">${h.date}</td>
        <td class="p-2 text-center font-marathi border-r border-slate-200">${h.day}</td>
        <td class="p-2 font-marathi text-slate-900 font-medium">${h.name}</td>
      `;
      govtTbody.appendChild(tr);
    });
  }

  // Render Solapur Local Holidays
  const solapurTbody = document.getElementById('solapurHolidaysTableBody');
  if (solapurTbody) {
    solapurTbody.innerHTML = '';
    (data.solapur_local_2026 || []).forEach((h, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-amber-50/50';
      tr.innerHTML = `
        <td class="p-2 text-center font-mono border-r border-slate-200">${idx + 1}</td>
        <td class="p-2 text-center font-mono border-r border-slate-200 text-red-700 font-bold">${h.date}</td>
        <td class="p-2 text-center font-marathi border-r border-slate-200">${h.day}</td>
        <td class="p-2 font-marathi text-slate-900 font-semibold">${h.name}</td>
        <td class="p-2 text-center font-marathi text-amber-800 font-medium">सोलापूर जिल्हा</td>
      `;
      solapurTbody.appendChild(tr);
    });
  }
}

// Apply official holidays to currently active month entries
async function applyHolidaysToCurrentMonth() {
  if (!appState.currentSheetName || !appState.monthData) {
    alert('कृपया आधी एक महिना निवडा.');
    return;
  }

  const btn = document.getElementById('btnApplyHolidaysToMonth');
  const origHtml = btn.innerHTML;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> लागू करत आहे...`;
  btn.disabled = true;

  let appliedViaBackend = false;
  try {
    const res = await fetch(`/api/month/${encodeURIComponent(appState.currentSheetName)}/apply-holidays`, {
      method: 'POST'
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        appliedViaBackend = true;
        showToast(data.message);
        await loadMonthData(appState.currentSheetName);
      }
    }
  } catch (err) {
    console.warn('Backend apply-holidays not available, applying offline:', err);
  }

  if (!appliedViaBackend) {
    const holidaysMap = (window.GSDA_DEFAULT_DATA && window.GSDA_DEFAULT_DATA.constants && window.GSDA_DEFAULT_DATA.constants.holidays) || {};
    let appliedCount = 0;
    if (appState.monthData && appState.monthData.entries) {
      appState.monthData.entries.forEach(e => {
        if (!e.date) return;
        const hName = holidaysMap[e.date];
        const isSunday = (e.day === 'रविवार' || e.day === 'Sunday');
        if (hName) {
          e.holiday = '1';
          e.total = '';
          e.tour = '';
          e.leave = '';
          e.meeting = '';
          e.training = '';
          e.work_detail = `सार्वजनिक सुट्टी - ${hName}`;
          appliedCount++;
        } else if (isSunday) {
          e.holiday = '1';
          e.total = '';
          e.tour = '';
          e.leave = '';
          e.meeting = '';
          e.training = '';
          e.work_detail = 'रविवार - साप्ताहिक सुट्टी';
          appliedCount++;
        }
      });
      saveLocalDraft();
      recalculateMonthlySummary();
      renderActiveMonth();
      showToast(`${appliedCount} शासकीय व साप्ताहिक सुट्ट्या लागू केल्या!`);
    }
  }

  const entriesTab = document.querySelector('[data-tab="tab-entries"]');
  if (entriesTab) entriesTab.click();
  btn.innerHTML = origHtml;
  btn.disabled = false;
}

// IndexedDB for Desktop App Holiday PDFs
function openHolidayDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { resolve(null); return; }
    const req = indexedDB.open('GSDA_HolidayFilesDB', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('holiday_files')) {
        db.createObjectStore('holiday_files');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHolidayFile(key, file) {
  try {
    const db = await openHolidayDB();
    if (!db) {
      localStorage.setItem(`gsda_pdf_meta_${key}`, JSON.stringify({ name: file.name, size: file.size, date: new Date().toLocaleDateString('mr-IN') }));
      return true;
    }
    const tx = db.transaction('holiday_files', 'readwrite');
    const store = tx.objectStore('holiday_files');
    store.put({
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      uploadedDate: new Date().toLocaleDateString('mr-IN'),
      data: file
    }, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        localStorage.setItem(`gsda_pdf_meta_${key}`, JSON.stringify({ name: file.name, size: file.size, date: new Date().toLocaleDateString('mr-IN') }));
        resolve(true);
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('IndexedDB save failed:', e);
    return false;
  }
}

async function getHolidayFile(key) {
  try {
    const db = await openHolidayDB();
    if (!db) return null;
    const tx = db.transaction('holiday_files', 'readonly');
    const store = tx.objectStore('holiday_files');
    const req = store.get(key);
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('IndexedDB get failed:', e);
    return null;
  }
}

async function viewSarvjanikPdf() {
  const stored = await getHolidayFile('sarvjanik_pdf');
  if (stored && stored.data) {
    const url = URL.createObjectURL(stored.data);
    window.open(url, '_blank');
  } else {
    window.open('diary/maharashtra_govt_holidays_2026.pdf', '_blank');
  }
}

function triggerUploadSarvjanikPdf() {
  const input = document.getElementById('deskInputSarvjanikPdf');
  if (input) {
    input.value = '';
    input.click();
  }
}

async function handleUploadSarvjanikPdf(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const ok = await saveHolidayFile('sarvjanik_pdf', file);
  if (ok) {
    await updateHolidayPdfStatuses();
    alert(`सार्वजनिक सुट्ट्या फाईल (${file.name}) यशस्वीरीत्या सेव्ह झाली!\n\nआपण 'सार्वजनिक सुट्ट्या PDF पहा' बटण दाबून ती कधीही पाहू शकता.`);
  } else {
    alert('फाईल सेव्ह करताना त्रुटी आली.');
  }
}

async function viewStanikPdf() {
  const stored = await getHolidayFile('stanik_pdf');
  if (stored && stored.data) {
    const url = URL.createObjectURL(stored.data);
    window.open(url, '_blank');
  } else {
    window.open('diary/solapur_local_holidays_2026.png', '_blank');
  }
}

function triggerUploadStanikPdf() {
  const input = document.getElementById('deskInputStanikPdf');
  if (input) {
    input.value = '';
    input.click();
  }
}

async function handleUploadStanikPdf(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const ok = await saveHolidayFile('stanik_pdf', file);
  if (ok) {
    await updateHolidayPdfStatuses();
    alert(`स्थानिक सुट्ट्या फाईल (${file.name}) यशस्वीरीत्या सेव्ह झाली!\n\nआपण 'स्थानिक सुट्ट्या आदेश पहा' बटण दाबून ती कधीही पाहू शकता.`);
  } else {
    alert('फाईल सेव्ह करताना त्रुटी आली.');
  }
}

async function updateHolidayPdfStatuses() {
  const sSarv = document.getElementById('deskSarvjanikPdfStatus');
  const sStan = document.getElementById('deskStanikPdfStatus');
  
  const fileSarv = await getHolidayFile('sarvjanik_pdf');
  if (fileSarv && sSarv) {
    sSarv.innerHTML = `<i class="fa-solid fa-file-circle-check text-emerald-600"></i> <strong>अपलोड फाईल:</strong> ${fileSarv.name} (${(fileSarv.size/1024).toFixed(1)} KB)`;
  } else if (sSarv) {
    sSarv.innerHTML = `<i class="fa-solid fa-file-circle-check"></i> महाराष्ट्र शासन अधिकृत राजपत्र २०२६ उपलब्ध`;
  }

  const fileStan = await getHolidayFile('stanik_pdf');
  if (fileStan && sStan) {
    sStan.innerHTML = `<i class="fa-solid fa-file-circle-check text-emerald-600"></i> <strong>अपलोड फाईल:</strong> ${fileStan.name} (${(fileStan.size/1024).toFixed(1)} KB)`;
  } else if (sStan) {
    sStan.innerHTML = `<i class="fa-solid fa-file-circle-check"></i> जिल्हाधिकारी स्थानिक सुट्टी आदेश २०२६ उपलब्ध`;
  }
}

// Initialize Filter Pills
function initFilters() {
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.activeFilter = btn.dataset.filter;
      renderEntriesTable();
      renderMobileCards();
    });
  });
}

// Initialize Search
function initSearch() {
  const searchInput = document.getElementById('globalSearchInput');
  const btnSearch = document.getElementById('btnExecuteSearch');
  
  btnSearch.addEventListener('click', () => executeSearch(searchInput.value));
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') executeSearch(searchInput.value);
  });
}

// Execute Global Search
async function executeSearch(query) {
  if (!query || !query.trim()) return;
  const qClean = query.trim().toLowerCase();
  const tbody = document.getElementById('searchResultsBody');
  const countDiv = document.getElementById('searchResultsCount');
  const countNum = document.getElementById('countNumber');
  
  tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500 font-marathi"><i class="fa-solid fa-spinner fa-spin mr-2"></i> शोधत आहे...</td></tr>`;
  
  let searchResults = null;
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        searchResults = data.results;
      }
    }
  } catch (err) {
    console.warn('Backend search unavailable, searching locally:', err);
  }

  // Offline client-side search fallback
  if (!searchResults) {
    searchResults = [];
    const allMonths = (window.GSDA_DEFAULT_DATA && window.GSDA_DEFAULT_DATA.months) || {};
    const sheetNames = (appState.sheets && appState.sheets.length > 0) ? appState.sheets.map(s => s.name) : Object.keys(allMonths);
    sheetNames.forEach(sheetName => {
      let mData = allMonths[sheetName];
      const draftStr = localStorage.getItem(`gsda_draft_${sheetName}`);
      if (draftStr) {
        try { mData = JSON.parse(draftStr); } catch(e){}
      }
      if (mData && mData.entries) {
        mData.entries.forEach(e => {
          const w = (e.work_detail || '').toLowerCase();
          const f = (e.from_loc || '').toLowerCase();
          const t = (e.to_loc || '').toLowerCase();
          const sc = (e.scheme || '').toLowerCase();
          const vg = (e.villages || '').toLowerCase();
          if (w.includes(qClean) || f.includes(qClean) || t.includes(qClean) || sc.includes(qClean) || vg.includes(qClean)) {
            searchResults.push({
              sheet_name: sheetName,
              date: e.date,
              from: e.from_loc,
              to: e.to_loc,
              work: e.work_detail,
              distance_km: e.distance_km,
              is_tour: !!(e.tour == '1' || e.tour == 1),
              is_holiday: !!(e.holiday == '1' || e.holiday == 1),
              is_leave: !!(e.leave == '1' || e.leave == 1),
              is_meeting: !!(e.meeting == '1' || e.meeting == 1)
            });
          }
        });
      }
    });
  }

  countDiv.classList.remove('hidden');
  countNum.textContent = searchResults.length;
  tbody.innerHTML = '';
  
  if (searchResults.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400 font-marathi">"${query}" साठी कोणतीही नोंद सापडली नाही.</td></tr>`;
    return;
  }

  searchResults.forEach(r => {
    let typeBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">कार्यालय</span>';
    if (r.is_tour) typeBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-900 font-semibold">दौरा</span>';
    else if (r.is_meeting) typeBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 font-semibold">बैठक</span>';
    else if (r.is_holiday) typeBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-semibold">सुट्टी</span>';
    else if (r.is_leave) typeBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 font-semibold">रजा</span>';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 border-b border-slate-100';
    tr.innerHTML = `
      <td class="p-2 border-r border-slate-200 text-center font-medium text-slate-800">${r.sheet_name}</td>
      <td class="p-2 border-r border-slate-200 text-center font-mono">${r.date}</td>
      <td class="p-2 border-r border-slate-200 text-center font-medium">${r.to || r.from || '-'}</td>
      <td class="p-2 border-r border-slate-200 text-slate-800">${r.work}</td>
      <td class="p-2 border-r border-slate-200 text-center font-mono">${r.distance_km || '-'}</td>
      <td class="p-2 border-r border-slate-200 text-center">${typeBadge}</td>
      <td class="p-2 text-center">
        <button class="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs" onclick="jumpToMonth('${r.sheet_name}')">
          पहा
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function jumpToMonth(sheetName) {
  monthSelect.value = sheetName;
  loadMonthData(sheetName);
  document.querySelector('[data-tab="tab-entries"]').click();
}

// Initialize Modals
function initModals() {
  document.getElementById('btnCloseModal').onclick = () => hideModal('entryModal');
  document.getElementById('btnCancelModal').onclick = () => hideModal('entryModal');
  document.getElementById('btnQuickAddEntry').onclick = () => openEntryModal(-1);

  document.getElementById('btnBatchFill').onclick = () => showModal('batchModal');
  document.getElementById('btnCloseBatchModal').onclick = () => hideModal('batchModal');
  document.getElementById('btnCancelBatch').onclick = () => hideModal('batchModal');
  document.getElementById('btnApplyBatch').onclick = applyBatchFill;

  // New Month Modal
  const btnNewMonth = document.getElementById('btnNewMonth');
  if (btnNewMonth) {
    btnNewMonth.onclick = (e) => {
      e.preventDefault();
      showModal('newMonthModal');
    };
  }
  document.getElementById('btnCloseNewMonthModal').onclick = () => hideModal('newMonthModal');
  document.getElementById('btnCancelNewMonth').onclick = () => hideModal('newMonthModal');
  document.getElementById('btnSubmitNewMonth').onclick = submitNewMonth;

  // Profile Modal
  const btnOpenProfile = document.getElementById('btnOpenProfile');
  if (btnOpenProfile) {
    btnOpenProfile.onclick = openProfileModal;
  }
  document.getElementById('btnCloseProfileModal').onclick = () => hideModal('profileModal');
  document.getElementById('btnCancelProfile').onclick = () => hideModal('profileModal');
  document.getElementById('btnSaveProfile').onclick = saveProfileModal;

  // Share Modal
  const btnOpenShare = document.getElementById('btnOpenShare');
  if (btnOpenShare) {
    btnOpenShare.onclick = openShareModal;
  }
  const btnCloseShareModal = document.getElementById('btnCloseShareModal');
  if (btnCloseShareModal) btnCloseShareModal.onclick = () => hideModal('shareModal');
  const btnDismissShare = document.getElementById('btnDismissShare');
  if (btnDismissShare) btnDismissShare.onclick = () => hideModal('shareModal');

  const btnShareWhatsApp = document.getElementById('btnShareWhatsApp');
  if (btnShareWhatsApp) btnShareWhatsApp.onclick = shareViaWhatsApp;

  const btnShareNative = document.getElementById('btnShareNative');
  if (btnShareNative) btnShareNative.onclick = shareViaNative;

  const btnShareCopy = document.getElementById('btnShareCopy');
  if (btnShareCopy) btnShareCopy.onclick = copyShareText;

  const btnSharePrint = document.getElementById('btnSharePrint');
  if (btnSharePrint) btnSharePrint.onclick = () => {
    hideModal('shareModal');
    document.querySelector('[data-tab="tab-official"]').click();
    setTimeout(() => window.print(), 250);
  };

  document.getElementById('btnSaveEntry').onclick = saveEntryModal;
  document.getElementById('btnDeleteEntry').onclick = deleteCurrentModalEntry;

  document.getElementById('btnSaveExcel').onclick = saveAllToExcel;
  document.getElementById('btnPrint').onclick = () => {
    document.querySelector('[data-tab="tab-official"]').click();
    setTimeout(() => window.print(), 250);
  };
}

// Share Functions
function generateShareText() {
  if (!appState.monthData) return '';
  const m = appState.monthData;
  const s = m.summary || {};
  const prof = appState.profile || {};
  const officerName = prof.name || 'विनायक नवनाथ निंबाळकर';
  const officerDesig = prof.designation || 'सहाय्यक भूवैज्ञानिक';
  const officerDept = prof.department || 'भूजल सर्वेक्षण आणि विकास यंत्रणा, सोलापूर';
  const officerHq = prof.headquarters || 'सोलापूर';

  let txt = `*महाराष्ट्र शासन | GSDA*\n`;
  txt += `*अधिकारी दैनिक दैनंदिनी - मासिक गोषवारा*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `📋 *महिना:* ${m.title || m.sheet_name}\n`;
  txt += `👤 *अधिकारी:* श्री. ${officerName}\n`;
  txt += `💼 *पदनाम:* ${officerDesig}\n`;
  txt += `📍 *मुख्यालय:* ${officerHq}\n`;
  txt += `🏛️ *कार्यालय:* ${officerDept}\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `📊 *मासिक गोषवारा (Summary):*\n`;
  txt += `• एकूण दिवस: ${s.total_days || 31}\n`;
  txt += `• कार्यालयीन कामकाज: ${s.office_days || 0} दिवस\n`;
  txt += `• फिरती / दौरा: ${s.tour_days || 0} दिवस\n`;
  txt += `• बैठका: ${s.meeting_days || 0} दिवस\n`;
  txt += `• शासकीय सुट्ट्या: ${s.holiday_days || 0} दिवस\n`;
  txt += `• प्रशिक्षण / कार्यशाळा: ${s.training_days || 0} दिवस\n`;
  txt += `• रजा: ${s.leave_days || 0} दिवस\n`;
  txt += `• तपासलेली विहिरी: ${s.total_wells || 0}\n`;
  txt += `• विंधण विहिरी: ${s.total_borewells || 0}\n`;
  txt += `• एकूण प्रवास अंतर: ${(s.total_travel_km || 0).toFixed(1)} कि.मी.\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `प्रति, मा. वरिष्ठ भूवैज्ञानिक, ${officerDept} यांना माहितीस्तव व मंजूरीस्तव सविनय सादर.`;
  return txt;
}

function openShareModal() {
  const preview = document.getElementById('sharePreviewText');
  if (preview) {
    preview.value = generateShareText();
  }
  showModal('shareModal');
}

function shareViaWhatsApp() {
  const text = generateShareText();
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

async function shareViaNative() {
  const text = generateShareText();
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'GSDA दैनिक दैनंदिनी - मासिक गोषवारा',
        text: text
      });
      showToast('मासिक गोषवारा यशस्वीरीत्या शेअर केला!');
    } catch (err) {
      if (err.name !== 'AbortError') {
        copyShareText();
      }
    }
  } else {
    copyShareText();
  }
}

function copyShareText() {
  const text = generateShareText();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('मासिक गोषवारा संदेश क्लिपबोर्डवर कॉपी केला!');
    }).catch(() => {
      fallbackCopyText(text);
    });
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast('मासिक गोषवारा संदेश क्लिपबोर्डवर कॉपी केला!');
}

// Profile Headquarters and District Helpers
const COMMON_DISTRICT_MAP = {
  'solapur': 'सोलापूर', 'slp': 'सोलापूर',
  'latur': 'लातूर', 'ltr': 'लातूर',
  'kolhapur': 'कोल्हापूर', 'kop': 'कोल्हापूर',
  'pune': 'पुणे', 'dharashiv': 'धाराशिव', 'osmanabad': 'उस्मानाबाद',
  'nanded': 'नांदेड', 'satara': 'सातारा', 'sangli': 'सांगली',
  'nashik': 'नाशिक', 'beed': 'बीड', 'jalna': 'जालना', 'nagpur': 'नागपूर'
};

const COMMON_DISTRICTS_LIST = [
  'सोलापूर', 'लातूर', 'कोल्हापूर', 'पुणे', 'धाराशिव', 'उस्मानाबाद',
  'नांदेड', 'औरंगाबाद', 'छत्रपती संभाजीनगर', 'सातारा', 'सांगली',
  'अहमदनगर', 'नाशिक', 'बीड', 'जालना', 'परभणी', 'हिंगोली', 'नागपूर',
  'solapur', 'latur', 'kolhapur', 'pune', 'slp', 'kop', 'ltr'
];

function isHeadquartersLocation(loc) {
  if (!loc) return true;
  const trimmed = loc.trim();
  if (['-', '', 'None', 'कोठून', 'कार्यालय'].includes(trimmed)) return true;
  if (COMMON_DISTRICTS_LIST.includes(trimmed.toLowerCase())) return true;
  if (appState.profile && appState.profile.headquarters && trimmed === appState.profile.headquarters.trim()) return true;
  return false;
}

function getActiveHQ() {
  return (appState.profile && appState.profile.headquarters) ? appState.profile.headquarters.trim() : 'सोलापूर';
}

function setupProfileAutoSync() {
  const hqEl = document.getElementById('profHeadquarters');
  const deptEl = document.getElementById('profDepartment');
  const ctrlEl = document.getElementById('profControlling');
  if (!hqEl || !deptEl || !ctrlEl) return;

  hqEl.oninput = () => {
    let hqVal = hqEl.value.trim();
    if (COMMON_DISTRICT_MAP[hqVal.toLowerCase()]) {
      hqVal = COMMON_DISTRICT_MAP[hqVal.toLowerCase()];
      hqEl.value = hqVal;
    }
    if (hqVal) {
      deptEl.value = `भूजल सर्वेक्षण आणि विकास यंत्रणा, ${hqVal}`;
      ctrlEl.value = `वरिष्ठ भूवैज्ञानिक, भूजल सर्वेक्षण आणि विकास यंत्रणा, ${hqVal}`;
    }
  };

  deptEl.oninput = () => {
    const deptVal = deptEl.value.trim();
    if (deptVal) {
      ctrlEl.value = `वरिष्ठ भूवैज्ञानिक, ${deptVal}`;
      const parts = deptVal.split(/[,/]/);
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1].trim();
        if (lastPart && lastPart.length < 15) {
          hqEl.value = lastPart;
        }
      }
    }
  };
}

// Open Profile Modal
function openProfileModal() {
  const prof = appState.profile || {};
  document.getElementById('profName').value = prof.name || '';
  document.getElementById('profDesignation').value = prof.designation || '';
  document.getElementById('profDepartment').value = prof.department || '';
  const hqEl = document.getElementById('profHeadquarters');
  if (hqEl) hqEl.value = prof.headquarters || 'सोलापूर';
  document.getElementById('profBudgetHead').value = prof.budget_head || '';
  document.getElementById('profSalary').value = prof.salary || '';
  document.getElementById('profControlling').value = prof.controlling_officer || '';
  const fareEl = document.getElementById('profFareRate');
  if (fareEl) {
    fareEl.value = prof.fare_rate_per_km || '10';
    updateFareFormulaText(fareEl.value);
  }
  const pf = prof.print_format || '1page';
  const pfRadio = document.querySelector(`input[name="profPrintFormat"][value="${pf}"]`);
  if (pfRadio) pfRadio.checked = true;
  
  setupProfileAutoSync();
  showModal('profileModal');
}

window.openProfileModalDirect = openProfileModal;

// Switch directly to Profile Tab
function switchToProfileTab() {
  const tabBtn = document.querySelector('.nav-tab[data-tab="tab-profile"]');
  if (tabBtn) {
    tabBtn.click();
  } else {
    openProfileModal();
  }
}
window.switchToProfileTab = switchToProfileTab;

// Populate Tab Profile Fields (Full Profile View like /diary)
function populateTabProfileFields() {
  const prof = appState.profile || {};
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };
  setVal('tabProfName', prof.name || 'विनायक नवनाथ निंबाळकर');
  setVal('tabProfDesig', prof.designation || 'सहाय्यक भूवैज्ञानिक');
  setVal('tabProfSalary', prof.salary || '६४०००/-');
  setVal('tabProfHQ', prof.headquarters || 'सोलापूर');
  setVal('tabProfBudget', prof.budget_head || '२७०२');
  setVal('tabProfDept', prof.department || 'भूजल सर्वेक्षण आणि विकास यंत्रणा, सोलापूर');
  setVal('tabProfControlling', prof.controlling_officer || 'वरिष्ठ भूवैज्ञानिक, भूजल सर्वेक्षण आणि विकास यंत्रणा, सोलापूर');
  setVal('tabProfFareRate', prof.fare_rate_per_km || '10');

  const fareVal = prof.fare_rate_per_km || '10';
  updateTabFareFormulaText(fareVal);

  const pf = prof.print_format || '1page';
  const pfRadio = document.querySelector(`input[name="tabProfPrintFormat"][value="${pf}"]`);
  if (pfRadio) pfRadio.checked = true;

  const reqEl = document.getElementById('lblTabDeviceReqCode');
  if (reqEl) {
    reqEl.textContent = typeof getDeviceRequestCode === 'function' ? getDeviceRequestCode() : 'REQ-OFFLINE-OK';
  }
}
window.populateTabProfileFields = populateTabProfileFields;

function updateTabFareFormulaText(val) {
  const display = document.getElementById('tabFareFormulaDisplay');
  const rate = parseFloat(val) || 10;
  if (display) {
    display.textContent = `सूत्र: अंतर × ${rate} रु.`;
  }
}
window.updateTabFareFormulaText = updateTabFareFormulaText;

function onTabPrintFormatChange(val) {
  window.switchPrintFormatDirect(val);
}
window.onTabPrintFormatChange = onTabPrintFormatChange;

// Save Tab Profile to backend
async function saveTabProfile() {
  const hqEl = document.getElementById('tabProfHQ');
  let newHq = hqEl ? hqEl.value.trim() : 'सोलापूर';
  if (COMMON_DISTRICT_MAP[newHq.toLowerCase()]) {
    newHq = COMMON_DISTRICT_MAP[newHq.toLowerCase()];
  }

  const fareRateEl = document.getElementById('tabProfFareRate');
  const fareRate = fareRateEl ? fareRateEl.value.trim() : '10';

  const pfInput = document.querySelector('input[name="tabProfPrintFormat"]:checked');
  const printFormat = pfInput ? pfInput.value : '1page';

  const updatedProf = {
    name: document.getElementById('tabProfName').value.trim(),
    designation: document.getElementById('tabProfDesig').value.trim(),
    department: document.getElementById('tabProfDept').value.trim(),
    headquarters: newHq,
    budget_head: document.getElementById('tabProfBudget').value.trim(),
    salary: document.getElementById('tabProfSalary').value.trim(),
    controlling_officer: document.getElementById('tabProfControlling').value.trim(),
    fare_rate_per_km: fareRate || '10',
    print_format: printFormat
  };

  // Always persist locally
  try {
    localStorage.setItem('gsda_profile', JSON.stringify(updatedProf));
  } catch(e) {}

  try {
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProf)
    });
  } catch (err) {
    console.warn('Backend profile save offline:', err);
  }

  appState.profile = updatedProf;
  if (appState.monthData && appState.monthData.entries) {
    appState.monthData.entries.forEach(e => {
      if (isHeadquartersLocation(e.from_loc)) {
        e.from_loc = newHq;
      }
    });
    saveLocalDraft();
  }

  updateProfileDisplay(updatedProf);
  showToast('अधिकारी प्रोफाइल यशस्वीरीत्या सेव्ह झाले!');
  renderEntriesTable();
  renderMobileCards();
  renderPrintView();
}
window.saveTabProfile = saveTabProfile;

// JSON Data Backup & Restore for Tab Profile
async function exportDataJson() {
  try {
    showToast('संपूर्ण बॅकअप तयार होत आहे...');
    let exportPayload = null;
    try {
      const res = await fetch('/api/backup/export');
      const json = await res.json();
      if (json && json.success && json.backup) {
        exportPayload = json.backup;
      }
    } catch (e) {
      console.warn('API backup export fallback:', e);
    }

    if (!exportPayload) {
      exportPayload = {
        app: 'GSDA_DIARY_PRO',
        export_date: new Date().toISOString(),
        profile: appState.profile,
        currentSheetName: appState.currentSheetName,
        monthData: appState.monthData,
        sheets: appState.sheets
      };
    }

    const mKey = (appState.monthData && appState.monthData.year && appState.monthData.month) ? 
      `${appState.monthData.year}-${String(appState.monthData.month).padStart(2, '0')}` : 
      new Date().toISOString().slice(0, 7);
    const defaultFilename = `GSDA_Diary_Full_Backup_${mKey}.json`;

    // 1. Try Native Windows Save As dialog first (Desktop App)
    try {
      const nativeRes = await fetch('/api/backup/save_native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: defaultFilename, content: exportPayload })
      });
      const nativeData = await nativeRes.json();
      if (nativeData && nativeData.success) {
        showToast(nativeData.message || `बॅकअप यशस्वीरीत्या सेव्ह झाला: ${nativeData.filename}`, 'success');
        return;
      } else if (nativeData && nativeData.cancelled) {
        showToast('बॅकअप सेव्ह करणे रद्द केले.', 'warning');
        return;
      }
    } catch (e) {
      console.warn('Native Save As not available, falling back to browser download:', e);
    }

    // 2. Fallback: Blob URL download for standard web browser
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', blobUrl);
    dlAnchorElem.setAttribute('download', defaultFilename);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
      if (dlAnchorElem.parentNode) dlAnchorElem.parentNode.removeChild(dlAnchorElem);
    }, 1000);
    showToast('सर्व महिन्यांचा संपूर्ण बॅकअप (.json) डाऊनलोड झाला!');
  } catch (err) {
    alert('बॅकअप डाऊनलोड करताना त्रुटी आली: ' + err.message);
  }
}
window.exportDataJson = exportDataJson;

function handleTabRestoreJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || (!data.profile && !data.months && !data.monthData)) {
        alert('अवैध बॅकअप फाईल स्वरूप.');
        return;
      }

      showToast('बॅकअप रिस्टोअर होत आहे, कृपया थांबा...');

      // 1. Offline persistence in localStorage
      try {
        if (data.profile) {
          localStorage.setItem('gsda_profile', JSON.stringify(data.profile));
          appState.profile = data.profile;
          updateProfileDisplay(data.profile);
          populateTabProfileFields();
        }
        if (data.sheets) {
          localStorage.setItem('gsda_sheets', JSON.stringify(data.sheets));
          appState.sheets = data.sheets;
        }
        if (data.months) {
          Object.keys(data.months).forEach(sName => {
            localStorage.setItem(`gsda_draft_${sName}`, JSON.stringify(data.months[sName]));
          });
        }
        if (data.monthData && data.currentSheetName) {
          localStorage.setItem(`gsda_draft_${data.currentSheetName}`, JSON.stringify(data.monthData));
        }
      } catch(lsErr) {
        console.warn('Local storage restore error:', lsErr);
      }

      // 2. Also try backend restore if online
      try {
        await fetch('/api/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } catch (netErr) {
        console.warn('Backend restore offline:', netErr);
      }

      await loadSheets();
      if (appState.currentSheetName) {
        await loadMonthData(appState.currentSheetName);
      } else if (appState.sheets && appState.sheets.length > 0) {
        await loadMonthData(appState.sheets[0].name);
      }
      showToast('बॅकअप डेटा यशस्वीरीत्या रिस्टोअर झाला!');
    } catch(err) {
      alert('बॅकअप रिस्टोअर त्रुटी: ' + err.message);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}
window.handleTabRestoreJson = handleTabRestoreJson;

window.switchPrintFormatDirect = async function(fmt) {
  if (!appState.profile) appState.profile = {};
  appState.profile.print_format = fmt;
  const pfRadio = document.querySelector(`input[name="profPrintFormat"][value="${fmt}"]`);
  if (pfRadio) pfRadio.checked = true;

  try {
    localStorage.setItem('gsda_profile', JSON.stringify(appState.profile));
  } catch(e) {}
  
  try {
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appState.profile)
    });
  } catch (err) {
    console.warn('Failed to auto-save profile format to backend:', err);
  }
  renderPrintView();
  showToast(fmt === '2page' ? '२ पाने सविस्तर (Varad) फॉरमॅट लागू केला!' : '१ पान कॉम्पॅक्ट फॉरमॅट लागू केला!');
};

function updateFareFormulaText(val) {
  const display = document.getElementById('fareFormulaDisplay');
  const rate = parseFloat(val) || 10;
  if (display) {
    display.textContent = `भाडे = अंतर (km) × ${rate} रु.`;
  }
}

// Save Profile Modal
async function saveProfileModal() {
  const hqEl = document.getElementById('profHeadquarters');
  let newHq = hqEl ? hqEl.value.trim() : 'सोलापूर';
  if (COMMON_DISTRICT_MAP[newHq.toLowerCase()]) {
    newHq = COMMON_DISTRICT_MAP[newHq.toLowerCase()];
  }
  
  const fareRateEl = document.getElementById('profFareRate');
  const fareRate = fareRateEl ? fareRateEl.value.trim() : '10';

  const pfInput = document.querySelector('input[name="profPrintFormat"]:checked');
  const printFormat = pfInput ? pfInput.value : '1page';

  const updatedProf = {
    name: document.getElementById('profName').value.trim(),
    designation: document.getElementById('profDesignation').value.trim(),
    department: document.getElementById('profDepartment').value.trim(),
    headquarters: newHq,
    budget_head: document.getElementById('profBudgetHead').value.trim(),
    salary: document.getElementById('profSalary').value.trim(),
    controlling_officer: document.getElementById('profControlling').value.trim(),
    fare_rate_per_km: fareRate || '10',
    print_format: printFormat
  };

  // Always save locally
  try {
    localStorage.setItem('gsda_profile', JSON.stringify(updatedProf));
  } catch(e) {}

  try {
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProf)
    });
  } catch (err) {
    console.warn('Backend profile save offline:', err);
  }

  appState.profile = updatedProf;
  
  // Update all entries in active month to immediately reflect new headquarters
  if (appState.monthData && appState.monthData.entries) {
    appState.monthData.entries.forEach(e => {
      if (isHeadquartersLocation(e.from_loc)) {
        e.from_loc = newHq;
      }
    });
    saveLocalDraft();
  }
  
  updateProfileDisplay(updatedProf);
  hideModal('profileModal');
  showToast('अधिकारी प्रोफाइल यशस्वीरीत्या सेव्ह झाले!');
  renderEntriesTable();
  renderMobileCards();
  renderPrintView();
}

// Open Entry Modal
function openEntryModal(idx) {
  document.getElementById('entryIndex').value = idx;
  
  if (idx >= 0 && appState.monthData && appState.monthData.entries && appState.monthData.entries[idx]) {
    const e = appState.monthData.entries[idx];
    document.getElementById('modalTitle').textContent = `नोंद संपादन: ${e.date || ''}`;
    document.getElementById('entryDate').value = e.date || '';
    document.getElementById('entryTravelMode').value = formatTravelMode(e.travel_mode);
    document.getElementById('entryFrom').value = e.from_loc || '';
    document.getElementById('entryFromTime').value = e.from_time || '';
    document.getElementById('entryTo').value = e.to_loc || '';
    document.getElementById('entryToTime').value = e.to_time || '';
    document.getElementById('entryDistance').value = e.distance_km || '';
    document.getElementById('entryFare').value = e.travel_fare || '';
    document.getElementById('entryWorkDetail').value = e.work_detail || '';
    const notesEl = document.getElementById('entryNotes');
    if (notesEl) notesEl.value = e.notes || '';
    
    document.getElementById('chkTotal').checked = (e.total == '1' || e.total == 1);
    document.getElementById('chkHoliday').checked = (e.holiday == '1' || e.holiday == 1);
    document.getElementById('chkLeave').checked = (e.leave == '1' || e.leave == 1);
    document.getElementById('chkTour').checked = (e.tour == '1' || e.tour == 1);
    document.getElementById('chkMeeting').checked = (e.meeting == '1' || e.meeting == 1);
    document.getElementById('chkTraining').checked = (e.training == '1' || e.training == 1);
    
    document.getElementById('entryWells').value = e.wells || '';
    document.getElementById('entryBorewells').value = e.borewells || '';
    populateDesktopSchemeSelect(e.scheme || '');
    document.getElementById('entryVillages').value = e.villages || '';
    document.getElementById('entryCases').value = e.cases || '';

    // Load return journey fields
    const container2 = document.getElementById('returnJourneyContainerDesktop');
    const btn2 = document.getElementById('btnToggleReturnDesktop');
    const hasReturn = !!(e.from_loc2 || e.to_loc2 || e.distance_km2 || (e.travel_mode2 && e.travel_mode2 !== '-'));
    if (hasReturn) {
      if (container2) container2.style.display = 'block';
      if (btn2) btn2.innerHTML = '<i class="fa-solid fa-angle-up mr-1"></i><span>परतीचा प्रवास तपशील लपवा</span>';
    } else {
      if (container2) container2.style.display = 'none';
      if (btn2) btn2.innerHTML = '<i class="fa-solid fa-route mr-1"></i><span>+ Add Return / Multi Journey (परतीचा / दुसरा प्रवास जोडा)</span>';
    }
    document.getElementById('entryTravelMode2').value = e.travel_mode2 || '-';
    document.getElementById('entryFrom2').value = e.from_loc2 || '';
    document.getElementById('entryFromTime2').value = e.from_time2 || '';
    document.getElementById('entryTo2').value = e.to_loc2 || '';
    document.getElementById('entryToTime2').value = e.to_time2 || '';
    document.getElementById('entryDistance2').value = e.distance_km2 || '';
    document.getElementById('entryFare2').value = e.travel_fare2 || '';

    document.getElementById('btnDeleteEntry').classList.remove('hidden');
  } else {
    document.getElementById('modalTitle').textContent = 'नवीन दैनिक नोंद जोडा';
    document.getElementById('entryDate').value = '';
    document.getElementById('entryTravelMode').value = '-';
    document.getElementById('entryFrom').value = (appState.profile && appState.profile.headquarters) || 'सोलापूर';
    document.getElementById('entryFromTime').value = '-';
    document.getElementById('entryTo').value = '-';
    document.getElementById('entryToTime').value = '-';
    document.getElementById('entryDistance').value = '-';
    document.getElementById('entryFare').value = '-';
    clearAndHideReturnDesktop();
    document.getElementById('entryWorkDetail').value = 'कार्यालयात उपस्थित, कार्यालयीन कामकाज केले.';
    const notesEl = document.getElementById('entryNotes');
    if (notesEl) notesEl.value = '';
    
    document.getElementById('chkTotal').checked = true;
    document.getElementById('chkHoliday').checked = false;
    document.getElementById('chkLeave').checked = false;
    document.getElementById('chkTour').checked = false;
    document.getElementById('chkMeeting').checked = false;
    document.getElementById('chkTraining').checked = false;
    
    document.getElementById('entryWells').value = '';
    document.getElementById('entryBorewells').value = '';
    populateDesktopSchemeSelect('');
    document.getElementById('entryVillages').value = '';
    document.getElementById('entryCases').value = '';

    document.getElementById('btnDeleteEntry').classList.add('hidden');
  }
  
  renderQuickRoutes();
  showModal('entryModal');
}

// Save Entry Modal
function saveEntryModal() {
  validateVillagesAndWells();
  
  const idx = parseInt(document.getElementById('entryIndex').value, 10);
  const entryObj = {
    date: document.getElementById('entryDate').value,
    travel_mode: document.getElementById('entryTravelMode').value,
    from_loc: document.getElementById('entryFrom').value,
    from_time: document.getElementById('entryFromTime').value,
    to_loc: document.getElementById('entryTo').value,
    to_time: document.getElementById('entryToTime').value,
    distance_km: document.getElementById('entryDistance').value,
    travel_fare: document.getElementById('entryFare').value,

    // Return journey fields
    travel_mode2: document.getElementById('entryTravelMode2').value,
    from_loc2: (document.getElementById('entryFrom2').value || '').trim(),
    from_time2: (document.getElementById('entryFromTime2').value || '').trim(),
    to_loc2: (document.getElementById('entryTo2').value || '').trim(),
    to_time2: (document.getElementById('entryToTime2').value || '').trim(),
    distance_km2: (document.getElementById('entryDistance2').value || '').trim(),
    travel_fare2: (document.getElementById('entryFare2').value || '').trim(),

    work_detail: document.getElementById('entryWorkDetail').value,
    notes: (document.getElementById('entryNotes') ? document.getElementById('entryNotes').value : '').trim(),
    total: document.getElementById('chkTotal').checked ? '1' : '',
    holiday: document.getElementById('chkHoliday').checked ? '1' : '',
    leave: document.getElementById('chkLeave').checked ? '1' : '',
    tour: document.getElementById('chkTour').checked ? '1' : '',
    meeting: document.getElementById('chkMeeting').checked ? '1' : '',
    training: document.getElementById('chkTraining').checked ? '1' : '',
    wells: document.getElementById('entryWells').value,
    borewells: document.getElementById('entryBorewells').value,
    scheme: document.getElementById('entryScheme').value,
    villages: document.getElementById('entryVillages').value,
    cases: document.getElementById('entryCases').value,
  };

  if (idx >= 0) {
    appState.monthData.entries[idx] = { ...appState.monthData.entries[idx], ...entryObj };
  } else {
    appState.monthData.entries.push(entryObj);
  }

  hideModal('entryModal');
  recalculateMonthlySummary();
  renderActiveMonth();
  saveLocalDraft();
  autoSaveMonthToBackend();
  showToast('नोंद अद्ययावत केली व Excel मध्ये आपोआप जतन झाली!');
}

// Delete Entry
function deleteEntry(idx) {
  if (confirm('आपण ही नोंद नक्की हटवू इच्छिता?')) {
    appState.monthData.entries.splice(idx, 1);
    recalculateMonthlySummary();
    renderActiveMonth();
    saveLocalDraft();
    autoSaveMonthToBackend();
    showToast('नोंद हटवली व Excel मध्ये जतन झाली.');
  }
}

function deleteCurrentModalEntry() {
  const idx = parseInt(document.getElementById('entryIndex').value, 10);
  if (idx >= 0) {
    deleteEntry(idx);
    hideModal('entryModal');
  }
}

// Batch Fill Dates
function applyBatchFill() {
  const start = document.getElementById('batchStartDate').value;
  const end = document.getElementById('batchEndDate').value;
  const work = document.getElementById('batchWorkDetail').value;
  const cat = document.getElementById('batchCategory').value;

  if (!start || !end) {
    alert('कृपया प्रारंभ आणि अंतिम दिनांक निवडा.');
    return;
  }

  let count = 0;
  appState.monthData.entries.forEach(e => {
    if (e.date && e.date >= start && e.date <= end) {
      count++;
      if (work) e.work_detail = work;
      e.total = '1';
      e.holiday = (cat === 'holiday') ? '1' : '';
      e.tour = (cat === 'tour') ? '1' : '';
      e.meeting = (cat === 'meeting') ? '1' : '';
      e.leave = (cat === 'leave') ? '1' : '';
    }
  });

  hideModal('batchModal');
  recalculateMonthlySummary();
  renderActiveMonth();
  saveLocalDraft();
  autoSaveMonthToBackend();
  showToast(`${count} दिवसांसाठी सामूहिक नोंद लागू केली!`);
}

// Create New Month Sheet
async function submitNewMonth() {
  const year = document.getElementById('newMonthYear').value;
  const month = document.getElementById('newMonthNumber').value;
  const submitBtn = document.getElementById('btnSubmitNewMonth');
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'तयार होत आहे...';

  const monthNamesEn = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthNamesMr = ['', 'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'];
  const yrShort = String(year).slice(-2);
  const targetSheetName = `${monthNamesEn[parseInt(month, 10)]} ${yrShort}`;
  const targetTitle = `${monthNamesMr[parseInt(month, 10)]} ${year}`;

  let createdViaBackend = false;
  try {
    const res = await fetch('/api/month/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: parseInt(year, 10), month: parseInt(month, 10) })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        createdViaBackend = true;
        hideModal('newMonthModal');
        showToast(data.message);
        await loadSheets();
        monthSelect.value = data.sheet_name;
        await loadMonthData(data.sheet_name);
      }
    }
  } catch (err) {
    console.warn('Backend month create unavailable, checking offline:', err);
  }

  if (!createdViaBackend) {
    // Check if sheet already exists
    const existing = (appState.sheets || []).find(s => s.name === targetSheetName);
    if (!existing) {
      const newSheetObj = { name: targetSheetName, title: targetTitle, is_driver: false };
      if (!appState.sheets) appState.sheets = [];
      appState.sheets.push(newSheetObj);
      try { localStorage.setItem('gsda_sheets', JSON.stringify(appState.sheets)); } catch(e){}
      populateMonthDropdown(appState.sheets);
    }

    // Check if draft already exists; if not, generate empty month template for offline use
    let draftStr = localStorage.getItem(`gsda_draft_${targetSheetName}`);
    if (!draftStr) {
      const yNum = parseInt(year, 10);
      const mNum = parseInt(month, 10);
      const numDays = new Date(yNum, mNum, 0).getDate();
      const marathiDays = ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
      const entries = [];
      const hq = (appState.profile && appState.profile.headquarters) || 'सोलापूर';
      for (let d = 1; d <= numDays; d++) {
        const dateObj = new Date(yNum, mNum - 1, d);
        const dayName = marathiDays[dateObj.getDay()];
        const dateStr = `${yNum}-${String(mNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isSunday = dateObj.getDay() === 0;
        entries.push({
          row_index: 4 + d,
          date: dateStr,
          day: dayName,
          weekday_marathi: dayName,
          from_loc: hq,
          from_time: '-',
          to_loc: '-',
          to_time: '-',
          travel_mode: '-',
          distance_km: '-',
          travel_fare: '-',
          work_detail: isSunday ? 'रविवार - साप्ताहिक सुट्टी' : 'कार्यालयात उपस्थित, कार्यालयीन कामकाज केले.',
          total: '1',
          holiday: isSunday ? '1' : '',
          leave: '',
          tour: '',
          meeting: '',
          training: '',
          wells: '',
          borewells: '',
          scheme: '',
          villages: '',
          cases: '',
          travel_mode2: '',
          from_loc2: '',
          from_time2: '',
          to_loc2: '',
          to_time2: '',
          distance_km2: '',
          travel_fare2: ''
        });
      }
      const newMonthData = {
        sheet_name: targetSheetName,
        title: targetTitle,
        submission_date: '',
        entries: entries,
        field_progress: (appState.constants ? appState.constants.standard_schemes : []).map((s, idx) => ({
          scheme: s,
          villages: '-',
          cases: '-',
          row_index: 37 + idx
        })),
        summary: {
          total_days: numDays,
          office_days: numDays,
          tour_days: 0,
          holiday_days: 0,
          meeting_days: 0,
          leave_days: 0,
          training_days: 0,
          total_wells: 0,
          total_borewells: 0,
          total_travel_km: 0
        }
      };
      try { localStorage.setItem(`gsda_draft_${targetSheetName}`, JSON.stringify(newMonthData)); } catch(e){}
    }

    hideModal('newMonthModal');
    monthSelect.value = targetSheetName;
    await loadMonthData(targetSheetName);
    showToast(`${targetTitle} महिना तयार केला!`);
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'तयार करा';
}

// Save Full Month to Excel File
async function saveAllToExcel() {
  if (!appState.monthData || !appState.currentSheetName) return;

  const btn = document.getElementById('btnSaveExcel');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i>`;
  btn.disabled = true;

  // Capture submission date
  const dateInput = document.getElementById('printBottomDateInput');
  if (dateInput && dateInput.value) {
    appState.monthData.submission_date = dateInput.value.trim();
  }

  saveLocalDraft();

  let savedViaBackend = false;
  try {
    const res = await fetch(`/api/month/${encodeURIComponent(appState.currentSheetName)}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appState.monthData)
    });
    if (res.ok) {
      const result = await res.json();
      if (result.success) {
        savedViaBackend = true;
        showToast('Excel मध्ये डेटा यशस्वीरीत्या जतन (Saved) झाला!');
        const pathEl = document.getElementById('savedPathDisplay');
        if (pathEl) {
          pathEl.textContent = result.file_path || 'G:\\Diary\\Diary_Blank.xlsx';
        }
        showModal('saveSuccessModal');
      }
    }
  } catch (err) {
    console.warn('Backend Excel save offline fallback:', err);
  }

  if (!savedViaBackend) {
    // Offline / GitHub fallback: save to localStorage + show modal with download options
    showToast('सर्व नोंदी व बदल ब्राऊझर मेमरीमध्ये सुरक्षित जतन झाले!');
    const pathEl = document.getElementById('savedPathDisplay');
    if (pathEl) {
      pathEl.textContent = 'ब्राउझर ऑफलाईन मेमरी (सर्व नोंदी सुरक्षित जतन आहेत)';
    }
    showModal('saveSuccessModal');
  }

  btn.innerHTML = originalHtml;
  btn.disabled = false;
}

// Save to custom folder chosen by user
async function saveToCustomFolder() {
  try {
    const defaultFileName = `GSDA_Diary_${appState.currentSheetName || 'Current'}.xlsx`;

    // 1. Try Native Windows Save As dialog first (Desktop App)
    try {
      const nativeRes = await fetch('/api/excel/save_native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: defaultFileName })
      });
      if (nativeRes.ok) {
        const nativeData = await nativeRes.json();
        if (nativeData && nativeData.success) {
          showToast(nativeData.message || `Excel फाईल सुरक्षित सेव्ह झाली: ${nativeData.filename}`, 'success');
          return;
        } else if (nativeData && nativeData.cancelled) {
          showToast('Excel सेव्ह करणे रद्द केले.', 'warning');
          return;
        }
      }
    } catch (e) {
      console.warn('Native Save As not available, falling back to browser download:', e);
    }

    // 2. Try fetching generated Excel from backend
    let blob = null;
    try {
      const response = await fetch('/api/download-excel');
      if (response.ok) {
        blob = await response.blob();
      }
    } catch (netErr) {
      console.warn('API download-excel unavailable, generating via SheetJS:', netErr);
    }

    // 3. Fallback: Client-side SheetJS generation with complete columns
    if (!blob && window.XLSX && appState.monthData && appState.monthData.entries) {
      const wb = XLSX.utils.book_new();
      const exportRows = appState.monthData.entries.map((e, idx) => ({
        'अ.क्र.': idx + 1,
        'दिनांक': e.date || '',
        'वार': e.day || e.weekday_marathi || '',
        'कुठून (प्रस्थान)': e.from_loc || '',
        'वेळ (निघाल्याची)': e.from_time || '',
        'कुठे (मुक्काम/ठिकाण)': e.to_loc || '',
        'वेळ (पोहोचल्याची)': e.to_time || '',
        'वाहनाचा प्रकार': e.travel_mode || '',
        'अंतर (कि.मी.)': e.distance_km || '',
        'प्रवास भाडे (रु.)': e.travel_fare || '',
        'कामाचा तपशील': e.work_detail || '',
        'एकूण दिवस': e.total || '',
        'सुट्टी': e.holiday || '',
        'रजा': e.leave || '',
        'दौरा': e.tour || '',
        'मुख्यालय/बैठक': e.meeting || '',
        'प्रशिक्षण': e.training || '',
        'विहिरी': e.wells || '',
        'विंधण विहिरी': e.borewells || '',
        'योजना': e.scheme || '',
        'गावे': e.villages || '',
        'प्रकरणे': e.cases || '',
        'परतीचा प्रवास प्रकार': e.travel_mode2 || '',
        'परतीचे कुठून': e.from_loc2 || '',
        'परतीची निघाल्याची वेळ': e.from_time2 || '',
        'परतीचे कुठे': e.to_loc2 || '',
        'परतीची पोहोचल्याची वेळ': e.to_time2 || '',
        'परतीचे अंतर (कि.मी.)': e.distance_km2 || '',
        'परतीचे भाडे (रु.)': e.travel_fare2 || ''
      }));
      const ws = XLSX.utils.json_to_sheet(exportRows);
      XLSX.utils.book_append_sheet(wb, ws, appState.currentSheetName || 'दैनंदिनी');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    if (!blob) {
      showToast('Excel डेटा उपलब्ध नाही.', 'error');
      return;
    }

    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultFileName,
        types: [{
          description: 'Excel Workbook (.xlsx)',
          accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      showToast('फाईल आपल्या निवडलेल्या फोल्डरमध्ये यशस्वीरीत्या सेव्ह केली!');
    } else {
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = defaultFileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 1000);
      showToast('Excel फाईल यशस्वीरीत्या डाउनलोड झाली!');
    }
  } catch (err) {
    if (err && err.name !== 'AbortError') {
      console.error('Error saving Excel:', err);
      showToast('Excel सेव्ह करताना त्रुटी: ' + err.message, 'error');
    }
  }
}

// Toast notification helper
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMsg');
  const icon = document.getElementById('toastIcon');

  msgEl.textContent = msg;
  if (type === 'error') {
    icon.className = 'fa-solid fa-circle-exclamation text-red-400 text-sm';
  } else {
    icon.className = 'fa-solid fa-circle-check text-emerald-400 text-sm';
  }

  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 4000);
}

// ==========================================
// NEW UI/UX FEATURES IMPLEMENTATION
// ==========================================

// 1. Theme (Dark Mode) & Font Zoom Management
let appZoomLevel = 100;

function initThemeAndZoom() {
  const savedDark = localStorage.getItem('gsda_dark_mode');
  const icon = document.getElementById('themeIcon');
  const themeText = document.getElementById('themeText');
  if (savedDark === 'true') {
    document.documentElement.classList.add('dark');
    if (icon) icon.className = 'fa-solid fa-sun text-yellow-300';
    if (themeText) themeText.textContent = 'लाईट मोड';
  } else {
    document.documentElement.classList.remove('dark');
    if (icon) icon.className = 'fa-solid fa-moon text-amber-300';
    if (themeText) themeText.textContent = 'डार्क मोड';
  }

  const savedZoom = localStorage.getItem('gsda_app_zoom');
  if (savedZoom) {
    appZoomLevel = parseInt(savedZoom, 10) || 100;
    document.documentElement.style.fontSize = `${appZoomLevel}%`;
  }
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('gsda_dark_mode', isDark ? 'true' : 'false');
  const icon = document.getElementById('themeIcon');
  const themeText = document.getElementById('themeText');
  if (icon) {
    icon.className = isDark ? 'fa-solid fa-sun text-yellow-300' : 'fa-solid fa-moon text-amber-300';
  }
  if (themeText) {
    themeText.textContent = isDark ? 'लाईट मोड' : 'डार्क मोड';
  }
  showToast(isDark ? 'डार्क मोड सक्रिय केला 🌙' : 'लाईट मोड सक्रिय केला ☀️');
}

function changeAppZoom(delta) {
  appZoomLevel = Math.min(130, Math.max(85, appZoomLevel + delta * 5));
  document.documentElement.style.fontSize = `${appZoomLevel}%`;
  localStorage.setItem('gsda_app_zoom', appZoomLevel);
  showToast(`फॉन्ट आकार: ${appZoomLevel}%`);
}

function resetAppZoom() {
  appZoomLevel = 100;
  document.documentElement.style.fontSize = '100%';
  localStorage.setItem('gsda_app_zoom', 100);
  showToast('फॉन्ट मूळ आकारावर रीसेट केला');
}

// 2. Offline Auto-Save to LocalStorage
function saveLocalDraft() {
  if (!appState.monthData || !appState.currentSheetName) return;
  try {
    localStorage.setItem(`gsda_draft_${appState.currentSheetName}`, JSON.stringify(appState.monthData));
    const indicator = document.getElementById('autoSaveIndicator');
    const autoSaveText = document.getElementById('autoSaveText');
    const timeStr = new Date().toLocaleTimeString('mr-IN', { hour: '2-digit', minute: '2-digit' });
    if (indicator) {
      indicator.classList.remove('hidden');
    }
    if (autoSaveText) {
      autoSaveText.textContent = `सर्व बदल आपोआप जतन (${timeStr})`;
    }
  } catch (e) {
    console.error('AutoSave error:', e);
  }
}

// Auto-save month data to backend Excel file
async function autoSaveMonthToBackend() {
  if (!appState.monthData || !appState.currentSheetName) return;
  const indicator = document.getElementById('autoSaveIndicator');
  const autoSaveText = document.getElementById('autoSaveText');
  try {
    const res = await fetch(`/api/month/${encodeURIComponent(appState.currentSheetName)}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appState.monthData)
    });
    if (!res.ok) {
      // Offline / GitHub static mode - silent fallback
      const timeStr = new Date().toLocaleTimeString('mr-IN', { hour: '2-digit', minute: '2-digit' });
      if (indicator) indicator.classList.remove('hidden');
      if (autoSaveText) {
        autoSaveText.textContent = `सर्व बदल आपोआप जतन (${timeStr})`;
        autoSaveText.classList.remove('text-red-500');
      }
      return;
    }
    const result = await res.json();
    if (result.success) {
      console.log('Background Excel save successful.');
      const timeStr = new Date().toLocaleTimeString('mr-IN', { hour: '2-digit', minute: '2-digit' });
      if (indicator) indicator.classList.remove('hidden');
      if (autoSaveText) {
        autoSaveText.textContent = `Excel मध्ये आपोआप जतन (${timeStr})`;
        autoSaveText.classList.remove('text-red-500');
      }
    } else {
      if (indicator) indicator.classList.remove('hidden');
      if (autoSaveText) {
        autoSaveText.textContent = '⚠️ Excel जतन अयशस्वी (Excel बंद करा)';
        autoSaveText.classList.add('text-red-500');
      }
      showToast(result.error || 'Excel मध्ये जतन करता आले नाही!', 'error');
    }
  } catch (err) {
    console.warn('Background auto-save failed (offline/static mode):', err);
    const timeStr = new Date().toLocaleTimeString('mr-IN', { hour: '2-digit', minute: '2-digit' });
    if (indicator) indicator.classList.remove('hidden');
    if (autoSaveText) {
      autoSaveText.textContent = `बदल सुरक्षित जतन (${timeStr})`;
      autoSaveText.classList.remove('text-red-500');
    }
  }
}

// 3. Marathi Voice Typing (Google Web Speech API mr-IN)
let speechRec = null;
let isListening = false;

function toggleVoiceTyping() {
  const SpeechRecClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecClass) {
    alert('आपल्या ब्राऊझरमध्ये व्हॉईस टायपिंग उपलब्ध नाही. कृपया Google Chrome ब्राऊझर वापरा.');
    return;
  }

  const btn = document.getElementById('btnVoiceTyping');
  const statusTxt = document.getElementById('voiceStatusText');
  const textarea = document.getElementById('entryWorkDetail');

  if (isListening && speechRec) {
    speechRec.stop();
    isListening = false;
    if (btn) btn.className = 'px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer shadow-2xs';
    if (statusTxt) statusTxt.textContent = 'मराठी बोला (Voice Type)';
    return;
  }

  speechRec = new SpeechRecClass();
  speechRec.lang = 'mr-IN';
  speechRec.continuous = false;
  speechRec.interimResults = false;

  speechRec.onstart = () => {
    isListening = true;
    if (btn) btn.className = 'px-2 py-0.5 bg-red-600 text-white border border-red-700 rounded-lg text-xs font-bold inline-flex items-center gap-1 animate-pulse shadow-md';
    if (statusTxt) statusTxt.textContent = '🎙️ ऐकत आहे... बोला';
    showToast('मराठीत बोला... 🎙️');
  };

  speechRec.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (transcript && textarea) {
      const cur = textarea.value.trim();
      textarea.value = cur ? `${cur} ${transcript}` : transcript;
      showToast(`शब्द जोडले: "${transcript}"`);
    }
  };

  speechRec.onerror = (e) => {
    console.error('Speech error:', e);
    isListening = false;
    if (btn) btn.className = 'px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer shadow-2xs';
    if (statusTxt) statusTxt.textContent = 'मराठी बोला (Voice Type)';
    showToast('माईक एरर: ' + e.error, 'error');
  };

  speechRec.onend = () => {
    isListening = false;
    if (btn) btn.className = 'px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer shadow-2xs';
    if (statusTxt) statusTxt.textContent = 'मराठी बोला (Voice Type)';
  };

  try {
    speechRec.start();
  } catch (err) {
    console.error(err);
  }
}

// Dedicated Voice Typing for Notes / Meeting Minutes
let notesSpeechRec = null;
let isListeningNotes = false;

function toggleVoiceForNotes() {
  const SpeechRecClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecClass) {
    alert('आपल्या ब्राऊझरमध्ये व्हॉईस टायपिंग उपलब्ध नाही. कृपया Google Chrome ब्राऊझर वापरा.');
    return;
  }

  const btn = document.getElementById('btnVoiceNotes');
  const statusTxt = document.getElementById('voiceNotesStatus');
  const textarea = document.getElementById('entryNotes');

  if (isListeningNotes && notesSpeechRec) {
    notesSpeechRec.stop();
    isListeningNotes = false;
    if (btn) btn.className = 'px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 rounded text-[10.5px] font-bold inline-flex items-center gap-1 transition active:scale-95 cursor-pointer';
    if (statusTxt) statusTxt.textContent = 'मुद्दे बोला';
    return;
  }

  notesSpeechRec = new SpeechRecClass();
  notesSpeechRec.lang = 'mr-IN';
  notesSpeechRec.continuous = false;
  notesSpeechRec.interimResults = false;

  notesSpeechRec.onstart = () => {
    isListeningNotes = true;
    if (btn) btn.className = 'px-2 py-0.5 bg-rose-600 text-white border border-rose-700 rounded text-[10.5px] font-bold inline-flex items-center gap-1 animate-pulse shadow-md';
    if (statusTxt) statusTxt.textContent = '🎙️ ऐकत आहे...';
    showToast('बैठकीचे मुद्दे मराठीत बोला... 🎙️');
  };

  notesSpeechRec.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (transcript && textarea) {
      const cur = textarea.value.trim();
      textarea.value = cur ? `${cur}\n• ${transcript}` : `• ${transcript}`;
      showToast(`नोंद जोडली: "${transcript}"`);
    }
  };

  notesSpeechRec.onerror = (e) => {
    console.error('Notes Speech error:', e);
    isListeningNotes = false;
    if (btn) btn.className = 'px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 rounded text-[10.5px] font-bold inline-flex items-center gap-1 transition active:scale-95 cursor-pointer';
    if (statusTxt) statusTxt.textContent = 'मुद्दे बोला';
    showToast('व्हॉईस टायपिंग त्रुटी किंवा मायक्रोफोन बंद आहे.');
  };

  notesSpeechRec.onend = () => {
    isListeningNotes = false;
    if (btn) btn.className = 'px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 rounded text-[10.5px] font-bold inline-flex items-center gap-1 transition active:scale-95 cursor-pointer';
    if (statusTxt) statusTxt.textContent = 'मुद्दे बोला';
  };

  try {
    notesSpeechRec.start();
  } catch (err) {
    console.error(err);
  }
}

// Download Single Day Notes as .txt
function downloadSingleDayNotes() {
  const dateVal = document.getElementById('entryDate').value || 'दैनिक';
  const notesVal = (document.getElementById('entryNotes').value || '').trim();
  const workVal = (document.getElementById('entryWorkDetail').value || '').trim();
  const prof = appState.profile || {};

  if (!notesVal && !workVal) {
    alert('या दिवसासाठी कोणतीही टिपणी किंवा कामाचा तपशील नोंदवला नाही.');
    return;
  }

  const content = `=======================================================
भूजल सर्वेक्षण आणि विकास यंत्रणा (GSDA) - दैनिक टिपणी
=======================================================
अधिकारी नाव  : ${prof.name || 'श्री विनायक नवनाथ निंबाळकर'}
पदनाम        : ${prof.designation || 'सहाय्यक भूवैज्ञानिक'}
मुख्यालय     : ${prof.headquarters || 'सोलापूर'}
दिनांक        : ${dateVal}
कामाचा तपशील : ${workVal || '-'}
-------------------------------------------------------
बैठकीतील महत्त्वाचे मुद्दे व स्वतंत्र टिपणी (Meeting Notes & Remarks):
-------------------------------------------------------
${notesVal || '(कोणतीही अतिरिक्त टिपणी नाही)'}
=======================================================
(टीप: ही टिपणी १-पान मुख्य अधिकृत प्रपत्रापासून १००% स्वतंत्र आहे.)
`;

  const blob = new Blob(["\uFEFF" + content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeDate = dateVal.replace(/[\/\\:]/g, '-');
  a.download = `दैनिक_टिपणी_${safeDate}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`दिनांक ${dateVal} ची टिपणी .txt फाईलमध्ये डाउनलोड झाली!`);
}

// Download Month's All Notes as .txt
async function downloadMonthNotes() {
  const sheet = appState.currentSheetName;
  if (!sheet) {
    alert('कृपया प्रथम महिना निवडा.');
    return;
  }

  // Try API route first
  try {
    const res = await fetch(`/api/month/${encodeURIComponent(sheet)}/download-notes`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `मासिक_टिपणी_${sheet}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`माहे ${sheet} ची सर्व टिपणी .txt फाईल डाउनलोड झाली!`);
      return;
    }
  } catch (err) {
    console.warn('API download-notes fallback to client-side:', err);
  }

  // Client-side fallback
  const prof = appState.profile || {};
  let content = `======================================================================
भूजल सर्वेक्षण आणि विकास यंत्रणा (GSDA) - मासिक बैठका व दैनिक टिपणी नोंदवही
======================================================================
अधिकारी नाव  : ${prof.name || 'श्री विनायक नवनाथ निंबाळकर'}
पदनाम        : ${prof.designation || 'सहाय्यक भूवैज्ञानिक'}
मुख्यालय     : ${prof.headquarters || 'सोलापूर'}
कार्यालय     : ${prof.department || 'भूजल सर्वेक्षण आणि विकास यंत्रणा, सोलापूर'}
महिना / वर्ष : ${sheet}
======================================================================

`;

  const entries = (appState.monthData && appState.monthData.entries) || [];
  let notesCount = 0;

  entries.forEach((e, idx) => {
    if ((e.notes && e.notes.trim()) || (e.work_detail && e.work_detail.trim())) {
      notesCount++;
      content += `[अ.क्र. ${idx + 1}] दिनांक: ${e.date || '-'} | ठिकाण: ${e.from_loc || '-'} ते ${e.to_loc || '-'}\n`;
      content += `कामकाज/दौरा : ${e.work_detail || '-'}\n`;
      if (e.notes && e.notes.trim()) {
        content += `बैठक टिपणी/मुद्दे:\n${e.notes.trim()}\n`;
      }
      content += `----------------------------------------------------------------------\n`;
    }
  });

  if (notesCount === 0) {
    content += `या महिन्यामध्ये कोणतीही स्वतंत्र टिपणी नोंदवलेली नाही.\n`;
  } else {
    content += `एकूण टिपण्या / नोंदी: ${notesCount}\n`;
  }
  content += `\n(टीप: ही टिपणी अधिकृत १-पान A4 प्रपत्रात समाविष्ट केली जात नाही, स्वतंत्र सुरक्षित ठेवली जाते.)\n`;

  const blob = new Blob(["\uFEFF" + content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `मासिक_टिपणी_${sheet}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`माहे ${sheet} ची टिपणी (.txt) फाईल डाउनलोड झाली!`);
}

// 4. Clone Previous Day / Routine Entry
function copyPreviousDayEntry() {
  const idx = parseInt(document.getElementById('entryIndex').value, 10);
  const entries = (appState.monthData && appState.monthData.entries) || [];
  
  let target = null;
  if (idx > 0 && entries[idx - 1]) {
    target = entries[idx - 1];
  } else if (idx === -1 && entries.length > 0) {
    target = entries[entries.length - 1];
  } else {
    for (let i = (idx > 0 ? idx - 1 : entries.length - 1); i >= 0; i--) {
      if (entries[i] && entries[i].work_detail && entries[i].work_detail !== '-') {
        target = entries[i];
        break;
      }
    }
  }

  if (!target) {
    showToast('कॉपी करण्यासाठी कोणतीही मागील नोंद सापडली नाही.', 'error');
    return;
  }

  document.getElementById('entryTravelMode').value = formatTravelMode(target.travel_mode);
  document.getElementById('entryFrom').value = target.from_loc || '';
  document.getElementById('entryFromTime').value = target.from_time || '';
  document.getElementById('entryTo').value = target.to_loc || '';
  document.getElementById('entryToTime').value = target.to_time || '';
  document.getElementById('entryDistance').value = target.distance_km || '';
  document.getElementById('entryFare').value = target.travel_fare || '';
  document.getElementById('entryWorkDetail').value = target.work_detail || '';

  document.getElementById('chkTotal').checked = (target.total == '1' || target.total == 1);
  document.getElementById('chkHoliday').checked = (target.holiday == '1' || target.holiday == 1);
  document.getElementById('chkLeave').checked = (target.leave == '1' || target.leave == 1);
  document.getElementById('chkTour').checked = (target.tour == '1' || target.tour == 1);
  document.getElementById('chkMeeting').checked = (target.meeting == '1' || target.meeting == 1);
  document.getElementById('chkTraining').checked = (target.training == '1' || target.training == 1);

  document.getElementById('entryWells').value = target.wells || '';
  document.getElementById('entryBorewells').value = target.borewells || '';
  document.getElementById('entryScheme').value = target.scheme || '';
  document.getElementById('entryVillages').value = target.villages || '';
  document.getElementById('entryCases').value = target.cases || '';

  showToast('मागील दिवसाची नोंद यशस्वीरीत्या कॉपी केली!');
}

// 5. Quick Duty Status Chips
function applyQuickStatus(type) {
  const hq = getActiveHQ();
  const mode = document.getElementById('entryTravelMode');
  const fromLoc = document.getElementById('entryFrom');
  const fromTime = document.getElementById('entryFromTime');
  const toLoc = document.getElementById('entryTo');
  const toTime = document.getElementById('entryToTime');
  const dist = document.getElementById('entryDistance');
  const fare = document.getElementById('entryFare');
  const work = document.getElementById('entryWorkDetail');

  const chkTotal = document.getElementById('chkTotal');
  const chkHoliday = document.getElementById('chkHoliday');
  const chkLeave = document.getElementById('chkLeave');
  const chkTour = document.getElementById('chkTour');
  const chkMeeting = document.getElementById('chkMeeting');
  const chkTraining = document.getElementById('chkTraining');

  chkTotal.checked = true;
  chkHoliday.checked = false;
  chkLeave.checked = false;
  chkTour.checked = false;
  chkMeeting.checked = false;
  chkTraining.checked = false;

  if (type === 'office') {
    mode.value = '-';
    fromLoc.value = hq;
    fromTime.value = '-';
    toLoc.value = '-';
    toTime.value = '-';
    dist.value = '-';
    fare.value = '-';
    work.value = 'मुख्यालयात उपस्थित, कार्यालयीन दैनंदिन कामकाज व पत्रव्यवहार.';
    showToast('मुख्यालयीन कामकाज स्थिती निवडली!');
  } else if (type === 'tour') {
    mode.value = 'खाजगी वाहन';
    fromLoc.value = hq;
    fromTime.value = '10.00';
    toLoc.value = '';
    toTime.value = '17.30';
    dist.value = '';
    fare.value = '';
    work.value = 'क्षेत्रीय पाहणी व भूजल सर्वेक्षण दौरा.';
    chkTour.checked = true;
    toLoc.focus();
    showToast('क्षेत्रीय दौरा स्थिती निवडली! कोठे व अंतर भरा.');
  } else if (type === 'holiday_weekly') {
    mode.value = '-';
    fromLoc.value = '-';
    fromTime.value = '-';
    toLoc.value = '-';
    toTime.value = '-';
    dist.value = '-';
    fare.value = '-';
    work.value = 'साप्ताहिक सुट्टी.';
    chkHoliday.checked = true;
    showToast('साप्ताहिक सुट्टी चिन्हांकित केली!');
  } else if (type === 'holiday_govt') {
    mode.value = '-';
    fromLoc.value = '-';
    fromTime.value = '-';
    toLoc.value = '-';
    toTime.value = '-';
    dist.value = '-';
    fare.value = '-';
    work.value = 'सार्वजनिक शासकीय सुट्टी.';
    chkHoliday.checked = true;
    showToast('शासकीय सुट्टी चिन्हांकित केली!');
  } else if (type === 'leave') {
    mode.value = '-';
    fromLoc.value = '-';
    fromTime.value = '-';
    toLoc.value = '-';
    toTime.value = '-';
    dist.value = '-';
    fare.value = '-';
    work.value = 'आकस्मिक रजा (CL) / अर्जित रजा.';
    chkLeave.checked = true;
    showToast('रजा चिन्हांकित केली!');
  } else if (type === 'meeting') {
    mode.value = '-';
    fromLoc.value = hq;
    fromTime.value = '11.00';
    toLoc.value = 'जिल्हाधिकारी कार्यालय';
    toTime.value = '17.00';
    dist.value = '-';
    fare.value = '-';
    work.value = 'जिल्हाधिकारी कार्यालय / जिल्हा परिषद आढावा बैठक उपस्थिती.';
    chkMeeting.checked = true;
    showToast('बैठक उपस्थिती चिन्हांकित केली!');
  }
}

// 6. Popular Routes & Distance / Fare Suggestions
const POPULAR_ROUTES = {
  'solapur': [
    { name: 'पंढरपूर', km: 72 },
    { name: 'बार्शी', km: 70 },
    { name: 'अक्कलकोट', km: 40 },
    { name: 'माढा', km: 75 },
    { name: 'सांगोला', km: 100 },
    { name: 'मोहोळ', km: 35 },
    { name: 'करमाळा', km: 120 }
  ],
  'latur': [
    { name: 'औसा', km: 22 },
    { name: 'रेणापूर', km: 25 },
    { name: 'अहमदपूर', km: 55 },
    { name: 'निलंगा', km: 45 },
    { name: 'उदगीर', km: 65 },
    { name: 'चाकूर', km: 35 },
    { name: 'शिरूर अनंतपाळ', km: 32 }
  ]
};

function renderQuickRoutes() {
  const container = document.getElementById('quickRouteChips');
  if (!container) return;
  container.innerHTML = '';
  
  const hq = (getActiveHQ() || '').toLowerCase();
  const routes = (hq.includes('lat') || hq.includes('लातूर')) ? POPULAR_ROUTES['latur'] : POPULAR_ROUTES['solapur'];
  
  routes.forEach(r => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'px-1.5 py-0.5 bg-white hover:bg-blue-50 text-blue-900 border border-slate-300 rounded text-[10px] font-semibold transition active:scale-95 cursor-pointer';
    btn.textContent = `${r.name} (${r.km}k)`;
    btn.onclick = () => {
      document.getElementById('entryTo').value = r.name;
      document.getElementById('entryDistance').value = r.km;
      const mode = document.getElementById('entryTravelMode');
      if (mode.value === '-' || !mode.value) {
        mode.value = 'खाजगी वाहन';
      }
      autoCalculateFare(true);
      showToast(`${r.name} (${r.km} कि.मी.) निवडले!`);
    };
    container.appendChild(btn);
  });
}

function onTravelModeChangeDesktop(val, fareInputId, distInputId) {
  const fareEl = document.getElementById(fareInputId);
  if (!fareEl) return;
  if (val === 'शासकीय वाहन') {
    fareEl.value = '0';
  } else if (val === 'खाजगी वाहन') {
    if (distInputId === 'entryDistance2') {
      calculateReturnDesktopFare(true);
    } else {
      autoCalculateFare(true);
    }
  } else if (val === '-') {
    fareEl.value = '-';
  }
}

function toggleReturnJourneyDesktop() {
  const container = document.getElementById('returnJourneyContainerDesktop');
  const btn = document.getElementById('btnToggleReturnDesktop');
  if (!container) return;
  if (container.style.display === 'none' || !container.style.display) {
    container.style.display = 'block';
    if (btn) btn.innerHTML = '<i class="fa-solid fa-angle-up mr-1"></i><span>परतीचा प्रवास तपशील लपवा</span>';
    
    // Auto populate return journey defaults
    const to1 = document.getElementById('entryTo').value;
    const from1 = document.getElementById('entryFrom').value;
    const mode1 = document.getElementById('entryTravelMode').value;
    const dist1 = document.getElementById('entryDistance').value;

    const from2 = document.getElementById('entryFrom2');
    const to2 = document.getElementById('entryTo2');
    const mode2 = document.getElementById('entryTravelMode2');
    const dist2 = document.getElementById('entryDistance2');
    const fare2 = document.getElementById('entryFare2');

    if (from2 && !from2.value && to1 && to1 !== '-') from2.value = to1;
    if (to2 && !to2.value && from1 && from1 !== '-') to2.value = from1;
    if (mode2 && (mode2.value === '-' || !mode2.value)) {
      mode2.value = mode1 || 'शासकीय वाहन';
    }
    if (dist2 && (!dist2.value || dist2.value === '-') && dist1 && dist1 !== '-') dist2.value = dist1;
    if (mode2 && mode2.value === 'शासकीय वाहन') {
      if (fare2) fare2.value = '0';
    } else {
      calculateReturnDesktopFare(false);
    }
  } else {
    container.style.display = 'none';
    if (btn) btn.innerHTML = '<i class="fa-solid fa-route mr-1"></i><span>+ Add Return / Multi Journey (परतीचा / दुसरा प्रवास जोडा)</span>';
  }
}

function clearAndHideReturnDesktop() {
  const container = document.getElementById('returnJourneyContainerDesktop');
  const btn = document.getElementById('btnToggleReturnDesktop');
  if (container) container.style.display = 'none';
  if (btn) btn.innerHTML = '<i class="fa-solid fa-route mr-1"></i><span>+ Add Return / Multi Journey (परतीचा / दुसरा प्रवास जोडा)</span>';
  const ids = ['entryTravelMode2', 'entryFrom2', 'entryFromTime2', 'entryTo2', 'entryToTime2', 'entryDistance2', 'entryFare2'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = (id === 'entryTravelMode2') ? '-' : '';
  });
}

function calculateReturnDesktopFare(force = false) {
  const distInput = document.getElementById('entryDistance2');
  const fareInput = document.getElementById('entryFare2');
  const modeSelect = document.getElementById('entryTravelMode2');
  if (!distInput || !fareInput || !modeSelect) return;

  if (modeSelect.value === 'शासकीय वाहन') {
    fareInput.value = '0';
    if (force) showToast('परतीच्या शासकीय वाहनासाठी प्रवास भाडे ० (शून्य) आहे.');
    return;
  }

  const dist = parseDistanceNumber(distInput.value);
  if (isNaN(dist) || dist <= 0) {
    if (force) showToast('कृपया परतीचे अंतर (कि.मी.) भरा!', 'warning');
    return;
  }

  if (!modeSelect.value || modeSelect.value === '-') {
    modeSelect.value = 'खाजगी वाहन';
  }

  const rate = parseFloat((appState.profile && appState.profile.fare_rate_per_km) || 10) || 10;
  const calculatedFare = Math.round(dist * rate);
  fareInput.value = calculatedFare;
  if (force) {
    showToast(`परतीचे प्रवास भाडे गणना: ₹${calculatedFare} (${dist} कि.मी. × ₹${rate}/कि.मी.)`);
  }
}

function autoCalculateFare(force = false) {
  const distInput = document.getElementById('entryDistance');
  const fareInput = document.getElementById('entryFare');
  const modeSelect = document.getElementById('entryTravelMode');
  if (!distInput || !fareInput || !modeSelect) return;

  if (modeSelect.value === 'शासकीय वाहन') {
    fareInput.value = '0';
    if (force) showToast('शासकीय वाहनासाठी प्रवास भाडे ० (शून्य) आहे.');
    return;
  }

  const dist = parseDistanceNumber(distInput.value);
  if (isNaN(dist) || dist <= 0) {
    if (force) showToast('कृपया प्रवासाचे अंतर (कि.मी.) भरा!', 'warning');
    return;
  }

  if (!modeSelect.value || modeSelect.value === '-') {
    modeSelect.value = 'खाजगी वाहन';
  }

  const rate = parseFloat((appState.profile && appState.profile.fare_rate_per_km) || 10) || 10;
  const calculatedFare = Math.round(dist * rate);
  fareInput.value = calculatedFare;
  if (force) {
    showToast(`प्रवास भाडे गणना: ₹${calculatedFare} (${dist} कि.मी. × ₹${rate}/कि.मी.)`);
  }
}

// 7. Check 1-Page A4 Height Fit
function checkPageFit() {
  const printDoc = document.getElementById('printDocument');
  const badge = document.getElementById('fitToPageBadge');
  if (!printDoc || !badge) return;

  const height = printDoc.scrollHeight;
  if (height <= 1190) {
    badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold font-marathi';
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span>१००% १ पान A4 अचूक फिट (Fit to 1 Page A4)</span>`;
  } else {
    badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold font-marathi';
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span><span>मजकूर जास्त आहे (काही कामाचे तपशील संकुचित करा)</span>`;
  }
}

// 8. Dynamic Scheme Management on Desktop (योजना जोडा / हटवा)
function getDesktopSchemesList() {
  const custom = localStorage.getItem('gsda_custom_schemes');
  if (custom) {
    try {
      const arr = JSON.parse(custom);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch(e) {}
  }
  return [
    "इतर योजना सर्वेक्षण",
    "अटल भूजल योजना /जलयुक्त शिवार अभियान",
    "निरीक्षण विहीरींची वाचने",
    "वाळू/खाणपट्टा सर्वेक्षण",
    "भूजल मूल्यांकन माहिती",
    "प्रयोगशाळा",
    "न.पा.पु.सर्वेक्षण",
    "टांचाई अंतर्गत सर्वेक्षण",
    "तांत्रिक सर्वेक्षण",
    "1:10K mapsheet"
  ];
}

function handleEntrySchemeChange(val) {
  const lblV = document.getElementById('lblEntryVillages');
  const lblC = document.getElementById('lblEntryCases');
  const inpV = document.getElementById('entryVillages');
  const inpC = document.getElementById('entryCases');

  const isMapsheet = val && (val.includes('1:10') || val.includes('Mapsheet') || val.includes('mapsheet') || val.includes('नकाशा'));

  if (isMapsheet) {
    if (lblV) lblV.innerHTML = '<i class="fa-solid fa-map text-blue-600 mr-0.5"></i>Mapsheet:';
    if (inpV) { inpV.placeholder = 'उदा. 1'; inpV.title = 'No. of Mapsheets'; }
    if (lblC) lblC.innerHTML = '<i class="fa-solid fa-water text-cyan-600 mr-0.5"></i>Wells:';
    if (inpC) { inpC.placeholder = 'उदा. 25'; inpC.title = 'No. of Wells'; }
  } else {
    if (lblV) lblV.textContent = 'गावे:';
    if (inpV) { inpV.placeholder = '1'; inpV.title = 'गावे संख्या'; }
    if (lblC) lblC.textContent = 'प्रकरणे:';
    if (inpC) { inpC.placeholder = 'उदा. 3'; inpC.title = 'प्रकरणे संख्या'; }
  }
}
window.handleEntrySchemeChange = handleEntrySchemeChange;

function populateDesktopSchemeSelect(selectedVal = '') {
  const sel = document.getElementById('entryScheme');
  if (!sel) return;
  const list = getDesktopSchemesList();
  sel.innerHTML = '<option value="">- योजना लागू नाही -</option>';
  list.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    if (s === selectedVal) opt.selected = true;
    sel.appendChild(opt);
  });
  if (selectedVal && !list.includes(selectedVal)) {
    const customOpt = document.createElement('option');
    customOpt.value = selectedVal;
    customOpt.textContent = selectedVal;
    customOpt.selected = true;
    sel.appendChild(customOpt);
  }
  handleEntrySchemeChange(selectedVal);
}

function addNewSchemePromptDesktop() {
  const name = prompt('नवीन क्षेत्रीय प्रगती योजनेचे नाव प्रविष्ट करा:');
  if (name && name.trim()) {
    const cleanName = name.trim();
    const list = getDesktopSchemesList();
    if (!list.includes(cleanName)) {
      list.push(cleanName);
      localStorage.setItem('gsda_custom_schemes', JSON.stringify(list));
      populateDesktopSchemeSelect(cleanName);
      showToast(`"${cleanName}" योजना जोडली गेली!`);
    } else {
      populateDesktopSchemeSelect(cleanName);
      alert('ही योजना आधीपासून उपलब्ध आहे.');
    }
  }
}

function removeSelectedSchemePromptDesktop() {
  const sel = document.getElementById('entryScheme');
  if (!sel || !sel.value) {
    alert('कृपया प्रथम हटवण्यासाठी योजना निवडा.');
    return;
  }
  const val = sel.value;
  if (confirm(`आपण "${val}" ही योजना यादीतून नक्की हटवू इच्छिता?`)) {
    let list = getDesktopSchemesList();
    list = list.filter(s => s !== val);
    localStorage.setItem('gsda_custom_schemes', JSON.stringify(list));
    populateDesktopSchemeSelect('');
    showToast(`"${val}" योजना हटवली गेली!`);
  }
}

window.addNewSchemePromptDesktop = addNewSchemePromptDesktop;
window.removeSelectedSchemePromptDesktop = removeSelectedSchemePromptDesktop;
window.populateDesktopSchemeSelect = populateDesktopSchemeSelect;

// --- DEVICE-BOUND ACTIVATION & OFFLINE ANTI-PIRACY SYSTEM (Vrad Vinayak) ---
const ACTIVATION_SECRET_SALT = "VRAD_GSDA_DIARY_PROTECT_2026_KEY";
const MASTER_BYPASS_KEYS = ["VRAD-9999", "999999", "VRAD-MASTER-2026", "GSDA-2026"];

function getRawHardwareId() {
  if (window.AndroidBridge && window.AndroidBridge.getHardwareDeviceId) {
    try {
      const hw = window.AndroidBridge.getHardwareDeviceId();
      if (hw && String(hw).trim()) return String(hw).trim().toLowerCase();
    } catch (e) {}
  }
  let localId = localStorage.getItem('GSDA_DIARY_DEVICE_UUID');
  if (!localId) {
    localId = 'diary_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem('GSDA_DIARY_DEVICE_UUID', localId);
  }
  return localId.toLowerCase();
}

function computeRequestCode(rawId) {
  let hash = 5381;
  const str = "GSDA_DIARY_REQ_" + String(rawId).trim().toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & 0x7FFFFFFF;
  }
  const codeNum = (hash % 900000) + 100000;
  return String(codeNum);
}

function getDeviceRequestCode() {
  const rawId = getRawHardwareId();
  return computeRequestCode(rawId);
}

function computeActivationKey(requestCode) {
  const cleanReq = String(requestCode).replace(/[^0-9]/g, '');
  if (!cleanReq || cleanReq.length < 4) return null;
  let hash = 0x811c9dc5;
  const combined = cleanReq + ":" + ACTIVATION_SECRET_SALT + ":" + cleanReq.split('').reverse().join('');
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const positiveHash = Math.abs(hash);
  const keyNum = (positiveHash % 900000) + 100000;
  return String(keyNum);
}

function isDeviceActivated() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('lock') === '1') {
    const storedKey = (localStorage.getItem('GSDA_DIARY_ACTIVATION_KEY') || '').trim();
    const status = localStorage.getItem('GSDA_DIARY_ACTIVATION_STATUS');
    if (status !== 'ACTIVATED' || !storedKey) return false;
    if (MASTER_BYPASS_KEYS.includes(storedKey.toUpperCase())) return true;
    return storedKey === computeActivationKey(getDeviceRequestCode());
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return true;
  }
  const storedKey = (localStorage.getItem('GSDA_DIARY_ACTIVATION_KEY') || '').trim();
  const status = localStorage.getItem('GSDA_DIARY_ACTIVATION_STATUS');
  if (status !== 'ACTIVATED' || !storedKey) return false;

  if (MASTER_BYPASS_KEYS.includes(storedKey.toUpperCase())) return true;

  const currentReqCode = getDeviceRequestCode();
  const expectedKey = computeActivationKey(currentReqCode);
  return storedKey === expectedKey;
}

function checkDeviceActivation() {
  const reqCode = getDeviceRequestCode();
  const overlay = document.getElementById('deviceActivationOverlay');
  const lbl = document.getElementById('lblDeviceRequestCode');
  if (lbl) lbl.innerText = 'REQ-' + reqCode;

  const activated = isDeviceActivated();

  if (!activated) {
    if (overlay) {
      overlay.style.display = 'flex';
      const input = document.getElementById('activationKeyInput');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 250);
      }
    }
    return false;
  } else {
    if (overlay) overlay.style.display = 'none';
    return true;
  }
}

function handleDeviceActivation() {
  const input = document.getElementById('activationKeyInput');
  const err = document.getElementById('activationErrorBanner');
  const enteredKey = (input?.value || '').trim();

  if (!enteredKey) {
    if (err) {
      err.innerText = '⚠️ कृपया ६-अंकी Activation Key प्रविष्ट करा.';
      err.style.display = 'block';
    }
    return;
  }

  const reqCode = getDeviceRequestCode();
  const expectedKey = computeActivationKey(reqCode);
  const isMaster = MASTER_BYPASS_KEYS.includes(enteredKey.toUpperCase());

  if (enteredKey === expectedKey || isMaster) {
    localStorage.setItem('GSDA_DIARY_ACTIVATION_KEY', enteredKey);
    localStorage.setItem('GSDA_DIARY_ACTIVATION_STATUS', 'ACTIVATED');
    localStorage.setItem('GSDA_DIARY_ACTIVATION_REQ_CODE', reqCode);

    const overlay = document.getElementById('deviceActivationOverlay');
    if (overlay) overlay.style.display = 'none';

    if (err) err.style.display = 'none';
    alert('🎉 GSDA दैनंदिनी या उपकरणावर यशस्वीरीत्या सक्रिय (Activated) झाली आहे!');
    checkDeviceActivation();
  } else {
    if (err) {
      err.innerText = '❌ अवैध Activation Key! कृपया योग्य ६-अंकी कोड तपासा व पुन्हा प्रयत्न करा.';
      err.style.display = 'block';
    }
    if (input) {
      input.value = '';
      input.focus();
    }
  }
}

function copyDeviceRequestCode() {
  const code = 'REQ-' + getDeviceRequestCode();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      alert('📋 Request Code कॉपी झाला: ' + code);
    }).catch(() => {
      alert('Request Code: ' + code);
    });
  } else {
    alert('Request Code: ' + code);
  }
}

function sendActivationOnWhatsApp() {
  const code = 'REQ-' + getDeviceRequestCode();
  const text = encodeURIComponent(`नमस्कार Vrad Vinayak, कृपया माझ्या GSDA दैनंदिनी (GSDA Diary Pro) अ‍ॅपसाठी Activation Key द्यावी ही विनंती.\n\nमाझा Device Request Code आहे: ${code}`);
  const url = `https://api.whatsapp.com/send?text=${text}`;
  if (window.AndroidBridge && window.AndroidBridge.openUrl) {
    window.AndroidBridge.openUrl(url);
  } else {
    window.open(url, '_blank');
  }
}

window.checkDeviceActivation = checkDeviceActivation;
window.handleDeviceActivation = handleDeviceActivation;
window.copyDeviceRequestCode = copyDeviceRequestCode;
window.sendActivationOnWhatsApp = sendActivationOnWhatsApp;
