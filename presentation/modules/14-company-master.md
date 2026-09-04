# Module — Company Setup, Users, Settings & Subscription

**Priority: P1 (users, settings) / P0 for the *buyer's own* questions about
licensing.**

**Who:** Company Commander only for `/users` and `/settings`. Subscription
and Company Monitor are **master-side** and flag-gated.

**Source files:**
- `src/features/system/UserManagementPage.tsx` (487 L)
- `src/features/system/SettingsScreen.tsx` (1,211 L)
- `src/features/subscription/*` (~2,000 L across 10 files)
- `src/features/system/SeedStaffData.tsx` (597 L), `SetupDemoUsers.tsx` (84 L)

**Verification:** CONFIRMED for users, settings tabs and the subscription
flag/state machine.

---

# PART A — USER MANAGEMENT (`/users`)

## 1. Commander Creates Every Account

**CC-only** — the screen refuses to render for anyone else.

Creating a user captures: **name, email, password, phone, designation and
role**. Users can be **searched** by name, email or role, **activated /
deactivated** with one tap, and sent a **password reset email**.

## 2. ⭐ Two Details Worth Pointing At

**a) Deactivate, don't delete.** Users are toggled inactive rather than
removed, so their history and audit entries stay intact.

**b) The deletion safety order.** When a user *is* removed, the code
**deactivates first**, with the comment:

> *"Safety: deactivate FIRST so the account can never authenticate"*

**What to say:**
> "Bandaa transfer ho gaya? Account band kar do. Delete mat karo — uske
> naam se jo entries hain wo record me rehni chahiye. Aur agar hataana hi
> hai, to system pehle uska login band karta hai, phir hataata hai. Beech
> me wo login nahi kar sakta."

**c) SO batch assignment happens here.** When the role is
**Senior Officer / Inspector**, the form asks which batches to assign
(`assignedBatchIds`) — the same list that controls what the SO can see in
the inspection module.

> "Inspector banate waqt hi tay ho jaata hai ki wo kaun se batch dekhega."

## 3. Instant Effect

Because the app runs a live listener on the user profile, deactivating
someone or changing their role **takes effect immediately** — they do not
need to log out.

> "Aaj kisi ka role badla? Turant lag jaata hai. Logout ka intezaar nahi."

---

# PART B — SETTINGS (`/settings`)

## 4. Four Tabs

| Tab | Contains |
|---|---|
| 👤 **My Profile** | The logged-in user's own details |
| 🔒 **Change Password** | Password change |
| 👥 **Staff Management** | Activate/deactivate staff, send password reset emails |
| 🛡️ **Unit Config** | Unit-level configuration |

**Note the split:** `/users` creates *login accounts*; the Settings → Staff
tab manages *staff records*. Related, but not the same thing.

---

# PART C — SUBSCRIPTION & LICENSING

## 5. ⚠️ READ THIS BEFORE ANY SALES CONVERSATION

### Subscription is COMPANY-LEVEL ONLY.

**One subscription per company.** Never per user, never per role, never per
batch. If a buyer asks "Clerk ka alag paisa lagega?" the answer is **no**.

### It is OFF by default.

`SUBSCRIPTION_ENABLED` reads the environment flag
`VITE_SUBSCRIPTION_ENABLED === 'true'`. The config file explains the intent:

> *"Subscription/License system MASTER (F Coy) ka admin tool hai.
> DEFAULT: OFF (kuch set na karo to BAND rahega)"*

When it is off, in a delivered company app:
- **No subscription banner, gate or hard lock**
- `/subscription` and `/company-monitor` **redirect to login**
- The sidebar links do **not** appear
- A read-only license chip may still show the synced plan and days left

**What to say to a company buyer:**
> "Aapki company me subscription ka koi lock nahi hai. Kuch band nahi hota.
> License ka hisaab hamare taraf se chalta hai — aapke logon ko wo screen
> dikhti bhi nahi."

---

## 6. The Five Subscription States (master side)

| State | Meaning |
|---|---|
| `none` | Never subscribed |
| `active` | Running |
| `expiring` | Active, but **fewer than 30 days** left |
| `grace` | Expired — **30-day grace period, data still visible (read-only)** |
| `expired` | Fully finished |

**⭐ The grace period is a selling point, not fine print:**

> "License khatam ho gaya? Data turant band nahi hota. Tees din ka grace
> milta hai — aap sab kuch dekh sakte ho, padh sakte ho, report nikal sakte
> ho. Bas naya likhna ruk jaata hai.
>
> Kisi ka kaam ek din late payment se atakna nahi chahiye."

The system also tracks days left, total days and a used-percentage for a
progress bar, and warns at the 30-day mark.

## 7. Default Plans (master-side reference)

| Plan | Duration | Price | Badge |
|---|---|---|---|
| Monthly Plan | 1 month | ₹1,499 | — |
| 3 Months Plan | 3 months | ₹3,999 | **POPULAR** |
| Yearly Plan | 12 months | ₹11,999 | **BEST VALUE** |

All plans list *"Saare modules unlocked"* and *"5 user accounts tak"*.
Plans are seeded into the database on first use and can be **edited from
the UI afterwards** — pricing is not frozen in code.

> ⚠️ **Treat these as defaults, not a published price list.** Confirm
> current commercial terms before quoting them to a customer.

## 8. Developer Accounts Bypass Subscription

A user with `isDeveloper` performs **no subscription reads at all**. Useful
for support and demos; not a customer-facing feature.

---

# PART D — COMPANY MONITOR (`/company-monitor`)

Master-side oversight of company installations. Flag-gated exactly like
`/subscription` — invisible in a delivered company app.

Supporting APIs: `companyBridge.api.ts` (199 L) and `subscription.api.ts`
(296 L), plus an owner-key utility and an owner renewal panel.

**Present this as "hamara taraf ka tool"**, never as a company feature.

---

# PART E — SETUP & SEEDING

| Screen | Route | Purpose |
|---|---|---|
| First Run Setup | `/first-run` | Initial company setup — **unguarded by design**, it is what you use before any user exists |
| Seed Staff Data | — | Bulk-create staff records for a new company |
| Setup Demo Users | — | Create demo accounts |
| Practice Console | `/dev-practice` | Sandbox, with a visible practice banner |
| Mismatch Dashboard | `/mismatch-dashboard` | **CC-only** data-integrity checker |

**The Mismatch Dashboard is worth a mention to a careful buyer:**
> "Ek screen sirf ye dekhne ke liye hai ki data me kahin gadbad to nahi —
> koi record jo aadha-adhoora reh gaya ho. System khud apne aap ko check
> karta hai."

*(Its detailed checks were not traced — describe it as an integrity
checker, do not enumerate specific rules.)*

---

## 9. Demo Script (60 seconds — administrative confidence, not excitement)

1. `/users`. Create a Clerk account live. It takes fifteen seconds.
2. Toggle someone to **inactive**. "Transfer ho gaya? Ek tap."
3. Deliver the deactivate-don't-delete line (§2).
4. Change a role to **Senior Officer / Inspector** — the **batch
   assignment** field appears. Point at it.
5. `/settings` → show the four tabs briefly.
6. If licensing comes up, answer with §5: **one subscription per company,
   no per-user charge, and no lock inside your app.**

---

## 10. ⚠️ Do NOT Promise

- ❌ **"Per-user or per-role pricing."** Company-level only. This is a
  standing instruction, not a preference.
- ❌ **"Self-service role creation."** Roles are code constants.
- ❌ **"SSO / Active Directory / LDAP login."** Not implemented.
- ❌ **"Two-factor authentication."** Not verified.
- ❌ **"Bulk user import from CSV."** `csvImport.service.ts` exists but is
  **not imported anywhere** — dead code.
- ❌ **"Online payment / auto-renewal."** Renewal is handled by the master
  side, not a payment gateway inside the app.
- ❌ **"Custom branding per company."** Not verified.
- ❌ Never show `/subscription` or `/company-monitor` to a company buyer.
  In their build those routes redirect to login anyway.
