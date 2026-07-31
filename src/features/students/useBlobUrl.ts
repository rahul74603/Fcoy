// ═══════════════════════════════════════════════════════════════════════════
// useBlobUrl — Cloudinary file ko preview ke layak same-origin URL me badalta hai
//
// KYUN ZAROORI HAI:
// Hamara dev server (vite.config.ts) `Cross-Origin-Embedder-Policy: require-corp`
// bhejta hai (TensorFlow AI-search ke liye). Is policy me cross-origin server
// (res.cloudinary.com) ki files <img>/<iframe> me EMBED nahi hoti — browser
// unhe "ERR_BLOCKED_BY_RESPONSE...Coep" se block kar deta hai.
//
// SOLUTION: fetch(..., {mode:'cors'}) se file download → blob → ObjectURL.
// blob: URL apne hi page ki origin ki hoti hai, isliye COEP ka sawaal hi khatam.
// Ye dev AUR production dono me chalti hai. Agar fetch fail ho jaye (network/CORS)
// to `failed` true hota hai — UI "Nayi Tab" fallback dikha sakta hai (direct top-
// level open kabhi block nahi hoti).
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';

export interface BlobUrlState {
  /** Preview/Download ke liye ready same-origin URL ('' = abhi ready nahi). */
  blobUrl: string;
  loading: boolean;
  /** true = fetch possible nahi hua — caller direct-link fallback dikhaye. */
  failed: boolean;
}

export const useBlobUrl = (remoteUrl: string | undefined): BlobUrlState => {
  const [blobUrl, setBlobUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed]   = useState(false);

  useEffect(() => {
    setBlobUrl('');
    setFailed(false);
    if (!remoteUrl) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl = '';
    setLoading(true);

    fetch(remoteUrl, { mode: 'cors', credentials: 'omit' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(err => {
        console.warn('[useBlobUrl] file fetch fail:', err);
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);  // memory leak nahi
    };
  }, [remoteUrl]);

  return { blobUrl, loading, failed };
};
