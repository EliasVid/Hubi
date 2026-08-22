// src/pages/api/auth/login.ts
import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { users, sessions, profiles } from '../../../db/schema';
import { hashPassword, generateId } from '../../../lib/crypto';

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  const data = await request.json();
  const { username, password } = data; // Changed from email to username

  if (!username || !password) {
    return new Response(JSON.stringify({ error: "Username and password required" }), { status: 400 });
  }

  try {
    // 1. Look up the profile by username (case-insensitive)
    const profileResult = await db.select().from(profiles).where(eq(profiles.username, username.trim().toLowerCase())).limit(1);
    const profile = profileResult[0];

    if (!profile) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }

    // 2. Find the master user account tied to this profile
    const userResult = await db.select().from(users).where(eq(users.id, profile.userId)).limit(1);
    const user = userResult[0];

    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }

    // 3. Verify password against the master user account
    const { hash } = await hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }

    // 4. Create Session
    const sessionToken = generateId();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

    await db.insert(sessions).values({
      id: generateId(),
      userId: user.id,
      tokenHash: sessionToken,
      expiresAt,
    });

    // 5. Set Cookie
    cookies.set('nfc_hub_session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      expires: expiresAt
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }
};