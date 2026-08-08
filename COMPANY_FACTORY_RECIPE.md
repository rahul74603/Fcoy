# 🏭 COMPANY FACTORY RECIPE — Battle-Tested Playbook (B Coy se PROVEN)

> **Status:** ✅ B Coy (fcoy-erp-bcoy) is recipe se LIVE ho chuki — har step tested.
> Is file ko follow karke baaki companies **bilkul same** banengi. Kuch yaad rakhne ki zaroorat nahi — sab yahi likha hai.

---

## 🧭 MODEL (permanent — kabhi change mat karna)

```
TUM (App Developer / Owner)
 │
 ├── 🧪 MASTER APP (training-command-erp)
 │      = TESTING COMPANY (sandbox) + Owner Panel + billing ledger
 │      ⚠️ Isme KOI real company nahi rehti — na A Coy, na koi.
 │
 └── 🌐 8 COMPANY APPS — alag Firebase projects, alag DBs, alag URLs
        fcoy-erp-acoy · fcoy-erp-bcoy · fcoy-erp-ccoy · fcoy-erp-dcoy
        fcoy-erp-ecoy · fcoy-erp-fcoy · fcoy-erp-gcoy · fcoy-erp-hq
        Har app = 1 company ka PRIVATE ghar. Data 100% alag.
        Company ka ASLI naam baad me /first-run wizard se lagta hai.
```

**FLOW (har sale me):** company boli → script chalao (auto) → 30-sec console step (1 baar) → deploy → wizard (2 min, asli naam + CC + plan) → handover (URL + CC login) → master app me billing record. **Fir company khud chalati hai** (staff/batches/data) — tum sirf paise track karte ho.

---

## 🛠️ ONE-TIME TAIYAARI (sirf pehli baar, is PC pe)

```powershell
winget install -e --id Google.CloudSDK
# terminal band -> NAYA terminal kholo, phir:
gcloud auth login
firebase login
```
Login: `trainingcommand.erp@gmail.com`

---

## ⚡ EK COMPANY BANANE KA POORA RECIPE (tested)

### STEP 0 — Pull (hamesha pehle)
```powershell
cd C:\Users\Rahul\Fcoy
git pull origin arena/019fd7d4-fcoy
```

### STEP 1 — Auto-Setup Script (~5-10 min)
```powershell
powershell -ExecutionPolicy Bypass -File deploy\New-CompanyApp.ps1 -Code <code>
```
`<code>` = acoy / bcoy / ccoy / dcoy / ecoy / fcoy / gcoy / hq

**Ye script 7 kaam karti hai (sab idempotent — dobara chalana 100% safe):**
| Step | Kaam | Auto? |
|---|---|---|
| 1/7 | Firebase project `fcoy-erp-<code>` create | ✅ |
| 2/7 | APIs ON (firebase/hosting/firestore/auth) | ✅ |
| 3/7 | Firestore DB (asia-south1) | ✅ |
| 4/7 | Email/Password login ON | 🟡 **30-sec console step (niche)** |
| 5/7 | Web app register | ✅ |
| 6/7 | `deploy\companies.json` me keys AUTO-fill | ✅ |
| 7/7 | Build + Deploy (hosting + rules) → **APP LIVE** | ✅ |

### 🟡 STEP 1.5 — Console ka 30-SEC step (har company me sirf 1 baar)
Script 4/7 pe **rukti** hai aur poochti hai. Tum browser me karo:
1. Script jo link de wo kholo:
   `https://console.firebase.google.com/project/fcoy-erp-<code>/authentication/providers`
2. Bada **"Get Started"** button dikhe → pehle **` dabao
3. **Sign-in method** list → **Email/Password** → pehla toggle **Enable** → **Save**
4. Terminal wapas ao → **ENTER** → script khud verify karegi (`[OK] Email/Password ON`)

> Google auth-config INITIALIZE karne ka public API deta hi nahi (404 CONFIGURATION_NOT_FOUND) — isliye ye ek console step har naye project pe zaroori. Baaki sab 100% auto hai.

### STEP 2 — First-Run Wizard (2 min) — handover ke DIN
Script ke end me jo URL aaya wo kholo:
```
https://fcoy-erp-<code>.web.app/first-run
```
| Field | Kya bharna |
|---|---|
| Parent Unit | jaise `STC TEKANPUR` |
| Company Full Name | asli naam: `B Coy (Bravo Company)` |
| Short Name | `B-COY` |
| Location | `Tekanpur` |
| Commander Name | us company ke boss ka naam |
| CC Email + Password | unka login (min 6 chars) — yehi handover hoga |
| Plan | deal ke hisaab se (Monthly/Quarterly/Yearly) |

→ **Setup Complete Karo** → done screen.

### STEP 3 — Handover test (30 sec)
```
https://fcoy-erp-<code>.web.app/login
```
CC email+password se login karo → dashboard khulna chahiye. **Yehi 2 cheezein** company ko do: `URL + CC login`. Bas. Ab wo khud staff/batches/data banayega.

### STEP 4 — Master app billing sync (1 min)
Master app → Owner Panel → **New Customer (🌐 Remote)** → naam/commander/contact save → **Subscriptions tab** → same plan assign + payment ref. Ab due-date tumhare master pe track hoga.

---

## 🏭 BULK — SAARI companies ek saath

```powershell
powershell -ExecutionPolicy Bypass -File deploy\Prep-AllCompanies.ps1 -Yes
```
- companies.json ki **har non-deployed company** ko line se banata hai
- Har company pe **30-sec console pause** aayega (ooper wala step) — tab tak machine kaam karti hai
- End me **REPORT CARD**: `[OK] / [!!]` per company + logs `deploy\logs\<code>.log`
- Fir kisi bhi company ko sirf wizard (+ STEP 3-4) chahiye handover pe

Ek company agar beech me fail ho jaye → baaki chalti rehti hai; fail wali ko akele dobara chalao:
```powershell
powershell -ExecutionPolicy Bypass -File deploy\New-CompanyApp.ps1 -Code <code>
```

---

## 📋 REGISTRY / STATUS BOARD (update karte raho)

| Code | Company | Project | Status | Wizard | Billing |
|------|---------|---------|--------|--------|---------|
| acoy | A Coy (Alpha) | fcoy-erp-acoy | ☐ pending | ☐ | ☐ |
| bcoy | B Coy (Bravo) | fcoy-erp-bcoy | ✅ **LIVE 8-Aug-2026** | ☐/✅ | ☐ |
| ccoy | C Coy (Charlie) | fcoy-erp-ccoy | ☐ | ☐ | ☐ |
| dcoy | D Coy (Delta) | fcoy-erp-dcoy | ☐ | ☐ | ☐ |
| ecoy | E Coy (Echo) | fcoy-erp-ecoy | ☐ | ☐ | ☐ |
| fcoy | F Coy (Fighter) | fcoy-erp-fcoy | ☐ | ☐ | ☐ |
| gcoy | G Coy | fcoy-erp-gcoy | ☐ | ☐ | ☐ |
| hq | HQ (Headquarters) | fcoy-erp-hq | ☐ | ☐ | ☐ |

---

## 🧯 TROUBLESHOOTING — B Coy banate waqt jo REAL bugs aaye (sab fixed)

| # | Error jaisa dikhega | Wajah | Fix |
|---|---|---|---|
| 1 | `The string is missing the terminator` | Script me emoji (PS5.1 UTF-8 nahi samajhta) | Scripts ab 100% ASCII + BOM ✅ |
| 2 | `NativeCommandError` pe script mar gayi | PS5.1: native stderr + Stop pref = death | `Continue` pref + `cmd /c` wrapper ✅ |
| 3 | `display_name contains invalid characters` | `( )` GCP name me illegal | Auto-sanitize: `(Bravo Company)` → `Bravo Company` ✅ |
| 4 | `403 Forbidden` (auth PATCH) | `x-goog-user-project` header missing | Header added ✅ |
| 5 | `404 CONFIGURATION_NOT_FOUND` | Auth-config initialize nahi (Google API nahi deta) | 30-sec console step (STEP 1.5) ✅ |
| 6 | `project ... already in use` | Project ID duniya me li hui | `-ProjectId fcoy-erp-<code>-74603` se chalao |
| 7 | `quota` / project limit | Naye account pe ~5-12 projects | Purane unused projects delete karo (console.cloud.google.com) |
| 8 | git `Rename ...lock failed` (PC pe pull) | VS Code ne git pakad rakha | VS Code band → `Get-Process git -ErrorAction SilentlyContinue \| Stop-Process -Force` → pull |
| 9 | Script kabhi bhi adhoori mare | — | **Dobara chalao — idempotent hai, kuch nahi toot-ta** |

---

## 🤖 AI RE-BUILD PROMPT (kisi naye session me ye paste kar do — poora context wapas)

```
Mera project: BSF Training Company ERP (React+TS+Tailwind+Firebase/Firestore).
Repo: rahul74603/Fcoy, working branch: arena/019fd7d4-fcoy.
Local PC path: C:\Users\Rahul\Fcoy.

MODEL (permanent kanun):
1. Master app (training-command-erp) = sirf TESTING COMPANY + Owner Panel + billing.
   Usme KOI real company nahi rehti (na A Coy, na koi).
2. 8 real companies: acoy/bcoy/ccoy/dcoy/ecoy/fcoy/gcoy/hq — har ek ka ALAG
   Firebase project (fcoy-erp-<code>) + alag hosting + alag DB. 1 app = 1 company.
3. Strict batch isolation: 2+ batches kabhi lists/totals me mix nahi (scopeVisible() helper).
   Global exceptions sirf: vendors, users/staff, subjects, store/kit items.
4. Developer account (TEST-77) = sandbox only, permanently locked, no batch dropdown.
5. Hierarchy: Owner > CC. CC account sirf owner banata hai (/first-run wizard).
   Remote companies master app me login kabhi nahi pakti (sirf 🌐 billing record).

DELIVERY PIPELINE (tested B Coy pe):
- deploy\New-CompanyApp.ps1 -Code <code>  → 7-step auto (gcloud+firebase CLI).
  Step 4/7 pe 30-sec console pause aata hai (Get Started + Email/Password Enable
  + Save) — Google auth-init ka API nahi deta, isliye manual 1-baar step hai.
- deploy\Prep-AllCompanies.ps1 -Yes → bulk, per-company logs deploy\logs\, report card.
- deploy\companies.json = 8-company registry (script khud keys bhar deti hai).
- Handover = /first-run wizard (unit+CC+plan) → login test → master app me Remote
  customer + subscription assign.
- Har push pe version badge (src/components/layout/Sidebar.tsx) bump karna — meri
  pull-proof mechanism hai.
- Scripts 100% ASCII + UTF-8 BOM rakho (PS5.1 ke liye). $ErrorActionPreference='Continue'.

STATUS: bcoy ✅ LIVE (fcoy-erp-bcoy.web.app), baaki 7 pending.
Rules: catch-all signedIn (customer handover se PEHLE rules hardening pending — advise karna).
```

## 📌 PENDING / NEXT (priority order)

1. **Subscription HARD LOCK** — company app expire/missing plan pe lock ho (abhi sirf banner hai). Wizard ka plan = owner-assigned (ye sahi rahega); renewal flow banana hai (payment ke baad dates extend — owner-side).
2. Baaki 7 companies bulk deploy (upar wala recipe).
3. Customer handover se pehle **Firestore rules hardening** (emulator tests ke saath).
4. Master deployed app ko latest version pe deploy karna (`npm run build` + `firebase deploy --only hosting`).
