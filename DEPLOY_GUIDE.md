# AUTO DEPLOY SETUP

PC ke bina update karne ka system. Phone se bhi kaam ho jayega.

---

# Kaise Kaam Karta Hai

```
Aap code badlein (kahin se bhi)
        ↓
GitHub par push / commit
        ↓
GitHub Actions apne aap chalta hai
   • npm install
   • TypeScript check
   • npm run build
        ↓
Firebase Hosting par deploy
        ↓
2-3 minute me site live 🚀
```

**Aapke PC ki zaroorat nahi.** Sab kuch GitHub ke server par hota hai.

---

# ⚙️ ONE-TIME SETUP (sirf ek baar)

Ye 3 kaam karne padenge. Uske baad hamesha automatic.

---

## STEP 0 — Workflow Files Activate Karein

⚠️ **Ye step zaroori hai.** Workflow files `setup/workflows/` me rakhi hain,
`.github/workflows/` me nahi.

**Kyun:** GitHub security policy — automated agents `.github/workflows/`
me file nahi bana sakte. Ye jaan-boojh kar hai (warna koi bhi bot aapke
repo me apna code chala sakta tha). Isliye ye ek step aapko karna hoga.

### Tarika A — PC se (2 command)

```powershell
cd C:\Users\Rahul\Fcoy
git pull origin main

mkdir .github\workflows
move setup\workflows\deploy.yml  .github\workflows\
move setup\workflows\preview.yml .github\workflows\
rmdir setup\workflows
rmdir setup

git add -A
git commit -m "ci: activate deploy workflows"
git push origin main
```

### Tarika B — GitHub website se (PC nahi hai to)

1. `https://github.com/rahul74603/Fcoy` kholein
2. **Add file** → **Create new file**
3. Naam me type karein: `.github/workflows/deploy.yml`
   (slash `/` type karte hi folder apne aap ban jayega)
4. `setup/workflows/deploy.yml` ka poora content copy karke paste karein
5. **Commit changes**
6. Yahi `preview.yml` ke liye dobara karein
7. `setup/` folder delete kar dein

---

## STEP 1 — Firebase Service Account

GitHub ko Firebase par deploy karne ki permission deni hai.

**1.** Kholein:
```
https://console.firebase.google.com/project/training-command-erp/settings/serviceaccounts/adminsdk
```

**2.** Neeche **"Generate new private key"** button dabayein

**3.** Confirm karein — ek `.json` file download hogi

**4.** Us file ko Notepad me kholein, **poora content copy** karein
(`{` se lekar `}` tak, sab kuch)

**5.** Ab GitHub par jaayein:
```
https://github.com/rahul74603/Fcoy/settings/secrets/actions
```

**6.** **"New repository secret"** dabayein

| | |
|---|---|
| **Name** | `FIREBASE_SERVICE_ACCOUNT` |
| **Secret** | (JSON ka poora content paste karein) |

**7.** **Add secret** dabayein

⚠️ Downloaded JSON file ko apne PC se **delete kar dein** — GitHub me
safe store ho gayi hai, laptop par rakhna risky hai.

---

## STEP 2 — Environment Variables

Aapki `.env` file GitHub par nahi jaati (aur nahi jaani chahiye).
Isliye har value ko secret banana padega.

Usi page par (`/settings/secrets/actions`) ye secrets add karein.
Value apni local `.env` file se copy karein.

### Zaroori (bina inke app nahi chalega)

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

### AI Agent ke liye

```
VITE_GROQ_API_KEY
VITE_GROQ_API_KEY_2
VITE_GROQ_API_KEY_3
VITE_GROQ_MODEL          →  llama-3.3-70b-versatile
VITE_GEMINI_API_KEY
VITE_GEMINI_API_KEY_2
VITE_GEMINI_MODEL        →  gemini-flash-latest
```

### Optional (Pinecone — abhi off hai)

```
VITE_PINECONE_API_KEY
VITE_PINECONE_HOST
```

💡 Jo secret nahi banayenge wo khaali reh jayega — app usko
gracefully handle karta hai, crash nahi hoga.

---

# ✅ SETUP HO GAYA — Ab Kaise Use Karein

## Tarika 1 — Manual Deploy (sabse aasan)

Bina kuch badle, jab chahein deploy karein:

**1.** Kholein: `https://github.com/rahul74603/Fcoy/actions`

**2.** Left side me **"Deploy to Firebase"** par click

**3.** Right side **"Run workflow"** → **Run workflow**

**4.** 2-3 minute wait — ho gaya

📱 **Ye phone ke browser se bhi ho jaata hai.**

---

## Tarika 2 — Code Badalna (phone se bhi)

**GitHub website ya mobile app se:**

1. File kholein jo badalni hai
2. ✏️ pencil icon dabayein
3. Change karein
4. Neeche **"Commit changes"**
5. Deploy apne aap shuru — 2-3 min me live

---

## Tarika 3 — PC se (jab available ho)

```powershell
git add .
git commit -m "kya badla"
git push origin main
```

Push hote hi deploy shuru.

---

# 🛡️ Safety Features

## TypeScript Check

Deploy se pehle poora code check hota hai. **Agar error hui to
deploy ruk jayega** — toota code kabhi live nahi jayega.

Purani site chalti rahegi. Aapko email aa jayegi.

---

## Emergency Deploy

Agar TypeScript error hai lekin **urgent** deploy karna hai:

Actions → Run workflow → ☑️ **"skip_typecheck"** → Run

⚠️ Sirf emergency me. Site toot sakti hai.

---

## PR Preview

Bada change hai aur pehle test karna hai?

1. Naya branch banayein
2. Pull Request kholein
3. Bot ek **temporary URL** comment karega
4. Wahan test karein — **live site safe rahegi**
5. Theek lage to merge → live deploy

Preview URL 7 din me apne aap khatam.

---

# 📊 Deploy Dekhna

```
https://github.com/rahul74603/Fcoy/actions
```

| Nishan | Matlab |
|---|---|
| 🟡 | Chal raha hai |
| ✅ | Live ho gaya |
| ❌ | Fail — click karke log dekhein |

Har deploy ke baad summary dikhti hai — kaunsa commit, kisne kiya.

---

# 🔧 Problem Aaye To

### "Error: FIREBASE_SERVICE_ACCOUNT not set"
Step 1 dobara karein. Naam bilkul same hona chahiye (capital letters).

### App khulta hai par Firebase connect nahi hota
`VITE_FIREBASE_*` secrets missing hain. Step 2 check karein.

### AI Agent kaam nahi kar raha
`VITE_GROQ_API_KEY` secret add karein.

### TypeScript error se deploy ruk gaya
Actions log me exact line number milega. Fix karke dobara push.

### Deploy hua par site purani dikh rahi
Browser cache. **Ctrl + Shift + R** dabayein.

---

# 📝 Zaroori Baatein

**Secrets kabhi dikhte nahi.** GitHub unhe encrypt karke rakhta hai.
Add karne ke baad aap khud bhi nahi dekh sakte — sirf badal sakte hain.

**`.env` file abhi bhi chahiye** local development (`npm run dev`) ke liye.
Wo sirf aapke PC par rehti hai.

**`dist/` folder ab git me nahi hai.** CI har baar fresh build karta hai.
Isse repo halka rehta hai aur purani build galti se deploy nahi hoti.

**Free tier kaafi hai.** GitHub Actions public repo ke liye free hai.
Har deploy ~2-3 minute leta hai.

---

# Live URL

```
https://training-command-erp.web.app
```

---

END OF FILE

---

# 🏢 MULTI-COY + COMPANY MONITOR (v2.6)

Code ek hi hota hai, har Coy ka apna Firebase project + apni `.env`.

- **Master (F Coy)** = full system + 👑 Subscription/License + 🏢 Company Monitor.
  Local dev ke liye Fcoy ki `.env` me ek baar:
  `VITE_SUBSCRIPTION_ENABLED=true`
  (Auto-deploy ke liye deploy.yml Build env me bhi `VITE_SUBSCRIPTION_ENABLED: 'true'` — web se add karna hai.)
- **Company apps (A Coy/bcoy...)** = flag ka default hi OFF — na banner, na chip,
  na HARD LOCK gate, na /subscription route. KUCH set karna nahi.
- **Company Monitor** (`/company-monitor`, master me 👑 section ke neeche):
  bridge-linked company apps ka LIVE read-only dashboard — trainees, staff,
  leaves, duties, tests, synced plan. Data sirf dekhta hai, badalta nahi.

Update flow (wahee purana):
```
git pull
powershell -ExecutionPolicy Bypass -File deploy\Update-AllApps.ps1 -Yes
```
