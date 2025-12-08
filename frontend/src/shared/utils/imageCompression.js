/**
 * Image Compression and Optimization Utility
 * Handles image resizing, compression, and format optimization
 */

/**
 * Compress and resize image to optimal size
 * @param {File} file - Original image file
 * @param {Object} options - Compression options
 * @returns {Promise<{blob: Blob, dataUrl: string}>}
 */
export async function compressImage(file, options = {}) {
  const {
    maxWidth = 512,
    maxHeight = 512,
    quality = 0.85,
    mimeType = 'image/jpeg',
    maxSizeKB = 500
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      try {
        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          
          if (width > height) {
            width = maxWidth;
            height = width / aspectRatio;
          } else {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }

        // Set canvas size
        canvas.width = width;
        canvas.height = height;

        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw and compress image
        ctx.drawImage(img, 0, 0, width, height);

        // Try to compress to target size
        let currentQuality = quality;
        let attempt = 0;
        const maxAttempts = 5;

        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }

              const sizeKB = blob.size / 1024;

              // If size is acceptable or we've tried enough times, accept it
              if (sizeKB <= maxSizeKB || attempt >= maxAttempts || currentQuality <= 0.5) {
                canvas.toBlob(
                  (finalBlob) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      resolve({
                        blob: finalBlob,
                        dataUrl: reader.result,
                        size: finalBlob.size,
                        width,
                        height
                      });
                    };
                    reader.onerror = () => reject(new Error('Failed to read compressed image'));
                    reader.readAsDataURL(finalBlob);
                  },
                  mimeType,
                  currentQuality
                );
              } else {
                // Try again with lower quality
                attempt++;
                currentQuality -= 0.1;
                tryCompress();
              }
            },
            mimeType,
            currentQuality
          );
        };

        tryCompress();
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Crop image to specific dimensions from center
 * @param {File|Blob} file - Image file or blob
 * @param {Object} cropArea - Crop coordinates {x, y, width, height}
 * @param {number} outputSize - Output size (square)
 * @returns {Promise<{blob: Blob, dataUrl: string}>}
 */
export async function cropImage(file, cropArea, outputSize = 512) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      try {
        // Set output canvas size
        canvas.width = outputSize;
        canvas.height = outputSize;

        // Enable image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw cropped and scaled image
        ctx.drawImage(
          img,
          cropArea.x,
          cropArea.y,
          cropArea.width,
          cropArea.height,
          0,
          0,
          outputSize,
          outputSize
        );

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to crop image'));
              return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                blob,
                dataUrl: reader.result,
                size: blob.size,
                width: outputSize,
                height: outputSize
              });
            };
            reader.onerror = () => reject(new Error('Failed to read cropped image'));
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          0.9
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    // Load image
    if (file instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    } else {
      img.src = file;
    }
  });
}

/**
 * Get image dimensions without loading into DOM
 * @param {File} file - Image file
 * @returns {Promise<{width: number, height: number}>}
 */
export function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Create a thumbnail from an image
 * @param {string} dataUrl - Image data URL
 * @param {number} size - Thumbnail size
 * @returns {Promise<string>} - Thumbnail data URL
 */
export async function createThumbnail(dataUrl, size = 128) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      canvas.width = size;
      canvas.height = size;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Calculate crop to center square
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;

      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };

    img.onerror = () => reject(new Error('Failed to create thumbnail'));
    img.src = dataUrl;
  });
}
