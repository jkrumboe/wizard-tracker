import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, SearchIcon, ImagePlusIcon, ScanBarcodeIcon } from '@/components/ui/Icon';
import GameMatchPicker, { GameCandidate } from '@/components/game/GameMatchPicker';
import BarcodeScanPanel from '@/components/game/BarcodeScanPanel';
import gameTemplateService from '@/shared/api/gameTemplateService';
import { attachGameInfo } from '@/shared/utils/attachGameInfo';
import { linkBarcode } from '@/shared/utils/barcodeTemplateMap';
import { notifyTemplatesChanged } from '@/shared/hooks/useGameTemplates';
import { useModalDismiss } from '@/shared/hooks/useModalDismiss';
import { useUser } from '@/shared/hooks/useUser';
import '@/styles/components/modal.css';
import '@/styles/components/scan-barcode-modal.css';

/**
 * Find box art and BoardGameGeek info for a game that already exists (e.g. one
 * added before scanning existed) by looking its name up or scanning its box.
 * `displayName` and `initialQuery` default to the template's name; editions pass
 * a readable "<game> <edition>" since their template name is only a storage key.
 * `barcodeName` is the game a scanned barcode gets linked to, so later scans open
 * it; null when there is no startable game of that name (built-in editions).
 * `onPickInfo(gameInfo, details)` takes the picked info instead of attaching it
 * (e.g. to suggest other box art to the admins), with `title` and `description`
 * to match.
 */
const FindGameInfoModal = ({
  isOpen, onClose, template, displayName, initialQuery, barcodeName, onPickInfo, title, description,
}) => {
  const { t } = useTranslation();
  const { user } = useUser();
  const [query, setQuery] = useState('');
  const [step, setStep] = useState('search'); // 'search' | 'scan' | 'lookup' | 'candidates'
  const [notice, setNotice] = useState('');
  // Unverified barcode lookup: the games the box could be
  const [product, setProduct] = useState(null);
  const [scannedCode, setScannedCode] = useState('');

  // Bumped on close and on Back so a late barcode lookup doesn't act
  const lookupSessionRef = useRef(0);

  const linkName = barcodeName === undefined ? template?.name : barcodeName;

  useEffect(() => {
    if (!isOpen) return undefined;
    setQuery(initialQuery ?? template?.name ?? '');
    setStep('search');
    setNotice('');
    setProduct(null);
    return () => { lookupSessionRef.current += 1; };
  }, [isOpen, initialQuery, template?.name]);

  const attach = (gameInfo, details) => {
    if (onPickInfo) {
      onPickInfo(gameInfo, details || {});
    } else {
      // Art for a shared game is reviewed by an admin first; this device shows it right away
      const suggestion = attachGameInfo(template, gameInfo, details || {}, { suggest: user?.role !== 'admin' });
      notifyTemplatesChanged();
      suggestion
        ?.then(() => alert(t('gameType.boxArtSuggested')))
        .catch((error) => {
          console.error('Error suggesting box art:', error);
          alert(`${t('gameType.boxArtSuggestFailed')}

${error.message}`);
        });
    }
    onClose();
  };

  const handleCode = async (code) => {
    setScannedCode(code);
    setStep('lookup');
    const session = lookupSessionRef.current;
    const found = await gameTemplateService.lookupBarcodeProduct(code);
    if (session !== lookupSessionRef.current) return;

    if (found && linkName) linkBarcode(code, linkName);
    const isSure = found?.verified || !found?.candidates?.length;
    if (found?.gameInfo && isSure) {
      attach(found.gameInfo, found.details);
      return;
    }
    if (found?.candidates?.length) {
      setProduct(found);
      setStep('candidates');
      return;
    }
    // Only a product name (or nothing) is known: search for it by name instead
    if (found?.title) setQuery(found.names?.[0] || found.title);
    setNotice(found ? t('scanBarcode.noArtForBarcode') : t('scanBarcode.unknownBarcode', { code }));
    setStep('search');
  };

  const handlePickCandidate = (candidate) => {
    // BGG details were only fetched for the best match
    const isBestMatch = candidate.gameInfo?.bggId && candidate.gameInfo.bggId === product?.gameInfo?.bggId;
    attach(isBestMatch ? product.gameInfo : candidate.gameInfo, isBestMatch ? product.details : null);
  };

  const handleClose = () => {
    lookupSessionRef.current += 1;
    onClose();
  };

  const handleBack = () => {
    lookupSessionRef.current += 1;
    setStep('search');
  };

  useModalDismiss(isOpen, handleClose);

  if (!isOpen || !template) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-container scan-barcode-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <ImagePlusIcon size={20} />
            {title ?? t('scanBarcode.findInfoTitle')}
          </h2>
          <button className="close-btn" onClick={handleClose} aria-label={t('common.close')}>
            <XIcon size={20} />
          </button>
        </div>

        <div className="modal-content">
          {step === 'search' && (
            <div className="scan-unknown">
              <p>{description ?? t('scanBarcode.findInfoDescription', { name: displayName ?? template.name })}</p>
              <div className="scan-search">
                <SearchIcon size={16} />
                <input
                  type="search"
                  autoComplete="off"
                  aria-label={t('scanBarcode.findGamePlaceholder')}
                  placeholder={t('scanBarcode.findGamePlaceholder')}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setNotice('');
                  }}
                />
                <button
                  type="button"
                  className="scan-icon-btn"
                  onClick={() => setStep('scan')}
                  aria-label={t('scanBarcode.scanBox')}
                  title={t('scanBarcode.scanBox')}
                >
                  <ScanBarcodeIcon size={20} aria-hidden="true" />
                </button>
              </div>
              {notice && <p className="scan-or-link" role="status">{notice}</p>}
              <GameMatchPicker query={query} onPick={(match) => attach(match.gameInfo, match.details)} />
            </div>
          )}

          {step === 'scan' && (
            <BarcodeScanPanel idPrefix="find-info" onCode={(code) => { void handleCode(code); }} />
          )}

          {step === 'lookup' && (
            <p className="loading-message" role="status">
              {t('scanBarcode.lookingUp', { code: scannedCode })}
            </p>
          )}

          {step === 'candidates' && (
            <div className="scan-candidates">
              <p className="scan-candidates-title">{t('scanBarcode.candidatesTitle')}</p>
              <div className="scan-candidate-list">
                {product.candidates.map((candidate) => (
                  <GameCandidate
                    key={candidate.gameInfo?.bggId || candidate.name}
                    candidate={candidate}
                    onPick={() => handlePickCandidate(candidate)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {step !== 'search' && step !== 'lookup' && (
          <div className="modal-actions">
            <button type="button" onClick={handleBack} className="cancel-button">
              {t('common.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FindGameInfoModal;
