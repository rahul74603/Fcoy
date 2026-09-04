# Smart Details — The Small Things That Signal Care

> **What this file is:** the tiny decisions in FCOY that nobody asks for
> and everybody notices. Individually trivial. Together they are the
> difference between "someone built this for us" and "someone sold us
> software".
>
> **How to use it:** do not read this list to a buyer. Drop **one or two**
> of these into a demo at the right moment. A single well-timed detail is
> worth more than a feature list.

---

## 1. It Speaks The Language People Actually Use

| Where | What it says |
|---|---|
| `/funds` | **"Paisa gaya"** under Actually Paid · **"Cash in hand"** under Net Balance · **"Vendor ko dena"** under Vendor Dues |
| `/today` | The movement filter is called **"Kaun kaha gaya"** — not "Movement Register" |
| `/absent-management` | Bilingual labels: **Absent (बिना बताए)**, **Sick / MI Room (बीमार)**, **Leave (छुट्टी पर)** |
| `/leave-management` | **Samanya Chhutti**, **Chikitsa Chhutti**, **Aapatkalin**, **Arjit** |
| `/deputation` | Tabs read **Incoming (Liya)** and **Outgoing (Diya)** |
| `/audit-log` | Titled **📝 Lekha-Jokha Register** |
| Trainee portal | Every report kind has a Hindi hint — *"Barrack / paani / bijli / repair"* |

**The line:**
> "Screen par likha hai 'paisa gaya'. Kisi ne 'disbursement' nahi likha.
> Kyunki company me koi 'disbursement' nahi bolta."

---

## 2. Even The Error Messages Are In Hindi

Authorisation failures do not say "Error 403". They say what happened and
who is allowed:

> *"Authorization: sirf Company Commander hi leave approve kar sakte hain."*
> *"Authorization: verification/closure sirf Senior Officer / Commander kar sakta hai."*
> *"Aapko koi batch assigned nahi hai. Company Commander se assignedBatchIds me batch add karwayein."*

That last one **tells you exactly how to fix it**, and who to ask.

**The line:**
> "Galti hone par system Hindi me batata hai kya hua aur kisse baat karni
> hai. Error code nahi dikhata."

---

## 3. The Empty States Are Written, Not Blank

| Screen | When there is nothing |
|---|---|
| `/funds` fund detail | **"Koi collection nahi"** |
| `/audit-log` | **"Koi audit log nahi"** with a clean icon |
| `/today` | **"😴 Aaj koi badi activity record nahi hui"** |
| `/inventory` | **"No records for this batch."** |

**The line:**
> "Khaali screen dikhane ke bajaye system likh kar batata hai ki aaj kuch
> hua hi nahi. Ye chhoti baat hai, lekin isse bharosa banta hai — user ko
> lagta hai screen kharab nahi hui."

---

## 4. Somebody Thought About Indian Time

Two separate places in the code deliberately avoid the UTC midnight
date-shift, with comments explaining why:

- Leave auto-attendance uses a **local business date**, noting that
  `toISOString` could record *"yesterday"* in IST
- The duty availability checker sets its comparison to **midday** to avoid
  timezone edge cases

**The line (technical buyers only):**
> "Aadhi raat ke aas-paas ki entry galat tareekh par nahi jaati. Ye wo
> dikkat hai jo teen mahine baad pata chalti hai, aur inhone pehle hi
> soch li."

---

## 5. Hindi Actually Opens In Excel

Report CSVs are written with a UTF-8 byte-order mark, so Devanagari text
renders correctly in Excel instead of turning into garbage.

**Do not say this. Demo it.** Export a report with Hindi names and open the
file.

> "Excel me kholiye. Hindi bilkul saaf. Ye chhoti baat lagti hai — jab tak
> aapne ek baar kabaad wali file na dekhi ho."

---

## 6. Deactivate, Don't Delete — Everywhere

The same principle appears in at least four independent places:

| Thing | Behaviour |
|---|---|
| Users | Toggled inactive; history and audit entries survive |
| Leave types | Deactivated, so historic leaves keep their labels |
| Vendors | Active/inactive flag rather than removal |
| Staff | Six statuses including Inactive |

And when a user genuinely must be removed, the code **deactivates first**
so the account cannot authenticate during the operation.

**The line:**
> "Bandaa transfer ho gaya to account band karo, mitao mat. Uske naam se jo
> entries hain wo record me rehni chahiye."

---

## 7. The System Admits What It Does Not Do

FCOY writes its own limitations onto the screen:

- `/issue-kit` carries a blue banner: **"Manual Recovery Only — koi recovery
  auto-create nahi hogi"**, repeated at the point of action
- `/inventory` states: *"Header ke batch switcher se badlo — yahan do
  batches ka data kabhi mix nahi hota"*
- `/funds` prints its own balance formula on screen
- `permissions.ts` opens with a comment saying it is **NOT** the security
  boundary — the database rules are

**The line — this is a surprisingly powerful one:**
> "Software aksar apni kamiyan chhupata hai. Ye software screen par likh
> kar batata hai ki wo kya nahi karega. Isliye jab wo kehta hai ki kuch
> karega, to bharosa hota hai."

---

## 8. Work Comes To You, Not The Other Way Round

| Detail | Effect |
|---|---|
| Clerk's **Updates** tab shows a live pending-count badge | No hunting for new reports |
| `/vendor-payments` opens on the **Pending** filter | You land on the work |
| Notifications **deep-link** to the exact pending leave | One tap to the Approve button |
| Test results list **Failed first**, then Absent, then Passed | The problem is on top |
| `/so-inspections` surfaces an **Overdue** section at the top | The system chases, not the officer |
| Commander's dashboard opens with the **Attention Board** | Decisions first, data second |

**The line:**
> "Har screen sabse pehle wahi dikhata hai jahan kaam karna hai. Dhoondhna
> nahi padta."

---

## 9. Small Interaction Polish

- **ESC closes** the fund detail modal
- Commander dashboard drill-downs are **modals** — the filter you set is
  still there when you close them
- Sections on the Commander dashboard are **collapsible**, so each officer
  keeps his own view
- The notification badge caps at **99+**
- The bell icon turns **red** only when something is unread
- Notifications refresh **every 2 minutes**, plus a manual refresh
- Bill images are **compressed automatically** before upload
- A **"Mark All Present"** shortcut for the most common attendance case
- The Inventory Hub's every tab has an **"Open management screen"** button
- Fund cards, severity levels and notification types each carry
  **consistent colour coding** across the app

---

## 10. Honesty Built Into The Data Model

Small modelling choices that show real-world experience:

| Choice | Why it matters |
|---|---|
| **"No Bill"** is a valid bill status | Sometimes there genuinely is no bill. The system records the truth instead of forcing a lie. |
| **"Observation"** is a severity level | Not every inspection remark is a fault. |
| **General reports create no absence record** | A mess complaint should not mark anybody absent — the code branches explicitly. |
| **Trainee Senior reports record `onBehalf` and the submitter's ID** | Helping someone never hides who acted. |
| **Return recording asks for joining report and delay reason** | The questions a real register asks. |
| **Chest numbers are never overwritten** — the holder is reported instead | Duplicate protection over convenience. |
| **AI re-reads after writing** and reports "X created, Y failed" | No false success. |

**The line:**
> "'Bill nahi tha' bhi ek option hai. System aapse jhooth nahi bulwata."

---

## 11. Consistency As A Feature

The same vocabulary appears on every finance screen: *Grand Collection ·
Actually Paid · Net Balance · Vendor Dues · Pending Bills*. The same status
colours mean the same thing everywhere. The same batch isolation rule
applies across inventory, finance and inspections.

**The line:**
> "Poore system me ek hi bhasha hai. 'Paisa gaya' ka matlab har screen par
> ek hi hai. Naye QM ko sikhane me aadha ghanta lagta hai."

---

## How To Deploy A Detail In A Demo

**Three rules:**

1. **One at a time.** A list of small things sounds like padding. One small
   thing at the right moment sounds like craftsmanship.
2. **Let them find it.** The best version is when the buyer notices and you
   simply confirm: *"Haan, wo jaan-boojh kar aisa hai."*
3. **Pick the detail that matches the person.** A clerk will care about the
   pending badge. A QM will care about "paisa gaya". An officer will care
   about the Hindi audit sentence. A technical evaluator will care about the
   IST date handling.

### The three highest-yield details

| Rank | Detail | Audience |
|---|---|---|
| 1 | **Hindi exports to Excel correctly** — demo it | Everyone |
| 2 | **"Paisa gaya" / "Cash in hand"** labels | QM, Commander |
| 3 | **The screen admits what it won't do** (§7) | Sceptics |
