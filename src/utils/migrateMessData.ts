// D:\ALL PROJECTS\BSF COYs\frontend\src\utils\migrateMessData.ts

import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export const migrateMessDataToRecoveries = async () => {
  console.log('Migration starting...');
  
  const traineesSnap = await getDocs(collection(db, 'trainees'));
  let migrated = 0;
  let skipped = 0;

  // Existing recoveries check karo - duplicate na bane
  const recSnap = await getDocs(collection(db, 'recoveries'));
  const existingKeys = new Set<string>();
  recSnap.forEach(d => {
    const data = d.data();
    // Key = chestNo + type + month
    existingKeys.add(`${data.chestNo}_${data.recoveryType}_${data.month ?? ''}`);
  });

  const currentMonth = new Date().toISOString().slice(0, 7); // "2025-01"

  for (const traineeDoc of traineesSnap.docs) {
    const data = traineeDoc.data();
    
    // Sirf wahi trainees jinka messBill ya messPaid set hai
    if (!data.messBill && !data.messPaid) {
      skipped++;
      continue;
    }

    const expected = Number(data.messBill ?? 4650);
    const paid     = Number(data.messPaid ?? 0);
    const due      = Math.max(0, expected - paid);
    const status   = due <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Pending';

    const key = `${data.chestNo}_Mess Cutting_${currentMonth}`;
    
    if (existingKeys.has(key)) {
      console.log(`Skipping duplicate: ${data.chestNo}`);
      skipped++;
      continue;
    }

    await addDoc(collection(db, 'recoveries'), {
      traineeId:      traineeDoc.id,
      traineeName:    data.name ?? '',
      chestNo:        data.chestNo ?? '',
      recoveryType:   'Mess Cutting',
      expectedAmount: expected,
      paidAmount:     paid,
      dueAmount:      due,
      status,
      month:          currentMonth,
      remarks:        'Migrated from MessRecovery',
      createdAt:      serverTimestamp(),
    });

    migrated++;
    existingKeys.add(key); // future duplicate prevention
  }

  console.log(`Migration done: ${migrated} migrated, ${skipped} skipped`);
  return { migrated, skipped };
};