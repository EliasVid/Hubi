// src/pages/api/auth/logout.ts
import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { sessions } from '../../../db/schema';
import { hashToken } from '../../../lib/crypto';

export const POST: APIRoute = async ({ cookies }) => {
  const db = drizzle(env.DB);
  const sessionToken = cookies.get('nfc_hub_session')?.value;

  if (sessionToken) {
    try {
      // 1. Remove the active session from the database so it can't be reused.
      //    Sessions are stored as a SHA-256 hash of the token, so hash first.
      await db.delete(sessions).where(eq(sessions.tokenHash, await hashToken(sessionToken)));
    } catch (e) {
      console.error("Failed to delete session from DB", e);
    }
  }

  // 2. Clear the browser cookie
  cookies.delete('nfc_hub_session', { path: '/' });

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};