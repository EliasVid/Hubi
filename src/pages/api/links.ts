// src/pages/api/links.ts
import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { profiles, links } from '../../db/schema';
import { generateId } from '../../lib/crypto';
import { getValidSession } from '../../lib/auth';
import { isSafeHttpUrl } from '../../lib/validation';

// Security Helper: Ensures the current (valid, non-expired) session owns the
// target profile.
async function verifyProfileOwnership(profileId: string, cookies: any, db: any) {
  if (!profileId) return null;
  const session = await getValidSession(cookies, db);
  if (!session) return null;

  const profileResult = await db.select().from(profiles).where(and(eq(profiles.id, profileId), eq(profiles.userId, session.userId))).limit(1);
  return profileResult[0] || null;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  const { title, url, icon, profileId } = await request.json();

  const profile = await verifyProfileOwnership(profileId, cookies, db);
  if (!profile) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  if (!title || !url) return new Response(JSON.stringify({ error: "Title and URL required" }), { status: 400 });
  if (!isSafeHttpUrl(url)) return new Response(JSON.stringify({ error: "URL must be a valid http(s) link" }), { status: 400 });

  try {
    await db.insert(links).values({ id: generateId(), profileId, title, url, icon: icon || 'language', position: 99 });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    console.error("Link create error:", e?.message || e);
    return new Response(JSON.stringify({ error: "Failed to create link" }), { status: 400 });
  }
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  const { id, title, url, icon, profileId } = await request.json();

  const profile = await verifyProfileOwnership(profileId, cookies, db);
  if (!profile) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  if (!id || !title || !url) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
  if (!isSafeHttpUrl(url)) return new Response(JSON.stringify({ error: "URL must be a valid http(s) link" }), { status: 400 });

  try {
    await db.update(links).set({ title, url, icon }).where(and(eq(links.id, id), eq(links.profileId, profileId)));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    console.error("Link update error:", e?.message || e);
    return new Response(JSON.stringify({ error: "Failed to update link" }), { status: 400 });
  }
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  const updates = await request.json();

  if (!updates.length) return new Response(JSON.stringify({ success: true }), { status: 200 });

  const profileId = updates[0].profileId;
  const profile = await verifyProfileOwnership(profileId, cookies, db);
  if (!profile) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    await Promise.all(updates.map((update: any) =>
      db.update(links).set({ position: update.position }).where(and(eq(links.id, update.id), eq(links.profileId, profileId)))
    ));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    console.error("Link reorder error:", e?.message || e);
    return new Response(JSON.stringify({ error: "Failed to reorder links" }), { status: 400 });
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const profileId = url.searchParams.get('profileId');

  const profile = await verifyProfileOwnership(profileId || '', cookies, db);
  if (!profile || !id) return new Response(JSON.stringify({ error: "Unauthorized or missing ID" }), { status: 400 });

  try {
    await db.delete(links).where(and(eq(links.id, id), eq(links.profileId, profileId!)));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    console.error("Link delete error:", e?.message || e);
    return new Response(JSON.stringify({ error: "Failed to delete link" }), { status: 400 });
  }
};
