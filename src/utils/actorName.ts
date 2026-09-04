// src/utils/actorName.ts
//
// KISI BHI RECORD ME EMAIL NAHI JAANI CHAHIYE.
//
// "Approved by developer@acoy.com" jaisa kuch kabhi nahi dikhna chahiye.
// Dikhna chahiye: "Approved by Sh. Rakesh Kumar, Company Commander".
//
// Problem ye thi: purana code `user?.displayName ?? user?.email` likhta tha.
// Firebase ka `displayName` aksar null hota hai (hum use set nahi karte),
// isliye fallback email par gir jaata tha aur email record me likhi jaati thi
// — hamesha ke liye.
//
// Sahi field `user.name` hai, jo AuthContext hamesha Firestore ke
// users/{uid}.name se bharta hai.

interface ActorLike {
  name?: string | null;
  displayName?: string | null;
  email?: string | null;
  role?: string | null;
  designation?: string | null;
}

/** Kya ye string email jaisi dikhti hai? */
const looksLikeEmail = (v: string): boolean => v.includes('@');

/**
 * Record me likhne ke liye insaan ka naam.
 *
 * Kram: name → displayName → role → 'Unknown'.
 * Email kabhi nahi — chahe naam khaali hi kyon na ho.
 */
export const actorName = (user: ActorLike | null | undefined): string => {
  const name = (user?.name ?? '').trim();
  if (name && !looksLikeEmail(name)) return name;

  const display = (user?.displayName ?? '').trim();
  if (display && !looksLikeEmail(display)) return display;

  // Naam nahi mila to bhi email mat likho — role likh do.
  // "Approved by Company Commander" email se behtar hai.
  const role = (user?.role ?? '').trim();
  if (role && role !== 'Unassigned') return role;

  return 'Unknown';
};

/**
 * Naam ke saath role — display ke liye.
 * "Sh. Rakesh Kumar (Company Commander)"
 */
export const actorNameWithRole = (user: ActorLike | null | undefined): string => {
  const n = actorName(user);
  const role = (user?.role ?? '').trim();
  if (!role || role === 'Unassigned' || role === n) return n;
  return `${n} (${role})`;
};

/**
 * Purane records ke liye safety net.
 *
 * Database me pehle se jo email likhi ja chuki hai use screen par dikhane
 * se pehle isse guzaaro. Agar value email hai to uska local part nikaal kar
 * thoda insaani bana deta hai; warna jaisi hai waisi hi wapas.
 *
 * Ye purana data theek nahi karta — sirf use dikhne layak banata hai.
 */
export const displayActor = (
  value: string | null | undefined,
  fallback = 'Unknown'
): string => {
  const v = (value ?? '').trim();
  if (!v) return fallback;
  if (!looksLikeEmail(v)) return v;

  // "developer@acoy.com" → "Developer"
  const local = v.split('@')[0] ?? '';
  const cleaned = local
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, '')
    .trim();
  if (!cleaned) return fallback;

  return cleaned
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};
