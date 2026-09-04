import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css' // <-- THIS IS CRITICAL

// ═══════════════════════════════════════════════════════════
// WHITE-SCREEN GUARD
// ───────────────────────────────────────────────────────────
// Agar purane service worker ne stale index.html cache kiya hai,
// to naye deploy ke baad browser ek delete ho chuki JS file maangta
// hai aur app blank ho jata hai. Ye guard aisa hone par ek baar
// khud cache saaf karke reload kar deta hai.
// ═══════════════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!sessionStorage.getItem('sw-reloaded')) {
      sessionStorage.setItem('sw-reloaded', '1')
      window.location.reload()
    }
  })
}

window.addEventListener('error', (event) => {
  const target = event.target as HTMLElement | null
  const isAssetFail =
    target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')
  if (isAssetFail && !sessionStorage.getItem('cache-purged')) {
    sessionStorage.setItem('cache-purged', '1')
    Promise.resolve()
      .then(() => ('caches' in window
        ? caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        : null))
      .then(() => ('serviceWorker' in navigator
        ? navigator.serviceWorker.getRegistrations()
            .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        : null))
      .finally(() => window.location.reload())
  }
}, true)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
