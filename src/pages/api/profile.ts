// src/pages/api/profile.ts
import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { profiles } from '../../db/schema';
import { generateId } from '../../lib/crypto';
import { getValidSession } from '../../lib/auth';
import { isSafeAvatarUrl, normalizeUsername } from '../../lib/validation';

// CREATE A NEW PROFILE
export const POST: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  const sessionUser = await getValidSession(cookies, db);
  if (!sessionUser) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const { username } = await request.json();
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    return new Response(JSON.stringify({ error: "Username must be 3-30 chars (a-z, 0-9, - or _)" }), { status: 400 });
  }

  const newProfileId = generateId();

  try {
    await db.insert(profiles).values({
      id: newProfileId,
      userId: sessionUser.userId,
      username: normalizedUsername,
      displayName: normalizedUsername,
      bio: null,
      avatarUrl: null,
      whatsappNumber: null,
      instagramHandle: null,
    });

    return new Response(JSON.stringify({ success: true, id: newProfileId }), { status: 200 });
  } catch (e: any) {
    // Do not leak internal DB errors; a failure here is normally a duplicate username.
    console.error("Profile create error:", e?.cause?.message || e?.message || e);
    return new Response(JSON.stringify({ error: "Username already in use" }), { status: 400 });
  }
};

// UPDATE AN EXISTING PROFILE
export const PUT: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  const sessionUser = await getValidSession(cookies, db);
  if (!sessionUser) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const data = await request.json();
  const { profileId, displayName, bio, avatarUrl } = data;
  if (!profileId) return new Response(JSON.stringify({ error: "Profile ID required" }), { status: 400 });

  const updateData: Record<string, any> = {};
  if (displayName !== undefined) updateData.displayName = displayName;
  if (bio !== undefined) updateData.bio = bio;
  if (avatarUrl !== undefined) {
    // Reject dangerous avatar values (e.g. javascript: / non-image data URIs).
    if (avatarUrl !== null && !isSafeAvatarUrl(avatarUrl)) {
      return new Response(JSON.stringify({ error: "Invalid avatar URL" }), { status: 400 });
    }
    updateData.avatarUrl = avatarUrl;
  }

  try {
    await db.update(profiles).set(updateData).where(and(eq(profiles.id, profileId), eq(profiles.userId, sessionUser.userId)));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    console.error("Profile update error:", e?.cause?.message || e?.message || e);
    return new Response(JSON.stringify({ error: "Failed to update profile" }), { status: 400 });
  }
};
