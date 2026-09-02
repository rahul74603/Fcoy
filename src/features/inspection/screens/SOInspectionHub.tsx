// ═══════════════════════════════════════════════════════════════════════
// SO INSPECTION HUB — merged Dashboard + Inspections + Findings
// ───────────────────────────────────────────────────────────────────────
// Single page for Senior Officer / Inspector: stats overview at top,
// inspections list, findings/corrective actions, verification queue,
// overdue actions — all in one place.
// CC sees full oversight; other roles see assigned corrective actions.
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck, Plus, Search, ShieldAlert, CheckCircle2, RotateCcw,
  Loader2, X, FileSearch, AlertTriangle, Trash2, Layers, Users,
  Clock, CalendarCheck, ArrowRight, ChevronDown,
  Eye,
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
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { showDoc } from '../../../utils/devDataFilter';

const inputCls = 'w-full border border-slate-300 px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400';
const todayISO = () => localDateISOString();

// ── Stat Card ──
const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; tone: string; hint?: string; onClick?: () => void }> =
  ({ icon, label, value, tone, hint, onClick }) => (
    <div className={`bg-white border border-slate-200 rounded-xl p-4 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 transition-all' : ''}`}
      onClick={onClick}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`p-1.5 rounded-lg ${tone}`}>{icon}</span>
      </div>
      <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );

// ── Collapsible Section ──
const Section: React.FC<{
  title: string; subtitle?: string; icon: React.ReactNode; count?: number;
  accent?: string; defaultOpen?: boolean; action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}> = ({ title, subtitle, icon, count, accent = 'border-l-indigo-600', defaultOpen = true, action, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden border-l-4 ${accent}`}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-slate-500">{icon}</span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">{title}</p>
              {count !== undefined && count > 0 && (
                <span className="text-[9px] font-black bg-indigo-500 text-white px-2 py-0.5 rounded-full">{count}</span>
              )}
            </div>
            {subtitle && <p className="text-[9px] text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {action && (
            <span onClick={e => { e.stopPropagation(); action.onClick(); }}
              className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 uppercase bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 cursor-pointer">
              {action.label} <ArrowRight size={10} />
            </span>
          )}
          <div className={`transform transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
            <ChevronDown size={16} className="text-slate-400" />
          </div>
        </div>
      </button>
      <div className={`transition-all duration-300 ease-in-out ${open ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="px-5 pb-4">{children}</div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
const SOInspectionHub: React.FC = () => {
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
  const isResponsibleRole = !soActive && !ccActive; // Clerk/QM/Ustad viewing their assigned actions

  const assignableBatches = useMemo(() => {
    if (ccActive) return allBatches;
    return allBatches.filter(b => (me.assignedBatchIds ?? []).includes(b.id));
  }, [allBatches, ccActive, me.assignedBatchIds]);

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [strengthByBatch, setStrengthByBatch] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [batchFilter, setBatchFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [showInspModal, setShowInspModal] = useState(false);
  const [showFindingModal, setShowFindingModal] = useState(false);
  const [showReworkModal, setShowReworkModal] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [insp, fnd] = await Promise.all([
        getInspections(me).catch(e => {
          console.warn('Inspections load failed:', e);
          return [] as Inspection[];
        }),
        getFindings(me).catch(e => {
          console.warn('Findings load failed:', e);
          return [] as Finding[];
        }),
      ]);
      setInspections(insp);
      setFindings(fnd);

      // Trainee strength per batch
      const batchIds = assignableBatches.map(b => b.id);
      const strength: Record<string, number> = {};
      if (batchIds.length) {
        try {
          const snap = await getDocs(collection(db, 'trainees'));
          snap.docs.forEach(d => {
            const data = d.data() as Record<string, any>;
            if (!showDoc(data)) return;
            if (batchIds.includes(data.batchId)) {
              strength[data.batchId] = (strength[data.batchId] ?? 0) + 1;
            }
          });
        } catch (e) {
          console.warn('Trainee strength load failed:', e);
        }
      }
      setStrengthByBatch(strength);
    } catch (e: any) {
      setError(e?.message ?? 'Data load failed');
    } finally {
      setLoading(false);
    }
  }, [user, me, assignableBatches]);

  useEffect(() => { load(); }, [load]);

  const today = localDateISOString();

  // ── Stats ──
  const stats = useMemo(() => {
    const open = findings.filter(f => f.status !== 'closed');
    const critical = findings.filter(f => f.severity === 'critical' && f.status !== 'closed');
    const pendingVerify = findings.filter(f => f.status === 'submitted');
    const inProgress = findings.filter(f => f.status === 'in_progress' || f.status === 'open' || f.status === 'rework');
    const overdue = findings.filter(f => f.status !== 'closed' && f.dueDate && f.dueDate < today);
    const closed = findings.filter(f => f.status === 'closed');
    const total = findings.length || 0;
    const compliance = total ? Math.round((closed.length / total) * 100) : 100;
    return { open, critical, pendingVerify, inProgress, overdue, closed, compliance };
  }, [findings, today]);

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
    if (!inspForm.batchId || !inspForm.subject.trim()) { setError('Batch aur subject zaroori hai.'); return; }
    setBusy(true); setError('');
    try {
      const batch = allBatches.find(b => b.id === inspForm.batchId);
      await createInspection(me, {
        batchId: inspForm.batchId, batchNumber: batch?.batchNumber ?? '', batchName: batch?.batchName ?? '',
        inspectionType: inspForm.inspectionType, inspectionDate: inspForm.inspectionDate,
        subject: inspForm.subject, observations: inspForm.observations,
        status: 'submitted', severity: inspForm.severity, remarks: inspForm.remarks,
      });
      setShowInspModal(false); setInspForm(blankInsp); await load();
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
    setFindingForm({ ...blankFinding, category: String(insp.inspectionType ?? 'General'), responsibleArea: String(insp.inspectionType ?? '') });
    setShowFindingModal(true);
  };

  const submitFinding = async () => {
    if (!selectedInspection) return;
    if (!findingForm.title.trim() || !findingForm.correctiveAction.trim()) { setError('Finding title aur corrective action zaroori hai.'); return; }
    setBusy(true); setError('');
    try {
      await createFinding(me, {
        batchId: selectedInspection.batchId, batchNumber: selectedInspection.batchNumber,
        inspectionId: selectedInspection.id, category: findingForm.category,
        title: findingForm.title, description: findingForm.description,
        severity: findingForm.severity, responsibleArea: findingForm.responsibleArea,
        assignedToRole: findingForm.assignedToRole, assignedToName: findingForm.assignedToName,
        dueDate: findingForm.dueDate, correctiveAction: findingForm.correctiveAction,
      });
      setShowFindingModal(false); setSelectedInspection(null); setFindingForm(blankFinding); await load();
    } catch (e: any) { setError(e?.message ?? 'Save failed'); }
    finally { setBusy(false); }
  };

  const transition = async (f: Finding, to: 'in_progress' | 'submitted' | 'closed' | 'rework', extra?: any) => {
    setBusy(true); setError('');
    try {
      await updateFindingStatus(me, f.id, f, { to, actorName: me.displayName, ...extra } as any);
      setShowReworkModal(false); setSelectedFinding(null); await load();
    } catch (e: any) { setError(e?.message ?? 'Action failed'); }
    finally { setBusy(false); }
  };

  const removeInspection = async (i: Inspection) => {
    if (!window.confirm(`Inspection "${i.subject}" delete karein?`)) return;
    try { await deleteInspection(me, i); await load(); } catch (e: any) { setError(e?.message ?? 'Delete failed'); }
  };
  const removeFinding = async (f: Finding) => {
    if (!window.confirm(`Finding "${f.title}" delete karein?`)) return;
    try { await deleteFinding(me, f); await load(); } catch (e: any) { setError(e?.message ?? 'Delete failed'); }
  };

  // ── Filters ──
  const filteredInspections = useMemo(() => inspections.filter(i =>
    (batchFilter === 'ALL' || i.batchId === batchFilter) &&
    (!query || (i.subject + i.inspectorName + i.inspectionType).toLowerCase().includes(query.toLowerCase()))
  ), [inspections, batchFilter, query]);

  const filteredFindings = useMemo(() => findings.filter(f =>
    (batchFilter === 'ALL' || f.batchId === batchFilter) &&
    (statusFilter === 'ALL' || f.status === statusFilter) &&
    (!query || (f.title + f.assignedToRole + f.responsibleArea).toLowerCase().includes(query.toLowerCase()))
  ), [findings, batchFilter, statusFilter, query]);

  // For responsible roles (Clerk/QM/Ustad), only show their assigned findings
  const myFindings = useMemo(() => {
    if (!isResponsibleRole) return filteredFindings;
    return filteredFindings.filter(f => f.assignedToRole === me.role);
  }, [filteredFindings, isResponsibleRole, me.role]);

  const batchNo = (id: string) => allBatches.find(b => b.id === id)?.batchNumber ?? id;

  const totalStrength = Object.values(strengthByBatch).reduce((s, n) => s + n, 0);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-700" size={28} /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-10">

      {/* ═══ HEADER ═══ */}
      <div className="bg-gradient-to-r from-indigo-800 to-indigo-600 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black flex items-center gap-2">
              <ClipboardCheck size={22} /> Inspections &amp; Oversight
            </h1>
            <p className="text-indigo-100 text-sm mt-1">
              {ccActive ? 'Commander oversight — all batches & inspections'
              : soActive ? 'Senior Officer — inspection, findings & corrective actions'
              : `${me.role} — assigned corrective actions`}
            </p>
          </div>
          {canWrite && assignableBatches.length > 0 && (
            <button onClick={() => setShowInspModal(true)}
              className="flex items-center gap-2 bg-white text-indigo-800 px-4 py-2 text-sm font-bold rounded-lg hover:bg-indigo-50">
              <Plus size={16} /> New Inspection
            </button>
          )}
        </div>
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

      {/* ═══ STATS GRID ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Layers size={16} className="text-indigo-700" />} tone="bg-indigo-50"
          label="Assigned Batches" value={assignableBatches.length} />
        <StatCard icon={<AlertTriangle size={16} className="text-red-600" />} tone="bg-red-50"
          label="Open Findings" value={stats.open.length} />
        <StatCard icon={<ShieldAlert size={16} className="text-orange-600" />} tone="bg-orange-50"
          label="Critical Open" value={stats.critical.length} />
        <StatCard icon={<Clock size={16} className="text-amber-600" />} tone="bg-amber-50"
          label="Overdue Actions" value={stats.overdue.length} hint="past due date" />
        <StatCard icon={<CheckCircle2 size={16} className="text-blue-600" />} tone="bg-blue-50"
          label="Verification Pending" value={stats.pendingVerify.length} />
        <StatCard icon={<CalendarCheck size={16} className="text-green-600" />} tone="bg-green-50"
          label="Total Inspections" value={inspections.length} />
        <StatCard icon={<Users size={16} className="text-slate-600" />} tone="bg-slate-100"
          label="Trainee Strength" value={totalStrength} />
        <StatCard icon={<CheckCircle2 size={16} className="text-green-700" />} tone="bg-green-50"
          label="Compliance" value={`${stats.compliance}%`} hint="findings closed" />
      </div>

      {/* ═══ FILTERS ═══ */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search subject, inspector, finding…"
            className={`${inputCls} pl-9`} />
        </div>
        <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} className={`${inputCls} sm:w-56`}>
          <option value="ALL">All assigned batches</option>
          {assignableBatches.map(b => <option key={b.id} value={b.id}>{b.batchNumber} — {b.batchName}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${inputCls} sm:w-44`}>
          <option value="ALL">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="submitted">Submitted</option>
          <option value="rework">Rework</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* ═══ ASSIGNED BATCHES ═══ */}
      {assignableBatches.length > 0 && (
        <Section title="Assigned Batches" subtitle={`${assignableBatches.length} batch(es) under supervision`}
          icon={<Layers size={14} />} accent="border-l-indigo-500" defaultOpen={false}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {assignableBatches.map(b => (
              <div key={b.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{b.batchNumber} — {b.batchName}</p>
                  <p className="text-[11px] text-slate-500 capitalize">{b.status}</p>
                </div>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                  {strengthByBatch[b.id] ?? 0} trainees
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ═══ VERIFICATION QUEUE (SO/CC only) ═══ */}
      {canWrite && stats.pendingVerify.length > 0 && (
        <Section title="Verification Queue" subtitle={`${stats.pendingVerify.length} findings awaiting review`}
          icon={<Eye size={14} />} count={stats.pendingVerify.length} accent="border-l-blue-500">
          <div className="space-y-2">
            {stats.pendingVerify.map(f => (
              <div key={f.id} className="border border-blue-200 bg-blue-50/50 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{f.title}</p>
                    <p className="text-[11px] text-slate-500">{batchNo(f.batchId)} · {f.assignedToRole}{f.assignedToName ? ` (${f.assignedToName})` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => transition(f, 'closed')}
                      className="flex items-center gap-1 text-[11px] font-bold bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">
                      <CheckCircle2 size={12} /> Verify &amp; Close
                    </button>
                    <button onClick={() => { setSelectedFinding(f); setShowReworkModal(true); }}
                      className="flex items-center gap-1 text-[11px] font-bold bg-orange-100 text-orange-800 px-2 py-1 rounded hover:bg-orange-200">
                      <RotateCcw size={12} /> Rework
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ═══ OVERDUE ACTIONS ═══ */}
      {stats.overdue.length > 0 && (
        <Section title="Overdue Corrective Actions" subtitle={`${stats.overdue.length} actions past due date`}
          icon={<Clock size={14} />} count={stats.overdue.length} accent="border-l-amber-500">
          <div className="space-y-2">
            {stats.overdue.map(f => (
              <div key={f.id} className="border border-amber-200 bg-amber-50/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{f.title}</p>
                    <p className="text-[11px] text-slate-500">Due {f.dueDate} · {f.assignedToRole}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${FINDING_STATUS_COLORS[f.status]}`}>
                    {FINDING_STATUS_LABELS[f.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ═══ INSPECTIONS + FINDINGS ═══ */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Inspections */}
        <Section title="Inspections" subtitle={`${filteredInspections.length} inspection events`}
          icon={<FileSearch size={14} />} count={filteredInspections.length} accent="border-l-indigo-600"
          defaultOpen={true}>
          <div className="space-y-2 max-h-[520px] overflow-auto">
            {filteredInspections.length === 0 && <p className="text-center text-sm text-slate-400 py-10">No inspections.</p>}
            {filteredInspections.map(i => (
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
        </Section>

        {/* Findings / Corrective Actions */}
        <Section title="Findings & Corrective Actions" subtitle={`${myFindings.length} findings`}
          icon={<AlertTriangle size={14} />} count={myFindings.length} accent="border-l-amber-600"
          defaultOpen={true}>
          <div className="space-y-2 max-h-[520px] overflow-auto">
            {myFindings.length === 0 && <p className="text-center text-sm text-slate-400 py-10">No findings.</p>}
            {myFindings.map(f => (
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
                {f.verifiedByName && <p className="text-[10px] text-green-700 mt-1">✓ Verified by {f.verifiedByName}</p>}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {/* Responsible role actions */}
                  {isResponsibleRole && me.role === f.assignedToRole && f.status !== 'closed' && (
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
                            <RotateCcw size={12} /> Rework
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
        </Section>
      </div>

      {/* ═══ RECENTLY CLOSED ═══ */}
      {stats.closed.length > 0 && (
        <Section title="Recently Closed / Verified" subtitle={`${stats.closed.length} findings resolved`}
          icon={<CheckCircle2 size={14} />} accent="border-l-green-500" defaultOpen={false}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {stats.closed.sort((a, b) => (b.verifiedAt ?? '').localeCompare(a.verifiedAt ?? '')).slice(0, 12).map(f => (
              <div key={f.id} className="border border-green-200 bg-green-50/50 rounded-lg p-3">
                <p className="text-sm font-bold text-slate-900">{f.title}</p>
                <p className="text-[11px] text-slate-500">✓ {f.verifiedByName ?? 'Verified'} · {f.verifiedAt?.slice(0, 10)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ═══ MODALS ═══ */}
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
                onChange={e => setInspForm({ ...inspForm, subject: e.target.value })} placeholder="e.g. Morning PT turnout" />
            </Field></div>
            <div className="sm:col-span-2"><Field label="Observations">
              <textarea className={inputCls} rows={3} value={inspForm.observations}
                onChange={e => setInspForm({ ...inspForm, observations: e.target.value })} />
            </Field></div>
            <div className="sm:col-span-2"><Field label="Remarks">
              <input className={inputCls} value={inspForm.remarks}
                onChange={e => setInspForm({ ...inspForm, remarks: e.target.value })} />
            </Field></div>
          </div>
          <ModalActions busy={busy} onSave={submitInspection} saveLabel="Save Inspection" onClose={() => setShowInspModal(false)} />
        </Modal>
      )}

      {showFindingModal && selectedInspection && (
        <Modal title={`Add Finding — ${selectedInspection.subject}`} onClose={() => setShowFindingModal(false)}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Field label="Finding title *">
              <input className={inputCls} value={findingForm.title}
                onChange={e => setFindingForm({ ...findingForm, title: e.target.value })}
                placeholder="e.g. Attendance register not updated" />
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

      {showReworkModal && selectedFinding && (
        <Modal title="Request Rework" onClose={() => setShowReworkModal(false)}>
          <Field label="Reason for rework *">
            <textarea className={inputCls} rows={3} defaultValue={selectedFinding.reworkReason}
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

export default SOInspectionHub;
