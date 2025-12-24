/**
 * Development Update Helper - Automatic Update System
 * 
 * This utility helps test automatic update functionality during development
 */

export const DEV_UPDATE_HELPER = {
  // Simulate the full update notification UI with progress
  simulateUpdateNotification: (options = {}) => {
    const { 
      fromVersion = '1.0.0', 
      toVersion = '1.1.0',
      updateType = 'minor', // 'major', 'minor', 'patch'
      showProgress = true 
    } = options;
    
    console.debug('🔔 Simulating update notification...');
    console.debug(`   From: v${fromVersion} → v${toVersion} (${updateType})`);
    
    // Set the "last known version" to simulate an older version
    localStorage.setItem('last_sw_version', fromVersion);
    
    // Clear any snooze
    localStorage.removeItem('sw_update_snoozed_until');
    
    if (showProgress) {
      // Simulate downloading progress
      console.debug('📦 Simulating download progress...');
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        globalThis.dispatchEvent(new CustomEvent('sw-update-progress', {
          detail: {
            type: 'SW_UPDATE_PROGRESS',
            status: progress < 100 ? 'downloading' : 'ready',
            progress,
            totalAssets: 50,
            cachedAssets: Math.floor(progress / 2),
            version: toVersion
          }
        }));
        
        if (progress >= 100) {
          clearInterval(progressInterval);
          console.debug('✅ Download complete, triggering update notification...');
          // Trigger the update ready event
          sessionStorage.setItem('sw_update_ready', 'true');
          globalThis.dispatchEvent(new CustomEvent('sw-update-ready'));
        }
      }, 200);
    } else {
      // Immediate update notification
      sessionStorage.setItem('sw_update_ready', 'true');
      globalThis.dispatchEvent(new CustomEvent('sw-update-ready'));
    }
  },

  // Test major update notification
  simulateMajorUpdate: () => {
    DEV_UPDATE_HELPER.simulateUpdateNotification({
      fromVersion: '1.12.14',
      toVersion: '2.0.0',
      updateType: 'major'
    });
  },

  // Test minor update notification
  simulateMinorUpdate: () => {
    DEV_UPDATE_HELPER.simulateUpdateNotification({
      fromVersion: '1.12.14',
      toVersion: '1.13.0',
      updateType: 'minor'
    });
  },

  // Test patch update notification
  simulatePatchUpdate: () => {
    DEV_UPDATE_HELPER.simulateUpdateNotification({
      fromVersion: '1.12.14',
      toVersion: '1.12.15',
      updateType: 'patch'
    });
  },

  // Simulate an automatic update (the old behavior)
  simulateAutoUpdate: () => {
    if (import.meta.env.DEV) {
      console.debug('🔄 Simulating automatic update...');
      // Simulate the update detection and automatic reload
      setTimeout(() => {
        console.debug('📦 New version detected - updating automatically...');
        DEV_UPDATE_HELPER.clearCaches().then(() => {
          console.debug('🔄 Reloading with fresh content...');
          globalThis.location.reload();
        });
      }, 1000);
    }
  },

  // Force clear all caches
  clearCaches: async () => {
    if ('caches' in globalThis) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.debug('🗑️ All caches cleared');
    }
  },

  // Clear update state (for testing)
  resetUpdateState: () => {
    localStorage.removeItem('last_sw_version');
    localStorage.removeItem('last_sw_reload');
    localStorage.removeItem('sw_reload_attempts');
    localStorage.removeItem('sw_update_snoozed_until');
    sessionStorage.removeItem('sw_update_ready');
    sessionStorage.removeItem('sw_update_in_progress');
    console.debug('🧹 Update state reset');
  },

  // Simulate CSS update with cache busting
  simulateCSSUpdate: () => {
    if (import.meta.env.DEV) {
      console.debug('🎨 Simulating CSS update...');
      const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
      cssLinks.forEach(link => {
        const href = link.href;
        const separator = href.includes('?') ? '&' : '?';
        link.href = `${href}${separator}v=${Date.now()}`;
      });
      console.debug('✅ CSS cache invalidated');
    }
  },

  // Test the complete automatic update flow
  testAutoUpdateFlow: () => {
    if (import.meta.env.DEV) {
      console.debug('🧪 Testing complete auto-update flow...');
      console.debug('1. Clearing caches...');
      DEV_UPDATE_HELPER.clearCaches().then(() => {
        console.debug('2. Invalidating CSS...');
        DEV_UPDATE_HELPER.simulateCSSUpdate();
        console.debug('3. Simulating automatic reload in 2 seconds...');
        setTimeout(() => {
          console.debug('4. 🔄 Auto-reloading now!');
          globalThis.location.reload();
        }, 2000);
      });
    }
  }
};

// Add to global scope for easy access in dev tools
if (import.meta.env.DEV) {
  globalThis.DEV_UPDATE_HELPER = DEV_UPDATE_HELPER;
  console.debug('🛠️ Update testing available: DEV_UPDATE_HELPER');
  console.debug('Commands:');
  console.debug('  - DEV_UPDATE_HELPER.simulateMajorUpdate() - Show major update notification');
  console.debug('  - DEV_UPDATE_HELPER.simulateMinorUpdate() - Show minor update notification');  
  console.debug('  - DEV_UPDATE_HELPER.simulatePatchUpdate() - Show patch update notification');
  console.debug('  - DEV_UPDATE_HELPER.resetUpdateState() - Clear all update state');
}
