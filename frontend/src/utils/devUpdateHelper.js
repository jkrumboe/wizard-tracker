/**
 * Development Update Helper - Automatic Update System
 * 
 * This utility helps test automatic update functionality during development
 */

export const DEV_UPDATE_HELPER = {
  // Simulate an automatic update
  simulateAutoUpdate: () => {
    if (import.meta.env.DEV) {
      console.log('🔄 Simulating automatic update...');
      // Simulate the update detection and automatic reload
      setTimeout(() => {
        console.log('📦 New version detected - updating automatically...');
        DEV_UPDATE_HELPER.clearCaches().then(() => {
          console.log('� Reloading with fresh content...');
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
      console.log('🗑️ All caches cleared');
    }
  },

  // Simulate CSS update with cache busting
  simulateCSSUpdate: () => {
    if (import.meta.env.DEV) {
      console.log('🎨 Simulating CSS update...');
      const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
      cssLinks.forEach(link => {
        const href = link.href;
        const separator = href.includes('?') ? '&' : '?';
        link.href = `${href}${separator}v=${Date.now()}`;
      });
      console.log('✅ CSS cache invalidated');
    }
  },

  // Test the complete automatic update flow
  testAutoUpdateFlow: () => {
    if (import.meta.env.DEV) {
      console.log('🧪 Testing complete auto-update flow...');
      console.log('1. Clearing caches...');
      DEV_UPDATE_HELPER.clearCaches().then(() => {
        console.log('2. Invalidating CSS...');
        DEV_UPDATE_HELPER.simulateCSSUpdate();
        console.log('3. Simulating automatic reload in 2 seconds...');
        setTimeout(() => {
          console.log('4. 🔄 Auto-reloading now!');
          window.location.reload();
        }, 2000);
      });
    }
  }
};

// Add to global scope for easy access in dev tools
if (import.meta.env.DEV) {
  window.DEV_UPDATE_HELPER = DEV_UPDATE_HELPER;
  console.log('🛠️ Auto-update helper available: window.DEV_UPDATE_HELPER');
  console.log('Commands:');
  console.log('  - DEV_UPDATE_HELPER.simulateAutoUpdate() - Test automatic update');
  console.log('  - DEV_UPDATE_HELPER.clearCaches() - Clear all caches');
  console.log('  - DEV_UPDATE_HELPER.simulateCSSUpdate() - Reload CSS files');
  console.log('  - DEV_UPDATE_HELPER.testAutoUpdateFlow() - Test complete flow');
}
