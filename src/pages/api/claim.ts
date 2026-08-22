// src/pages/api/claim.ts
import type { APIRoute } from 'astro';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { sessions, profiles, devices } from '../../db/schema';

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = drizzle(env.DB);
  
  // 1. Verify User is Logged In
  const sessionToken = cookies.get('nfc_hub_session')?.value;
  if (!sessionToken) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const sessionResult = await db.select().from(sessions).where(eq(sessions.tokenHash, sessionToken)).limit(1);
  const session = sessionResult[0];
  if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  // 2. Get their profile (so we can auto-route the card to it)
  const profileResult = await db.select().from(profiles).where(eq(profiles.userId, session.userId)).limit(1);
  const userProfile = profileResult[0];
  if (!userProfile) return new Response(JSON.stringify({ error: "Profile not found" }), { status: 400 });

  // 3. Get the device ID from the request body
  const { deviceId } = await request.json();
  if (!deviceId) return new Response(JSON.stringify({ error: "Device ID required" }), { status: 400 });

  try {
    // 4. Update the device in the database to mark it as claimed
    await db.update(devices)
      .set({ 
        isClaimed: true, 
        userId: session.userId,
        profileId: userProfile.id // Instantly assigns it to their profile so it works immediately
      })
      .where(eq(devices.id, deviceId));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }
};