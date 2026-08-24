// src/pages/api/devices.ts
import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { devices, profiles } from '../../db/schema';
import { getValidSession } from '../../lib/auth';

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);

  // Verify User Session (checks token hash + expiry)
  const sessionUser = await getValidSession(cookies, db);
  if (!sessionUser) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  // Parse Request Data
  const { deviceId, profileId } = await request.json();
  if (!deviceId) return new Response(JSON.stringify({ error: "Device ID required" }), { status: 400 });

  // Security Check: If assigning to a profile, ensure the user actually owns that profile
  if (profileId) {
    const profileCheck = await db.select().from(profiles).where(and(eq(profiles.id, profileId), eq(profiles.userId, sessionUser.userId))).limit(1);
    if (!profileCheck[0]) return new Response(JSON.stringify({ error: "Profile unauthorized" }), { status: 403 });
  }

  try {
    // Update the routing target for this physical hardware device
    await db.update(devices)
      .set({ profileId: profileId || null }) // null means "Unassigned"
      .where(and(eq(devices.id, deviceId), eq(devices.userId, sessionUser.userId)));
      
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    console.error("Device update error:", e?.message || e);
    return new Response(JSON.stringify({ error: "Failed to update device" }), { status: 400 });
  }
};