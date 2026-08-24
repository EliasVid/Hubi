// src/pages/api/claim.ts
import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { profiles, devices } from '../../db/schema';
import { getValidSession } from '../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);

  const session = await getValidSession(cookies, db);
  if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const { deviceId, profileId } = await request.json();
  if (!deviceId || !profileId) return new Response(JSON.stringify({ error: "Missing data" }), { status: 400 });

  // Security Check: Make sure they own the profile they are linking to!
  const profileResult = await db.select().from(profiles).where(and(eq(profiles.id, profileId), eq(profiles.userId, session.userId))).limit(1);
  if (!profileResult[0]) return new Response(JSON.stringify({ error: "Profile unauthorized" }), { status: 403 });

  // Look up the device and enforce that it is actually claimable. Without this
  // check any authenticated user could POST an arbitrary deviceId and hijack a
  // card already owned by someone else (broken access control / IDOR).
  const deviceResult = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1);
  const device = deviceResult[0];
  if (!device) return new Response(JSON.stringify({ error: "Invalid device" }), { status: 404 });
  if (device.isClaimed || device.userId) {
    return new Response(JSON.stringify({ error: "Device already claimed" }), { status: 409 });
  }

  try {
    // Only update while the device is still unclaimed. The extra WHERE clause
    // closes the race window between the check above and the write.
    await db.update(devices)
      .set({ isClaimed: true, userId: session.userId, profileId: profileId })
      .where(and(eq(devices.id, deviceId), eq(devices.isClaimed, false)));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    console.error("Claim error:", e?.message || e);
    return new Response(JSON.stringify({ error: "Failed to claim device" }), { status: 400 });
  }
};
