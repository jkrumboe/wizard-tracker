/**
 * Who runs KeepWiz and how to reach them, shown on the legal pages.
 *
 * The imprint (Impressum) row only appears once `name`, `address` and `email`
 * are filled in; the other pages fall back to the GitHub issue tracker for
 * contact. Bump `LEGAL_LAST_UPDATED` whenever the policy texts in the locale
 * files change.
 */
export const LEGAL_OPERATOR = {
  name: '',
  // One line per entry, e.g. ['Musterstraße 1', '12345 Musterstadt', 'Germany']
  address: [],
  email: '',
};

export const LEGAL_LAST_UPDATED = '2026-10-28';

export const REPOSITORY_URL = 'https://github.com/jkrumboe/wizard-tracker';
export const ISSUES_URL = `${REPOSITORY_URL}/issues`;
export const LICENSE_URL = `${REPOSITORY_URL}/blob/main/LICENSE`;

export const LEGAL_DOCS = ['privacy', 'terms', 'imprint', 'licenses'];

export const hasImprint = () => Boolean(
  LEGAL_OPERATOR.name && LEGAL_OPERATOR.address.length && LEGAL_OPERATOR.email,
);
