# Module — Commander Dashboard (`/commander`)

**Priority: P0 — this is the single most important screen in the demo.**

**Who:** Company Commander only.
**Where:** Sidebar → "Command" → *Commander Dashboard*. Also the CC landing screen.
**Source file:** `src/features/dashboard/CompanyCommanderDashboard.tsx`
**Verification:** CONFIRMED (screen reads live data from 18 Firestore collections).

---

## 1. The One-Line Pitch

> "Ek screen par poori company — kaun present hai, kiske documents adhoore
> hain, kiska FPT fail hai, kitna paisa kis fund me hai, aur aaj kya ho raha
> hai. Bina kisi register ke."

---

## 2. What the Commander Actually Sees

The screen is built as collapsible sections, top to bottom:

| # | Section | What it shows |
|---|---|---|
| 1 | **Training Schedule** | Today's and tomorrow's programme |
| 2 | **Today & Tomorrow** | Immediate operational picture |
| 3 | **Platoon-wise live strength** | Per-platoon head count, live |
| 4 | **Commander Attention Board** | Everything that needs a decision today |
| 5 | **Items requiring immediate action** | The escalation shortlist |
| 6 | **All Modules — Quick Access** | Jump-off tiles to every module |
| 7 | **CC Full Authority** | Command-only tools |

Plus headline stat cards: **Documents · Health Score · Kit Issue Progress ·
Kit Items · Overall Document Progress**.

---

## 3. Where the Numbers Come From (say this if challenged)

This dashboard is not a static mock-up. It aggregates **18 live collections**:

- Trainees, absent records, medical records
- FPT records, weekly test records, weekly programmes
- Vendor entries, custom training items, fund transfers
- Mess fund, training fund, company assets, general fund (each with its own
  expenses ledger), plus training-fund recoveries

**What to say:**
> "Ye numbers kisi ne type nahi kiye. Jaise hi clerk ne medical entry ki,
> ya QM ne kit issue kiya, ya ustad ne test record bhara — ye dashboard
> apne aap badal jata hai."

---

## 4. The Health Score — the WOW number

Every trainee gets a **0–100 health score**, calculated live. Start at 100
and deduct:

| Condition | Deduction |
|---|---|
| Not marked present today | −15 |
| Documents incomplete | −20 |
| Kit not fully issued | up to −15 (scaled by kit %) |
| FPT not passed | −20 |
| Weekly tests failed | −5 each, capped at −15 |
| Pending recovery (money owed) | −10 |

Result is clamped between 0 and 100.

**Why a buyer cares:**
> "Ek number me pata chal jata hai ki trainee kis haal me hai. Commander ko
> paanch register kholne ki zaroorat nahi — jiska score kam hai, use dekho."

**Demo line:** point at the lowest-scoring trainee and say
*"Iska score kam kyun hai?"* — then open the drill-down and show the exact
reasons.

---

## 5. Commander Attention Board — five alert streams

The board is not one generic list. It is five specific, separately computed
alert arrays, with a combined total:

| Alert stream | Triggered by |
|---|---|
| **FPT failures** | Trainee has not passed the physical test |
| **Test failures** | Weekly test failures on record |
| **Document alerts** | Documents still incomplete |
| **Recovery alerts** | Money pending from the trainee |
| **Kit alerts** | Kit not fully issued |

A single **total alerts** figure sits on top.

**What to say:**
> "Commander subah login karta hai aur seedha yahan dekhta hai. Aaj kitne
> cases dhyan mangte hain — ek number. Phir usme se kis type ke, wo bhi
> alag-alag."

---

## 6. The Live Roster — 11 one-tap filters

Below the alerts sits the full roster with instant filters:

`ALL` · `PRESENT` · `ABSENT` · `SICK` · `REST` · `LEAVE` ·
`MEDICAL APPOINTMENT` · `NO KIT` · `DOCS PENDING` · `FPT FAIL` · `RECOVERY`

The first seven map to live attendance codes (P / A / S+H / R / L / M);
the last four are derived condition filters.

**Demo move:** tap *DOCS PENDING* → instant list. Tap *FPT FAIL* → instant
list. This is the fastest visible "aha" in the whole product — two taps,
zero waiting.

**What to say:**
> "Pehle ye list clerk se mangwani padti thi, aadha din lagta tha. Ab do
> tap."

---

## 7. Drill-Down Behaviour (be accurate here)

Clicking a row does **not** navigate away. It opens a **modal on the same
screen**. Three drill-downs exist:

1. **Trainee detail** — full picture of one trainee
2. **Fund detail** — breakdown of one fund
3. **Absent detail** — the absence record behind an entry

**Why this matters (and it is a genuine selling point):**
> "Commander apni jagah se hilta nahi. Detail dekho, band karo, wapas wahi
> list — filter bhi wahi rehta hai. Kisi bhi screen par jaakar wapas aane
> ki zaroorat nahi."

> **Honest note:** because drill-down is modal-based, there is no deep-link
> URL for an individual trainee from this dashboard. Do not promise
> "shareable link to a trainee's card" from here.

---

## 8. The Workflow It Sits In

```
CLERK marks medical entry / QM issues kit / USTAD records test result
        ↓
Data written to its own collection
        ↓
COMMANDER DASHBOARD recomputes health score + alert counts on next load
        ↓
Trainee appears under the matching filter (e.g. FPT FAIL)
        ↓
COMMANDER opens drill-down modal → sees exact reason
        ↓
COMMANDER acts: approves leave, orders recovery, or escalates
        ↓
Action is written to the audit log (Lekha-Jokha Register)
```

---

## 9. Demo Script (90 seconds)

1. **Open `/commander`.** Pause. Let them absorb the density. Say nothing
   for three seconds.
2. "Ye subah ka pehla screen hai." Point at platoon-wise strength.
3. Scroll to the **Attention Board**. "Aaj itne cases dhyan mangte hain."
4. Tap **DOCS PENDING**. List appears instantly.
5. Tap a trainee → **modal opens**. "Detail yahin, screen chhode bina."
6. Close the modal. "Filter wahi ka wahi hai."
7. Point at the **health score**. "Ye number khud calculate hota hai —
   attendance, documents, kit, FPT, test, recovery — chhe cheezon se."
8. Land it: "Commander ne aaj tak koi register nahi khola."

---

## 10. Objection Handling

| They say | You say |
|---|---|
| "Bahut zyada information hai" | "Har section band ho sakta hai. Commander apna view khud set karta hai." |
| "Ye data kaun bharega?" | "Koi extra nahi. Clerk, QM, Ustad apna rozana kaam karte hain — dashboard khud ban jata hai." |
| "Health score ka formula badal sakte hain?" | Honest answer: the weights are in code today. Changing them is a development change, **not** a settings toggle. Do not promise a slider. |
| "Kya ye real-time hai?" | The data is live from the database on load. Say "live data", not "streaming second-by-second". |
| "Offline chalega?" | Do not promise offline. Not verified. |

---

## 11. Do NOT Say

- ❌ "Configurable scoring engine" — the weights are hard-coded.
- ❌ "Click a trainee to open their full 360 profile page" — the Trainee 360
  screen exists in the codebase but is **not wired to any route**.
- ❌ "Push alerts to the commander's phone" — alerts are on-screen, derived
  live. There is no verified push delivery.
- ❌ "Export this dashboard to PDF" — not verified from this screen.
