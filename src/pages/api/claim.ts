// src/pages/api/claim.ts
import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { sessions, profiles, devices } from '../../db/schema';

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  
  const sessionToken = cookies.get('nfc_hub_session')?.value;
  if (!sessionToken) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const sessionResult = await db.select().from(sessions).where(eq(sessions.tokenHash, sessionToken)).limit(1);
  const session = sessionResult[0];
  if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const { deviceId, profileId } = await request.json();
  if (!deviceId || !profileId) return new Response(JSON.stringify({ error: "Missing data" }), { status: 400 });

  // Security Check 1: Make sure they own the profile they are linking to
  const profileResult = await db.select().from(profiles).where(and(eq(profiles.id, profileId), eq(profiles.userId, session.userId))).limit(1);
  if (!profileResult[0]) return new Response(JSON.stringify({ error: "Profile unauthorized" }), { status: 403 });

  // Security Check 2: PREVENT HIJACKING - Ensure the device exists and is NOT already claimed
  const deviceResult = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1);
  const device = deviceResult[0];
  
  if (!device) return new Response(JSON.stringify({ error: "Device not found" }), { status: 404 });
  if (device.isClaimed) return new Response(JSON.stringify({ error: "Device has already been claimed" }), { status: 409 });

  try {
    await db.update(devices)
      .set({ isClaimed: true, userId: session.userId, profileId: profileId })
      .where(eq(devices.id, deviceId));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }
};