import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScanBarcodeIcon, XIcon } from '@/components/ui/Icon';
import BarcodeScanPanel from '@/components/game/BarcodeScanPanel';
import { GameCandidate } from '@/components/game/GameMatchPicker';
import gameTemplateService from '@/shared/api/gameTemplateService';
import { attachGameInfo } from '@/shared/utils/attachGameInfo';
import { addCustomEdition, editionNameFromProduct } from '@/shared/utils/gameEditions';
import { safeImageUrl } from '@/shared/utils/gameInfoStore';
import { notifyTemplatesChanged } from '@/shared/hooks/useGameTemplates';
import { useModalDismiss } from '@/shared/hooks/useModalDismiss';
import { useUser } from '@/shared/hooks/useUser';
import '@/styles/components/modal.css';
import '@/styles/components/edition-picker.css';

const MAX_NAME_LENGTH = 60;

/**
 * Name a new edition of a game, typed or read from a scanned box (which also
 * brings its box art). The first edition of a game also makes the plain game
 * selectable as "Standard".
 * @param {{ isOpen: boolean, templateName: string, onClose: () => void, onAdded: (editionId: string) => void }} props
 */
const AddEditionModal = ({ isOpen, templateName, onClose, onAdded }) => {
  const { t } = useTranslation();
  const { user } = useUser();
  const [newName, setNewName] = useState('');
  const [step, setStep] = useState('name'); // 'name' | 'scan' | 'lookup' | 'candidates'
  const [scannedCode, setScannedCode] = useState('');
  // Box art and BGG info from the scanned box, saved with the edition
  const [scanned, setScanned] = useState(null); // { gameInfo, details }
  const [candidates, setCandidates] = useState([]);
  const [notice, setNotice] = useState('');
  // Bumped on close and on Back so a late barcode lookup doesn't act
  const lookupSessionRef = useRef(0);

  const close = () => {
    lookupSessionRef.current += 1;
    setNewName('');
    setStep('name');
    setScanned(null);
    setCandidates([]);
    setNotice('');
    onClose();
  };
  useModalDismiss(isOpen, close);

  const applyProduct = (productName, gameInfo, details) => {
    const editionName = editionNameFromProduct(productName, templateName).slice(0, MAX_NAME_LENGTH);
    if (editionName) setNewName(editionName);
    setScanned(gameInfo ? { gameInfo, details: details || {} } : null);
    setNotice(editionName ? '' : t('editions.scanNoEditionName'));
    setStep('name');
  };

  const handleCode = async (code) => {
    setScannedCode(code);
    setStep('lookup');
    const session = lookupSessionRef.current;
    const found = await gameTemplateService.lookupBarcodeProduct(code);
    if (session !== lookupSessionRef.current) return;

    if (!found) {
      setNotice(t('scanBarcode.unknownBarcode', { code }));
      setStep('name');
      return;
    }
    if (!found.verified && found.candidates?.length) {
      setCandidates(found.candidates);
      setStep('candidates');
      return;
    }
    applyProduct(found.names?.[0] || found.title, found.gameInfo, found.details);
  };

  const handleBack = () => {
    lookupSessionRef.current += 1;
    setStep('name');
  };

  const handleAdd = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const id = addCustomEdition(templateName, name);
    if (!id) return;
    if (scanned) {
      // Same key the edition list reads custom editions' box art from
      attachGameInfo({ name: `${templateName}#${id}` }, scanned.gameInfo, scanned.details);
      notifyTemplatesChanged();
    }
    close();
    onAdded(id);
  };

  if (!isOpen) return null;

  const scannedArt = safeImageUrl(scanned?.gameInfo?.thumbnailUrl);

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal-container edition-modal" role="dialog" aria-modal="true" aria-labelledby="edition-add-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="edition-add-title">{t('editions.addEditionLong')}</h2>
          <button className="close-btn" onClick={close} aria-label={t('common.close')}>
            <XIcon size={20} />
          </button>
        </div>
        <div className="modal-content">
          {step === 'name' && (
            <>
              <form className="edition-editor-add" onSubmit={handleAdd}>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('editions.newEditionPlaceholder')}
                  aria-label={t('editions.newEditionPlaceholder')}
                  maxLength={MAX_NAME_LENGTH}
                  autoFocus
                />
                <button type="submit" className="edition-editor-add-btn" disabled={!newName.trim()}>
                  {t('editions.addEdition')}
                </button>
              </form>

              {notice && <p className="edition-scan-notice" role="status">{notice}</p>}

              {scanned && (
                <div className="edition-scan-result">
                  {scannedArt && <img src={scannedArt} alt="" referrerPolicy="no-referrer" />}
                  <span>{t('editions.scanArtAdded')}</span>
                </div>
              )}

              {/* Lookups need an account (BoardGameGeek terms) */}
              {user && (
                <button type="button" className="edition-scan-btn" onClick={() => { setNotice(''); setStep('scan'); }}>
                  <ScanBarcodeIcon size={18} aria-hidden="true" />
                  {t('editions.scanEdition')}
                </button>
              )}
            </>
          )}

          {step === 'scan' && <BarcodeScanPanel idPrefix="edition-add" onCode={(code) => { void handleCode(code); }} />}

          {step === 'lookup' && (
            <p className="loading-message" role="status">
              {t('scanBarcode.lookingUp', { code: scannedCode })}
            </p>
          )}

          {step === 'candidates' && (
            <div className="scan-candidates">
              <p className="scan-candidates-title">{t('scanBarcode.candidatesTitle')}</p>
              <div className="scan-candidate-list">
                {candidates.map((candidate) => (
                  <GameCandidate
                    key={candidate.gameInfo?.bggId || candidate.name}
                    candidate={candidate}
                    onPick={() => applyProduct(candidate.name, candidate.gameInfo, null)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {(step === 'scan' || step === 'candidates') && (
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

export default AddEditionModal;
