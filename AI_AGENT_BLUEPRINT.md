# AI AGENT BLUEPRINT

## Purana System vs Naya System

### ❌ Purana (dumb tha)

```
User sawaal
   ↓
1 API call → AI ek JSON intent deta tha
   ↓
actionHandler ke ~8 hardcoded if-else
   ↓
Agar sawaal un 8 me fit nahi hua → "samajh nahi aaya"
```

Problems:

AI ko asli data DIKHTA HI NAHI tha (Pinecone default off tha)

Sirf 4-5 collections ka static schema pata tha

41 collections me se baaki 36 ka AI ko pata hi nahi tha

Har naye sawaal ke liye developer ko naya if-else likhna padta tha

---

### ✅ Naya (asli agent)

```
User sawaal
   ↓
AI sochta hai: "iske liye mujhe kya data chahiye?"
   ↓
TOOL chalata hai → asli Firebase se data padhta hai
   ↓
Data dekhta hai: "kya ye kaafi hai?"
   ↓
Nahi → aur tool chalao (max 6 baar)
Haan → INSAAN ki tarah jawab do
```

Ab AI khud decide karta hai. Koi hardcoded list nahi.

---

## Architecture

```
src/features/aiAgent/
├── knowledge/
│   └── collectionRegistry.ts   🗺️ Poore DB ka map (41 collections)
├── engine/
│   ├── queryEngine.ts          🔍 Universal query/filter/group/join
│   ├── tools.ts                🔧 AI ke 8 tools
│   └── agentLoop.ts            🧠 Think → Act → Observe loop
├── components/
│   └── AIAgentScreen.tsx       💬 Chat UI
└── utils/
    └── smartRouter.ts          ⚠️ DEPRECATED (purana)
```

---

## AI ke 8 Tools

| Tool | Kaam |
|---|---|
| `query_data` | Kisi bhi collection se data — filter, groupBy, sum/avg/count, sort |
| `join_data` | Do collections jodo (e.g. "Bihar ke trainees jo FPT fail") |
| `find_entity` | Naam/chest/mobile se koi bhi dhoondo |
| `describe_schema` | Collection ke fields aur possible values dekho |
| `sample_values` | Field me asal me kya likha hai (spelling discovery) |
| `system_overview` | Active batch, total counts ka snapshot |
| `add_trainee` | Naya trainee (sirf CC/Clerk) |
| `update_trainee` | Trainee update (sirf CC/Clerk) |

---

## Query Engine Capabilities

**Filter operators:**

```
eq, ne, gt, gte, lt, lte
contains, startsWith
in, notIn
exists, empty
between
```

**Aggregations:** `sum`, `avg`, `min`, `max`, `count`

**Aur:** groupBy, sortBy, limit, select, nested paths (`documents.aadhar.status`)

---

## Ab ye sab sawaal chalte hain

```
"kitne trainees hain"
"state wise trainees ka breakdown do"
"Bihar ke kitne trainees hain"
"religion wise ginti batao"
"aaj kitne absent hain aur kyun"
"mess fund me kitna kharcha hua"
"vendor ka kitna paisa baaki hai"
"sabse mehnga expense kaunsa tha"
"Bengal ke trainees jo FPT me fail hue"     ← join
"Platoon 1 me kitne SC category ke hain"
"Rahul ka poora detail batao"
"kaunsa vendor sabse zyada mehnga hai"
"staff me kitne chhutti par hain"
"kit kisko issue nahi hua"
```

Aur inke follow-up bhi — "unme se Bihar ke?" jaisa.

---

## Naya Collection Add Karna

Sirf `collectionRegistry.ts` me entry daaliye:

```typescript
{
  name: 'my_new_collection',
  description: 'Kya rakhta hai ye',
  synonyms: ['hindi naam', 'english name', 'aur variants'],
  batchScoped: true,
  linkField: 'chestNo',
  domain: 'trainee',
  fields: [
    { name: 'fieldName', kind: 'text', label: 'Label',
      synonyms: ['hindi shabd'] },
  ],
}
```

Bas. AI apne aap padhne lagega. **Koi code change nahi.**

---

## Safety

**Role-based writes**

Company Commander + Clerk → read + write

QM, Ustad → read-only (add/update block ho jaata hai)

---

**Iteration cap**

Max 6 tool rounds — infinite loop nahi ho sakta

---

**Doc limits**

Har collection ka `maxDocs` set hai (default 1500)

Response me max 200 rows

---

**Cache**

60 second — ek hi sawaal me same collection baar baar nahi padhta

Naya sawaal aane par cache clear (fresh data)

---

**No hallucination**

System prompt me saaf likha hai: har number tool se aana chahiye

Data na mile to "record nahi mila" bolo, jhooth mat bolo

---

## Fallback Chain

```
1. Quick match (greeting/thanks/bye)  → 0ms, koi API nahi
2. Groq (3 keys, auto-rotate)         → primary
3. Gemini (2 keys)                    → agar Groq fail/rate-limit
4. Friendly error                     → agar dono fail
```

Rate limit ya invalid key par apne aap agli key try hoti hai.

---

## Transparency

Har jawab ke neeche dikhta hai:

```
✅ 1. query_data → trainees: 47 records mile
✅ 2. sample_values → trainees.state me 12 alag values hain

━━━━━━━━━━
🧠 Groq • 2 data lookups • 3.2s
```

User dekh sakta hai AI ne kahan se data liya. Verify karna aasan.

---

## Testing

Development me verify kiya gaya:

Registry: 26 tests (collections, synonyms, schema digest)

Query engine: 35 tests (filters, groupBy, aggregate, join, edge cases)

Tools: 24 tests (schemas, permissions, error handling)

Agent loop: 27 tests (multi-step, parallel, iteration cap, history, failures)

**Total: 112 tests**

---

## Environment

```
VITE_GROQ_API_KEY=
VITE_GROQ_API_KEY_2=
VITE_GROQ_API_KEY_3=
VITE_GROQ_MODEL=llama-3.3-70b-versatile

VITE_GEMINI_API_KEY=
VITE_GEMINI_API_KEY_2=
VITE_GEMINI_MODEL=gemini-flash-latest
```

⚠ Model tool-calling support karta ho — `llama-3.3-70b-versatile` karta hai.

⚠ Gemini me **`-latest` alias** use karein. Pinned naam (`gemini-2.0-flash`,
`gemini-2.5-flash-lite`) retire ho jaate hain ya naye users ko nahi milte.

Pinecone ki ab **zaroorat nahi** — agent live data padhta hai.

---

## Rate Limit Management ⚡

### Problem

Groq free tier: **12,000 token/minute**, aur limit **organization level** par
lagti hai — ek hi account ki 3 keys ek hi limit share karti hain.

Shuruaat me har call ~2,882 token kha raha tha → **4 call/min** → 2-3 sawaal
poochhte hi 429.

### Solution (3 layer)

**1. Fast Path — 0 token**

`engine/fastPath.ts` aam sawaal seedhe DB se banata hai, AI ko bheje bina:

```
"kitne trainees hain"
"state wise / religion wise / platoon wise breakdown"
"rajasthan ke kitne trainees"
"kitne absent hain" / "hospital me kaun"
"mess fund me kitna kharcha"
"vendor ka kitna baaki"
"trainee list dikhao"
```

Pattern match na ho → poora AI agent chalta hai. Ye sirf **shortcut** hai,
limit nahi — "sirf 4 sawaal" wali purani problem wapas nahi aayegi.

---

**2. Focused Schema — 1,270 → ~400 token**

Pehle har call me saari 41 collections ka schema jaata tha.

Ab: sawaal se jude **top 6** collections ke poore fields, baaki sirf naam.
AI ko kisi aur ka detail chahiye to `describe_schema` khud call kar leta hai.

---

**3. Compact Tool Schemas — 1,212 → 960 token**

Tool descriptions chhoti ki gayi. Detailed guidance system prompt me hai
(jo focused digest ki wajah se waise hi chhota ho gaya).

---

### Result

| | Before | After |
|---|---|---|
| Token/call | 2,882 | ~1,600 |
| AI calls/min | 4 | 7 |
| Aam sawaal | AI call | **0 token** |

---

### 429 Handling

Groq ka `retry-after` header aur `"try again in 9m38s"` message parse hota hai

Saari keys busy → chhota wait (max 12s) → ek aur round

Phir bhi fail → **friendly message**: kitni der rukna hai + permanent fix

---

### Permanent Fix (agar abhi bhi limit lage)

**Option A** — alag-alag Google account se Groq keys banayein
(ek account ki multiple keys ek hi limit share karti hain)

**Option B** — Groq Dev tier (~$20/mo) → 500+ RPM

**Option C** — `VITE_GROQ_MODEL=llama-3.1-8b-instant`
(30,000 TPM, thoda kam smart par 2.5x zyada quota)

---

## Error Messages

Raw JSON dump ke bajaye saaf hidayat:

| Situation | Message |
|---|---|
| 429 | "Quota bhar gaya, ~Xs ruko" + permanent fix |
| 404 model | Exact `.env` line + restart reminder |
| 401 | "Key galat hai" + kahan check karein |
| Network | "Internet check karein" |

---

END OF FILE
