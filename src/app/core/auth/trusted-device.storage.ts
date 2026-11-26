/**
 * The "remember this device" token the API hands out after a second factor (64 characters, opaque). It is not a
 * session credential: it only lets the next login on this browser skip the second factor, and the server can revoke it
 * any time. It is kept per account (the key carries a hash of the email, never the address itself) so that two people
 * sharing a browser do not send each other's token.
 */
const KEY_PREFIX = 'ff_trusted_device_';

/** Days a remembered device skips the second factor, as configured by the API (`AUTH_TWO_FACTOR_TRUSTED_DEVICE_DAYS`). */
export const DEFAULT_TRUSTED_DEVICE_DAYS = 30;

/** FNV-1a (32 bit): enough to separate accounts in a key, it is not a security primitive. */
function hashEmail(email: string): string {
  let hash = 0x811c9dc5;
  for (const char of email.trim().toLowerCase()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function getTrustedDeviceToken(email: string): string | null {
  if (!email.trim()) {
    return null;
  }
  const token = storage()?.getItem(KEY_PREFIX + hashEmail(email)) ?? null;
  return token && token.length > 0 ? token : null;
}

export function storeTrustedDeviceToken(email: string, token: string): void {
  if (!email.trim() || !token) {
    return;
  }
  try {
    storage()?.setItem(KEY_PREFIX + hashEmail(email), token);
  } catch {
    // Storage full or disabled: the device is simply not remembered.
  }
}

export function clearTrustedDeviceToken(email: string): void {
  if (email.trim()) {
    storage()?.removeItem(KEY_PREFIX + hashEmail(email));
  }
}
