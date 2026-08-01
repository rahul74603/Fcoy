// src/features/batch/BatchManagementScreen.tsx

import React, { useState } from 'react';
import {
  Layers, Plus, CheckCircle2, AlertTriangle, X, Loader2,
  Calendar, Users, Archive, Shield,
  Clock, Hash, FileText, Eye, ArrowRight, Star, Edit3, Save
} from 'lucide-react';
import { useBatch, CreateBatchForm } from '../../contexts/BatchContext';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

export const BatchManagementScreen: React.FC = () => {
  const { user } = useAuth();
  const { activeBatch, allBatches, loading, createNewBatch, updateBatchInfo, switchActiveBatch } = useBatch();

  const isCommander = user?.role === 'Company Commander';

  // ── ★ Edit Batch State ──
  const [editingBatch, setEditingBatch] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ batchName: '', startDate: '', endDate: '', description: '' });
  const [editLoading, setEditLoading] = useState(false);

  // ── Form State ──
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState<CreateBatchForm>({
    batchNumber: '',
    batchName: '',
    startDate: '',
    endDate: '',
    description: '',
    createdBy: '',
  });

  // ── Batch Detail View ──
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [batchTraineeCount, setBatchTraineeCount] = useState<Record<string, number>>({});

  // ── Alerts ──
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // ── Confirm Dialog ──
  const [showConfirm, setShowConfirm] = useState(false);
  // ➕ ADD — Task A: 'switch' action bhi isi confirm modal se chalega
  const [confirmAction, setConfirmAction] = useState<'create' | 'complete' | 'switch'>('create');

  // ── ➕ ADD — Task A: Batch Switch state ──
  const [switchTarget, setSwitchTarget] = useState<{ id: string; batchNumber: string; batchName: string } | null>(null);
  const [switchLoading, setSwitchLoading] = useState(false);

  // ── CSS ──
  const inputCls = "w-full border border-slate-300 px-3 py-2.5 text-xs focus:outline-none focus:border-military-700 bg-white rounded";
  const labelCls = "text-[10px] font-black text-slate-500 uppercase block mb-1";

  // ── Fetch trainee count for a batch ──
  const fetchTraineeCount = async (batchId: string) => {
    try {
      const q = query(collection(db, 'trainees'), where('batchId', '==', batchId));
      const snap = await getDocs(q);
      setBatchTraineeCount(prev => ({ ...prev, [batchId]: snap.size }));
    } catch (err) {
      console.error('Trainee count error:', err);
    }
  };

  // ── Auto-generate batch number ──
  const generateBatchNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const existing = allBatches.filter(b =>
      b.batchNumber.startsWith(`${year}-`)
    ).length;
    return `${year}-${String(existing + 1).padStart(2, '0')}`;
  };

  // ── Handle Create New Batch ──
  const handleCreateBatch = async () => {
    if (!isCommander) {
      setError('Only Company Commander can create or activate a new batch');
      setShowConfirm(false);
      return;
    }

    if (!form.batchNumber.trim() || !form.batchName.trim() || !form.startDate) {
      setError('Batch Number, Name aur Start Date required hain');
      return;
    }

    setCreateLoading(true);
    setError('');
    setSuccess('');
    setShowConfirm(false);

    try {
      await createNewBatch({
        ...form,
        createdBy: user?.name ?? user?.email ?? 'Unknown',
      });

      setSuccess(`✓ Batch "${form.batchNumber}" successfully create ho gaya! Purana batch archive ho gaya.`);
      setForm({
        batchNumber: '',
        batchName: '',
        startDate: '',
        endDate: '',
        description: '',
        createdBy: '',
      });
      setShowCreateForm(false);
    } catch (err: any) {
      setError(`Batch create failed: ${err.message}`);
    } finally {
      setCreateLoading(false);
    }
  };

  // ── ★ Handle Edit Batch ──
  const openEdit = (batch: any) => {
    setEditingBatch(batch.id);
    setEditForm({
      batchName: batch.batchName || '',
      startDate: batch.startDate || '',
      endDate: batch.endDate || '',
      description: batch.description || '',
    });
    setError('');
    setSuccess('');
  };

  const handleEditSave = async () => {
    if (!editingBatch) return;
    if (!isCommander) {
      setError('Only Company Commander can edit batch details');
      return;
    }
    if (!editForm.batchName.trim()) {
      setError('Batch Name required hai');
      return;
    }
    setEditLoading(true);
    setError('');
    try {
      await updateBatchInfo(editingBatch, {
        ...editForm,
        updatedBy: user?.name ?? user?.email ?? 'Unknown',
      });
      setSuccess('✓ Batch details successfully update ho gayi!');
      setEditingBatch(null);
    } catch (err: any) {
      setError(`Batch update failed: ${err.message}`);
    } finally {
      setEditLoading(false);
    }
  };

  // ── ➕ ADD — Task A: Handle Batch Switch ──
  // Purani batch wapas ACTIVE karta hai. Data delete nahi hota — reversible hai.
  const handleSwitchBatch = async () => {
    if (!switchTarget) return;
    if (!isCommander) {
      setError('Only Company Commander can switch active batch');
      setShowConfirm(false);
      return;
    }

    setSwitchLoading(true);
    setError('');
    setSuccess('');
    setShowConfirm(false);

    try {
      await switchActiveBatch(switchTarget.id, user?.name ?? user?.email ?? 'Unknown');
      setSuccess(
        `✓ Batch "${switchTarget.batchNumber}" ab ACTIVE hai! Purani active batch archive ho gayi. ` +
        `Koi data delete nahi hua — chaaho to wapas switch kar sakte ho.`
      );
      setSwitchTarget(null);
    } catch (err: any) {
      setError(`Batch switch failed: ${err.message}`);
    } finally {
      setSwitchLoading(false);
    }
  };

  // ── Stats ──
  const activeBatches = allBatches.filter(b => b.status === 'active');
  const completedBatches = allBatches.filter(b => b.status === 'completed');

  // ── Status Badge ──
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-full bg-green-100 text-green-800 border border-green-300">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            ACTIVE
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
            <Archive size={9} />
            COMPLETED
          </span>
        );
      case 'upcoming':
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-300">
            <Clock size={9} />
            UPCOMING
          </span>
        );
      default:
        return null;
    }
  };

  // ═════════════════════════════════
  // RENDER
  // ═════════════════════════════════
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-military-700" />
        <span className="ml-3 text-sm text-slate-500">Loading batches...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-8">

      {/* ── HEADER ── */}
      <div className="flex justify-between items-end border-b-2 border-military-800 pb-3">
        <div>
          <h1 className="text-2xl font-black text-military-900 uppercase tracking-wider flex items-center gap-2">
            <Layers size={22} className="text-military-700" />
            Batch Management
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Create · Manage · Archive Training Batches
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeBatch && (
            <span className="text-[10px] font-black text-green-700 bg-green-50 border border-green-300 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Active: {activeBatch.batchNumber}
            </span>
          )}
          {isCommander && (
            <button
              onClick={() => {
                setForm({
                  ...form,
                  batchNumber: generateBatchNumber(),
                });
                setShowCreateForm(true);
              }}
              className="bg-military-800 text-white px-4 py-2 text-xs font-black uppercase flex items-center gap-1.5 rounded hover:bg-military-700 transition-colors"
            >
              <Plus size={14} /> New Batch
            </button>
          )}
        </div>
      </div>

      {/* ── ALERTS ── */}
      {success && (
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={14} /> {success}
          <button onClick={() => setSuccess('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2.5 rounded text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* ── STATS CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Total Batches</p>
              <p className="text-2xl font-black text-military-900">{allBatches.length}</p>
            </div>
            <Layers size={24} className="text-military-300" />
          </div>
        </div>
        <div className="bg-white border border-green-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-green-500 uppercase">Active Batch</p>
              <p className="text-2xl font-black text-green-700">{activeBatches.length}</p>
            </div>
            <Star size={24} className="text-green-300" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Completed</p>
              <p className="text-2xl font-black text-slate-600">{completedBatches.length}</p>
            </div>
            <Archive size={24} className="text-slate-300" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Current Trainees</p>
              <p className="text-2xl font-black text-military-900">
                {activeBatch?.totalTrainees ?? 0}
              </p>
            </div>
            <Users size={24} className="text-military-300" />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════ */}
      {/* ACTIVE BATCH HIGHLIGHT                */}
      {/* ══════════════════════════════════════ */}
      {activeBatch && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-green-100 px-5 py-3 border-b border-green-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <h3 className="text-xs font-black text-green-800 uppercase">
                Currently Active Batch
              </h3>
            </div>
            {getStatusBadge('active')}
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] font-black text-green-600 uppercase mb-1">Batch Number</p>
                <p className="text-lg font-black text-green-900">{activeBatch.batchNumber}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-green-600 uppercase mb-1">Batch Name</p>
                <p className="text-sm font-bold text-green-800">{activeBatch.batchName}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-green-600 uppercase mb-1">Duration</p>
                <p className="text-sm font-bold text-green-800">
                  {activeBatch.startDate
                    ? new Date(activeBatch.startDate).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })
                    : '—'
                  }
                  {activeBatch.endDate && (
                    <span className="text-green-600">
                      {' → '}
                      {new Date(activeBatch.endDate).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black text-green-600 uppercase mb-1">Trainees</p>
                <p className="text-lg font-black text-green-900">
                  {activeBatch.totalTrainees}
                </p>
              </div>
            </div>
            {activeBatch.description && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-[10px] font-black text-green-600 uppercase mb-1">Description</p>
                <p className="text-xs text-green-700">{activeBatch.description}</p>
              </div>
            )}

            {/* Info box */}
            <div className="mt-4 bg-green-100 border border-green-300 rounded p-3">
              <p className="text-[10px] text-green-700 font-semibold flex items-center gap-1.5">
                <Shield size={11} />
                Saare naye trainees is batch mein add honge. Naya batch create karne par
                ye batch automatically archive ho jayega.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No active batch warning */}
      {!activeBatch && !loading && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 text-center">
          <AlertTriangle size={32} className="text-amber-500 mx-auto mb-3" />
          <h3 className="text-sm font-black text-amber-800 uppercase mb-1">
            Koi Active Batch Nahi Hai!
          </h3>
          <p className="text-xs text-amber-600 mb-4">
            Trainees add karne ke liye pehle ek batch create karo.
          </p>
          {isCommander && (
            <button
              onClick={() => {
                setForm({ ...form, batchNumber: generateBatchNumber() });
                setShowCreateForm(true);
              }}
              className="bg-amber-600 text-white px-5 py-2 text-xs font-black uppercase rounded hover:bg-amber-700"
            >
              <Plus size={13} className="inline mr-1" /> Create First Batch
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════ */}
      {/* CREATE BATCH FORM (Modal-style)       */}
      {/* ══════════════════════════════════════ */}
      {showCreateForm && (
        <div className="bg-white border-2 border-military-300 rounded-xl overflow-hidden shadow-lg">
          <div className="bg-military-50 px-5 py-3 border-b border-military-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus size={14} className="text-military-700" />
              <h3 className="text-xs font-black text-military-800 uppercase">Create New Batch</h3>
            </div>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5">
            {/* Warning */}
            {activeBatch && (
              <div className="bg-amber-50 border border-amber-300 rounded p-3 mb-5">
                <p className="text-[10px] text-amber-700 font-bold flex items-center gap-1.5">
                  <AlertTriangle size={11} />
                  ⚠ Current active batch <strong>"{activeBatch.batchNumber}"</strong> automatically
                  <strong> ARCHIVE/COMPLETED</strong> ho jayega jab naya batch create hoga!
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Batch Number */}
              <div>
                <label className={labelCls}>
                  <Hash size={10} className="inline mr-1" />
                  Batch Number *
                </label>
                <input
                  type="text"
                  required
                  value={form.batchNumber}
                  onChange={e => setForm({ ...form, batchNumber: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. 2025-01"
                />
                <p className="text-[9px] text-slate-400 mt-0.5">
                  Auto-generated. Change kar sakte ho.
                </p>
              </div>

              {/* Batch Name */}
              <div>
                <label className={labelCls}>
                  <FileText size={10} className="inline mr-1" />
                  Batch Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.batchName}
                  onChange={e => setForm({ ...form, batchName: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Recruit Batch June 2025"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className={labelCls}>
                  <Calendar size={10} className="inline mr-1" />
                  Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={e => setForm({ ...form, startDate: e.target.value })}
                  className={inputCls}
                />
              </div>

              {/* End Date */}
              <div>
                <label className={labelCls}>
                  <Calendar size={10} className="inline mr-1" />
                  Expected End Date
                </label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm({ ...form, endDate: e.target.value })}
                  className={inputCls}
                />
                <p className="text-[9px] text-slate-400 mt-0.5">
                  Optional — approximate date daal do
                </p>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className={labelCls}>Description / Notes</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className={`${inputCls} resize-none`}
                  rows={3}
                  placeholder="Batch ke baare mein koi notes..."
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 mt-5 pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setConfirmAction('create');
                  setShowConfirm(true);
                }}
                disabled={createLoading || !form.batchNumber.trim() || !form.batchName.trim() || !form.startDate}
                className="bg-green-700 text-white px-6 py-2.5 text-xs font-black uppercase hover:bg-green-800 disabled:opacity-50 flex items-center gap-2 rounded"
              >
                {createLoading
                  ? <><Loader2 size={13} className="animate-spin" /> Creating...</>
                  : <><Plus size={13} /> Create & Activate Batch</>}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2.5 text-xs font-black text-slate-600 border border-slate-300 rounded hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════ */}
      {/* CONFIRM DIALOG                        */}
      {/* ══════════════════════════════════════ */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-amber-50 px-5 py-4 border-b border-amber-200">
              <h3 className="text-sm font-black text-amber-800 uppercase flex items-center gap-2">
                <AlertTriangle size={16} /> Confirm Action
              </h3>
            </div>
            <div className="p-5">
              {confirmAction === 'create' && (
                <>
                  <p className="text-xs text-slate-700 mb-3">
                    Kya aap sure hain? Yeh action karne se:
                  </p>
                  <ul className="text-xs text-slate-600 space-y-2 mb-4">
                    {activeBatch && (
                      <li className="flex items-start gap-2">
                        <ArrowRight size={12} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <span>
                          Current batch <strong>"{activeBatch.batchNumber}"</strong> ARCHIVE ho jayega
                        </span>
                      </li>
                    )}
                    <li className="flex items-start gap-2">
                      <ArrowRight size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                      <span>
                        New batch <strong>"{form.batchNumber}"</strong> ACTIVE ho jayega
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>Ab se saare naye trainees is batch se linked honge</span>
                    </li>
                  </ul>
                </>
              )}

              {confirmAction === 'complete' && (
                <p className="text-xs text-slate-700 mb-4">
                  Kya aap sure hain ki is batch ko complete/archive karna hai?
                </p>
              )}

              {/* ➕ ADD — Task A: Batch Switch confirmation */}
              {confirmAction === 'switch' && switchTarget && (
                <>
                  <p className="text-xs text-slate-700 mb-3">
                    Batch Switch confirm karo. Is action se:
                  </p>
                  <ul className="text-xs text-slate-600 space-y-2 mb-4">
                    {activeBatch && activeBatch.id !== switchTarget.id && (
                      <li className="flex items-start gap-2">
                        <ArrowRight size={12} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <span>
                          Current active batch <strong>"{activeBatch.batchNumber}"</strong>{' '}
                          <span className="text-red-600 font-bold">ARCHIVE (Completed)</span> ho jayega
                        </span>
                      </li>
                    )}
                    <li className="flex items-start gap-2">
                      <ArrowRight size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                      <span>
                        Batch <strong>"{switchTarget.batchNumber}"</strong> ab{' '}
                        <span className="text-green-600 font-bold">ACTIVE</span> ho jayega — Batch Progress,
                        Attendance, Inventory jaise saare screens ab isi batch ko dikhayenge
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>Koi data delete NAHI hoga</strong> — purani batch ki details isi screen me
                        "All Batches History" se hamesha dekh sakte ho, aur zaroorat padi to wapas switch bhi kar sakte ho
                      </span>
                    </li>
                  </ul>
                </>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (confirmAction === 'create') handleCreateBatch();
                    else if (confirmAction === 'switch') handleSwitchBatch();
                  }}
                  disabled={createLoading || switchLoading}
                  className="bg-green-700 text-white px-5 py-2 text-xs font-black uppercase rounded hover:bg-green-800 disabled:opacity-50 flex items-center gap-2"
                >
                  {(createLoading || switchLoading)
                    ? <><Loader2 size={12} className="animate-spin" /> Processing...</>
                    : <><CheckCircle2 size={12} /> Confirm</>}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 text-xs font-black text-slate-600 border border-slate-300 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════ */}
      {/* ALL BATCHES TABLE                     */}
      {/* ══════════════════════════════════════ */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive size={14} className="text-military-700" />
            <h3 className="text-xs font-black text-slate-800 uppercase">All Batches History</h3>
            <span className="text-[9px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border">
              {allBatches.length} batches
            </span>
          </div>
        </div>

        {allBatches.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <Layers size={40} className="mx-auto mb-3 text-slate-200" />
            <p className="text-sm font-bold">Koi batch nahi hai</p>
            <p className="text-xs mt-1">Pehle ek batch create karo</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['#', 'Batch Number', 'Name', 'Start Date', 'End Date', 'Status', 'Trainees', 'Created'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allBatches.map((batch, index) => (
                  <tr
                    key={batch.id}
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                      batch.status === 'active' ? 'bg-green-50/50' : ''
                    }`}
                    onClick={() => {
                      setSelectedBatch(selectedBatch === batch.id ? null : batch.id);
                      fetchTraineeCount(batch.id);
                    }}
                  >
                    <td className="px-4 py-3 text-slate-400 font-bold">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {batch.status === 'active' && (
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                        )}
                        <span className="font-black text-military-900">{batch.batchNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-700">{batch.batchName}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {batch.startDate
                        ? new Date(batch.startDate).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric'
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {batch.endDate
                        ? new Date(batch.endDate).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric'
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(batch.status)}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">
                      {batchTraineeCount[batch.id] ?? batch.totalTrainees ?? 0}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[10px]">
                      {batch.createdAt
                        ? new Date(batch.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric'
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── BATCH DETAIL EXPAND ── */}
      {selectedBatch && (() => {
        const batch = allBatches.find(b => b.id === selectedBatch);
        if (!batch) return null;
        return (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-military-700" />
                <h3 className="text-xs font-black text-slate-800 uppercase">
                  Batch Details: {batch.batchNumber}
                </h3>
                {getStatusBadge(batch.status)}
              </div>
              <div className="flex items-center gap-2">
                {/* ➕ ADD — Task A: Set Active (batch switch) — sirf CC, sirf non-active real batch par */}
                {isCommander && batch.status !== 'active' && batch.status !== 'test' && !batch.isTestData && (
                  <button
                    onClick={() => {
                      setSwitchTarget({ id: batch.id, batchNumber: batch.batchNumber, batchName: batch.batchName });
                      setConfirmAction('switch');
                      setError('');
                      setSuccess('');
                      setShowConfirm(true);
                    }}
                    className="text-[10px] font-black uppercase flex items-center gap-1 px-2.5 py-1 border border-green-300 text-green-700 rounded hover:bg-green-50"
                    title="Is batch ko Active banao — current active archive hogi, data delete nahi hoga (reversible)"
                  >
                    <CheckCircle2 size={11} /> Set Active
                  </button>
                )}
                {isCommander && (
                  <button
                    onClick={() => openEdit(batch)}
                    className="text-[10px] font-black uppercase flex items-center gap-1 px-2.5 py-1 border border-military-300 text-military-700 rounded hover:bg-military-50"
                    title="Batch details edit karo"
                  >
                    <Edit3 size={11} /> Edit
                  </button>
                )}
                <button onClick={() => setSelectedBatch(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Batch Number</p>
                  <p className="text-sm font-black text-military-900">{batch.batchNumber}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Batch Name</p>
                  <p className="text-sm font-bold text-slate-700">{batch.batchName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Start Date</p>
                  <p className="text-sm font-bold text-slate-700">
                    {batch.startDate
                      ? new Date(batch.startDate).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">End Date</p>
                  <p className="text-sm font-bold text-slate-700">
                    {batch.endDate
                      ? new Date(batch.endDate).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Total Trainees</p>
                  <p className="text-sm font-black text-military-900">
                    {batchTraineeCount[batch.id] ?? batch.totalTrainees ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Created By</p>
                  <p className="text-sm font-bold text-slate-700">{batch.createdBy || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Created On</p>
                  <p className="text-sm font-bold text-slate-700">
                    {batch.createdAt
                      ? new Date(batch.createdAt).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })
                      : '—'}
                  </p>
                </div>
                {batch.completedAt && (
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Completed On</p>
                    <p className="text-sm font-bold text-slate-700">
                      {new Date(batch.completedAt).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
              {batch.description && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Description</p>
                  <p className="text-xs text-slate-600">{batch.description}</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── ★ EDIT BATCH MODAL ── */}
      {editingBatch && (() => {
        const batch = allBatches.find(b => b.id === editingBatch);
        if (!batch) return null;
        return (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-slate-300 shadow-2xl w-full max-w-lg">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-military-50">
                <h3 className="text-xs font-black text-military-900 uppercase flex items-center gap-2">
                  <Edit3 size={13} /> Edit Batch: {batch.batchNumber}
                </h3>
                <button onClick={() => setEditingBatch(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-[10px] text-slate-400 font-bold">
                  Batch Number "{batch.batchNumber}" identity hai — change nahi hogi. Sirf name, dates aur description edit ho sakte hain.
                </p>
                <div>
                  <label className={labelCls}>Batch Name *</label>
                  <input
                    type="text"
                    value={editForm.batchName}
                    onChange={e => setEditForm({ ...editForm, batchName: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}><Calendar size={10} className="inline mr-1" />Start Date</label>
                    <input
                      type="date"
                      value={editForm.startDate}
                      onChange={e => setEditForm({ ...editForm, startDate: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}><Calendar size={10} className="inline mr-1" />Expected End Date</label>
                    <input
                      type="date"
                      value={editForm.endDate}
                      onChange={e => setEditForm({ ...editForm, endDate: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Description / Notes</label>
                  <textarea
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    className={`${inputCls} resize-none`}
                    rows={3}
                  />
                </div>
              </div>
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={() => setEditingBatch(null)}
                  className="px-4 py-2 text-xs font-black text-slate-600 border border-slate-300 rounded hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={editLoading || !editForm.batchName.trim()}
                  className="bg-military-800 text-white px-5 py-2 text-xs font-black uppercase flex items-center gap-2 rounded hover:bg-military-900 disabled:opacity-50"
                >
                  {editLoading
                    ? <><Loader2 size={12} className="animate-spin" /> Saving...</>
                    : <><Save size={12} /> Save Changes</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default BatchManagementScreen;