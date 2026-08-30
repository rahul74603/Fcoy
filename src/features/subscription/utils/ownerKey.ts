// ═══════════════════════════════════════════════════════════════════════
// OWNER KEY — SECURE HANDLING
// ───────────────────────────────────────────────────────────────────────
// The owner renewal key authorizes a paid plan extension. The OLD design
// stored the plaintext key in `subscription/current`, which any signed-in
// client could READ — effectively public. We now store only a salted
// SHA-256 hash of the key plus its salt. A reader can verify a key they
// already know, but cannot recover the key from the document.
//
// NOTE: a hashed shared secret in a client-readable doc is a deterrent, not
// a substitute for a trusted backend (Cloud Function). The truly secure
// design is owner renewal performed by a Cloud Function with Admin SDK —
// see REMAINING RISKS. Firestore rules already restrict WRITES to the
// Company Commander regardless of the key.
// ═══════════════════════════════════════════════════════════════════════

const enc = new TextEncoder();

const toHex = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

/** Generate a random salt (hex). */
export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Salted SHA-256 hash of an owner key. */
export async function hashOwnerKey(key: string, salt: string): Promise<string> {
  const prefix = enc.encode(`fcoy-owner:${salt}:`);
  const body = enc.encode(String(key ?? '').trim().toUpperCase());
  const data = new Uint8Array(prefix.length + body.length);
  data.set(prefix, 0);
  data.set(body, prefix.length);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

/**
 * Verify a presented owner key against the stored subscription document.
 * Supports the new hashed scheme (ownerKeyHash + ownerKeySalt) and, for
 * backward compatibility, migrates/accepts a legacy plaintext `ownerKey`
 * field comparison (legacy apps get upgraded on the next successful
 * verification by the caller).
 */
export async function verifyOwnerKey(
  presented: string,
  sub: { ownerKey?: string; ownerKeyHash?: string; ownerKeySalt?: string },
): Promise<boolean> {
  const candidate = String(presented ?? '').trim().toUpperCase();
  if (!candidate) return false;

  if (sub.ownerKeyHash && sub.ownerKeySalt) {
    const hash = await hashOwnerKey(candidate, sub.ownerKeySalt);
    return hash === sub.ownerKeyHash;
  }
  // Legacy plaintext comparison (one-time, will be hashed on next renew).
  return Boolean(sub.ownerKey) && sub.ownerKey === candidate;
}
