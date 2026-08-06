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

**Expiry ka system apne aap chalta hai:**
| Din bache | Kya hota hai |
|---|---|
| 30 din se zyada | Sab normal (green) |
| ≤ 30 din | Har screen pe amber warning banner |
| Expire | 30 din **grace** — data dikhta hai, naya entry nahi |
| Grace ke baad | Access band — data safe rehta hai, renew karte hi wapas |

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
2. PEHLA OWNER account wahan bhi one-time bootstrap se banta hai:
   - Naye app me pehla login CC se karo (seed/demo users)
   - `/dev-practice` kholo → koi owner nahi mila to **"Create Owner Account"** automatically dikhega
   - Owner banao → logout → owner se login → wapas wahi Owner Panel

> ⚠️ Ek owner account hone ke baad bootstrap option gayab ho jata hai — koi aur owner nahi bana sakta CC se.

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
