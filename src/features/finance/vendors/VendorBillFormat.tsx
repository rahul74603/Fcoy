// D:\ALL PROJECTS\BSF COYs\frontend\src\features\finance\vendors\VendorBillFormat.tsx

import React from 'react';
import { X, Printer, Building2, Phone, MapPin, Calendar, Hash } from 'lucide-react';
import type { VendorEntry, Vendor } from './VendorManagementScreen';
import { formatDate } from '../shared/utils';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface VendorBillFormatProps {
  entry:   VendorEntry;
  vendor:  Vendor;
  onClose: () => void;
}

// ─────────────────────────────────────────────
// MAIN COMPONENT — Preview Only
// ─────────────────────────────────────────────
export const VendorBillFormat: React.FC<VendorBillFormatProps> = ({
  entry,
  vendor,
  onClose,
}) => {

  // Print handler
  const handlePrint = () => {
    const printContent = document.getElementById('vendor-bill-print');
    if (!printContent) return;

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Bill — ${vendor.name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              font-size: 11px; 
              color: #1a1a1a; 
              padding: 30px;
            }
            .header { 
              border-bottom: 3px solid #1a1a1a; 
              padding-bottom: 16px; 
              margin-bottom: 20px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .company-name { 
              font-size: 20px; 
              font-weight: 900; 
              text-transform: uppercase; 
              letter-spacing: 3px;
            }
            .bill-title {
              font-size: 14px;
              font-weight: 700;
              text-transform: uppercase;
              background: #1a1a1a;
              color: white;
              padding: 6px 16px;
              letter-spacing: 2px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 20px;
            }
            .info-box {
              border: 1px solid #ddd;
              padding: 12px;
            }
            .info-label {
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              color: #888;
              margin-bottom: 4px;
            }
            .info-value {
              font-size: 12px;
              font-weight: 700;
              color: #1a1a1a;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px; 
            }
            th { 
              background: #1a1a1a; 
              color: white; 
              padding: 8px 10px; 
              text-align: left; 
              font-size: 9px; 
              text-transform: uppercase; 
              letter-spacing: 1px;
            }
            th.right { text-align: right; }
            td { 
              padding: 7px 10px; 
              border-bottom: 1px solid #eee; 
              font-size: 10px; 
            }
            td.right { text-align: right; font-weight: 700; }
            tr:nth-child(even) { background: #f9f9f9; }
            .total-row {
              background: #1a1a1a !important;
              color: white;
            }
            .total-row td {
              font-weight: 900;
              font-size: 12px;
              color: white;
              border: none;
            }
            .status-section {
              display: flex;
              gap: 16px;
              margin-bottom: 20px;
            }
            .status-box {
              flex: 1;
              border: 2px solid #1a1a1a;
              padding: 12px;
              text-align: center;
            }
            .status-box .label {
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              color: #666;
            }
            .status-box .value {
              font-size: 16px;
              font-weight: 900;
              margin-top: 4px;
            }
            .footer {
              margin-top: 40px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .sign-box {
              border-top: 1px solid #1a1a1a;
              padding-top: 8px;
              min-width: 160px;
              text-align: center;
              font-size: 9px;
              color: #888;
              text-transform: uppercase;
              font-weight: 700;
            }
            .remarks-box {
              background: #f5f5f5;
              border-left: 3px solid #1a1a1a;
              padding: 10px 12px;
              margin-bottom: 16px;
              font-size: 10px;
              color: #444;
            }
            @media print { body { padding: 15px; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  };

  // ── Status colors ──
  const statusColor =
    entry.status === 'Paid'    ? '#16a34a' :
    entry.status === 'Partial' ? '#d97706' :
    '#dc2626';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white shadow-2xl max-w-3xl w-full rounded-xl overflow-hidden max-h-[95vh] flex flex-col">

        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Building2 size={18} />
            <div>
              <p className="text-sm font-black uppercase tracking-wide">Bill Preview</p>
              <p className="text-white/50 text-[10px]">{vendor.name} · {formatDate(entry.entryDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded text-[11px] font-black uppercase transition-all"
            >
              <Printer size={13} /> Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Bill Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
          <div id="vendor-bill-print" className="bg-white shadow-sm rounded-lg p-8 max-w-2xl mx-auto">

            {/* ── Bill Header ── */}
            <div className="header border-b-2 border-slate-900 pb-4 mb-5 flex items-start justify-between">
              <div>
                <p className="company-name text-xl font-black uppercase tracking-widest text-slate-900">
                  BSF COY — ERP
                </p>
                <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                  Quarter Master · Finance Department
                </p>
              </div>
              <div className="text-right">
                <div className="bill-title inline-block bg-slate-900 text-white px-4 py-1.5 text-xs font-black uppercase tracking-widest">
                  VENDOR BILL
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Date: {formatDate(entry.entryDate)}
                </p>
              </div>
            </div>

            {/* ── Vendor & Bill Info ── */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              {/* Vendor Info */}
              <div className="border border-slate-200 rounded-lg p-3">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
                  <Building2 size={9} /> Vendor Details
                </p>
                <p className="text-sm font-black text-slate-900">{vendor.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{vendor.categoryLabel}</p>
                {vendor.phone && (
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                    <Phone size={9} /> {vendor.phone}
                  </p>
                )}
                {vendor.address && (
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={9} /> {vendor.address}
                  </p>
                )}
              </div>

              {/* Bill Meta */}
              <div className="border border-slate-200 rounded-lg p-3">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
                  <Hash size={9} /> Bill Info
                </p>
                <div className="space-y-1.5">
                  <div>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Entry Date</p>
                    <p className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                      <Calendar size={9} /> {formatDate(entry.entryDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Category</p>
                    <p className="text-[11px] font-black text-slate-700">{entry.categoryLabel}</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Payment Status</p>
                    <span
                      className="text-[10px] font-black px-2 py-0.5 rounded"
                      style={{
                        background: entry.status === 'Paid'    ? '#dcfce7' :
                                    entry.status === 'Partial' ? '#fef3c7' : '#fee2e2',
                        color: statusColor,
                      }}
                    >
                      {entry.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Items Table ── */}
            <div className="mb-5">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Items / Services</p>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="text-left px-3 py-2 text-[9px] font-black uppercase">#</th>
                    <th className="text-left px-3 py-2 text-[9px] font-black uppercase">Item / Service</th>
                    <th className="text-center px-3 py-2 text-[9px] font-black uppercase">Qty</th>
                    <th className="text-center px-3 py-2 text-[9px] font-black uppercase">Unit</th>
                    <th className="text-right px-3 py-2 text-[9px] font-black uppercase">Rate (₹)</th>
                    <th className="text-right px-3 py-2 text-[9px] font-black uppercase">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entry.items.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-3 py-2.5 text-[10px] text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 text-[11px] font-bold text-slate-800">{item.itemName}</td>
                      <td className="px-3 py-2.5 text-[11px] text-center text-slate-600">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-[11px] text-center text-slate-500">{item.unit}</td>
                      <td className="px-3 py-2.5 text-[11px] text-right text-slate-600">
                        {item.unitPrice.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-right font-black text-slate-800">
                        {item.total.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white">
                    <td colSpan={5} className="px-3 py-2.5 text-[10px] font-black uppercase text-right">
                      Total Amount
                    </td>
                    <td className="px-3 py-2.5 text-sm font-black text-right">
                      ₹{entry.totalAmount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ── Payment Status Section ── */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { l: 'Total Amount', v: `₹${entry.totalAmount.toLocaleString('en-IN')}`, c: '#1e293b', bg: '#f8fafc', b: '#e2e8f0' },
                { l: 'Paid Amount',  v: `₹${entry.paidAmount.toLocaleString('en-IN')}`,  c: '#16a34a', bg: '#f0fdf4', b: '#bbf7d0' },
                { l: 'Due Amount',   v: `₹${entry.dueAmount.toLocaleString('en-IN')}`,   c: entry.dueAmount > 0 ? '#dc2626' : '#16a34a', bg: entry.dueAmount > 0 ? '#fef2f2' : '#f0fdf4', b: entry.dueAmount > 0 ? '#fecaca' : '#bbf7d0' },
              ].map(s => (
                <div
                  key={s.l}
                  className="text-center rounded-lg p-3 border-2"
                  style={{ background: s.bg, borderColor: s.b }}
                >
                  <p className="text-[9px] font-bold text-slate-400 uppercase">{s.l}</p>
                  <p className="text-base font-black mt-1" style={{ color: s.c }}>{s.v}</p>
                </div>
              ))}
            </div>

            {/* ── Remarks ── */}
            {entry.remarks && (
              <div className="bg-slate-50 border-l-4 border-slate-900 px-4 py-3 mb-5 rounded-r">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Remarks</p>
                <p className="text-[11px] text-slate-700">{entry.remarks}</p>
              </div>
            )}

            {/* ── Bills Attached ── */}
            {entry.bills.length > 0 && (
              <div className="mb-5">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">
                  Attached Bills ({entry.bills.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {entry.bills.map(bill => (
                    <span
                      key={bill.id}
                      className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded"
                    >
                      📎 {bill.fileName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Footer / Signatures ── */}
            <div className="border-t-2 border-slate-900 pt-4 mt-6 flex justify-between items-end">
              <div>
                <p className="text-[8px] text-slate-400 font-bold uppercase">
                  Generated by BSF COY ERP System
                </p>
                <p className="text-[8px] text-slate-400">
                  {new Date().toLocaleString('en-IN')}
                </p>
              </div>
              <div className="flex gap-8">
                {['Vendor Sign', 'QM Sign', 'CO Sign'].map(label => (
                  <div key={label} className="text-center">
                    <div className="h-8 border-b border-slate-400 mb-1 w-24" />
                    <p className="text-[8px] font-black text-slate-400 uppercase">{label}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default VendorBillFormat;