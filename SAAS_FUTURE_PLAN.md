# 🗺️ FCOY ERP — SaaS Future Plan (Advance Planning Document)

> **Owner ke order pe banaya gaya master plan.** Ye document batata hai ki
> aaj ka system kya hai, aur nayi companies bechte waqt kya-kya karna hai.
> Har step tested tareeke se likha hai — jab B Coy,C Coy... bechni ho, isi
> ko follow karo.

---

## 1. 🏗️ AAJ KA MODEL (Final — ise badalna nahi hai)

```
APP DEVELOPER (Owner — 1 hi account, poora system iske haath me)
 │
 ├── 🧪 TEST-77 → DEV SANDBOX (LOCKED)
 │      Dev account sirf yahi dekhta hai. Dummy trainees/staff yahin.
 │      Real data yahan NAHI aata, sandbox data bahar NAHI jaata.
 │      Is app me Developer ka koi batch/batch-switch nahi hota.
 │
 ├── 🏠 THIS APP = 1 COMPANY ka ghar (isLocalUnit = TRUE)
 │      Jis company ke liye ye deployment hai (abhi: A Coy — Shivam Sengar CC)
 │      Golden Rule: is app me sirf EK local unit hogi, kabhi do nahi.
 │
 └── 🏢 CUSTOMERS (Owner Panel) = baaki companies ka BILLING record
        Nayi company becho → customer record + plan. Unka app ALAG deploy hota hai.
```

**Subscription ka rishta:** Dev/Owner har company ka plan likhta hai
(`customerSubscriptions/{customerId}`), aur jis company ke liye ye app hai
uska plan `subscription/current` pe live apply hota hai.

---

## 2. 📦 COMPANY DELIVERY PLAYBOOK (har nayi company ke liye)

Jab koi nayi company (B Coy, C Coy...) app kharide — ye 6 steps:

| # | Step | Detail |
|---|------|--------|
| 1 | **Firebase project** | Naya project banao (asia-south1). Auth → Email/Password ON. Firestore banao. Hosting ON. |
| 2 | **Code deploy** | Repo ka copy → `.env` me us company ke Firebase keys → `npm install` → `npm run build` → `firebase deploy --only hosting,firestore:rules,firestore:indexes` |
| 3 | **Pehla CC account** | Customer app ke User Management/Owner provisioning se us company ka 1 Company Commander banao |
| 4 | **Unit set karo** | CC login → Unit Config me us company ki letterhead (unit, coy, location, addresses) |
| 5 | **Apni master app me record** | Owner Panel → Customers (CC) tab → naya customer → **"🌐 Remote company" select karo (default)** — ye billing-only record hai, is app me unka LOGIN nahi banta 🔒. Phir Subscriptions tab se plan assign karo. |
| 6 | **Handover** | CC ko login details + OWNER_GUIDE. Backup habit: Firestore export weekly. |

> ⚠️ **Remote company ka login is master app me KABHI mat banao** — ye app
> A Coy ka ghar hai, shared database me doosri company ka login = data leak.
> Form me "Remote company" default isi liye hai.

---

## 3. 💳 SUBSCRIPTION CONTROL — customer apps me plan kaise jayega?

Ye future ka sabse important technical piece hai. 3 options (recommended order):

### Option A — Owner account har customer app me (aaj se possible, zero code)
Har customer project me OWNER ka bhi ek account banao (same email/password
tumhara). Plan renew karna ho → us company ki app kholo → apne owner
account se login → us app ke andar se plan apply (Subscription page).
*Simple, abhi kaam karta hai. Thoda manual.*

### Option B — Activation Code (next build — recommend)
Master app me "Generate Activation Code" button: ek short code
(e.g. `A-COY-9F2K-30D`) banega jisme plan + validity encrypted hogi.
Customer app pehli baar kholte hi code maangegi → verify → apna
`subscription/current` khud set kar legi. Expire pe owner naya code dega.
*Manual login ki zaroorat nahi, offline-verify possible.*

### Option C — Central License Server (jab 10+ companies ho)
Ek chhota Cloud Function master project me; har customer app login pe
usse apna status poochhe (cached 7 din offline grace). Auto-expiry,
auto-suspend — bilkul professional SaaS jaise.
*Bada kaam; tabhi jab customer count justify kare.*

---

## 4. 🔒 SECURITY & DATA RULES (har deployment pe)

| Rule | Detail |
|------|--------|
| **1 deployment = 1 company** | Do companies ka data ek app me KABHI nahi |
| **UID = doc ID** | Firestore `users` doc ka ID = Auth UID (login tabhi chalega) |
| **Rules deploy** | `firestore.rules` har project me deploy karna mat bhoolo |
| **Dev cleanup** | Customer deployment me TEST-77 seed NAA chalao; dev tools band |
| **Batch kanun** | Har screen sirf selected batch ka data; 2 batches kabhi mix nahi |
| **Backup** | Customer ko weekly Firestore export sikhao |

---

## 5. 🔄 UPDATE DELIVERY (naye features sab companies tak kaise?)

1. Master repo me feature banao → version badge badhao (`vX.Y.Z · Label`)
2. `git tag vX.Y.Z` → companies ko WhatsApp pe "update aaya" message
3. Har company ke repo clone pe: `git pull` → build → deploy
4. CHANGELOG.md maintain karo (kya mila naya, kya toot sakta hai)

**Version badge rule:** Har push me Sidebar ka version badho — user ko
pata chale ki naya code aa gaya ya nahi (Ctrl+Shift+R ke baad).

---

## 6. 🏢 OPTIONAL PHASE-X: True Multi-Tenant (ek hi app me saari companies)

Abhi **recommend NAHI** (42+ collections pe tenantId stamp + har query +
rules rewrite — bada risk). Lekin planning ready rakhi hai:

- Launch tabhi jab: 20+ companies ho AUR BSF-style data isolation ki
  zaroorat kam ho (military/military-adjacent customers alag instance
  prefer karte hain — security audits easy hote hain).
- Migration path: `tenantId` field + context (`TenantContext` — waisa hi
  jaise BatchContext ka kanun hai) + rules: `exists(/databases/$(db)/documents/tenants/$(tenantId)/members/$(uid))`.
- Effort estimate: 4-6 focused sessions + full re-test.

---

## 7. 🗓️ ROADMAP (rough)

| Phase | Kya | Status |
|-------|-----|--------|
| 0 | Batch kanun + dev sandbox lock + 1st company (A Coy) + unit subscription | ✅ DONE |
| 1 | B Coy ko bhechne ka dry-run (playbook §2 follow karke) | ⏭️ NEXT |
| 2 | Activation Code system (§3 Option B) | 📋 Planned |
| 3 | Invoice/receipt PDF (plan payments ka) | 📋 Planned |
| 4 | 5+ companies ke baad: update pipeline automate | 📋 Planned |
| X | Multi-tenant (sirf tab jab justify ho) | 💤 Deferred |

---

*Document owner: App Developer · Update hota rahega jab koi phase complete ho.*
