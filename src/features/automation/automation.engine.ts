// ============================================
// AUTOMATION ENGINE (Module 20 Audit ★ NEW)
// ============================================
// Rule-based smart automation — external AI ki zaroorat nahi.
// Har rule ERP data scan karke zaroorat padi par notification
// emit karta hai (M17 notification.api reuse).
//
// DEDUPE: Ek rule ek din mein max 1 baar notify karta hai —
//   `notifications` mein metadata.ruleId + today check.
// RUN LOG: Har rule ka result `automation_runs` mein save hota
//   hai (audit trail — kab kya chala, kya mila).
//
// Manual trigger: Automation Center se "Run Full Scan".
// Auto/scheduled trigger: Cloud Function — Phase 3 (roadmap).
// ============================================

import {
  collection, addDoc, getDocs, query, where,
  orderBy, limit, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { sendNotification } from '../notifications/notification.api';
import type { NotificationType } from '../notifications/notification.types';
import { buildStockReport } from '../aiAgent/engine/stockEngine';

const RUNS_COL = 'automation_runs';

// ─── TYPES ───────────────────────────────────
export interface RuleResult {
  ruleId: string;
  fired: boolean;        // condition mila?
  count: number;         // kitne items/cases mile
  message: string;       // result summary
  notified: boolean;     // notification bheja? (dedupe na ho to)
  ms: number;            // kitna time laga
}

interface AutomationRule {
  id: string;
  label: string;
  icon: string;
  description: string;
  targetRole: 'Company Commander' | 'Quarter Master' | 'Clerk';
  notifyType: NotificationType;
  priority: 'high' | 'medium' | 'low';
  link: string;
  check: () => Promise<{ fired: boolean; count: number; message: string }>;
}

// ─── DEDUPE: aaj ye rule pehle notify kar chuka? ─
const notifiedToday = async (ruleId: string): Promise<boolean> => {
  try {
    // metadata.ruleId filter query ke bina composite index ke — recent
    // notifications laa kar client-side check (volume chhota)
    const snap = await getDocs(
      query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(40))
    );
    const todayStr = new Date().toISOString().split('T')[0];
    return snap.docs.some(d => {
      const data = d.data();
      const ruleTag = (data.metadata as Record<string, unknown> | undefined)?.ruleId;
      const at = data.createdAt ? (data.createdAt as Timestamp).toDate() : null;
      return ruleTag === ruleId && at && at.toISOString().split('T')[0] === todayStr;
    });
  } catch {
    return false; // check fail ho to bhej do — miss karna worse hai
  }
};

// ─── AUTO NOTIFY (dedupe-aware) ──────────────
const autoNotify = async (
  rule: AutomationRule,
  count: number,
  message: string
): Promise<boolean> => {
  if (await notifiedToday(rule.id)) return false;
  try {
    await sendNotification({
      type: rule.notifyType,
      priority: rule.priority,
      title: `🤖 ${rule.label}`,
      message,
      link: rule.link,
      targetRole: rule.targetRole,
      createdBy: 'automation',
      createdByName: 'Automation Engine',
      metadata: { ruleId: rule.id, autoCount: count },
    });
    return true;
  } catch {
    return false;
  }
};

// ═════════════════════════════════════════════
// RULES DEFINITION
// ═════════════════════════════════════════════
export const AUTOMATION_RULES: AutomationRule[] = [
  // R1 — LOW STOCK (QM) — stockEngine reuse (M6 formula, returns-aware)
  {
    id: 'low_stock',
    label: 'Low Stock Alert',
    icon: '📦',
    description: 'Kit/items jinka balance 5 ya kam ho — QM ko turant alert',
    targetRole: 'Quarter Master',
    notifyType: 'inventory_alert',
    priority: 'high',
    link: '/issue-kit',
    check: async () => {
      const report = await buildStockReport();
      const low = report.items.filter(i => i.balance <= 5 && i.purchased > 0)
        .sort((a, b) => a.balance - b.balance);
      return {
        fired: low.length > 0,
        count: low.length,
        message: low.length > 0
          ? `${low.length} items low/out of stock: ${low.slice(0, 4).map(i => `${i.itemName} (${i.balance})`).join(', ')}${low.length > 4 ? ` +${low.length - 4} more` : ''}`
          : 'Sab items ka stock theek hai (balance > 5)',
      };
    },
  },

  // R2 — PENDING LEAVE OLD (CC) — 2+ din se pending approvals
  {
    id: 'pending_leave_old',
    label: 'Stale Leave Approvals',
    icon: '🏖️',
    description: '2 din se zyada pending leave applications — CC ko reminder',
    targetRole: 'Company Commander',
    notifyType: 'leave_pending',
    priority: 'high',
    link: '/staff-leave?tab=pending',
    check: async () => {
      const snap = await getDocs(query(collection(db, 'staff_leave'), where('status', '==', 'pending')));
      const cutoff = Date.now() - 2 * 24 * 3600 * 1000;
      const stale = snap.docs.filter(d => {
        const at = d.data().appliedAt ? (d.data().appliedAt as Timestamp).toDate() : null;
        return at && at.getTime() < cutoff;
      });
      return {
        fired: stale.length > 0,
        count: stale.length,
        message: stale.length > 0
          ? `${stale.length} leave applications 2+ din se pending hain — ${stale.slice(0, 3).map(d => `${d.data().rank ?? ''} ${d.data().staffName ?? ''}`.trim()).join(', ')} ka decision baki`
          : 'Koi 2+ din purani pending leave nahi',
      };
    },
  },

  // R3 — SERIOUS MEDICAL (CC) — Hospital/Injury 3+ din active
  {
    id: 'serious_medical',
    label: 'Serious Medical Watch',
    icon: '🏥',
    description: 'Hospital/Injury cases jo 3+ din se active hain — CC ko watch alert',
    targetRole: 'Company Commander',
    notifyType: 'medical_alert',
    priority: 'high',
    link: '/medical-register',
    check: async () => {
      const snap = await getDocs(query(collection(db, 'medicalRecords'), where('status', '==', 'Active')));
      const cutoff = Date.now() - 3 * 24 * 3600 * 1000;
      const serious = snap.docs.filter(d => {
        const cat = String(d.data().category ?? '');
        if (cat !== 'Hospital Admit' && cat !== 'Injury (Training)' && cat !== 'Medical Board') return false;
        const dateStr = String(d.data().date ?? '');
        const at = dateStr ? new Date(dateStr).getTime() : Date.now();
        return at < cutoff;
      });
      return {
        fired: serious.length > 0,
        count: serious.length,
        message: serious.length > 0
          ? `${serious.length} serious medical cases 3+ din se active: ${serious.slice(0, 3).map(d => `${d.data().chestNo ?? ''} ${d.data().name ?? ''}`.trim()).join(', ')} — review zaroori`
          : 'Koi 3+ din purana serious medical case nahi',
      };
    },
  },

  // R4 — HAZRI MISSING (Clerk) — aaj ki hazri mark nahi hui
  {
    id: 'hazri_missing',
    label: 'Hazri Not Marked',
    icon: '📋',
    description: 'Aaj ki trainee hazri abhi tak mark nahi hui — Clerk ko reminder',
    targetRole: 'Clerk',
    notifyType: 'attendance_pending',
    priority: 'medium',
    link: '/trainee-attendance',
    check: async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const snap = await getDocs(collection(db, 'trainee_attendance'));
      const markedToday = snap.docs.some(d => String(d.data().date ?? '') === todayStr);
      return {
        fired: !markedToday,
        count: markedToday ? 1 : 0,
        message: markedToday
          ? 'Aaj ki hazri mark ho chuki hai ✓'
          : `Aaj (${todayStr}) ki trainee hazri abhi tak MARK NAHI hui — PT/PARADE session register kholen`,
      };
    },
  },

  // R5 — FAILED LOGIN SPIKE (CC) — 24h mein 5+ failed attempts
  {
    id: 'failed_login_spike',
    label: 'Security: Failed Logins',
    icon: '🔐',
    description: '24 ghante mein 5+ failed login attempts — CC ko security alert',
    targetRole: 'Company Commander',
    notifyType: 'system_alert',
    priority: 'high',
    link: '/users',
    check: async () => {
      const snap = await getDocs(
        query(collection(db, 'login_history'), orderBy('timestamp', 'desc'), limit(150))
      );
      const dayAgo = Date.now() - 24 * 3600 * 1000;
      const emailMap: Record<string, number> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.status !== 'FAILED') return;
        const at = data.timestamp ? (data.timestamp as Timestamp).toDate() : null;
        if (!at || at.getTime() < dayAgo) return;
        const email = String(data.email ?? 'unknown');
        emailMap[email] = (emailMap[email] ?? 0) + 1;
      });
      const total = Object.values(emailMap).reduce((s, c) => s + c, 0);
      const top = Object.entries(emailMap).sort(([, a], [, b]) => b - a).slice(0, 3);
      return {
        fired: total >= 5,
        count: total,
        message: total >= 5
          ? `⚠️ 24h mein ${total} failed login attempts — ${top.map(([e, c]) => `${e} (${c}x)`).join(', ')}. Password reset/account check karein.`
          : `Security normal — 24h mein sirf ${total} failed attempts`,
      };
    },
  },

  // R6 — LEAVE OVERSTAY (Clerk + CC) — return date nikal gayi, joining nahi
  {
    id: 'leave_overstay',
    label: 'Leave Overstay Watch',
    icon: '⏰',
    description: 'Leave khatam hone ke baad bhi wapas nahi aaye staff — Clerk ko alert',
    targetRole: 'Clerk',
    notifyType: 'system_alert',
    priority: 'high',
    link: '/staff-leave',
    check: async () => {
      const snap = await getDocs(query(collection(db, 'staff_leave'), where('status', '==', 'approved')));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const overstayed = snap.docs.filter(d => {
        const toDate = d.data().toDate ? (d.data().toDate as Timestamp).toDate() : null;
        const returned = d.data().returnDate;
        return toDate && !returned && toDate < today;
      });
      return {
        fired: overstayed.length > 0,
        count: overstayed.length,
        message: overstayed.length > 0
          ? `${overstayed.length} staff leave se wapas nahi aaye (overstay): ${overstayed.slice(0, 3).map(d => `${d.data().rank ?? ''} ${d.data().staffName ?? ''}`.trim()).join(', ')} — joining status mark karein`
          : 'Koi leave overstay nahi',
      };
    },
  },

  // R7 — DOC VERIFY PENDING (Clerk) — uploaded par unverified documents
  {
    id: 'doc_verify_pending',
    label: 'Docs Await Verification',
    icon: '📄',
    description: 'Upload hue par verify na kiye gaye trainee documents — Clerk ko reminder',
    targetRole: 'Clerk',
    notifyType: 'system_alert',
    priority: 'medium',
    link: '/documents',
    check: async () => {
      const snap = await getDocs(collection(db, 'trainees'));
      let traineeCount = 0;
      let docCount = 0;
      snap.docs.forEach(d => {
        const documents = d.data().documents as Record<string, { status?: string }> | undefined;
        if (!documents || typeof documents !== 'object') return;
        const pending = Object.values(documents).filter(doc => doc?.status === 'Uploaded').length;
        if (pending > 0) { traineeCount++; docCount += pending; }
      });
      return {
        fired: traineeCount > 0,
        count: traineeCount,
        message: traineeCount > 0
          ? `${traineeCount} trainees ke ${docCount} documents verification ka wait kar rahe hain (uploaded, unverified)`
          : 'Sab uploaded documents verify ho chuke hain ✓',
      };
    },
  },
];

// ═════════════════════════════════════════════
// RUN SINGLE RULE
// ═════════════════════════════════════════════
export const runRule = async (rule: AutomationRule): Promise<RuleResult> => {
  const start = performance.now();
  let result: RuleResult = {
    ruleId: rule.id, fired: false, count: 0, message: 'check failed', notified: false, ms: 0,
  };

  try {
    const check = await rule.check();
    const notified = check.fired ? await autoNotify(rule, check.count, check.message) : false;
    result = {
      ruleId: rule.id,
      fired: check.fired,
      count: check.count,
      message: check.message,
      notified,
      ms: Math.round(performance.now() - start),
    };
  } catch (err: any) {
    result.message = `ERROR: ${String(err?.message ?? err).slice(0, 120)}`;
    result.ms = Math.round(performance.now() - start);
  }

  // Run log — silent (audit trail kabhi scan ko break nahi karta)
  addDoc(collection(db, RUNS_COL), {
    ruleId: result.ruleId,
    label: rule.label,
    fired: result.fired,
    count: result.count,
    notified: result.notified,
    message: result.message.slice(0, 300),
    ms: result.ms,
    ranAt: serverTimestamp(),
  }).catch(() => undefined);

  return result;
};

// ═════════════════════════════════════════════
// RUN FULL SCAN (saare rules sequential)
// ═════════════════════════════════════════════
export const runFullAutomationScan = async (
  onProgress?: (done: number, total: number, label: string) => void
): Promise<RuleResult[]> => {
  const results: RuleResult[] = [];
  for (let i = 0; i < AUTOMATION_RULES.length; i++) {
    const rule = AUTOMATION_RULES[i];
    onProgress?.(i + 1, AUTOMATION_RULES.length, rule.label);
    results.push(await runRule(rule));
  }
  return results;
};

// ═════════════════════════════════════════════
// RUN HISTORY
// ═════════════════════════════════════════════
export interface AutomationRun {
  id: string;
  ruleId: string;
  label: string;
  fired: boolean;
  count: number;
  notified: boolean;
  message: string;
  ms: number;
  ranAt: Date | null;
}

export const fetchAutomationRuns = async (count: number = 30): Promise<AutomationRun[]> => {
  try {
    const q = query(collection(db, RUNS_COL), orderBy('ranAt', 'desc'), limit(count));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ruleId: String(d.data().ruleId ?? ''),
      label: String(d.data().label ?? ''),
      fired: Boolean(d.data().fired),
      count: Number(d.data().count ?? 0),
      notified: Boolean(d.data().notified),
      message: String(d.data().message ?? ''),
      ms: Number(d.data().ms ?? 0),
      ranAt: d.data().ranAt ? (d.data().ranAt as Timestamp).toDate() : null,
    }));
  } catch {
    return [];
  }
};
