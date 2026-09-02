// ═══════════════════════════════════════════════════════════
// AUTOMATIC BACKUP SYSTEM — Firestore → Storage
// ───────────────────────────────────────────────────────────
// BATCH LIFECYCLE BACKUP:
//   1. Batch Create → Backup Start (batch data + trainees)
//   2. Daily 2 AM → Backup all active batches
//   3. Batch Close → Final Backup + mark complete
//   4. New Batch → New backup cycle starts
//
// BSF ka data permanent hai — backup KABHI delete nahi hota
// ═══════════════════════════════════════════════════════════

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as logger from 'firebase-functions/logger';

// ── Collections to backup per batch ──
const BATCH_COLLECTIONS = [
  'trainees',
  'absentRecords',
  'medicalRecords',
  'fptRecords',
  'weeklyTestRecords',
  'issue_records',
  'inspections',
  'findings',
];

// ── Global collections (not batch-specific) ──
const GLOBAL_COLLECTIONS = [
  'staff',
  'staff_attendance',
  'staff_leave',
  'staff_duty',
  'staff_subjects',
  'deputation_records',
  'training_schedule',
  'weeklyPrograms',
  'vendors',
  'vendor_entries',
  'vendor_payments',
  'mess_fund_expenses',
  'training_fund_expenses',
  'general_fund_expenses',
  'company_assets_expenses',
  'mess_fund_collections',
  'training_fund_collections',
  'general_fund_collections',
  'company_assets_collections',
  'users',
  'unitConfig',
  'subscription',
  'batches',
];

// ═══════════════════════════════════════════════════════════
// 1) BATCH CREATE → START BACKUP
// ═══════════════════════════════════════════════════════════
export const onBatchCreated = onDocumentWritten(
  'batches/{batchId}',
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();

    // Only trigger on new batch or status change to 'active'
    if (!after) return;
    if (before && before.status === after.status) return; // No status change
    if (after.status !== 'active') return; // Only active batches

    const batchId = event.params.batchId;
    const batchNumber = after.batchNumber || batchId;
    const batchName = after.batchName || '';

    logger.info(`Batch activated: ${batchNumber} (${batchName}) — Starting backup`);

    try {
      await backupBatch(batchId, batchNumber, 'batch_start');
      logger.info(`Batch backup started: ${batchNumber}`);
    } catch (err) {
      logger.error(`Batch backup failed: ${batchNumber}`, { error: String(err) });
    }
  }
);

// ═══════════════════════════════════════════════════════════
// 2) BATCH CLOSE → FINAL BACKUP
// ═══════════════════════════════════════════════════════════
export const onBatchClosed = onDocumentWritten(
  'batches/{batchId}',
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();

    // Only trigger on status change to 'completed'
    if (!after) return;
    if (!before || before.status === after.status) return;
    if (after.status !== 'completed') return;

    const batchId = event.params.batchId;
    const batchNumber = after.batchNumber || batchId;
    const batchName = after.batchName || '';

    logger.info(`Batch completed: ${batchNumber} (${batchName}) — Final backup`);

    try {
      await backupBatch(batchId, batchNumber, 'batch_final');
      logger.info(`Batch final backup done: ${batchNumber}`);
    } catch (err) {
      logger.error(`Batch final backup failed: ${batchNumber}`, { error: String(err) });
    }
  }
);

// ═══════════════════════════════════════════════════════════
// 3) DAILY BACKUP — ALL ACTIVE BATCHES + GLOBAL DATA
// ═══════════════════════════════════════════════════════════
export const scheduledBackup = onSchedule(
  {
    schedule: '0 2 * * *', // 2 AM daily
    timeZone: 'Asia/Kolkata',
    timeoutSeconds: 540,   // 9 minutes max
    memory: '1GiB',
  },
  async (event) => {
    const db = getFirestore();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    logger.info(`Daily backup started: ${timestamp}`);

    // 1. Backup all active batches
    try {
      const batchesSnap = await db.collection('batches')
        .where('status', '==', 'active')
        .get();

      logger.info(`Found ${batchesSnap.size} active batches`);

      for (const batchDoc of batchesSnap.docs) {
        const batchData = batchDoc.data();
        const batchId = batchDoc.id;
        const batchNumber = batchData.batchNumber || batchId;

        await backupBatch(batchId, batchNumber, 'daily');
      }
    } catch (err) {
      logger.error('Batch backup failed', { error: String(err) });
    }

    // 2. Backup global collections
    await backupGlobalCollections(timestamp);

    logger.info('Daily backup complete');
  }
);

// ═══════════════════════════════════════════════════════════
// HELPER: Backup a single batch
// ═══════════════════════════════════════════════════════════
async function backupBatch(batchId, batchNumber, trigger) {
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `backups/batches/${batchNumber}/${timestamp}_${trigger}`;

  logger.info(`Backing up batch ${batchNumber}: ${backupPath}`);

  let totalDocs = 0;

  for (const colName of BATCH_COLLECTIONS) {
    try {
      // Query only docs belonging to this batch
      const snapshot = await db.collection(colName)
        .where('batchId', '==', batchId)
        .get();

      if (snapshot.empty) continue;

      const docs = [];
      snapshot.forEach(doc => {
        docs.push({ id: doc.id, data: doc.data() });
      });

      const filePath = `${backupPath}/${colName}.json`;
      await bucket.file(filePath).save(JSON.stringify(docs, null, 2), {
        metadata: {
          contentType: 'application/json',
          metadata: {
            collection: colName,
            batchId,
            batchNumber,
            docCount: String(docs.length),
            trigger,
            permanent: 'true',
          },
        },
      });

      totalDocs += docs.length;
      logger.info(`  ${colName}: ${docs.length} docs`);
    } catch (err) {
      logger.error(`  ${colName}: FAILED`, { error: String(err) });
    }
  }

  // Save batch manifest
  const manifest = {
    batchId,
    batchNumber,
    trigger,
    timestamp,
    collections: BATCH_COLLECTIONS.length,
    totalDocs,
    permanent: true,
    note: `BSF Batch ${batchNumber} — ${trigger} backup`,
  };

  await bucket.file(`${backupPath}/manifest.json`).save(
    JSON.stringify(manifest, null, 2),
    { metadata: { contentType: 'application/json' } }
  );

  logger.info(`Batch ${batchNumber} backup: ${totalDocs} docs`);
}

// ═══════════════════════════════════════════════════════════
// HELPER: Backup global collections
// ═══════════════════════════════════════════════════════════
async function backupGlobalCollections(timestamp) {
  const db = getFirestore();
  const bucket = getStorage().bucket();
  const backupPath = `backups/global/${timestamp}`;

  logger.info(`Backing up global collections: ${backupPath}`);

  let totalDocs = 0;

  for (const colName of GLOBAL_COLLECTIONS) {
    try {
      const snapshot = await db.collection(colName).get();

      if (snapshot.empty) continue;

      const docs = [];
      snapshot.forEach(doc => {
        docs.push({ id: doc.id, data: doc.data() });
      });

      const filePath = `${backupPath}/${colName}.json`;
      await bucket.file(filePath).save(JSON.stringify(docs, null, 2), {
        metadata: {
          contentType: 'application/json',
          metadata: {
            collection: colName,
            docCount: String(docs.length),
            type: 'global',
            permanent: 'true',
          },
        },
      });

      totalDocs += docs.length;
      logger.info(`  ${colName}: ${docs.length} docs`);
    } catch (err) {
      logger.error(`  ${colName}: FAILED`, { error: String(err) });
    }
  }

  // Save global manifest
  const manifest = {
    type: 'global',
    timestamp,
    collections: GLOBAL_COLLECTIONS.length,
    totalDocs,
    permanent: true,
    note: 'BSF Training Command ERP — Global data backup',
  };

  await bucket.file(`${backupPath}/manifest.json`).save(
    JSON.stringify(manifest, null, 2),
    { metadata: { contentType: 'application/json' } }
  );

  logger.info(`Global backup: ${totalDocs} docs`);
}
