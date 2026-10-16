// Camera barcode scanning for game boxes (EAN/UPC).
// Uses the native BarcodeDetector where available (Chrome/Android) and lazily
// loads @zxing/browser otherwise (iOS Safari, Firefox) so it only costs a
// download on devices that need it.

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
const NATIVE_SCAN_INTERVAL_MS = 200;

/**
 * Error codes surfaced to the UI.
 * @typedef {'insecure'|'unsupported'|'denied'|'noCamera'|'unknown'} ScannerErrorCode
 */
export class ScannerError extends Error {
  constructor(code, cause) {
    super(code);
    this.code = code;
    this.cause = cause;
  }
}

const toScannerError = (error) => {
  if (error instanceof ScannerError) return error;
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new ScannerError('denied', error);
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new ScannerError('noCamera', error);
    default:
      return new ScannerError('unknown', error);
  }
};

const canUseNativeDetector = async () => {
  if (!('BarcodeDetector' in globalThis)) return false;
  try {
    const supported = await globalThis.BarcodeDetector.getSupportedFormats();
    return NATIVE_FORMATS.some((format) => supported.includes(format));
  } catch {
    return false;
  }
};

const startNativeLoop = (video, onDetected) => {
  const detector = new globalThis.BarcodeDetector({ formats: NATIVE_FORMATS });
  let stopped = false;
  let timer = null;

  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2) {
        const [barcode] = await detector.detect(video);
        if (barcode?.rawValue && !stopped) {
          onDetected(barcode.rawValue);
          return;
        }
      }
    } catch (error) {
      console.warn('Barcode detection failed:', error);
    }
    timer = setTimeout(tick, NATIVE_SCAN_INTERVAL_MS);
  };
  void tick();

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
};

const startZxingLoop = async (video, onDetected) => {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ]);
  const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
  ]]]);
  const reader = new BrowserMultiFormatReader(hints);
  let done = false;
  // The video is already playing, so decode frames directly
  const controls = reader.scan(video, (result) => {
    if (result && !done) {
      done = true;
      onDetected(result.getText());
    }
  });
  return () => {
    done = true;
    controls.stop();
  };
};

/**
 * Start the back camera on a video element and call onDetected once with the
 * first barcode found.
 * @param {HTMLVideoElement} video
 * @param {(code: string) => void} onDetected
 * @returns {Promise<{ stop: () => void, track: MediaStreamTrack|null }>}
 * @throws {ScannerError}
 */
export const startBarcodeScanner = async (video, onDetected) => {
  if (!globalThis.isSecureContext) throw new ScannerError('insecure');
  if (!navigator.mediaDevices?.getUserMedia) throw new ScannerError('unsupported');

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  } catch (error) {
    throw toScannerError(error);
  }

  const stopStream = () => stream.getTracks().forEach((track) => track.stop());

  try {
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    await video.play();

    const stopDecoding = (await canUseNativeDetector())
      ? startNativeLoop(video, onDetected)
      : await startZxingLoop(video, onDetected);

    return {
      track: stream.getVideoTracks()[0] || null,
      stop: () => {
        stopDecoding();
        stopStream();
        video.srcObject = null;
      },
    };
  } catch (error) {
    stopStream();
    throw toScannerError(error);
  }
};

/**
 * Whether the camera track supports a flashlight.
 * @param {MediaStreamTrack|null} track
 * @returns {boolean}
 */
export const supportsTorch = (track) => Boolean(track?.getCapabilities?.().torch);

/**
 * Turn the camera flashlight on or off.
 * @param {MediaStreamTrack} track
 * @param {boolean} on
 */
export const setTorch = async (track, on) => {
  await track.applyConstraints({ advanced: [{ torch: on }] });
};
