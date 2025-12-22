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

  // Load image when file changes
  useEffect(() => {
    if (imageFile && isOpen) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target.result);
      };
      reader.readAsDataURL(imageFile);
    }

    return () => {
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
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
          {imageSrc && (
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
