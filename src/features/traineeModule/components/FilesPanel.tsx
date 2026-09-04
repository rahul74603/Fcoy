// ═══════════════════════════════════════════════════════════
// FILES PANEL — shared between Clerk and Trainee
// ───────────────────────────────────────────────────────────
// Clerk (canUpload) → upload form + delete + pin
// Trainee           → sirf list + download
// Dono ek hi component use karte hain taaki jo clerk upload kare
// wahi bina kisi extra step ke trainee ko dikhe.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText, Upload, Download, Trash2, Loader2, Search, X, Pin, PinOff,
  FileImage, Paperclip, AlertCircle,
} from 'lucide-react';
import {
  uploadTraineeFile, getTraineeFiles, deleteTraineeFile, setTraineeFilePinned,
  FILE_CATEGORIES,
  type TraineeFile, type TraineeFileCategory,
} from '../api/files.api';
import { formatStorageFileSize } from '../../shared/storage.utils';

interface Props {
  batchId: string;
  /** Clerk/CC = true → upload aur delete dikhega */
  canUpload: boolean;
  userName: string;
  /** Trainee view — sirf isko target ki hui files */
  traineeId?: string;
  platoon?: string;
  /** Upload form ke trainee picker ke liye (sirf clerk) */
  trainees?: Record<string, any>[];
}

const fileIcon = (type: string) =>
  type?.startsWith('image/')
    ? <FileImage size={16} className="text-blue-600" />
    : type === 'application/pdf'
      ? <FileText size={16} className="text-red-600" />
      : <Paperclip size={16} className="text-slate-500" />;

export const FilesPanel: React.FC<Props> = ({
  batchId, canUpload, userName, traineeId, platoon, trainees = [],
}) => {
  const [files, setFiles] = useState<TraineeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'ALL' | TraineeFileCategory>('ALL');

  // upload form
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TraineeFileCategory>('Weekly Program');
  const [targetPlatoon, setTargetPlatoon] = useState('all');
  const [audience, setAudience] = useState<'group' | 'picked'>('group');
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [pickSearch, setPickSearch] = useState('');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!batchId) { setLoading(false); return; }
    setLoading(true);
    const list = await getTraineeFiles(batchId, { traineeId, platoon });
    setFiles(list);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [batchId, traineeId, platoon]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return files
      .filter(f => cat === 'ALL' || f.category === cat)
      .filter(f => !needle
        || f.title.toLowerCase().includes(needle)
        || (f.description || '').toLowerCase().includes(needle)
        || f.fileName.toLowerCase().includes(needle));
  }, [files, q, cat]);

  const reset = () => {
    setFile(null); setTitle(''); setDescription('');
    setCategory('Weekly Program'); setTargetPlatoon('all');
    setAudience('group'); setPickedIds([]); setPickSearch(''); setPinned(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setMsg('');
    if (!file) { setErr('Pehle file choose karo'); return; }
    if (!title.trim()) { setErr('Title likhna zaroori hai'); return; }
    if (audience === 'picked' && pickedIds.length === 0) {
      setErr('Kam se kam ek trainee chuno, ya "Poore group ko" select karo'); return;
    }
    setBusy(true);
    try {
      const label = pickedIds
        .map(id => { const t = trainees.find(x => x.id === id); return t ? `${t.chestNo} ${t.name}` : ''; })
        .filter(Boolean).join(', ');
      await uploadTraineeFile(file, {
        batchId,
        title: title.trim(),
        description: description.trim(),
        category,
        targetPlatoon: audience === 'picked' ? 'all' : targetPlatoon,
        targetTraineeIds: audience === 'picked' ? pickedIds : [],
        targetTraineeLabel: label,
        pinned,
      }, userName);
      setMsg(audience === 'picked'
        ? `✅ File ${pickedIds.length} trainee ko bhej di gayi`
        : '✅ File upload ho gayi — trainees ko dikhne lagegi');
      reset(); setShowForm(false); load();
    } catch (e: any) {
      setErr(e?.message || 'Upload fail ho gaya');
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const handleDelete = async (f: TraineeFile) => {
    if (!window.confirm(`"${f.title}" delete karna hai?`)) return;
    try {
      await deleteTraineeFile(f);
      setMsg('File delete ho gayi'); load();
    } catch (e: any) { setErr(e?.message || 'Delete fail'); }
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow p-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="File dhundo…"
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs" />
        </div>
        <select value={cat} onChange={e => setCat(e.target.value as any)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold">
          <option value="ALL">Sab categories</option>
          {FILE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.value}</option>)}
        </select>
        <span className="text-[10px] font-black text-slate-500">{visible.length} files</span>
        {canUpload && (
          <button onClick={() => setShowForm(v => !v)}
            className="ml-auto flex items-center gap-1 rounded-lg bg-green-700 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-green-800">
            {showForm ? <><X size={12} /> Close</> : <><Upload size={12} /> Upload File</>}
          </button>
        )}
      </div>

      {msg && <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs font-bold text-green-800">{msg}</div>}
      {err && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-700 flex items-center gap-1.5"><AlertCircle size={13} />{err}</div>}

      {/* Upload form */}
      {canUpload && showForm && (
        <form onSubmit={handleUpload} className="bg-white rounded-xl shadow border border-green-200 p-4 space-y-3">
          <h3 className="text-sm font-black text-slate-800">📤 Nayi file upload karo</h3>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">File (PDF / image) *</label>
            <input type="file" accept="application/pdf,image/*"
              onChange={e => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''));
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
            {file && (
              <p className="mt-1 text-[10px] text-slate-500">
                {file.name} · {formatStorageFileSize(file.size)}
              </p>
            )}
            <p className="mt-1 text-[10px] text-slate-400">Max 10MB · PDF, JPG, PNG, WEBP</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Title *</label>
              <input required value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Weekly Program 08–14 Sept"
                className="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as TraineeFileCategory)}
                className="w-full rounded-lg border px-3 py-2 text-sm">
                {FILE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.value}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Detail (optional)</label>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Trainees ko kya batana hai is file ke baare me"
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none" />
          </div>

          {/* Audience */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kisko dikhe? *</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button type="button" onClick={() => setAudience('group')}
                className={`rounded-lg border px-3 py-2 text-left ${audience === 'group' ? 'border-green-700 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
                <p className="text-xs font-black">👥 Poore group ko</p>
                <p className="text-[9px] text-slate-500">All / ek platoon</p>
              </button>
              <button type="button" onClick={() => setAudience('picked')}
                className={`rounded-lg border px-3 py-2 text-left ${audience === 'picked' ? 'border-green-700 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
                <p className="text-xs font-black">🎯 Chune hue trainee</p>
                <p className="text-[9px] text-slate-500">{pickedIds.length ? `${pickedIds.length} selected` : 'Search karke chuno'}</p>
              </button>
            </div>

            {audience === 'group' ? (
              <select value={targetPlatoon} onChange={e => setTargetPlatoon(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm">
                <option value="all">All Platoons</option>
                <option value="Platoon 1">Platoon 1</option>
                <option value="Platoon 2">Platoon 2</option>
                <option value="Platoon 3">Platoon 3</option>
                <option value="Platoon 4">Platoon 4</option>
              </select>
            ) : (
              <div className="space-y-2">
                <input value={pickSearch} onChange={e => setPickSearch(e.target.value)}
                  placeholder="Chest no / naam…"
                  className="w-full rounded-lg border px-3 py-2 text-sm" />
                {pickedIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {pickedIds.map(id => {
                      const t = trainees.find(x => x.id === id);
                      if (!t) return null;
                      return (
                        <span key={id} className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
                          {t.chestNo} {t.name}
                          <button type="button" onClick={() => setPickedIds(v => v.filter(x => x !== id))}><X size={10} /></button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 divide-y">
                  {trainees
                    .filter(t => {
                      const s = pickSearch.trim().toLowerCase();
                      if (!s) return true;
                      return String(t.chestNo || '').toLowerCase().includes(s)
                        || String(t.name || '').toLowerCase().includes(s);
                    })
                    .slice(0, 100)
                    .map(t => {
                      const on = pickedIds.includes(t.id);
                      return (
                        <button key={t.id} type="button"
                          onClick={() => setPickedIds(v => on ? v.filter(x => x !== t.id) : [...v, t.id])}
                          className={`flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-green-50 ${on ? 'bg-green-50' : ''}`}>
                          <span className="text-xs font-bold text-slate-800">{t.chestNo} · {t.name}</span>
                          <span className="text-[10px] text-slate-500">{on ? '✓' : t.platoon || ''}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
            📌 Upar pin karo (important file)
          </label>

          <button type="submit" disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-xs font-black text-white hover:bg-green-800 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload karo
          </button>
        </form>
      )}

      {/* File list */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10">
          <Loader2 size={18} className="animate-spin text-green-700" />
          <span className="text-xs font-bold text-slate-500">Files load ho rahi hain…</span>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <FileText size={40} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-400">
            {canUpload ? 'Abhi koi file upload nahi hui' : 'Abhi koi file nahi aayi'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(f => {
            const icon = FILE_CATEGORIES.find(c => c.value === f.category)?.icon || '📎';
            return (
              <div key={f.id}
                className={`bg-white rounded-xl shadow p-3 flex items-start gap-3 border-l-4 ${f.pinned ? 'border-amber-500' : 'border-slate-200'}`}>
                <div className="mt-0.5">{fileIcon(f.fileType)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {f.pinned && <span className="text-[9px] font-black text-amber-700">📌 PINNED</span>}
                    <p className="text-sm font-black text-slate-800 truncate">{icon} {f.title}</p>
                  </div>
                  {f.description && <p className="text-[11px] text-slate-600 mt-0.5">{f.description}</p>}
                  <p className="text-[10px] text-slate-400 mt-1">
                    {f.fileName} · {formatStorageFileSize(f.fileSize || 0)} · {f.category}
                    {' · '}{f.uploadedBy} · {new Date(f.uploadedAt).toLocaleDateString('en-IN')}
                  </p>
                  {canUpload && (
                    <p className="text-[10px] text-slate-400">
                      {(f.targetTraineeIds && f.targetTraineeIds.length > 0)
                        ? `🎯 ${f.targetTraineeIds.length} trainee${f.targetTraineeLabel ? ` — ${f.targetTraineeLabel}` : ''}`
                        : (f.targetPlatoon === 'all' ? '👥 All Platoons' : `👥 ${f.targetPlatoon}`)}
                    </p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <a href={f.downloadUrl} target="_blank" rel="noopener noreferrer" download={f.fileName}
                    className="flex items-center gap-1 rounded-lg bg-green-700 px-3 py-1.5 text-[10px] font-black uppercase text-white hover:bg-green-800">
                    <Download size={12} /> Open
                  </a>
                  {canUpload && (
                    <>
                      <button onClick={async () => { await setTraineeFilePinned(f.id, !f.pinned); load(); }}
                        title={f.pinned ? 'Unpin' : 'Pin'}
                        className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200">
                        {f.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                      </button>
                      <button onClick={() => handleDelete(f)} title="Delete"
                        className="rounded-lg bg-red-50 p-1.5 text-red-600 hover:bg-red-100">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
