import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Cropper from 'react-easy-crop';
import {
  XIcon,
  RotateCwIcon,
  ZoomInIcon,
  ZoomOutIcon,
  RefreshIcon,
  AlertCircleIcon
} from '@/components/ui/Icon';
import '@/styles/components/modal.css';
import '@/styles/components/avatar.css';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.2;
const OUTPUT_SIZE = 512;
const MAX_SOURCE_DIMENSION = 2048;

/**
 * Crop dialog for profile pictures.
 *
 * Gives the controls people expect from a photo editor: drag to reposition,
 * a zoom slider (plus buttons for mouse users), 90 degree rotation and a
 * reset, with a live preview of the rounded square that will be saved.
 */
const ImageCropperModal = ({ isOpen, onClose, imageFile, onCropComplete }) => {
  const { t } = useTranslation();
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const dialogRef = useRef(null);

  // Pre-resize large images to avoid memory issues on mobile
  const resizeImageIfNeeded = async (file) => {
    return new Promise((resolve, reject) => {
      // Set a timeout for the entire operation
      const timeoutId = setTimeout(() => {
        reject(new Error(t('imageCropper.processingTimeout')));
      }, 15000);

      const img = new Image();
      let url;

      try {
        url = URL.createObjectURL(file);
      } catch {
        clearTimeout(timeoutId);
        reject(new Error(t('imageCropper.readFailed')));
        return;
      }

      img.onload = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(url);

        // If image is small enough, just use the file directly
        if (img.width <= MAX_SOURCE_DIMENSION && img.height <= MAX_SOURCE_DIMENSION) {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error(t('imageCropper.readFailed')));
          reader.readAsDataURL(file);
          return;
        }

        // Resize large images
        try {
          const scale = Math.min(MAX_SOURCE_DIMENSION / img.width, MAX_SOURCE_DIMENSION / img.height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Could not get canvas context');
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch {
          reject(new Error(t('imageCropper.resizeFailed')));
        }
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(url);
        reject(new Error(t('imageCropper.corruptedFile')));
      };

      img.src = url;
    });
  };

  // Load image when file changes
  useEffect(() => {
    if (imageFile && isOpen) {
      setLoadError(null);
      setIsLoading(true);

      resizeImageIfNeeded(imageFile)
        .then((dataUrl) => {
          setImageSrc(dataUrl);
          setIsLoading(false);
        })
        .catch((error) => {
          setLoadError(error.message || t('imageCropper.loadFailedFallback'));
          setIsLoading(false);
        });
    }

    return () => {
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setLoadError(null);
      setIsLoading(false);
      setIsApplying(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile, isOpen]);

  // Escape closes, and the page behind stays where it was.
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const onCropChange = useCallback((value) => setCrop(value), []);
  const onZoomChange = useCallback((value) => setZoom(value), []);

  const onCropCompleteCallback = useCallback((croppedArea, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(t('imageCropper.corruptedFile')));
      image.src = src;
    });

  const createCroppedImage = async () => {
    if (!imageSrc || !croppedAreaPixels) return null;

    const image = await loadImage(imageSrc);

    // react-easy-crop reports the crop in the rotated image's coordinate
    // space, so rotate onto an intermediate canvas first and cut from that.
    const radians = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    const rotatedWidth = Math.round(image.width * cos + image.height * sin);
    const rotatedHeight = Math.round(image.width * sin + image.height * cos);

    const rotatedCanvas = document.createElement('canvas');
    rotatedCanvas.width = rotatedWidth;
    rotatedCanvas.height = rotatedHeight;
    const rotatedCtx = rotatedCanvas.getContext('2d');
    if (!rotatedCtx) return null;

    rotatedCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
    rotatedCtx.rotate(radians);
    rotatedCtx.drawImage(image, -image.width / 2, -image.height / 2);

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      rotatedCanvas,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE
    );

    // Apply the rounded square mask the avatars are displayed in.
    const radius = OUTPUT_SIZE * 0.2;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(OUTPUT_SIZE - radius, 0);
    ctx.arcTo(OUTPUT_SIZE, 0, OUTPUT_SIZE, radius, radius);
    ctx.lineTo(OUTPUT_SIZE, OUTPUT_SIZE - radius);
    ctx.arcTo(OUTPUT_SIZE, OUTPUT_SIZE, OUTPUT_SIZE - radius, OUTPUT_SIZE, radius);
    ctx.lineTo(radius, OUTPUT_SIZE);
    ctx.arcTo(0, OUTPUT_SIZE, 0, OUTPUT_SIZE - radius, radius);
    ctx.lineTo(0, radius);
    ctx.arcTo(0, 0, radius, 0, radius);
    ctx.closePath();
    ctx.fill();

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    });
  };

  const handleApply = async () => {
    if (isApplying) return;

    try {
      setIsApplying(true);
      const croppedBlob = await createCroppedImage();
      if (croppedBlob) {
        onCropComplete(croppedBlob);
      } else {
        setLoadError(t('imageCropper.cropFailed'));
      }
    } catch (error) {
      setLoadError(error.message || t('imageCropper.cropFailed'));
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  const canApply = Boolean(imageSrc) && !isLoading && !loadError && !isApplying;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container image-cropper-modal"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('imageCropper.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{t('imageCropper.title')}</h2>
          <button onClick={onClose} className="modal-close-btn" aria-label={t('common.close')}>
            <XIcon size={20} />
          </button>
        </div>

        <div className="modal-content cropper-content">
          {loadError && (
            <div className="cropper-message">
              <span className="cropper-message-icon error">
                <AlertCircleIcon size={28} />
              </span>
              <p className="cropper-message-title">{t('imageCropper.imageLoadFailed')}</p>
              <p className="cropper-message-body">{loadError}</p>
              <button type="button" onClick={onClose} className="btn-primary">
                {t('imageCropper.tryAgain')}
              </button>
            </div>
          )}

          {isLoading && !loadError && (
            <div className="cropper-message">
              <span className="cropper-message-spinner" />
              <p className="cropper-message-title">{t('imageCropper.processingImage')}</p>
              <p className="cropper-message-body">{t('imageCropper.processingHint')}</p>
            </div>
          )}

          {imageSrc && !isLoading && !loadError && (
            <>
              <div className="crop-container">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  cropShape="rect"
                  showGrid={false}
                  minZoom={MIN_ZOOM}
                  maxZoom={MAX_ZOOM}
                  zoomSpeed={0.3}
                  style={{ cropAreaStyle: { borderRadius: '20%' } }}
                  onCropChange={onCropChange}
                  onZoomChange={onZoomChange}
                  onRotationChange={setRotation}
                  onCropComplete={onCropCompleteCallback}
                />
              </div>

              <div className="crop-controls">
                <div className="crop-zoom-row">
                  <button
                    type="button"
                    className="crop-icon-button"
                    onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
                    disabled={zoom <= MIN_ZOOM}
                    aria-label={t('imageCropper.zoomOut')}
                  >
                    <ZoomOutIcon size={18} />
                  </button>

                  <input
                    type="range"
                    className="crop-zoom-slider"
                    min={MIN_ZOOM}
                    max={MAX_ZOOM}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    aria-label={t('imageCropper.zoomLabel')}
                  />

                  <button
                    type="button"
                    className="crop-icon-button"
                    onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
                    disabled={zoom >= MAX_ZOOM}
                    aria-label={t('imageCropper.zoomIn')}
                  >
                    <ZoomInIcon size={18} />
                  </button>
                </div>

                <div className="crop-tool-row">
                  <button
                    type="button"
                    className="crop-tool-button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                  >
                    <RotateCwIcon size={16} />
                    <span>{t('imageCropper.rotate')}</span>
                  </button>

                  <button
                    type="button"
                    className="crop-tool-button"
                    onClick={handleReset}
                    disabled={zoom === 1 && rotation === 0 && crop.x === 0 && crop.y === 0}
                  >
                    <RefreshIcon size={16} />
                    <span>{t('imageCropper.reset')}</span>
                  </button>
                </div>

                <p className="crop-instructions">{t('imageCropper.cropInstructions')}</p>
              </div>
            </>
          )}
        </div>

        {!loadError && (
          <div className="modal-footer">
            <button onClick={onClose} className="btn-secondary" disabled={isApplying}>
              {t('common.cancel')}
            </button>
            <button onClick={handleApply} className="btn-primary" disabled={!canApply}>
              {isApplying ? t('imageCropper.applying') : t('imageCropper.apply')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageCropperModal;
