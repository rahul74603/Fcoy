// src/features/subscription/subscription.config.ts
// ─────────────────────────────────────────────
// 👑 SUBSCRIPTION FEATURE FLAG (Master Control)
// ─────────────────────────────────────────────
// Subscription/License system MASTER (F Coy) ka admin tool hai.
//
// DEFAULT: OFF (kuch set na karo to BAND rahega)
//   → A Coy jaisi saari company apps me apne aap OFF —
//     unki .env me KUCH likhne ki zaroorat NAHI.
//     Update-AllApps.ps1 se features to jaayenge, par
//     subscription system company apps me activate nahi hoga.
//
// Sirf MASTER (F Coy) me ON karne ke liye .env me ye ek line:
//       VITE_SUBSCRIPTION_ENABLED=true
//   (GitHub Actions auto-deploy me bhi build env me
//    VITE_SUBSCRIPTION_ENABLED: 'true' add karna hai — ek baar.)
//
// OFF hone par company app me:
//   • Koi subscription banner / gate / hard lock NAHI
//   • Read-only top-bar license chip synced plan + days-left dikhata rahega
//   • /subscription route login par redirect ho jayega
//   • Sidebar me "👑 Subscription & License" link NAHI aayega
//   • Sirf 'subscription/current' ka read-only listener lagega
// ─────────────────────────────────────────────

export const SUBSCRIPTION_ENABLED: boolean =
  import.meta.env.VITE_SUBSCRIPTION_ENABLED === 'true';
