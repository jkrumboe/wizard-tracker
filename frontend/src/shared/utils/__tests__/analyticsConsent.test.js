import { describe, it, expect, beforeEach } from 'vitest';
import {
  ANALYTICS_CONSENT_KEY,
  getAnalyticsConsent,
  initAnalytics,
  isAnalyticsEnabled,
  setAnalyticsEnabled,
} from '../analyticsConsent';

const googleScripts = () => [...document.querySelectorAll('script[src*="googletagmanager.com"]')];

describe('analyticsConsent', () => {
  beforeEach(() => {
    localStorage.clear();
    googleScripts().forEach((s) => s.remove());
  });

  it('is undecided and off by default, and loads nothing', () => {
    expect(getAnalyticsConsent()).toBeNull();
    expect(isAnalyticsEnabled()).toBe(false);
    initAnalytics();
    expect(googleScripts()).toHaveLength(0);
  });

  it('treats the old opt-out flag as declined', () => {
    localStorage.setItem('analyticsOptOut', 'true');
    expect(getAnalyticsConsent()).toBe('denied');
  });

  it('declining stores the choice and sets the GA disable flag', () => {
    setAnalyticsEnabled(false);
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('denied');
    expect(globalThis['ga-disable-G-25L8GWKF1W']).toBe(true);
    expect(googleScripts()).toHaveLength(0);
  });

  it('accepting stores the choice and loads the scripts', () => {
    setAnalyticsEnabled(true);
    expect(isAnalyticsEnabled()).toBe(true);
    expect(globalThis['ga-disable-G-25L8GWKF1W']).toBe(false);
    expect(googleScripts().length).toBeGreaterThan(0);
  });
});
