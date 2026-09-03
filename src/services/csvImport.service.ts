// ═══════════════════════════════════════════════════════════
// CSV IMPORT — Excel/CSV se data import karo
// ───────────────────────────────────────────────────────────
// YE KYA KARTA HAI:
//   Excel mein banaye gaye CSV file se trainees ya expenses
//   ek saath import kar deta hai. Ek ek karke add nahi karna padta.
//
// FREE HAI?
//   ✅ Haan! Browser mein parse hota hai, Firestore mein save hota hai.
//
// KAISE USE KAREIN:
//   1. Excel mein data likho (headers pehle row mein)
//   2. File → Save As → CSV
//   3. Import button click karo
//   4. File select karo
//   5. Done! Sab data ek saath add ho jaayega
//
// CSV FORMAT (Trainees):
//   name,chestNo,regNo,platoon,rank,fatherName,state
//   Ramesh Kumar,1022,REG001,A,REC,Ram Singh,Madhya Pradesh
//   Suresh Singh,1023,REG001,B,REC,Hari Singh,UP
//
// CSV FORMAT (Expenses):
//   date,amount,category,remarks,vendor
//   2024-01-15,5000,Mess,Ration purchase,Ram Store
//   2024-01-16,2000,Training,Shoes purchase,Bata Shop
// ═══════════════════════════════════════════════════════════

import { collection, writeBatch, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

// Import ka result — kitne successful, kitne fail, kitne duplicate
export interface ImportResult {
  success: number;    // Kitne records add ho gaye
  failed: number;     // Kitne fail ho gaye
  errors: string[];   // Kya errors aaye
  duplicates: number; // Kitne pehle se the
}

/**
 * CSV file ko parse karo (padho).
 * File se headers aur rows nikalta hai.
 *
 * EXAMPLE:
 *   const file = event.target.files[0];  // User ne file select ki
 *   const { headers, rows } = await parseCSV(file);
 *   console.log(headers);  // ['name', 'chestNo', 'regNo', ...]
 *   console.log(rows);     // [{ name: 'Ramesh', chestNo: '1022', ... }, ...]
 */
export function parseCSV(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        reject(new Error('File khaali hai'));
        return;
      }

      // File ko lines mein todo
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        reject(new Error('CSV mein kam se kam ek header aur ek data row honi chahiye'));
        return;
      }

      // Pehle line se headers nikalo
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

      // Baaki lines se data nikalo
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = values[i] || '';
        });
        return row;
      });

      resolve({ headers, rows });
    };

    reader.onerror = () => reject(new Error('File padh nahi paya'));
    reader.readAsText(file);
  });
}

/**
 * Trainees ko CSV se import karo.
 *
 * STEPS:
 *   1. User CSV file select kare
 *   2. parseCSV() se file padho
 *   3. importTrainees() se Firestore mein save karo
 *
 * EXAMPLE:
 *   const { rows } = await parseCSV(selectedFile);
 *   const result = await importTrainees(rows, 'batch123', 'Batch 45');
 *   console.log(`${result.success} trainees add ho gaye!`);
 *   if (result.errors.length > 0) {
 *     console.log('Errors:', result.errors);
 *   }
 */
export async function importTrainees(
  rows: Record<string, string>[],
  batchId: string,
  batchNumber: string
): Promise<ImportResult> {
  const result: ImportResult = { success: 0, failed: 0, errors: [], duplicates: 0 };

  // Pehle check karo ki kaunse chest numbers pehle se hain
  const existingSnap = await getDocs(
    query(collection(db, 'trainees'), where('batchId', '==', batchId))
  );
  const existingChests = new Set(
    existingSnap.docs.map(d => d.data().chestNo?.toLowerCase())
  );

  // Firestore mein ek baar mein max 500 records likh sakte hain
  // Isliye batches mein todo
  let batch = writeBatch(db);
  let count = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Name nikalo (alag alag column names try karo)
    const name = row.name || row.Name || row['Trainee Name'] || '';
    const chestNo = row.chestNo || row['Chest No'] || row.chest_no || '';

    // Name zaroori hai
    if (!name.trim()) {
      result.errors.push(`Row ${i + 2}: Name nahi hai`);
      result.failed++;
      continue;
    }

    // Duplicate check
    if (chestNo && existingChests.has(chestNo.toLowerCase())) {
      result.duplicates++;
      result.errors.push(`Row ${i + 2}: Chest No ${chestNo} pehle se hai`);
      continue;
    }

    // Trainee data banao
    const traineeData = {
      name: name.trim(),
      chestNo: chestNo.trim(),
      regNo: row.regNo || row['Reg No'] || row.reg_no || '',
      platoon: row.platoon || row.Platoon || '',
      rank: row.rank || row.Rank || 'RCT',
      fatherName: row.fatherName || row['Father Name'] || row.father_name || '',
      state: row.state || row.State || '',
      district: row.district || row.District || '',
      religion: row.religion || row.Religion || '',
      language: row.language || row.Language || '',
      bloodGroup: row.bloodGroup || row['Blood Group'] || '',
      mobileNo: row.mobileNo || row.Mobile || '',
      batchId: batchId,
      batchNumber: batchNumber,
      attn: 'P',
      docsComplete: false,
      issuedKitItems: [],
      documents: {},
      fptResult: '',
      weeklyExamResult: '',
      sickReports: 0,
      createdAt: new Date().toISOString(),
    };

    // Batch mein add karo
    const ref = doc(collection(db, 'trainees'));
    batch.set(ref, traineeData);
    count++;

    // Agar 400 records ho gaye toh pehle ye save karo, phir naya batch shuru karo
    if (count >= 400) {
      try {
        await batch.commit();
      } catch (err: any) {
        result.errors.push(`Batch save nahi hua: ${err.message}`);
      }
      batch = writeBatch(db);
      count = 0;
    }

    // Chest number add karo taaki duplicate na aaye
    if (chestNo) existingChests.add(chestNo.toLowerCase());
    result.success++;
  }

  // Baaki bacha hua batch save karo
  if (count > 0) {
    try {
      await batch.commit();
    } catch (err: any) {
      result.errors.push(`Batch save nahi hua: ${err.message}`);
    }
  }

  return result;
}

/**
 * Expenses ko CSV se import karo.
 *
 * EXAMPLE:
 *   const { rows } = await parseCSV(selectedFile);
 *   const result = await importExpenses(rows, 'mess_fund_expenses');
 *   console.log(`${result.success} expenses add ho gaye!`);
 */
export async function importExpenses(
  rows: Record<string, string>[],
  fundCollection: string  // jaise 'mess_fund_expenses'
): Promise<ImportResult> {
  const result: ImportResult = { success: 0, failed: 0, errors: [], duplicates: 0 };

  let batch = writeBatch(db);
  let count = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const amount = parseFloat(row.amount || row.Amount || '0');

    // Amount zaroori hai
    if (!amount || amount <= 0) {
      result.errors.push(`Row ${i + 2}: Amount galat hai`);
      result.failed++;
      continue;
    }

    // Expense data banao
    const expenseData = {
      amount: amount,
      date: row.date || row.Date || new Date().toISOString().slice(0, 10),
      category: row.category || row.Category || '',
      categoryLabel: row.categoryLabel || row['Category Label'] || row.category || '',
      remarks: row.remarks || row.Remarks || '',
      vendor: row.vendor || row.Vendor || '',
      billStatus: 'Pending',
      createdAt: new Date().toISOString(),
    };

    const ref = doc(collection(db, fundCollection));
    batch.set(ref, expenseData);
    count++;

    if (count >= 400) {
      try {
        await batch.commit();
      } catch (err: any) {
        result.errors.push(`Batch save nahi hua: ${err.message}`);
      }
      batch = writeBatch(db);
      count = 0;
    }

    result.success++;
  }

  if (count > 0) {
    try {
      await batch.commit();
    } catch (err: any) {
      result.errors.push(`Batch save nahi hua: ${err.message}`);
    }
  }

  return result;
}
