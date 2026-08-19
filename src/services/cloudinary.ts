// src/services/cloudinary.ts
// ═══════════════════════════════════════════════════════════
// ☁️ CLOUDINARY UPLOAD SERVICE — Firebase Storage ka FREE alternative
//
// KYUN: Firebase Storage naye buckets ke liye Blaze plan (credit card)
// mangta hai. Cloudinary free tier (25GB) bina card ke chalta hai —
// isliye photos + documents Cloudinary par store hote hain.
//
// SETUP (.env — already configured):
//   VITE_CLOUDINARY_CLOUD_NAME=dm7abiyw
//   VITE_CLOUDINARY_UPLOAD_PRESET=fcoy_unsigned_docs   (unsigned preset)
//
// FLOW:
//   file/base64 → Cloudinary unsigned upload → secure_url (https CDN)
//   → wahi URL Firestore me save (photoURL / fileUrl)
// Purane base64/Firebase URLs waise hi chalte rehte hain — <img src>
// dono ko same tarah render karta hai (backward compatible).
// ═══════════════════════════════════════════════════════════

const CLOUD_NAME = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined)?.trim() ?? '';
const UPLOAD_PRESET = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined)?.trim() ?? '';

/** Cloudinary configured hai? (env vars present) */
export const isCloudinaryConfigured = (): boolean =>
  Boolean(CLOUD_NAME && UPLOAD_PRESET);

export interface CloudinaryResult {
  url: string;       // https secure CDN URL — Firestore me yahi save hota hai
  publicId: string;  // Cloudinary ka file id (path jaisa)
  bytes: number;
  format: string;
}

/**
 * File ya base64 data-URL ko Cloudinary par upload karo.
 * @param source  File object YA "data:image/jpeg;base64,..." string
 * @param folder  Cloudinary folder (e.g. 'trainee-photos', 'documents/REG123')
 * @param timeoutMs  itne ms me jawab na aaye to fail (default 20s)
 */
export const uploadToCloudinary = async (
  source: File | string,
  folder: string,
  timeoutMs = 20000,
): Promise<CloudinaryResult> => {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary configured nahi hai (.env me CLOUD_NAME/UPLOAD_PRESET check karo)');
  }

  const form = new FormData();
  form.append('file', source);           // File object ya data-URL dono chalte hain
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('folder', folder);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 'auto' — images + pdf dono handle karta hai
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
      { method: 'POST', body: form, signal: controller.signal },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Cloudinary upload fail (HTTP ${res.status})`);
    }
    const data = await res.json();
    return {
      url: String(data.secure_url),
      publicId: String(data.public_id),
      bytes: Number(data.bytes ?? 0),
      format: String(data.format ?? ''),
    };
  } finally {
    clearTimeout(timer);
  }
};
