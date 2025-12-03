/**
 * Secure Markdown Parser and Sanitizer
 * 
 * This utility provides safe markdown-to-HTML conversion by:
 * 1. Parsing markdown with the 'marked' library
 * 2. Sanitizing the resulting HTML with DOMPurify to prevent XSS attacks
 * 
 * SECURITY: This prevents stored XSS vulnerabilities when rendering
 * user-provided markdown content from the database.
 */

import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

// Configure marked options
marked.setOptions({
  breaks: true,      // Convert \n to <br>
  gfm: true,         // GitHub Flavored Markdown
  headerIds: false,  // Disable header IDs (security)
  mangle: false      // Don't mangle email addresses
});

// Configure DOMPurify options
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'span', 'div',
    'strong', 'em', 'b', 'i', 'u', 's', 'code', 'pre',
    'ul', 'ol', 'li',
    'blockquote',
    'a',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'hr'
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'class',
    'align', // for table cells
  ],
  // Allow common safe protocols only
  ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel):/i,
  ALLOW_DATA_ATTR: false,
  SAFE_FOR_TEMPLATES: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_TRUSTED_TYPE: false
};

/**
 * Safely parse and sanitize markdown content
 * 
 * @param {string} markdown - Raw markdown text from user input or database
 * @returns {string} Sanitized HTML string safe for dangerouslySetInnerHTML
 * 
 * @example
 * const html = safeMarkdownToHtml('**Bold** and [link](http://example.com)');
 * <div dangerouslySetInnerHTML={{ __html: html }} />
 */
export function safeMarkdownToHtml(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  try {
    // Step 1: Parse markdown to HTML
    const html = marked.parse(markdown);
    
    // Step 2: Sanitize the HTML to remove any malicious content
    const sanitized = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
    
    return sanitized;
  } catch (error) {
    console.error('Error parsing markdown:', error);
    return '';
  }
}

/**
 * Check if markdown contains potentially dangerous content
 * (For additional validation before saving to database)
 * 
 * @param {string} markdown - Raw markdown text
 * @returns {boolean} True if content appears safe
 */
export function isMarkdownSafe(markdown) {
  if (!markdown) return true;
  
  // Check for suspicious patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers like onclick=
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(markdown));
}

export default safeMarkdownToHtml;
