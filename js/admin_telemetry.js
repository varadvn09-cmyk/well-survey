/**
 * HydroGeo Field Survey Pro (Draft_Calc) - Creator Telemetry & Master Admin Kill-Switch
 * 
 * Provides:
 * 1. Lightweight Creator Heartbeat (on app launch and every 45 minutes).
 * 2. Remote Kill-Switch / Device Blacklist (instantly blocks unauthorized/suspicious devices).
 * 3. Hidden Master Admin Dashboard (view connected devices, stats, and block/unblock controls).
 */

window.DraftCalcAdmin = (function() {
  'use strict';

  const STORAGE_KEYS = {
    DEVICE_ID: 'HYDROGEO_TELEMETRY_DEVICE_ID',
    BLOCKED_FLAG: 'HYDROGEO_DEVICE_BLOCKED',
    FIRST_SEEN: 'HYDROGEO_FIRST_SEEN_TS'
  };

  const MASTER_ADMIN_PIN = '778899'; // Master Admin Secret PIN
  const HEARTBEAT_INTERVAL_MS = 45 * 60 * 1000; // 45 minutes

  let heartbeatTimer = null;
  let isCheckingBlock = false;

  function getDbUrl() {
    const custom = (localStorage.getItem('HYDROGEO_CLOUD_DB_URL') || '').trim();
    if (custom) return custom.replace(/\/+$/, '');
    return 'https://wellgeo-survey-default-rtdb.asia-southeast1.firebasedatabase.app';
  }

  // --- Device Identification ---
  function getDeviceId() {
    let id = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!id) {
      if (window.AndroidBridge && typeof window.AndroidBridge.getHardwareDeviceId === 'function') {
        try {
          id = window.AndroidBridge.getHardwareDeviceId();
        } catch (e) {}
      }
      if (!id || id.length < 4) {
        id = 'DEV_' + Math.random().toString(36).substring(2, 10).toUpperCase() + '_' + Date.now().toString(36).toUpperCase();
      }
      localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
    }
    return id;
  }

  function isDeviceBlockedLocally() {
    return localStorage.getItem(STORAGE_KEYS.BLOCKED_FLAG) === 'true';
  }

  // --- Remote Kill-Switch & Block Check ---
  async function checkDeviceBlockStatus() {
    if (isCheckingBlock) return;
    const deviceId = getDeviceId();

    // If already marked blocked locally, enforce lock immediately
    if (isDeviceBlockedLocally()) {
      enforceBlockScreen(deviceId, "Access Revoked by Master Administrator");
    }

    if (!navigator.onLine) return; // offline in field -> continue normally

    isCheckingBlock = true;
    try {
      const dbUrl = getDbUrl();
      const res = await fetch(`${dbUrl}/admin_telemetry/blocked/${deviceId}.json`);
      if (res.ok) {
        const blockData = await res.json();
        if (blockData && (blockData.blocked === true || blockData === true)) {
          localStorage.setItem(STORAGE_KEYS.BLOCKED_FLAG, 'true');
          const reason = (typeof blockData === 'object' && blockData.reason) ? blockData.reason : 'Access Revoked by Master Administrator';
          enforceBlockScreen(deviceId, reason);
          return true;
        } else {
          // Device is unblocked
          if (isDeviceBlockedLocally()) {
            localStorage.removeItem(STORAGE_KEYS.BLOCKED_FLAG);
            liftBlockScreen();
          }
        }
      }
    } catch(err) {
      console.warn('DraftCalc Admin: Block check skipped (offline/network timeout)');
    } finally {
      isCheckingBlock = false;
    }
    return false;
  }

  function enforceBlockScreen(deviceId, reason) {
    let overlay = document.getElementById('deviceBlockedOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'deviceBlockedOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:#0f172a;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;color:#fff;font-family:system-ui,-apple-system,sans-serif;';
      overlay.innerHTML = `
        <div style="max-width:440px;background:#1e293b;border:2px solid #ef4444;border-radius:20px;padding:32px 24px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);">
          <div style="width:72px;height:72px;border-radius:50%;background:rgba(239,68,68,0.15);border:2px solid #ef4444;display:inline-flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:16px;">⛔</div>
          <h2 style="margin:0 0 8px 0;font-size:1.5rem;font-weight:900;color:#f87171;">DEVICE ACCESS REVOKED</h2>
          <p style="margin:0 0 16px 0;font-size:0.95rem;color:#cbd5e1;line-height:1.5;">${reason || 'This device has been suspended by the Master Administrator.'}</p>
          <div style="background:#0f172a;padding:12px;border-radius:10px;border:1px solid #334155;font-family:monospace;font-size:0.85rem;color:#94a3b8;margin-bottom:20px;">
            Device ID: <strong style="color:#f87171;">${deviceId}</strong>
          </div>
          <p style="margin:0;font-size:0.8rem;color:#64748b;">If you believe this is an error, contact the Master Admin to restore access.</p>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  }

  function liftBlockScreen() {
    const overlay = document.getElementById('deviceBlockedOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  // --- Lightweight Creator Heartbeat Ping ---
  async function sendHeartbeat() {
    if (!navigator.onLine) return;
    const deviceId = getDeviceId();
    
    // First, verify block status
    const isBlocked = await checkDeviceBlockStatus();
    if (isBlocked) return;

    try {
      const dbUrl = getDbUrl();
      const firstSeen = localStorage.getItem(STORAGE_KEYS.FIRST_SEEN) || new Date().toISOString();
      if (!localStorage.getItem(STORAGE_KEYS.FIRST_SEEN)) {
        localStorage.setItem(STORAGE_KEYS.FIRST_SEEN, firstSeen);
      }

      const recordCount = (typeof getStoredRecords === 'function') ? getStoredRecords().length : 0;
      const syncPhone = (localStorage.getItem('HYDROGEO_CLOUD_SYNC_PHONE') || '').trim();

      const payload = {
        deviceId: deviceId,
        platform: window.AndroidBridge ? 'Android APK' : 'Web Browser',
        deviceModel: window.AndroidBridge ? (navigator.userAgent.match(/\((.*?)\)/)?.[1] || 'Android Device') : (navigator.platform || 'Browser'),
        appVersion: 'GeoDraft_Pro_3.3.1',
        lastSeen: new Date().toISOString(),
        lastSeenTs: Date.now(),
        firstSeen: firstSeen,
        recordCount: recordCount,
        syncPhone: syncPhone || null
      };

      await fetch(`${dbUrl}/admin_telemetry/devices/${deviceId}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch(err) {
      // Silently catch network failures so offline work is never disturbed
    }
  }

  function initHeartbeat() {
    // Initial check and ping 2 seconds after page load
    setTimeout(() => {
      checkDeviceBlockStatus();
      sendHeartbeat();
    }, 2000);

    // Periodic ping every 45 minutes
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  // --- Master Admin Dashboard API ---
  const MASTER_ADMIN_PIN_KEY = 'HYDROGEO_MASTER_ADMIN_PIN';
  const DEFAULT_ADMIN_PIN = '778899';

  function getMasterPin() {
    return localStorage.getItem(MASTER_ADMIN_PIN_KEY) || DEFAULT_ADMIN_PIN;
  }

  function setMasterPin(newPin) {
    if (!newPin || newPin.trim().length < 4) {
      throw new Error("PIN must be at least 4 digits");
    }
    localStorage.setItem(MASTER_ADMIN_PIN_KEY, newPin.trim());
    return true;
  }

  function verifyMasterPin(inputPin) {
    return (inputPin || '').trim() === getMasterPin();
  }

  async function fetchAllDevices() {
    const dbUrl = getDbUrl();
    const [devicesRes, blockedRes] = await Promise.all([
      fetch(`${dbUrl}/admin_telemetry/devices.json`),
      fetch(`${dbUrl}/admin_telemetry/blocked.json`)
    ]);

    const devices = (devicesRes.ok ? await devicesRes.json() : {}) || {};
    const blocked = (blockedRes.ok ? await blockedRes.json() : {}) || {};

    const list = [];
    for (const id in devices) {
      const d = devices[id];
      if (d) {
        d.isBlocked = !!(blocked[id] && (blocked[id].blocked === true || blocked[id] === true));
        list.push(d);
      }
    }
    // Sort newest lastSeen first
    list.sort((a, b) => (b.lastSeenTs || 0) - (a.lastSeenTs || 0));
    return { devices: list, blockedMap: blocked };
  }

  async function blockDevice(targetDeviceId, reason = 'Suspicious activity or unauthorized access') {
    if (!targetDeviceId) return false;
    const dbUrl = getDbUrl();
    await fetch(`${dbUrl}/admin_telemetry/blocked/${targetDeviceId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocked: true,
        reason: reason,
        blockedAt: new Date().toISOString()
      })
    });
    return true;
  }

  async function unblockDevice(targetDeviceId) {
    if (!targetDeviceId) return false;
    const dbUrl = getDbUrl();
    await fetch(`${dbUrl}/admin_telemetry/blocked/${targetDeviceId}.json`, {
      method: 'DELETE'
    });
    return true;
  }

  // Auto-init on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeartbeat);
  } else {
    initHeartbeat();
  }

  return {
    getDeviceId,
    checkDeviceBlockStatus,
    sendHeartbeat,
    verifyMasterPin,
    setMasterPin,
    getMasterPin,
    fetchAllDevices,
    blockDevice,
    unblockDevice,
    isDeviceBlockedLocally
  };
})();
