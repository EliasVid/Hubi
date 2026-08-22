// src/pages/api/profile.ts
import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { sessions, profiles } from '../../db/schema';
import { generateId } from '../../lib/crypto';

// Helper to authenticate
async function getSessionUser(cookies: any, db: any) {
  const sessionToken = cookies.get('nfc_hub_session')?.value;
  if (!sessionToken) return null;
  const sessionResult = await db.select().from(sessions).where(eq(sessions.tokenHash, sessionToken)).limit(1);
  return sessionResult[0] || null;
}

// CREATE A NEW PROFILE
export const POST: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  const sessionUser = await getSessionUser(cookies, db);
  if (!sessionUser) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const { username } = await request.json();
  if (!username) return new Response(JSON.stringify({ error: "Username is required" }), { status: 400 });

  const newProfileId = generateId();

  try {
    await db.insert(profiles).values({
      id: newProfileId,
      userId: sessionUser.userId,
      username: username, 
      displayName: username, 
    });
    
    return new Response(JSON.stringify({ success: true, id: newProfileId }), { status: 200 });
  } catch (e: any) {
    // 🔥 WE CHANGED THIS: Now it sends the raw database error back to your browser alert!
    console.error("DB Error:", e);
    return new Response(JSON.stringify({ error: `DB Error: ${e.message || e}` }), { status: 400 });
  }
};

// UPDATE AN EXISTING PROFILE
export const PUT: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  const sessionUser = await getSessionUser(cookies, db);
  if (!sessionUser) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const data = await request.json();
  const { profileId, displayName, bio, avatarUrl } = data;
  if (!profileId) return new Response(JSON.stringify({ error: "Profile ID required" }), { status: 400 });

  const updateData: Record<string, any> = {};
  if (displayName !== undefined) updateData.displayName = displayName;
  if (bio !== undefined) updateData.bio = bio;
  if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

  try {
    await db.update(profiles).set(updateData).where(and(eq(profiles.id, profileId), eq(profiles.userId, sessionUser.userId)));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: `DB Error: ${e.message || e}` }), { status: 400 });
  }
};