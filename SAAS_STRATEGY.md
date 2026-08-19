# SUBSCRIPTION / SaaS STRATEGY

BSF Training Command ERP ko yearly subscription product banane ka plan.

---

# ✅ SECURITY STATUS (Updated — August 2026)

## Rules AB HAIN — production-hardened

Purana warning ("firestore.rules hai hi nahi") ab OBSOLETE hai. Aaj:

* `firestore.rules` — 54+ collections ke explicit role-based rules,
  global authenticated fallback removed, catch-all CC-only
* Role trusted `users/{uid}` doc se; inactive users denied
* Emulator test suite `npm run test:rules` — 47/47 security checks pass
* Sync-bridge identity strictly scoped (sirf subscription push)
* File uploads Cloudinary par (Firebase Storage bucket use nahi hota)

Deploy karne se pehle har rules-change par `npm run test:rules` chalana
zaroori hai.

---

# BUYER KAUN HAI — Reality Check

Ye normal SaaS nahi hai. Aapka customer **government unit** hai.

## Jo NAHI hoga

❌ Credit card se monthly subscription

❌ "Sign up free, upgrade later" wala funnel

❌ Stripe/Razorpay checkout page

❌ Self-serve onboarding

## Jo hoga

✅ **GeM portal** — GFR 2017 Rule 149 ke tehat government procurement
GeM se hi hoti hai [gem.gov.in]

✅ **Annual License + AMC** — ye standard government model hai

✅ **PO (Purchase Order) pehle, payment baad me** — 30-90 din late aana normal hai

✅ **Tender/quotation** — ₹2.5 lakh se upar aam taur par

✅ GST invoice, PAN, GSTIN, Udyam registration chahiye hoga

---

## Aapko Kya Chahiye Hoga (Business Side)

| Cheez | Kyun |
|---|---|
| Company registration (Pvt Ltd / LLP / Proprietorship) | Invoice ke liye |
| GSTIN | Government invoice mandatory |
| **Udyam / MSME** | GeM par caution money exemption + price preference |
| GeM seller account | Registration free hai |
| Bank current account | PFMS payment ke liye |
| Digital Signature Certificate | Bid submit karne ke liye |

MSME registration pehle kara lena — GeM par isse kaafi fayda milta hai.

---

# PRICING MODEL

## ⚠️ Ye numbers STARTING POINT hain

Maine market research nahi kiya. Ye Indian government software pricing ki
aam range se hain. **Do-teen units se baat karke validate karein** —
unka actual budget head aur approval limit pooch lein.

---

## Tier Structure

### 1️⃣ Single Company (Coy)

**₹40,000 – ₹75,000 / year**

Ek company (F Coy jaisi), ~200-300 trainees

Saare modules

Email support

5 users tak

---

### 2️⃣ Training Centre

**₹2.5 – 4 lakh / year**

Ek centre ki 6-10 companies (A, B, C... Coy)

Centre-level consolidated dashboard

Priority support + quarterly review

Unlimited users

---

### 3️⃣ Frontier / Zone

**₹15 – 25 lakh / year**

Multiple training centres

Custom reports

On-site training

Dedicated support person

---

### 4️⃣ Force-Wide

**Negotiated**

BSF ke saare training institutions

Deployment aapke ya unke infrastructure par

---

## One-Time Charges (Year 1)

| Item | Range |
|---|---|
| Setup + configuration | ₹15,000 – 30,000 |
| Purane register ka data entry/migration | ₹20,000 – 50,000 |
| On-site training (2 din) | ₹25,000 – 40,000 |

---

## AMC Model (Year 2 onwards)

Government me standard practice: **license value ka 18-25%** AMC.

```
Year 1:  License ₹3,00,000 + Setup ₹40,000  =  ₹3,40,000
Year 2:  AMC 20%  = ₹60,000
Year 3:  AMC 20%  = ₹60,000
```

**Lekin** — SaaS me ye thoda alag hai kyunki aap hosting bhi de rahe hain.
Do options:

**Option A — Pure subscription:** har saal poora amount (₹3L/year)
Simple, predictable revenue. Lekin govt ko "recurring full price"
justify karna mushkil lagta hai.

**Option B — License + AMC:** Year 1 zyada, aage kam.
Govt accounting me aasani se fit hota hai. Recommended.

---

## Paisa Kahan Se Aayega (unke liye)

Unit ke paas ye funds hain — lekin **software procurement inme se nahi**
hota. Wo alag budget head se aata hai:

Modernisation / IT budget

Office equipment head

Contingency (chhoti amount ke liye)

**Ye pooch lena:** "Aapke paas IT/modernisation ka budget head hai?
Kitni amount tak Commandant approve kar sakte hain?"

Aksar ₹50,000 ya ₹1 lakh tak local approval ho jaati hai — usse upar
tender chahiye. **Pricing isi limit ke around rakhna smart hai.**

---

# TECHNICAL ROADMAP

## Phase 0 — SECURITY (abhi ke abhi)

**Bina iske ek bhi rupaya mat lena.**

### 0.1 Firestore Security Rules

Har collection par role-based rules. Sample:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    function userDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function role() {
      return userDoc().role;
    }

    function isActive() {
      return userDoc().isActive == true;
    }

    // Trainee data — Clerk aur CC likh sakte, baaki sirf padh sakte
    match /trainees/{id} {
      allow read: if signedIn() && isActive();
      allow write: if signedIn() && isActive()
                   && role() in ['Company Commander', 'Clerk'];
    }

    // Finance — QM aur CC only
    match /mess_fund_expenses/{id} {
      allow read, write: if signedIn() && isActive()
                         && role() in ['Company Commander', 'Quarter Master'];
    }

    // Users collection — sirf CC
    match /users/{id} {
      allow read: if signedIn();
      allow write: if signedIn() && role() == 'Company Commander';
    }

    // Default DENY — jo explicitly allow nahi, wo band
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

⚠️ Ye sample hai. Aapki 42 collections ke liye poora likhna hoga,
aur **test** karna hoga (Firebase emulator se).

---

### 0.2 Storage Rules

Photos aur bills bhi abhi khule hain.

---

### 0.3 API Key Restrictions

Google Cloud Console → API key ko sirf aapke domain tak restrict karein.

---

## Phase 1 — Multi-Tenancy

Abhi architecture **single-tenant** hai — ek Firebase project = ek company.
2-3 customer tak chal jayega, uske baad manage karna namumkin.

### Teen Approaches

**A. Har customer ka alag Firebase project**

✅ Perfect isolation — aapke `ERP_MASTER_CONTEXT.md` me yahi likha hai

✅ Rules simple

✅ Backup/delete aasan

❌ Har customer manually setup

❌ Update karne ke liye har project pe deploy

❌ 10+ customers = nightmare

*Kab: 5 se kam customers, ya jab client isolation par ade ho*

---

**B. Ek project, har document me `tenantId`**

✅ Ek hi deployment, ek hi update

✅ Sasta

❌ Har query me tenantId lagana padega (42 collections!)

❌ Rules me ek bug = dusre unit ka data leak

*Kab: bahut saare chhote customers*

---

**C. Subcollections — `/tenants/{tenantId}/trainees/...`** ⭐

✅ Natural isolation — path hi alag hai

✅ Rules simple: `/tenants/{tid}/**` par membership check

✅ Per-tenant backup/export aasan

✅ Ek deployment

❌ Data migration karni padegi

❌ Cross-tenant admin ke liye collection group queries

**Recommendation: C**

Aur jo unit "alag database" par ade ho, unko **Option A premium tier**
("Dedicated / Sovereign Deployment") me bech dena — extra paisa. 😄

---

## Phase 2 — License System

### License Document

```
/tenants/{tenantId}/meta/license
{
  plan: 'company' | 'centre' | 'zone',
  status: 'active' | 'expired',  // (grace/suspended REMOVED — binary lock)
  issuedAt: '2026-04-01',
  expiresAt: '2027-03-31',
  maxUsers: 5,
  features: ['ai_agent', 'welfare', 'reports'],
  poNumber: 'BSF/STC/2026/1234',
  invoiceNo: 'INV-2026-001'
}
```

**Financial year ke hisaab se rakhna** (1 April – 31 March) —
government budget cycle wahi hai.

---

### ⚠️ Enforcement Sirf UI Me Mat Rakhna

Client-side check bypass ho jaata hai. **Security rules me lagana hoga:**

```javascript
function licenseValid() {
  let lic = get(/databases/$(database)/documents/tenants/$(tid)/meta/license).data;
  return lic.status == 'active'
      ; // grace read-access REMOVED — expired = no access
}

match /tenants/{tid}/trainees/{id} {
  allow read:  if member(tid) && licenseValid();
  allow write: if member(tid) && licenseValid() && canWrite();
}
```

---

### Grace Period — ❌ REJECTED (owner ka final decision)

> **IMPLEMENTED REALITY:** Koi grace period NAHI hai. Subscription
> active → app chalegi; none/expired → turant FULL LOCK. Neeche ka
> purana grace-planning sirf historical reference ke liye hai.

Government payment **hamesha late** aati hai. Expiry par turant band
karna rishta kharab kar dega.

```
Expiry se 90 din pehle  →  Renewal reminder (budget planning ke liye)
Expiry se 30 din pehle  →  Banner: "License X din me khatam"
Expiry ke baad          →  TURANT FULL LOCK (NO grace — implemented)
                           (data dikhega, export hoga, naya entry nahi)
(Data safe rehta hai — renew karte hi turant wapas)
```

**Data kabhi delete mat karna.** Government client ka data delete
karna legal problem ban sakta hai. Archive karo, delete nahi.

---

## Phase 3 — Owner Console

Aapke liye alag admin panel (`/owner`):

Saare tenants ki list + license status

Naya tenant 10 minute me setup

License extend / suspend

Kaun kitna use kar raha hai

Invoice generate

Renewal alerts

---

## Phase 4 — Trust Features

Government client ye poochega:

**Audit Log** — kisne kya badla, kab. Har write operation.
Ye unko bahut pasand aata hai (accountability).

**Backup + Export** — "hamara data hamara hai".
Ek button se poora data JSON/Excel me.

**Data Retention Policy** — kitne saal data rakhoge, likhit me.

**Uptime commitment** — 99% SLA

---

# 🚨 Ek Baat Jo Deal Todh Sakti Hai

## Internet / Air-Gap

Kuch BSF units **intranet-only** hote hain — internet access nahi.
Firebase ko internet chahiye hi chahiye.

**Ye pehle din pooch lena:** "Aapke office me internet hai? Kya
cloud-based software allowed hai?"

Agar nahi:

On-premise version chahiye hoga (Firebase → PostgreSQL, alag architecture)

Ya sirf un units ko target karo jinke paas internet hai

Ya "hybrid" — local server + periodic sync

**Ye bada architectural decision hai. Pehle confirm karo.**

---

## Data Localisation

Government data India me hi store hona chahiye.
Firebase project region **asia-south1 (Mumbai)** hona zaroori hai.

Check karein abhi kaunsa region hai — agar us-central hai to
ye compliance issue ban sakta hai.

---

# GO-TO-MARKET

## Pehla Customer Sabse Important

Aap khud BSF me hain — ye aapki **sabse badi advantage** hai.

```
Step 1: F Coy me 6 mahine chalao (abhi chal raha hai)
        → Bugs nikaalo, workflow theek karo

Step 2: Numbers collect karo
        "Clerk ka 2 ghante/din bacha"
        "Mess fund audit 3 din → 10 minute"
        "Kit issue me 40% kam galti"
        ← YE SABSE ZAROORI CHEEZ HAI

Step 3: Commandant ko demo — unhi numbers ke saath

Step 4: Ek written appreciation/recommendation letter lo

Step 5: Us letter ke saath dusri companies approach karo

Step 6: Poora centre → phir dusre centres
```

---

## Pitch Kya Ho

❌ "AI-powered ERP with 42 collections and tool-calling agent"

✅ **"Mess fund ka poora hisaab 10 second me. Inspection me
kabhi register nahi dhoondhna padega."**

Government buyer ko technology nahi chahiye — **problem ka hal** chahiye:

Audit/inspection ki tension khatam

Clerk ka time bacha

Fund ka transparent record (accountability)

Trainee ka data ek jagah

---

## Referral Ka Faayda

Ek Commandant ki recommendation = 5 naye leads.
Government me word-of-mouth sabse strong channel hai.

---

# PRIORITY ORDER

```
🔴 ABHI (subscription se pehle bhi zaroori)
   1. Firestore + Storage security rules
   2. API key restriction
   3. Firebase region check (India hona chahiye)

🟠 PEHLE CUSTOMER SE PEHLE
   4. Multi-tenancy (Option C)
   5. License system + rules enforcement
   6. Backup/export button
   7. Audit log

🟡 3-5 CUSTOMERS PAR
   8. Owner console
   9. Onboarding wizard
   10. Invoice generation

🟢 BAAD ME
   11. Feature flags per tier
   12. White-label (unit ka logo)
   13. Usage analytics
```

---

# ANUMAAN — Kitna Kaam

| Phase | Kaam | Time |
|---|---|---|
| 0. Security rules | 42 collections + testing | 3-5 din |
| 1. Multi-tenancy | Migration + saare queries | 2-3 hafte |
| 2. License system | Doc + rules + UI (NO grace) | ✅ DONE |
| 3. Owner console | Naya module | 1-2 hafte |
| 4. Audit + backup | Logging + export | 1 hafta |

**Total: 6-8 hafte** part-time kaam me.

---

# MERA SUGGESTION

**Abhi security rules likhwa lo** — chahe subscription ka plan aage
badhe ya na badhe. Ye abhi ka risk hai.

**Multi-tenancy tab tak mat chhedo** jab tak dusra customer confirm
na ho jaye. Abhi karoge to time waste ho sakta hai — pata nahi
requirement kya nikle.

**Sabse pehle:** F Coy me 3-6 mahine chalao, numbers collect karo.
Wo numbers hi aapka sabse bada sales tool banenge.

---

END OF FILE
