// src/pages/api/profile.ts
import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { sessions, profiles } from '../../db/schema';

export const PUT: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  
  const sessionToken = cookies.get('nfc_hub_session')?.value;
  if (!sessionToken) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const sessionResult = await db.select().from(sessions).where(eq(sessions.tokenHash, sessionToken)).limit(1);
  const session = sessionResult[0];
  if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const data = await request.json();
  
  // Only update fields that exist in the payload
  const updateData: Record<string, any> = {};
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.bio !== undefined) updateData.bio = data.bio;
  if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;

  try {
    await db.update(profiles).set(updateData).where(eq(profiles.userId, session.userId));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }
};