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