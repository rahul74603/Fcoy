// ============================================
// SYSTEM MASTERS & BACKUP SCREEN (Module 18 Audit ★ NEW)
// ============================================
// CC-only command center:
//   1) Masters Registry — kaunsa master DB-driven hai vs hardcoded,
//      live counts + manager-screen links (existing screens reuse)
//   2) Dropdown Masters — `dropdown_masters` collection editor
//   3) Numbering System — existing ID schemes + live counters
//   4) Backup Center — poore ERP ka one-click JSON export
// ============================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database, Download, Loader2, RefreshCw, Plus, Save, Trash2,
  ListOrdered, HardDrive, CheckCircle2, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAllDropdownMasters, saveDropdownValues, DropdownMaster,
  getCounterSnapshot, exportFullBackup, downloadBackupFile,
  BACKUP_COLLECTIONS, BackupResult,
} from './masters.api';

// ─── MASTERS REGISTRY DEFINITION ─────────────
interface MasterRow {
  name: string;
  source: 'DB' | 'CODE' | 'CONFIG';
  collectionName?: string;    // DB ho to count fetch hoga
  managedAt?: string;         // manager screen route
  note: string;
}

const MASTER_REGISTRY: MasterRow[] = [
  { name: 'Unit / Company Profile', source: 'DB', collectionName: 'unitConfig', managedAt: '/settings', note: 'parentUnit, companyName, FY, session — real-time config' },
  { name: 'Batch Master', source: 'DB', collectionName: 'batches', managedAt: '/batches', note: 'Batch create/edit + strength tracking' },
  { name: 'Staff Master', source: 'DB', collectionName: 'staff', managedAt: '/staff', note: 'Instructor profiles + status' },
  { name: 'Subject Master', source: 'DB', collectionName: 'subject_master', managedAt: '/subjects', note: 'Subjects with code + category' },
  { name: 'Leave Type Master', source: 'DB', collectionName: 'leave_types', managedAt: '/staff-leave', note: 'CL/EL/AL etc. with yearly quota' },
  { name: 'Duty Type Master', source: 'DB', collectionName: 'duty_types', managedAt: '/duty-management', note: 'Duty type definitions' },
  { name: 'Vendor Master', source: 'DB', collectionName: 'vendors', managedAt: '/vendors', note: 'Purchase vendors + dues' },
  { name: 'User / Role Master', source: 'DB', collectionName: 'users', managedAt: '/users', note: 'Login users (4 roles, route-gated)' },
  { name: 'Trainee Master', source: 'DB', collectionName: 'trainees', managedAt: '/profile', note: 'Batch-wise trainee records' },
  { name: 'Medical Categories', source: 'DB', collectionName: 'dropdown_masters', note: '★ Ab dropdown master se — Medical Register use karta hai (fallback hardcoded)' },
  { name: 'Rank Master', source: 'CODE', note: 'staff.types.ts RANKS constant — DB migration Future item' },
  { name: 'Platoon Master', source: 'CODE', note: 'schedule.types/weekly/testRecord mein 3 hardcoded lists — DB migration Future' },
  { name: 'Exam / Test Types', source: 'CODE', note: 'testRecord.types.ts TestType union (11 types) — type-safe code master' },
  { name: 'Kit / Item Catalog', source: 'CODE', note: 'Purchase entries se dynamic (datalist) — central item master Future' },
  { name: 'Notification Types', source: 'CODE', note: 'notification.types.ts (18 types) — template engine ke saath DB ho jayega' },
  { name: 'Medicine Store', source: 'DB', collectionName: 'medicine_txns', managedAt: '/medical-register', note: 'Receive/Issue txns → computed stock' },
];

// ─── KNOWN NUMBERING SCHEMES ─────────────────
const NUMBERING_SCHEMES = [
  { key: 'broadcast', label: 'Broadcast Messages', prefix: 'BC-', example: 'BC-0001', counterDb: true },
  { key: 'leave', label: 'Leave Applications', prefix: 'LV-', example: 'LV-YYYYMMDD-XXXX', counterDb: false },
  { key: 'kit_slip', label: 'Kit Issue Slips', prefix: 'IS-', example: 'IS-YYYYMMDD-XXXX', counterDb: false },
  { key: 'kit_return', label: 'Kit Return Receipts', prefix: 'RT-', example: 'RT-YYYYMMDD-XXXX', counterDb: false },
  { key: 'batch', label: 'Batch IDs', prefix: 'batch_', example: 'batch_15', counterDb: false },
  { key: 'chest', label: 'Chest Numbers', prefix: '(clerk assigned)', example: '21001', counterDb: false },
];

export const SystemMastersScreen: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [counters, setCounters] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // ── Dropdown editor ──
  const [masters, setMasters] = useState<DropdownMaster[]>([]);
  const [editKey, setEditKey] = useState<string>('medical_categories');
  const [editLabel, setEditLabel] = useState('Medical Categories');
  const [editValues, setEditValues] = useState<string[]>([]);
  const [newValue, setNewValue] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Backup ──
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupProgress, setBackupProgress] = useState('');
  const [lastBackup, setLastBackup] = useState<BackupResult | null>(null);

  const loadAll = async () => {
    setLoading(true);
    // Live counts (registry ke DB rows)
    const countTargets = [...new Set(MASTER_REGISTRY.filter(m => m.collectionName).map(m => m.collectionName!))];
    const countMap: Record<string, number> = {};
    await Promise.all(countTargets.map(async col => {
      try {
        const snap = await getDocs(collection(db, col));
        countMap[col] = snap.size;
      } catch {
        countMap[col] = -1;
      }
    }));
    setCounts(countMap);
    setCounters(await getCounterSnapshot());

    const dd = await getAllDropdownMasters();
    setMasters(dd);

    // Editor prefill
    const current = dd.find(m => m.key === editKey);
    if (current) {
      setEditLabel(current.label);
      setEditValues(current.values);
    } else if (dd.length > 0 && !editKey) {
      setEditKey(dd[0].key);
      setEditLabel(dd[0].label);
      setEditValues(dd[0].values);
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectMasterToEdit = (key: string) => {
    const m = masters.find(x => x.key === key);
    setEditKey(key);
    setSaveMsg('');
    if (m) {
      setEditLabel(m.label);
      setEditValues(m.values);
    } else {
      // naya master shuru karna ho
      setEditLabel(key.replace(/_/g, ' '));
      setEditValues([]);
    }
  };

  const handleSaveMaster = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      await saveDropdownValues(editKey, editLabel, editValues, user?.email ?? 'CC');
      setSaveMsg('SUCCESS: Master save ho gaya. Linked screens par turant reflect hoga (fallback active).');
      await loadAll();
    } catch (err: any) {
      setSaveMsg(`ERROR: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    setBackupRunning(true);
    setBackupProgress('Starting...');
    try {
      const backup = await exportFullBackup(user?.email ?? 'CC', (done, total, current) => {
        setBackupProgress(`Exporting ${done}/${total}: ${current}`);
      });
      setLastBackup(backup);
      downloadBackupFile(backup);
      setBackupProgress(`DONE: ${Object.keys(backup.data).length} collections export ho gayi.`);
    } catch (err: any) {
      setBackupProgress(`ERROR: ${err.message}`);
    } finally {
      setBackupRunning(false);
    }
  };

  if (user?.role !== 'Company Commander') {
    return <div className="p-4 text-red-600 font-bold uppercase">Restricted Area: Commander Clearance Required</div>;
  }

  const dbCount = MASTER_REGISTRY.filter(m => m.source === 'DB').length;
  const codeCount = MASTER_REGISTRY.filter(m => m.source === 'CODE').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-military-800 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-military-900 uppercase tracking-wider flex items-center gap-2">
            <Database size={22} /> System Masters & Backup
          </h1>
          <p className="text-sm text-slate-500 font-semibold mt-1">Master Data Registry · Dropdowns · Numbering · Data Backup</p>
        </div>
        <button onClick={loadAll} disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 rounded">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Total Masters', value: MASTER_REGISTRY.length, bg: 'bg-slate-50', color: 'text-slate-800' },
          { label: 'DB-Driven', value: dbCount, bg: 'bg-green-50', color: 'text-green-700' },
          { label: 'Code-Driven', value: codeCount, bg: 'bg-amber-50', color: 'text-amber-700' },
          { label: 'Backup Collections', value: BACKUP_COLLECTIONS.length, bg: 'bg-blue-50', color: 'text-blue-700' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-slate-200 rounded p-3 text-center`}>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── MASTERS REGISTRY TABLE ── */}
      <div className="bg-white border border-slate-300 shadow-flat">
        <div className="bg-slate-100 border-b border-slate-300 px-4 py-2">
          <span className="text-xs font-bold uppercase text-military-900">Masters Registry — DB vs Code Driven</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px]">Master</th>
                <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] text-center">Source</th>
                <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] text-center">Records</th>
                <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px]">Note</th>
                <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] text-center">Manage</th>
              </tr>
            </thead>
            <tbody>
              {MASTER_REGISTRY.map(m => (
                <tr key={m.name} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-bold text-slate-800 text-xs">{m.name}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${m.source === 'DB' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {m.source === 'DB' ? '🗄️ DB' : '📄 CODE'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center font-mono text-xs">
                    {m.collectionName
                      ? (counts[m.collectionName] === undefined ? '…' : counts[m.collectionName] === -1 ? 'ERR' : counts[m.collectionName])
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-[10px] text-slate-500 max-w-xs truncate">{m.note}</td>
                  <td className="px-4 py-2 text-center">
                    {m.managedAt ? (
                      <button onClick={() => navigate(m.managedAt!)}
                        className="text-[9px] font-black uppercase text-blue-700 hover:text-blue-900 flex items-center gap-1 mx-auto">
                        Open <ExternalLink size={9} />
                      </button>
                    ) : <span className="text-[9px] text-slate-300 font-bold">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DROPDOWN MASTER EDITOR + NUMBERING ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DROPDOWN EDITOR */}
        <div className="bg-white border border-slate-300 shadow-flat p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-military-900 border-b border-slate-200 pb-2">
            Dropdown Master Editor
          </h2>
          <p className="text-[10px] text-slate-500">DB-driven dropdown lists. Linked screens hardcoded fallback ke saath inhe prefer karti hain.</p>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Select Master</label>
            <select value={editKey} onChange={e => selectMasterToEdit(e.target.value)}
              className="w-full border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:border-military-700 bg-white">
              {masters.map(m => <option key={m.key} value={m.key}>{m.label} ({m.values.length})</option>)}
              {!masters.some(m => m.key === 'medical_categories') && (
                <option value="medical_categories">+ New: Medical Categories</option>
              )}
            </select>
          </div>

          {saveMsg && (
            <div className={`p-2 text-[10px] font-bold uppercase ${saveMsg.startsWith('ERROR') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {saveMsg}
            </div>
          )}

          {/* Values editor */}
          <div className="border border-slate-200 rounded divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {editValues.length === 0 ? (
              <p className="text-[10px] text-slate-400 font-bold uppercase text-center py-6">Koi value nahi — neeche se add karein</p>
            ) : (
              editValues.map((v, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50">
                  <span className="text-xs font-semibold text-slate-800">{v}</span>
                  <button type="button" onClick={() => setEditValues(editValues.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600 p-1" title="Remove">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <input type="text" value={newValue} onChange={e => setNewValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newValue.trim()) { setEditValues([...editValues, newValue.trim()]); setNewValue(''); e.preventDefault(); } }}
              placeholder="Nayi value add karein"
              className="flex-1 border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:border-military-700" />
            <button type="button"
              onClick={() => { if (newValue.trim()) { setEditValues([...editValues, newValue.trim()]); setNewValue(''); } }}
              className="bg-slate-700 text-white px-3 py-1.5 text-[10px] font-black uppercase rounded flex items-center gap-1 hover:bg-slate-800">
              <Plus size={11} /> Add
            </button>
          </div>

          <button onClick={handleSaveMaster} disabled={saving || editValues.length === 0}
            className="w-full bg-military-800 text-white font-bold uppercase text-xs py-2 hover:bg-military-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Master
          </button>
        </div>

        {/* NUMBERING + COUNTERS */}
        <div className="bg-white border border-slate-300 shadow-flat">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 flex items-center gap-2">
            <ListOrdered size={14} className="text-slate-600" />
            <span className="text-xs font-bold uppercase text-military-900">Document Numbering System</span>
          </div>
          <div className="divide-y divide-slate-100">
            {NUMBERING_SCHEMES.map(s => (
              <div key={s.key} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <p className="text-xs font-bold text-slate-800">{s.label}</p>
                  <p className="text-[10px] text-slate-400 font-mono">Scheme: {s.example}</p>
                </div>
                {s.counterDb ? (
                  <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    Counter: {counters[s.key] ?? 0}
                  </span>
                ) : (
                  <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">Module-managed</span>
                )}
              </div>
            ))}
          </div>
          <div className="px-4 py-3 bg-amber-50 border-t border-amber-200">
            <p className="text-[10px] text-amber-800 font-semibold flex items-start gap-1.5">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              Existing schemes (LV-, IS-, RT-) unke modules ke andar managed hain — change nahi kiye gaye (golden rule). Naye counters `system_counters` collection mein transaction-safe hain.
            </p>
          </div>
        </div>
      </div>

      {/* ── BACKUP CENTER ── */}
      <div className="bg-white border-t-4 border-t-blue-800 border border-slate-300 shadow-flat p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-military-900 flex items-center border-b border-slate-200 pb-2">
          <HardDrive size={15} className="mr-2 text-blue-700" /> Backup Center — Full ERP Data Export
        </h2>
        <p className="text-xs text-slate-600">
          Ek click mein {BACKUP_COLLECTIONS.length} Firestore collections ka JSON snapshot download hota hai
          (Timestamps ISO mein converted). Ye file disaster recovery / audit / migration ke liye
          secure jagah par store karein. <strong>Restore</strong> abhi admin-assisted manual process hai
          (Firestore console ya migration script se) — auto-restore future item hai.
        </p>

        {backupProgress && (
          <div className={`p-2 text-[10px] font-bold uppercase flex items-center gap-2 ${backupProgress.startsWith('ERROR') ? 'bg-red-50 text-red-700' : backupProgress.startsWith('DONE') ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
            {backupRunning && <Loader2 size={12} className="animate-spin" />}
            {backupProgress}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <button onClick={handleBackup} disabled={backupRunning}
            className="bg-blue-800 text-white font-bold uppercase text-xs px-5 py-2.5 hover:bg-blue-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {backupRunning ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {backupRunning ? 'Exporting...' : 'Download Full Backup (JSON)'}
          </button>
          {lastBackup && (
            <p className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
              <CheckCircle2 size={12} className="text-green-600" />
              Last export: {new Date(lastBackup.exportedAt).toLocaleString('en-IN')} · {Object.values(lastBackup.collectionCounts).reduce((s, c) => s + Math.max(0, c), 0)} total docs · by {lastBackup.exportedBy}
            </p>
          )}
        </div>

        {/* Collection counts preview */}
        {lastBackup && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-1.5 max-h-44 overflow-y-auto border border-slate-100 rounded p-2">
            {Object.entries(lastBackup.collectionCounts).map(([col, count]) => (
              <div key={col} className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded">
                <span className="text-[9px] font-mono text-slate-600 truncate">{col}</span>
                <span className={`text-[9px] font-black ${count < 0 ? 'text-red-600' : 'text-slate-800'}`}>{count < 0 ? 'ERR' : count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemMastersScreen;
