// ═══════════════════════════════════════════════════════════
// DATA MISMATCH DETECTION ENGINE (Bemel Dashboard)
// Auto-detects missing/inconsistent data across all records
// ═══════════════════════════════════════════════════════════

import {
  collection, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';

export type MismatchSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface MismatchIssue {
  id: string;
  traineeId: string;
  traineeName: string;
  chestNo: string;
  category: string;
  issue: string;
  severity: MismatchSeverity;
  suggestion: string;
}

export const scanForMismatch = async (batchId: string): Promise<MismatchIssue[]> => {
  const issues: MismatchIssue[] = [];
  let issueId = 0;

  try {
    // Fetch all relevant data
    const emptySnap = { docs: [] as any[], forEach: () => {} };
    const [traineesSnap, docsSnap, medicalSnap, absentSnap, testsSnap, kitSnap] = await Promise.all([
      getDocs(query(collection(db, 'trainees'), where('batchId', '==', batchId))),
      getDocs(query(collection(db, 'documentVerifications'), where('batchId', '==', batchId))).catch(() => emptySnap),
      getDocs(query(collection(db, 'medicalRecords'), where('batchId', '==', batchId))).catch(() => emptySnap),
      getDocs(query(collection(db, 'absentRecords'), where('batchId', '==', batchId))).catch(() => emptySnap),
      getDocs(query(collection(db, 'training_tests'), where('batchId', '==', batchId))).catch(() => emptySnap),
      getDocs(query(collection(db, 'kitAllocations'), where('batchId', '==', batchId))).catch(() => emptySnap),
    ]);

    const trainees: any[] = [];
    traineesSnap.forEach(d => trainees.push({ id: d.id, ...d.data() }));

    const docsByTrainee: Record<string, any[]> = {};
    docsSnap.forEach((d: any) => {
      const data = d.data();
      const tid = data.traineeId || d.id;
      (docsByTrainee[tid] = docsByTrainee[tid] || []).push(data);
    });

    const medicalByTrainee: Record<string, any[]> = {};
    medicalSnap.forEach((d: any) => {
      const data = d.data();
      const tid = data.traineeId;
      if (tid) (medicalByTrainee[tid] = medicalByTrainee[tid] || []).push(data);
    });

    const absentByTrainee: Record<string, any[]> = {};
    absentSnap.forEach((d: any) => {
      const data = d.data();
      const tid = data.traineeId;
      if (tid) (absentByTrainee[tid] = absentByTrainee[tid] || []).push(data);
    });

    const testsByTrainee: Record<string, any[]> = {};
    testsSnap.forEach((d: any) => {
      const data = d.data();
      const results = data.results || [];
      results.forEach((r: any) => {
        if (r.traineeId) (testsByTrainee[r.traineeId] = testsByTrainee[r.traineeId] || []).push({ ...r, testName: data.testName, testType: data.testType });
      });
    });

    // Scan each trainee
    for (const t of trainees) {
      const tid = t.id;
      const name = t.name || 'Unknown';
      const chest = t.chestNo || '—';

      // 1. Missing basic info
      if (!t.name) issues.push({ id: `i-${++issueId}`, traineeId: tid, traineeName: name, chestNo: chest, category: 'Identity', issue: 'Name missing', severity: 'Critical', suggestion: 'Add trainee name' });
      if (!t.regNo) issues.push({ id: `i-${++issueId}`, traineeId: tid, traineeName: name, chestNo: chest, category: 'Identity', issue: 'Regt No missing', severity: 'Critical', suggestion: 'Add regimental number' });
      if (!t.chestNo) issues.push({ id: `i-${++issueId}`, traineeId: tid, traineeName: name, chestNo: chest, category: 'Identity', issue: 'Chest No missing', severity: 'High', suggestion: 'Assign chest number' });
      if (!t.dob) issues.push({ id: `i-${++issueId}`, traineeId: tid, traineeName: name, chestNo: chest, category: 'Identity', issue: 'DOB missing', severity: 'High', suggestion: 'Add date of birth' });
      if (!t.fatherName) issues.push({ id: `i-${++issueId}`, traineeId: tid, traineeName: name, chestNo: chest, category: 'Identity', issue: "Father's name missing", severity: 'Medium', suggestion: "Add father's name" });
      if (!t.bloodGroup) issues.push({ id: `i-${++issueId}`, traineeId: tid, traineeName: name, chestNo: chest, category: 'Medical', issue: 'Blood group missing', severity: 'High', suggestion: 'Add blood group' });
      if (!t.mobileNo) issues.push({ id: `i-${++issueId}`, traineeId: tid, traineeName: name, chestNo: chest, category: 'Contact', issue: 'Mobile number missing', severity: 'Medium', suggestion: 'Add mobile number' });
      if (!t.emergencyContact) issues.push({ id: `i-${++issueId}`, traineeId: tid, traineeName: name, chestNo: chest, category: 'Contact', issue: 'Emergency contact missing', severity: 'High', suggestion: 'Add emergency contact' });

      // 2. Document pending
      const docs = docsByTrainee[tid] || [];
      const pendingDocs = docs.filter(d => d.status !== 'Verified');
      if (pendingDocs.length > 0) {
        issues.push({ id: `i-${++issueId}`, traineeId: tid, traineeName: name, chestNo: chest, category: 'Documents', issue: `${pendingDocs.length} document(s) not verified`, severity: 'High', suggestion: 'Verify pending documents' });
      }

      // 3. Medical fitness
      const medical = medicalByTrainee[tid] || [];
      const activeMedical = medical.filter(m => m.status === 'Active');
      if (activeMedical.length > 0) {
        issues.push({ id: `i-${++issueId}`, traineeId: tid, traineeName: name, chestNo: chest, category: 'Medical', issue: `${activeMedical.length} active medical record(s)`, severity: 'Medium', suggestion: 'Review medical status' });
      }

      // 4. Attendance — excessive absences
      const absences = absentByTrainee[tid] || [];
      const totalAbsentDays = absences.filter(a => a.type === 'A').reduce((s, a) => s + (a.totalDays || 1), 0);
      if (totalAbsentDays > 10) {
        issues.push({ id: `i-${++issueId}`, traineeId: tid, traineeName: name, chestNo: chest, category: 'Attendance', issue: `${totalAbsentDays} absent days (threshold: 10)`, severity: 'Critical', suggestion: 'Review attendance — may affect eligibility' });
      }

      // 5. FPT not done
      const tests = testsByTrainee[tid] || [];
      const fptTests = tests.filter(t => t.testType === 'fpt');
      if (fptTests.length === 0) {
        issues.push({ id: `i-${++issueId}`, traineeId: tid, traineeName: name, chestNo: chest, category: 'Training', issue: 'FPT not attempted', severity: 'Medium', suggestion: 'Schedule FPT' });
      }

      // 6. FPT failed
      const fptFailed = fptTests.filter(t => t.status === 'fail');
      if (fptFailed.length > 0 && fptTests.every(t => t.status === 'fail')) {
        issues.push({ id: `i-${++issueId}`, traineeId: tid, traineeName: name, chestNo: chest, category: 'Training', issue: 'FPT — All attempts failed', severity: 'Critical', suggestion: 'Remedial training needed' });
      }

      // 7. Firing not done
      const firingTests = tests.filter(t => t.testType === 'firing');
      if (firingTests.length === 0) {
        issues.push({ id: `i-${++issueId}`, traineeId: tid, traineeName: name, chestNo: chest, category: 'Training', issue: 'Firing practice not done', severity: 'Low', suggestion: 'Schedule firing' });
      }
    }

    // 8. Duplicate chest numbers
    const chestNos = trainees.map(t => t.chestNo).filter(Boolean);
    const duplicateChest = chestNos.filter((c, i) => chestNos.indexOf(c) !== i);
    if (duplicateChest.length > 0) {
      issues.push({ id: `i-${++issueId}`, traineeId: '', traineeName: 'SYSTEM', chestNo: '', category: 'Data Integrity', issue: `Duplicate chest numbers: ${[...new Set(duplicateChest)].join(', ')}`, severity: 'Critical', suggestion: 'Fix duplicate chest numbers immediately' });
    }

    // 9. Duplicate regt numbers
    const regtNos = trainees.map(t => t.regNo).filter(Boolean);
    const duplicateRegt = regtNos.filter((r, i) => regtNos.indexOf(r) !== i);
    if (duplicateRegt.length > 0) {
      issues.push({ id: `i-${++issueId}`, traineeId: '', traineeName: 'SYSTEM', chestNo: '', category: 'Data Integrity', issue: `Duplicate regt numbers: ${[...new Set(duplicateRegt)].join(', ')}`, severity: 'Critical', suggestion: 'Fix duplicate regt numbers immediately' });
    }

    // T-131: Attendance threshold alerts — periodAttendance
    try {
      const periodAttnSnap = await getDocs(query(collection(db, 'periodAttendance'), where('batchId', '==', batchId))).catch(() => emptySnap);
      const attnByTrainee: Record<string, { total: number; present: number }> = {};
      periodAttnSnap.forEach((d: any) => {
        const data = d.data();
        const tid = data.traineeId;
        if (!tid) return;
        if (!attnByTrainee[tid]) attnByTrainee[tid] = { total: 0, present: 0 };
        attnByTrainee[tid].total++;
        if (data.status === 'Present' || data.present) attnByTrainee[tid].present++;
      });
      for (const t of trainees) {
        const attn = attnByTrainee[t.id];
        if (!attn || attn.total === 0) continue;
        const pct = Math.round((attn.present / attn.total) * 100);
        if (pct < 50) {
          issues.push({ id: `i-${++issueId}`, traineeId: t.id, traineeName: t.name || 'Unknown', chestNo: t.chestNo || '—', category: 'Attendance', issue: `Attendance CRITICAL: ${pct}% (${attn.present}/${attn.total} periods)`, severity: 'Critical', suggestion: 'Below 50% — may affect eligibility for exams' });
        } else if (pct < 75) {
          issues.push({ id: `i-${++issueId}`, traineeId: t.id, traineeName: t.name || 'Unknown', chestNo: t.chestNo || '—', category: 'Attendance', issue: `Attendance LOW: ${pct}% (${attn.present}/${attn.total} periods)`, severity: 'High', suggestion: 'Below 75% threshold — warning needed' });
        }
      }
    } catch { /* periodAttendance may not exist */ }

  } catch (err) {
    console.error('Mismatch scan error:', err);
  }

  return issues;
};
