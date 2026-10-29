import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAnalyticsConsent, setAnalyticsEnabled } from '@/shared/utils/analyticsConsent';
import '@/styles/components/consent-banner.css';

/**
 * Asks once whether usage analytics may run. Until the user answers, nothing
 * from Google loads. Accept and decline are equally prominent; the choice can
 * be changed later in Settings → Legal & Privacy.
 */
const ConsentBanner = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => getAnalyticsConsent() === null);

  if (!open) return null;

  const choose = (enabled) => {
    setAnalyticsEnabled(enabled);
    setOpen(false);
  };

  return (
    <section className="consent-banner" role="region" aria-labelledby="consent-banner-title">
      <h2 id="consent-banner-title" className="consent-banner-title">{t('consent.title')}</h2>
      <p className="consent-banner-text">
        {t('consent.text')}{' '}
        <Link to="/legal/privacy" className="consent-banner-link">{t('consent.learnMore')}</Link>
      </p>
      <div className="consent-banner-actions">
        <button type="button" className="consent-banner-btn" onClick={() => choose(false)}>
          {t('consent.decline')}
        </button>
        <button type="button" className="consent-banner-btn" onClick={() => choose(true)}>
          {t('consent.accept')}
        </button>
      </div>
    </section>
  );
};

export default ConsentBanner;
