/**
 * Cryptographically secure random utilities
 * Uses Web Crypto API for secure random number generation
 */

/**
 * Generate a cryptographically secure random integer between min (inclusive) and max (exclusive)
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} Random integer
 */
export function getSecureRandomInt(min, max) {
  const range = max - min;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const maxValue = Math.pow(256, bytesNeeded);
  const randomBytes = new Uint8Array(bytesNeeded);
  
  let randomValue;
  do {
    crypto.getRandomValues(randomBytes);
    randomValue = randomBytes.reduce((acc, byte, i) => acc + byte * Math.pow(256, i), 0);
  } while (randomValue >= maxValue - (maxValue % range));
  
  return min + (randomValue % range);
}

/**
 * Generate a cryptographically secure random string
 * @param {number} length - Length of the string
 * @returns {string} Random alphanumeric string
 */
export function getSecureRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  return Array.from(randomValues)
    .map(value => chars[value % chars.length])
    .join('');
}

/**
 * Generate a cryptographically secure unique ID
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} Unique ID
 */
export function generateSecureId(prefix = 'id') {
  const timestamp = Date.now();
  const randomPart = getSecureRandomString(9);
  return `${prefix}_${timestamp}_${randomPart}`;
}

/**
 * Shuffle an array using cryptographically secure randomness (Fisher-Yates)
 * @param {Array} array - Array to shuffle (creates a copy)
 * @returns {Array} Shuffled copy of the array
 */
export function secureArrayShuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(0, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
