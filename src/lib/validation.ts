// src/lib/validation.ts
// Input validation helpers shared by the API routes.

// Only http/https links are allowed as public link targets. This blocks
// dangerous schemes such as javascript:, data:, vbscript: and file: that
// would otherwise be stored and rendered as clickable <a href> (stored XSS).
export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

// Avatars may be an http(s) URL OR an inline data:image/... URL, because the
// admin panel uploads resized avatars as a base64 webp data URL.
export function isSafeAvatarUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(value)) return true;
  return isSafeHttpUrl(value);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value);
}

// Usernames become part of a public URL (/p/<username>), so restrict them to a
// safe, predictable character set and length.
const USERNAME_RE = /^[a-z0-9_-]{3,30}$/;
export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return USERNAME_RE.test(normalized) ? normalized : null;
}

export function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 256;
}
