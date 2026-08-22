// src/pages/api/links.ts
import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { sessions, profiles, links } from '../../db/schema';
import { generateId } from '../../lib/crypto';

// Security Helper
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

  const { title, url, icon } = await request.json();
  if (!title || !url) return new Response(JSON.stringify({ error: "Title and URL required" }), { status: 400 });

  try {
    await db.insert(links).values({
      id: generateId(),
      profileId: profile.id,
      title,
      url,
      icon: icon || 'language',
      position: 99, // New links go to the bottom by default
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

  const { id, title, url, icon } = await request.json();
  if (!id || !title || !url) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });

  try {
    await db.update(links)
      .set({ title, url, icon })
      .where(and(eq(links.id, id), eq(links.profileId, profile.id)));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }
};

// REORDER (Update Positions)
export const PATCH: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  const profile = await getAuthenticatedProfile(cookies, db);
  if (!profile) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const updates = await request.json(); // Array of { id, position }

  try {
    // Run all updates in parallel
    await Promise.all(updates.map((update: any) => 
      db.update(links)
        .set({ position: update.position })
        .where(and(eq(links.id, update.id), eq(links.profileId, profile.id)))
    ));
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