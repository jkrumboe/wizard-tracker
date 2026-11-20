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
import { Link } from 'react-router-dom';
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
  // Why the last explicit retry left games behind, so Retry never fails silently.
  const [retryProblem, setRetryProblem] = useState(null);

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
    setRetryProblem(null);
    try {
      // Explicit retry, so also pick up games that used up their automatic attempts.
      const result = await flushPendingUploads({ force: true });
      if (result?.reason === 'signed-out') {
        setRetryProblem({ type: 'signed-out' });
      } else if (result?.remaining > 0) {
        setRetryProblem({ type: 'failed', error: result.error });
      }
    } catch (error) {
      setRetryProblem({ type: 'failed', error: error?.message });
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

  const showProblem = isOnline && !isUploading && pending > 0 && retryProblem;
  let problemMessage = null;
  if (showProblem && retryProblem.type === 'signed-out') {
    problemMessage = (
      <>
        {t('sync.signInToUpload')} <Link to="/login">{t('sync.signIn')}</Link>
      </>
    );
  } else if (showProblem) {
    problemMessage = retryProblem.error
      ? t('sync.uploadFailedDetail', { error: retryProblem.error })
      : t('sync.uploadFailed');
  }

  return (
    <div
      className={`offline-status-bar ${isOnline ? 'is-pending' : 'is-offline'}`}
      role="status"
      aria-live="polite"
    >
      <span className="offline-bar-icon">{icon}</span>
      <span className="offline-bar-message">
        {message}
        {problemMessage && <span className="offline-bar-problem">{problemMessage}</span>}
      </span>

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
