/**
 * HydroGeo Field Survey Pro (Draft_Calc) - End-to-End Encryption & Security Engine
 * 
 * Provides:
 * 1. Zero-Knowledge AES-256-GCM client-side encryption with PBKDF2 (100,000 iterations).
 * 2. 16-Character Master Recovery Key (Format: XXXX-XXXX-XXXX-XXXX).
 * 3. In-App Lock Screen with Master PIN / Password & Biometrics.
 * 4. 2-Minute Inactivity Auto-Lock & App-Switch / Minimize Auto-Lock.
 * 5. Rate limiting: 5 failed attempts -> 30 second delay (NEVER wipes data).
 */

window.DraftCalcCrypto = (function() {
  'use strict';

  const STORAGE_KEYS = {
    VAULT_METADATA: 'HYDROGEO_VAULT_METADATA',     // { salt, iv, verifier, recoverySalt, recoveryVerifier }
    LOCK_SETTINGS: 'HYDROGEO_SECURITY_SETTINGS',    // { autoLockEnabled, autoLockTimeoutMs }
    LAST_ACTIVITY: 'HYDROGEO_LAST_ACTIVITY_TS'
  };

  const PBKDF2_ITERATIONS = 100000;
  const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes auto-lock
  
  // In-memory session state (cleared on page close or manual lock)
  let sessionState = {
    isUnlocked: false,
    activeKey: null,
    activePassword: null,
    failedAttempts: 0,
    lockedUntil: 0
  };

  let autoLockTimer = null;
  let onLockStateCallbacks = [];

  // =========================================================================
  // UTILITY / BINARY HELPERS
  // =========================================================================
  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  function base64ToBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function getRandomBytes(count) {
    const bytes = new Uint8Array(count);
    window.crypto.getRandomValues(bytes);
    return bytes;
  }

  function formatRecoveryKey(rawHex) {
    const clean = rawHex.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 16);
    return (clean.match(/.{1,4}/g) || []).join('-');
  }

  function cleanRecoveryKey(keyStr) {
    return (keyStr || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  }

  // =========================================================================
  // CRYPTOGRAPHIC KEY DERIVATION (PBKDF2 -> AES-256-GCM)
  // =========================================================================
  async function deriveMasterKey(passwordStr, saltBuffer) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(passwordStr),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt an object or string with AES-256-GCM
  async function encryptPayload(data, passwordOrKey) {
    try {
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
      const enc = new TextEncoder();
      const encodedData = enc.encode(plaintext);

      let key;
      let saltB64 = null;

      if (typeof passwordOrKey === 'string') {
        const salt = getRandomBytes(16);
        key = await deriveMasterKey(passwordOrKey, salt.buffer);
        saltB64 = bufferToBase64(salt.buffer);
      } else {
        key = passwordOrKey; // already a CryptoKey
      }

      const iv = getRandomBytes(12); // 96-bit recommended for AES-GCM
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encodedData
      );

      return {
        _enc: true,
        v: 1,
        iv: bufferToBase64(iv.buffer),
        salt: saltB64,
        ct: bufferToBase64(ciphertext),
        ts: Date.now()
      };
    } catch (err) {
      console.error('E2EE Encryption Error:', err);
      throw err;
    }
  }

  // Decrypt an AES-256-GCM payload
  async function decryptPayload(payload, passwordOrKey) {
    try {
      if (!payload || !payload.ct || !payload.iv) {
        throw new Error('Invalid encrypted payload package');
      }

      const ivBuffer = base64ToBuffer(payload.iv);
      const ctBuffer = base64ToBuffer(payload.ct);

      let key;
      if (typeof passwordOrKey === 'string') {
        if (!payload.salt) throw new Error('Missing salt in payload for password decryption');
        const saltBuffer = base64ToBuffer(payload.salt);
        key = await deriveMasterKey(passwordOrKey, saltBuffer);
      } else {
        key = passwordOrKey;
      }

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuffer },
        key,
        ctBuffer
      );

      const dec = new TextDecoder();
      const plaintext = dec.decode(decrypted);

      try {
        return JSON.parse(plaintext);
      } catch (e) {
        return plaintext;
      }
    } catch (err) {
      console.warn('E2EE Decryption Failed (Wrong Key or Corrupted Data):', err);
      throw err;
    }
  }

  // =========================================================================
  // VAULT CONFIGURATION & MASTER RECOVERY KEY
  // =========================================================================
  function getVaultMetadata() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.VAULT_METADATA);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function isVaultConfigured() {
    return getVaultMetadata() !== null;
  }

  function isUnlocked() {
    if (!isVaultConfigured()) return true; // No vault configured yet -> open
    return sessionState.isUnlocked;
  }

  // Generate 16-character master recovery key
  function generateNewRecoveryKey() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude confusing 0/O, 1/I
    const bytes = getRandomBytes(16);
    let str = '';
    for (let i = 0; i < 16; i++) {
      str += chars[bytes[i] % chars.length];
    }
    return formatRecoveryKey(str);
  }

  // Initialize or Reset Vault with a Master PIN/Password
  async function setupVault(passwordStr) {
    if (!passwordStr || passwordStr.trim().length < 4) {
      throw new Error('PIN / Password must be at least 4 characters');
    }

    const cleanPass = passwordStr.trim();
    const salt = getRandomBytes(16);
    const key = await deriveMasterKey(cleanPass, salt.buffer);

    // Create a known verifier: encrypt "HYDROGEO_VALID_VAULT"
    const iv = getRandomBytes(12);
    const enc = new TextEncoder();
    const verifierCt = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      enc.encode('HYDROGEO_VALID_VAULT')
    );

    // Setup Master Recovery Key
    const recoveryKey = generateNewRecoveryKey();
    const rawRecovery = cleanRecoveryKey(recoveryKey);
    const recSalt = getRandomBytes(16);
    const recKey = await deriveMasterKey(rawRecovery, recSalt.buffer);
    const recIv = getRandomBytes(12);
    const recVerifierCt = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: recIv },
      recKey,
      enc.encode('HYDROGEO_VALID_VAULT')
    );

    const vaultMeta = {
      version: 1,
      created: new Date().toISOString(),
      salt: bufferToBase64(salt.buffer),
      iv: bufferToBase64(iv.buffer),
      verifier: bufferToBase64(verifierCt),
      recoverySalt: bufferToBase64(recSalt.buffer),
      recoveryIv: bufferToBase64(recIv.buffer),
      recoveryVerifier: bufferToBase64(recVerifierCt)
    };

    localStorage.setItem(STORAGE_KEYS.VAULT_METADATA, JSON.stringify(vaultMeta));

    // Unlock session
    sessionState.isUnlocked = true;
    sessionState.activeKey = key;
    sessionState.activePassword = cleanPass;
    sessionState.failedAttempts = 0;
    sessionState.lockedUntil = 0;

    resetInactivityTimer();
    notifyLockStateChanged(false);

    return recoveryKey;
  }

  // Verify PIN/Password and unlock
  async function unlockWithPassword(passwordStr) {
    if (Date.now() < sessionState.lockedUntil) {
      const waitSec = Math.ceil((sessionState.lockedUntil - Date.now()) / 1000);
      throw new Error('Too many attempts. Please wait ' + waitSec + ' seconds.');
    }

    const meta = getVaultMetadata();
    if (!meta) {
      sessionState.isUnlocked = true;
      notifyLockStateChanged(false);
      return true;
    }

    try {
      const saltBuffer = base64ToBuffer(meta.salt);
      const ivBuffer = base64ToBuffer(meta.iv);
      const verifierBuffer = base64ToBuffer(meta.verifier);

      const key = await deriveMasterKey(passwordStr.trim(), saltBuffer);
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuffer },
        key,
        verifierBuffer
      );

      const text = new TextDecoder().decode(decrypted);
      if (text === 'HYDROGEO_VALID_VAULT') {
        sessionState.isUnlocked = true;
        sessionState.activeKey = key;
        sessionState.activePassword = passwordStr.trim();
        sessionState.failedAttempts = 0;
        sessionState.lockedUntil = 0;

        resetInactivityTimer();
        notifyLockStateChanged(false);
        return true;
      }
    } catch (e) {
      // Decryption failed = wrong password
    }

    sessionState.failedAttempts += 1;
    if (sessionState.failedAttempts >= 5) {
      sessionState.lockedUntil = Date.now() + 30000; // 30-sec lockout delay, NO wipe!
      throw new Error('Incorrect PIN. 5 failed attempts reached. Locked for 30 seconds.');
    }
    throw new Error('Incorrect PIN. ' + (5 - sessionState.failedAttempts) + ' attempts remaining before 30s delay.');
  }

  // Unlock with Master Recovery Key
  async function unlockWithRecoveryKey(recoveryKeyStr) {
    const rawRecovery = cleanRecoveryKey(recoveryKeyStr);
    if (!rawRecovery || rawRecovery.length !== 16) {
      throw new Error('Please enter a valid 16-character Master Recovery Key.');
    }

    const meta = getVaultMetadata();
    if (!meta || !meta.recoverySalt) {
      throw new Error('No recovery key found in vault.');
    }

    try {
      const recSaltBuffer = base64ToBuffer(meta.recoverySalt);
      const recIvBuffer = base64ToBuffer(meta.recoveryIv);
      const recVerifierBuffer = base64ToBuffer(meta.recoveryVerifier);

      const recKey = await deriveMasterKey(rawRecovery, recSaltBuffer);
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: recIvBuffer },
        recKey,
        recVerifierBuffer
      );

      const text = new TextDecoder().decode(decrypted);
      if (text === 'HYDROGEO_VALID_VAULT') {
        sessionState.isUnlocked = true;
        sessionState.activeKey = recKey;
        sessionState.failedAttempts = 0;
        sessionState.lockedUntil = 0;

        resetInactivityTimer();
        notifyLockStateChanged(false);
        return true;
      }
    } catch (e) {}

    throw new Error('Invalid Master Recovery Key.');
  }

  // Reset or Change Password
  async function changePassword(currentPasswordOrRecoveryKey, newPassword) {
    if (!newPassword || newPassword.trim().length < 4) {
      throw new Error('New PIN/Password must be at least 4 characters.');
    }

    // Verify current credentials first
    let verified = false;
    try {
      await unlockWithPassword(currentPasswordOrRecoveryKey);
      verified = true;
    } catch (e) {
      try {
        await unlockWithRecoveryKey(currentPasswordOrRecoveryKey);
        verified = true;
      } catch (e2) {}
    }

    if (!verified) {
      throw new Error('Current PIN or Recovery Key is incorrect.');
    }

    // Re-setup vault with new password and generate a fresh recovery key
    const newRecoveryKey = await setupVault(newPassword);
    return newRecoveryKey;
  }

  // Reset password after Google Authentication verification
  async function resetPasswordWithGoogleAuth(newPassword) {
    if (!newPassword || newPassword.trim().length < 4) {
      throw new Error('New PIN/Password must be at least 4 characters.');
    }
    const newRecoveryKey = await setupVault(newPassword);
    return newRecoveryKey;
  }

  // Lock the vault immediately
  function lockVault() {
    if (!isVaultConfigured()) return;
    sessionState.isUnlocked = false;
    sessionState.activeKey = null;
    sessionState.activePassword = null;
    if (autoLockTimer) clearTimeout(autoLockTimer);
    notifyLockStateChanged(true);
  }

  // =========================================================================
  // INACTIVITY AUTO-LOCK (2 MINUTES) & VISIBILITY AUTO-LOCK
  // =========================================================================
  function resetInactivityTimer() {
    if (autoLockTimer) clearTimeout(autoLockTimer);
    if (!isVaultConfigured() || !sessionState.isUnlocked) return;

    autoLockTimer = setTimeout(() => {
      if (sessionState.isUnlocked && isVaultConfigured()) {
        console.log('DraftCalc Security: 2-minute inactivity auto-lock triggered.');
        lockVault();
      }
    }, DEFAULT_TIMEOUT_MS);
  }

  // Attach global user activity listeners
  function initActivityListeners() {
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
      window.addEventListener(evt, () => {
        resetInactivityTimer();
      }, { passive: true });
    });

    // Auto-lock when tab is hidden or app minimized
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && isVaultConfigured() && sessionState.isUnlocked) {
        // Automatically lock when app is sent to background
        lockVault();
      }
    });
  }

  // =========================================================================
  // EVENT SUBSCRIPTION
  // =========================================================================
  function onLockStateChanged(callback) {
    if (typeof callback === 'function') {
      onLockStateCallbacks.push(callback);
    }
  }

  function notifyLockStateChanged(isLocked) {
    onLockStateCallbacks.forEach(cb => {
      try { cb(isLocked); } catch(e) {}
    });
  }

  function getActivePassword() {
    return sessionState.activePassword;
  }

  function getActiveKey() {
    return sessionState.activeKey;
  }

  // Auto-init on load
  initActivityListeners();

  return {
    isVaultConfigured,
    isUnlocked,
    setupVault,
    unlockWithPassword,
    unlockWithRecoveryKey,
    changePassword,
    resetPasswordWithGoogleAuth,
    lockVault,
    encryptPayload,
    decryptPayload,
    getActivePassword,
    getActiveKey,
    onLockStateChanged,
    formatRecoveryKey,
    cleanRecoveryKey
  };
})();
