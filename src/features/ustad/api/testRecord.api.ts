// ============================================
// UNIFIED TEST RECORDS API
// Supports: Weekly, FPT, Drill, Weapon, All types
// ============================================

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import {
  TestRecord, TestFormData, TestStatus,
  TraineeResult, TestType, FPTEvent, calculateGrade,
} from '../types/testRecord.types';

const COLLECTION = 'training_tests';

// ─── Helper: Doc → TestRecord ────────────────
const docToTest = (id: string, data: Record<string, unknown>): TestRecord => ({
  id,
  batchId: (data.batchId as string) ?? '',
  batchNumber: (data.batchNumber as string) ?? '',
  testType: (data.testType as TestType) ?? 'custom',
  testName: (data.testName as string) ?? '',
  subjectCode: (data.subjectCode as string) ?? '',
  description: (data.description as string) ?? '',
  weekNumber: (data.weekNumber as number) ?? 1,
  testDate: data.testDate ? (data.testDate as any).toDate?.() ?? new Date(data.testDate as string) : null,
  startTime: (data.startTime as string) ?? '',
  endTime: (data.endTime as string) ?? '',
  venue: (data.venue as string) ?? '',
  totalMarks: (data.totalMarks as number) ?? 100,
  passingMarks: (data.passingMarks as number) ?? 40,
  passingPercent: (data.passingPercent as number) ?? 40,
  fptEvents: (data.fptEvents as FPTEvent[]) ?? undefined,
  overallPassPercent: (data.overallPassPercent as number) ?? undefined,
  instructorId: (data.instructorId as string) ?? '',
  instructorName: (data.instructorName as string) ?? '',
  results: (data.results as TraineeResult[]) ?? [],
  averageScore: (data.averageScore as number) ?? 0,
  passCount: (data.passCount as number) ?? 0,
  failCount: (data.failCount as number) ?? 0,
  absentCount: (data.absentCount as number) ?? 0,
  status: (data.status as TestStatus) ?? 'scheduled',
  remarks: (data.remarks as string) ?? '',
  createdAt: data.createdAt ? (data.createdAt as any).toDate?.() ?? null : null,
  updatedAt: data.updatedAt ? (data.updatedAt as any).toDate?.() ?? null : null,
  createdBy: (data.createdBy as string) ?? '',
});

// ═══════════════════════════════════════════
// CREATE TEST
// ═══════════════════════════════════════════
export const createTest = async (
  formData: TestFormData,
  batchId: string,
  batchNumber: string,
  instructorName: string,
  userId: string,
  instructorsList?: any[]
): Promise<string> => {
  try {
    const payload: any = {
      batchId, batchNumber,
      testType: formData.testType,
      testName: formData.testName,
      subjectCode: formData.subjectCode,
      description: formData.description,
      weekNumber: formData.weekNumber,
      testDate: Timestamp.fromDate(new Date(formData.testDate)),
      startTime: formData.startTime,
      endTime: formData.endTime,
      venue: formData.venue,
      platoon: formData.platoon || 'All Platoons (Whole Company)',
      totalMarks: formData.totalMarks,
      passingMarks: formData.passingMarks,
      passingPercent: formData.passingPercent,
      instructorId: formData.instructorId,
      instructorName,
      instructors: instructorsList || [],
      results: [],
      averageScore: 0, passCount: 0, failCount: 0, absentCount: 0,
      status: 'scheduled' as TestStatus,
      remarks: formData.remarks,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (formData.testType === 'fpt' && formData.fptEvents) {
      payload.fptEvents = formData.fptEvents;
      payload.overallPassPercent = formData.overallPassPercent ?? 50;
    }

    const docRef = await addDoc(collection(db, COLLECTION), payload);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// GET TESTS BY BATCH
// ═══════════════════════════════════════════
export const getTestsByBatch = async (batchId: string): Promise<TestRecord[]> => {
  try {
    const q = query(collection(db, COLLECTION), where('batchId', '==', batchId));
    const snap = await getDocs(q);
    const tests = snap.docs.map(d => docToTest(d.id, d.data() as Record<string, unknown>));
    return tests.sort((a, b) => {
      if (!a.testDate || !b.testDate) return 0;
      return b.testDate.getTime() - a.testDate.getTime();
    });
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// CHECK DUPLICATE
// ═══════════════════════════════════════════
export const checkDuplicateTest = async (
  batchId: string,
  testName: string,
  weekNumber: number
): Promise<boolean> => {
  const q = query(
    collection(db, COLLECTION),
    where('batchId', '==', batchId),
    where('testName', '==', testName),
    where('weekNumber', '==', weekNumber)
  );
  const snap = await getDocs(q);
  return !snap.empty;
};

// ═══════════════════════════════════════════
// UPDATE TEST
// ═══════════════════════════════════════════
export const updateTest = async (
  testId: string,
  formData: Partial<TestFormData>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, testId);
    const payload: Record<string, unknown> = {
      ...formData,
      updatedAt: serverTimestamp(),
    };

    if (formData.testDate) {
      payload.testDate = Timestamp.fromDate(new Date(formData.testDate));
    }

    await updateDoc(docRef, payload);
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// UPDATE STATUS
// ═══════════════════════════════════════════
export const updateTestStatus = async (
  testId: string,
  status: TestStatus
): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, testId), {
    status,
    updatedAt: serverTimestamp(),
  });
};

// ═══════════════════════════════════════════
// SAVE RESULTS (with FPT support + auto-updates)
// ═══════════════════════════════════════════
export const saveTestResults = async (
  testId: string,
  results: TraineeResult[],
  totalMarks: number,
  passingMarks: number
): Promise<void> => {
  try {
    // 1. Process results
    const processedResults = results.map(r => {
      const percent = totalMarks > 0 ? (r.marks / totalMarks) * 100 : 0;
      return {
        ...r,
        grade: calculateGrade(percent),
        status: r.marks < 0
          ? 'absent' as const
          : r.marks >= passingMarks
            ? 'pass' as const
            : 'fail' as const,
      };
    });

    const validResults = processedResults.filter(r => r.status !== 'absent');
    const totalScore = validResults.reduce((s, r) => s + r.marks, 0);
    const averageScore = validResults.length > 0
      ? Math.round(totalScore / validResults.length)
      : 0;
    const passCount = processedResults.filter(r => r.status === 'pass').length;
    const failCount = processedResults.filter(r => r.status === 'fail').length;
    const absentCount = processedResults.filter(r => r.status === 'absent').length;

    // 2. Save in new unified collection
    await updateDoc(doc(db, COLLECTION, testId), {
      results: processedResults,
      averageScore,
      passCount, failCount, absentCount,
      status: 'completed' as TestStatus,
      updatedAt: serverTimestamp(),
    });

    // 3. Get test details for backward-compat and trainee updates
    const testSnap = await getDocs(
      query(collection(db, COLLECTION), where('__name__', '==', testId))
    );

    if (!testSnap.empty) {
      const testData = testSnap.docs[0].data();
      const testType = testData.testType as string;
      const testName = testData.testName as string || '';
      const testDate = testData.testDate?.toDate?.() ?? new Date();
      const weekNumber = (testData.weekNumber as number) || 1;
      const subjectCode = testData.subjectCode as string || '';
      const batchId = testData.batchId as string;

      // 4. Auto-publish to old collections (backward compatibility)
      for (const res of processedResults) {
        if (res.status === 'absent') continue;

        const commonData = {
          batchId,
          testName,
          testDate: testDate.toISOString().split('T')[0],
          weekNumber,
          traineeId: res.traineeId,
          traineeName: res.traineeName,
          chestNo: res.chestNo,
          regNo: res.regNo,
          platoon: res.platoon,
          obtainedMarks: res.marks,
          totalMarks,
          passingMarks,
          percentage: Math.round((res.marks / totalMarks) * 100),
          result: res.status === 'pass' ? 'Pass' : 'Fail',
          remarks: res.remarks || '',
          createdAt: new Date().toISOString(),
          _autoPublishedFrom: 'training_tests',
          _sourceTestId: testId,
        };

        try {
          // Weekly/Written/Custom → weeklyTestRecords
          if (
            testType === 'weekly' || testType === 'custom' ||
            testType === 'drill' || testType === 'weapon' ||
            testType === 'map_reading' || testType === 'field_craft' ||
            testType === 'battle_craft' || testType === 'first_aid'
          ) {
            await addDoc(collection(db, 'weeklyTestRecords'), {
              ...commonData,
              subject: subjectCode || testType,
            });
          }

          // FPT → fptRecords
          if (testType === 'fpt') {
            await addDoc(collection(db, 'fptRecords'), {
              ...commonData,
              events: res.events || [],
              eventsPassed: res.eventsPassed || 0,
              eventsFailed: res.eventsFailed || 0,
              totalPassingMarks: passingMarks,
              overallPassPercent: (testData.overallPassPercent as number) || 50,
            });
          }
        } catch (publishErr) {
          console.warn(`Auto-publish skipped for ${res.traineeName}:`, publishErr);
        }
      }

      // 5. Auto-update trainee fields
      for (const res of processedResults) {
        if (res.status === 'absent') continue;

        try {
          const traineeUpdate: Record<string, string> = {};

          if (testType === 'fpt') {
            traineeUpdate.fptResult = res.status === 'pass' ? 'Pass' : 'Fail';
            traineeUpdate.fptScore = `${res.marks}/${totalMarks}`;
          } else {
            traineeUpdate.weeklyExamResult = res.status === 'pass' ? 'Pass' : 'Fail';
            traineeUpdate.weeklyExamMarks = `${res.marks}/${totalMarks}`;
          }

          await updateDoc(doc(db, 'trainees', res.traineeId), traineeUpdate);
        } catch (traineeErr) {
          console.warn(`Trainee update skipped: ${res.traineeName}`);
        }
      }
    }
  } catch (error) {
    throw error;
  }
};

// ═══════════════════════════════════════════
// DELETE TEST
// ═══════════════════════════════════════════
export const deleteTest = async (testId: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, testId));
};