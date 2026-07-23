// ============================================
// DEPUTATION SCREEN (Modern)
// ============================================

import React, { useState } from 'react';
import {
  ArrowRightLeft, Plus, X, Trash2, CheckCircle2, XCircle,
  AlertTriangle, Loader2,
  ArrowDown, ArrowUp,
} from 'lucide-react';
import { useDeputation } from '../hooks/useDeputation';
import { useStaff } from '../hooks/useStaff';
import {
  DeputationRecord, DeputationFormData, DEFAULT_DEPUTATION_FORM,
  DEPUTATION_STATUS_COLORS, DEPUTATION_STATUS_LABELS,
  DEPUTATION_PURPOSES,
} from '../types/deputation.types';
import { COMPANIES } from '../types/staff.types';
import FormModal from '../components/shared/FormModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const DeputationScreen: React.FC = () => {
  const {
    deputations, summary, loading, submitting, error, hasBatch,
    handleAdd, handleMarkReturned, handleDelete, clearError,
  } = useDeputation();

  const { staffList } = useStaff();

  // UI State
  const [activeTab, setActiveTab] = useState<'all' | 'incoming' | 'outgoing' | 'returned'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedDep, setSelectedDep] = useState<DeputationRecord | null>(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);

  // Form State
  const [depForm, setDepForm] = useState<DeputationFormData>(DEFAULT_DEPUTATION_FORM);

  // ─── Filtered Deputations ────────────────
  const filteredDeps = deputations.filter(d => {
    if (activeTab === 'all') return true;
    if (activeTab === 'incoming') return d.direction === 'incoming' && d.status === 'active';
    if (activeTab === 'outgoing') return d.direction === 'outgoing' && d.status === 'active';
    if (activeTab === 'returned') return d.status === 'returned';
    return true;
  });

  // ─── Auto-fill staff details when selected (outgoing) ─
  const handleStaffSelect = (staffId: string) => {
    const staff = staffList.find(s => s.id === staffId);
    if (staff) {
      setDepForm(prev => ({
        ...prev,
        staffId,
        staffName: staff.name,
        staffRank: staff.rank,
        staffForceNumber: staff.forceNumber,
        staffCategory: staff.category,
        fromCompany: staff.company,
      }));
    }
  };

  // ─── Submit ──────────────────────────────
  const handleSubmit = async () => {
    // Validation
    if (depForm.direction === 'outgoing' && !depForm.staffId) {
      alert('Please select the staff member');
      return;
    }
    if (depForm.direction === 'incoming' && !depForm.staffName) {
      alert('Please enter staff name');
      return;
    }
    if (!depForm.fromCompany || !depForm.toCompany || !depForm.purpose) {
      alert('Please fill all required fields');
      return;
    }

    const success = await handleAdd(depForm);
    if (success) {
      setShowAddModal(false);
      setDepForm(DEFAULT_DEPUTATION_FORM);
    }
  };

  // ─── Mark Returned ───────────────────────
  const handleReturnClick = (dep: DeputationRecord) => {
    setSelectedDep(dep);
    setReturnDate(new Date().toISOString().split('T')[0]);
    setShowReturnModal(true);
  };

  const handleReturnSubmit = async () => {
    if (!selectedDep) return;
    const success = await handleMarkReturned(selectedDep.id, returnDate);
    if (success) {
      setShowReturnModal(false);
      setSelectedDep(null);
    }
  };

  // ─── Delete ──────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!selectedDep) return;
    const success = await handleDelete(selectedDep.id);
    if (success) {
      setShowDeleteDialog(false);
      setSelectedDep(null);
    }
  };

  const formatDate = (d: Date | null) =>
    d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ArrowRightLeft size={22} className="text-purple-600" />
              Deputation Register
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Ustad ka len-den — Konsi company ko diya, kaunsa liya
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!hasBatch}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-40"
          >
            <Plus size={16} /> New Deputation
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* No Batch Warning */}
        {!hasBatch && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-700 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-900">No Active Batch</p>
              <p className="text-xs text-amber-700 mt-0.5">Activate a batch to manage deputations</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <XCircle size={18} className="text-red-500" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={clearError}><X size={14} className="text-red-400" /></button>
          </div>
        )}

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

          {/* Total */}
          <div className="bg-white border-2 border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <ArrowRightLeft size={18} className="text-slate-600" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900">{summary.total}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Total Records</p>
          </div>

          {/* Incoming Active */}
          <div className="bg-white border-2 border-green-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <ArrowDown size={18} className="text-green-700" />
              </div>
              <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                LIYA
              </span>
            </div>
            <p className="text-3xl font-black text-green-700">{summary.activeIncoming}</p>
            <p className="text-[10px] font-bold text-green-600 uppercase mt-1">Incoming Active</p>
          </div>

          {/* Outgoing Active */}
          <div className="bg-white border-2 border-red-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <ArrowUp size={18} className="text-red-700" />
              </div>
              <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                DIYA
              </span>
            </div>
            <p className="text-3xl font-black text-red-700">{summary.activeOutgoing}</p>
            <p className="text-[10px] font-bold text-red-600 uppercase mt-1">Outgoing Active</p>
          </div>

          {/* Returned */}
          <div className="bg-white border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 size={18} className="text-blue-700" />
              </div>
            </div>
            <p className="text-3xl font-black text-blue-700">{summary.returned}</p>
            <p className="text-[10px] font-bold text-blue-600 uppercase mt-1">Returned</p>
          </div>
        </div>

        {/* TABS */}
        <div className="bg-white rounded-xl border border-gray-200 p-1 flex gap-1">
          {[
            { key: 'all', label: 'All Records', icon: '📋', count: deputations.length },
            { key: 'incoming', label: 'Incoming (Liya)', icon: '↙', count: summary.activeIncoming },
            { key: 'outgoing', label: 'Outgoing (Diya)', icon: '↗', count: summary.activeOutgoing },
            { key: 'returned', label: 'Returned', icon: '✅', count: summary.returned },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`
                flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all
                ${activeTab === tab.key
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-100'}
              `}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
              <span className="ml-1 opacity-75">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* RECORDS LIST */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-purple-600" />
          </div>
        ) : filteredDeps.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
            <ArrowRightLeft size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No deputations found</p>
            <p className="text-gray-400 text-xs mt-1">
              {activeTab === 'all'
                ? 'Create your first deputation record'
                : 'No records in this category'}
            </p>
            {activeTab === 'all' && hasBatch && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
              >
                + Add First Deputation
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDeps.map(dep => (
              <div
                key={dep.id}
                className={`
                  bg-white rounded-xl border-l-4 border border-gray-200 p-4 hover:shadow-md transition-shadow
                  ${dep.direction === 'incoming'
                    ? 'border-l-green-500'
                    : 'border-l-red-500'
                  }
                `}
              >
                <div className="flex items-start justify-between gap-4">

                  {/* Left: Direction Icon */}
                  <div className={`
                    w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0
                    ${dep.direction === 'incoming' ? 'bg-green-100' : 'bg-red-100'}
                  `}>
                    {dep.direction === 'incoming' ? (
                      <ArrowDown size={20} className="text-green-700" />
                    ) : (
                      <ArrowUp size={20} className="text-red-700" />
                    )}
                    <span className={`text-[9px] font-bold uppercase mt-0.5 ${
                      dep.direction === 'incoming' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {dep.direction === 'incoming' ? 'IN' : 'OUT'}
                    </span>
                  </div>

                  {/* Center: Info */}
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-sm font-black text-gray-900">
                        {dep.staffRank} {dep.staffName}
                      </span>
                      {dep.staffForceNumber && (
                        <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {dep.staffForceNumber}
                        </span>
                      )}
                      {dep.staffCategory && (
                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                          {dep.staffCategory}
                        </span>
                      )}
                      <span className={`
                        text-[10px] font-bold px-2 py-0.5 rounded-full border
                        ${DEPUTATION_STATUS_COLORS[dep.status]}
                      `}>
                        {DEPUTATION_STATUS_LABELS[dep.status]}
                      </span>
                    </div>

                    {/* Company Movement */}
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <div className="bg-slate-100 px-3 py-1 rounded-lg font-bold text-slate-700">
                        {dep.fromCompany || '—'}
                      </div>
                      <ArrowRightLeft size={14} className="text-purple-500" />
                      <div className="bg-purple-100 px-3 py-1 rounded-lg font-bold text-purple-700">
                        {dep.toCompany || '—'}
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Purpose: </span>
                        <span className="font-medium">{dep.purpose}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Duration: </span>
                        <span className="font-medium">
                          {formatDate(dep.fromDate)} → {formatDate(dep.toDate)}
                        </span>
                      </div>
                      {dep.eventDetail && (
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Event: </span>
                          <span>{dep.eventDetail}</span>
                        </div>
                      )}
                      {dep.contactMobile && (
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Contact: </span>
                          <span className="font-mono">{dep.contactMobile}</span>
                        </div>
                      )}
                    </div>

                    {/* Return Info */}
                    {dep.actualReturnDate && (
                      <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700">
                        ✅ Returned on {formatDate(dep.actualReturnDate)}
                      </div>
                    )}

                    {dep.remarks && (
                      <p className="text-xs text-gray-500 italic mt-2">💬 {dep.remarks}</p>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {dep.status === 'active' && (
                      <button
                        onClick={() => handleReturnClick(dep)}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700"
                      >
                        ✓ Mark Returned
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedDep(dep);
                        setShowDeleteDialog(true);
                      }}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          ADD DEPUTATION MODAL
      ═══════════════════════════════════════ */}
      <FormModal
        isOpen={showAddModal}
        title="New Deputation Record"
        subtitle="Personnel movement between companies"
        onClose={() => {
          setShowAddModal(false);
          setDepForm(DEFAULT_DEPUTATION_FORM);
        }}
        size="lg"
      >
        <div className="space-y-4">

          {/* DIRECTION SELECTOR */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
              Type of Deputation *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDepForm(prev => ({ ...prev, direction: 'incoming', staffId: '', staffName: '', staffRank: '', staffForceNumber: '', staffCategory: '', fromCompany: '' }))}
                className={`
                  p-4 rounded-xl border-2 transition-all text-left
                  ${depForm.direction === 'incoming'
                    ? 'border-green-500 bg-green-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-green-300'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDown size={18} className="text-green-700" />
                  <span className="font-bold text-green-800">↙ Incoming</span>
                </div>
                <p className="text-[10px] text-green-600">
                  Dusri company se ustad hamare yahan aaya
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDepForm(prev => ({ ...prev, direction: 'outgoing', staffId: '', staffName: '', staffRank: '', staffForceNumber: '', staffCategory: '', fromCompany: '' }))}
                className={`
                  p-4 rounded-xl border-2 transition-all text-left
                  ${depForm.direction === 'outgoing'
                    ? 'border-red-500 bg-red-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-red-300'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUp size={18} className="text-red-700" />
                  <span className="font-bold text-red-800">↗ Outgoing</span>
                </div>
                <p className="text-[10px] text-red-600">
                  Apna ustad dusri company ko diya
                </p>
              </button>
            </div>
          </div>

          {/* STAFF SELECTION */}
          {depForm.direction === 'outgoing' ? (
            /* OUTGOING: Select from staff */
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Select Our Staff *
              </label>
              <select
                value={depForm.staffId}
                onChange={e => handleStaffSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">-- Select Staff to Depute --</option>
                {staffList
                  .filter(s => s.status === 'active' || s.status === 'deputed_out')
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.rank} {s.name} — {s.category} ({s.company})
                    </option>
                  ))}
              </select>

              {depForm.staffId && (
                <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-blue-800">Selected Staff Details:</p>
                  <p className="text-xs text-blue-700 mt-1">
                    <strong>{depForm.staffRank} {depForm.staffName}</strong> ({depForm.staffForceNumber})
                    <br />
                    Category: {depForm.staffCategory} | From: {depForm.fromCompany}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* INCOMING: Manual entry */
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Staff Name *
                  </label>
                  <input
                    type="text"
                    value={depForm.staffName}
                    onChange={e => setDepForm(prev => ({ ...prev, staffName: e.target.value }))}
                    placeholder="e.g., Rajesh Kumar"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Rank
                  </label>
                  <input
                    type="text"
                    value={depForm.staffRank}
                    onChange={e => setDepForm(prev => ({ ...prev, staffRank: e.target.value }))}
                    placeholder="e.g., HC, ASI"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Force Number
                  </label>
                  <input
                    type="text"
                    value={depForm.staffForceNumber}
                    onChange={e => setDepForm(prev => ({ ...prev, staffForceNumber: e.target.value }))}
                    placeholder="IRLA / BP number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Category / Specialty
                  </label>
                  <input
                    type="text"
                    value={depForm.staffCategory}
                    onChange={e => setDepForm(prev => ({ ...prev, staffCategory: e.target.value }))}
                    placeholder="PT, Drill, Weapon..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* COMPANY MOVEMENT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                {depForm.direction === 'incoming' ? 'From Company *' : 'From Company (Auto)'}
              </label>
              {depForm.direction === 'incoming' ? (
                <select
                  value={depForm.fromCompany}
                  onChange={e => setDepForm(prev => ({ ...prev, fromCompany: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">-- Source Company --</option>
                  {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={depForm.fromCompany}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 font-bold"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                To Company *
              </label>
              <select
                value={depForm.toCompany}
                onChange={e => setDepForm(prev => ({ ...prev, toCompany: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">-- Destination Company --</option>
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* PURPOSE + DATES */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Purpose *</label>
            <select
              value={depForm.purpose}
              onChange={e => setDepForm(prev => ({ ...prev, purpose: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">-- Select Purpose --</option>
              {DEPUTATION_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">From Date *</label>
              <input
                type="date"
                value={depForm.fromDate}
                onChange={e => setDepForm(prev => ({ ...prev, fromDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Expected Return
              </label>
              <input
                type="date"
                value={depForm.toDate}
                min={depForm.fromDate}
                onChange={e => setDepForm(prev => ({ ...prev, toDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* EVENT DETAIL + CONTACT */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Event Detail
            </label>
            <input
              type="text"
              value={depForm.eventDetail}
              onChange={e => setDepForm(prev => ({ ...prev, eventDetail: e.target.value }))}
              placeholder="Additional details about the event/training"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {depForm.direction === 'incoming' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Contact Mobile
              </label>
              <input
                type="tel"
                value={depForm.contactMobile}
                onChange={e => setDepForm(prev => ({ ...prev, contactMobile: e.target.value }))}
                placeholder="10-digit mobile"
                maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}

          {/* REMARKS */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Remarks</label>
            <textarea
              value={depForm.remarks}
              onChange={e => setDepForm(prev => ({ ...prev, remarks: e.target.value }))}
              rows={2}
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
            />
          </div>

          {/* ACTIONS */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setShowAddModal(false);
                setDepForm(DEFAULT_DEPUTATION_FORM);
              }}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={`
                px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 flex items-center gap-2
                ${depForm.direction === 'incoming' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
              `}
            >
              {submitting ? (
                <><Loader2 size={14} className="animate-spin" /> Saving...</>
              ) : (
                <>
                  {depForm.direction === 'incoming' ? '↙ Record Incoming' : '↗ Record Outgoing'}
                </>
              )}
            </button>
          </div>
        </div>
      </FormModal>

      {/* RETURN MODAL */}
      <FormModal
        isOpen={showReturnModal}
        title="Mark as Returned"
        subtitle={selectedDep ? `${selectedDep.staffName}` : ''}
        onClose={() => {
          setShowReturnModal(false);
          setSelectedDep(null);
        }}
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              Marking <strong>{selectedDep?.staffName}</strong> as returned to their parent unit.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Actual Return Date *
            </label>
            <input
              type="date"
              value={returnDate}
              onChange={e => setReturnDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowReturnModal(false)}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleReturnSubmit}
              disabled={submitting || !returnDate}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Marking...' : '✓ Mark Returned'}
            </button>
          </div>
        </div>
      </FormModal>

      {/* DELETE CONFIRM */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Deputation Record"
        message={`Delete deputation record of ${selectedDep?.staffName}?`}
        confirmLabel="Yes, Delete"
        confirmColor="red"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setShowDeleteDialog(false);
          setSelectedDep(null);
        }}
        loading={submitting}
      />
    </div>
  );
};

export default DeputationScreen;