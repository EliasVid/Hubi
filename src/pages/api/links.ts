// src/pages/api/links.ts
import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { sessions, profiles, links } from '../../db/schema';
import { generateId } from '../../lib/crypto';

// Security Helper: Grabs the profile if the user is logged in
async function getAuthenticatedProfile(cookies: any, db: any) {
  const sessionToken = cookies.get('nfc_hub_session')?.value;
  if (!sessionToken) return null;
  
  const sessionResult = await db.select().from(sessions).where(eq(sessions.tokenHash, sessionToken)).limit(1);
  if (!sessionResult[0]) return null;
  
  const profileResult = await db.select().from(profiles).where(eq(profiles.userId, sessionResult[0].userId)).limit(1);
  return profileResult[0] || null;
}

// CREATE (Add Link)
export const POST: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  const profile = await getAuthenticatedProfile(cookies, db);
  if (!profile) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const { title, url } = await request.json();
  if (!title || !url) return new Response(JSON.stringify({ error: "Title and URL required" }), { status: 400 });

  try {
    await db.insert(links).values({
      id: generateId(),
      profileId: profile.id,
      title,
      url,
      position: 0,
    });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }
};

// UPDATE (Edit Link)
export const PUT: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  const profile = await getAuthenticatedProfile(cookies, db);
  if (!profile) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const { id, title, url } = await request.json();
  if (!id || !title || !url) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });

  try {
    // We use "and" to ensure they own the link they are editing
    await db.update(links)
      .set({ title, url })
      .where(and(eq(links.id, id), eq(links.profileId, profile.id)));
      
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }
};

// DELETE (Remove Link)
export const DELETE: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  const profile = await getAuthenticatedProfile(cookies, db);
  if (!profile) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  // Get the ID from the URL (e.g., /api/links?id=123)
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: "Link ID required" }), { status: 400 });

  try {
    await db.delete(links).where(and(eq(links.id, id), eq(links.profileId, profile.id)));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }
};