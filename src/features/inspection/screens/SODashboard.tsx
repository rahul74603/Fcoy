// ═══════════════════════════════════════════════════════════════════════
// SO DASHBOARD — Senior Officer / Inspector oversight
// ───────────────────────────────────────────────────────────────────────
// Operational inspection view: assigned batches & strength, recent
// inspections, open/critical findings, pending/overdue corrective actions,
// recently closed, verification queue, compliance status.
// No finance/admin information.
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck, AlertTriangle, CheckCircle2, Clock, ShieldAlert,
  Layers, Users, ArrowRight, Loader2, CalendarCheck,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useBatch } from '../../../contexts/BatchContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { showDoc } from '../../../utils/devDataFilter';
import { getInspections, getFindings, type AppUserLike } from '../api/inspection.api';
import {
  SEVERITY_COLORS, SEVERITY_LABELS, FINDING_STATUS_LABELS, FINDING_STATUS_COLORS,
  type Inspection, type Finding,
} from '../types/inspection.types';
import { localDateISOString } from '../../../utils/localDate';

const Card: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; tone: string; hint?: string }> =
  ({ icon, label, value, tone, hint }) => (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`p-1.5 rounded-lg ${tone}`}>{icon}</span>
      </div>
      <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );

const SODashboard: React.FC = () => {
  const { user } = useAuth();
  const { allBatches } = useBatch();

  const me: AppUserLike = useMemo(() => ({
    uid: user?.uid ?? '',
    role: user?.role ?? '',
    displayName: user?.displayName ?? user?.name ?? '',
    name: user?.name ?? '',
    assignedBatchIds: user?.assignedBatchIds ?? [],
  }), [user]);

  const isCC = me.role === 'Company Commander';
  const assignedBatches = useMemo(
    () => (isCC ? allBatches : allBatches.filter(b => (me.assignedBatchIds ?? []).includes(b.id))),
    [allBatches, isCC, me.assignedBatchIds],
  );

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [strengthByBatch, setStrengthByBatch] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [insp, fnd] = await Promise.all([getInspections(me), getFindings(me)]);
      setInspections(insp);
      setFindings(fnd);

      // Trainee strength per assigned batch.
      const batchIds = assignedBatches.map(b => b.id);
      const strength: Record<string, number> = {};
      if (batchIds.length) {
        const snap = await getDocs(collection(db, 'trainees'));
        snap.docs.forEach(d => {
          const data = d.data() as Record<string, any>;
          if (!showDoc(data)) return;
          if (batchIds.includes(data.batchId)) {
            strength[data.batchId] = (strength[data.batchId] ?? 0) + 1;
          }
        });
      }
      setStrengthByBatch(strength);
    } catch {
      /* surfaced via empty states */
    } finally {
      setLoading(false);
    }
  }, [me, assignedBatches]);

  useEffect(() => { load(); }, [load]);

  const today = localDateISOString();

  const stats = useMemo(() => {
    const open = findings.filter(f => f.status !== 'closed');
    const critical = findings.filter(f => f.severity === 'critical' && f.status !== 'closed');
    const pendingVerify = findings.filter(f => f.status === 'submitted');
    const inProgress = findings.filter(f => f.status === 'in_progress' || f.status === 'open' || f.status === 'rework');
    const overdue = findings.filter(f =>
      f.status !== 'closed' && f.dueDate && f.dueDate < today);
    const closedRecent = findings
      .filter(f => f.status === 'closed')
      .sort((a, b) => (b.verifiedAt ?? '').localeCompare(a.verifiedAt ?? ''))
      .slice(0, 6);
    const total = findings.length || 0;
    const closed = findings.filter(f => f.status === 'closed').length;
    const compliance = total ? Math.round((closed / total) * 100) : 100;
    return { open, critical, pendingVerify, inProgress, overdue, closedRecent, compliance };
  }, [findings, today]);

  const recentInspections = useMemo(
    () => [...inspections].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 6),
    [inspections],
  );

  const batchNo = (id: string) => allBatches.find(b => b.id === id)?.batchNumber ?? id;

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-700" size={28} /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-800 to-indigo-600 rounded-xl p-5 text-white">
        <h1 className="text-xl font-black flex items-center gap-2">
          <ClipboardCheck size={22} /> Inspection &amp; Supervision Dashboard
        </h1>
        <p className="text-indigo-100 text-sm mt-1">
          {isCC ? 'Commander oversight — all batches' : 'Senior Officer / Inspector — assigned batches'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card icon={<Layers size={16} className="text-indigo-700" />} tone="bg-indigo-50"
          label="Assigned Batches" value={assignedBatches.length} />
        <Card icon={<AlertTriangle size={16} className="text-red-600" />} tone="bg-red-50"
          label="Open Findings" value={stats.open.length} />
        <Card icon={<ShieldAlert size={16} className="text-orange-600" />} tone="bg-orange-50"
          label="Critical Open" value={stats.critical.length} />
        <Card icon={<Clock size={16} className="text-amber-600" />} tone="bg-amber-50"
          label="Overdue Actions" value={stats.overdue.length} hint="past due date" />
        <Card icon={<CheckCircle2 size={16} className="text-blue-600" />} tone="bg-blue-50"
          label="Verification Pending" value={stats.pendingVerify.length} />
        <Card icon={<CalendarCheck size={16} className="text-green-600" />} tone="bg-green-50"
          label="Inspections" value={inspections.length} />
        <Card icon={<Users size={16} className="text-slate-600" />} tone="bg-slate-100"
          label="Trainee Strength" value={Object.values(strengthByBatch).reduce((s, n) => s + n, 0)} />
        <Card icon={<CheckCircle2 size={16} className="text-green-700" />} tone="bg-green-50"
          label="Compliance" value={`${stats.compliance}%`} hint="findings closed" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Assigned batches */}
        <div className="bg-white border border-slate-200 rounded-xl">
          <div className="px-4 py-3 border-b border-slate-100 font-bold text-sm flex items-center justify-between">
            <span>Assigned Batches</span>
            <Link to="/so-inspections" className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
              Inspections <ArrowRight size={12} /></Link>
          </div>
          <div className="p-3 space-y-2">
            {assignedBatches.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">No assigned batches.</p>}
            {assignedBatches.map(b => (
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
        </div>

        {/* Recent inspections */}
        <div className="bg-white border border-slate-200 rounded-xl">
          <div className="px-4 py-3 border-b border-slate-100 font-bold text-sm">Recent Inspections</div>
          <div className="p-3 space-y-2">
            {recentInspections.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">No inspections yet.</p>}
            {recentInspections.map(i => (
              <div key={i.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{i.subject}</p>
                    <p className="text-[11px] text-slate-500">{batchNo(i.batchId)} · {i.inspectionType} · {i.inspectionDate}</p>
                  </div>
                  {i.severity && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${SEVERITY_COLORS[i.severity]}`}>
                      {SEVERITY_LABELS[i.severity]}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action queues */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl">
          <div className="px-4 py-3 border-b border-slate-100 font-bold text-sm text-blue-800">
            Verification Queue ({stats.pendingVerify.length})
          </div>
          <div className="p-3 space-y-2">
            {stats.pendingVerify.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">Nothing awaiting verification.</p>}
            {stats.pendingVerify.map(f => (
              <div key={f.id} className="border border-blue-200 bg-blue-50/50 rounded-lg p-3">
                <p className="text-sm font-bold text-slate-900">{f.title}</p>
                <p className="text-[11px] text-slate-500">{batchNo(f.batchId)} · {f.assignedToRole}</p>
                <Link to="/so-inspections" className="text-[11px] font-bold text-blue-700">Review →</Link>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl">
          <div className="px-4 py-3 border-b border-slate-100 font-bold text-sm text-amber-800">
            Overdue Corrective Actions ({stats.overdue.length})
          </div>
          <div className="p-3 space-y-2">
            {stats.overdue.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">No overdue actions.</p>}
            {stats.overdue.map(f => (
              <div key={f.id} className="border border-amber-200 bg-amber-50/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900">{f.title}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${FINDING_STATUS_COLORS[f.status]}`}>
                    {FINDING_STATUS_LABELS[f.status]}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">Due {f.dueDate} · {f.assignedToRole}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recently closed */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="px-4 py-3 border-b border-slate-100 font-bold text-sm text-green-800">Recently Closed / Verified</div>
        <div className="p-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {stats.closedRecent.length === 0 && <p className="text-sm text-slate-400 py-6 text-center col-span-full">No closed findings yet.</p>}
          {stats.closedRecent.map(f => (
            <div key={f.id} className="border border-green-200 bg-green-50/50 rounded-lg p-3">
              <p className="text-sm font-bold text-slate-900">{f.title}</p>
              <p className="text-[11px] text-slate-500">✓ {f.verifiedByName ?? 'Verified'} · {f.verifiedAt?.slice(0, 10)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SODashboard;
