// ═══════════════════════════════════════════════════════════
// PDF GENERATION — Report banane ka service
// ───────────────────────────────────────────────────────────
// YE KYA KARTA HAI:
//   Trainee list ya Fund summary ka PDF banata hai.
//   Browser mein banta hai — koi server nahi, koi charge nahi.
//
// FREE HAI?
//   ✅ Haan! 100% FREE. Browser mein banta hai.
//
// KAISE USE KAREIN:
//   Kisi bhi file mein import karo:
//     import { generateTraineePDF } from '../services/pdf.service';
//
//   Phir call karo:
//     generateTraineePDF(traineeList, 'Batch 45');
//
//   PDF automatically download ho jaayega.
// ═══════════════════════════════════════════════════════════

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Pehle check karo ki jsPDF install hai ya nahi
// Agar nahi hai toh: npm install jspdf jspdf-autotable

interface PDFColumn {
  header: string;     // Column ka naam (upar dikhega)
  dataKey: string;    // Data mein se kaunsa field lena hai
}

interface PDFOptions {
  title: string;           // Report ka title
  subtitle?: string;       // Extra info (batch number, date, etc.)
  columns: PDFColumn[];    // Kaunse columns chahiye
  data: Record<string, any>[];  // Actual data (array of objects)
  orientation?: 'portrait' | 'landscape';  // Portrait ya Landscape
  footer?: string;         // Page ke neeche kya likha ho
}

/**
 * PDF banao aur download karo.
 *
 * EXAMPLE:
 *   generatePDF({
 *     title: 'Trainee List',
 *     subtitle: 'Batch 45',
 *     columns: [
 *       { header: 'Chest No', dataKey: 'chestNo' },
 *       { header: 'Name', dataKey: 'name' },
 *     ],
 *     data: [
 *       { chestNo: '1022', name: 'Ramesh Kumar' },
 *       { chestNo: '1023', name: 'Suresh Singh' },
 *     ],
 *   });
 */
export function generatePDF(options: PDFOptions): void {
  const { title, subtitle, columns, data, orientation = 'portrait', footer } = options;

  // Nayi PDF banao (A4 size)
  const doc = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Title likho ──
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, 20, { align: 'center' });

  // ── Subtitle likho (agar hai) ──
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, pageWidth / 2, 28, { align: 'center' });
  }

  // ── Date likho ──
  doc.setFontSize(8);
  doc.setTextColor(128);  // Grey color
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, 34, { align: 'center' });
  doc.setTextColor(0);  // Wapas black

  // ── Table banao ──
  autoTable(doc, {
    startY: 40,
    columns: columns.map(c => ({ header: c.header, dataKey: c.dataKey })),
    body: data,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [30, 30, 30],     // Dark header
      textColor: [255, 255, 255],  // White text
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],  // Alternate rows grey
    },
    margin: { top: 40, right: 10, bottom: 20, left: 10 },
  });

  // ── Footer likho (har page pe) ──
  if (footer) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(128);
      doc.text(footer, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 15, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
    }
  }

  // ── PDF download karo ──
  const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

/**
 * Trainee list ka PDF banao.
 *
 * EXAMPLE:
 *   generateTraineePDF(trainees, 'Batch 45');
 *
 * Ye automatically download ho jaayega.
 */
export function generateTraineePDF(trainees: any[], batchNumber: string) {
  generatePDF({
    title: 'Trainee Roster',
    subtitle: `Batch: ${batchNumber} | Total: ${trainees.length}`,
    columns: [
      { header: '#', dataKey: 'sno' },
      { header: 'Chest No', dataKey: 'chestNo' },
      { header: 'Name', dataKey: 'name' },
      { header: 'Reg No', dataKey: 'regNo' },
      { header: 'Platoon', dataKey: 'platoon' },
      { header: 'Status', dataKey: 'attn' },
      { header: 'FPT', dataKey: 'fptResult' },
      { header: 'Tests', dataKey: 'weeklyExamResult' },
    ],
    data: trainees.map((t, i) => ({
      sno: i + 1,
      chestNo: t.chestNo || '—',
      name: t.name || '—',
      regNo: t.regNo || '—',
      platoon: t.platoon || '—',
      attn: t.attn || 'P',
      fptResult: t.fptResult || '—',
      weeklyExamResult: t.weeklyExamResult || '—',
    })),
    footer: 'BSF COY Training ERP — Confidential',
  });
}

/**
 * Fund summary ka PDF banao.
 *
 * EXAMPLE:
 *   generateFundPDF(funds);
 */
export function generateFundPDF(funds: any[]) {
  generatePDF({
    title: 'Fund Summary Report',
    subtitle: 'All Funds Overview',
    columns: [
      { header: 'Fund', dataKey: 'label' },
      { header: 'Collection', dataKey: 'collection' },
      { header: 'Paid Out', dataKey: 'actuallyPaid' },
      { header: 'Balance', dataKey: 'balance' },
      { header: 'Vendor Due', dataKey: 'vendorDue' },
    ],
    data: funds.map(f => ({
      label: f.label,
      collection: `₹${f.collection.toLocaleString('en-IN')}`,
      actuallyPaid: `₹${f.actuallyPaid.toLocaleString('en-IN')}`,
      balance: `₹${f.balance.toLocaleString('en-IN')}`,
      vendorDue: f.vendorDue > 0 ? `₹${f.vendorDue.toLocaleString('en-IN')}` : '—',
    })),
    footer: 'BSF COY Training ERP — Financial Report',
  });
}
