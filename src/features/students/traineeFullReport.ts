// src/features/students/traineeFullReport.ts
// ═══════════════════════════════════════════════════════════
// 📄 TRAINEE FULL REPORT (DOSSIER) — ek trainee ki POORI kahani
//
// Personal detail + har event ka record ek hi printable report me:
//   1. Personal / Identity / Address / Education
//   2. Training info (batch, chest, platoon, medical status)
//   3. Kit Issue history      (issue_records + issuedKitItems)
//   4. Medical history        (medicalRecords)
//   5. Absent / Leave history (absentRecords)
//   6. FPT results            (fptRecords)
//   7. Weekly test results    (weeklyTestRecords)
//   8. Recovery / dues        (training_fund_recoveries)
//   9. Documents status       (trainee.documents)
//
// Sab EXISTING collections se — batch + trainee scoped queries.
// Print dialog → "Save as PDF" se PDF ban jata hai.
// ═══════════════════════════════════════════════════════════

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface AnyDoc { id: string; [key: string]: any; }

const fetchWhere = async (col: string, field: string, value: string): Promise<AnyDoc[]> => {
  try {
    const snap = await getDocs(query(collection(db, col), where(field, '==', value)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return []; // collection/permission na ho to section khali dikhega
  }
};

const esc = (v: unknown): string =>
  String(v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) :
    d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const kvGrid = (pairs: [string, unknown][]): string =>
  `<div class="kv">${pairs.map(([k, v]) =>
    `<div class="kvi"><span class="k">${esc(k)}</span><span class="v">${esc(v || '—')}</span></div>`).join('')}</div>`;

const table = (headers: string[], rows: string[][], emptyMsg: string): string =>
  rows.length === 0
    ? `<p class="empty">${esc(emptyMsg)}</p>`
    : `<table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
       <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

export interface FullReportMeta {
  unitLine: string;   // e.g. "F COY — BSF TRAINING CENTER"
  preparedBy: string; // logged-in user
}

/**
 * Trainee ka FULL dossier print window me kholta hai.
 * t = poora trainee object (Profile/List screen ke paas already hota hai)
 */
export const printTraineeFullReport = async (
  t: AnyDoc,
  meta: FullReportMeta,
): Promise<void> => {
  // ── Saare event records parallel fetch (trainee-scoped) ──
  const [issues, medical, absents, fpts, weeklyTests, recoveries] = await Promise.all([
    fetchWhere('issue_records', 'traineeId', t.id),
    fetchWhere('medicalRecords', 'traineeId', t.id),
    fetchWhere('absentRecords', 'traineeId', t.id),
    fetchWhere('fptRecords', 'traineeId', t.id),
    fetchWhere('weeklyTestRecords', 'traineeId', t.id),
    fetchWhere('training_fund_recoveries', 'traineeId', t.id),
  ]);

  const byDateDesc = (field: string) => (a: AnyDoc, b: AnyDoc) =>
    String(b[field] ?? '').localeCompare(String(a[field] ?? ''));

  issues.sort(byDateDesc('issueDateISO'));
  medical.sort(byDateDesc('date'));
  absents.sort(byDateDesc('fromDate'));
  fpts.sort(byDateDesc('date'));
  weeklyTests.sort(byDateDesc('date'));

  // ── Kit items — issue_records + trainee.issuedKitItems dono cover ──
  const kitRows: string[][] = [];
  issues.forEach(rec => {
    (rec.issuedItems ?? []).forEach((it: AnyDoc) => {
      kitRows.push([
        fmtDate(it.issueDate || rec.issueDateISO),
        esc(it.itemName),
        esc(it.assignedSize || '—'),
        String(it.quantity ?? 1),
        esc(rec.issuedBy || it.issuedBy || '—'),
      ]);
    });
  });
  if (kitRows.length === 0) {
    (t.issuedKitItems ?? []).forEach((it: AnyDoc) => {
      kitRows.push([fmtDate(it.issueDate), esc(it.itemName), esc(it.assignedSize || '—'), String(it.quantity ?? 1), esc(it.issuedBy || '—')]);
    });
  }

  // ── Documents status ──
  const docRows: string[][] = Object.entries((t.documents ?? {}) as Record<string, AnyDoc>)
    .map(([key, d]) => [
      esc(key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())),
      d?.isRequired === false ? 'Optional' : 'Required',
      `<b>${esc(d?.status || 'Pending')}</b>`,
      String((d?.files ?? []).length),
      esc(d?.verifiedBy || d?.rejectedBy || '—'),
    ]);

  const now = new Date();
  const chest = String(t.chestNo ?? '').trim();

  const html = `<!DOCTYPE html><html><head><title>Trainee Dossier — ${esc(t.name)}</title>
<style>
  @page { margin: 10mm; size: A4; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10.5px; color: #111; margin: 0; }
  .head { text-align:center; border-bottom:3px double #1f2937; padding-bottom:8px; margin-bottom:10px; }
  .head h1 { font-size:15px; margin:0; letter-spacing:3px; text-transform:uppercase; }
  .head h2 { font-size:12px; margin:3px 0 0; color:#374151; }
  .head .sub { font-size:9px; color:#6b7280; margin-top:3px; }
  .idcard { display:flex; gap:12px; border:1.5px solid #1f2937; padding:10px; margin-bottom:10px; align-items:flex-start; }
  .photo { width:86px; height:106px; border:1px solid #9ca3af; object-fit:cover; object-position:top; flex-shrink:0; background:#f3f4f6; }
  .nophoto { width:86px; height:106px; border:1px dashed #9ca3af; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-size:8px; flex-shrink:0; }
  .idmain { flex:1; }
  .idmain .nm { font-size:15px; font-weight:900; text-transform:uppercase; }
  .idmain .rk { font-size:9px; color:#6b7280; text-transform:uppercase; margin-bottom:5px; }
  .badges span { display:inline-block; border:1px solid #1f2937; padding:2px 8px; font-weight:900; font-size:10px; margin-right:5px; margin-bottom:3px; }
  .badges .pend { border-color:#b45309; color:#b45309; }
  h3.sec { background:#1f2937; color:#fff; font-size:10px; text-transform:uppercase; letter-spacing:2px; padding:4px 8px; margin:12px 0 6px; page-break-after:avoid; }
  .kv { display:grid; grid-template-columns:repeat(3, 1fr); gap:0; border:1px solid #d1d5db; }
  .kvi { border:0.5px solid #e5e7eb; padding:4px 7px; }
  .kvi .k { display:block; font-size:8px; color:#6b7280; text-transform:uppercase; font-weight:700; }
  .kvi .v { display:block; font-size:10.5px; font-weight:700; margin-top:1px; }
  table { width:100%; border-collapse:collapse; margin-top:2px; }
  th { background:#374151; color:#fff; font-size:8.5px; text-transform:uppercase; padding:4px 6px; text-align:left; }
  td { border-bottom:1px solid #e5e7eb; padding:3.5px 6px; font-size:9.5px; }
  tr:nth-child(even) td { background:#f9fafb; }
  .empty { font-size:9.5px; color:#6b7280; font-style:italic; margin:4px 0 8px; padding:5px 8px; background:#f9fafb; border:1px dashed #d1d5db; }
  .stamp { margin-top:26px; display:flex; justify-content:space-between; padding:0 22px; page-break-inside:avoid; }
  .stamp div { text-align:center; width:170px; }
  .stamp .line { border-top:1.4px solid #1f2937; margin-top:38px; padding-top:4px; font-size:9px; font-weight:900; text-transform:uppercase; }
  .foot { margin-top:14px; text-align:center; font-size:8px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:5px; }
  @media print { .noprint { display:none; } }
</style></head><body>

<div class="head">
  <h1>${esc(meta.unitLine)}</h1>
  <h2>TRAINEE COMPLETE DOSSIER / व्यक्तिगत पूर्ण विवरण</h2>
  <div class="sub">CONFIDENTIAL · For Official Use Only · Generated: ${now.toLocaleString('en-IN')}</div>
</div>

<div class="idcard">
  ${t.photoURL ? `<img class="photo" src="${esc(t.photoURL)}" />` : `<div class="nophoto">NO PHOTO</div>`}
  <div class="idmain">
    <div class="nm">${esc(t.rank || 'RCT')} ${esc(t.name)}</div>
    <div class="rk">S/O ${esc(t.fatherName)} · Batch ${esc(t.batchNumber)} (${esc(t.batchName)})</div>
    <div class="badges">
      ${chest ? `<span># CHEST ${esc(chest)}</span>` : `<span class="pend">CHEST PENDING</span>`}
      <span>REG ${esc(t.regNo)}</span>
      <span>${esc(t.platoon || '—')}</span>
      <span>${esc(t.medStat || 'SHAPE-1')}</span>
    </div>
  </div>
</div>

<h3 class="sec">1 · Personal Details / व्यक्तिगत विवरण</h3>
${kvGrid([
  ['Full Name', t.name], ['Father Name', t.fatherName], ['Mother Name', t.motherName],
  ['Date of Birth', fmtDate(t.dob)], ['Age', t.age ? `${t.age} Years` : '—'], ['Gender', t.gender],
  ['Blood Group', t.bloodGroup], ['Religion', t.religion], ['Category', t.category],
  ['Marital Status', t.maritalStatus], ['Mobile No', t.mobileNo], ['Emergency Contact', t.emergencyContact ? `${t.emergencyContactName || ''} ${t.emergencyContact} (${t.relationship || '—'})` : '—'],
])}

<h3 class="sec">2 · Identity &amp; Address / पहचान एवं पता</h3>
${kvGrid([
  ['Aadhaar No', t.aadharNo], ['PAN No', t.panNo], ['Registration No', t.regNo],
  ['Village', t.village], ['Tehsil', t.tehsil], ['District', t.district],
  ['State', t.state], ['PIN Code', t.pinCode], ['Education', t.education],
  ['Board/University', t.boardUniversity], ['Passing Year', t.passingYear], ['Percentage', t.percentage ? `${t.percentage}%` : '—'],
])}

<h3 class="sec">3 · Training Information / प्रशिक्षण विवरण</h3>
${kvGrid([
  ['Batch', `${t.batchNumber || '—'} — ${t.batchName || ''}`], ['Chest No', chest || 'PENDING'], ['Chest Assigned', t.chestAssignedAt ? `${fmtDate(t.chestAssignedAt)} (${t.chestAssignedBy || '—'})` : '—'],
  ['Platoon', t.platoon], ['Section', t.section], ['Join Date', fmtDate(t.joinDate)],
  ['Height', t.height ? `${t.height} cm` : '—'], ['Weight', t.weight ? `${t.weight} kg` : '—'], ['Chest (cm)', t.chest],
  ['Medical Status', t.medStat], ['Attendance Now', t.attn || 'P'], ['Weapon No', t.weaponNo],
  ['FPT Result', t.fptResult ? `${t.fptResult} (${t.fptScore || '—'})` : '—'], ['Weekly Exam', t.weeklyExamResult ? `${t.weeklyExamResult} (${t.weeklyExamMarks || '—'})` : '—'], ['Punishments', t.punishments],
])}

<h3 class="sec">4 · Kit Issue History / किट वितरण (${kitRows.length})</h3>
${table(['Date', 'Item', 'Size', 'Qty', 'Issued By'], kitRows, 'Koi kit issue record nahi.')}

<h3 class="sec">5 · Medical History / चिकित्सा इतिहास (${medical.length})</h3>
${table(['Date', 'Category', 'Diagnosis', 'Ward/Days', 'Status'],
  medical.map(m => [
    fmtDate(m.date), esc(m.category), esc(m.diagnosis),
    esc([m.wardNo, m.recommendedDays ? `${m.recommendedDays} din` : ''].filter(Boolean).join(' · ') || '—'),
    `<b>${esc(m.status)}</b>`,
  ]), 'Koi medical record nahi — fit hai.')}

<h3 class="sec">6 · Absent / Leave History / अनुपस्थिति (${absents.length})</h3>
${table(['From', 'To', 'Type', 'Reason', 'Days', 'Status'],
  absents.map(a => [
    fmtDate(a.fromDate), fmtDate(a.toDate), esc(a.type), esc(a.reason),
    String(a.totalDays ?? '—'), `<b>${esc(a.status)}</b>`,
  ]), 'Koi absent/leave record nahi — poora present.')}

<h3 class="sec">7 · FPT Results / शारीरिक दक्षता (${fpts.length})</h3>
${table(['Date', 'Test', 'Score/Marks', 'Result'],
  fpts.map(f => [
    fmtDate(f.date || f.testDate), esc(f.testName || 'FPT'),
    esc(f.score ?? f.marks ?? '—'), `<b>${esc(f.result || f.status || '—')}</b>`,
  ]), 'Koi FPT record nahi.')}

<h3 class="sec">8 · Weekly Test Results / साप्ताहिक परीक्षा (${weeklyTests.length})</h3>
${table(['Date', 'Test', 'Marks', 'Result'],
  weeklyTests.map(w => [
    fmtDate(w.date || w.testDate), esc(w.testName || 'Weekly Test'),
    esc(w.marks ?? w.score ?? '—'), `<b>${esc(w.result || w.status || '—')}</b>`,
  ]), 'Koi weekly test record nahi.')}

<h3 class="sec">9 · Recovery / Dues / वसूली (${recoveries.length})</h3>
${table(['Item/Reason', 'Total', 'Paid', 'Due', 'Status'],
  recoveries.map(r => [
    esc(r.itemName || r.reason || r.label || '—'),
    `₹${Number(r.totalAmount ?? r.amount ?? 0).toLocaleString('en-IN')}`,
    `₹${Number(r.paidAmount ?? 0).toLocaleString('en-IN')}`,
    `₹${Number(r.dueAmount ?? 0).toLocaleString('en-IN')}`,
    `<b>${esc(r.status)}</b>`,
  ]), 'Koi recovery/due nahi — sab clear.')}

<h3 class="sec">10 · Documents Status / दस्तावेज़ (${docRows.length})</h3>
${table(['Document', 'Type', 'Status', 'Files', 'Verified/Rejected By'], docRows, 'Documents module me abhi kuch upload nahi hua.')}

<div class="stamp">
  <div><div class="line">Prepared By<br/>${esc(meta.preparedBy)}</div></div>
  <div><div class="line">Checked By</div></div>
  <div><div class="line">Approved By (CC)</div></div>
</div>
<div class="foot">System-generated dossier · ${esc(meta.unitLine)} · ${now.toLocaleString('en-IN')} · Page prints on A4</div>
<script>window.onload = () => { window.print(); };</script>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
};
