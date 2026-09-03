// ═══════════════════════════════════════════════════════════
// FINAL RESULT API (Antim Board Parinaam)
// Auto-aggregates all test results, FPT, firing, attendance
// ═══════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { FinalResult, FinalRecommendation } from '../types/finalResult.types';

const COLLECTION = 'finalResults';

// Auto-calculate final result for a trainee
export const calculateFinalResult = async (traineeId: string, batchId: string): Promise<Partial<FinalResult>> => {
  // Fetch all test results
  const testsSnap = await getDocs(query(collection(db, 'training_tests'), where('batchId', '==', batchId)));
  let totalObtained = 0;
  let totalMax = 0;
  let fptResult = 'Not Done';
  let firingClass = 'Not Done';
  let ptScore = 0, drillScore = 0, weaponScore = 0, firingScore = 0, writtenScore = 0;

  testsSnap.forEach(d => {
    const data = d.data();
    const results = data.results || [];
    const myResult = results.find((r: any) => r.traineeId === traineeId);
    if (!myResult || myResult.status === 'absent') return;

    totalObtained += myResult.marks || 0;
    totalMax += data.totalMarks || 100;

    const type = data.testType;
    if (type === 'fpt') { fptResult = myResult.status === 'pass' ? 'Pass' : 'Fail'; ptScore += myResult.marks || 0; }
    else if (type === 'firing') { firingScore += myResult.marks || 0; firingClass = myResult.firingDetails?.classification || 'Not Done'; }
    else if (type === 'drill') drillScore += myResult.marks || 0;
    else if (type === 'weapon') weaponScore += myResult.marks || 0;
    else writtenScore += myResult.marks || 0;
  });

  // Fetch attendance
  const absentSnap = await getDocs(query(collection(db, 'absentRecords'), where('batchId', '==', batchId), where('traineeId', '==', traineeId)));
  let absentDays = 0;
  absentSnap.forEach(d => { absentDays += d.data().totalDays || 1; });
  const attendancePercentage = Math.max(0, 100 - absentDays);

  const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
  let overallGrade = 'F';
  if (percentage >= 90) overallGrade = 'A+';
  else if (percentage >= 80) overallGrade = 'A';
  else if (percentage >= 70) overallGrade = 'B+';
  else if (percentage >= 60) overallGrade = 'B';
  else if (percentage >= 50) overallGrade = 'C';
  else if (percentage >= 40) overallGrade = 'D';

  let recommendation: FinalRecommendation = 'Fit for Duty';
  if (percentage < 40 || fptResult === 'Fail') recommendation = 'Unfit';
  else if (percentage < 50 || attendancePercentage < 75) recommendation = 'Conditional';

  return {
    totalMarks: totalMax,
    obtainedMarks: totalObtained,
    percentage,
    overallGrade,
    ptScore, drillScore, weaponScore, firingScore, writtenScore,
    attendancePercentage,
    fptResult,
    firingClassification: firingClass,
    recommendation,
  };
};

export const saveFinalResult = async (data: Omit<FinalResult, 'id' | 'createdAt'>): Promise<string> => {
  const ref = await addDoc(collection(db, COLLECTION), { ...data, createdAt: new Date().toISOString() });
  return ref.id;
};

export const getFinalResultsByBatch = async (batchId: string): Promise<FinalResult[]> => {
  try {
    const snap = await getDocs(query(collection(db, COLLECTION), where('batchId', '==', batchId)));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as FinalResult));
    list.sort((a, b) => (a.position || 999) - (b.position || 999));
    return list;
  } catch { return []; }
};

export const deleteFinalResult = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};
