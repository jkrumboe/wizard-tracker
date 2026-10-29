import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BackButton from '@/components/ui/BackButton';
import PoweredByBgg from '@/components/ui/PoweredByBgg';
import { ExternalLinkIcon } from '@/components/ui/Icon';
import {
  LEGAL_DOCS,
  LEGAL_LAST_UPDATED,
  LEGAL_OPERATOR,
  ISSUES_URL,
  LICENSE_URL,
  REPOSITORY_URL,
  hasImprint,
} from '@/shared/constants/legal';
import '@/styles/pages/legal.css';

// Runtime dependencies shipped in the bundle. Keep in step with frontend/package.json.
const THIRD_PARTY = [
  ['React / React DOM', 'MIT', 'https://react.dev'],
  ['React Router', 'MIT', 'https://reactrouter.com'],
  ['TanStack Query', 'MIT', 'https://tanstack.com/query'],
  ['i18next / react-i18next', 'MIT', 'https://www.i18next.com'],
  ['Dexie.js', 'Apache-2.0', 'https://dexie.org'],
  ['Lucide', 'ISC', 'https://lucide.dev'],
  ['Chart.js / react-chartjs-2', 'MIT', 'https://www.chartjs.org'],
  ['Recharts', 'MIT', 'https://recharts.org'],
  ['dnd kit', 'MIT', 'https://dndkit.com'],
  ['ZXing (browser)', 'MIT', 'https://github.com/zxing-js/library'],
  ['Axios', 'MIT', 'https://axios-http.com'],
  ['DOMPurify', 'MIT / Apache-2.0', 'https://github.com/cure53/DOMPurify'],
  ['Marked', 'MIT', 'https://marked.js.org'],
  ['react-easy-crop', 'MIT', 'https://github.com/ValentinH/react-easy-crop'],
  ['uuid', 'MIT', null],
];

const ExternalLink = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="legal-link">
    {children}
    <ExternalLinkIcon size={14} aria-hidden="true" />
  </a>
);

const Sections = ({ sections }) => (
  Array.isArray(sections) ? sections.map((section) => (
    <section key={section.title} className="legal-section">
      <h2>{section.title}</h2>
      {section.items && (
        <ul>
          {section.items.map((text) => <li key={text}>{text}</li>)}
        </ul>
      )}
      {section.paragraphs?.map((text) => <p key={text}>{text}</p>)}
    </section>
  )) : null
);

/**
 * Privacy policy, terms of use, imprint and licenses, at /legal/:doc.
 * Texts live in the locale files under `legal.*`; operator details come
 * from shared/constants/legal.js.
 */
const LegalPage = () => {
  const { t, i18n } = useTranslation();
  const { doc } = useParams();

  if (!LEGAL_DOCS.includes(doc) || (doc === 'imprint' && !hasImprint())) {
    return <Navigate to="/account" replace />;
  }

  const contact = LEGAL_OPERATOR.email || ISSUES_URL;
  const lastUpdated = new Date(LEGAL_LAST_UPDATED).toLocaleDateString(i18n.resolvedLanguage, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const sections = t(`legal.${doc}.sections`, { returnObjects: true, contact, defaultValue: [] });

  return (
    <div className="legal-page">
      <header className="legal-header">
        <BackButton fallback="/account" />
        <h1 className="games-title">{t(`legal.${doc}.title`)}</h1>
      </header>

      {doc !== 'imprint' && (
        <p className="legal-updated">{t('legal.lastUpdated', { date: lastUpdated })}</p>
      )}

      {doc === 'imprint' && (
        <section className="legal-section">
          <h2>{t('legal.imprint.operatorHeading')}</h2>
          <address className="legal-address">
            {LEGAL_OPERATOR.name}
            {LEGAL_OPERATOR.address.map((line) => <span key={line}><br />{line}</span>)}
          </address>
          <h2>{t('legal.imprint.contactHeading')}</h2>
          <p><a className="legal-link" href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a></p>
        </section>
      )}

      <Sections sections={sections} />

      {doc === 'licenses' && (
        <>
          <section className="legal-section">
            <h2>{t('legal.licenses.appLicenseHeading')}</h2>
            <p>{t('legal.licenses.appLicenseText')}</p>
            <p>
              <ExternalLink href={LICENSE_URL}>{t('legal.licenses.viewLicense')}</ExternalLink>
              {' · '}
              <ExternalLink href={REPOSITORY_URL}>{t('legal.licenses.sourceCode')}</ExternalLink>
            </p>
          </section>
          <section className="legal-section">
            <h2>{t('legal.licenses.thirdPartyHeading')}</h2>
            <p>{t('legal.licenses.thirdPartyText')}</p>
            <ul className="legal-deps">
              {THIRD_PARTY.map(([name, license, url]) => (
                <li key={name}>
                  {url ? <ExternalLink href={url}>{name}</ExternalLink> : <span>{name}</span>}
                  <span className="legal-dep-license">{license}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="legal-section">
            <h2>{t('legal.licenses.dataHeading')}</h2>
            <p>{t('legal.licenses.bggText')}</p>
            <PoweredByBgg />
          </section>
        </>
      )}

      {doc !== 'imprint' && (
        <p className="legal-contact">
          {t('legal.questions')}{' '}
          {LEGAL_OPERATOR.email
            ? <a className="legal-link" href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>
            : <ExternalLink href={ISSUES_URL}>{t('legal.openIssue')}</ExternalLink>}
        </p>
      )}
    </div>
  );
};

export default LegalPage;
