/**
 * Google Analytics consent (opt-in). Nothing from Google loads until the user
 * accepts in the consent banner or turns Usage Analytics on in Settings.
 * Withdrawing consent sets the `ga-disable-*` flag so the tag already on the
 * page stops sending; the scripts are gone from the next visit on.
 */
export const ANALYTICS_CONSENT_KEY = 'analyticsConsent';
// Opt-out flag from before consent was opt-in; an opt-out still counts as "denied"
const LEGACY_OPT_OUT_KEY = 'analyticsOptOut';
export const ANALYTICS_CONSENT_EVENT = 'analytics-consent-change';

const GTM_ID = 'GTM-TPXHXJXP';
const GA_MEASUREMENT_ID = 'G-25L8GWKF1W';

let loaded = false;

/** 'granted', 'denied', or null when the user has not decided yet. */
export const getAnalyticsConsent = () => {
  try {
    const value = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (value === 'granted' || value === 'denied') return value;
    if (localStorage.getItem(LEGACY_OPT_OUT_KEY) === 'true') return 'denied';
  } catch {
    // Storage blocked: treat as undecided, analytics stays off
  }
  return null;
};

export const isAnalyticsEnabled = () => getAnalyticsConsent() === 'granted';

const loadScript = (src) => {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
};

const loadAnalytics = () => {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;
  globalThis[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
  globalThis.dataLayer = globalThis.dataLayer || [];
  globalThis.gtag = function gtag() { globalThis.dataLayer.push(arguments); };
  globalThis.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied' });
  globalThis.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  loadScript(`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`);
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`);
  globalThis.gtag('js', new Date());
  globalThis.gtag('config', GA_MEASUREMENT_ID);
};

/** Call once at startup: loads analytics only for users who opted in. */
export const initAnalytics = () => {
  if (isAnalyticsEnabled()) loadAnalytics();
};

export const setAnalyticsEnabled = (enabled) => {
  try {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, enabled ? 'granted' : 'denied');
    localStorage.removeItem(LEGACY_OPT_OUT_KEY);
  } catch {
    // Storage blocked: the choice still applies to this session
  }
  if (enabled) {
    loadAnalytics();
    globalThis[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
  } else {
    globalThis[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
  }
  if (typeof globalThis.gtag === 'function') {
    globalThis.gtag('consent', 'update', { analytics_storage: enabled ? 'granted' : 'denied' });
  }
  globalThis.dispatchEvent?.(new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: { enabled } }));
};
