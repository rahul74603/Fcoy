# WELFARE & DEMOGRAPHICS MODULE BLUEPRINT

## Uddeshya / Purpose

Har trainee ko uske **apne tyohaar** par sahi welfare mile.

Examples:

Bihar ke jawan ko Chhath par thekua saamagri aur ghat arrangement

Bengal ke jawan ko Durga Puja par bhog

Punjab ke jawan ko Baisakhi par langar

Muslim jawan ko Ramzan me sehri/iftar timing

Christian jawan ko Christmas par church visit

---

## ⚠ NIYAM — Bahut Zaroori

Ye module **KEVAL KALYAN NIYOJAN** ke liye hai.

**Kisi bhi prakar ke bhedbhav ke liye prayog VARJIT hai.**

Ye disclaimer screen par bhi permanently dikhta hai
aur har print report ke header me bhi jaata hai.

---

## Data Source Rule

Koi **nayi** personal detail alag se NAHI li jaati.

Sab kuch pehle se maujood **Trainee Registration Form** se aata hai:

| Screen Field | Registration Form Location |
|---|---|
| State | Step 2 → Permanent Address → State |
| District | Step 2 → Permanent Address → District |
| Religion | Step 1 → Personal Details → Religion |
| Category | Step 1 → Personal Details → Category |
| Gender | Step 1 → Personal Details → Gender |
| Blood Group | Step 1 → Personal Details → Blood Group |
| Marital Status | Step 1 → Personal Details |
| Education | Step 3 → Educational Qualification |
| Platoon / Section | Step 4 → Recruitment & Training |
| Medical Status | Trainee Profile → Edit |
| **Language** | **State se AUTO-DERIVED** (form me field nahi hai) |
| **Zone** | **State se AUTO-DERIVED** |
| **Age Band** | **DOB / Age se AUTO-DERIVED** |

Clerk ko kuch extra bharna nahi padta.

---

## Route

```
/welfare-demographics
```

Access:

Company Commander

Clerk

Quarter Master (ration / budget planning ke liye)

Sidebar location:

Clerk → Trainee Management → 🤝 Welfare & Demographics

Quarter Master → Festival Welfare Plan

---

## Screen Structure

### KPI Strip (6 cards)

Total Strength

In Current View

States

Religions

Languages

Data Completeness %

---

### Tab 1 — Demographics

**PERMANENT CARDS (hamesha dikhte hain, hataye nahi ja sakte):**

State / राज्य

Religion / धर्म

Language / भाषा (state se derived)

Zone / क्षेत्र (North / South / East / West / Central / North East)

**OPTIONAL FILTERS ("Add Filter" button se):**

District

Category

Gender

Blood Group

Education

Marital Status

Age Band

Platoon

Section

Medical Status

---

### Tab 2 — Festival Planner

Aane wale tyohaar (30 din / 90 din / poora saal)

Har tyohaar par:

Kitne trainees eligible hain

Welfare suggestion (kya arrangement chahiye)

Anumanit budget

State-wise breakup

Eligible roster CSV export

---

### Tab 3 — Trainee List

Filter lagne ke baad jo trainees bache — unki poori list

Sortable columns

Mobile number **default me chhupa** (privacy) — "Show Contact" se dikhta hai

CSV export

---

## Filter Logic

Rule 1

Ek dimension ke andar → **OR**

Example: State = Bihar **OR** Punjab

---

Rule 2

Alag dimensions ke beech → **AND**

Example: State = Bihar **AND** Religion = Hindu

---

Rule 3

**Cross-filtered facets**

Jab aap State = Bihar chunte ho, to State card me baaki states
bhi dikhte rehte hain (taaki aap switch kar sako),
lekin Religion card sirf Bihar walon ka breakdown dikhata hai.

---

## Spelling Normalisation

Purane records me galat spelling ho to bhi count sahi aata hai:

```
'Bengal'  → West Bengal
'bangal'  → West Bengal
'WB'      → West Bengal
'BIHAR'   → Bihar
'U.P.'    → Uttar Pradesh
'Orissa'  → Odisha
'hindu'   → Hindu
'islam'   → Muslim
```

Aliases yahan hain:

`src/features/welfare/data/stateMeta.ts`

---

## Festival Eligibility Logic

Har festival me do rule ho sakte hain — religion aur state.

**mode = ANY**

Jo rule set hai, unme se koi ek match ho jaye

Example: Baisakhi = Sikh **YA** Punjab

---

**mode = ALL**

Jitne rule set hain, sab match hone chahiye

Example: Chhath = Hindu **AUR** Bihar/Jharkhand/UP

---

**Koi rule nahi**

Sabke liye (National holidays)

Example: Independence Day

---

## Festival Calendar

File:

`src/features/welfare/data/festivalCalendar.ts`

Coverage: 2026 aur 2027

Naya festival add karna ho to bas array me object push karo —
code change ki zaroorat nahi.

⚠ Lunar festivals (Eid, Muharram, Milad) ki dates **TENTATIVE** hain —
chaand dikhne par 1 din aage-peeche ho sakti hain.
Screen par "TENTATIVE" badge dikhta hai.

---

## Data Quality

Agar kisi trainee ki State ya Religion blank hai:

Screen par amber warning dikhti hai

Wo trainee "Not Recorded" bucket me jaata hai

Festival welfare list me nahi ginna jaata

Theek karne ka rasta: **Trainee Management → Search & Profile → Edit**

---

## File Structure

```
src/features/welfare/
├── WelfareDemographicsScreen.tsx   Main screen (3 tabs)
├── components/
│   ├── DimensionCard.tsx           Ek dimension ka count + filter bars
│   ├── FestivalPlanner.tsx         Tyohaar planning
│   └── TraineeResultTable.tsx      Filtered trainee list
├── data/
│   ├── stateMeta.ts                State → zone/language + aliases
│   └── festivalCalendar.ts         2026-27 calendar
├── hooks/
│   └── useWelfareData.ts           Real-time listener + faceting
├── types/
│   └── welfare.types.ts            Domain types
└── utils/
    └── demographics.ts             Normalise / aggregate / filter / export
```

---

## Database

**Koi nayi collection nahi banti.**

**Koi write operation nahi hota.**

Module sirf `trainees` collection ko **read-only** sunta hai
(`onSnapshot` — real-time update).

---

## Export Options

CSV — Demographics summary (sabhi active dimensions)

CSV — Filtered trainee list

CSV — Kisi ek festival ka eligible roster

Print — A4 report with purpose disclaimer + signature blocks
(Clerk / Head Clerk aur Company Commander)

---

## Development Rule Compliance

✔ No hardcoded trainee data — sab Firestore se

✔ No new fields — sirf registration form ke fields

✔ Chest Number primary identity — table me pehla column

✔ Batch-aware — active batch default, "All Batches" option bhi

✔ Role based access — CC / Clerk / QM

---

END OF FILE
