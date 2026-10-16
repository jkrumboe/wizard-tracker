import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from '@/components/ui/Icon';
import { useGoBack } from '@/shared/hooks/useGoBack';
import '@/styles/components/header-icon-button.css';

/**
 * The one back button for page headers: a square icon button with a plain arrow.
 *
 * By default it steps back in app history, or opens `fallback` when the page
 * was the first one opened (deep link, shared URL, PWA start). `to` renders a
 * fixed Link instead; `onClick` replaces the behaviour entirely. `showLabel`
 * adds the text, for standalone use on error screens.
 */
const BackButton = ({
  fallback = '/',
  to,
  onClick,
  label,
  showLabel = false,
  disabled = false,
  className = '',
}) => {
  const { t } = useTranslation();
  const goBack = useGoBack(fallback);
  const text = label || t('common.goBack');
  const classes = ['header-icon-btn', showLabel && 'with-label', className].filter(Boolean).join(' ');
  const content = (
    <>
      <ArrowLeftIcon size={20} aria-hidden="true" />
      {showLabel && <span>{text}</span>}
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={classes} aria-label={showLabel ? undefined : text} title={text}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick || goBack}
      disabled={disabled}
      aria-label={showLabel ? undefined : text}
      title={text}
    >
      {content}
    </button>
  );
};

BackButton.propTypes = {
  fallback: PropTypes.string,
  to: PropTypes.string,
  onClick: PropTypes.func,
  label: PropTypes.string,
  showLabel: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default BackButton;
