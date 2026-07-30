// ═══════════════════════════════════════════════════════════
// PRINT HELPERS — Government-grade Receipt / Voucher / Slip
// ───────────────────────────────────────────────────────────
// SHARED helper — Kit Issue Slip (M7) aur Fund Receipt/Voucher (M8)
// dono yahi use karte hain. New-window print approach hai isliye
// kisi bhi existing screen ke CSS pe ZERO impact.
// ═══════════════════════════════════════════════════════════

/** Number → words (Indian format) — govt receipts ke liye */
export const numberToWordsINR = (amount: number): string => {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x: number): string =>
    x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ' ' + ones[x % 10] : ''}`;
  const three = (x: number): string =>
    `${x >= 100 ? ones[Math.floor(x / 100)] + ' Hundred' : ''}${x % 100 ? (x >= 100 ? ' ' : '') + two(x % 100) : ''}`.trim();
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7), lakh = Math.floor((n % 1e7) / 1e5),
        thousand = Math.floor((n % 1e5) / 1e3), rest = n % 1e3;
  if (crore)    parts.push(`${three(crore)} Crore`);
  if (lakh)     parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rest)     parts.push(three(rest));
  return parts.join(' ');
};

const BASE_CSS = `
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color:#111; padding:24px; }
    .doc { max-width:720px; margin:0 auto; border:2px solid #1a2e14; padding:20px 24px; }
    .h-row { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1a2e14; padding-bottom:10px; }
    .unit { font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:1px; }
    .doc-type { font-size:16px; font-weight:900; text-transform:uppercase; background:#1a2e14; color:#fff; padding:4px 14px; }
    .meta { font-size:11px; margin-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:4px 20px; }
    .meta b { font-weight:800; }
    table { width:100%; border-collapse:collapse; margin-top:14px; font-size:12px; }
    th { background:#eef2e9; text-transform:uppercase; font-size:9px; letter-spacing:0.5px; }
    th, td { border:1px solid #888; padding:6px 8px; text-align:left; }
    .amt-row { margin-top:12px; font-size:12px; }
    .words { font-style:italic; font-size:11px; border:1px dashed #888; padding:6px 8px; margin-top:6px; }
    .sig { display:flex; justify-content:space-between; margin-top:64px; font-size:11px; font-weight:700; }
    .sig div { border-top:1px solid #111; padding-top:4px; width:30%; text-align:center; }
    .foot { margin-top:16px; font-size:9px; color:#555; text-align:center; border-top:1px solid #ccc; padding-top:6px; }
    @media print { body { padding:0; } }
  </style>
`;

/** Naye window mein formal document khol ke print dialog laga do */
export const printDocument = (title: string, bodyHtml: string): void => {
  const w = window.open('', '_blank', 'width=820,height=700');
  if (!w) {
    alert('Popup blocked! Browser mein popup allow karein phir retry karein.');
    return;
  }
  w.document.write(`<html><head><title>${title}</title>${BASE_CSS}</head><body>${bodyHtml}<script>window.onload=function(){window.print();}</script></body></html>`);
  w.document.close();
};

const fmtDateTime = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// ─────────────────────────────────────────────
// M7 — KIT ISSUE / RETURN SLIP
// ─────────────────────────────────────────────
export interface KitSlipItem {
  itemName: string;
  assignedSize?: string;
  quantity: number;
  unitPrice?: number;
}

export interface KitSlipData {
  kind: 'ISSUE' | 'RETURN';
  slipNo: string;
  dateISO: string;
  unitName: string;
  coyName: string;
  traineeName: string;
  chestNo?: string;
  platoon?: string;
  batchNumber?: string;
  items: KitSlipItem[];
  totalValue?: number;
  actionBy: string;
  condition?: string;
  reason?: string;
}

export const buildKitSlipHtml = (d: KitSlipData): string => {
  const isIssue = d.kind === 'ISSUE';
  const rows = d.items.map((it, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td><b>${it.itemName}</b></td>
      <td style="text-align:center">${it.assignedSize && it.assignedSize !== 'N/A' ? it.assignedSize : '—'}</td>
      <td style="text-align:center">${it.quantity}</td>
      ${isIssue ? `<td style="text-align:right">${it.unitPrice ? '₹' + (it.unitPrice * it.quantity).toLocaleString('en-IN') : '—'}</td>` : ''}
    </tr>`).join('');

  return `
  <div class="doc">
    <div class="h-row">
      <div>
        <div class="unit">${d.unitName}</div>
        <div style="font-size:11px;font-weight:700">${d.coyName}</div>
        <div style="font-size:10px;color:#444">Training Essentials Store</div>
      </div>
      <div class="doc-type">${isIssue ? 'KIT ISSUE SLIP' : 'KIT RETURN RECEIPT'}</div>
    </div>
    <div class="meta">
      <div><b>Slip No:</b> ${d.slipNo}</div>
      <div><b>Date &amp; Time:</b> ${fmtDateTime(d.dateISO)}</div>
      <div><b>Trainee:</b> ${d.traineeName}</div>
      <div><b>Chest No:</b> ${d.chestNo || '—'}</div>
      <div><b>Platoon:</b> ${d.platoon || '—'}</div>
      <div><b>Batch:</b> ${d.batchNumber || '—'}</div>
      ${!isIssue ? `<div><b>Condition:</b> ${d.condition || 'Good'}</div>` : ''}
      ${!isIssue && d.reason ? `<div><b>Reason:</b> ${d.reason}</div>` : ''}
    </div>
    <table>
      <thead><tr>
        <th style="width:36px">#</th><th>Item</th>
        <th style="width:70px;text-align:center">Size</th>
        <th style="width:60px;text-align:center">Qty</th>
        ${isIssue ? '<th style="width:90px;text-align:right">Value</th>' : ''}
      </tr></thead>
      <tbody>${rows}</tbody>
      ${isIssue && d.totalValue !== undefined ? `
      <tfoot><tr>
        <td colspan="${isIssue ? 4 : 3}" style="text-align:right;font-weight:800">TOTAL</td>
        <td style="text-align:right;font-weight:800">₹${d.totalValue.toLocaleString('en-IN')}</td>
      </tr></tfoot>` : ''}
    </table>
    ${isIssue && d.totalValue ? `<div class="words">Rupees: <b>${numberToWordsINR(d.totalValue)} Only</b></div>` : ''}
    <div class="sig">
      <div>Receiver's Signature<br/><span style="font-weight:400;font-size:9px">(Trainee)</span></div>
      <div>${isIssue ? 'Issued By' : 'Returned By'}<br/><span style="font-weight:400;font-size:9px">${d.actionBy}</span></div>
      <div>Quarter Master<br/><span style="font-weight:400;font-size:9px">(Store In-charge)</span></div>
    </div>
    <div class="foot">Ye ${isIssue ? 'issue slip' : 'return receipt'} computer-generated hai — F Coy ERP · ${fmtDateTime(d.dateISO)}</div>
  </div>`;
};

// ─────────────────────────────────────────────
// M9 — DAILY / MONTHLY MESS REPORT
// ─────────────────────────────────────────────
export interface MessReportData {
  periodLabel: string;          // "30 July 2026" ya "July 2026"
  unitName: string;
  coyName: string;
  generatedBy: string;
  totalCollection: number;
  totalExpense: number;
  totalPaid: number;
  totalDue: number;
  balance: number;
  traineeCount: number;
  collections: { date: string; label: string; amount: number }[];
  categoryWise: { category: string; amount: number; entries: number }[];
  topExpenses: { date: string; label: string; vendor: string; amount: number }[];
  vendorDues: { vendor: string; due: number }[];
}

export const buildMessReportHtml = (d: MessReportData): string => {
  const row = (cells: (string | number)[], bolds: boolean[] = []) =>
    `<tr>${cells.map((c, i) =>
      `<td style="${i === 0 ? 'text-align:center' : ''}${bolds[i] ? ';font-weight:800' : ''}">${c}</td>`
    ).join('')}</tr>`;

  const colRows = d.collections.length
    ? d.collections.map((c, i) => row([i + 1, c.date, c.label, `₹${c.amount.toLocaleString('en-IN')}`])).join('')
    : row(['—', '—', '(Koi collection nahi)', '—']);

  const catRows = d.categoryWise.length
    ? d.categoryWise.map((c, i) => row([i + 1, c.category, `${c.entries} entries`, `₹${c.amount.toLocaleString('en-IN')}`])).join('')
    : row(['—', '(Koi expense nahi)', '—', '—']);

  const expRows = d.topExpenses.length
    ? d.topExpenses.map((e, i) => row([i + 1, e.date, e.label, e.vendor || '—', `₹${e.amount.toLocaleString('en-IN')}`])).join('')
    : row(['—', '—', '(Koi expense nahi)', '—', '—']);

  const dueRows = d.vendorDues.length
    ? d.vendorDues.map((v, i) => row([i + 1, v.vendor, `₹${v.due.toLocaleString('en-IN')}`])).join('')
    : row(['—', '(Koi vendor due nahi)', '—']);

  return `
  <div class="doc">
    <div class="h-row">
      <div>
        <div class="unit">${d.unitName}</div>
        <div style="font-size:11px;font-weight:700">${d.coyName}</div>
        <div style="font-size:10px;color:#444">Mess Accounts — Kote / Langar</div>
      </div>
      <div class="doc-type">MESS REPORT</div>
    </div>

    <div class="meta">
      <div><b>Period:</b> ${d.periodLabel}</div>
      <div><b>Mess Strength:</b> ${d.traineeCount} trainees</div>
      <div><b>Total Collection (Aamdani):</b> ₹${d.totalCollection.toLocaleString('en-IN')}</div>
      <div><b>Total Expense (Kharcha):</b> ₹${d.totalExpense.toLocaleString('en-IN')}</div>
      <div><b>Paid:</b> ₹${d.totalPaid.toLocaleString('en-IN')}</div>
      <div><b>Due (Baaki):</b> ₹${d.totalDue.toLocaleString('en-IN')}</div>
      <div style="grid-column:1/3"><b>Balance:</b>
        <span style="font-size:14px;font-weight:900;color:${d.balance >= 0 ? '#166534' : '#b91c1c'}">
          ₹${Math.abs(d.balance).toLocaleString('en-IN')} ${d.balance < 0 ? '(GHATA / DEFICIT)' : '(BACHAT / SURPLUS)'}
        </span>
      </div>
    </div>
    <div class="words">Balance in words: <b>${numberToWordsINR(Math.abs(d.balance))} Only</b></div>

    <p style="margin-top:14px;font-size:11px;font-weight:800;text-transform:uppercase">Collections (Mess Cutting)</p>
    <table><thead><tr><th style="width:30px">#</th><th style="width:90px">Date</th><th>Particulars</th><th style="width:110px">Amount</th></tr></thead><tbody>${colRows}</tbody></table>

    <p style="margin-top:14px;font-size:11px;font-weight:800;text-transform:uppercase">Category-wise Kharcha</p>
    <table><thead><tr><th style="width:30px">#</th><th>Category</th><th style="width:90px">Entries</th><th style="width:110px">Total</th></tr></thead><tbody>${catRows}</tbody></table>

    <p style="margin-top:14px;font-size:11px;font-weight:800;text-transform:uppercase">Top Expenses (Period)</p>
    <table><thead><tr><th style="width:30px">#</th><th style="width:80px">Date</th><th>Item / Particulars</th><th style="width:110px">Vendor</th><th style="width:100px">Amount</th></tr></thead><tbody>${expRows}</tbody></table>

    <p style="margin-top:14px;font-size:11px;font-weight:800;text-transform:uppercase">Vendor Dues (Baaki Paisa)</p>
    <table><thead><tr><th style="width:30px">#</th><th>Vendor</th><th style="width:120px">Due Amount</th></tr></thead><tbody>${dueRows}</tbody></table>

    <div class="sig">
      <div>Mess Havildar / In-charge</div>
      <div>Prepared By<br/><span style="font-weight:400;font-size:9px">${d.generatedBy}</span></div>
      <div>Company Commander</div>
    </div>
    <div class="foot">Ye computer-generated mess report hai — F Coy ERP · ${d.periodLabel}</div>
  </div>`;
};
export interface FundVoucherData {
  type: 'collection' | 'expense' | 'vendor_payment' | 'salary' | 'transfer';
  voucherNo: string;
  date: string;
  fundLabel: string;
  label: string;
  amount: number;
  unitName: string;
  coyName: string;
  generatedBy: string;
}

export const buildFundVoucherHtml = (d: FundVoucherData): string => {
  const isReceipt = d.type === 'collection';
  const title =
    d.type === 'collection'      ? 'MONEY RECEIPT'          :
    d.type === 'transfer'        ? 'FUND TRANSFER VOUCHER'  :
    d.type === 'salary'          ? 'SALARY PAYMENT VOUCHER' :
    d.type === 'vendor_payment'  ? 'VENDOR PAYMENT VOUCHER' :
                                   'PAYMENT VOUCHER';
  return `
  <div class="doc">
    <div class="h-row">
      <div>
        <div class="unit">${d.unitName}</div>
        <div style="font-size:11px;font-weight:700">${d.coyName}</div>
        <div style="font-size:10px;color:#444">Accounts Section</div>
      </div>
      <div class="doc-type">${title}</div>
    </div>
    <div class="meta">
      <div><b>Voucher No:</b> ${d.voucherNo}</div>
      <div><b>Date:</b> ${fmtDateTime(d.date)}</div>
      <div><b>Fund:</b> ${d.fundLabel}</div>
      <div><b>Mode:</b> ${isReceipt ? 'RECEIVED' : 'PAID'}</div>
      <div style="grid-column:1/3"><b>Particulars:</b> ${d.label}</div>
    </div>
    <table>
      <thead><tr><th>Description</th><th style="width:140px;text-align:right">Amount</th></tr></thead>
      <tbody><tr>
        <td>${d.label}</td>
        <td style="text-align:right;font-weight:800">₹${d.amount.toLocaleString('en-IN')}</td>
      </tr></tbody>
      <tfoot><tr>
        <td style="text-align:right;font-weight:800">TOTAL</td>
        <td style="text-align:right;font-weight:800">₹${d.amount.toLocaleString('en-IN')}</td>
      </tr></tfoot>
    </table>
    <div class="words">Rupees: <b>${numberToWordsINR(d.amount)} Only</b> ${isReceipt ? 'received' : 'paid'}.</div>
    <div class="sig">
      <div>${isReceipt ? "Depositor's Signature" : "Receiver's Signature"}</div>
      <div>Prepared By<br/><span style="font-weight:400;font-size:9px">${d.generatedBy}</span></div>
      <div>${isReceipt ? 'Cashier / QM' : 'Authorised Signatory'}</div>
    </div>
    <div class="foot">Ye computer-generated ${title.toLowerCase()} hai — F Coy ERP</div>
  </div>`;
};

// ─────────────────────────────────────────────
// M13 — TEST RESULT SHEET + MERIT LIST + FAILED LIST
//   Rank dense hai: same marks = same rank.
//   Absent hamesha last, rank '—'.
// ─────────────────────────────────────────────
export interface TestResultRow {
  traineeName: string;
  chestNo: string;
  platoon: string;
  marks: number;              // absent ke case mein -1 allowed
  status: 'pass' | 'fail' | 'absent';
  grade?: string;
  remarks?: string;
}

export interface TestResultSheetData {
  testName: string;
  testTypeLabel: string;
  dateStr: string;
  venue?: string;
  weekNumber?: number;
  instructorName?: string;
  totalMarks: number;
  passingMarks: number;
  unitName: string;
  coyName: string;
  batchNumber?: string;
  rows: TestResultRow[];
  printedBy?: string;
}

export const buildTestResultHtml = (d: TestResultSheetData): string => {
  // ★ Dense rank calculation (appeared candidates only, absent excluded)
  const appeared = d.rows.filter(r => r.status !== 'absent');
  const absentees = d.rows.filter(r => r.status === 'absent');
  const sorted = [...appeared].sort((a, b) => b.marks - a.marks);

  const rankOf: number[] = [];
  let lastMarks = -Infinity;
  let lastRank = 0;
  sorted.forEach((r, i) => {
    if (r.marks !== lastMarks) { lastRank = i + 1; lastMarks = r.marks; }
    rankOf.push(lastRank);
  });

  const medal = (rank: number): string =>
    rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';

  const resultRows = sorted.map((r, i) => `
    <tr ${r.status === 'fail' ? 'style="background:#fdecec"' : ''}>
      <td style="text-align:center;font-weight:800">${medal(rankOf[i])} ${rankOf[i]}</td>
      <td style="text-align:center;font-family:monospace;font-weight:800">${r.chestNo || '—'}</td>
      <td><b>${r.traineeName}</b></td>
      <td style="text-align:center">${r.platoon || '—'}</td>
      <td style="text-align:center;font-weight:800">${r.marks}/${d.totalMarks}</td>
      <td style="text-align:center">${d.totalMarks > 0 ? Math.round((r.marks / d.totalMarks) * 100) : 0}%</td>
      <td style="text-align:center;font-weight:800;color:${r.status === 'pass' ? '#116b1e' : '#b00000'}">${r.status === 'pass' ? 'PASS' : 'FAIL'}</td>
      <td style="text-align:center">${r.grade ?? '—'}</td>
    </tr>`).join('');

  const failedRows = sorted
    .filter(r => r.status === 'fail')
    .map((r, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td style="text-align:center;font-family:monospace;font-weight:800">${r.chestNo || '—'}</td>
        <td><b>${r.traineeName}</b></td>
        <td style="text-align:center">${r.platoon || '—'}</td>
        <td style="text-align:center;font-weight:800">${r.marks}/${d.totalMarks}</td>
        <td>${r.remarks || 'Re-test ki taraf dhyan dene ki zaroorat'}</td>
      </tr>`).join('');

  const passCount = appeared.filter(r => r.status === 'pass').length;
  const failCount = appeared.filter(r => r.status === 'fail').length;
  const avg = appeared.length > 0
    ? Math.round((appeared.reduce((s, r) => s + r.marks, 0) / appeared.length))
    : 0;
  const passRate = appeared.length > 0 ? Math.round((passCount / appeared.length) * 100) : 0;
  const topper = sorted[0];

  return `
  <div class="doc">
    <div class="h-row">
      <div>
        <div class="unit">${d.unitName}</div>
        <div style="font-size:11px;font-weight:700">${d.coyName}${d.batchNumber ? ` · Batch ${d.batchNumber}` : ''}</div>
        <div style="font-size:10px;color:#444">Examination & Assessment Cell</div>
      </div>
      <div class="doc-type">RESULT SHEET / MERIT LIST</div>
    </div>
    <div class="meta">
      <div><b>Test:</b> ${d.testName}</div>
      <div><b>Type:</b> ${d.testTypeLabel}${d.weekNumber ? ` · Week ${d.weekNumber}` : ''}</div>
      <div><b>Date:</b> ${d.dateStr}</div>
      <div><b>Venue:</b> ${d.venue || '—'}</div>
      <div><b>Max / Pass Marks:</b> ${d.totalMarks} / ${d.passingMarks}</div>
      <div><b>Examiner:</b> ${d.instructorName || '—'}</div>
      <div><b>Appeared:</b> ${appeared.length} (Absent: ${absentees.length})</div>
      <div><b>Pass:</b> ${passCount} · <b>Fail:</b> ${failCount} · <b>Pass Rate:</b> ${passRate}% · <b>Avg:</b> ${avg}</div>
      ${topper ? `<div style="grid-column:1/3"><b>🏆 Topper:</b> ${topper.traineeName} (Chest ${topper.chestNo}) — ${topper.marks}/${d.totalMarks}</div>` : ''}
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:42px">Rank</th><th style="width:58px">Chest</th><th>Trainee Name</th>
          <th style="width:56px">Platoon</th><th style="width:64px">Marks</th>
          <th style="width:42px">%</th><th style="width:48px">Result</th><th style="width:42px">Grade</th>
        </tr>
      </thead>
      <tbody>${resultRows || '<tr><td colspan="8" style="text-align:center;color:#777">Koi appeared candidate nahi</td></tr>'}</tbody>
    </table>

    ${absentees.length > 0 ? `
    <table>
      <thead><tr><th colspan="3">⛔ ABSENT CANDIDATES (${absentees.length}) — Makeup test schedule karein</th></tr>
      <tr><th style="width:58px">Chest</th><th>Name</th><th style="width:70px">Platoon</th></tr></thead>
      <tbody>${absentees.map(r => `
        <tr>
          <td style="text-align:center;font-family:monospace;font-weight:800">${r.chestNo || '—'}</td>
          <td><b>${r.traineeName}</b></td>
          <td style="text-align:center">${r.platoon || '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : ''}

    ${failCount > 0 ? `
    <table>
      <thead><tr><th colspan="6">⚠ FAILED CANDIDATES (${failCount}) — Improvement / re-test required</th></tr>
      <tr><th style="width:30px">#</th><th style="width:58px">Chest</th><th>Name</th><th style="width:56px">Platoon</th><th style="width:64px">Marks</th><th>Remarks</th></tr></thead>
      <tbody>${failedRows}</tbody>
    </table>` : `
    <div class="words" style="margin-top:14px">✅ Saare appeared candidates PASS hue — congratulations!</div>`}

    <div class="sig">
      <div>Examiner / Ustad<br/><span style="font-weight:400;font-size:9px">${d.instructorName || ''}</span></div>
      <div>Checked By (Clerk)<br/><span style="font-weight:400;font-size:9px">${d.printedBy || ''}</span></div>
      <div>Company Commander</div>
    </div>
    <div class="foot">Computer-generated result sheet — merit dense-rank se calculated hai (same marks = same rank) — F Coy ERP</div>
  </div>`;
};

// ─────────────────────────────────────────────
// M14 — DAILY SICK PARADE STATE / MI ROOM REPORT
//   Sarkari "Sick Report" — Roz subah MI Room +
//   hospital cases ki consolidated state.
// ─────────────────────────────────────────────
export interface SickReportRow {
  date: string;
  chestNo: string;
  traineeName: string;
  platoon: string;
  category: string;        // Sick Report / Hospital Admit / B-Rest / C-Rest / Medical Board / Injury ...
  diagnosis: string;
  wardNo?: string;
  days?: number;           // kitne din se ...
}

export interface SickReportData {
  dateStr: string;
  unitName: string;
  coyName: string;
  batchNumber?: string;
  totalStrength?: number;
  newEntries: SickReportRow[];    // report date ke naye cases
  activeCases: SickReportRow[];   // abhi jo bhi Active status mein hai
  printedBy?: string;
}

export const buildSickReportHtml = (d: SickReportData): string => {
  const catGroups: Record<string, SickReportRow[]> = {};
  d.activeCases.forEach(r => {
    (catGroups[r.category] = catGroups[r.category] || []).push(r);
  });
  const order = ['Hospital Admit', 'Sick Report', 'Injury (Training)', 'B-Rest', 'C-Rest', 'Medical Board', 'Medical Exam'];
  const orderedCats = [...order.filter(c => catGroups[c]), ...Object.keys(catGroups).filter(c => !order.includes(c))];

  const catTable = (cat: string, list: SickReportRow[]): string => `
    <table>
      <thead>
        <tr><th colspan="7">${cat.toUpperCase()} (${list.length})</th></tr>
        <tr>
          <th style="width:30px">#</th><th style="width:58px">Chest</th><th>Name</th>
          <th style="width:56px">Platoon</th><th>Diagnosis / Details</th>
          <th style="width:70px">Since</th><th style="width:56px">Days</th>
        </tr>
      </thead>
      <tbody>${list.map((r, i) => `
        <tr>
          <td style="text-align:center">${i + 1}</td>
          <td style="text-align:center;font-family:monospace;font-weight:800">${r.chestNo || '—'}</td>
          <td><b>${r.traineeName}</b></td>
          <td style="text-align:center">${r.platoon || '—'}</td>
          <td>${r.diagnosis}${r.wardNo ? ` <i>(Ward: ${r.wardNo})</i>` : ''}</td>
          <td style="text-align:center">${r.date}</td>
          <td style="text-align:center;font-weight:800">${r.days ?? 1}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  const newRows = d.newEntries.map((r, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:center;font-family:monospace;font-weight:800">${r.chestNo || '—'}</td>
      <td><b>${r.traineeName}</b></td>
      <td style="text-align:center">${r.platoon || '—'}</td>
      <td style="text-align:center">${r.category}</td>
      <td>${r.diagnosis}</td>
    </tr>`).join('');

  const hospitalized = d.activeCases.filter(r => r.category === 'Hospital Admit').length;
  const onRest = d.activeCases.filter(r => r.category === 'B-Rest' || r.category === 'C-Rest').length;
  const sickInLines = d.activeCases.length - hospitalized - onRest;

  return `
  <div class="doc">
    <div class="h-row">
      <div>
        <div class="unit">${d.unitName}</div>
        <div style="font-size:11px;font-weight:700">${d.coyName}${d.batchNumber ? ` · Batch ${d.batchNumber}` : ''}</div>
        <div style="font-size:10px;color:#444">MI Room / Medical Inspection</div>
      </div>
      <div class="doc-type">DAILY SICK PARADE STATE</div>
    </div>
    <div class="meta">
      <div><b>Report Date:</b> ${d.dateStr}</div>
      ${d.totalStrength ? `<div><b>Total Strength:</b> ${d.totalStrength}</div>` : ''}
      <div><b>Hospital:</b> ${hospitalized} · <b>On Rest:</b> ${onRest} · <b>Sick in Lines:</b> ${sickInLines}</div>
      <div><b>Total Active Cases:</b> ${d.activeCases.length}${d.totalStrength ? ` (${((d.activeCases.length / d.totalStrength) * 100).toFixed(1)}% of strength)` : ''}</div>
      <div><b>New Cases Today:</b> ${d.newEntries.length}</div>
      <div><b>Printed By:</b> ${d.printedBy || '—'}</div>
    </div>

    ${d.newEntries.length > 0 ? `
    <table>
      <thead>
        <tr><th colspan="6">🆕 AAJ KE NAYE CASES (${d.dateStr})</th></tr>
        <tr><th style="width:30px">#</th><th style="width:58px">Chest</th><th>Name</th><th style="width:56px">Platoon</th><th style="width:90px">Category</th><th>Diagnosis</th></tr>
      </thead>
      <tbody>${newRows}</tbody>
    </table>` : ''}

    ${orderedCats.length > 0
      ? orderedCats.map(c => catTable(c, catGroups[c])).join('')
      : '<div class="words" style="margin-top:14px">✅ Koi active medical case nahi — sab trainees fit hain.</div>'}

    <div class="sig">
      <div>Nursing Assistant / Medic</div>
      <div>MI Room In-charge<br/><span style="font-weight:400;font-size:9px">${d.printedBy || ''}</span></div>
      <div>Company Commander</div>
    </div>
    <div class="foot">Computer-generated daily sick state — MI Room register se — F Coy ERP</div>
  </div>`;
};
