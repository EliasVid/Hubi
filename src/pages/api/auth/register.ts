import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:workers';
import { users, profiles } from '../../../db/schema';
import { hashPassword, generateId } from '../../../lib/crypto';
import { isValidEmail, isValidPassword, normalizeUsername } from '../../../lib/validation';

export const POST: APIRoute = async ({ request }) => {
  const db = drizzle(env.DB);

  try {
    const data = await request.json();
    const { email, password, username } = data;

    // Validate & normalize input before touching the database.
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!isValidEmail(normalizedEmail)) {
      return new Response(JSON.stringify({ error: "A valid email is required" }), { status: 400 });
    }
    if (!isValidPassword(password)) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), { status: 400 });
    }
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      return new Response(JSON.stringify({ error: "Username must be 3-30 chars (a-z, 0-9, - or _)" }), { status: 400 });
    }

    const { hash, salt } = await hashPassword(password);
    const userId = generateId();

    await db.batch([
      db.insert(users).values({
        id: userId,
        email: normalizedEmail,
        passwordHash: hash,
        salt,
      }),
      db.insert(profiles).values({
        id: generateId(),
        userId,
        username: normalizedUsername,
        displayName: normalizedUsername,
      }),
    ]);

    return new Response(JSON.stringify({ success: true, message: "Account created" }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    // Do not leak internal DB errors to the client. A failure here is almost
    // always a unique-constraint violation (email or username already taken).
    console.error("Register error:", e?.cause?.message || e?.message || e);
    return new Response(JSON.stringify({ error: "Email or username already in use" }), { status: 400 });
  }
};
