/**
 * @fileoverview Global offline / pending-upload strip.
 *
 * Offline is a normal state in this app rather than an error: scoring keeps
 * working and finished games queue up. This strip is the one place that says so,
 * so no screen needs its own offline handling. It renders nothing at all when
 * the app is online with an empty queue.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff, UploadCloud, RefreshCw } from 'lucide-react';
import {
  PENDING_UPLOADS_EVENT,
  flushPendingUploads,
  getPendingUploadCount,
} from '@/shared/sync/pendingUploads';
import '@/styles/components/offline-status-bar.css';

const OfflineStatusBar = () => {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [pending, setPending] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const refreshCount = useCallback(() => {
    try {
      setPending(getPendingUploadCount());
    } catch {
      setPending(0);
    }
  }, []);

  useEffect(() => {
    refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      refreshCount();
    };
    const handleOffline = () => setIsOnline(false);

    const handleQueueChange = (event) => {
      const detail = event.detail || {};
      setIsUploading(detail.status === 'uploading');
      if (typeof detail.pending === 'number') {
        setPending(detail.pending);
      } else {
        refreshCount();
      }
    };

    globalThis.addEventListener('online', handleOnline);
    globalThis.addEventListener('offline', handleOffline);
    globalThis.addEventListener(PENDING_UPLOADS_EVENT, handleQueueChange);
    globalThis.addEventListener('gameUploaded', refreshCount);

    return () => {
      globalThis.removeEventListener('online', handleOnline);
      globalThis.removeEventListener('offline', handleOffline);
      globalThis.removeEventListener(PENDING_UPLOADS_EVENT, handleQueueChange);
      globalThis.removeEventListener('gameUploaded', refreshCount);
    };
  }, [refreshCount]);

  const handleRetry = useCallback(async () => {
    setIsUploading(true);
    try {
      // Explicit retry, so also pick up games that used up their automatic attempts.
      await flushPendingUploads({ force: true });
    } finally {
      setIsUploading(false);
      refreshCount();
    }
  }, [refreshCount]);

  // Online, nothing waiting: stay out of the way entirely.
  if (isOnline && pending === 0 && !isUploading) {
    return null;
  }

  let icon;
  let message;

  if (!isOnline) {
    icon = <WifiOff size={16} aria-hidden="true" />;
    message = t('sync.offlineSaved');
  } else if (isUploading) {
    icon = <RefreshCw size={16} className="offline-bar-spin" aria-hidden="true" />;
    message = t('sync.uploadingGames', { count: pending });
  } else {
    icon = <UploadCloud size={16} aria-hidden="true" />;
    message = t('sync.gamesWaiting', { count: pending });
  }

  return (
    <div
      className={`offline-status-bar ${isOnline ? 'is-pending' : 'is-offline'}`}
      role="status"
      aria-live="polite"
    >
      <span className="offline-bar-icon">{icon}</span>
      <span className="offline-bar-message">{message}</span>

      {!isOnline && pending > 0 && (
        <span className="offline-bar-count">{t('sync.pending', { count: pending })}</span>
      )}

      {isOnline && pending > 0 && !isUploading && (
        <button type="button" className="offline-bar-action" onClick={handleRetry}>
          {t('sync.retry')}
        </button>
      )}
    </div>
  );
};

export default OfflineStatusBar;
