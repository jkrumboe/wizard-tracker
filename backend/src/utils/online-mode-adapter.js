// Import the CommonJS module using require
const { isOnline } = require('./config/online-mode');

// Export an adapter that provides the isOnline function in ESM
export function checkOnlineMode() {
  return isOnline();
}

export default {
  isOnline: checkOnlineMode
};
