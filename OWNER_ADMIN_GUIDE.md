# 👑 OWNER ADMIN GUIDE — App Bechne Ka Ready-Made System

Ye document batata hai ki **kal jab tum ye app kisi ko bechoge**, to poora system kaise kaam karega. Sab kuch app ke andar **Owner Admin Panel** me ready bana diya gaya hai.

---

## 🔺 Hierarchy (Kaun Bada)

```
👑 OWNER / DEVELOPER  (TUM — app maker)
   │   Owner Admin Panel: /dev-practice
   │
   ├── 🏢 Customer 1 → Company Commander (F Coy)   [Customer ID: FCOY-2026-001]
   ├── 🏢 Customer 2 → Company Commander (B Coy)   [Customer ID: FCOY-2026-002]
   └── 🏢 Customer 3 → ...
           │
           └── CC apni company chalata hai:
               Clerk / Quarter Master / Ustad accounts
               Batches, Trainees, Funds, Tests — sab
```

**Owner CC se bada hai.** CC ke sidebar me Owner tools dikhte hi nahi (na dev mode, na seed, na subscription).

---

## 🚀 Naya Customer Dene Ka Flow (5 Minute)

Kal kisi unit ko app dena ho:

1. **Apne Owner (Developer) account se login karo**
2. Sidebar → 🧪 **Practice Console** (ya seedha `/dev-practice`)
3. **🏢 Customers tab** → "+ New Customer (CC Account Banao)"
4. Bharo:
   - Unit name (e.g. "B Coy")
   - Commander naam + rank
   - Unka **login email + password** (jo tum customer ko doge)
   - Phone / location / notes (PO number wagairah)
   - Checkbox: *"Ye IS app ka CC hai"* — agar isi deployment ka customer hai
5. **Create** → system automatically:
   - Firebase login account banata hai (role: Company Commander)
   - **Customer ID generate** karta hai: `FCOY-2026-001`, `002`... (sequential)
   - Subscription record ready karta hai (NO PLAN state me)
   - History me entry likhta hai — poora audit trail

> Owner password ek baar maanga jata hai — account switch ke baad system tumhe auto-relogin karta hai. Tum kahin nahi jaoge.

---

## 👑 Subscription Assign / Manage Karna

**👑 Subscriptions tab:**

1. Dropdown se **Customer ID** chuno
2. Teen plans dikhenge (Monthly / 3 Months / Yearly) — prices Owner khud set karta hai (`/subscription` pe "Edit Price" se)
3. **"Assign Plan"** dabao → payment modal:
   - Payment mode: UPI / Cash / Bank Transfer / PO / Cheque
   - Reference No. (Txn ID ya PO number)
   - Remarks
   - ✅ **"Is app (unit) pe turant apply"** — agar customer isi app ka hai, tick rakho → usi second is app ka subscription activate ho jayega (expiry banner/status sab update)
4. Confirm → **record automatically ledger me** (customer-wise history tab me dikhta hai)

**Baad me:**
- **Renew** — bache hue din carry forward hote hain (koi din waste nahi)
- **Quick Extend** +1M / +3M / +12M — payment baad me aaye to bhi validity badha sakte ho
- **Cancel** — turant band (data delete nahi hota)
- **Record** — har customer ka poora payment history date-wise

**Expiry ka system apne aap chalta hai (⚠️ NO GRACE — binary lock):**
| Din bache | Kya hota hai |
|---|---|
| 30 din se zyada | Sab normal (green) |
| ≤ 30 din | Company app me amber warning banner (access full) |
| Expire | **TURANT FULL LOCK** — koi grace period nahi. Data safe rehta hai, renew karte hi wapas |

⚠️ MASTER app par kabhi koi lock/banner nahi — CC/QM/Clerk/Ustad sab
accounts hamesha free. Lock sirf COMPANY apps me enforce hota hai.

---

## 🧪 Testing / Demo Ka System (Permanent)

**🏋️ Test Batch tab:**
- **Generate Test Batch** → completed batch `TEST-77` banta hai:
  - **100 trainees** — religion, state, village, mobile, aadhaar, medical, kit, platoon... poori details
  - **20 staff** (alag ranks, leave/TD/hospital mix)
  - **8 subjects** + assignments
  - **3 training tests** (FPT + 2 weekly, pass/fail/absent results)
  - absent + medical records, staff attendance/leave/duty, schedule, weekly programs
- Ye data **PERMANENT** rahega — practice-clean bhi isse touch nahi karta
- **🔒 Sirf Owner ko dikhta hai** — kisi bhi normal user (Clerk/QM/Ustad/CC) ko kabhi nahi milegi

**Demo dene ke liye perfect:** customer ko app dikhao → dev account se login → poori company ready-made chalti dikh rahi hai.

**🧪 Practice tab:** alag se live-fire testing — snapshot → jo bhi karo → 1 click CLEAN. (Ye temp testing hai, test batch permanent hai — dono alag cheezein.)

---

## 🔑 Account Summary (Kaun Kya Dekhta Hai)

| Account | Login | Kya dikhta hai |
|---|---|---|
| 👑 **Owner (Developer)** | owner email/pass | Owner Admin Panel, subscription manage, test batch, seed tools, sab kuch + test data |
| 🏢 **CC (Customer)** | unka email/pass | Sirf apni company — dashboard, staff, trainees, funds, reports. Koi owner tool nahi |
| 👤 Clerk / QM / Ustad | CC banata hai | Apna-apna module. Test data kabhi nahi |

---

## 📦 Agar Dusri Company Ko ALAG Database Chahiye

Abhi ye system **ek Firebase project = ek unit** ke saath aata hai:

1. Naye customer ke liye repo ka naya deployment + uska apna Firebase project (agar poori isolation chahiye)
2. PEHLA OWNER account Firebase Console se banega (2 min — neeche "Owner Recovery" section me step-by-step hai)
3. Owner login karo → Owner Panel → Customers tab → naye unit ka CC account banao → plan assign karo

> ⚠️ CC ke andar koi "owner banao" option NAHI hota (hamesha locked) — owner sirf tum ho, Console se hi banta/recover hota hai.

---

## 🆘 Owner Recovery — "Login Nahi Ho Raha" Fix (2 min)

Ye app me account **2 jagah** hota hai — dono **same UID** se linked hone chahiye:

| Jagah | Kya hota hai |
|---|---|
| Firebase **Authentication** | email + password (login) |
| Firestore **users** collection | role / isDeveloper / isActive — **Document ID = Auth UID** |

⚠️ **Sabse common login problem:** Auth user hai, lekin Firestore me `users/<UID>` document nahi hai (ya uska Document ID alag hai, jaise `USR-173...`) — tab login "Profile missing" / "Account disabled" jaisa fail hota hai.

### Fix — UID ko Firestore me lagana (exact steps):

1. Firebase Console → **Authentication** → apne owner email pe UID copy karo (e.g. `QKlz...62`)
2. **Firestore Database** → `users` collection → **+ Add document**
3. **Document ID:** wo UID **exactly paste** karo (no spaces)
4. Ye fields daalo:

   | Field | Type | Value |
   |---|---|---|
   | `name` | string | App Owner (ya tumhara naam) |
   | `email` | string | wahi login email |
   | `phone` | string | (blank ok) |
   | `designation` | string | App Owner (Developer) |
   | `role` | string | `Company Commander` |
   | `isActive` | **boolean** | `true` |
   | `isDeveloper` | **boolean** | `true` |
   | `customerId` | string | `OWNER` |
   | `createdBy` | string | self |
   | `createdAt` | string | `2026-08-06T00:00:00.000Z` |

5. Save → app me wapas login karo → **Owner Admin Panel** khul jayega 🎉
6. Agar `users` me koi purana doc hai jiska ID `USR-...` jaisa hai → wo **broken** hai (kabhi login nahi hoga usse) → delete kar do. (User Management page pe aise profiles red **"NO LOGIN (broken)"** badge se dikhte hain — wahan se bhi delete ho jate hain.)

> 💡 Password bhool gaye? Console → Authentication → user → **Reset password**.

---

## ✅ Ready Checklist (Customer ko dene se pehle)

- [ ] Owner account bana liya (ek hi baar)
- [ ] Customer ka CC account + Customer ID bani
- [ ] Plan assign kiya + "Apply to unit" tick kiya
- [ ] Payment reference record kiya
- [ ] Customer ko sirf unka email + password diya
- [ ] (Optional) Test batch generate karke demo liya
- [ ] Customer ke liye expiry reminder date note ki (30 din pehle banner khud aa jayega)

**Bas — ye hai poora readymade SaaS system. Sell karo, CC banao, plan lagao, record rakho.** 🚀
