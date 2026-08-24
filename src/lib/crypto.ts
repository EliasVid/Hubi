export async function hashPassword(password: string, saltString?: string) {
  const enc = new TextEncoder();
  const salt = saltString 
    ? Uint8Array.from(atob(saltString), c => c.charCodeAt(0))
    : crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  
  return {
    hash: btoa(String.fromCharCode(...new Uint8Array(hash))),
    salt: btoa(String.fromCharCode(...salt))
  };
}

export function generateId(): string {
  return crypto.randomUUID();
}

// Hash a session token (or any opaque secret) with SHA-256 so it can be stored
// at rest without exposing a directly reusable credential if the DB is leaked.
export async function hashToken(token: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(token));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

// Length-safe, constant-time string comparison to avoid timing side channels
// when comparing secrets (password hashes, tokens).
export function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}