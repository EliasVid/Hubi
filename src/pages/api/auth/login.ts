import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { users, sessions } from '../../../db/schema';
import { hashPassword, generateId } from '../../../lib/crypto';

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  const data = await request.json();
  const { email, password } = data;

  try {
    // 1. Find user 
    const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userResult[0];

    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }

    // 2. Verify password
    const { hash } = await hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }

    // 3. Create Session
    const sessionToken = generateId();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

    await db.insert(sessions).values({
      id: generateId(),
      userId: user.id,
      tokenHash: sessionToken,
      expiresAt,
    });

    // 4. Set Cookie
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