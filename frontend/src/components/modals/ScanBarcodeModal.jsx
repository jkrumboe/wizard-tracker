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
  findStartForBarcode,
  isValidBarcode,
  linkBarcode,
  normalizeBarcode,
} from '@/shared/utils/barcodeTemplateMap';
import { getTemplateGameInfo, safeImageUrl } from '@/shared/utils/gameInfoStore';
import { attachGameInfo, isSystemTemplate, MAX_DESCRIPTION_LENGTH } from '@/shared/utils/attachGameInfo';
import '@/styles/components/modal.css';
import '@/styles/components/scan-barcode-modal.css';
import { useModalDismiss } from '@/shared/hooks/useModalDismiss';
import AddGameTemplateModal from '@/components/modals/AddGameTemplateModal';
import GameMatchPicker, { GameCandidate } from '@/components/game/GameMatchPicker';

// Lowercase and drop spaces/punctuation so "FLIP-7" and "Flip 7" compare equal
const squash = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// Templates plus the "<game>: <edition>" templates folded into them, for name
// lookups: picking an edition opens its game with that edition preselected
const withEditions = (templates) => templates.flatMap((tpl) => [tpl, ...(tpl.editionSources || [])]);

const MAX_LOCAL_MATCHES = 5;

/**
 * Scan a game box barcode and jump to that game's setup page.
 * Unknown barcodes can be linked to a game once and are recognized from then on.
 *
 * In 'search' mode (adding a game type) the game is looked up by name instead:
 * the user's own games and online matches are listed, and picking one works like
 * a scan result (existing game opens, a new one is set up prefilled). Creating a
 * game from scratch still offers the online matches for its name, so it can get
 * box art and info without a scan.
 */
const ScanBarcodeModal = ({ isOpen, onClose, mode = 'scan', templateType = null }) => {
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

  const isSearchMode = mode === 'search';
  // 'scan' | 'lookup' | 'unknown' | 'search' | 'match' (online matches for a game created from scratch)
  const [step, setStep] = useState(isSearchMode ? 'search' : 'scan');
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
  // A scanned game the user is setting up as a new game type: { prefill, gameInfo }
  const [newGameDraft, setNewGameDraft] = useState(null);
  // Name lookup ('search' mode)
  const [gameQuery, setGameQuery] = useState('');
  // The name of a game being created from scratch, while its online matches are shown
  const [matchName, setMatchName] = useState('');

  const stopScanner = () => {
    cameraSessionRef.current += 1;
    scannerRef.current?.stop();
    scannerRef.current = null;
    setTorchAvailable(false);
    setTorchOn(false);
  };

  // `startName` may be an edition's name, so setup opens its game with that edition
  const goToTemplate = (template, startName = template.name) => {
    stopScanner();
    onClose();
    navigate(`/start?template=${encodeURIComponent(startName)}`, { state: { fromScan: true } });
  };

  const handleCode = async (rawCode) => {
    const code = normalizeBarcode(rawCode);
    stopScanner();
    setScannedCode(code);

    const lookupSession = lookupSessionRef.current;
    const allTemplates = await templatesPromiseRef.current;
    const start = findStartForBarcode(code, allTemplates);
    if (start) {
      const match = start.template;
      // Games linked before box art existed pick it up in the background (lookups are cached)
      if (!getTemplateGameInfo(match)) {
        void gameTemplateService.lookupBarcodeProduct(code)
          .then((found) => attachGameInfo(match, found?.gameInfo))
          .catch((error) => console.warn('Could not attach box art:', error));
      }
      goToTemplate(match, start.startName);
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
    const exact = isSure && withEditions(allTemplates).find((tpl) => tpl.name && productNames.has(squash(tpl.name)));
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
    setStep(isSearchMode ? 'search' : 'scan');
    setManualCode('');
    setManualError('');
    setScannedCode('');
    setSearch('');
    setNewGameDraft(null);
    setGameQuery('');
    setMatchName('');
    templatesPromiseRef.current = loadAllTemplates();
    // The name lookup lists your games as you type, so it needs them right away
    if (isSearchMode) void templatesPromiseRef.current.then(setTemplates);
    return () => { lookupSessionRef.current += 1; };
  }, [isOpen, isSearchMode]);

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

  const handleLinkTemplate = async (template, gameInfo = product?.gameInfo, details = product?.details || {}) => {
    // Name lookups have no barcode to remember, only box art
    if (scannedCode) linkBarcode(scannedCode, template.name);
    attachGameInfo(template, gameInfo, details);

    if (scannedCode && isAdmin && shareWithEveryone && isSystemTemplate(template)) {
      try {
        // Box art is already shared by attachGameInfo
        const barcodes = [...new Set([...(template.barcodes || []), scannedCode])];
        await gameTemplateService.updateSystemTemplate(template._id, { barcodes });
      } catch (error) {
        // The device link is saved either way, so the scan still works here
        console.warn('Could not share barcode with everyone:', error);
      }
    }

    goToTemplate(template);
  };

  /**
   * Open the scanned game: link it to the game the user already has with that
   * name, or let the user set up a new game type (type, player counts) prefilled
   * with whatever the lookup found.
   */
  const openScannedGame = (name, gameInfo, details = {}) => {
    const existing = withEditions(templates).find((tpl) => squash(tpl.name) === squash(name));
    if (existing) {
      void handleLinkTemplate(existing, gameInfo, details);
      return;
    }

    setNewGameDraft({
      gameInfo: gameInfo || null,
      prefill: {
        name,
        description: (details.description || '').slice(0, MAX_DESCRIPTION_LENGTH),
        minPlayers: details.minPlayers ?? null,
        maxPlayers: details.maxPlayers ?? null,
      },
    });
  };

  const handleSaveNewGame = (name, settings) => {
    // The user may rename the game in the form; an existing game with that name gets the barcode instead
    const existing = withEditions(templates).find((tpl) => squash(tpl.name) === squash(name));
    if (existing) {
      setNewGameDraft(null);
      void handleLinkTemplate(existing, newGameDraft?.gameInfo);
      return;
    }
    const templateId = LocalTableGameTemplate.saveTemplate(name, {
      ...settings,
      gameInfo: newGameDraft?.gameInfo || null,
    });
    if (scannedCode) linkBarcode(scannedCode, name);
    globalThis.dispatchEvent(new CustomEvent('templateCreated', { detail: { templateName: name, settings } }));
    setNewGameDraft(null);
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

  // Nothing matched (or the user wants their own version): first offer the online
  // matches for the typed name so the new game can still get box art and info
  const handleCreateFromScratch = () => {
    const name = gameQuery.trim();
    if (!name) return;
    if (!user) {
      openScannedGame(name, null);
      return;
    }
    setMatchName(name);
    setStep('match');
  };

  // The game keeps the name the user typed (it may be their own edition); the match adds art and info
  const handlePickMatch = (match) => openScannedGame(matchName, match.gameInfo, match.details || {});
  const handleSkipMatch = () => openScannedGame(matchName, null);

  const handleBackToSearch = () => {
    setMatchName('');
    setStep('search');
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
  const templateNames = useMemo(() => new Set(withEditions(templates).map((tpl) => squash(tpl.name))), [templates]);

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...templates].sort((a, b) => a.name.localeCompare(b.name));
    return query ? sorted.filter((tpl) => tpl.name.toLowerCase().includes(query)) : sorted;
  }, [templates, search]);

  // Your games matching the typed name, names starting with it first
  const localMatches = useMemo(() => {
    const query = squash(gameQuery);
    if (!query) return [];
    return templates
      .filter((tpl) => tpl.name && squash(tpl.name).includes(query))
      .sort((a, b) => Number(!squash(a.name).startsWith(query)) - Number(!squash(b.name).startsWith(query))
        || a.name.localeCompare(b.name))
      .slice(0, MAX_LOCAL_MATCHES);
  }, [templates, gameQuery]);
  const hasExactLocalMatch = localMatches.some((tpl) => squash(tpl.name) === squash(gameQuery));

  useModalDismiss(isOpen, handleClose);

  if (!isOpen) return null;

  if (newGameDraft) {
    return (
      <AddGameTemplateModal
        isOpen
        onClose={() => {
          setNewGameDraft(null);
          // The match step would skip straight back to this form when nothing matched
          if (step === 'match') handleBackToSearch();
        }}
        onSave={handleSaveNewGame}
        prefill={newGameDraft.prefill}
        templateType={templateType}
        requirePlayerCounts={!isSearchMode}
        existingGames={templates}
      />
    );
  }

  const title = {
    scan: t('scanBarcode.title'),
    search: t('scanBarcode.findGameTitle'),
    match: t('scanBarcode.matchTitle'),
  }[step] || t('scanBarcode.unknownTitle');

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-container scan-barcode-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {isSearchMode ? <PlusIcon size={20} /> : <ScanBarcodeIcon size={20} />}
            {title}
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

          {step === 'search' && (
            <div className="scan-unknown">
              <p>{t('scanBarcode.findGameDescription')}</p>
              <form
                className="scan-search"
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  // Enter opens your game with that exact name, otherwise starts a new one
                  const exact = localMatches.find((tpl) => squash(tpl.name) === squash(gameQuery));
                  if (exact) goToTemplate(exact);
                  else handleCreateFromScratch();
                }}
              >
                <SearchIcon size={16} />
                <input
                  type="search"
                  autoComplete="off"
                  autoFocus
                  aria-label={t('scanBarcode.findGamePlaceholder')}
                  placeholder={t('scanBarcode.findGamePlaceholder')}
                  value={gameQuery}
                  onChange={(e) => setGameQuery(e.target.value)}
                />
              </form>

              {localMatches.length > 0 && (
                <div className="scan-candidates">
                  <p className="scan-candidates-title">{t('scanBarcode.yourGames')}</p>
                  <div className="scan-template-list">
                    {localMatches.map((template) => (
                      <button
                        key={template._id || template.id || template.name}
                        type="button"
                        className="scan-template-item"
                        onClick={() => goToTemplate(template)}
                      >
                        {template.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {user && (
                <GameMatchPicker
                  query={gameQuery}
                  title={t('scanBarcode.onlineResults')}
                  isInYourGames={(name) => templateNames.has(squash(name))}
                  onPick={(result) => openScannedGame(result.name, result.gameInfo, result.details || {})}
                  // No online matches is fine here: your games and "create" are still listed
                  onNoMatch={() => {}}
                />
              )}

              {gameQuery.trim() && !hasExactLocalMatch && (
                <button type="button" className="scan-template-item scan-create-new" onClick={handleCreateFromScratch}>
                  <PlusIcon size={16} />
                  {t('scanBarcode.createNamed', { name: gameQuery.trim() })}
                </button>
              )}
            </div>
          )}

          {step === 'match' && (
            <div className="scan-unknown">
              <p>{t('scanBarcode.matchDescription', { name: matchName })}</p>
              {/* Without a match there is nothing to pick, so go straight to the new game form */}
              <GameMatchPicker query={matchName} onPick={handlePickMatch} onNoMatch={handleSkipMatch} />
            </div>
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
                    {candidates.map((candidate) => (
                      <GameCandidate
                        key={candidate.gameInfo?.bggId || candidate.name}
                        candidate={candidate}
                        inYourGames={templateNames.has(squash(candidate.name))}
                        onPick={() => handlePickCandidate(candidate)}
                      />
                    ))}
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

        {step === 'match' && (
          <div className="modal-actions">
            <button type="button" onClick={handleBackToSearch} className="cancel-button">
              {t('common.back')}
            </button>
            <button type="button" onClick={handleSkipMatch} className="cancel-button">
              {t('scanBarcode.skipMatch')}
            </button>
          </div>
        )}

        {step === 'unknown' && (
          <div className="modal-actions">
            <button type="button" onClick={handleScanAgain} className="cancel-button">
              {t('scanBarcode.scanAgain')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanBarcodeModal;
