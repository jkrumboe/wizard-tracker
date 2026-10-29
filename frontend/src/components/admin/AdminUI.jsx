/*
 * Building blocks shared by every admin page, so the pages compose one visual
 * language instead of each growing its own card, modal and alert markup.
 * Styles live in styles/pages/admin.css under the `adm-` prefix; the prefix keeps
 * them from colliding with app-wide classes (admin.css stays loaded once visited).
 */
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '@/components/ui/Icon';

const cx = (...classes) => classes.filter(Boolean).join(' ');

/** Title row of an admin page, with an optional back link and actions. */
export function AdminPageHeader({ title, subtitle, back, actions }) {
  return (
    <header className="adm-page-header">
      <div className="adm-page-heading">
        {back && (
          <Link to={back.to} className="adm-back-link">
            <Icon name="ArrowLeft" size={14} /> {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="adm-page-actions">{actions}</div>}
    </header>
  );
}

/** A card with a titled header. `tone` tints it: 'accent' | 'success' | 'danger'. */
export function AdminSection({ icon, title, description, actions, tone, className, children, as: Tag = 'section' }) {
  return (
    <Tag className={cx('adm-card', tone && `adm-card--${tone}`, className)}>
      {(title || actions) && (
        <div className="adm-card-header">
          <div className="adm-card-heading">
            {title && (
              <h2>
                {icon && <Icon name={icon} size={18} />}
                <span>{title}</span>
              </h2>
            )}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="adm-card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

/** Background and how-to text, collapsed so it doesn't push the tools down on phones. */
export function AdminExplainer({ title, children }) {
  return (
    <details className="adm-explainer">
      <summary>
        <Icon name="Info" size={16} />
        <span>{title}</span>
        <Icon name="ChevronDown" size={16} className="adm-explainer-chevron" />
      </summary>
      <div className="adm-explainer-body">{children}</div>
    </details>
  );
}

const NOTICE_ICONS = {
  info: 'Info',
  success: 'CheckCircle2',
  warning: 'AlertTriangle',
  error: 'AlertCircle',
};

export function AdminNotice({ tone = 'info', icon, title, children, onDismiss, className }) {
  const { t } = useTranslation();
  return (
    <div className={cx('adm-notice', `adm-notice--${tone}`, className)} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon || NOTICE_ICONS[tone]} size={18} className="adm-notice-icon" />
      <div className="adm-notice-body">
        {title && <strong>{title}</strong>}
        {children}
      </div>
      {onDismiss && (
        <button type="button" className="adm-icon-btn adm-icon-btn--plain" onClick={onDismiss} aria-label={t('common.close')}>
          <Icon name="X" size={16} />
        </button>
      )}
    </div>
  );
}

export function AdminEmpty({ icon = 'Inbox', title, children, tone }) {
  return (
    <div className={cx('adm-empty', tone && `adm-empty--${tone}`)}>
      <Icon name={icon} size={28} />
      {title && <strong>{title}</strong>}
      {children && <p>{children}</p>}
    </div>
  );
}

export function AdminLoading({ label }) {
  return (
    <div className="adm-loading" role="status">
      <Icon name="RefreshCw" size={20} className="adm-spin" />
      <span>{label}</span>
    </div>
  );
}

export function AdminStats({ children, className }) {
  return <div className={cx('adm-stats', className)}>{children}</div>;
}

/** One figure. `tone`: 'accent' | 'success' | 'warning' | 'danger'. */
export function AdminStat({ label, value, hint, icon, tone, trend }) {
  return (
    <div className={cx('adm-stat', tone && `adm-stat--${tone}`)}>
      {icon && (
        <span className="adm-stat-icon">
          <Icon name={icon} size={18} />
        </span>
      )}
      <div className="adm-stat-body">
        <span className="adm-stat-label">{label}</span>
        <span className="adm-stat-value">{value}</span>
        {hint && <span className="adm-stat-hint">{hint}</span>}
      </div>
      {trend !== undefined && trend !== null && (
        <span className={cx('adm-stat-trend', trend > 0 && 'is-up', trend < 0 && 'is-down')}>
          {trend > 0 ? '+' : ''}{trend}
        </span>
      )}
    </div>
  );
}

/** A checkbox drawn as a selectable option card with a hint line. */
export function AdminToggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={cx('adm-toggle', checked && 'is-on', disabled && 'is-disabled')}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="adm-toggle-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function AdminSearch({ value, onChange, placeholder, id, autoFocus }) {
  const { t } = useTranslation();
  const fallbackId = useId();
  const inputId = id || fallbackId;
  return (
    <div className="adm-search">
      <Icon name="Search" size={16} className="adm-search-icon" />
      <label htmlFor={inputId} className="sr-only">{placeholder}</label>
      <input
        id={inputId}
        type="search"
        className="adm-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {value && (
        <button type="button" className="adm-icon-btn adm-icon-btn--plain adm-search-clear" onClick={() => onChange('')} aria-label={t('common.clear')}>
          <Icon name="X" size={14} />
        </button>
      )}
    </div>
  );
}

/** Segmented control for a handful of mutually exclusive views. */
export function AdminTabs({ value, onChange, options, label }) {
  return (
    <div className="adm-tabs" role="tablist" aria-label={label}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={cx('adm-tab', value === option.value && 'is-active')}
          onClick={() => onChange(option.value)}
        >
          {option.icon && <Icon name={option.icon} size={15} />}
          <span>{option.label}</span>
          {option.count !== undefined && option.count !== null && (
            <span className="adm-tab-count">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Modal dialog: Escape and the backdrop close it unless `busy`, focus moves into
 * it and returns afterwards. Rendered into <body> so no scroll container clips it.
 */
export function AdminDialog({ title, icon, tone, onClose, busy = false, footer, children, size }) {
  const { t } = useTranslation();
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const firstField = panel?.querySelector('input, select, textarea');
    (firstField || panel)?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  return createPortal(
    <div className="adm-dialog-backdrop" onClick={() => !busy && onClose()}>
      <div
        ref={panelRef}
        className={cx('adm-dialog', size && `adm-dialog--${size}`, tone && `adm-dialog--${tone}`)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="adm-dialog-header">
          <h2 id={titleId}>
            {icon && <Icon name={icon} size={18} />}
            <span>{title}</span>
          </h2>
          <button type="button" className="adm-icon-btn adm-icon-btn--plain" onClick={onClose} disabled={busy} aria-label={t('common.close')}>
            <Icon name="X" size={18} />
          </button>
        </div>
        <div className="adm-dialog-body">{children}</div>
        {footer && <div className="adm-dialog-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/** Initial-letter avatar. */
export function AdminAvatar({ name }) {
  return <span className="adm-avatar" aria-hidden="true">{(name || '?').charAt(0).toUpperCase()}</span>;
}

/** Role / status pill. `tone`: 'accent' | 'success' | 'warning' | 'danger' | 'neutral'. */
export function AdminPill({ tone = 'neutral', icon, children }) {
  return (
    <span className={cx('adm-pill', `adm-pill--${tone}`)}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}
