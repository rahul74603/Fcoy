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

// ─────────────────────────────────────────────
// 👑 MASTER vs COMPANY — OWNER KA KANUN:
//
//   MASTER APP  (VITE_SUBSCRIPTION_ENABLED=true — sirf F Coy/tumhari app):
//     • Owner Admin Panel / Customers / Sync / Company Monitor = ON
//     • LOCK/GATE/BANNER = KABHI NAHI — master pe CC/QM/Clerk/Ustad
//       koi bhi account kholo, app HAMESHA free chalegi.
//
//   COMPANY APPS (flag unset/false — A Coy, B Coy...):
//     • Owner admin tools = OFF (wo master ki cheez hai)
//     • SUBSCRIPTION LOCK = ON — active plan hai to app chalegi,
//       nahi/expire to FULL LOCK. Renew master se sync hota hai.
// ─────────────────────────────────────────────

/** Ye deployment MASTER app hai? (env flag sirf master ki build me true hota hai) */
export const IS_MASTER_APP: boolean =
  import.meta.env.VITE_SUBSCRIPTION_ENABLED === 'true';

/** Owner admin tools (subscription screen, customers, monitor) — sirf MASTER */
export const SUBSCRIPTION_ENABLED: boolean = IS_MASTER_APP;

/** Hard lock/gate/banner enforcement — sirf COMPANY apps (master kabhi lock nahi) */
export const SUBSCRIPTION_LOCK_ENABLED: boolean = !IS_MASTER_APP;
