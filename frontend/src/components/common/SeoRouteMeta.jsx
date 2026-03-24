import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  SEO_VALUES,
  SEO_ROUTE_META,
  SEO_NOINDEX_PATTERNS,
} from '@/shared/constants/seo';

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

  useEffect(() => {
    const matchedRoute = SEO_ROUTE_META.find(({ pattern }) =>
      pattern.test(location.pathname)
    );

    const shouldNoindex = SEO_NOINDEX_PATTERNS.some((pattern) =>
      pattern.test(location.pathname)
    );

    const title = matchedRoute?.title || SEO_VALUES.defaultTitle;
    const description =
      matchedRoute?.description || SEO_VALUES.defaultDescription;
    const keywords = matchedRoute?.keywords || SEO_VALUES.defaultKeywords;
    const robots = shouldNoindex
      ? 'noindex,nofollow'
      : matchedRoute?.robots || 'index,follow';

    const canonicalUrl = `${SEO_VALUES.siteUrl}${location.pathname}`;

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
    upsertMetaTag('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: 'summary_large_image',
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
  }, [location.pathname]);

  return null;
}
