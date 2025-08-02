/**
 * Development Update Helper - Automatic Update System
 * 
 * This utility helps test automatic update functionality during development
 */

export const DEV_UPDATE_HELPER = {
  // Simulate an automatic update
  simulateAutoUpdate: () => {
    if (import.meta.env.DEV) {
     console.debug('🔄 Simulating automatic update...');
      // Simulate the update detection and automatic reload
      setTimeout(() => {
       console.debug('📦 New version detected - updating automatically...');
        DEV_UPDATE_HELPER.clearCaches().then(() => {
         console.debug('� Reloading with fresh content...');
          window.location.reload();
        });
      }, 1000);
    }
  },

  // Force clear all caches
  clearCaches: async () => {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
     console.debug('🗑️ All caches cleared');
    }
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
          window.location.reload();
        }, 2000);
      });
    }
  }
};

// Add to global scope for easy access in dev tools
if (import.meta.env.DEV) {
  window.DEV_UPDATE_HELPER = DEV_UPDATE_HELPER;
  console.debug('🛠️ Auto-update helper available: window.DEV_UPDATE_HELPER');
 console.debug('Commands:');
 console.debug('  - DEV_UPDATE_HELPER.simulateAutoUpdate() - Test automatic update');
 console.debug('  - DEV_UPDATE_HELPER.clearCaches() - Clear all caches');
 console.debug('  - DEV_UPDATE_HELPER.simulateCSSUpdate() - Reload CSS files');
 console.debug('  - DEV_UPDATE_HELPER.testAutoUpdateFlow() - Test complete flow');
}
