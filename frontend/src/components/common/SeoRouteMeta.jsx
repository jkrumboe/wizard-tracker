import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  SEO_VALUES,
  resolveSeoMeta,
  getCanonicalUrl,
} from '@/shared/constants/seo';

const OG_LOCALES = { en: 'en_US', de: 'de_DE' };

function upsertMetaTag(selector, attributes) {
  let element = document.querySelector(selector);

  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

function upsertCanonical(url) {
  let canonical = document.querySelector('link[rel="canonical"]');

  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }

  canonical.setAttribute('href', url);
}

export default function SeoRouteMeta() {
  const location = useLocation();
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];

  useEffect(() => {
    const { title, description, keywords, robots } = resolveSeoMeta(location.pathname);
    const canonicalUrl = getCanonicalUrl(location.pathname);

    document.title = title;

    upsertCanonical(canonicalUrl);
    upsertMetaTag('meta[name="description"]', {
      name: 'description',
      content: description,
    });
    upsertMetaTag('meta[name="keywords"]', {
      name: 'keywords',
      content: keywords,
    });
    upsertMetaTag('meta[name="robots"]', {
      name: 'robots',
      content: robots,
    });
    upsertMetaTag('meta[property="og:title"]', {
      property: 'og:title',
      content: title,
    });
    upsertMetaTag('meta[property="og:description"]', {
      property: 'og:description',
      content: description,
    });
    upsertMetaTag('meta[property="og:url"]', {
      property: 'og:url',
      content: canonicalUrl,
    });
    upsertMetaTag('meta[property="og:image"]', {
      property: 'og:image',
      content: SEO_VALUES.socialImageUrl,
    });
    upsertMetaTag('meta[property="og:image:alt"]', {
      property: 'og:image:alt',
      content: SEO_VALUES.socialImageAlt,
    });
    upsertMetaTag('meta[property="og:locale"]', {
      property: 'og:locale',
      content: OG_LOCALES[language] || OG_LOCALES.en,
    });
    upsertMetaTag('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: SEO_VALUES.twitterCard,
    });
    upsertMetaTag('meta[name="twitter:title"]', {
      name: 'twitter:title',
      content: title,
    });
    upsertMetaTag('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: description,
    });
    upsertMetaTag('meta[name="twitter:image"]', {
      name: 'twitter:image',
      content: SEO_VALUES.socialImageUrl,
    });

    if (SEO_VALUES.twitterHandle && !SEO_VALUES.twitterHandle.includes('REPLACE_ME')) {
      upsertMetaTag('meta[name="twitter:site"]', {
        name: 'twitter:site',
        content: SEO_VALUES.twitterHandle,
      });
    }
  }, [location.pathname, language]);

  return null;
}
