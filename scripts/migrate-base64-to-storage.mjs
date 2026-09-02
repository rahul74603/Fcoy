#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// MIGRATION SCRIPT — Base64 Firestore → Firebase Storage
// ───────────────────────────────────────────────────────────
// Ye script existing base64 data ko Firebase Storage mein move karta hai.
//
// ⚠️  SAFETY:
//   - READ-ONLY first: `node scripts/migrate-base64-to-storage.mjs --dry-run`
//   - Actual migration: `node scripts/migrate-base64-to-storage.mjs --execute`
//   - Rollback: base64 fields are PRESERVED until you manually remove them
//   - Script uses Admin SDK (server-side), bypasses security rules
//
// USAGE:
//   node scripts/migrate-base64-to-storage.mjs --dry-run    # Preview only
//   node scripts/migrate-base64-to-storage.mjs --execute    # Actually migrate
//   node scripts/migrate-base64-to-storage.mjs --execute --photos-only
//   node scripts/migrate-base64-to-storage.mjs --execute --bills-only
// ═══════════════════════════════════════════════════════════

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// ── Parse CLI args ──
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const EXECUTE = args.includes('--execute');
const PHOTOS_ONLY = args.includes('--photos-only');
const BILLS_ONLY = args.includes('--bills-only');

if (!DRY_RUN && !EXECUTE) {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  BASE64 → FIREBASE STORAGE MIGRATION                    ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Usage:                                                  ║
║    --dry-run    Preview what would be migrated            ║
║    --execute    Actually perform migration                ║
║                                                          ║
║  Optional filters:                                       ║
║    --photos-only   Only migrate trainee photos            ║
║    --bills-only    Only migrate finance bills             ║
║                                                          ║
║  Example:                                                ║
║    node scripts/migrate-base64-to-storage.mjs --dry-run  ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
  process.exit(0);
}

// ── Initialize Firebase Admin ──
const PROJECT_ID = 'training-command-erp';

try {
  initializeApp({
    projectId: PROJECT_ID,
    credential: applicationDefault(),
  });
} catch (e) {
  // Already initialized
}

const db = getFirestore();
const bucket = getStorage().bucket();

console.log(`\n🔧 Project: ${PROJECT_ID}`);
console.log(`🔧 Mode: ${DRY_RUN ? 'DRY RUN (preview only)' : 'EXECUTE (will migrate)'}`);
console.log(`🔧 Filter: ${PHOTOS_ONLY ? 'photos only' : BILLS_ONLY ? 'bills only' : 'all'}\n`);

// ── Stats ──
const stats = {
  photosScanned: 0,
  photosMigrated: 0,
  photosSkipped: 0,
  photosErrors: 0,
  billsScanned: 0,
  billsMigrated: 0,
  billsSkipped: 0,
  billsErrors: 0,
};

// ── Helper: Upload base64 to Storage ──
async function uploadBase64ToStorage(base64Data, storagePath, contentType) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would upload: ${storagePath}`);
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  }

  // Extract raw base64 (remove data:image/...;base64, prefix)
  let rawBase64 = base64Data;
  let detectedType = contentType;
  if (base64Data.startsWith('data:')) {
    const parts = base64Data.split(',');
    rawBase64 = parts[1];
    const mimeMatch = parts[0].match(/data:([^;]+)/);
    if (mimeMatch) detectedType = mimeMatch[1];
  }

  const buffer = Buffer.from(rawBase64, 'base64');
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: {
      contentType: detectedType || 'image/jpeg',
      metadata: {
        migratedFrom: 'firestore-base64',
        migratedAt: new Date().toISOString(),
      },
    },
  });

  // Get download URL
  await file.makePublic();
  const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  return downloadUrl;
}

// ═══════════════════════════════════════════════════════════
// MIGRATE TRAINEE PHOTOS
// ═══════════════════════════════════════════════════════════
async function migratePhotos() {
  if (BILLS_ONLY) return;

  console.log('\n📸 MIGRATING TRAINEE PHOTOS...\n');

  const snapshot = await db.collection('trainees').get();
  console.log(`  Found ${snapshot.size} trainees\n`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const photoURL = data.photoURL;

    if (!photoURL || typeof photoURL !== 'string' || !photoURL.startsWith('data:')) {
      stats.photosScanned++;
      continue; // No base64 photo
    }

    stats.photosScanned++;
    const regNo = data.regNo || doc.id;
    const storagePath = `trainees/${regNo}/profile/migrated_${Date.now()}.jpg`;

    console.log(`  [${stats.photosScanned}] Trainee: ${data.name || 'Unknown'} (Reg: ${regNo})`);
    console.log(`      Base64 size: ~${Math.round(photoURL.length * 3 / 4 / 1024)}KB`);
    console.log(`      Storage path: ${storagePath}`);

    try {
      const downloadUrl = await uploadBase64ToStorage(photoURL, storagePath, 'image/jpeg');

      if (!DRY_RUN) {
        await doc.ref.update({
          photoURL: downloadUrl,
          photoPath: storagePath,
          photoMigratedAt: new Date().toISOString(),
          // Keep old base64 as backup (remove later)
          photoURL_base64_backup: photoURL,
        });
      }

      stats.photosMigrated++;
      console.log(`      ✅ Migrated`);
    } catch (err) {
      stats.photosErrors++;
      console.error(`      ❌ Error: ${err.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// MIGRATE FINANCE BILLS
// ═══════════════════════════════════════════════════════════
const BILL_COLLECTIONS = [
  { name: 'mess_fund_expenses', category: 'mess_fund' },
  { name: 'training_fund_expenses', category: 'training_fund' },
  { name: 'general_fund_expenses', category: 'general_fund' },
  { name: 'company_assets_expenses', category: 'company_assets' },
];

async function migrateBills() {
  if (PHOTOS_ONLY) return;

  console.log('\n🧾 MIGRATING FINANCE BILLS...\n');

  for (const col of BILL_COLLECTIONS) {
    console.log(`\n  📂 Collection: ${col.name}`);
    const snapshot = await db.collection(col.name).get();
    console.log(`     Found ${snapshot.size} documents\n`);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const billBase64 = data.billBase64;

      if (!billBase64 || typeof billBase64 !== 'string' || !billBase64.startsWith('data:')) {
        stats.billsScanned++;
        continue; // No base64 bill
      }

      stats.billsScanned++;
      const storagePath = `bills/${col.category}/${doc.id}/migrated_${Date.now()}_${data.billFileName || 'bill.jpg'}`;

      console.log(`  [${stats.billsScanned}] ${col.name}/${doc.id}`);
      console.log(`      Item: ${data.itemName || data.label || 'Unknown'}`);
      console.log(`      Base64 size: ~${Math.round(billBase64.length * 3 / 4 / 1024)}KB`);
      console.log(`      Storage path: ${storagePath}`);

      try {
        const downloadUrl = await uploadBase64ToStorage(
          billBase64,
          storagePath,
          data.billFileType || 'image/jpeg'
        );

        if (!DRY_RUN) {
          await doc.ref.update({
            billDownloadUrl: downloadUrl,
            billStoragePath: storagePath,
            billMigratedAt: new Date().toISOString(),
            // Keep old base64 as backup (remove later)
            billBase64_backup: billBase64,
            // Remove old base64 field
            billBase64: null,
          });
        }

        stats.billsMigrated++;
        console.log(`      ✅ Migrated`);
      } catch (err) {
        stats.billsErrors++;
        console.error(`      ❌ Error: ${err.message}`);
      }
    }
  }

  // ── Vendor bills (nested array) ──
  console.log('\n  📂 Collection: vendor_entries (nested bills array)');
  const vendorSnap = await db.collection('vendor_entries').get();
  console.log(`     Found ${vendorSnap.size} documents\n`);

  for (const doc of vendorSnap.docs) {
    const data = doc.data();
    const bills = data.bills || [];

    if (!Array.isArray(bills) || bills.length === 0) {
      continue;
    }

    let anyMigrated = false;
    const updatedBills = [];

    for (const bill of bills) {
      if (!bill.base64 || typeof bill.base64 !== 'string' || !bill.base64.startsWith('data:')) {
        updatedBills.push(bill);
        continue;
      }

      stats.billsScanned++;
      const storagePath = `bills/vendors/${doc.id}/migrated_${Date.now()}_${bill.fileName || 'bill.jpg'}`;

      console.log(`  [${stats.billsScanned}] vendor_entries/${doc.id} — bill: ${bill.fileName || 'unknown'}`);
      console.log(`      Base64 size: ~${Math.round(bill.base64.length * 3 / 4 / 1024)}KB`);

      try {
        const downloadUrl = await uploadBase64ToStorage(
          bill.base64,
          storagePath,
          bill.fileType || 'image/jpeg'
        );

        updatedBills.push({
          ...bill,
          downloadUrl,
          storagePath,
          base64_backup: bill.base64,
          base64: null, // Remove base64
        });

        anyMigrated = true;
        stats.billsMigrated++;
        console.log(`      ✅ Migrated`);
      } catch (err) {
        stats.billsErrors++;
        console.error(`      ❌ Error: ${err.message}`);
        updatedBills.push(bill); // Keep original on error
      }
    }

    if (anyMigrated && !DRY_RUN) {
      await doc.ref.update({
        bills: updatedBills,
        billsMigratedAt: new Date().toISOString(),
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
async function main() {
  const startTime = Date.now();

  try {
    await migratePhotos();
    await migrateBills();
  } catch (err) {
    console.error('\n❌ FATAL ERROR:', err);
    process.exit(1);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);

  console.log('\n' + '═'.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes made)' : 'EXECUTE'}`);
  console.log(`Time: ${elapsed}s`);
  console.log('');
  console.log('PHOTOS:');
  console.log(`  Scanned:  ${stats.photosScanned}`);
  console.log(`  Migrated: ${stats.photosMigrated}`);
  console.log(`  Skipped:  ${stats.photosSkipped}`);
  console.log(`  Errors:   ${stats.photosErrors}`);
  console.log('');
  console.log('BILLS:');
  console.log(`  Scanned:  ${stats.billsScanned}`);
  console.log(`  Migrated: ${stats.billsMigrated}`);
  console.log(`  Skipped:  ${stats.billsSkipped}`);
  console.log(`  Errors:   ${stats.billsErrors}`);
  console.log('═'.repeat(60));

  if (DRY_RUN) {
    console.log('\n💡 To actually migrate, run:');
    console.log('   node scripts/migrate-base64-to-storage.mjs --execute');
  } else {
    console.log('\n✅ Migration complete!');
    console.log('⚠️  Old base64 data is preserved as *_backup fields.');
    console.log('   After verification, run cleanup to remove backup fields.');
  }
}

main();
