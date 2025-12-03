/**
 * URL Sanitization Utility
 * 
 * Provides safe URL validation and sanitization to prevent XSS attacks
 * through malicious URL schemes (javascript:, data:text/html, etc.)
 * 
 * SECURITY: Validates URL schemes against an allowlist before using
 * URLs in src attributes or other contexts where they could be executed.
 */

/**
 * Check if a URL has a safe scheme for use in image src attributes
 * 
 * @param {string} url - The URL to validate
 * @returns {boolean} True if the URL scheme is safe
 */
export function isSafeImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Trim whitespace
  const trimmedUrl = url.trim();
  
  if (trimmedUrl.length === 0) {
    return false;
  }

  // Allow relative URLs (no scheme, starts with / or ./)
  if (trimmedUrl.startsWith('/') || trimmedUrl.startsWith('./') || trimmedUrl.startsWith('../')) {
    return true;
  }

  // Allow blob URLs (created by URL.createObjectURL)
  if (trimmedUrl.startsWith('blob:')) {
    return true;
  }

  // Allow data URLs ONLY for images (not text/html or javascript)
  if (trimmedUrl.startsWith('data:')) {
    // Must be data:image/* specifically
    const dataMatch = trimmedUrl.match(/^data:([^;,]+)/);
    if (dataMatch && dataMatch[1]) {
      const mimeType = dataMatch[1].toLowerCase();
      return mimeType.startsWith('image/');
    }
    return false;
  }

  // Allow HTTP/HTTPS URLs
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    // Additional check: ensure no malicious patterns
    try {
      const urlObj = new URL(trimmedUrl);
      // Protocol must be http or https (redundant but explicit)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false; // Invalid URL
    }
  }

  // Explicitly block dangerous schemes
  const dangerousSchemes = [
    'javascript:',
    'vbscript:',
    'file:',
    'about:',
    'chrome:',
    'jar:',
    'view-source:',
  ];

  const lowerUrl = trimmedUrl.toLowerCase();
  for (const scheme of dangerousSchemes) {
    if (lowerUrl.startsWith(scheme)) {
      return false;
    }
  }

  // Default deny for unknown schemes
  return false;
}

/**
 * Sanitize a URL for use in an image src attribute
 * 
 * @param {string} url - The URL to sanitize
 * @param {string} fallbackUrl - URL to return if the input is unsafe (default: empty string)
 * @returns {string} Safe URL or fallback
 * 
 * @example
 * const safeUrl = sanitizeImageUrl(userProvidedUrl, '/default-avatar.png');
 * <img src={safeUrl} alt="Avatar" />
 */
export function sanitizeImageUrl(url, fallbackUrl = '') {
  if (isSafeImageUrl(url)) {
    return url;
  }
  
  console.warn('Blocked unsafe image URL:', url);
  return fallbackUrl;
}

/**
 * Validate and sanitize multiple URLs (e.g., for srcset or picture elements)
 * 
 * @param {string[]} urls - Array of URLs to validate
 * @param {string} fallbackUrl - Fallback URL for unsafe entries
 * @returns {string[]} Array of safe URLs
 */
export function sanitizeImageUrls(urls, fallbackUrl = '') {
  if (!Array.isArray(urls)) {
    return [];
  }
  
  return urls.map(url => sanitizeImageUrl(url, fallbackUrl));
}

export default {
  isSafeImageUrl,
  sanitizeImageUrl,
  sanitizeImageUrls
};
