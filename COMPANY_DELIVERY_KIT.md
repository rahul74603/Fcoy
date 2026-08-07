# 📦 COMPANY DELIVERY KIT — 8 Companies, Ready-to-Sell

> **Owner ne order kiya:** A/B/C/D/E/F/G/HQ — 8 companies ki alag-alag app
> READY rakho. Company maange → CC account banao → subscription lagao →
> handover. Fir wo apna staff/batch/data khud manage karti hai.
>
> Ye document uska **complete runbook** hai. Ek company ko app dene me
> **~15 minute** lagenge (pehli baar ~30 min).

---

## 🧩 System kaise kaam karta hai (30 second me)

```
TUM (App Developer / Owner)
 │
 ├── 🏠 MASTER APP (training-command-erp) = A Coy ka ghar + sabka BILLING
 │      Isi me tumhara dev account + TEST-77 sandbox + Owner Panel.
 │
 └── 🌐 7 COMPANY APPS (alag Firebase projects, alag URLs)
        bcoy.web.app · ccoy.web.app · dcoy.web.app · ecoy.web.app
        fcoy.web.app · gcoy.web.app · hq.web.app
        Har app = 1 company ka PRIVATE ghar. Data 100% alag (alag DB).
```

**Isliye har company ka data alag hai** kyunki alag DATABASE hai — code me
kuch mix hone ka scope hi nahi. ✅

---

## 📋 8 COMPANIES REGISTRY (track karo)

| Code | Company | Firebase Project (suggest) | App URL | Deployed? | Wizard Done? | Plan | Customer Record? |
|------|---------|---------------------------|---------|-----------|--------------|------|------------------|
| acoy | A Coy (Alpha) | `training-command-erp` | training-command-erp.web.app | ✅ MASTER | ✅ | Monthly (wizard/panel se) | 🏠 THIS UNIT |
| bcoy | B Coy (Bravo) | `fcoy-erp-bcoy` | fcoy-erp-bcoy.web.app | ☐ | ☐ | ☐ | ☐ |
| ccoy | C Coy (Charlie) | `fcoy-erp-ccoy` | fcoy-erp-ccoy.web.app | ☐ | ☐ | ☐ | ☐ |
| dcoy | D Coy (Delta) | `fcoy-erp-dcoy` | fcoy-erp-dcoy.web.app | ☐ | ☐ | ☐ | ☐ |
| ecoy | E Coy (Echo) | `fcoy-erp-ecoy` | fcoy-erp-ecoy.web.app | ☐ | ☐ | ☐ | ☐ |
| fcoy | F Coy (Fighter) | `fcoy-erp-fcoy` | fcoy-erp-fcoy.web.app | ☐ | ☐ | ☐ | ☐ |
| gcoy | G Coy | `fcoy-erp-gcoy` | fcoy-erp-gcoy.web.app | ☐ | ☐ | ☐ | ☐ |
| hq   | Headquarters | `fcoy-erp-hq` | fcoy-erp-hq.web.app | ☐ | ☐ | ☐ | ☐ |

> Project IDs world me unique hone chahiye — agar `fcoy-erp-bcoy` taken ho
> to apna suffix lagao (e.g. `fcoy-erp-bcoy-74603`). Registry file:
> `deploy/companies.json`

---

## 🚀 EK COMPANY KO APP DENA — 4 STEPS (total ~15 min)

### STEP 1 — Firebase project banao (3 min, sirf pehli baar per company)
1. https://console.firebase.google.com → **Add project** → naam: `fcoy-erp-bcoy`
2. **Authentication → Get started → Email/Password** enable karo
3. **Firestore Database → Create database** → Production mode → location: `asia-south1`
4. Project home → **Web app `</>`** add karo → jo config mile usme se 6 keys copy karo
5. **deploy/companies.json** me `bcoy` ke neeche 6 keys paste kar do

> ⚠️ Storage enable karne ki zaroorat nahi. Hosting console se enable karne
> ki bhi zaroorat nahi (script khud kar degi).

### STEP 2 — Deploy (1 command, ~5 min)
```powershell
cd C:\Users\Rahul\Fcoy
powershell -ExecutionPolicy Bypass -File deploy\Deploy-Company.ps1 -Code bcoy
```
Script karegi: keys se `.env` → build → `https://fcoy-erp-bcoy.web.app` live.
(Master `.env` ka backup apne aap hota hai aur restore bhi — master app safe.)

### STEP 3 — First-Run Wizard (2 min)
1. Kholo: `https://fcoy-erp-bcoy.web.app/first-run`
2. Bharo: unit name (STC Tekanpur / B-COY / Bravo Company), Commander ka naam,
   CC ka email+password (jo company ko dena hai), plan choose (Monthly/Quarterly/Yearly)
3. **Setup Complete Karo** dabao — wizard 6 kaam karega:
   ① CC login account  ② CC profile (users doc)  ③ Letterhead (unitConfig)
   ④ Plan activate (`subscription/current`)  ⑤ history entry  ⑥ setup lock
4. Login email/password company ko de do — **HANDOVER DONE** 🎉
   Wo ab `/login` se apni app me ghuskar: batches banayega → staff banayega
   (User Management) → apna poora data khud manage karega.

### STEP 4 — Apni MASTER app me billing record (1 min)
- Owner Panel → Customers tab → **New Customer (🌐 Remote)** → company ka naam,
  commander, contact → Save
- Subscriptions tab → plan assign → payment mode + ref bharo
- Ab unka plan/renewal/due TUMHARE master app me track hoga.

> 🔒 **Kabhi mat karna:** remote company ka login master app me banana —
> wo A Coy ka data dekh legi. Remote record me LOGIN nahi banta taaki
> galti se bhi na ho.

---

## 🔁 RENEWAL kaise hoga (monthly business)

| Kab | Kya |
|-----|-----|
| Company ka plan expire hone wala | Wo tumhe payment degi → tum master app me us customer pe **Renew/Extend** doge (payment ref ke saath) |
| Us company ki APP me plan update | **Option A (abhi):** Master Customer card → plan assign jab karo to usko us app ke Subscription page se bhi dikhna chahiye — uska CC apni app khole Owner Panel nahi, par **Subscription page** me uski expiry dikhti rahegi kyunki tum wizard me payRef/remarks bhar chuke ho. Renewal ke liye: us app me CC login → `/subscription` page → owner se bolo plan "activate/extend" — ABHI ke liye: **CC khud apni app me subscription manage kar sakta hai (CC = app ka admin)** — ya tum us company ke app pe koi bhi staff account bana ke khud login karke update kar do. **Option B (baad me):** Activation Code system (SAAS_FUTURE_PLAN §3) |

> Simple version for now: company tumhe paise degi → tum unki app me unke
> CC ko bologe renew karo (ya unke CC account se khud renew kar doge — CC
> ke paas /subscription page hai hi). Master app me billing hisaab tumhara.

---

## 🛠️ UPDATE dena (naya feature sab companies ko)

Jab master repo me naya feature aaye (version badge badhe):
```powershell
git pull origin arena/019fd7d4-fcoy
powershell -ExecutionPolicy Bypass -File deploy\Deploy-Company.ps1 -Code bcoy
# phir ccoy, dcoy... har deployed company pe ek-ek command
```
Sirf companies.json me keys bhari honi chahiye — dobara console nahi kholna.

---

## ❓ FAQ

**Q: Company app me pehla batch kaun banayega?**
Wizard CC bana deta hai; CC login karke Batch Management se apna pehla
batch banayega (2026-01 jaisa). Staff wo User Management se banayega.

**Q: TEST-77 / dev sandbox customer app me dikhega?**
Nahi. Wizard me `isDeveloper: false` hota hai — dev tools/sandbox sirf
tumhare master account pe hain.

**Q: Company ka data delete/reset karna ho?**
Firebase Console → us project ka Firestore → collections delete. (Rare.)

**Q: Ek command se saari companies deploy?**
Baad me loop script bana sakte hain — abhi 7 commands chalani hain, har
ek pe 1 line.

---

*Ye kit OWNER_ADMIN_GUIDE.md + SAAS_FUTURE_PLAN.md ke saath padho.*
