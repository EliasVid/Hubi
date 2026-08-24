// src/pages/api/auth/login.ts
import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq, sql } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { users, sessions, profiles } from '../../../db/schema';
import { hashPassword, generateId, hashToken, constantTimeEqual } from '../../../lib/crypto';

// A fixed dummy hash used to equalize timing when the account does not exist,
// so login response time does not reveal whether a username is registered.
const DUMMY_SALT = btoa('0000000000000000');

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);

  try {
    const data = await request.json();
    const { username, password } = data;

    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return new Response(JSON.stringify({ error: "Username and password required" }), { status: 400 });
    }

    // 1. Look up the profile (case-insensitive)
    const normalizedUsername = username.trim().toLowerCase();
    const profileResult = await db.select().from(profiles)
      .where(sql`lower(${profiles.username}) = ${normalizedUsername}`)
      .limit(1);
    const profile = profileResult[0];

    // 2. Find the user (may be null)
    const user = profile
      ? (await db.select().from(users).where(eq(users.id, profile.userId)).limit(1))[0]
      : undefined;

    // 3. Verify password. Always run the KDF (even when the user is missing)
    //    and use a constant-time comparison to avoid user-enumeration and
    //    timing side channels.
    const { hash } = await hashPassword(password, user?.salt ?? DUMMY_SALT);
    const passwordOk = !!user && constantTimeEqual(hash, user.passwordHash);

    if (!user || !passwordOk) {
      return new Response(JSON.stringify({ error: "Invalid username or password." }), { status: 401 });
    }

    // 4. Create Session. Store only the SHA-256 hash of the token; the raw
    //    token lives only in the user's cookie.
    const sessionToken = generateId();
    const tokenHash = await hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

    await db.insert(sessions).values({
      id: generateId(),
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // 5. Set Cookie
    cookies.set('nfc_hub_session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: request.url.startsWith('https'),
      sameSite: 'lax',
      expires: expiresAt
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (e: any) {
    console.error("Login error:", e?.message || e);
    return new Response(JSON.stringify({ error: "Login failed" }), { status: 400 });
  }
};
