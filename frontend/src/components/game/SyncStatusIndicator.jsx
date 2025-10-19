/**
 * @fileoverview Sync Status Indicator Component
 * Displays current sync status and connectivity information
 */

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { getSyncManager } from '../../shared/sync/syncManager';
import { db } from '../../shared/db/database';
import { SyncStatus } from '../../shared/schemas/syncMetadata';

export function SyncStatusIndicator({ gameId, showDetails = false, className = '' }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Update online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load initial sync status
    loadSyncStatus();

    // Set up sync manager listener
    let unsubscribe;
    try {
      const syncManager = getSyncManager();
      unsubscribe = syncManager.addListener(handleSyncEvent);
    } catch (error) {
      // Sync manager not initialized yet
      console.debug('Sync manager not available:', error.message);
    }

    // Poll for status updates every 10 seconds
    const pollInterval = setInterval(loadSyncStatus, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (unsubscribe) unsubscribe();
      clearInterval(pollInterval);
    };
  }, [gameId]);

  const loadSyncStatus = async () => {
    if (!gameId) return;

    try {
      const metadata = await db.getSyncMetadata(gameId);
      setSyncStatus(metadata);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const handleSyncEvent = (event) => {
    if (!gameId || (event.gameId && event.gameId !== gameId)) {
      return;
    }

    switch (event.type) {
      case 'online':
        setIsOnline(true);
        break;
      case 'offline':
        setIsOnline(false);
        break;
      case 'sync_start':
        setIsSyncing(true);
        break;
      case 'sync_complete':
      case 'sync_error':
      case 'sync_conflict':
        setIsSyncing(false);
        loadSyncStatus();
        break;
      default:
        break;
    }
  };

  const handleForceSync = async () => {
    if (!gameId || isSyncing || !isOnline) {
      return;
    }

    try {
      setIsSyncing(true);
      const syncManager = getSyncManager();
      await syncManager.syncGame(gameId, { force: true });
    } catch (error) {
      console.error('Force sync failed:', error);
    } finally {
      setIsSyncing(false);
      loadSyncStatus();
    }
  };

  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="w-4 h-4 text-red-500" />;
    }

    if (isSyncing) {
      return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
    }

    if (!syncStatus) {
      return <Cloud className="w-4 h-4 text-gray-400" />;
    }

    switch (syncStatus.syncStatus) {
      case SyncStatus.SYNCED:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case SyncStatus.PENDING:
        return <RefreshCw className="w-4 h-4 text-yellow-500" />;
      case SyncStatus.SYNCING:
        return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      case SyncStatus.CONFLICT:
      case SyncStatus.ERROR:
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case SyncStatus.OFFLINE:
        return <CloudOff className="w-4 h-4 text-gray-500" />;
      default:
        return <Cloud className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    if (!isOnline) {
      return 'Offline';
    }

    if (isSyncing) {
      return 'Syncing...';
    }

    if (!syncStatus) {
      return 'Unknown';
    }

    switch (syncStatus.syncStatus) {
      case SyncStatus.SYNCED:
        return 'Synced';
      case SyncStatus.PENDING:
        return `${syncStatus.pendingEventsCount} pending`;
      case SyncStatus.SYNCING:
        return 'Syncing...';
      case SyncStatus.CONFLICT:
        return 'Conflict';
      case SyncStatus.ERROR:
        return 'Sync error';
      case SyncStatus.OFFLINE:
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return 'text-red-500';
    if (isSyncing) return 'text-blue-500';
    if (!syncStatus) return 'text-gray-400';

    switch (syncStatus.syncStatus) {
      case SyncStatus.SYNCED:
        return 'text-green-500';
      case SyncStatus.PENDING:
        return 'text-yellow-500';
      case SyncStatus.SYNCING:
        return 'text-blue-500';
      case SyncStatus.CONFLICT:
      case SyncStatus.ERROR:
        return 'text-red-500';
      case SyncStatus.OFFLINE:
        return 'text-gray-500';
      default:
        return 'text-gray-400';
    }
  };

  const getDetailedStatus = () => {
    if (!syncStatus) return null;

    const details = [];

    if (!isOnline) {
      details.push('Device is offline');
    }

    if (syncStatus.pendingEventsCount > 0) {
      details.push(`${syncStatus.pendingEventsCount} change${syncStatus.pendingEventsCount !== 1 ? 's' : ''} waiting to sync`);
    }

    if (syncStatus.lastError) {
      details.push(`Error: ${syncStatus.lastError}`);
    }

    if (syncStatus.hasConflict) {
      details.push('Conflict requires manual resolution');
    }

    const lastSync = syncStatus.lastServerAck
      ? new Date(syncStatus.lastServerAck).toLocaleString()
      : 'Never';
    details.push(`Last synced: ${lastSync}`);

    return details;
  };

  if (!showDetails) {
    // Compact mode - just icon
    return (
      <div
        className={`relative inline-flex items-center ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          onClick={handleForceSync}
          disabled={!isOnline || isSyncing}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={getStatusText()}
        >
          {getStatusIcon()}
        </button>

        {showTooltip && (
          <div className="absolute z-50 top-full mt-2 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              {getStatusIcon()}
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
            {getDetailedStatus()?.map((detail, idx) => (
              <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {detail}
              </div>
            ))}
            {isOnline && syncStatus?.pendingEventsCount > 0 && (
              <button
                onClick={handleForceSync}
                disabled={isSyncing}
                className="mt-2 w-full text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                Sync Now
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Detailed mode
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={`font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        
        {isOnline && syncStatus?.pendingEventsCount > 0 && (
          <button
            onClick={handleForceSync}
            disabled={isSyncing}
            className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            {isSyncing ? (
              <>
                <Loader className="w-3 h-3 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3" />
                Sync Now
              </>
            )}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {getDetailedStatus()?.map((detail, idx) => (
          <div key={idx} className="text-sm text-gray-600 dark:text-gray-400">
            {detail}
          </div>
        ))}
      </div>

      {syncStatus?.storageUsed > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500">
            Storage used: {(syncStatus.storageUsed / 1024).toFixed(2)} KB
          </div>
        </div>
      )}
    </div>
  );
}

export default SyncStatusIndicator;
