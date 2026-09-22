/**
 * Shared client-side validation for user supplied avatar images.
 *
 * Returns i18n keys instead of finished strings so that every caller can
 * render the message in the user's own language.
 */

export const MAX_AVATAR_FILE_BYTES = 10 * 1024 * 1024; // 10MB (we compress afterwards)

/** MIME types accepted by the picker - includes the HEIF/HEIC iOS produces. */
export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/heif',
  'image/heic',
  'image/heif-sequence',
  'image/heic-sequence'
];

/** Extensions used as a fallback: some mobile browsers report an empty type. */
export const ACCEPTED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'heif', 'heic'];

/** `accept` attribute for file inputs. */
export const AVATAR_INPUT_ACCEPT = 'image/*,image/heic,image/heif';

/**
 * Inspect the first bytes of a file to confirm it really is a raster image,
 * regardless of what its name or MIME type claims.
 *
 * @param {File|Blob} file
 * @returns {Promise<boolean>}
 */
export const hasRasterImageSignature = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const arr = new Uint8Array(reader.result || []);
      let valid = false;

      // PNG: 89 50 4E 47 0D 0A 1A 0A
      if (arr.length >= 8 && arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E &&
          arr[3] === 0x47 && arr[4] === 0x0D && arr[5] === 0x0A && arr[6] === 0x1A &&
          arr[7] === 0x0A) {
        valid = true;
      }
      // JPEG: FF D8 FF
      else if (arr.length >= 3 && arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) {
        valid = true;
      }
      // GIF: GIF87a or GIF89a
      else if (arr.length >= 6 && arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 &&
               arr[3] === 0x38 && (arr[4] === 0x39 || arr[4] === 0x37) && arr[5] === 0x61) {
        valid = true;
      }
      // BMP: 42 4D
      else if (arr.length >= 2 && arr[0] === 0x42 && arr[1] === 0x4D) {
        valid = true;
      }
      // WEBP: RIFF....WEBP
      else if (arr.length >= 12 &&
               arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 &&
               arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50) {
        valid = true;
      }
      // HEIF/HEIC and other ftyp based containers - iOS converts these on upload
      else if (arr.length >= 12 &&
               arr[4] === 0x66 && arr[5] === 0x74 && arr[6] === 0x79 && arr[7] === 0x70) {
        valid = true;
      }

      resolve(valid);
    };

    reader.onerror = (error) => {
      console.error('FileReader error during image validation:', error);
      resolve(false);
    };

    try {
      reader.readAsArrayBuffer(file.slice(0, 12));
    } catch (error) {
      console.error('Failed to read file slice:', error);
      resolve(false);
    }
  });

/**
 * Validate a picked file before handing it to the cropper.
 *
 * @param {File} file
 * @returns {Promise<{valid: boolean, errorKey?: string, params?: object}>}
 */
export const validateAvatarFile = async (file) => {
  if (!file) {
    return { valid: false, errorKey: 'profile.noFileSelected' };
  }

  const extension = file.name?.split('.').pop()?.toLowerCase();
  const typeAccepted = ACCEPTED_IMAGE_MIME_TYPES.includes(file.type?.toLowerCase());
  const extensionAccepted = ACCEPTED_IMAGE_EXTENSIONS.includes(extension);

  if (!typeAccepted && !extensionAccepted) {
    return {
      valid: false,
      errorKey: 'profile.invalidFileType',
      params: { type: file.type || extension || 'unknown' }
    };
  }

  if (file.size > MAX_AVATAR_FILE_BYTES) {
    return {
      valid: false,
      errorKey: 'profile.fileSizeExceeds',
      params: { size: `${(file.size / 1024 / 1024).toFixed(1)}MB` }
    };
  }

  // Signature check, guarded by a timeout so a stalled FileReader cannot hang the UI.
  const signatureValid = await Promise.race([
    hasRasterImageSignature(file),
    new Promise((resolve) => setTimeout(() => resolve(false), 5000))
  ]);

  if (!signatureValid) {
    return { valid: false, errorKey: 'profile.cannotVerifyImage' };
  }

  return { valid: true };
};

export default validateAvatarFile;
