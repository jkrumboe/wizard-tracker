import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { startBarcodeScanner } from '@/shared/utils/barcodeScanner';
import { isValidBarcode, normalizeBarcode } from '@/shared/utils/barcodeTemplateMap';
import '@/styles/components/scan-barcode-modal.css';

/**
 * Camera view that reads a game box barcode, with a field to type the code
 * instead. The camera runs while the panel is mounted and stops after the
 * first code, so `onCode` is called once.
 * @param {{ onCode: (code: string) => void, idPrefix?: string }} props
 */
const BarcodeScanPanel = ({ onCode, idPrefix = 'barcode' }) => {
  const { t } = useTranslation();
  const [scanError, setScanError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  // Bumped on every camera start/stop so a camera that finishes starting late is shut down
  const sessionRef = useRef(0);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  const stopScanner = () => {
    sessionRef.current += 1;
    scannerRef.current?.stop();
    scannerRef.current = null;
  };

  const handleCode = (rawCode) => {
    stopScanner();
    onCodeRef.current(normalizeBarcode(rawCode));
  };

  useEffect(() => {
    const session = ++sessionRef.current;
    void (async () => {
      try {
        const scanner = await startBarcodeScanner(videoRef.current, handleCode);
        if (session !== sessionRef.current) {
          scanner.stop();
          return;
        }
        scannerRef.current = scanner;
      } catch (error) {
        console.warn('Could not start barcode scanner:', error);
        if (session === sessionRef.current) setScanError(error.code || 'unknown');
      }
    })();
    return stopScanner;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (isValidBarcode(manualCode)) handleCode(manualCode);
    else setScanError('invalid');
  };

  const manualInputId = `${idPrefix}-manual-input`;

  return (
    <>
      <div className="scan-viewport">
        <video ref={videoRef} className="scan-video" playsInline muted />
        {scanError && scanError !== 'invalid' ? (
          <div className="scan-error" role="alert">
            <p>{t(`scanBarcode.errors.${scanError}`)}</p>
          </div>
        ) : (
          <div className="scan-frame" aria-hidden="true" />
        )}
      </div>
      <p className="scan-hint">{t('scanBarcode.hint')}</p>
      <form className="scan-manual" onSubmit={handleManualSubmit}>
        <label htmlFor={manualInputId}>{t('scanBarcode.manualLabel')}</label>
        <div className="scan-manual-row">
          <input
            id={manualInputId}
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
        {scanError === 'invalid' && (
          <p className="scan-manual-error" role="alert">{t('scanBarcode.invalidCode')}</p>
        )}
      </form>
    </>
  );
};

export default BarcodeScanPanel;
