import { useState, useEffect, useRef } from 'react';
import { XIcon, CheckMarkIcon } from '@/components/ui/Icon';
import '@/styles/components/modal.css';

/**
 * Image Cropper Modal Component
 * Allows users to crop and frame their profile picture
 */
const ImageCropperModal = ({ isOpen, onClose, imageFile, onCropComplete }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  // Load image when file changes
  useEffect(() => {
    if (imageFile && isOpen) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setImageSrc(e.target.result);
          imageRef.current = img;
          
          // Initialize crop to center square
          const size = Math.min(img.width, img.height);
          const x = (img.width - size) / 2;
          const y = (img.height - size) / 2;
          
          setCrop({ x, y, width: size, height: size });
          setImageLoaded(true);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(imageFile);
    }

    return () => {
      setImageSrc(null);
      setImageLoaded(false);
      setScale(1);
    };
  }, [imageFile, isOpen]);

  // Draw preview
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    // Set canvas size
    const containerWidth = containerRef.current?.clientWidth || 400;
    const size = Math.min(containerWidth - 40, 400);
    canvas.width = size;
    canvas.height = size;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Calculate display scale
    const displayScale = size / crop.width;

    // Draw image
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.scale(scale, scale);
    ctx.translate(-size / 2, -size / 2);
    
    ctx.drawImage(
      img,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      size,
      size
    );
    
    ctx.restore();

    // Draw circular frame overlay
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw frame border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();

  }, [crop, scale, imageLoaded]);

  const handleMouseDown = (e) => {
    if (!imageLoaded) return;
    setDragging(true);
    setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
  };

  const handleMouseMove = (e) => {
    if (!dragging || !imageLoaded || !imageRef.current) return;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    // Constrain to image bounds
    const maxX = imageRef.current.width - crop.width;
    const maxY = imageRef.current.height - crop.height;

    setCrop({
      ...crop,
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const handleZoomChange = (e) => {
    const newScale = parseFloat(e.target.value);
    setScale(newScale);
  };

  const handleCropComplete = async () => {
    if (!imageRef.current || !canvasRef.current) return;

    try {
      // Create final cropped image
      const finalCanvas = document.createElement('canvas');
      const finalSize = 512; // Output size
      finalCanvas.width = finalSize;
      finalCanvas.height = finalSize;
      const finalCtx = finalCanvas.getContext('2d');

      finalCtx.imageSmoothingEnabled = true;
      finalCtx.imageSmoothingQuality = 'high';

      // Draw scaled and cropped image
      finalCtx.save();
      finalCtx.translate(finalSize / 2, finalSize / 2);
      finalCtx.scale(scale, scale);
      finalCtx.translate(-finalSize / 2, -finalSize / 2);
      
      finalCtx.drawImage(
        imageRef.current,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        finalSize,
        finalSize
      );
      
      finalCtx.restore();

      // Apply circular mask
      finalCtx.globalCompositeOperation = 'destination-in';
      finalCtx.beginPath();
      finalCtx.arc(finalSize / 2, finalSize / 2, finalSize / 2, 0, Math.PI * 2);
      finalCtx.fill();

      // Convert to blob
      finalCanvas.toBlob(
        (blob) => {
          if (blob) {
            onCropComplete(blob);
            onClose();
          }
        },
        'image/jpeg',
        0.9
      );
    } catch (error) {
      console.error('Error cropping image:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2>Crop Profile Picture</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <XIcon size={20} />
          </button>
        </div>

        <div className="modal-content" style={{ padding: '20px' }}>
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px'
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                border: '2px solid var(--border)',
                borderRadius: '50%',
                cursor: dragging ? 'grabbing' : 'grab',
                touchAction: 'none'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />

            <div style={{ width: '100%', padding: '0 20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Zoom
              </label>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={scale}
                onChange={handleZoomChange}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }}>
              Drag the image to adjust position. Use the slider to zoom.
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleCropComplete}
            disabled={!imageLoaded}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <CheckMarkIcon size={18} />
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropperModal;
