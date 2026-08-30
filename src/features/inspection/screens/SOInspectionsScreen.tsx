// ═══════════════════════════════════════════════════════════════════════
// SO INSPECTIONS — inspection events + findings / corrective actions
// ───────────────────────────────────────────────────────────────────────
// Senior Officer / Inspector (and CC for oversight) record inspections for
// ASSIGNED batches, log findings, assign corrective actions, and verify
// closure. SO never touches finance/inventory/users/leave-approval directly.
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck, Plus, Search, ShieldAlert, CheckCircle2, RotateCcw,
  Loader2, X, FileSearch, AlertTriangle, Trash2,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useBatch } from '../../../contexts/BatchContext';
import {
  getInspections, createInspection, deleteInspection,
  getFindings, createFinding, updateFindingStatus, deleteFinding,
  canAccessBatch, isSO, isCC,
  type AppUserLike,
} from '../api/inspection.api';
import {
  INSPECTION_TYPES, SEVERITY_LABELS, SEVERITY_COLORS,
  FINDING_STATUS_LABELS, FINDING_STATUS_COLORS, RESPONSIBLE_ROLES,
  type Inspection, type Finding, type Severity, type ResponsibleRole,
} from '../types/inspection.types';
import { localDateISOString } from '../../../utils/localDate';

const inputCls = 'w-full border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400';

const todayISO = () => localDateISOString();

const SOInspectionsScreen: React.FC = () => {
  const { user } = useAuth();
  const { allBatches } = useBatch();

  const me: AppUserLike = useMemo(() => ({
    uid: user?.uid ?? '',
    role: user?.role ?? '',
    displayName: user?.displayName ?? user?.name ?? '',
    name: user?.name ?? '',
    assignedBatchIds: user?.assignedBatchIds ?? [],
  }), [user]);

  const soActive = isSO(me.role);
  const ccActive = isCC(me.role);
  const canWrite = soActive || ccActive;

  // Batches this user may inspect (CC = all).
  const assignableBatches = useMemo(() => {
    if (ccActive) return allBatches;
    return allBatches.filter(b => (me.assignedBatchIds ?? []).includes(b.id));
  }, [allBatches, ccActive, me.assignedBatchIds]);

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [batchFilter, setBatchFilter] = useState<string>('ALL');

  const [showInspModal, setShowInspModal] = useState(false);
  const [showFindingModal, setShowFindingModal] = useState(false);
  const [showReworkModal, setShowReworkModal] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [insp, fnd] = await Promise.all([getInspections(me), getFindings(me)]);
      setInspections(insp);
      setFindings(fnd);
    } catch (e: any) {
      setError(e?.message ?? 'Data load failed');
    } finally {
      setLoading(false);
    }
  }, [user, me]);

  useEffect(() => { load(); }, [load]);

  // ── Inspection form ──
  const blankInsp = {
    batchId: assignableBatches[0]?.id ?? '',
    inspectionType: 'General',
    inspectionDate: todayISO(),
    subject: '',
    observations: '',
    severity: 'observation' as Severity,
    remarks: '',
  };
  const [inspForm, setInspForm] = useState(blankInsp);
  useEffect(() => {
    if (!inspForm.batchId && assignableBatches[0]) {
      setInspForm(f => ({ ...f, batchId: assignableBatches[0].id }));
    }
  }, [assignableBatches]);

  const submitInspection = async () => {
    if (!inspForm.batchId || !inspForm.subject.trim()) {
      setError('Batch aur subject zaroori hai.'); return;
    }
    setBusy(true); setError('');
    try {
      const batch = allBatches.find(b => b.id === inspForm.batchId);
      await createInspection(me, {
        batchId: inspForm.batchId,
        batchNumber: batch?.batchNumber ?? '',
        batchName: batch?.batchName ?? '',
        inspectionType: inspForm.inspectionType,
        inspectionDate: inspForm.inspectionDate,
        subject: inspForm.subject,
        observations: inspForm.observations,
        status: 'submitted',
        severity: inspForm.severity,
        remarks: inspForm.remarks,
      });
      setShowInspModal(false);
      setInspForm(blankInsp);
      await load();
    } catch (e: any) { setError(e?.message ?? 'Save failed'); }
    finally { setBusy(false); }
  };

  // ── Finding form ──
  const blankFinding = {
    title: '', description: '', category: 'General',
    severity: 'minor' as Severity, responsibleArea: '',
    assignedToRole: 'Clerk' as ResponsibleRole,
    assignedToName: '', dueDate: todayISO(), correctiveAction: '',
  };
  const [findingForm, setFindingForm] = useState(blankFinding);

  const openFindingFor = (insp: Inspection) => {
    setSelectedInspection(insp);
    setFindingForm({
      ...blankFinding,
      category: String(insp.inspectionType ?? 'General'),
      responsibleArea: String(insp.inspectionType ?? ''),
    });
    setShowFindingModal(true);
  };

  const submitFinding = async () => {
    if (!selectedInspection) return;
    if (!findingForm.title.trim() || !findingForm.correctiveAction.trim()) {
      setError('Finding title aur corrective action zaroori hai.'); return;
    }
    setBusy(true); setError('');
    try {
      await createFinding(me, {
        batchId: selectedInspection.batchId,
        batchNumber: selectedInspection.batchNumber,
        inspectionId: selectedInspection.id,
        category: findingForm.category,
        title: findingForm.title,
        description: findingForm.description,
        severity: findingForm.severity,
        responsibleArea: findingForm.responsibleArea,
        assignedToRole: findingForm.assignedToRole,
        assignedToName: findingForm.assignedToName,
        dueDate: findingForm.dueDate,
        correctiveAction: findingForm.correctiveAction,
      });
      setShowFindingModal(false);
      setSelectedInspection(null);
      setFindingForm(blankFinding);
      await load();
    } catch (e: any) { setError(e?.message ?? 'Save failed'); }
    finally { setBusy(false); }
  };

  const transition = async (f: Finding, to: 'in_progress' | 'submitted' | 'closed' | 'rework', extra?: any) => {
    setBusy(true); setError('');
    try {
      await updateFindingStatus(me, f.id, f, { to, actorName: me.displayName, ...extra } as any);
      setShowReworkModal(false);
      setSelectedFinding(null);
      await load();
    } catch (e: any) { setError(e?.message ?? 'Action failed'); }
    finally { setBusy(false); }
  };

  const removeInspection = async (i: Inspection) => {
    if (!window.confirm(`Inspection "${i.subject}" delete karein? (sirf draft)`)) return;
    try { await deleteInspection(me, i); await load(); }
    catch (e: any) { setError(e?.message ?? 'Delete failed'); }
  };
  const removeFinding = async (f: Finding) => {
    if (!window.confirm(`Finding "${f.title}" delete karein?`)) return;
    try { await deleteFinding(me, f); await load(); }
    catch (e: any) { setError(e?.message ?? 'Delete failed'); }
  };

  // ── Filters ──
  const visibleInspections = useMemo(() => inspections.filter(i =>
    (batchFilter === 'ALL' || i.batchId === batchFilter) &&
    (!query || (i.subject + i.inspectorName + i.inspectionType).toLowerCase().includes(query.toLowerCase())),
  ), [inspections, batchFilter, query]);

  const visibleFindings = useMemo(() => findings.filter(f =>
    (batchFilter === 'ALL' || f.batchId === batchFilter) &&
    (!query || (f.title + f.assignedToRole + f.responsibleArea).toLowerCase().includes(query.toLowerCase())),
  ), [findings, batchFilter, query]);

  const batchNo = (id: string) => allBatches.find(b => b.id === id)?.batchNumber ?? id;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="text-indigo-700" /> Inspections &amp; Supervision
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            {ccActive ? 'Commander oversight — all inspections' : 'Senior Officer / Inspector — assigned batches only'}
          </p>
        </div>
        {canWrite && assignableBatches.length > 0 && (
          <button onClick={() => setShowInspModal(true)}
            className="flex items-center gap-2 bg-indigo-700 text-white px-4 py-2 text-sm font-bold rounded-lg hover:bg-indigo-800">
            <Plus size={16} /> New Inspection
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <ShieldAlert size={16} /> {error}
          <button className="ml-auto" onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {assignableBatches.length === 0 && canWrite && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Aapko koi batch assigned nahi hai. Company Commander se <b>assignedBatchIds</b> me batch add karwayein.
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search subject, inspector, finding…"
            className={`${inputCls} pl-9`} />
        </div>
        <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} className={`${inputCls} sm:w-56`}>
          <option value="ALL">All assigned batches</option>
          {assignableBatches.map(b => <option key={b.id} value={b.id}>{b.batchNumber} — {b.batchName}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-700" /></div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Inspections */}
          <div className="bg-white border border-slate-200 rounded-xl">
            <div className="px-4 py-3 border-b border-slate-100 font-bold text-sm text-slate-800 flex items-center gap-2">
              <FileSearch size={15} className="text-indigo-700" /> Inspections ({visibleInspections.length})
            </div>
            <div className="p-3 space-y-2 max-h-[520px] overflow-auto">
              {visibleInspections.length === 0 && <p className="text-center text-sm text-slate-400 py-10">No inspections.</p>}
              {visibleInspections.map(i => (
                <div key={i.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{i.subject}</p>
                      <p className="text-[11px] text-slate-500">
                        {batchNo(i.batchId)} · {i.inspectionType} · {i.inspectionDate}
                      </p>
                      <p className="text-[11px] text-slate-500">Inspector: {i.inspectorName}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${SEVERITY_COLORS[i.severity ?? 'observation']}`}>
                      {SEVERITY_LABELS[i.severity ?? 'observation']}
                    </span>
                  </div>
                  {i.observations && <p className="text-xs text-slate-600 mt-2 line-clamp-3">{i.observations}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {canWrite && canAccessBatch(me, i.batchId) && (
                      <button onClick={() => openFindingFor(i)}
                        className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded hover:bg-amber-200">
                        + Add Finding
                      </button>
                    )}
                    {(ccActive || (soActive && i.createdBy === me.uid && i.status === 'draft')) && (
                      <button onClick={() => removeInspection(i)} title="Delete draft"
                        className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Findings */}
          <div className="bg-white border border-slate-200 rounded-xl">
            <div className="px-4 py-3 border-b border-slate-100 font-bold text-sm text-slate-800 flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600" /> Findings &amp; Corrective Actions ({visibleFindings.length})
            </div>
            <div className="p-3 space-y-2 max-h-[520px] overflow-auto">
              {visibleFindings.length === 0 && <p className="text-center text-sm text-slate-400 py-10">No findings.</p>}
              {visibleFindings.map(f => (
                <div key={f.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{f.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {batchNo(f.batchId)} · {f.responsibleArea} → <b>{f.assignedToRole}</b>
                        {f.assignedToName ? ` (${f.assignedToName})` : ''} · due {f.dueDate}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${FINDING_STATUS_COLORS[f.status]}`}>
                      {FINDING_STATUS_LABELS[f.status]}
                    </span>
                  </div>
                  {f.correctiveAction && <p className="text-xs text-slate-600 mt-2"><b>Action:</b> {f.correctiveAction}</p>}
                  {f.status === 'rework' && f.reworkReason && (
                    <p className="text-[11px] text-orange-700 bg-orange-50 rounded p-1.5 mt-2"><b>Rework:</b> {f.reworkReason}</p>
                  )}
                  {f.verifiedByName && (
                    <p className="text-[10px] text-green-700 mt-1">✓ Verified by {f.verifiedByName}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {/* Responsible role acts */}
                    {!soActive && !ccActive && me.role === f.assignedToRole && f.status !== 'closed' && (
                      <>
                        {f.status === 'open' && (
                          <button onClick={() => transition(f, 'in_progress')}
                            className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded">Start Work</button>
                        )}
                        {(f.status === 'in_progress' || f.status === 'rework') && (
                          <button onClick={() => transition(f, 'submitted')}
                            className="text-[11px] font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">Submit for Verification</button>
                        )}
                      </>
                    )}
                    {/* SO/CC verify */}
                    {canWrite && canAccessBatch(me, f.batchId) && f.status !== 'closed' && (
                      <>
                        {f.status === 'submitted' && (
                          <>
                            <button onClick={() => transition(f, 'closed')}
                              className="flex items-center gap-1 text-[11px] font-bold bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">
                              <CheckCircle2 size={12} /> Verify &amp; Close
                            </button>
                            <button onClick={() => { setSelectedFinding(f); setShowReworkModal(true); }}
                              className="flex items-center gap-1 text-[11px] font-bold bg-orange-100 text-orange-800 px-2 py-1 rounded hover:bg-orange-200">
                              <RotateCcw size={12} /> Request Rework
                            </button>
                          </>
                        )}
                        {(ccActive || (soActive && f.createdBy === me.uid)) && (f.status === 'open' || f.status === 'rework') && (
                          <button onClick={() => removeFinding(f)} title="Delete"
                            className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── New Inspection Modal ── */}
      {showInspModal && (
        <Modal title="New Inspection" onClose={() => setShowInspModal(false)}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Batch *">
              <select className={inputCls} value={inspForm.batchId}
                onChange={e => setInspForm({ ...inspForm, batchId: e.target.value })}>
                {assignableBatches.map(b => <option key={b.id} value={b.id}>{b.batchNumber} — {b.batchName}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select className={inputCls} value={inspForm.inspectionType}
                onChange={e => setInspForm({ ...inspForm, inspectionType: e.target.value })}>
                {INSPECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Date"><input type="date" className={inputCls} value={inspForm.inspectionDate}
              onChange={e => setInspForm({ ...inspForm, inspectionDate: e.target.value })} /></Field>
            <Field label="Overall severity">
              <select className={inputCls} value={inspForm.severity}
                onChange={e => setInspForm({ ...inspForm, severity: e.target.value as Severity })}>
                {Object.entries(SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2"><Field label="Subject / area *">
              <input className={inputCls} value={inspForm.subject}
                onChange={e => setInspForm({ ...inspForm, subject: e.target.value })} placeholder="e.g. Morning PT turnout and attendance" />
            </Field></div>
            <div className="sm:col-span-2"><Field label="Observations">
              <textarea className={inputCls} rows={3} value={inspForm.observations}
                onChange={e => setInspForm({ ...inspForm, observations: e.target.value })} placeholder="What was observed during inspection…" />
            </Field></div>
            <div className="sm:col-span-2"><Field label="Remarks">
              <input className={inputCls} value={inspForm.remarks}
                onChange={e => setInspForm({ ...inspForm, remarks: e.target.value })} />
            </Field></div>
          </div>
          <ModalActions busy={busy} onSave={submitInspection} saveLabel="Save Inspection" onClose={() => setShowInspModal(false)} />
        </Modal>
      )}

      {/* ── New Finding Modal ── */}
      {showFindingModal && selectedInspection && (
        <Modal title={`Add Finding — ${selectedInspection.subject}`} onClose={() => setShowFindingModal(false)}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Field label="Finding title *">
              <input className={inputCls} value={findingForm.title}
                onChange={e => setFindingForm({ ...findingForm, title: e.target.value })}
                placeholder="e.g. Training attendance register not updated" />
            </Field></div>
            <div className="sm:col-span-2"><Field label="Description">
              <textarea className={inputCls} rows={2} value={findingForm.description}
                onChange={e => setFindingForm({ ...findingForm, description: e.target.value })} />
            </Field></div>
            <Field label="Severity">
              <select className={inputCls} value={findingForm.severity}
                onChange={e => setFindingForm({ ...findingForm, severity: e.target.value as Severity })}>
                {Object.entries(SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Responsible area">
              <input className={inputCls} value={findingForm.responsibleArea}
                onChange={e => setFindingForm({ ...findingForm, responsibleArea: e.target.value })} />
            </Field>
            <Field label="Assign to role">
              <select className={inputCls} value={findingForm.assignedToRole}
                onChange={e => setFindingForm({ ...findingForm, assignedToRole: e.target.value as ResponsibleRole })}>
                {RESPONSIBLE_ROLES.filter(r => r !== 'Senior Officer / Inspector').map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Assigned person (optional)">
              <input className={inputCls} value={findingForm.assignedToName}
                onChange={e => setFindingForm({ ...findingForm, assignedToName: e.target.value })} />
            </Field>
            <Field label="Due date">
              <input type="date" className={inputCls} value={findingForm.dueDate}
                onChange={e => setFindingForm({ ...findingForm, dueDate: e.target.value })} />
            </Field>
            <Field label="Category">
              <select className={inputCls} value={findingForm.category}
                onChange={e => setFindingForm({ ...findingForm, category: e.target.value })}>
                {INSPECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2"><Field label="Corrective action required *">
              <textarea className={inputCls} rows={2} value={findingForm.correctiveAction}
                onChange={e => setFindingForm({ ...findingForm, correctiveAction: e.target.value })}
                placeholder="e.g. Update register and submit for verification" />
            </Field></div>
          </div>
          <ModalActions busy={busy} onSave={submitFinding} saveLabel="Save Finding" onClose={() => setShowFindingModal(false)} />
        </Modal>
      )}

      {/* ── Rework Modal ── */}
      {showReworkModal && selectedFinding && (
        <Modal title="Request Rework" onClose={() => setShowReworkModal(false)}>
          <Field label="Reason for rework *">
            <textarea className={inputCls} rows={3}
              defaultValue={selectedFinding.reworkReason}
              id="reworkReason" placeholder="Why is the corrective action incomplete?" />
          </Field>
          <ModalActions busy={busy} saveLabel="Send for Rework" onClose={() => setShowReworkModal(false)}
            onSave={() => {
              const reason = (document.getElementById('reworkReason') as HTMLTextAreaElement)?.value ?? '';
              if (!reason.trim()) { setError('Rework reason zaroori hai.'); return; }
              transition(selectedFinding, 'rework', { reworkReason: reason });
            }} />
        </Modal>
      )}
    </div>
  );
};

// ── Small UI helpers ──
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-black text-slate-900">{title}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
      </div>
      {children}
    </div>
  </div>
);

const ModalActions: React.FC<{ busy: boolean; onSave: () => void; onClose: () => void; saveLabel: string }> =
  ({ busy, onSave, onClose, saveLabel }) => (
    <div className="flex justify-end gap-2 mt-4">
      <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
      <button onClick={onSave} disabled={busy}
        className="px-4 py-2 text-sm font-bold text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 disabled:opacity-50 flex items-center gap-2">
        {busy && <Loader2 size={14} className="animate-spin" />} {saveLabel}
      </button>
    </div>
  );

export default SOInspectionsScreen;
