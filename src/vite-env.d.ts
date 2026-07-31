/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  // Document upload (Cloudinary free plan) — ye SECRET nahi hain, sirf upload permission deti hain
  readonly VITE_CLOUDINARY_CLOUD_NAME: string | undefined;
  readonly VITE_CLOUDINARY_UPLOAD_PRESET: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}