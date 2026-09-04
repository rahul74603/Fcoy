# The Slide Deck

> **What this file is:** the actual presentation, slide by slide. Each slide
> has a **title**, the **text that goes on the slide**, and **speaker notes**
> for what you say out loud.
>
> **Format:** 24 slides. Slides marked 🖥️ are **live demo**, not slides —
> switch to the app.
>
> **Golden rule:** the slides are the frame. The demo is the product. If you
> are running short, cut slides, never cut demos.

---

## Deck Structure

| Part | Slides | Minutes |
|---|---|---|
| **A. The Problem** | 1–4 | 5 |
| **B. What FCOY Is** | 5–7 | 4 |
| **C. Live Demo — the workflows** | 8–16 | 20 |
| **D. Trust & Safety** | 17–20 | 8 |
| **E. Close** | 21–24 | 5 |
| | | **~42 min + Q&A** |

For the 20-minute version: slides 1, 2, 5, 6, then demos 8–11, then 17, 21, 24.
For the 5-minute version: slide 2, demo WF-1, slide 24.

---

# PART A — THE PROBLEM

---

## Slide 1 — Title

**ON SLIDE:**

> # FCOY
> ### Training Company Management System
>
> Ek company. Ek system. Sab kuch jagah par.
>
> *[Unit name] · [Date]*

**SPEAKER NOTES:**
Do not start talking about software. Introduce yourself, thank them, and go
straight to slide 2. Total time on this slide: 15 seconds.

---

## Slide 2 — The Real Problem

**ON SLIDE:**

> ## Aaj subah ka sawaal
>
> **"Aaj company me kitne aadmi hain?"**
>
> - Clerk register kholta hai
> - Ustad se poochta hai
> - MI room se pata karta hai
> - Chutti wali file dekhta hai
> - Phir jawab deta hai — **do ghante baad**
>
> Aur agla din, wahi sawaal, wahi do ghante.

**SPEAKER NOTES:**
This is the most important slide in the deck. Deliver it slowly. Do not
mention software at all. If the room nods here, everything after is easy.

Ask them directly: *"Aapke yahan kitna waqt lagta hai?"* Let them answer.
Their number is now your benchmark.

---

## Slide 3 — Why It Happens

**ON SLIDE:**

> ## Dikkat register ki nahi hai
>
> Dikkat ye hai ki **ek hi baat paanch jagah likhni padti hai**
>
> Rangroot bimar hua →
> `Absent register` · `MI room register` · `Nominal roll` ·
> `Notice board` · `Commander ko report`
>
> **Paanch jagah. Teen log. Ek galti kaafi hai.**

**SPEAKER NOTES:**
Do not blame anyone. Say explicitly: *"Ye kisi ki galti nahi hai. Insaan
paanch jagah ek jaisa nahi likh sakta — ye system ki dikkat hai."*

That framing matters. You are not telling them their clerk is careless.

---

## Slide 4 — What It Costs

**ON SLIDE:**

> ## Iska nateeja
>
> | | |
> |---|---|
> | 📋 | Register aur haqeeqat alag ho jaate hain |
> | 💰 | Mahine ke aakhir me paisa kam pad jaata hai |
> | 🎖️ | Duty us aadmi ko lag jaati hai jo chutti par hai |
> | 📄 | Inspection me "ye entry kisne ki thi?" ka jawab nahi hota |
> | ⏰ | Officer ka aadha din hisaab milane me jaata hai |

**SPEAKER NOTES:**
Pick the one that matches your audience and expand on it. A QM will react
to the money line; an inspecting officer to the audit line.

---

# PART B — WHAT FCOY IS

---

## Slide 5 — The Idea

**ON SLIDE:**

> ## FCOY ka ek hi usool
>
> # Ek baar likho.
> # Baaki system karega.
>
> Clerk ne report approve ki —
> **paanch register apne aap bhar gaye.**

**SPEAKER NOTES:**
This is the thesis. Say it and pause. Everything in the demo is proof of
this one sentence.

---

## Slide 6 — Who Uses It

**ON SLIDE:**

> ## Chhe log, chhe alag screen
>
> | Role | Kya karta hai |
> |---|---|
> | 🎖️ **Company Commander** | Sab dekhta hai · chutti approve · faisle |
> | 📋 **Clerk** | Rangroot, documents, MI room, notice |
> | 📦 **Quarter Master** | Store, kit, char fund, vendor |
> | 🎓 **Ustad** | Training, schedule, duty, attendance |
> | 🔍 **Senior Officer** | Inspection aur findings |
> | 👤 **Rangroot** | Apni report, notice, file |
>
> **Har role ko sirf apna kaam dikhta hai.**

**SPEAKER NOTES:**
Emphasise the last line. Separation is a feature, not a limitation. The QM
genuinely cannot see trainee medical records — and that is deliberate.

If asked about licensing here, answer immediately: **one subscription per
company, never per user.**

---

## Slide 7 — The Modules

**ON SLIDE:**

> ## Kya-kya hai
>
> **Rangroot** — admission · documents · MI room · gair-hazri · chutti · relegation
> **Training** — 33 vishay · FPT · weekly test · schedule · batch progress
> **Staff** — nominal roll · attendance · duty · deputation · chutti
> **Store** — inventory · kit issue · size-wise stock
> **Paisa** — char fund · vendor · bill · mess boy salary
> **Nigrani** — inspection · findings · corrective action · compliance
> **Report** — 20 tayaar report · Excel aur print
> **Aur** — AI sahayak · Lekha-Jokha register · Today Special

**SPEAKER NOTES:**
Do not read this list aloud. Let them scan it for ten seconds, then say:
*"Ye sab dikhane me do ghante lagenge. Isliye main aapko teen kaam shuru se
aakhir tak dikhata hoon."*

Then move straight to the demo.

---

# PART C — LIVE DEMO 🖥️

> **Before this section:** check your demo data, log-ins and network. See
> `01-PRESENTATION-ROADMAP.md` for the prerequisite checklist.

---

## Slide 8 — Demo Intro

**ON SLIDE:**

> # Ab live system
>
> Teen kaam. Shuru se aakhir tak.
>
> 1. Rangroot bimar hua
> 2. Ustad ne chutti maangi
> 3. Officer ne inspection ki

**SPEAKER NOTES:**
Say the framing line:
> "Main aapko ek-ek screen nahi dikhaunga. Ek kaam shuru se aakhir tak
> dikhaunga — aur dhyan rakhiyega ki beech me kisi ko kuch yaad rakhna
> nahi padta."

---

## 🖥️ Demo 9 — Commander's Morning

**Run:** `/commander`
**Reference:** `modules/02-cc-dashboard.md` §9

1. Open it. **Say nothing for three seconds.**
2. Platoon-wise strength. *"Ye subah ka pehla screen hai."*
3. Attention Board. *"Aaj itne cases dhyan mangte hain."*
4. Tap **DOCS PENDING** → instant list. Tap **FPT FAIL** → instant list.
5. Tap a trainee → **modal opens**. *"Detail yahin, screen chhode bina."*
6. Close it — *"filter wahi ka wahi hai."*
7. Health score: *"Chhe cheezon se khud banta hai — hazri, documents, kit,
   FPT, test, recovery."*

**Land:** *"Commander ne aaj tak koi register nahi khola."*

---

## 🖥️ Demo 10 — ⭐ Trainee Falls Sick (WF-1)

**The most important 90 seconds of the presentation.**
**Reference:** `05-WORKFLOW-CATALOG.md` WF-1

1. **Login as trainee.** *"Ye rangroot ka phone hai."*
2. Report tab → **🤒 Sick Report** → 3 days → reason → submit.
3. **Login as Clerk.** Updates tab already has a **red badge**.
   *"Clerk ko dhoondhna nahi pada."*
4. Click **Approve**. **Pause.** *"Ab ek-ek karke dekhte hain kya hua."*
5. `/absent-management` → entry है, type `S`
6. `/medical-register` → MI room entry hai
7. `/commander` → **SICK** filter → wahi aadmi, health score gira
8. `/audit-log` → the full Hindi sentence

**Land:** *"Clerk ne ek button dabaya. Paanch register bhar gaye. Aur chhe
mahine baad bhi pata chalega ki kisne, kab, kyun kiya."*

---

## 🖥️ Demo 11 — ⭐ Leave & Duty (WF-2 + WF-6)

**Reference:** `05-WORKFLOW-CATALOG.md` WF-2, WF-6

1. **As Ustad:** `/staff-leave` → Apply → 5 days. Point at the auto number.
2. **As Clerk:** same leave visible — **no Approve button.** *Pause here.*
3. **As Commander:** bell already shows it → click → lands on that leave.
4. Approve. *"Ab dekho kya-kya apne aap hua."*
5. `/staff-attendance` → **all 5 days already marked leave**, with reason.
6. `/duty-management` → **"On Leave (CL), 4 Sep to 8 Sep" — assign nahi ho
   sakta.** *This is the moment. Pause.*
7. Show someone already on duty → **amber warning**, still allowed.

**Land:** *"Commander ko yaad rakhne ki zaroorat nahi. System yaad rakhta hai."*

---

## 🖥️ Demo 12 — Store & Kit (WF-3)

**Reference:** `modules/06-quartermaster-inventory.md` §12

1. `/inventory` → four stats → **LOW STOCK** badge.
2. **Open management screen** → `/issue-kit`.
3. Search chest number → add PT Shoes → **pick a size**.
   *"Size-wise stock alag track hota hai."*
4. Issue.
5. Point at **"Manual Recovery Only"** banner.
   *"System chupke se paisa nahi kaat-ta."*

*(Only for technical buyers: add the atomic transaction line — two QMs, last
pair of shoes, one gets `INSUFFICIENT STOCK`, stock never goes minus.)*

---

## 🖥️ Demo 13 — ⭐ The Money (WF-5)

**Reference:** `modules/07-finance-funds.md` §10

1. `/funds`. Let the six numbers land.
2. **Total Orders** vs **Actually Paid**. *This is the moment for QMs:*
   > "Do lakh ka saaman order hua. Vendor ko sirf sattar hazaar diye. Purane
   > register me dono ek jaise likhe jaate the. Yahan teen alag sach."
3. Point at the formula printed on screen. *"Kuch chhupa nahi hai."*
4. Click a fund → modal → Collections / Expenses. **ESC** to close.
5. `/vendor-payments` → opens on **Pending** → show a **Partial** payment.

---

## 🖥️ Demo 14 — ⭐ Inspection Closes The Loop (WF-4)

**The closer for senior officers.**
**Reference:** `modules/11-inspections.md` §10

1. **As SO:** `/so-inspections`. Point at **Compliance %** and **Overdue**.
2. Create inspection (Mess) → finding, **Major**, assigned to **QM**, due date.
3. **As QM:** it is in his list. *"Usko dhoondhna nahi pada."*
   Start → Submit.
4. **As SO:** "Verification Pending" = 1. Click **Rework** with **no
   reason** → **it refuses.** *Strong beat — let them see it._
5. Give a reason, send back, resubmit, **Close** with remarks.
6. Compliance % moves.

**Land:** *"Kami mili, kaam hua, officer ne check kiya, band hui. Ye chakkar
kaagaz par kabhi poora nahi hota."*

---

## 🖥️ Demo 15 — Reports

**Reference:** `modules/08-reports.md` §8

1. `/reports` → 20 report tiles + live summary bar.
2. **Master Trainee List → EXCEL.** File downloads with today's date.
3. **Open the file.** Show Hindi rendering correctly. *Do not say it — show it.*
4. **Fund Summary → PRINT.** Dialog opens on its own.

**Land:** *"Officer ne maanga, do minute me haath me."*

---

## 🖥️ Demo 16 — Today Special

**Reference:** `modules/13-audit-today.md` Part B

1. `/today` → read the **Hindi digest** aloud.
2. Tap **🚶 Kaun kaha gaya**.
3. **Log in as a trainee** → same feed.

**Land:** *"Company me afwah tab failti hai jab kisi ko pata nahi hota ki
hua kya hai. Yahan sab ek hi page dekh rahe hain."*

---

# PART D — TRUST & SAFETY

---

## Slide 17 — Who Can Do What

**ON SLIDE:**

> ## Har adhikar tay hai
>
> | Kaam | Kaun kar sakta hai |
> |---|---|
> | Chutti approve | **Sirf Company Commander** |
> | Finding verify karna | **Sirf SO ya Commander** |
> | User banana | **Sirf Commander** |
> | Paisa aur store | **Commander aur QM** |
> | Rangroot ka data | **Commander aur Clerk** |
>
> **Aur ye sirf button chhupane ki baat nahi hai.**

**SPEAKER NOTES:**
Deliver the three-layer point:
> "Leave approve karne ki roktham teen jagah lagi hai — screen par, code
> me, aur database me. Clerk agar seedha database ko request bhi bheje, to
> database mana kar dega. Screen chhupana security nahi hoti."

Then the rule from the inspection module:
> "Aur jo bandaa kaam karta hai wo khud apna kaam verified nahi kar sakta."

---

## Slide 18 — The Audit Register

**ON SLIDE:**

> ## 📝 Lekha-Jokha Register
>
> > *"045 Ramesh Kumar ki 'Bukhar' report approve ki
> > (S · 04-09 se 06-09, 3 din). Wajah: tez bukhar.
> > Absent register + MI register + notice board update hua."*
>
> **Ye entry kisi programmer ke liye nahi likhi gayi.**

**SPEAKER NOTES:**
> "Ye us officer ke liye likhi hai jo chhe mahine baad poochega — ye kya
> hua tha? Naam, tareekh, din, wajah, aur kaun se register badle. Ek line
> padho, poori kahani samajh aa jaati hai."

**Be honest if pressed:** coverage is strong for trainee reports, files and
leave — it is not yet universal. Say that. It costs nothing now and saves
the pilot.

---

## Slide 19 — 🖥️ The AI Assistant *(optional — demo LAST)*

**ON SLIDE:**

> ## AI Sahayak
> *Sirf Company Commander ke liye*
>
> Apni bhasha me poochho. Asli data se jawab.
>
> **Aur jo AI nahi kar sakta:**
> ❌ Chutti approve · ❌ User banana · ❌ Stock ledger badalna
> ❌ Apna hi record mitana
>
> **Bees cheezein jinhe AI chhoo hi nahi sakta.**

**SPEAKER NOTES:**
Ask two rehearsed read-only questions. Then ask it to approve leave — it
cannot.

> "AI ko sab kuch dena aasaan hai. Usko sahi tarah se rokna mushkil hai.
> Humne wo mushkil kaam kiya hai. AI madad karta hai — faisla Commander ka
> rehta hai."

⚠️ Skip this slide entirely if the network is unreliable. Nothing else in
the deck depends on it.

---

## Slide 20 — What It Does NOT Do

**ON SLIDE:**

> ## Jo abhi nahi hai
>
> - ❌ Mobile push notification
> - ❌ Bank se seedha connection
> - ❌ Biometric hazri
> - ❌ SMS / email alert
> - ❌ Direct PDF export *(print se bana sakte hain)*
>
> **Ye list hum khud de rahe hain.**

**SPEAKER NOTES:**
**Do not skip this slide.** It is the most persuasive one in the deck.

> "Har software wala aapko dikhata hai ki uska software kya kar sakta hai.
> Main aapko ye bhi bata raha hoon ki kya nahi kar sakta.
>
> Kyunki agar main aaj jhooth bolun, to teen mahine baad aap pakad lenge —
> aur tab poora bharosa chala jaayega. Jo hai, wo sach me hai. Jo nahi hai,
> wo abhi nahi hai."

Pull the full list from `99-DOCUMENTATION-AUDIT.md` if someone digs.

---

# PART E — CLOSE

---

## Slide 21 — Before and After

**ON SLIDE:**

> ## Pehle aur ab
>
> | | Pehle | Ab |
> |---|---|---|
> | Aaj kitne aadmi hain | 2 ghante | **1 screen** |
> | Documents pending list | Aadha din | **2 tap** |
> | Rangroot bimar hua | 5 register, 3 log | **1 click** |
> | Chutti approve + attendance | Alag-alag | **Apne aap** |
> | Duty clash | Agle din pata chalta | **Pehle hi rok** |
> | "Ye entry kisne ki?" | Jawab nahi | **Search box** |
> | Officer ne report maangi | Aadha din | **2 minute** |

**SPEAKER NOTES:**
Use *their* number from slide 2 in the first row. That makes the table
theirs, not yours.

---

## Slide 22 — Getting Started

**ON SLIDE:**

> ## Shuruaat kaise hogi
>
> 1. Company setup aur Commander ka account
> 2. Baaki accounts — Clerk, QM, Ustad, SO
> 3. Batch banana
> 4. Rangroot ka data
> 5. **Chalu**
>
> Ek subscription — **poori company ke liye.**
> Har user ka alag paisa **nahi.**

**SPEAKER NOTES:**
State the licensing model plainly and only once. If asked about the grace
period, mention it: 30 days of read-only access after expiry, because
nobody's work should stop over a late payment.

---

## Slide 23 — Common Questions

**ON SLIDE:**

> ## Aksar poochhe jaane wale sawaal
>
> **"Internet chahiye?"** — Haan, cloud par chalta hai
> **"Data kiska hai?"** — Aapka. Aapki company ka.
> **"Purana data aayega?"** — Naye batch se shuru karna behtar hai
> **"Training kitni lagegi?"** — Har role ko aadha ghanta
> **"Do batch ek saath?"** — Haan, data kabhi mix nahi hota
> **"Naya role bana sakte hain?"** — Wo development ka kaam hai

**SPEAKER NOTES:**
Full answers are in `01-PRESENTATION-ROADMAP.md`. Never invent an answer
here — *"main pata karke batata hoon"* is always a better response than a
confident guess that turns out wrong.

---

## Slide 24 — Close

**ON SLIDE:**

> # Ek baar likho.
> # Baaki system karega.
>
> **FCOY**
>
> *[Your name] · [Contact]*

**SPEAKER NOTES:**
Return to the sentence from slide 5. Then close with the two lines that tie
the whole demo together:

> "Aaj aapne jo dekha, usme beech me kisi ne kuch yaad nahi rakha. Ek aadmi
> ne apna kaam kiya, aur agle aadmi ke screen par kaam apne aap pahunch
> gaya.
>
> Aur har kadam par record hai — kisne kiya, kab kiya, kyun kiya."

Then stop talking. Let them ask.

---

## Presenter's Card — tear this off

**Before you start**
- [ ] Demo data checked (`01-PRESENTATION-ROADMAP.md`)
- [ ] All role logins tested **today**
- [ ] One pending leave, one pending trainee report, one open finding ready
- [ ] Network checked · AI question rehearsed · screenshots as backup
- [ ] `/ustad` — **do not open**, it is a placeholder
- [ ] Legacy relegation tab — **do not open**

**During**
- Pause after every automatic step
- Narrate the person, not the software
- One smart detail at a time
- Their number from slide 2 goes into slide 21

**Never say**
- "Har cheez ka record hai" → say "trainee reports, files aur leave ka"
- "PDF export" → say "print se PDF bana lijiye"
- "Phone par notification" → it does not exist
- "Per-user pricing" → company-level only
- Anything from a module's **Do NOT Promise** list

**If something breaks**
Do not apologise twice. *"Ye demo data ka issue hai, main aage badhta
hoon."* Move on. Never debug in front of the room.
