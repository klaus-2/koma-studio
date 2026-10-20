/**
 * Internal/external app protocol constants.
 */
const APP_PROTOCOL = "komastudio";
const INTERNAL_APP_PROTOCOL = "app";
const INTERNAL_APP_HOST = "local";
const INTERNAL_APP_ORIGIN = `${INTERNAL_APP_PROTOCOL}://${INTERNAL_APP_HOST}`;
const INTERNAL_APP_ENTRY_URL = `${INTERNAL_APP_ORIGIN}/index.html`;

export {
  APP_PROTOCOL,
  INTERNAL_APP_ENTRY_URL,
  INTERNAL_APP_HOST,
  INTERNAL_APP_ORIGIN,
  INTERNAL_APP_PROTOCOL,
};
