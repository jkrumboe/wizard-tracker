const jwt = require('jsonwebtoken');

/**
 * How long a freshly issued auth token stays valid. Long-lived on purpose: the
 * app is offline-first and used in short bursts, so a short token means the
 * user is asked to sign in again every time they come back to it.
 */
const TOKEN_TTL_DAYS = Number.parseInt(process.env.JWT_EXPIRES_IN_DAYS, 10) || 90;

/**
 * Tokens are renewed once they are past this share of their lifetime, so an
 * active user's session slides forward and never expires while they keep using
 * the app. Renewing earlier than this would mint a new token on nearly every
 * request for no benefit.
 */
const RENEW_AFTER_FRACTION = 0.5;

const DAY_IN_SECONDS = 24 * 60 * 60;

/**
 * Sign an auth token for a user document.
 *
 * @param {{ _id: unknown, username: string }} user
 * @returns {string} signed JWT
 */
function signAuthToken(user) {
  return jwt.sign(
    { userId: user._id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: `${TOKEN_TTL_DAYS}d` }
  );
}

/**
 * Whether a verified token payload is old enough to be swapped for a fresh one.
 *
 * @param {{ iat?: number, exp?: number }} payload verified JWT payload
 * @returns {boolean}
 */
function shouldRenewToken(payload) {
  if (!payload?.exp) return false;

  const now = Math.floor(Date.now() / 1000);
  const lifetime = payload.iat ? payload.exp - payload.iat : TOKEN_TTL_DAYS * DAY_IN_SECONDS;
  if (lifetime <= 0) return false;

  const remaining = payload.exp - now;
  return remaining <= lifetime * (1 - RENEW_AFTER_FRACTION);
}

module.exports = {
  signAuthToken,
  shouldRenewToken,
  TOKEN_TTL_DAYS,
  RENEW_AFTER_FRACTION,
};
