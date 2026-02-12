import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '@/shared/i18n/i18n';

/**
 * LanguageSwitcher — renders a row of language buttons.
 * The active language gets a highlighted style.
 */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const handleChange = (code) => {
    i18n.changeLanguage(code);
  };

  return (
    <div className="language-switcher">
      {supportedLanguages.map((lang) => (
        <button
          key={lang.code}
          className={`language-btn ${i18n.resolvedLanguage === lang.code ? 'active' : ''}`}
          onClick={() => handleChange(lang.code)}
          title={lang.name}
          aria-label={lang.name}
        >
          <span className="language-flag">{lang.flag}</span>
          <span className="language-name">{lang.name}</span>
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
