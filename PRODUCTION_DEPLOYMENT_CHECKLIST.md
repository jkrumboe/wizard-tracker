# Production Deployment Checklist

## Service Worker Issues

### Problem: Stale Cache Entries (404 Errors)
**Symptoms:**
```
Uncaught (in promise) bad-precaching-response: bad-precaching-response :: [{"url":"https://wizard.jkrumboe.dev/assets/chart-vendor-C25iySBj.js","status":404}]
Event handler of 'install' event must be added on the initial evaluation of worker script.
```

**Root Cause:**
- Production build has old file hashes in service worker manifest
- Old cached files returning 404 when precaching tries to fetch them
- Service worker activation not clearing stale caches

**Fix Applied:**
1. ✅ Service worker now calls `self.skipWaiting()` immediately on install
2. ✅ Activation event clears ALL caches to force fresh precache
3. ✅ Users need to hard refresh (Ctrl+Shift+R) after deployment

**Required Steps:**
1. Run production build: `npm run build` (in frontend directory)
2. Deploy to production
3. Notify users to hard refresh their browsers
4. Alternatively: Update service worker version in package.json to force update

---

## Guest Player Identity Issues

### Problem: Guest Player Games Not Found After Linking
**Symptoms:**
- User links guest identity to their account
- Games played as guest don't appear in user's game list
- Screenshot shows linked identities but games missing

**Root Cause:**
- Table games route checks `linkedIdentities` but NOT `mergedInto` field
- When guest identity is linked, it's marked as `mergedInto: userIdentityId`
- Query needs to find BOTH linked AND merged identities

**Fix Applied:**
1. ✅ Updated `backend/routes/tableGames.js` GET `/:id` endpoint
2. ✅ Now finds guest identities that are `mergedInto` user's identity
3. ✅ Includes merged identity IDs when checking game participation

**Code Changes:**
```javascript
// Also find any guest identities that were merged into this user's identity
const mergedIdentities = await PlayerIdentity.find({
  mergedInto: userIdentity?._id,
  isDeleted: false
}).select('_id');
mergedIdentities.forEach(mi => {
  userIdentityIds.add(mi._id.toString());
});
```

---

## Player Linking Verification

### How to Test:
1. Create a guest player in a game
2. Register an account with same/similar name
3. Go to Admin → Player Linking
4. Link the guest identity to the user
5. Log in as that user
6. ✅ Games should now appear in user's game list

### Verification Points:
- [ ] Guest identity shows in "Unlinked Identities" tab
- [ ] Can link guest to user successfully
- [ ] After linking, identity moves to "Linked Identities" tab
- [ ] User can now see games they played as guest
- [ ] Statistics include games from guest identity

---

## Production Build Process

### Frontend Build:
```bash
cd frontend
npm run build
```

### Backend Deployment:
```bash
# Restart backend service (Docker or PM2)
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Post-Deployment Verification:
1. ✅ Check service worker version in browser console
2. ✅ Verify no 404 errors in precaching
3. ✅ Test player linking functionality
4. ✅ Verify games appear for linked identities
5. ✅ Check leaderboard includes merged identities

---

## Known Issues & Workarounds

### Issue: Users See Old Cached Version
**Workaround:** Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Issue: Service Worker Update Loop
**Solution:** Clear all site data in browser DevTools → Application → Storage

### Issue: Games Not Appearing After Link
**Solution:**
1. Log out and log back in
2. Check Admin → Player Linking to verify link status
3. Verify guest identity has `mergedInto` field set
4. Check backend logs for identity resolution errors

---

## Rollback Plan

If issues persist after deployment:

1. **Service Worker Issues:**
   ```javascript
   // Temporarily disable service worker registration
   // in frontend/src/main.jsx
   // Comment out: registerServiceWorker();
   ```

2. **Identity Issues:**
   - Run `unlinkGuestFromUser` to revert problematic links
   - Recalculate stats: POST `/api/identities/admin/recalculate-all`

3. **Full Rollback:**
   ```bash
   git revert <commit-hash>
   npm run build
   docker-compose up -d --build
   ```
