import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { XIcon, ScanBarcodeIcon, FlashlightIcon, SearchIcon, PlusIcon } from '@/components/ui/Icon';
import gameTemplateService from '@/shared/api/gameTemplateService';
import { LocalTableGameTemplate } from '@/shared/api';
import { useUser } from '@/shared/hooks/useUser';
import { loadAllTemplates } from '@/shared/utils/templateResolver';
import { startBarcodeScanner, supportsTorch, setTorch } from '@/shared/utils/barcodeScanner';
import {
  findTemplateByBarcode,
  isValidBarcode,
  linkBarcode,
  normalizeBarcode,
} from '@/shared/utils/barcodeTemplateMap';
import { getTemplateGameInfo, safeImageUrl, saveGameInfo } from '@/shared/utils/gameInfoStore';
import '@/styles/components/modal.css';
import '@/styles/components/scan-barcode-modal.css';

// Templates stored on the server (or built-ins the server knows) can carry shared barcodes
const isSystemTemplate = (template) => template.type === 'system' || Boolean(template.isBuiltin);

// Lowercase and drop spaces/punctuation so "FLIP-7" and "Flip 7" compare equal
const squash = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// BGG descriptions can be long; the template details view only needs the gist
const MAX_DESCRIPTION_LENGTH = 2000;

/**
 * Attach box art from a barcode lookup to a template that has none yet: on the
 * template itself for local templates (so it syncs), and on this device for all.
 */
const attachGameInfo = (template, gameInfo) => {
  if (!gameInfo || getTemplateGameInfo(template)) return;
  saveGameInfo(template.name, gameInfo);
  if (template.id && LocalTableGameTemplate.getTemplate(template.id)) {
    LocalTableGameTemplate.updateTemplate(template.id, template.name, { gameInfo });
  }
};

/**
 * Scan a game box barcode and jump to that game's setup page.
 * Unknown barcodes can be linked to a game once and are recognized from then on.
 */
const ScanBarcodeModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const templatesPromiseRef = useRef(null);
  // Bumped on every camera start/stop so a camera that finishes starting late is shut down
  const cameraSessionRef = useRef(0);
  // Bumped when the modal closes or scanning restarts so stale lookups don't navigate
  const lookupSessionRef = useRef(0);

  const [step, setStep] = useState('scan'); // 'scan' | 'lookup' | 'unknown'
  const [scanError, setScanError] = useState(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState('');
  const [scannedCode, setScannedCode] = useState('');
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState('');
  const [shareWithEveryone, setShareWithEveryone] = useState(true);
  const [detectedTitle, setDetectedTitle] = useState('');
  const [product, setProduct] = useState(null);
  const [newGameName, setNewGameName] = useState('');

  const stopScanner = () => {
    cameraSessionRef.current += 1;
    scannerRef.current?.stop();
    scannerRef.current = null;
    setTorchAvailable(false);
    setTorchOn(false);
  };

  const goToTemplate = (template) => {
    stopScanner();
    onClose();
    navigate(`/start?template=${encodeURIComponent(template.name)}`);
  };

  const handleCode = async (rawCode) => {
    const code = normalizeBarcode(rawCode);
    stopScanner();
    setScannedCode(code);

    const lookupSession = lookupSessionRef.current;
    const allTemplates = await templatesPromiseRef.current;
    const match = findTemplateByBarcode(code, allTemplates);
    if (match) {
      // Games linked before box art existed pick it up in the background (lookups are cached)
      if (!getTemplateGameInfo(match)) {
        void gameTemplateService.lookupBarcodeProduct(code)
          .then((found) => attachGameInfo(match, found?.gameInfo))
          .catch((error) => console.warn('Could not attach box art:', error));
      }
      goToTemplate(match);
      return;
    }
    setTemplates(allTemplates);
    setDetectedTitle('');
    setProduct(null);
    setNewGameName('');
    setStep('lookup');

    // Ask the barcode databases what game this is
    const found = await gameTemplateService.lookupBarcodeProduct(code);
    if (lookupSession !== lookupSessionRef.current) return;

    // A verified exact name match is unambiguous: remember it and go straight to setup.
    // Unverified GameUPC results are only guesses, so those show the candidates instead.
    const isSure = found?.verified || !found?.candidates?.length;
    const productNames = new Set([...(found?.names || []), found?.title].filter(Boolean).map(squash));
    const exact = isSure && allTemplates.find((tpl) => tpl.name && productNames.has(squash(tpl.name)));
    if (exact) {
      linkBarcode(code, exact.name);
      attachGameInfo(exact, found.gameInfo);
      goToTemplate(exact);
      return;
    }

    setProduct(found);
    // Clean game names (GameUPC) make a good default; raw retail titles need editing
    setNewGameName(found?.names?.[0] || '');
    setStep('unknown');
    if (!found?.title) return;
    // Otherwise pre-filter the list with the longest template name found in the product title
    setDetectedTitle(found.title);
    const squashedTitle = squash(found.title);
    const guess = allTemplates
      .filter((tpl) => tpl.name && squashedTitle.includes(squash(tpl.name)))
      .sort((a, b) => b.name.length - a.name.length)[0];
    if (guess) setSearch(guess.name);
  };

  const startScanning = async () => {
    setScanError(null);
    const video = videoRef.current;
    if (!video) return;
    const session = ++cameraSessionRef.current;
    try {
      const scanner = await startBarcodeScanner(video, (code) => { void handleCode(code); });
      if (session !== cameraSessionRef.current) {
        scanner.stop();
        return;
      }
      scannerRef.current = scanner;
      setTorchAvailable(supportsTorch(scanner.track));
    } catch (error) {
      console.warn('Could not start barcode scanner:', error);
      if (session !== cameraSessionRef.current) return;
      setScanError(error.code || 'unknown');
    }
  };

  // Reset and load templates whenever the modal opens
  useEffect(() => {
    if (!isOpen) return undefined;
    setStep('scan');
    setManualCode('');
    setManualError('');
    setScannedCode('');
    setSearch('');
    templatesPromiseRef.current = loadAllTemplates();
    return () => { lookupSessionRef.current += 1; };
  }, [isOpen]);

  // Run the camera while the scan step is shown. This runs after the <video> is
  // mounted, so "scan again" (coming back from another step) gets a live picture.
  useEffect(() => {
    if (!isOpen || step !== 'scan') return undefined;
    void startScanning();
    return stopScanner;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step]);

  const handleToggleTorch = async () => {
    const track = scannerRef.current?.track;
    if (!track) return;
    try {
      await setTorch(track, !torchOn);
      setTorchOn(!torchOn);
    } catch (error) {
      console.warn('Could not toggle flashlight:', error);
      setTorchAvailable(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!isValidBarcode(manualCode)) {
      setManualError(t('scanBarcode.invalidCode'));
      return;
    }
    setManualError('');
    void handleCode(manualCode);
  };

  const handleLinkTemplate = async (template, gameInfo = product?.gameInfo) => {
    linkBarcode(scannedCode, template.name);
    attachGameInfo(template, gameInfo);

    if (isAdmin && shareWithEveryone && isSystemTemplate(template)) {
      try {
        const barcodes = [...new Set([...(template.barcodes || []), scannedCode])];
        const update = { barcodes };
        if (!template.gameInfo && gameInfo) update.gameInfo = gameInfo;
        await gameTemplateService.updateSystemTemplate(template._id, update);
      } catch (error) {
        // The device link is saved either way, so the scan still works here
        console.warn('Could not share barcode with everyone:', error);
      }
    }

    goToTemplate(template);
  };

  /**
   * Open the scanned game: link it to the game the user already has with that
   * name, or create a new game type prefilled with the box art.
   */
  const openScannedGame = (name, gameInfo, details = {}) => {
    const existing = templates.find((tpl) => squash(tpl.name) === squash(name));
    if (existing) {
      void handleLinkTemplate(existing, gameInfo);
      return;
    }

    const templateId = LocalTableGameTemplate.saveTemplate(name, {
      gameCategory: 'table',
      description: (details.description || '').slice(0, MAX_DESCRIPTION_LENGTH),
      minPlayers: details.minPlayers ?? null,
      maxPlayers: details.maxPlayers ?? null,
      gameInfo: gameInfo || null,
    });
    linkBarcode(scannedCode, name);
    globalThis.dispatchEvent(new CustomEvent('templateCreated', { detail: { templateName: name } }));
    goToTemplate(LocalTableGameTemplate.getTemplate(templateId));
  };

  const handleAddNewGame = () => {
    const name = newGameName.trim();
    if (name) openScannedGame(name, product?.gameInfo, product?.details || {});
  };

  const handlePickCandidate = (candidate) => {
    // BGG details were only fetched for the best match
    const isBestMatch = candidate.gameInfo?.bggId && candidate.gameInfo.bggId === product?.gameInfo?.bggId;
    openScannedGame(
      candidate.name,
      isBestMatch ? product.gameInfo : candidate.gameInfo,
      isBestMatch ? product?.details || {} : {},
    );
  };

  const handleScanAgain = () => {
    lookupSessionRef.current += 1;
    setScannedCode('');
    setSearch('');
    setProduct(null);
    setDetectedTitle('');
    setStep('scan');
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  // When the match isn't verified, offer the games the barcode could be
  const candidates = product && !product.verified ? product.candidates || [] : [];
  const templateNames = useMemo(() => new Set(templates.map((tpl) => squash(tpl.name))), [templates]);

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...templates].sort((a, b) => a.name.localeCompare(b.name));
    return query ? sorted.filter((tpl) => tpl.name.toLowerCase().includes(query)) : sorted;
  }, [templates, search]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-container scan-barcode-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <ScanBarcodeIcon size={20} />
            {step === 'scan' ? t('scanBarcode.title') : t('scanBarcode.unknownTitle')}
          </h2>
          <button className="close-btn" onClick={handleClose} aria-label={t('common.close')}>
            <XIcon size={20} />
          </button>
        </div>

        <div className="modal-content">
          {step === 'scan' && (
            <>
              <div className="scan-viewport">
                <video ref={videoRef} className="scan-video" playsInline muted />
                {scanError ? (
                  <div className="scan-error" role="alert">
                    <p>{t(`scanBarcode.errors.${scanError}`)}</p>
                    {scanError !== 'insecure' && scanError !== 'unsupported' && (
                      <button type="button" className="scan-retry-btn" onClick={() => void startScanning()}>
                        {t('scanBarcode.retry')}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="scan-frame" aria-hidden="true" />
                )}
                {torchAvailable && (
                  <button
                    type="button"
                    className={`scan-torch-btn${torchOn ? ' active' : ''}`}
                    onClick={() => void handleToggleTorch()}
                    aria-label={t('scanBarcode.flashlight')}
                    aria-pressed={torchOn}
                  >
                    <FlashlightIcon size={20} />
                  </button>
                )}
              </div>
              {!scanError && <p className="scan-hint">{t('scanBarcode.hint')}</p>}

              <form className="scan-manual" onSubmit={handleManualSubmit}>
                <label htmlFor="scan-manual-input">{t('scanBarcode.manualLabel')}</label>
                <div className="scan-manual-row">
                  <input
                    id="scan-manual-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="4001234567890"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                  />
                  <button type="submit" disabled={!manualCode.trim()}>
                    {t('scanBarcode.manualSubmit')}
                  </button>
                </div>
                {manualError && <p className="scan-manual-error" role="alert">{manualError}</p>}
              </form>
            </>
          )}

          {step === 'lookup' && (
            <p className="loading-message" role="status">
              {t('scanBarcode.lookingUp', { code: scannedCode })}
            </p>
          )}

          {step === 'unknown' && (
            <div className="scan-unknown">
              <p>{t('scanBarcode.unknownDescription', { code: scannedCode })}</p>
              {detectedTitle && <p>{t('scanBarcode.detectedTitle', { title: detectedTitle })}</p>}

              {candidates.length > 0 && (
                <div className="scan-candidates">
                  <p className="scan-candidates-title">{t('scanBarcode.candidatesTitle')}</p>
                  <div className="scan-candidate-list">
                    {candidates.map((candidate) => {
                      const thumbnail = safeImageUrl(candidate.gameInfo?.thumbnailUrl);
                      const inYourGames = templateNames.has(squash(candidate.name));
                      return (
                        <button
                          key={candidate.gameInfo?.bggId || candidate.name}
                          type="button"
                          className="scan-candidate"
                          onClick={() => handlePickCandidate(candidate)}
                        >
                          {thumbnail ? (
                            <img src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="scan-candidate-placeholder" aria-hidden="true" />
                          )}
                          <span className="scan-candidate-text">
                            <span className="scan-candidate-name">{candidate.name}</span>
                            <span className="scan-candidate-meta">
                              {[
                                candidate.gameInfo?.yearPublished,
                                inYourGames && t('scanBarcode.inYourGames'),
                              ].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <form
                className="scan-new-game"
                onSubmit={(e) => { e.preventDefault(); handleAddNewGame(); }}
              >
                {safeImageUrl(product?.gameInfo?.thumbnailUrl) && (
                  <img
                    className="scan-new-game-image"
                    src={safeImageUrl(product.gameInfo.thumbnailUrl)}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="scan-new-game-body">
                  <label htmlFor="scan-new-game-name">{t('scanBarcode.addNewGameLabel')}</label>
                  <div className="scan-manual-row">
                    <input
                      id="scan-new-game-name"
                      type="text"
                      autoComplete="off"
                      placeholder={t('scanBarcode.newGamePlaceholder')}
                      value={newGameName}
                      onChange={(e) => setNewGameName(e.target.value)}
                    />
                    <button type="submit" disabled={!newGameName.trim()} aria-label={t('scanBarcode.addNewGame')}>
                      <PlusIcon size={18} />
                    </button>
                  </div>
                </div>
              </form>

              <p className="scan-or-link">{t('scanBarcode.orLinkExisting')}</p>
              <div className="scan-search">
                <SearchIcon size={16} />
                <input
                  type="search"
                  placeholder={t('scanBarcode.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {isAdmin && (
                <label className="scan-share-toggle">
                  <input
                    type="checkbox"
                    checked={shareWithEveryone}
                    onChange={(e) => setShareWithEveryone(e.target.checked)}
                  />
                  {t('scanBarcode.shareWithEveryone')}
                </label>
              )}
              <div className="scan-template-list">
                {filteredTemplates.length === 0 ? (
                  <p className="empty-message">{t('scanBarcode.noTemplates')}</p>
                ) : filteredTemplates.map((template) => (
                  <button
                    key={template._id || template.id || template.name}
                    type="button"
                    className="scan-template-item"
                    onClick={() => void handleLinkTemplate(template)}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          {step === 'unknown' && (
            <button type="button" onClick={handleScanAgain} className="cancel-button">
              {t('scanBarcode.scanAgain')}
            </button>
          )}
          <button type="button" onClick={handleClose} className="cancel-button">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScanBarcodeModal;
