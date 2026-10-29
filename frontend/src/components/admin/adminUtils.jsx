/*
 * Non-component helpers for the admin pages (kept apart from AdminUI.jsx so
 * that file only exports components and fast refresh keeps working).
 */
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminDialog } from './AdminUI';

/**
 * "3 min ago" style time in the UI language, falling back to a date after a week.
 * @param {string|Date} value
 * @param {string} locale
 */
export function formatRelativeTime(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 60) return format.format(0, 'second');
  if (abs < 3600) return format.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return format.format(Math.round(seconds / 3600), 'hour');
  if (abs < 604800) return format.format(Math.round(seconds / 86400), 'day');
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * In-app replacement for window.confirm.
 * `const [confirm, confirmDialog] = useAdminConfirm();` then render `confirmDialog`
 * and `if (!(await confirm({ title, message }))) return;`
 */
export function useAdminConfirm() {
  const { t } = useTranslation();
  const [request, setRequest] = useState(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    setRequest({ ...options, resolve });
  }), []);

  const settle = useCallback((answer) => {
    setRequest((current) => {
      current?.resolve(answer);
      return null;
    });
  }, []);

  const dialog = request ? (
    <AdminDialog
      title={request.title}
      icon={request.icon || (request.tone === 'danger' ? 'AlertTriangle' : 'Info')}
      tone={request.tone}
      size="sm"
      onClose={() => settle(false)}
      footer={(
        <>
          <button type="button" className="adm-btn adm-btn--ghost" onClick={() => settle(false)}>
            {request.cancelLabel || t('common.cancel')}
          </button>
          <button
            type="button"
            className={`adm-btn ${request.tone === 'danger' ? 'adm-btn--danger' : 'adm-btn--primary'}`}
            onClick={() => settle(true)}
          >
            {request.confirmLabel || t('common.confirm')}
          </button>
        </>
      )}
    >
      {typeof request.message === 'string' ? <p className="adm-dialog-text">{request.message}</p> : request.message}
    </AdminDialog>
  ) : null;

  return [confirm, dialog];
}
