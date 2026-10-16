import { useState } from 'react';
import { sanitizeImageUrl } from '@/shared/utils/urlSanitizer';
import '@/styles/components/player-avatar.css';

const getInitials = (name) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Rounded-square player picture with an initials fallback.
 * @param {string} name - Player name, used for alt text and initials
 * @param {string|null} src - Image url, falls back to initials when empty or broken
 * @param {number} size - Edge length in pixels
 * @param {string} className - Extra classes (e.g. role rings)
 * @param {React.ReactNode} children - Overlay content such as a role marker
 */
export function PlayerAvatar({ name, src, size = 36, className = '', children }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const safeSrc = src ? sanitizeImageUrl(src, '') : '';
  const showImage = safeSrc && failedSrc !== safeSrc;

  return (
    <span
      className={`player-avatar-circle ${className}`.trim()}
      style={{ '--avatar-size': `${size}px` }}
    >
      {showImage ? (
        <img src={safeSrc} alt={name || ''} onError={() => setFailedSrc(safeSrc)} />
      ) : (
        <span className="player-avatar-initials" aria-hidden="true">{getInitials(name)}</span>
      )}
      {children}
    </span>
  );
}

export default PlayerAvatar;
