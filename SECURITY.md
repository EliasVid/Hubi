# Security fixes

This document records the security vulnerabilities found in Hubi and the fixes
applied on the `security/fix-vulnerabilities` branch.

## Summary

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | 🔴 Critical | NFC card takeover (IDOR) in `/api/claim` | Fixed |
| 2 | 🔴 High | Sessions never expired server-side | Fixed |
| 3 | 🟠 Medium | Session tokens stored in plaintext | Fixed |
| 4 | 🟠 Medium | Stored XSS / dangerous URL schemes in links & avatars | Fixed |
| 5 | 🟡 Low | Internal DB/error details leaked to clients | Fixed |
| 6 | 🟡 Low | Non-constant-time password compare + user enumeration | Fixed |
| 7 | 🟡 Low | Missing input validation & username normalization | Fixed |
| 8 | ⚠️ Bug | All page `.astro` files missing opening frontmatter fence (repo did not build) | Fixed |
| 9 | 🟡 Low | No rate limiting on auth endpoints | Documented (needs infra) |

---

## 1. 🔴 Critical — NFC card takeover (IDOR) in `/api/claim`

**Before:** `POST /api/claim` verified only that the caller owned the target
`profileId`, then ran `update(devices).where(eq(devices.id, deviceId))` for any
device id. It never checked whether the device was already claimed or who owned
it. The "already claimed" guard existed only in the `claim.astro` page, not the
API. Because device ids are short/guessable (`'xyz-789'`), any authenticated
user could hijack another user's physical card and repoint it to their own
profile.

**Fix (`src/pages/api/claim.ts`):** load the device and reject if it is already
claimed (`isClaimed` true or `userId` set), returning `409 Conflict`. The update
also carries an extra `isClaimed = false` predicate to close the check-then-write
race window.

## 2. 🔴 High — Sessions never expired server-side

**Before:** every session check queried `where(tokenHash = ...)` only; `expiresAt`
was never compared to the current time. The 30-day expiry lived solely in the
browser cookie (client-controlled), so a leaked or stolen token worked forever.

**Fix (`src/lib/auth.ts`):** a single `getValidSession()` helper now filters by
`tokenHash AND expiresAt > now`, and opportunistically deletes expired rows. All
routes and pages use it: `api/claim`, `api/devices`, `api/links`, `api/profile`,
`admin/index.astro`, `claim.astro`.

## 3. 🟠 Medium — Session tokens stored in plaintext

**Before:** the `sessions.token_hash` column stored the raw session token
(`tokenHash: sessionToken`) and compared it raw. A database leak exposed
directly reusable credentials.

**Fix:** `hashToken()` (SHA-256) in `src/lib/crypto.ts` now hashes tokens. Login
stores `hashToken(token)`; the raw token exists only in the user's cookie.
Lookups (`getValidSession`) and logout hash the incoming token before querying.
No schema change is required (the column already holds text). Existing sessions
are invalidated by this change and users simply log in again.

## 4. 🟠 Medium — Stored XSS / dangerous URL schemes

**Before:** `/api/links` and `/api/profile` accepted arbitrary strings for link
`url` and `avatarUrl`. The public profile rendered `<a href={link.url}>`, so a
`javascript:` link (set via direct API call, bypassing the client `type="url"`
field) became a clickable script execution vector.

**Fix:**
- `src/lib/validation.ts` adds `isSafeHttpUrl()` (http/https only) and
  `isSafeAvatarUrl()` (http/https or `data:image/...;base64`, needed for uploaded
  avatars).
- `api/links` validates `url` on POST/PUT; `api/profile` validates `avatarUrl` on
  PUT.
- Defense in depth: `p/[username].astro` neutralizes any non-http(s) `href`
  (`safeHref()`) at render time, protecting against legacy/bad rows.

## 5. 🟡 Low — Internal error details leaked

**Before:** `login` returned `CRASH: <e.message>`; `profile` returned
`DB Error: <realError>`; other routes returned raw `e.message`.

**Fix:** all catch blocks now `console.error(...)` the detail server-side and
return a generic message to the client.

## 6. 🟡 Low — Non-constant-time compare & user enumeration

**Before:** `hash !== user.passwordHash` is not constant-time, and login returned
early (skipping the KDF) when the username was unknown, allowing user enumeration
via response timing.

**Fix (`src/pages/api/auth/login.ts`):** always run the PBKDF2 hash (using a dummy
salt when the user is absent) and compare with `constantTimeEqual()` from
`src/lib/crypto.ts`.

## 7. 🟡 Low — Input validation & username normalization

**Before:** registration accepted any email/password/username and stored the
username with its original case, while login looks users up case-insensitively —
so `Bob` and `bob` could both register yet collide at login.

**Fix (`src/lib/validation.ts` + `auth/register.ts`, `api/profile.ts`):** validate
email format, enforce an 8+ char password, and restrict usernames to
`^[a-z0-9_-]{3,30}$`. Usernames and emails are normalized to lowercase before
insert, so the unique constraint matches login behavior.

## 8. ⚠️ Build bug — missing frontmatter fences

The page `.astro` files (`index`, `login`, `claim`, `admin/index`,
`d/[deviceId]`, `p/[username]`) were missing the opening `---` fence, so their
frontmatter was parsed as template markup and the project failed to build. Added
the opening `---` to each. (`d/[deviceId].astro` also had a stale `// src/pages/c/...`
path comment, corrected to `d/`.)

## 9. 🟡 Low — No rate limiting (recommended, not implemented)

`/api/auth/login`, `/api/auth/register`, and `/api/claim` have no rate limiting,
allowing brute force and mass account/claim attempts. Proper rate limiting on
Cloudflare Workers requires infrastructure (the Rate Limiting binding, a KV
counter, or Durable Objects) and is left as a follow-up. Recommended: per-IP
limits on login/register and per-account lockout/backoff after repeated failures.
