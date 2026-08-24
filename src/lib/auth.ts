// src/lib/auth.ts
// Centralized session validation so every route enforces the same rules:
//  - the session token is looked up by its SHA-256 hash (never the raw value)
//  - expired sessions are rejected (and opportunistically deleted)
import { and, eq, gt } from 'drizzle-orm';
import { sessions } from '../db/schema';
import { hashToken } from './crypto';

const SESSION_COOKIE = 'nfc_hub_session';

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

// Returns the valid, non-expired session for the current cookie, or null.
// `cookies` is Astro's AstroCookies; `db` is a drizzle instance.
export async function getValidSession(cookies: any, db: any): Promise<SessionRecord | null> {
  const rawToken = cookies.get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const tokenHash = await hashToken(rawToken);
  const now = new Date();

  const result = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  const session = result[0];
  if (session) return session;

  // No valid session. If a matching-but-expired row exists, clean it up.
  try {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  } catch {
    // best-effort cleanup only
  }
  return null;
}

export { SESSION_COOKIE };
