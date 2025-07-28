import { isOnline } from '../config/online-mode.js';

// Export an adapter that provides the isOnline function in ESM
export async function checkOnlineMode() {
  return await isOnline();
}

export default {
  isOnline: checkOnlineMode
};
