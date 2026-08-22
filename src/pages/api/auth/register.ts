import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:workers';
import { users, profiles } from '../../../db/schema';
import { hashPassword, generateId } from '../../../lib/crypto';

export const POST: APIRoute = async ({ request }) => {
  const db = drizzle(env.DB);
  const data = await request.json();
  const { email, password, username } = data;

  try {
    const { hash, salt } = await hashPassword(password);
    const userId = generateId();

    await db.batch([
      db.insert(users).values({
        id: userId,
        email,
        passwordHash: hash,
        salt,
      }),
      db.insert(profiles).values({
        id: generateId(),
        userId,
        username,
        displayName: username,
      }),
    ]);

    return new Response(JSON.stringify({ success: true, message: "Account created" }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }
};