// src/utils/actionHandler.ts
// Ye file AI ke JSON action ko actual Firebase operations mein convert karti hai

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { db } from "../../../config/firebase";
import type { AIResponse } from "../api/aiAgent.api";

export interface ActionResult {
  success: boolean;
  message: string;
  details?: string;
}

// ─────────────────────────────────────────
// HELPER: Active batch dhundo
// ─────────────────────────────────────────
async function getActiveBatch() {
  const activeQuery = query(
    collection(db, "batches"),
    where("status", "==", "active"),
    limit(1)
  );
  const activeSnap = await getDocs(activeQuery);

  if (!activeSnap.empty) {
    const d = activeSnap.docs[0];
    return { id: d.id, ...d.data() } as any;
  }

  const anyQuery = query(collection(db, "batches"), limit(1));
  const anySnap = await getDocs(anyQuery);

  if (anySnap.empty) {
    throw new Error("Koi batch nahi mili. Pehle batch banao.");
  }

  const d = anySnap.docs[0];
  return { id: d.id, ...d.data() } as any;
}

// ─────────────────────────────────────────
// HELPER: Next chest number
// ─────────────────────────────────────────
async function getNextChestNo(batchId: string): Promise<string> {
  const snap = await getDocs(
    query(collection(db, "trainees"), where("batchId", "==", batchId))
  );
  const usedNumbers = snap.docs
    .map((d) => parseInt(d.data().chestNo))
    .filter((n) => !isNaN(n));

  if (usedNumbers.length === 0) return "1";
  return String(Math.max(...usedNumbers) + 1);
}

// ─────────────────────────────────────────
// HELPER: Chest number se trainee dhundo
// ─────────────────────────────────────────
async function findTraineeByChest(chestNo: string) {
  const snap = await getDocs(
    query(
      collection(db, "trainees"),
      where("chestNo", "==", String(chestNo)),
      limit(1)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as any;
}

// ─────────────────────────────────────────
// ✅ NEW HELPER: FPT Records fetch karo
// ─────────────────────────────────────────
async function fetchFPTList(
  batchId: string,
  filters: { status?: string; subject?: string }
): Promise<ActionResult> {
  try {
    // ── Step 1: Saare FPT records is batch ke ──
    const fptQuery = query(
      collection(db, "fptRecords"),        // ← apna collection name yahan
      where("batchId", "==", batchId)
    );
    const fptSnap = await getDocs(fptQuery);

    if (fptSnap.empty) {
      return {
        success: true,
        message: "📭 Koi FPT record nahi mila",
        details: "Pehle FPT Tracker mein records add karo",
      };
    }

    // ── Step 2: Saare records collect karo ──
    let records = fptSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as any[];

    console.log("📊 Total FPT records:", records.length);
    console.log("🔍 Filter:", filters);
    console.log("📄 Sample record:", records[0]);
    // ↑ Console mein dekho — field names kya hain

    // ── Step 3: Status filter lagao ──
    if (filters.status === "fail") {
      records = records.filter((r) => {
        const overall = String(r.overallStatus || "").toLowerCase();
        const stat = String(r.status || "").toLowerCase();
        const res = String(r.result || "").toLowerCase();
        return (
          overall === "fail" || stat === "fail" || res === "fail" || r.passed === false || r.isFail === true
        );
      });
    } else if (filters.status === "pass") {
      records = records.filter((r) => {
        const overall = String(r.overallStatus || "").toLowerCase();
        const stat = String(r.status || "").toLowerCase();
        const res = String(r.result || "").toLowerCase();
        return (
          overall === "pass" || stat === "pass" || res === "pass" || r.passed === true || r.isFail === false
        );
      });
    }
    // ── Step 4: Subject filter (optional) ──
    if (filters.subject) {
      const subj = filters.subject.toLowerCase();
      records = records.filter((r) => {
        // Agar subjects object hai
        if (r.subjects && r.subjects[subj]) {
          const s = r.subjects[subj];
          return (
            s.status === "fail" ||
            s.status === "FAIL" ||
            s.passed === false
          );
        }
        // Agar failedIn array hai
        if (Array.isArray(r.failedIn)) {
          return r.failedIn.some((f: string) =>
            f.toLowerCase().includes(subj)
          );
        }
        return false;
      });
    }

    // ── Step 5: Result banao ──
    if (records.length === 0) {
      const statusText = filters.status === "fail" ? "fail" : "pass";
      const subjectText = filters.subject ? ` (${filters.subject})` : "";
      return {
        success: true,
        message: `✅ Koi FPT ${statusText}${subjectText} nahi mila!`,
        details:
          filters.status === "fail"
            ? "Sab trainees pass hain 🎉"
            : "Koi pass nahi hua abhi",
      };
    }

    // ── Step 6: Sort by chest number ──
    records.sort((a, b) => parseInt(a.chestNo) - parseInt(b.chestNo));

    // ── Step 7: Format list ──
    const statusEmoji  = filters.status === "fail" ? "❌" : filters.status === "pass" ? "✅" : "📋";
    const statusLabel  = filters.status ? filters.status.toUpperCase() : "ALL";
    const subjectLabel = filters.subject ? ` → ${filters.subject}` : "";

    const list = records.map((r, i) => {
      const name      = r.name      || r.traineeName || `Chest #${r.chestNo}`;
      const chest     = r.chestNo   || "?";

      // Failed subjects dikhao (agar available ho)
      let extra = "";
      if (filters.status === "fail") {
        const failedSubjects =
          r.failedSubjects ||
          r.failedIn       ||
          r.failedEvents   ||
          [];
        if (Array.isArray(failedSubjects) && failedSubjects.length > 0) {
          extra = ` [${failedSubjects.join(", ")}]`;
        }
      } else {
        // Pass case mein score dikhao
        const score =
          r.totalScore  ||
          r.totalMarks  ||
          r.score       ||
          null;
        if (score !== null) extra = ` [Score: ${score}]`;
      }

      return `${statusEmoji} #${i + 1} | Chest ${chest} - ${name}${extra}`;
    });

    return {
      success: true,
      message: `${statusEmoji} FPT ${statusLabel}${subjectLabel} - ${records.length} Trainees`,
      details: list.join("\n"),
    };
  } catch (err: any) {
    console.error("❌ FPT fetch error:", err);
    return {
      success: false,
      message: "❌ FPT records fetch nahi ho sake",
      details: err.message,
    };
  }
}

// ─────────────────────────────────────────
// ✅ NEW HELPER: Absent Records fetch karo
// ─────────────────────────────────────────
async function fetchAbsentList(
  batchId: string,
  filters: { date?: string; leaveType?: string }
): Promise<ActionResult> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const targetDate =
      !filters.date || filters.date === "TODAY" ? today : filters.date;

    // ── App schema: AbsentManagement absentRecords collection use karta hai ──
    const absentQuery = query(
      collection(db, "absentRecords"),
      where("batchId", "==", batchId),
      where("status", "==", "Active"),
      where("type", "==", "A")
    );
    const snap = await getDocs(absentQuery);

    let records = snap.docs
      .map((d) => ({ id: d.id, ...d.data() })) as any[];

    records = records.filter((r) => {
      const from = r.fromDate || targetDate;
      const to = r.toDate || from;
      return from <= targetDate && targetDate <= to;
    });

    if (records.length === 0) {
      return {
        success: true,
        message: `✅ ${targetDate} ko koi absent nahi`,
        details: "Sab present hain!",
      };
    }

    records.sort((a, b) => parseInt(a.chestNo) - parseInt(b.chestNo));

    const list = records.map((r, i) => {
      const name  = r.name || r.traineeName || `Chest #${r.chestNo}`;
      const chest = r.chestNo || "?";
      const rsn   = r.reason  || r.leaveType || "—";
      return `🔴 #${i + 1} | Chest ${chest} - ${name} (${rsn})`;
    });

    return {
      success: true,
      message: `🔴 Absent List - ${targetDate} - ${records.length} Trainees`,
      details: list.join("\n"),
    };
  } catch (err: any) {
    return {
      success: false,
      message: "❌ Absent records fetch nahi ho sake",
      details: err.message,
    };
  }
}

// ─────────────────────────────────────────
// ✅ NEW HELPER: Leave Records fetch karo
// ─────────────────────────────────────────
async function fetchLeaveList(
  batchId: string,
  filters: { leaveType?: string; date?: string }
): Promise<ActionResult> {
  try {
    const conditions: any[] = [
      where("batchId", "==", batchId),
      where("status", "==", "Active"),
      where("type", "==", "L"),
    ];

    const leaveQuery = query(collection(db, "absentRecords"), ...conditions);
    const snap = await getDocs(leaveQuery);

    let records = snap.docs
      .map((d) => ({ id: d.id, ...d.data() })) as any[];

    if (filters.leaveType) {
      const leaveType = filters.leaveType.toLowerCase();
      records = records.filter((r) =>
        String(r.leaveType || r.reason || "").toLowerCase().includes(leaveType)
      );
    }

    if (records.length === 0) {
      return {
        success: true,
        message: `📭 Koi ${filters.leaveType || ""} leave record nahi mila`,
      };
    }

    records.sort((a, b) => parseInt(a.chestNo) - parseInt(b.chestNo));

    const typeEmoji: Record<string, string> = {
      medical:   "🏥",
      casual:    "📅",
      emergency: "🚨",
      general:   "📋",
    };

    const list = records.map((r, i) => {
      const name  = r.traineeName || r.name || `Chest #${r.chestNo}`;
      const chest = r.chestNo     || "?";
      const type  = r.leaveType   || "general";
      const emoji = typeEmoji[type] || "📋";
      const from  = r.startDate   || r.fromDate || "—";
      const to    = r.endDate     || r.toDate   || "—";
      return `${emoji} #${i + 1} | Chest ${chest} - ${name} | ${type} | ${from}→${to}`;
    });

    const typeLabel = filters.leaveType
      ? filters.leaveType.toUpperCase()
      : "ALL";

    return {
      success: true,
      message: `📅 ${typeLabel} Leave List - ${records.length} Records`,
      details: list.join("\n"),
    };
  } catch (err: any) {
    return {
      success: false,
      message: "❌ Leave records fetch nahi ho sake",
      details: err.message,
    };
  }
}

// ─────────────────────────────────────────
// ✅ NEW HELPER: Weekly Test Records
// ─────────────────────────────────────────
async function fetchWeeklyTestList(
  batchId: string,
  filters: { status?: string; date?: string }
): Promise<ActionResult> {
  try {
    const conditions: any[] = [where("batchId", "==", batchId)];

    const weeklyQuery = query(
      collection(db, "weeklyTestRecords"),     // ← apna collection name
      ...conditions
    );
    const snap = await getDocs(weeklyQuery);

    if (snap.empty) {
      return {
        success: true,
        message: "📭 Koi weekly test record nahi mila",
      };
    }

    let records = snap.docs
      .map((d) => ({ id: d.id, ...d.data() })) as any[];

    // Status filter
    if (filters.status === "fail") {
      records = records.filter((r) => {
        const stat = String(r.status || "").toLowerCase();
        const res = String(r.result || "").toLowerCase();
        return stat === "fail" || res === "fail" || r.passed === false;
      });
    } else if (filters.status === "pass") {
      records = records.filter((r) => {
        const stat = String(r.status || "").toLowerCase();
        const res = String(r.result || "").toLowerCase();
        return stat === "pass" || res === "pass" || r.passed === true;
      });
    }

    
    // Date filter
    if (filters.date && filters.date !== "TODAY") {
      records = records.filter((r) => r.date === filters.date);
    }

    if (records.length === 0) {
      return {
        success: true,
        message: `📭 Koi ${filters.status || ""} weekly test record nahi mila`,
      };
    }

    records.sort((a, b) => parseInt(a.chestNo) - parseInt(b.chestNo));

    const statusEmoji = filters.status === "fail" ? "❌" : filters.status === "pass" ? "✅" : "📝";
    const list = records.map((r, i) => {
      const name  = r.name || r.traineeName || `Chest #${r.chestNo}`;
      const chest = r.chestNo || "?";
      const marks = r.marks || r.score || r.totalMarks || "—";
      return `${statusEmoji} #${i + 1} | Chest ${chest} - ${name} | Marks: ${marks}`;
    });

    return {
      success: true,
      message: `${statusEmoji} Weekly Test ${(filters.status || "ALL").toUpperCase()} - ${records.length} Trainees`,
      details: list.join("\n"),
    };
  } catch (err: any) {
    return {
      success: false,
      message: "❌ Weekly test records fetch nahi ho sake",
      details: err.message,
    };
  }
}

const getAttnCode = (value?: string): 'P' | 'A' | 'S' | 'H' | 'L' | 'R' | 'M' => {
  const v = String(value || 'P').toLowerCase();
  if (v === 'a' || v.includes('absent')) return 'A';
  if (v === 's' || v.includes('sick')) return 'S';
  if (v === 'h' || v.includes('hospital')) return 'H';
  if (v === 'l' || v.includes('leave') || v.includes('away')) return 'L';
  if (v === 'r' || v.includes('rest')) return 'R';
  if (v === 'm' || v.includes('medical')) return 'M';
  return 'P';
};

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const calcPaid = (docs: any[]) => docs.reduce((s, e) => {
  if (e.vendorId || e.linkedVendorId) return s + Number(e.paidAmount ?? 0);
  return s + Number(e.amount ?? 0);
}, 0);

async function fetchAttendanceSummary(batchId: string, status?: string): Promise<ActionResult> {
  const [tSnap, mSnap] = await Promise.all([
    getDocs(query(collection(db, 'trainees'), where('batchId', '==', batchId))),
    getDocs(query(collection(db, 'medicalRecords'), where('batchId', '==', batchId))),
  ]);
  const activeMed: Record<string, any> = {};
  mSnap.docs.forEach(d => {
    const data = d.data();
    if (data.status === 'Active' && !activeMed[data.traineeId]) activeMed[data.traineeId] = data;
  });
  const rows = tSnap.docs.map(d => {
    const t = { id: d.id, ...d.data() } as any;
    let code = getAttnCode(t.attn);
    if (activeMed[t.id]) {
      const cat = activeMed[t.id].category;
      code = cat === 'Hospital Admit' ? 'H' : cat === 'B-Rest' || cat === 'C-Rest' ? 'R' : cat === 'Medical Board' ? 'M' : 'S';
    }
    return { ...t, code, medical: activeMed[t.id] };
  });
  const counts = {
    total: rows.length,
    present: rows.filter(r => r.code === 'P').length,
    absent: rows.filter(r => r.code === 'A').length,
    sick: rows.filter(r => r.code === 'S').length,
    hospital: rows.filter(r => r.code === 'H').length,
    leave: rows.filter(r => r.code === 'L').length,
    rest: rows.filter(r => r.code === 'R').length,
    medical: rows.filter(r => r.code === 'M').length,
  };
  const filtered = status === 'not_present'
    ? rows.filter(r => r.code !== 'P')
    : status ? rows.filter(r => r.code === status) : rows;
  const list = filtered
    .sort((a, b) => Number(a.chestNo) - Number(b.chestNo))
    .slice(0, 80)
    .map((t, i) => `${i + 1}. Chest ${t.chestNo} - ${t.name} | ${t.code}${t.medical ? ` | ${t.medical.category}: ${t.medical.diagnosis || '-'}` : ''}`)
    .join('\n');
  return {
    success: true,
    message: `📊 Attendance: Total ${counts.total} | Present ${counts.present} | Away ${counts.total - counts.present}`,
    details: `Absent ${counts.absent} · Sick ${counts.sick} · Hospital ${counts.hospital} · Leave ${counts.leave} · Rest ${counts.rest} · Medical ${counts.medical}\n\n${list || 'No matching trainees'}`,
  };
}

async function fetchFinanceSummary(fundKey?: string): Promise<ActionResult> {
  const configs = [
    ['mess_fund', 'Mess Fund', 'mess_fund_collections', 'mess_fund_expenses'],
    ['training_fund', 'Training Fund', 'training_fund_collections', 'training_fund_expenses'],
    ['company_assets_fund', 'Company Assets', 'company_assets_collections', 'company_assets_expenses'],
    ['general_fund', 'General Fund', 'general_fund_collections', 'general_fund_expenses'],
  ];
  const lines: string[] = [];
  for (const [key, label, colName, expName] of configs) {
    if (fundKey && key !== fundKey) continue;
    const [cSnap, eSnap] = await Promise.all([getDocs(collection(db, colName)), getDocs(collection(db, expName))]);
    const collectionTotal = cSnap.docs.reduce((s, d) => s + Number(d.data().amount ?? 0), 0);
    const expenses = eSnap.docs.map(d => d.data());
    const paid = calcPaid(expenses);
    const orders = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);
    const due = expenses.reduce((s, e) => s + Number(e.dueAmount ?? 0), 0);
    lines.push(`${label}: Collection ${money(collectionTotal)} | Orders ${money(orders)} | Paid ${money(paid)} | Due ${money(due)} | Balance ${money(collectionTotal - paid)}`);
  }
  return { success: true, message: '💰 Fund Summary', details: lines.join('\n') };
}

async function fetchVendorDueSummary(): Promise<ActionResult> {
  const snap = await getDocs(collection(db, 'vendor_entries'));
  const map: Record<string, any> = {};
  snap.docs.forEach(d => {
    const e = d.data();
    const due = Number(e.dueAmount ?? 0);
    if (due <= 0) return;
    const id = e.vendorId || e.vendorName || d.id;
    if (!map[id]) map[id] = { name: e.vendorName || 'Vendor', due: 0, entries: 0, fund: e.fundKey || '-' };
    map[id].due += due;
    map[id].entries += 1;
  });
  const list = Object.values(map).sort((a: any, b: any) => b.due - a.due);
  return {
    success: true,
    message: `🏪 Vendor Dues: ${list.length} vendors pending`,
    details: list.length ? list.map((v: any, i) => `${i + 1}. ${v.name} | Due ${money(v.due)} | ${v.entries} entries | ${v.fund}`).join('\n') : 'All vendor payments clear ✅',
  };
}

// ═══════════════════════════════════════════════════════════
// MAIN FUNCTION: AI action execute karo
// ═══════════════════════════════════════════════════════════
export async function executeAction(
  aiResponse: AIResponse,
  userEmail: string
): Promise<ActionResult> {
  try {

    // ══════════════════════════════
    // ACTION 1: Trainee Add
    // ══════════════════════════════
    if (aiResponse.action === "add_trainee") {
      if (!aiResponse.names || aiResponse.names.length === 0) {
        return {
          success: false,
          message: "❌ Koi naam nahi diya",
          details: 'Example: "Rahul aur Ravi ko trainee add karo"',
        };
      }

      const batch = await getActiveBatch();
      const addedList: string[] = [];

      for (const name of aiResponse.names) {
        const chestNo = await getNextChestNo(batch.id);
        await addDoc(collection(db, "trainees"), {
          name:        name.trim(),
          chestNo:     chestNo,
          batchId:     batch.id,
          batchName:   batch.batchName   || "",
          batchNumber: batch.batchNumber || "",
          status:      "active",
          attn:        "P",
          source:      "ai-agent",
          addedBy:     userEmail,
          createdAt:   serverTimestamp(),
        });
        addedList.push(`👤 ${name.trim()} → Chest #${chestNo}`);
      }

      return {
        success: true,
        message: `✅ ${addedList.length} Trainee(s) add ho gaye - ${batch.batchName}`,
        details: addedList.join("\n"),
      };
    }

    // ══════════════════════════════
    // ACTION 2: Trainee Update
    // ══════════════════════════════
    if (aiResponse.action === "update_trainee") {
      if (!aiResponse.chestNo) {
        return {
          success: false,
          message: "❌ Chest number nahi diya",
          details: 'Example: "Chest 5 ki age 25 karo"',
        };
      }

      const trainee = await findTraineeByChest(aiResponse.chestNo);
      if (!trainee) {
        return {
          success: false,
          message: `❌ Chest #${aiResponse.chestNo} nahi mila`,
        };
      }

      await updateDoc(doc(db, "trainees", trainee.id), {
        ...aiResponse.updates,
        updatedAt: serverTimestamp(),
        updatedBy: userEmail,
      });

      const updatesList = Object.entries(aiResponse.updates || {})
        .map(([key, val]) => `${key}: ${val}`)
        .join("\n");

      return {
        success: true,
        message: `✅ ${trainee.name} (Chest #${aiResponse.chestNo}) update ho gaya`,
        details: updatesList,
      };
    }

    // ══════════════════════════════
    // ACTION 3: Leave
    // ══════════════════════════════
    if (aiResponse.action === "apply_leave") {
      if (!aiResponse.chestNo) {
        return {
          success: false,
          message: "❌ Chest number nahi diya",
        };
      }
      if (!aiResponse.reason) {
        return {
          success: false,
          message: "❌ Leave ki reason nahi di",
        };
      }

      const batch = await getActiveBatch();
      const trainee = await findTraineeByChest(aiResponse.chestNo);
      const traineeName = trainee?.name || `Chest #${aiResponse.chestNo}`;
      const traineeId   = trainee?.id   || "";
      const today       = new Date().toISOString().split("T")[0];

      await addDoc(collection(db, "absentRecords"), {
        batchId:     batch.id,
        traineeId:   traineeId,
        traineeName: traineeName,
        chestNo:     String(aiResponse.chestNo),
        regNo:       trainee?.regNo || "",
        platoon:     trainee?.platoon || "",
        type:        "L",
        reason:      aiResponse.reason,
        leaveType:   aiResponse.leaveType || "general",
        fromDate:    today,
        toDate:      today,
        totalDays:   1,
        status:      "Active",
        remarks:     `AI Agent by ${userEmail}`,
        createdAt:   new Date().toISOString(),
        addedBy:     userEmail,
      });

      if (traineeId) {
        await updateDoc(doc(db, "trainees", traineeId), { attn: "L" });
      }

      return {
        success: true,
        message: `✅ Leave apply ho gayi`,
        details:
          `👤 Name: ${traineeName}\n` +
          `🏷 Chest: ${aiResponse.chestNo}\n` +
          `📝 Reason: ${aiResponse.reason}\n` +
          `📋 Type: ${aiResponse.leaveType || "general"}\n` +
          `📅 Date: ${today}`,
      };
    }

    // ══════════════════════════════
    // ACTION: Exact ERP summaries (deterministic, no AI guessing)
    // ══════════════════════════════
    if (aiResponse.action === 'get_summary') {
      const batch = await getActiveBatch();
      const listType = aiResponse.listType || 'attendance';
      const filters = aiResponse.filters || {};
      if (listType === 'attendance') return await fetchAttendanceSummary(batch.id, filters.status);
      if (listType === 'finance') return await fetchFinanceSummary(filters.category);
      if (listType === 'vendor_due') return await fetchVendorDueSummary();
      return { success: false, message: '❌ Summary type samajh nahi aaya', details: String(listType) };
    }

    // ══════════════════════════════════════════════════════
    // ✅ ACTION 4: GET LIST — Ab listType ke saath kaam karta hai
    // ══════════════════════════════════════════════════════
    if (aiResponse.action === "get_list") {
      const batch   = await getActiveBatch();
      const listType = aiResponse.listType || "trainees";
      const filters  = aiResponse.filters  || {};

      console.log(`📋 get_list → listType: "${listType}", filters:`, filters);

      // ── FPT List ──
      if (listType === "fpt") {
        return await fetchFPTList(batch.id, {
          status:  filters.status,
          subject: filters.subject,
        });
      }

      // ── Absent List ──
      if (listType === "absent") {
        return await fetchAbsentList(batch.id, {
          date: filters.date,
        });
      }

      // ── Leave List ──
      if (listType === "leave" || listType === "medical") {
        return await fetchLeaveList(batch.id, {
          leaveType: listType === "medical" ? "medical" : filters.leaveType,
          date:      filters.date,
        });
      }

      // ── Weekly Test List ──
      if (listType === "weekly") {
        return await fetchWeeklyTestList(batch.id, {
          status: filters.status,
          date:   filters.date,
        });
      }

      // ── Default: Trainees List ──
      // listType === "trainees" OR kuch aur
      const snap = await getDocs(
        query(
          collection(db, "trainees"),
          where("batchId", "==", batch.id)
        )
      );

      if (snap.empty) {
        return {
          success: true,
          message: `📋 ${batch.batchName} mein koi trainee nahi`,
          details: "Pehle trainees add karo",
        };
      }

      const sorted = snap.docs
        .map((d) => d.data())
        .sort((a, b) => parseInt(a.chestNo) - parseInt(b.chestNo));

      const list = sorted
        .map((t, i) => `#${i + 1} | Chest ${t.chestNo} - ${t.name}`)
        .join("\n");

      return {
        success: true,
        message: `📋 ${batch.batchName} - Total ${snap.size} Trainees`,
        details: list,
      };
    }

    // ══════════════════════════════
    // ACTION 5: Add Document
    // ══════════════════════════════
    if (aiResponse.action === "add_document") {
      if (!aiResponse.collectionName || !aiResponse.data) {
        return {
          success: false,
          message: "❌ Collection name ya data nahi diya",
        };
      }

      await addDoc(collection(db, aiResponse.collectionName), {
        ...aiResponse.data,
        addedBy:   userEmail,
        createdAt: serverTimestamp(),
      });

      return {
        success: true,
        message: `✅ ${aiResponse.collectionName} mein add ho gaya`,
        details: JSON.stringify(aiResponse.data, null, 2),
      };
    }

    // ══════════════════════════════
    // ACTION 6: Search
    // ══════════════════════════════
    if (aiResponse.action === "search") {
      if (aiResponse.chestNo) {
        const trainee = await findTraineeByChest(aiResponse.chestNo);
        if (!trainee) {
          return {
            success: false,
            message: `❌ Chest #${aiResponse.chestNo} nahi mila`,
          };
        }

        const details = Object.entries(trainee)
          .filter(([key]) => !["id", "createdAt", "updatedAt"].includes(key))
          .map(([key, val]) => `${key}: ${val || "-"}`)
          .join("\n");

        return {
          success: true,
          message: `👤 ${trainee.name} (Chest #${trainee.chestNo}) ki details:`,
          details,
        };
      }

      if (aiResponse.names && aiResponse.names.length > 0) {
        const name = aiResponse.names[0];
        const snap = await getDocs(
          query(
            collection(db, "trainees"),
            where("name", ">=", name),
            where("name", "<=", name + "\uf8ff"),
            limit(5)
          )
        );

        if (snap.empty) {
          return {
            success: false,
            message: `❌ "${name}" naam ka koi trainee nahi mila`,
          };
        }

        const found = snap.docs
          .map((d) => d.data())
          .map((t) => `Chest #${t.chestNo} - ${t.name}`)
          .join("\n");

        return {
          success: true,
          message: `🔍 Found ${snap.size} trainee(s):`,
          details: found,
        };
      }

      return {
        success: false,
        message: "❌ Search ke liye chest number ya naam do",
      };
    }

    // ══════════════════════════════
    // ACTION 7: Multi
    // ══════════════════════════════
    if (aiResponse.action === "multi") {
      if (!aiResponse.multiple || !Array.isArray(aiResponse.multiple)) {
        return {
          success: false,
          message: "❌ Multiple actions nahi diye",
        };
      }

      const results: string[] = [];
      let successCount = 0;
      let failCount = 0;

      for (const subAction of aiResponse.multiple) {
        try {
          const subResult = await executeAction(subAction, userEmail);
          if (subResult.success) {
            successCount++;
            results.push(`✅ ${subResult.message}`);
          } else {
            failCount++;
            results.push(`❌ ${subResult.message}`);
          }
        } catch (err: any) {
          failCount++;
          results.push(`❌ Error: ${err.message}`);
        }
      }

      return {
        success: successCount > 0,
        message: `🎯 ${successCount} successful, ${failCount} failed`,
        details: results.join("\n"),
      };
    }
// ══════════════════════════════
    // ACTION 8: Direct Answer (Blueprint se)
    // ══════════════════════════════
    if (aiResponse.action === "direct_answer") {
      return {
        success: true,
        message: `🤖 AI Assistant`,
        details: aiResponse.reply || "Data mil gaya par format nahi ho paya.",
      };
    }

    // ══════════════════════════════
    // UNKNOWN
    // ══════════════════════════════
    return {
      success: false,
      message: `🤔 ${aiResponse.reply || "Samajh nahi aaya"}`,
      details:
        "Kuch aisa likhein:\n" +
        '• "fpt fail list dikhao"\n' +
        '• "aaj ke absent dikhao"\n' +
        '• "medical leave list"\n' +
        '• "Rahul ko add karo"\n' +
        '• "Chest 5 ki age 25 karo"',
    };

  } catch (error: any) {
    return {
      success: false,
      message: "❌ Kuch gadbad ho gayi",
      details: error.message,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// 📸 Weekly Program Image se Save karo
// ═══════════════════════════════════════════════════════════
const DAYS_OF_WEEK = [
  "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

const makeUniqueId = () =>
  Date.now().toString() + "_" + Math.random().toString(36).substr(2, 5);

export async function saveWeeklyProgramFromAI(
  extractedData: any,
  userEmail: string
): Promise<ActionResult> {
  try {
    const batch = await getActiveBatch();

    const fullSchedule = DAYS_OF_WEEK.map((day) => {
      const found = extractedData.schedule?.find(
        (s: any) => s.day?.toLowerCase() === day.toLowerCase()
      );

      if (!found) return { day, sessions: [] };

      const sessions = (found.sessions || []).map((s: any) => ({
        id: makeUniqueId(),
        time: s.time || "",
        subject: s.subject || "Other (Manual)",
        customSubject: s.customSubject || "",
        platoon: s.platoon || "All Platoons",
        location: s.location || "",
        assignedPersons: (s.assignedPersons || []).map((p: any) => ({
          id: makeUniqueId(),
          rank: p.rank || "",
          name: p.name || "",
        })),
        lectureDetails: s.lectureDetails || {
          topic: "", description: "",
          duration: "", materials: "",
        },
      }));

      return { day, sessions };
    });

    await addDoc(collection(db, "weeklyPrograms"), {
      weekName:  extractedData.weekName || "Untitled Week (AI Generated)",
      fromDate:  extractedData.fromDate || "",
      toDate:    extractedData.toDate   || "",
      remarks:   extractedData.remarks  || "Image se AI ne extract kiya",
      schedule:  fullSchedule,
      batchId:   batch.id,
      batchNumber: batch.batchNumber || "",
      createdAt: new Date().toISOString(),
      createdBy: `AI Agent (${userEmail})`,
    });

    const totalSessions = fullSchedule.reduce(
      (sum, day) => sum + day.sessions.length, 0
    );

    return {
      success: true,
      message: `✅ Weekly Program save ho gaya!`,
      details:
        `📋 Name: ${extractedData.weekName || "Untitled"}\n` +
        `📅 From: ${extractedData.fromDate || "—"}\n` +
        `📅 To: ${extractedData.toDate   || "—"}\n` +
        `📚 Days: ${fullSchedule.filter((d) => d.sessions.length > 0).length}\n` +
        `🎯 Sessions: ${totalSessions}\n` +
        `🏷 Batch: ${batch.batchName || batch.batchNumber}\n\n` +
        `Ab Weekly Program Screen pe ja kar check karo!`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: "❌ Weekly Program save nahi hua",
      details: error.message,
    };
  }
}