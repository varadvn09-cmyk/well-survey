/**
 * HydroGeo Field Survey Pro (Draft_Calc) - Real-Time Cloud Synchronization Engine
 * Inspired by WellGeo 2.0 Real-Time 10-Digit Mobile Sync Room
 * 
 * Provides bi-directional, real-time sync between Android APK and PC/Laptop Web App
 * via a 10-digit Mobile Number Sync Room over Firebase Realtime Database SSE.
 */

window.DraftCalcCloudSync = (function() {
  const STORAGE_KEYS = {
    SYNC_KEY: 'HYDROGEO_CLOUD_SYNC_PHONE',          // User's 10-digit mobile number
    CLOUD_URL: 'HYDROGEO_CLOUD_DB_URL',             // Firebase RTDB URL
    AUTO_SYNC: 'HYDROGEO_CLOUD_AUTO_SYNC',          // 'true' | 'false'
    LAST_SYNC: 'HYDROGEO_CLOUD_LAST_SYNC_TIME'      // ISO timestamp
  };

  const DEFAULT_CONFIG = {
    defaultDbUrl: 'https://wellgeo-survey-default-rtdb.asia-southeast1.firebasedatabase.app',
    maxPhotoWidth: 640,
    photoQuality: 0.65,
    pollIntervalMs: 15000 // 15-second safety poll
  };

  let eventSource = null;
  let pollTimer = null;
  let isSyncing = false;
  let connectionState = 'idle'; // 'idle' | 'connected' | 'offline' | 'syncing'
  let syncDebounceTimer = null;

  // --- Getters / Setters ---
  function getSyncKey() {
    const raw = localStorage.getItem(STORAGE_KEYS.SYNC_KEY) || '';
    return raw.replace(/\D/g, '').trim();
  }

  function setSyncKey(phoneStr) {
    const clean = (phoneStr || '').replace(/\D/g, '').trim();
    if (clean && clean.length === 10) {
      localStorage.setItem(STORAGE_KEYS.SYNC_KEY, clean);
    } else if (!clean) {
      localStorage.removeItem(STORAGE_KEYS.SYNC_KEY);
    }
    updateAllSyncStatusUI();
    restartRealtimeSync();
  }

  function getDbUrl() {
    const custom = (localStorage.getItem(STORAGE_KEYS.CLOUD_URL) || '').trim();
    if (custom) return custom.replace(/\/+$/, '');
    return DEFAULT_CONFIG.defaultDbUrl;
  }

  function setDbUrl(url) {
    const clean = (url || '').trim().replace(/\/+$/, '');
    if (clean) {
      localStorage.setItem(STORAGE_KEYS.CLOUD_URL, clean);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CLOUD_URL);
    }
    restartRealtimeSync();
  }

  function isAutoSyncEnabled() {
    const val = localStorage.getItem(STORAGE_KEYS.AUTO_SYNC);
    return val === null ? true : val === 'true';
  }

  function setAutoSyncEnabled(enabled) {
    localStorage.setItem(STORAGE_KEYS.AUTO_SYNC, enabled ? 'true' : 'false');
    if (enabled) {
      restartRealtimeSync();
    } else {
      stopRealtimeSync();
    }
    updateAllSyncStatusUI();
  }

  function getLastSyncTime() {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC) || null;
  }

  function setLastSyncTime() {
    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, now);
    return now;
  }

  // --- Photo Compression (Canvas API) ---
  function compressPhoto(base64Str) {
    return new Promise((resolve) => {
      if (!base64Str || typeof base64Str !== 'string' || !base64Str.startsWith('data:image')) {
        return resolve(base64Str || '');
      }
      const img = new Image();
      img.onload = function() {
        let w = img.width;
        let h = img.height;
        const max = DEFAULT_CONFIG.maxPhotoWidth;
        if (w > max || h > max) {
          if (w > h) {
            h = Math.round((h * max) / w);
            w = max;
          } else {
            w = Math.round((w * max) / h);
            h = max;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', DEFAULT_CONFIG.photoQuality));
      };
      img.onerror = function() {
        resolve(base64Str);
      };
      img.src = base64Str;
    });
  }

  // --- Sync Operations ---
  async function syncSingleRecord(record) {
    const key = getSyncKey();
    if (!key || key.length !== 10 || !isAutoSyncEnabled() || !navigator.onLine) {
      return false;
    }
    try {
      isSyncing = true;
      updateAllSyncStatusUI();
      const dbUrl = getDbUrl();
      const recCopy = { ...record };

      if (recCopy.photoData) {
        recCopy.photoData = await compressPhoto(recCopy.photoData);
      }
      recCopy.lastModified = Date.now();
      recCopy.syncDevice = window.AndroidBridge ? 'mobile' : 'pc';

      const url = `${dbUrl}/draft_rooms/${key}/records/${record.srNo}.json`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recCopy)
      });

      if (res.ok) {
        setLastSyncTime();
        connectionState = 'connected';
        fetch(`${dbUrl}/draft_rooms/${key}/meta.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            lastUpdated: new Date().toISOString(), 
            lastDevice: window.AndroidBridge ? 'mobile' : 'pc' 
          })
        }).catch(() => {});
        return true;
      }
      return false;
    } catch(err) {
      console.warn('DraftCalc Cloud Sync - Record upload failed:', err);
      connectionState = 'offline';
      return false;
    } finally {
      isSyncing = false;
      updateAllSyncStatusUI();
    }
  }

  async function pushAllRecords(showToastMsg = true) {
    const key = getSyncKey();
    if (!key || key.length !== 10) {
      if (showToastMsg && typeof showToast === 'function') {
        showToast("⚠️ Please enter a valid 10-digit Mobile Number first!");
      }
      return false;
    }
    if (!navigator.onLine) {
      if (showToastMsg && typeof showToast === 'function') {
        showToast("⚠️ No internet connection! Data remains safe locally.");
      }
      return false;
    }

    const localRecords = (typeof getStoredRecords === 'function') ? getStoredRecords() : [];
    if (localRecords.length === 0) {
      if (showToastMsg && typeof showToast === 'function') {
        showToast("ℹ️ No records to upload yet.");
      }
      return true;
    }

    try {
      isSyncing = true;
      updateAllSyncStatusUI();
      if (showToastMsg && typeof showToast === 'function') {
        showToast(`☁️ Syncing ${localRecords.length} records to Cloud Room (${key})...`);
      }
      const dbUrl = getDbUrl();
      const recordsMap = {};

      for (const r of localRecords) {
        const copy = { ...r };
        if (copy.photoData) {
          copy.photoData = await compressPhoto(copy.photoData);
        }
        copy.lastModified = copy.lastModified || Date.now();
        copy.syncDevice = window.AndroidBridge ? 'mobile' : 'pc';
        recordsMap[String(copy.srNo)] = copy;
      }

      const res = await fetch(`${dbUrl}/draft_rooms/${key}/records.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordsMap)
      });

      if (res.ok) {
        setLastSyncTime();
        connectionState = 'connected';
        if (showToastMsg && typeof showToast === 'function') {
          showToast(`🎉 ${localRecords.length} records synced to Cloud Room!`);
        }
        fetch(`${dbUrl}/draft_rooms/${key}/meta.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            lastUpdated: new Date().toISOString(), 
            totalRecords: localRecords.length,
            device: window.AndroidBridge ? 'mobile' : 'pc'
          })
        }).catch(() => {});
        return true;
      }
      return false;
    } catch(err) {
      console.warn('DraftCalc Cloud Sync - Full upload failed:', err);
      if (showToastMsg && typeof showToast === 'function') {
        showToast("❌ Sync failed. Please check internet connection.");
      }
      return false;
    } finally {
      isSyncing = false;
      updateAllSyncStatusUI();
    }
  }

  async function pullAndMerge(isManual = false) {
    const key = getSyncKey();
    if (!key || key.length !== 10) {
      if (isManual && typeof showToast === 'function') {
        showToast("⚠️ Please enter a 10-digit Mobile Number first!");
      }
      return false;
    }
    if (!navigator.onLine) {
      if (isManual && typeof showToast === 'function') {
        showToast("⚠️ No internet connection! Working in local offline mode.");
      }
      connectionState = 'offline';
      updateAllSyncStatusUI();
      return false;
    }

    try {
      isSyncing = true;
      updateAllSyncStatusUI();
      const dbUrl = getDbUrl();
      const url = `${dbUrl}/draft_rooms/${key}/records.json`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const remoteData = await res.json();
      const localRecords = (typeof getStoredRecords === 'function') ? getStoredRecords() : [];
      let updatedCount = 0;
      let addedCount = 0;

      if (!remoteData || typeof remoteData !== 'object') {
        if (localRecords.length > 0) {
          await pushAllRecords(false);
        }
        setLastSyncTime();
        connectionState = 'connected';
        if (isManual && typeof showToast === 'function') {
          showToast("☁️ Cloud Room connected! Ready & up to date.");
        }
        return true;
      }

      const remoteRecords = Array.isArray(remoteData)
        ? remoteData.filter(Boolean)
        : Object.values(remoteData).filter(Boolean);

      const mergedMap = new Map();
      localRecords.forEach(r => mergedMap.set(String(r.srNo), r));

      let hasLocalChanges = false;
      const recordsToPush = [];

      remoteRecords.forEach(rem => {
        const srKey = String(rem.srNo);
        if (!mergedMap.has(srKey)) {
          mergedMap.set(srKey, rem);
          addedCount++;
          hasLocalChanges = true;
        } else {
          const loc = mergedMap.get(srKey);
          const remTime = new Date(rem.timestamp || rem.lastModified || rem.updatedAt || 0).getTime();
          const locTime = new Date(loc.timestamp || loc.lastModified || loc.updatedAt || 0).getTime();

          if (remTime > locTime) {
            if (loc.photoData && (!rem.photoData || rem.photoData.length < 50000)) {
              rem.photoData = loc.photoData;
            }
            mergedMap.set(srKey, rem);
            updatedCount++;
            hasLocalChanges = true;
          } else if (locTime > remTime) {
            recordsToPush.push(loc);
          }
        }
      });

      if (hasLocalChanges) {
        const sorted = Array.from(mergedMap.values()).sort((a,b) => (Number(b.srNo)||0) - (Number(a.srNo)||0));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
        
        if (window.AndroidBridge && window.AndroidBridge.persistBackup) {
          window.AndroidBridge.persistBackup(JSON.stringify(sorted));
        }
        if (typeof rootDirHandle !== 'undefined' && rootDirHandle && typeof autoBackupToFolder === 'function') {
          autoBackupToFolder(sorted);
        }
        if (typeof updateBadge === 'function') updateBadge();
        if (typeof renderRecords === 'function') renderRecords();
        if (typeof updateHomeDashboard === 'function') updateHomeDashboard();
      }

      for (const rec of recordsToPush) {
        await syncSingleRecord(rec);
      }

      setLastSyncTime();
      connectionState = 'connected';

      if (isManual && typeof showToast === 'function') {
        if (addedCount > 0 || updatedCount > 0) {
          showToast(`🎉 Synced! ${addedCount} new, ${updatedCount} updated from Cloud.`);
        } else {
          showToast("✅ All surveys are fully in sync with Cloud!");
        }
      } else if (addedCount > 0 || updatedCount > 0) {
        if (typeof showToast === 'function') {
          showToast(`☁️ Cloud Auto-Sync: ${addedCount + updatedCount} surveys updated.`);
        }
      }

      return true;
    } catch(err) {
      console.warn('DraftCalc Cloud Sync - pullAndMerge error:', err);
      connectionState = 'offline';
      if (isManual && typeof showToast === 'function') {
        showToast("❌ Sync error: Unable to connect to Cloud Database.");
      }
      return false;
    } finally {
      isSyncing = false;
      updateAllSyncStatusUI();
    }
  }

  // --- Real-time Streaming Listener (SSE EventSource) ---
  function startRealtimeSync() {
    stopRealtimeSync();
    const key = getSyncKey();
    if (!key || key.length !== 10 || !isAutoSyncEnabled()) {
      updateAllSyncStatusUI();
      return;
    }

    pullAndMerge(false);

    if (typeof EventSource !== 'undefined') {
      try {
        const dbUrl = getDbUrl();
        const streamUrl = `${dbUrl}/draft_rooms/${key}/records.json`;
        eventSource = new EventSource(streamUrl);

        eventSource.addEventListener('put', function(e) {
          try {
            if (e && e.data) {
              pullAndMerge(false);
            }
          } catch(err) {}
        });

        eventSource.addEventListener('patch', function(e) {
          try {
            pullAndMerge(false);
          } catch(err) {}
        });

        eventSource.onopen = function() {
          connectionState = 'connected';
          updateAllSyncStatusUI();
        };

        eventSource.onerror = function() {
          connectionState = 'offline';
          updateAllSyncStatusUI();
        };
      } catch(err) {
        console.warn('EventSource not available, falling back to periodic poll');
      }
    }

    pollTimer = setInterval(() => {
      if (navigator.onLine && isAutoSyncEnabled() && getSyncKey()) {
        pullAndMerge(false);
      }
    }, DEFAULT_CONFIG.pollIntervalMs);
  }

  function stopRealtimeSync() {
    if (eventSource) {
      try { eventSource.close(); } catch(e) {}
      eventSource = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function restartRealtimeSync() {
    stopRealtimeSync();
    startRealtimeSync();
  }

  function onRecordsSaved(records) {
    const key = getSyncKey();
    if (!key || key.length !== 10 || !isAutoSyncEnabled() || !navigator.onLine) return;
    
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      pushAllRecords(false);
    }, 1500);
  }

  // --- UI Status Updater ---
  function updateAllSyncStatusUI() {
    const key = getSyncKey();
    const isOnline = navigator.onLine;
    const lastSync = getLastSyncTime();

    const inp = document.getElementById('txtMobileSyncNumber');
    if (inp && document.activeElement !== inp) {
      inp.value = key;
    }

    const badge = document.getElementById('cloudSyncStatusBadge');
    const btnConnect = document.getElementById('btnConnectMobileSync');
    const btnDisconnect = document.getElementById('btnDisconnectMobile');
    const lblLastTime = document.getElementById('lblMobileSyncLastTime');
    const lblSub = document.getElementById('lblSyncHeaderSub');

    if (lblLastTime) {
      if (lastSync) {
        try {
          const d = new Date(lastSync);
          lblLastTime.innerText = `Last Synced: ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } catch(e) {
          lblLastTime.innerText = `Last Synced: Yes`;
        }
      } else {
        lblLastTime.innerText = 'Last Synced: Never';
      }
    }

    if (!key || key.length !== 10) {
      if (badge) {
        badge.innerText = 'Not Connected';
        badge.style.background = '#e2e8f0';
        badge.style.color = '#64748b';
      }
      if (btnConnect) btnConnect.style.display = 'inline-block';
      if (btnDisconnect) btnDisconnect.style.display = 'none';
      if (lblSub) lblSub.innerText = 'Pair Mobile & PC using 10-Digit Number';
    } else if (isSyncing) {
      if (badge) {
        badge.innerText = '🔄 Syncing...';
        badge.style.background = 'rgba(37, 99, 235, 0.15)';
        badge.style.color = 'var(--primary)';
      }
      if (btnConnect) btnConnect.style.display = 'none';
      if (btnDisconnect) btnDisconnect.style.display = 'inline-block';
      if (lblSub) lblSub.innerText = `Room: ${key} (Syncing)`;
    } else if (!isOnline) {
      if (badge) {
        badge.innerText = `🟡 Offline (${key.slice(0,3)}***${key.slice(-2)})`;
        badge.style.background = 'rgba(245, 158, 11, 0.15)';
        badge.style.color = '#f59e0b';
      }
      if (btnConnect) btnConnect.style.display = 'none';
      if (btnDisconnect) btnDisconnect.style.display = 'inline-block';
      if (lblSub) lblSub.innerText = `Room: ${key} (Offline)`;
    } else {
      if (badge) {
        badge.innerText = `🟢 Live Synced (${key.slice(0,3)}***${key.slice(-2)})`;
        badge.style.background = 'rgba(16, 185, 129, 0.15)';
        badge.style.color = '#10b981';
      }
      if (btnConnect) btnConnect.style.display = 'none';
      if (btnDisconnect) btnDisconnect.style.display = 'inline-block';
      if (lblSub) lblSub.innerText = `🟢 Active Room: ${key}`;
    }
  }

  // --- Auto-Initialize on page load ---
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      updateAllSyncStatusUI();
      if (getSyncKey() && isAutoSyncEnabled()) {
        startRealtimeSync();
      }
    }, 500);
  });

  window.addEventListener('online', () => {
    updateAllSyncStatusUI();
    if (getSyncKey()) pullAndMerge(false);
  });

  window.addEventListener('offline', () => {
    updateAllSyncStatusUI();
  });

  return {
    getSyncKey,
    setSyncKey,
    getDbUrl,
    setDbUrl,
    isAutoSyncEnabled,
    setAutoSyncEnabled,
    pushAllRecords,
    pullAndMerge,
    syncSingleRecord,
    startRealtimeSync,
    stopRealtimeSync,
    restartRealtimeSync,
    onRecordsSaved,
    updateAllSyncStatusUI
  };
})();
