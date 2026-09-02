// src/features/relegation/api/relegation.api.ts
// Atomic RelID relegation + rejoin. Destination batch is NOT chosen at
// relegate-time — clerk later types RelID into whichever batch is running.

import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  writeBatch, increment, addDoc,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { DEV_TAG, isDevViewer } from '../../../utils/devDataFilter';
import type {
  RelegationRecord, RelegateInput, RejoinInput, RejoinResult, RejoinStamp,
} from '../types/relegation.types';
import {
  generateRelegateId, normalizeRelegateId, rejoinChestNo, nextRejoinChestNo,
  originalChestBase, pickSnapshot, stripUndefined, isOnStrength,
} from '../utils/relegation.utils';

const COLLECTION = 'relegations';

const todayISO = () => new Date().toISOString();
const todayDate = () => new Date().toISOString().split('T')[0];

async function uniqueRelegateId(chestNo: string): Promise<string> {
  for (let i = 0; i < 8; i += 1) {
    const id = generateRelegateId(chestNo);
    const snap = await getDocs(query(
      collection(db, COLLECTION),
      where('relegateId', '==', id),
      limit(1),
    ));
    if (snap.empty) return id;
  }
  return `${generateRelegateId(chestNo)}${Date.now().toString(36).toUpperCase().slice(-2)}`;
}

async function uniqueChestInBatch(batchId: string, originalChest: string): Promise<string> {
  const existing = new Set<string>();
  const snap = await getDocs(query(collection(db, 'trainees'), where('batchId', '==', batchId)));
  snap.forEach((d) => {
    const c = String((d.data() as { chestNo?: string }).chestNo ?? '').trim().toUpperCase();
    if (c) existing.add(c);
  });
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const candidate = nextRejoinChestNo(originalChest, attempt).toUpperCase();
    if (!existing.has(candidate)) return candidate;
  }
  return `${rejoinChestNo(originalChest)}${Date.now().toString().slice(-3)}`;
}

function stampDev(data: Record<string, unknown>, fromDoc?: Record<string, unknown>): Record<string, unknown> {
  if (isDevViewer() || fromDoc?.[DEV_TAG] === true) {
    return { ...data, [DEV_TAG]: true };
  }
  return data;
}

export async function lookupByRelegateId(rawId: string): Promise<RelegationRecord | null> {
  const relegateId = normalizeRelegateId(rawId);
  if (!relegateId) return null;
  const snap = await getDocs(query(
    collection(db, COLLECTION),
    where('relegateId', '==', relegateId),
    limit(1),
  ));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as RelegationRecord;
}

export async function listAwaitingRejoin(): Promise<RelegationRecord[]> {
  const snap = await getDocs(query(
    collection(db, COLLECTION),
    where('status', '==', 'awaiting_rejoin'),
    orderBy('relegatedAt', 'desc'),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RelegationRecord));
}

export async function listByFromBatch(batchId: string): Promise<RelegationRecord[]> {
  if (!batchId) return [];
  const snap = await getDocs(query(
    collection(db, COLLECTION),
    where('fromBatchId', '==', batchId),
    orderBy('relegatedAt', 'desc'),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RelegationRecord));
}

export async function listByToBatch(batchId: string): Promise<RelegationRecord[]> {
  if (!batchId) return [];
  const snap = await getDocs(query(
    collection(db, COLLECTION),
    where('toBatchId', '==', batchId),
    orderBy('rejoinedAt', 'desc'),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RelegationRecord));
}

export async function listAllRelegations(max = 200): Promise<RelegationRecord[]> {
  const snap = await getDocs(query(
    collection(db, COLLECTION),
    orderBy('relegatedAt', 'desc'),
    limit(max),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RelegationRecord));
}

/**
 * Phase 1 — relegate. Destination batch UNKNOWN.
 * RelID generate, original trainee freeze, strength se nikaalo.
 */
export async function relegateTrainee(
  input: RelegateInput,
  actor: { uid: string; name: string },
): Promise<RelegationRecord> {
  const traineeRef = doc(db, 'trainees', input.traineeId);
  const traineeSnap = await getDoc(traineeRef);
  if (!traineeSnap.exists()) throw new Error('Trainee nahi mila.');

  const t = traineeSnap.data() as Record<string, unknown>;
  if (String(t.trainingStatus || '') === 'relegated') {
    const existing = String(t.relegateId || '');
    throw new Error(
      existing
        ? `Ye trainee pehle se relegated hai. RelID: ${existing}`
        : 'Ye trainee pehle se relegated hai.',
    );
  }
  if (!t.batchId) throw new Error('Trainee kisi batch se linked nahi hai.');

  const open = await getDocs(query(
    collection(db, COLLECTION),
    where('fromTraineeId', '==', input.traineeId),
    where('status', '==', 'awaiting_rejoin'),
    limit(1),
  ));
  if (!open.empty) {
    const rec = open.docs[0].data() as RelegationRecord;
    throw new Error(`Is trainee ka RelID pehle se open hai: ${rec.relegateId}`);
  }

  const relegateId = await uniqueRelegateId(String(t.chestNo || ''));
  const now = todayISO();
  const snapshot = pickSnapshot(t);
  const relRef = doc(collection(db, COLLECTION));

  const record: Omit<RelegationRecord, 'id'> = {
    relegateId,
    status: 'awaiting_rejoin',
    fromTraineeId: input.traineeId,
    fromBatchId: String(t.batchId),
    fromBatchNumber: String(t.batchNumber || ''),
    fromBatchName: String(t.batchName || ''),
    fromChestNo: String(t.chestNo || ''),
    fromPlatoon: String(t.platoon || ''),
    fromSection: String(t.section || ''),
    traineeName: String(t.name || ''),
    fatherName: String(t.fatherName || ''),
    regNo: String(t.regNo || ''),
    photoURL: String(t.photoURL || ''),
    reason: input.reason,
    details: input.details || '',
    authority: input.authority || '',
    orderNo: input.orderNo || '',
    medicalNote: input.medicalNote || '',
    completedSubjects: input.completedSubjects || '',
    remainingSubjects: input.remainingSubjects || '',
    snapshot,
    relegatedAt: now,
    relegatedBy: actor.uid,
    relegatedByName: actor.name,
  };

  const batch = writeBatch(db);
  batch.set(relRef, stampDev(stripUndefined(record as unknown as Record<string, unknown>), t));
  batch.update(traineeRef, stripUndefined({
    trainingStatus: 'relegated',
    relegateId,
    relegationId: relRef.id,
    relegatedAt: now,
    relegatedReason: input.reason,
    relegatedDetails: input.details || '',
    isActiveInBatch: false,
    attn: 'A',
    updatedAt: now,
  }));
  if (t.batchId) {
    const fromBatchSnap = await getDoc(doc(db, 'batches', String(t.batchId)));
    if (fromBatchSnap.exists()) {
      batch.update(doc(db, 'batches', String(t.batchId)), {
        totalTrainees: increment(-1),
      });
    }
  }
  await batch.commit();

  try {
    await addDoc(collection(db, 'activity_logs'), stampDev({
      userId: actor.uid,
      userName: actor.name,
      module: 'relegation',
      action: 'relegate',
      targetId: input.traineeId,
      details: { relegateId, chestNo: t.chestNo, name: t.name, reason: input.reason },
      createdAt: now,
    }, t));
  } catch { /* activity log is best-effort */ }

  return { id: relRef.id, ...record };
}

/**
 * Phase 2 — RelID se current batch me add.
 * Full personal data sync. Chest = original + "R".
 * Purane trainee + relegation record pe rejoin stamp.
 */
export async function rejoinByRelegateId(
  input: RejoinInput,
  destBatch: { id: string; batchNumber: string; batchName: string },
  actor: { uid: string; name: string },
): Promise<RejoinResult> {
  if (!destBatch?.id) throw new Error('Active batch select karo pehle.');

  const rec = await lookupByRelegateId(input.relegateId);
  if (!rec) throw new Error(`RelID "${normalizeRelegateId(input.relegateId)}" nahi mila.`);
  if (rec.status === 'cancelled') throw new Error('Ye RelID cancel ho chuka hai.');
  if (rec.status === 'rejoined') {
    throw new Error(
      `Ye RelID pehle se batch ${rec.toBatchNumber || rec.toBatchId} me ` +
      `chest ${rec.toChestNo} pe add ho chuka hai.`,
    );
  }
  if (rec.fromBatchId === destBatch.id) {
    throw new Error('Wahi batch jahan se relegate hua — dusre (current) batch me add karo.');
  }

  const originalChest = originalChestBase(rec.fromChestNo) || rec.fromChestNo;
  const newChest = input.chestNo?.trim()
    ? input.chestNo.trim().toUpperCase()
    : await uniqueChestInBatch(destBatch.id, originalChest);

  // Duplicate chest guard if clerk overrode.
  const clash = await getDocs(query(
    collection(db, 'trainees'),
    where('batchId', '==', destBatch.id),
    where('chestNo', '==', newChest),
    limit(1),
  ));
  if (!clash.empty) {
    throw new Error(`Chest ${newChest} is batch me pehle se assigned hai. Alag number choose karo.`);
  }

  const now = todayISO();
  const snap = rec.snapshot || {};
  const newTraineeRef = doc(collection(db, 'trainees'));
  const relRef = doc(db, COLLECTION, rec.id);
  const oldTraineeRef = doc(db, 'trainees', rec.fromTraineeId);

  const newTrainee = stampDev(stripUndefined({
    ...snap,
    batchId: destBatch.id,
    batchNumber: destBatch.batchNumber,
    batchName: destBatch.batchName,
    chestNo: newChest,
    originalChestNo: originalChest,
    originalTraineeId: rec.fromTraineeId,
    originalBatchId: rec.fromBatchId,
    originalBatchNumber: rec.fromBatchNumber,
    relegateId: rec.relegateId,
    relegationId: rec.id,
    isRelegatedIntake: true,
    trainingStatus: 'active',
    isActiveInBatch: true,
    platoon: input.platoon || 'Platoon 1',
    section: input.section || 'Section A',
    attn: 'P',
    kitIssued: false,
    issuedItems: [],
    issuedKitItems: [],
    joinDate: todayDate(),
    fptResult: '',
    fptScore: '',
    weeklyExamResult: '',
    weeklyExamMarks: '',
    ptScore: '',
    weaponNo: '',
    rifleNo: '',
    remarks: input.remarks
      || `Relegated intake from batch ${rec.fromBatchNumber} (chest ${rec.fromChestNo}). RelID ${rec.relegateId}`,
    previousTrainingNotes: {
      fromBatchNumber: rec.fromBatchNumber,
      fromChestNo: rec.fromChestNo,
      reason: rec.reason,
      fptResult: snap.fptResult,
      weeklyExamResult: snap.weeklyExamResult,
      punishments: snap.punishments,
    },
    createdAt: now,
    updatedAt: now,
  }), rec as unknown as Record<string, unknown>);

  const rejoinStamp: RejoinStamp = {
    rejoinedAt: now,
    rejoinedBatchId: destBatch.id,
    rejoinedBatchNumber: destBatch.batchNumber,
    rejoinedBatchName: destBatch.batchName,
    rejoinedChestNo: newChest,
    rejoinedTraineeId: newTraineeRef.id,
    rejoinedBy: actor.uid,
    rejoinedByName: actor.name,
  };

  const batch = writeBatch(db);
  batch.set(newTraineeRef, newTrainee);
  batch.update(relRef, stripUndefined({
    status: 'rejoined',
    toBatchId: destBatch.id,
    toBatchNumber: destBatch.batchNumber,
    toBatchName: destBatch.batchName,
    toTraineeId: newTraineeRef.id,
    toChestNo: newChest,
    toPlatoon: input.platoon || 'Platoon 1',
    rejoinedAt: now,
    rejoinedBy: actor.uid,
    rejoinedByName: actor.name,
  }));

  const oldSnap = await getDoc(oldTraineeRef);
  if (oldSnap.exists()) {
    const old = oldSnap.data() as Record<string, unknown>;
    const history = Array.isArray(old.rejoinHistory) ? old.rejoinHistory : [];
    batch.update(oldTraineeRef, {
      rejoinStatus: 'rejoined',
      rejoinedBatchId: destBatch.id,
      rejoinedBatchNumber: destBatch.batchNumber,
      rejoinedBatchName: destBatch.batchName,
      rejoinedChestNo: newChest,
      rejoinedTraineeId: newTraineeRef.id,
      rejoinedAt: now,
      rejoinHistory: [...history, rejoinStamp],
      updatedAt: now,
    });
  }

  const destSnap = await getDoc(doc(db, 'batches', destBatch.id));
  if (destSnap.exists()) {
    batch.update(doc(db, 'batches', destBatch.id), {
      totalTrainees: increment(1),
    });
  }

  await batch.commit();

  try {
    await addDoc(collection(db, 'activity_logs'), stampDev({
      userId: actor.uid,
      userName: actor.name,
      module: 'relegation',
      action: 'rejoin',
      targetId: newTraineeRef.id,
      details: {
        relegateId: rec.relegateId,
        fromBatch: rec.fromBatchNumber,
        toBatch: destBatch.batchNumber,
        fromChest: rec.fromChestNo,
        toChest: newChest,
        name: rec.traineeName,
      },
      createdAt: now,
    }, rec as unknown as Record<string, unknown>));
  } catch { /* best-effort */ }

  return {
    relegateId: rec.relegateId,
    newTraineeId: newTraineeRef.id,
    newChestNo: newChest,
    toBatchNumber: destBatch.batchNumber,
    fromBatchNumber: rec.fromBatchNumber,
    traineeName: rec.traineeName,
  };
}

export async function cancelRelegation(
  relegationDocId: string,
  actor: { uid: string; name: string },
  reason: string,
): Promise<void> {
  const relRef = doc(db, COLLECTION, relegationDocId);
  const snap = await getDoc(relRef);
  if (!snap.exists()) throw new Error('Relegation record nahi mila.');
  const rec = snap.data() as RelegationRecord;
  if (rec.status !== 'awaiting_rejoin') {
    throw new Error('Sirf awaiting RelID cancel ho sakta hai.');
  }

  const now = todayISO();
  const batch = writeBatch(db);
  batch.update(relRef, {
    status: 'cancelled',
    cancelledAt: now,
    cancelledBy: actor.uid,
    cancelReason: reason || '',
  });

  const oldRef = doc(db, 'trainees', rec.fromTraineeId);
  const oldSnap = await getDoc(oldRef);
  if (oldSnap.exists()) {
    batch.update(oldRef, {
      trainingStatus: 'active',
      isActiveInBatch: true,
      attn: 'P',
      cancelledRelegateId: rec.relegateId,
      relegateId: '',
      updatedAt: now,
    });
    if (rec.fromBatchId) {
      batch.update(doc(db, 'batches', rec.fromBatchId), {
        totalTrainees: increment(1),
      });
    }
  }
  await batch.commit();
}

export { isOnStrength };
