import React, { useState } from 'react';
import { getTemplateImageUrl } from '@/shared/utils/gameInfoStore';

/**
 * Box art for a game template (from a barcode scan). Renders nothing when the
 * template has no picture or the image fails to load.
 */
const GameThumbnail = ({ template, size = 'thumbnail', className = 'game-thumbnail' }) => {
  const [failed, setFailed] = useState(false);
  const url = getTemplateImageUrl(template, size);
  if (!url || failed) return null;

  return (
    <img
      className={className}
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
};

export default GameThumbnail;
