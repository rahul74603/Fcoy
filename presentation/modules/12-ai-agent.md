# Module — The AI Agent (`/ai-agent`)

**Priority: P0 for the "wow" — but demo it LAST, and demo it carefully.**

**Who:** **Company Commander only.** No other role can open it.

**Source files:** `src/features/aiAgent/*` — 28 files, 8,943 lines. Key ones:
- `engine/tools.ts` (1,355 L) — the 31 tools and all authorisation
- `utils/actionHandler.ts` (1,003 L)
- `knowledge/collectionRegistry.ts` (770 L)
- `engine/businessTools.ts` (551 L)
- `engine/agentLoop.ts` (394 L)
- `components/AIAgentScreen.tsx` (423 L) — the screen

**Verification:** CONFIRMED — the tool list, the blocked-collection list and
the confirmation mechanism were all read directly from the code.

> ⚠️ **13 of the 28 aiAgent files are orphans** — never imported. Only the
> screen, engine and utils listed above are live. Do not describe features
> from files nobody loads.

---

## 1. The One-Line Pitch

> "Commander apni bhasha me sawaal poochta hai, aur system asli data se
> jawab deta hai. Report banane ka intezaar nahi."

---

## 2. What It Actually Is

The agent has **31 tools** — real functions that read from and write to the
live database. It is not a chatbot answering from a manual; it queries the
actual company data.

### Reading tools (17)

| Tool | Answers |
|---|---|
| `query_data` | Any filtered query on a collection |
| `join_data` | Combine two collections |
| `find_entity` | Locate a trainee/staff member by loose description |
| `describe_schema`, `sample_values` | What fields exist, what values they hold |
| `system_overview`, `get_context` | Where am I, which batch, which role |
| `get_stock` | Live inventory |
| `get_trainee`, `get_trainee_360` | One man's full picture |
| `get_training_schedule` | Timetable |
| `get_attendance` | Attendance |
| `get_finance_summary`, `get_fund_balance` | Money |
| `get_inspections` | Findings and inspections |
| `get_staff_info` | Staff details |
| `get_company_operational_summary` | The whole company at a glance |
| `resolve_date` | Understands "kal", "pichhle hafte", "is mahine" |

### Writing tools (14)

`add_record` · `update_record` · `delete_record` · `add_trainee` ·
`update_trainee` · `create_trainees` · `assign_chest` · `issue_inventory` ·
`record_expense` · `create_inspection` · `create_finding` ·
`submit_corrective_action` · `verify_finding`

**What to say:**
> "Ye sirf sawaal-jawab nahi hai. Commander keh sakta hai 'in dus naye
> rangroot ko add karo' — aur system kar dega. Lekin poochkar."

---

## 3. 🔒 The Safety Story — this is what you actually sell

**Never demo the AI without covering this section.** The safety design is
more impressive than the AI itself, and it is all verifiable in code.

### Guard 1 — Confirmation before every impactful write

Impactful writes do **not** execute on the first request. The tool returns
a **confirmation request** with a token instead. Only when the Commander
confirms does the write happen. The code comment states it:

> *"When set, a write tool whose confirmToken matches is allowed to
> execute; otherwise destructive/impact writes return a confirmation
> request instead of mutating data."*

**What to say:**
> "AI kabhi chupke se kuch nahi likhta. Pehle dikhata hai — 'ye main karne
> ja raha hoon, theek hai?' Commander haan kahega tabhi hoga."

### Guard 2 — Twenty collections the AI may NEVER touch

A hard block list. The AI cannot write to these through its generic tools,
**no matter what anyone types**:

| Blocked | Why (as stated in code) |
|---|---|
| `users` | identity |
| `staff_leave`, `leave_types` | approval fields are CC-only via dedicated rules |
| `subscriptionHistory`, `subscriptionPlans`, `customers`, `customerSubscriptions`, `companyBridges` | licensing |
| `batches`, `subject_master`, `staff_subjects` | structural masters |
| `issue_records`, `stock_ledgers` | "ONLY mutated by the atomic issue transaction… generic AI writes must never bypass the concurrency-safe stock decrement" |
| `inspections`, `findings` | "carry required ownership/lifecycle fields enforced by Firestore rules" |
| `relegations` | "a multi-doc atomic transaction… generic AI writes would leave half-updated records" |
| `traineeAccounts`, `traineeNotices` | trainee identity and communications |
| `staff_activity_logs` | the audit trail itself |

**This is the single best line in the AI demo:**
> "AI leave approve nahi kar sakta. AI user nahi bana sakta. AI stock ka
> ledger seedha nahi chhed sakta. Aur AI apni khud ki lekha-jokha entry
> nahi mita sakta. Ye sab code me likha hua hai — bees collection jinhe AI
> chhoo hi nahi sakta.
>
> Kyunki AI ko sab kuch dena aasaan hai. Usko sahi tarah se rokna mushkil
> hai. Humne wo mushkil kaam kiya hai."

### Guard 3 — Role checks inside the tools

Finance and inventory writes require **CC or QM**. Staff and training
writes require **CC or Clerk**. The code comment is honest about layering:

> *"defense in depth — the real enforcement is in Firestore security rules;
> this layer fails fast with a clear message"*

### Guard 4 — The model cannot fake its own identity

The batch, role and SO scope are built by the screen from AuthContext and
BatchContext. The code says: *"the model can never set this."* The AI
cannot claim to be someone else to unlock a permission.

### Guard 5 — An explicit no-hallucination rule

The `create_trainees` tool description instructs, in the tool contract
itself:

> *"You MUST pass the actual names the user gave — never invent
> names/service numbers (no fake data)… then re-reads and reports 'X
> created, Y failed' honestly."*

**And it re-reads the database after writing** to report what actually
happened, rather than assuming success.

> "Likhne ke baad system dobara padhta hai aur sach batata hai — kitne bane,
> kitne nahi bane. Jhooti kamyabi ki report nahi deta."

### Guard 6 — Duplicate protection

`assign_chest`: *"If the target chest is already held by someone, it
REPORTS the holder and never overwrites."*
`create_trainees`: *"existing numbers are never overwritten."*

---

## 4. Where The Keys Live

Production runs through **Cloud Functions** (`aiGroq` / `aiGemini`) — the
API keys sit on the server, not in the browser. There is a fallback chain
across providers with cooldowns, so one provider being rate-limited does
not kill the feature.

**What to say (only if a technical buyer asks):**
> "AI ki chaabi server par hai, browser me nahi. Koi user use nikal nahi
> sakta."

---

## 5. Demo Script (90 seconds — do this LAST)

1. Log in as Commander. Open `/ai-agent`.
2. Ask something read-only and specific:
   *"Kitne trainee aaj absent hain?"* — real number from real data.
3. Ask a money question: *"Mess fund me kitna balance hai?"*
4. **Now the important part.** Ask it to do something it must refuse:
   *"Ustad Ramesh ki chutti approve kar do."*
   It cannot — `staff_leave` is on the block list.
5. Deliver the Guard-2 line from §3.
6. Optionally show a write with confirmation: ask it to add a record and
   show the **confirmation prompt** appearing before anything changes.
7. Close with: *"AI madad karta hai. Faisla Commander ka rehta hai."*

---

## 6. ⚠️ Demo Warnings — read before you present

- **AI demos fail live.** Network, rate limits, an unexpected phrasing.
  **Rehearse your exact questions** and have a screenshot as backup.
- **Demo it last.** If it breaks, the rest of the presentation is already
  done. If you open with it and it stumbles, you have lost the room.
- **Do not let the buyer free-type.** Offer to run their question, but ask
  them to say it aloud and type it yourself.
- **Never promise a specific answer format.** Language models vary.

---

## 7. ⚠️ Do NOT Promise

- ❌ **"It works offline."** It calls a cloud service.
- ❌ **"It's always right."** Never claim accuracy guarantees. Position it
  as an assistant whose writes require confirmation.
- ❌ **"Voice input / speech."** Not verified.
- ❌ **"Other roles will get AI too."** It is CC-only, by design and by
  route guard.
- ❌ **"It can do anything in the system."** The opposite is the selling
  point — 20 collections are permanently off-limits.
- ❌ **"It learns from your data over time."** No training or fine-tuning
  on company data.
- ❌ **"Unlimited usage."** There are provider rate limits and cooldowns.
- ❌ Do not describe features from the 13 orphan aiAgent files.
