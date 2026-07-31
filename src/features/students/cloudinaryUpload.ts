// ═══════════════════════════════════════════════════════════════════════════
// cloudinaryUpload.ts — FREE document upload backend (Firebase Storage ka replacement)
// Kyun: Firebase Storage ka naya bucket Blaze (card wala) plan maangta hai.
// Cloudinary free plan (no card) me same kaam + CDN fast delivery milti hai.
//
// SECURITY MODEL (unsigned upload preset):
//  - Browser se direct upload hota hai; API SECRET kabhi client me nahi aata.
//  - Preset dashboard me RESTRICTED banana zaroori hai: sirf jpg/png/webp/pdf,
//    max file size, folder lock, overwrite OFF (setup guide: implementation report Step 5).
//  - Ye 2 env values (cloud name + preset) secret NAHI hain — browser bundle me dikhti
//    hain; unse sirf UPLOAD ho sakta hai, read/delete nahi.
//  - Purani files KABHI DELETE nahi hoti — delete API yahan hai hi nahi (owner rule:
//    old batch ka data delete nahi hona chahiye).
// ═══════════════════════════════════════════════════════════════════════════

const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

/** .env dono values set hain ya nahi — UI isi se friendly guard laga sakta hai. */
export const isCloudinaryConfigured = (): boolean =>
  Boolean(CLOUD_NAME && CLOUD_NAME.trim() !== '' && UPLOAD_PRESET && UPLOAD_PRESET.trim() !== '');

export interface CloudinaryUploadResult {
  /** CDN https URL (document view/download ke liye). */
  url: string;
  /** Cloudinary dashboard me file ki id (audit ke liye). */
  publicId: string;
  /** Server par padi file ka size (bytes). */
  bytes: number;
}

interface CloudinaryResponse {
  secure_url?: string;
  public_id?: string;
  bytes?: number;
  error?: { message?: string };
}

/**
 * Ek file Cloudinary par upload karta hai. `resource_type=auto` isliye
 * jpg/png/webp aur PDF teeno same endpoint se chalte hain.
 */
export async function uploadDocumentToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary config set nahi hai — .env me VITE_CLOUDINARY_CLOUD_NAME aur ' +
      'VITE_CLOUDINARY_UPLOAD_PRESET daalo, phir dev server restart karo.'
    );
  }

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET as string);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
    method: 'POST',
    body: form,
  });

  const data: CloudinaryResponse = await res.json().catch(() => ({} as CloudinaryResponse));

  if (!res.ok || !data.secure_url) {
    throw new Error(data.error?.message || `Cloudinary upload fail (HTTP ${res.status})`);
  }

  return {
    url:      data.secure_url,
    publicId: data.public_id || '',
    bytes:    typeof data.bytes === 'number' ? data.bytes : file.size,
  };
}
