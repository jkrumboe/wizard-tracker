import { useState, useEffect, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { XIcon, CheckMarkIcon } from '@/components/ui/Icon';
import '@/styles/components/modal.css';

/**
 * Image Cropper Modal Component
 * Uses react-easy-crop for a standard, intuitive cropping experience
 */
const ImageCropperModal = ({ isOpen, onClose, imageFile, onCropComplete }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Pre-resize large images to avoid memory issues on mobile
  const resizeImageIfNeeded = async (file) => {
    return new Promise((resolve, reject) => {
      // Set a timeout for the entire operation
      const timeoutId = setTimeout(() => {
        reject(new Error('Image processing timed out. The image may be too large for your device.'));
      }, 15000);
      
      const img = new Image();
      let url;
      
      try {
        url = URL.createObjectURL(file);
      } catch {
        clearTimeout(timeoutId);
        reject(new Error('Failed to read image file'));
        return;
      }
      
      img.onload = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(url);
        
        // If image is small enough, just use the file directly
        const MAX_DIMENSION = 2048;
        if (img.width <= MAX_DIMENSION && img.height <= MAX_DIMENSION) {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve(e.target.result);
          };
          reader.onerror = () => {
            reject(new Error('Failed to read image file'));
          };
          reader.readAsDataURL(file);
          return;
        }
        
        // Resize large images
        try {
          const scale = Math.min(MAX_DIMENSION / img.width, MAX_DIMENSION / img.height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Could not get canvas context');
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          resolve(dataUrl);
        } catch {
          reject(new Error('Failed to resize image. Try a smaller image.'));
        }
      };
      
      img.onerror = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image. The file may be corrupted.'));
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
          setLoadError(error.message || 'Failed to load image. Please try a different file.');
          setIsLoading(false);
        });
    }

    return () => {
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setLoadError(null);
      setIsLoading(false);
    };
  }, [imageFile, isOpen]);

  const onCropChange = useCallback((crop) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom) => {
    setZoom(zoom);
  }, []);

  const onCropCompleteCallback = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = async () => {
    if (!imageSrc || !croppedAreaPixels) return null;

    const image = new Image();
    image.src = imageSrc;
    
    await new Promise((resolve) => {
      image.onload = resolve;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set output size
    const outputSize = 512;
    canvas.width = outputSize;
    canvas.height = outputSize;

    // Draw the cropped area
    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      outputSize,
      outputSize
    );

    // Apply rounded square mask (20% border-radius)
    const radius = outputSize * 0.2;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(outputSize - radius, 0);
    ctx.arcTo(outputSize, 0, outputSize, radius, radius);
    ctx.lineTo(outputSize, outputSize - radius);
    ctx.arcTo(outputSize, outputSize, outputSize - radius, outputSize, radius);
    ctx.lineTo(radius, outputSize);
    ctx.arcTo(0, outputSize, 0, outputSize - radius, radius);
    ctx.lineTo(0, radius);
    ctx.arcTo(0, 0, radius, 0, radius);
    ctx.closePath();
    ctx.fill();

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.9);
    });
  };

  const handleApply = async () => {
    const croppedBlob = await createCroppedImage();
    if (croppedBlob) {
      onCropComplete(croppedBlob);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container image-cropper-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Crop Profile Picture</h2>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close modal">
            <XIcon size={24} />
          </button>
        </div>

        <div className="modal-content">
          {loadError && (
            <div style={{ 
              padding: '40px 20px', 
              textAlign: 'center', 
              color: 'var(--color-error, #ff4444)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{ fontSize: '48px' }}>⚠️</div>
              <div style={{ fontWeight: 'bold' }}>Image Load Failed</div>
              <div style={{ fontSize: '14px', opacity: 0.8 }}>{loadError}</div>
              <button 
                onClick={onClose} 
                style={{ 
                  marginTop: '16px',
                  padding: '8px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--color-primary, #4a90d9)',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Try Again
              </button>
            </div>
          )}
          {isLoading && !loadError && (
            <div style={{ 
              padding: '60px 20px', 
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                border: '3px solid var(--color-border, #444)',
                borderTopColor: 'var(--color-primary, #4a90d9)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <div>Processing image...</div>
              <div style={{ fontSize: '12px', opacity: 0.6 }}>This may take a moment for large images</div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {imageSrc && !isLoading && (
            <>
              <div className="crop-container" style={{ position: 'relative', height: '35vh', width: '75vw', margin: '0 auto' }}>
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="rect"
                  showGrid={false}
                  style={{
                    containerStyle: {},
                    cropAreaStyle: {
                      borderRadius: '25%'
                    }
                  }}
                  onCropChange={onCropChange}
                  onZoomChange={onZoomChange}
                  onCropComplete={onCropCompleteCallback}
                />
              </div>

                <p className="crop-instructions">
                  Drag the image to adjust position. Use the slider to zoom.
                </p>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleApply} className="btn-primary">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropperModal;
