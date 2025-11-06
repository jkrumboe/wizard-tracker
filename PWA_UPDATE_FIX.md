# PWA Update System - Fixed for Mobile & PWA

## Problem
The PWA update notification was showing in an infinite loop on mobile devices and installed PWA apps, particularly after the update was applied. This was caused by:

1. **Hard-coded service worker cache version** - Not synced with package.json version
2. **No update state persistence** - State was lost across page reloads
3. **Multiple `controllerchange` events** - Mobile browsers trigger this event multiple times
4. **No cooldown period** - Updates could be re-triggered immediately after completing
5. **False positive updates** - Update screen showing even when no new version was available

## Solution

### 1. Version Management
- **Automatic version injection**: The app version from `package.json` is now automatically injected into the service worker during build
- **Version tracking**: Both the service worker and the app use the same version number
- **Version storage**: The current version is stored in localStorage to detect actual updates

### 2. Update State Persistence (localStorage)
We now use three localStorage keys to track update state across page reloads:

```javascript
const UPDATE_STATE_KEY = 'pwa_update_state';           // 'updating' or 'completed'
const LAST_VERSION_KEY = 'pwa_last_version';           // e.g., '1.2.4'
const UPDATE_TIMESTAMP_KEY = 'pwa_update_timestamp';   // Unix timestamp
```

### 3. Cooldown Period
- **10-second cooldown**: After an update completes, no new update checks for 10 seconds
- **Prevents loops**: If an update was applied <10 seconds ago, the update check is skipped
- **Auto-cleanup**: The update state is automatically cleared after the cooldown period

### 4. Throttled Update Checks
- **Minimum delay**: 10 seconds between update checks
- **Visibility checks**: Only check for updates when the page is visible
- **State validation**: Check localStorage before running update logic

### 5. Single-Event Handling
- **Ref guards**: Multiple refs prevent duplicate event handling
- **Controller change guard**: Prevents processing multiple `controllerchange` events
- **Update in progress flag**: Global flag prevents concurrent updates

### 6. Version Verification
- **Actual version comparison**: Update screen only shows when a genuinely new version is detected
- **Worker version checking**: Queries both active and waiting service workers for their versions
- **Skip false positives**: If versions match, update process is skipped entirely

## Files Modified

### Frontend
1. **`frontend/public/service-worker.js`**
   - Added version placeholder `__APP_VERSION__`
   - Added version response message handler
   - Improved logging with version numbers

2. **`frontend/src/components/common/UpdateNotification.jsx`**
   - Added localStorage-based state persistence
   - Added 10-second cooldown mechanism
   - Added version checking via service worker messaging
   - **Added version verification for waiting/installing workers**
   - **Only shows update screen when versions actually differ**
   - Prevents multiple `controllerchange` event handling

3. **`frontend/src/app/serviceWorkerRegistration.js`**
   - Added throttled update checks
   - Added minimum delay between checks (10 seconds)
   - Added update state validation from localStorage
   - Better visibility and state checking

4. **`frontend/vite.config.js`**
   - Reads version from package.json
   - Defines `__APP_VERSION__` global variable
   - Post-build plugin to inject version into service worker

5. **`frontend/scripts/inject-sw-version.js`** (NEW)
   - Standalone script to inject version into built service worker
   - Runs after `vite build` completes
   - Provides clear success/error feedback

6. **`frontend/package.json`**
   - Updated `build` script to include version injection
   - Updated `build:with-version` script

7. **`frontend/src/app/App.jsx`**
   - Added version logging on app start

## Build Process

The version injection happens in two stages:

1. **During Vite build**: Version is defined as a global variable for the app code
2. **Post-build script**: Version placeholder in service worker is replaced with actual version

```bash
# Regular build (uses version from package.json)
npm run build

# Build with version update (increments patch version)
npm run build:with-version
```

## How It Works

### Update Flow
1. Service worker detects a new version is available
2. `UpdateNotification` component checks localStorage for recent updates
3. If no recent update (>10 seconds ago), proceed with version check
4. **Compare current service worker version with waiting/installing worker version**
5. **Only proceed if versions are different**
6. Set `UPDATE_STATE_KEY` to 'updating' in localStorage
5. Show loading screen to user
6. Clear all caches
7. Tell service worker to skip waiting
8. On `controllerchange`, set state to 'completed' with timestamp
9. Reload the page
10. On next load, cooldown period prevents re-triggering update

### Preventing Loops
```javascript
// Check if we just completed an update
const updateState = localStorage.getItem('pwa_update_state');
const updateTimestamp = localStorage.getItem('pwa_update_timestamp');

if (updateState === 'completed' && updateTimestamp) {
  const timeSinceUpdate = Date.now() - parseInt(updateTimestamp, 10);
  if (timeSinceUpdate < 10000) {
    // Skip - too soon after last update
    return;
  }
}
```

## Testing

### Test on Desktop
1. Build and deploy a new version
2. Open the app in a browser
3. Update should show loading screen once and reload
4. Check console for version logs
5. Verify no infinite loop

### Test on Mobile/PWA
1. Install the PWA on a mobile device
2. Build and deploy a new version
3. Open the installed PWA
4. Update should show loading screen once and reload
5. Open browser DevTools (via USB debugging)
6. Verify no infinite loop in console
7. Check that update state is properly stored in localStorage

### Manual Testing
```javascript
// In browser console, simulate an update loop scenario
localStorage.setItem('pwa_update_state', 'completed');
localStorage.setItem('pwa_update_timestamp', Date.now().toString());

// Reload - should NOT trigger update
location.reload();

// Wait 10+ seconds, then reload - CAN trigger update if new version available
```

## Debugging

Enable detailed logging by checking the browser console for:
- `KeepWiz v{version}` on app load
- `Service Worker v{version} taking control of all clients`
- `Update check - Current: {version}, SW: {version}`
- `Update recently completed, skipping update check`
- `Controller change already handled, ignoring`

## Version Bumping

```bash
# Frontend only
cd frontend
npm version patch  # 1.2.4 -> 1.2.5
npm version minor  # 1.2.5 -> 1.3.0
npm version major  # 1.3.0 -> 2.0.0

# Then build with the new version
npm run build
```

## Important Notes

- **Update cooldown is 10 seconds**: This prevents loops but means rapid updates won't work
- **localStorage is required**: If a user clears localStorage, the cooldown won't work (but update will still work)
- **Mobile browsers**: Some mobile browsers are more aggressive with `controllerchange` events - the guards handle this
- **Cache clearing**: On update, all caches are cleared for a clean install
- **Background updates**: The app checks for updates every 5 minutes and when the page becomes visible

## Rollback Plan

If issues occur, you can:

1. **Disable automatic updates**: Set `registerType: "prompt"` in vite.config.js (already set)
2. **Clear update state**: `localStorage.removeItem('pwa_update_state')`
3. **Unregister service worker**: Run in console: `navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()))`
4. **Hard reload**: Ctrl+Shift+R (Cmd+Shift+R on Mac) or clear cache manually
