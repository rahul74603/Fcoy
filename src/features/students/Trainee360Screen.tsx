// ═══════════════════════════════════════════════════════════
// TRAINEE 360° SCREEN
// ───────────────────────────────────────────────────────────
// All trainees at a glance — search, filter, click for full
// profile modal. Replaces the old Trainee 360 page that was
// lost during refactoring.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, RefreshCw, Eye,
  CheckCircle2, AlertCircle, XCircle, Loader2, X,
  FileText, Package, HeartPulse,
  Activity, Download,
} from 'lucide-react';
import {
  collection, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useBatch } from '../../contexts/BatchContext';
import { useAuth } from '../../contexts/AuthContext';
import { normalizePlatoon, PLATOON_OPTIONS } from '../../utils/platoon';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const REQUIRED_DOCS = [
  'aadharCard', 'domicileCertificate', 'marksheet10th',
  'characterCertificate', 'medicalFitnessCert', 'eyeTestReport',
  'bloodGroupReport', 'policeVerification', 'noCriminalRecord',
  'passportPhoto', 'fullBodyPhoto', 'bankPassbook',
  'recruitmentAdmitCard', 'offerLetter',
];

const DOC_LABELS: Record<string, string> = {
  aadharCard: 'Aadhar Card', domicileCertificate: 'Domicile',
  marksheet10th: '10th Marksheet', characterCertificate: 'Character Cert',
  medicalFitnessCert: 'Medical Fitness', eyeTestReport: 'Eye Test',
  bloodGroupReport: 'Blood Group', policeVerification: 'Police Verif',
  noCriminalRecord: 'No Criminal', passportPhoto: 'Passport Photo',
  fullBodyPhoto: 'Full Body', bankPassbook: 'Bank Passbook',
  recruitmentAdmitCard: 'Admit Card', offerLetter: 'Offer Letter',
};

const FIXED_TRAINING_ITEMS = [
  'DM Shoes', 'PT Shoes', 'Ankle Shoes', 'PT T-Shirt',
  'Ground Sheet', 'Plate', 'Glass', 'Bucket', 'Mug',
  'Mess Tin', 'Mosquito Net', 'Water Bottle', 'Towel', 'Lock',
];

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface Trainee360 {
  id: string;
  name: string;
  chestNo: string;
  regNo: string;
  platoon: string;
  rank: string;
  fatherName: string;
  rifleNo: string;
  attn: string;
  docsComplete: boolean;
  issuedKitItems: any[];
  documents: any;
  fptResult: string;
  weeklyExamResult: string;
  sickReports: number;
  batchId: string;
  state?: string;
  bloodGroup?: string;
  mobileNo?: string;
}

interface AbsentRecord {
  id: string;
  traineeId: string;
  type: string;
  reason: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  status: string;
}

interface MedicalRecord {
  id: string;
  traineeId: string;
  category: string;
  diagnosis: string;
  status: string;
  date: string;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const normalizeName = (v: string) => (v || '').trim().toLowerCase();
const fmtCurrency = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

const ATTN_MAP: Record<string, { text: string; cls: string; bg: string; icon: string }> = {
  'P': { text: 'Present', cls: 'text-green-700', bg: 'bg-green-100', icon: '✓' },
  'A': { text: 'Absent', cls: 'text-red-700', bg: 'bg-red-100', icon: '🚫' },
  'L': { text: 'Leave', cls: 'text-amber-700', bg: 'bg-amber-100', icon: '✈️' },
  'S': { text: 'Sick', cls: 'text-orange-700', bg: 'bg-orange-100', icon: '🤒' },
  'H': { text: 'Hospital', cls: 'text-purple-700', bg: 'bg-purple-100', icon: '🏥' },
  'R': { text: 'B/C Rest', cls: 'text-blue-700', bg: 'bg-blue-100', icon: '🛌' },
  'M': { text: 'Med Appt', cls: 'text-teal-700', bg: 'bg-teal-100', icon: '🩺' },
};

const getAttnInfo = (code: string) =>
  ATTN_MAP[code] || { text: code, cls: 'text-slate-600', bg: 'bg-slate-100', icon: '❓' };

// ─────────────────────────────────────────────
// TRAINEE DETAIL MODAL
// ─────────────────────────────────────────────
const TraineeDetailModal: React.FC<{
  trainee: Trainee360;
  absentRecords: AbsentRecord[];
  medicalRecords: MedicalRecord[];
  kitTotal: number;
  onClose: () => void;
  onNavigate: (path: string) => void;
}> = ({ trainee, absentRecords, medicalRecords, kitTotal, onClose, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'docs' | 'kit' | 'medical' | 'absent'>('overview');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [onClose]);

  const attnCode = trainee.attn || 'P';
  const attnInfo = getAttnInfo(attnCode);
  const isAway = attnCode !== 'P';

  // Docs
  const docStatuses = REQUIRED_DOCS.map(key => {
    const d = trainee.documents?.[key];
    return { key, label: DOC_LABELS[key] || key, status: d?.status || (d?.fileName ? 'Uploaded' : 'Pending') };
  });
  const docsDone = docStatuses.filter(d => d.status === 'Uploaded' || d.status === 'Verified').length;

  // Kit
  const issuedNames = (trainee.issuedKitItems || []).map((i: any) => normalizeName(i.itemName));
  const kitIssued = FIXED_TRAINING_ITEMS.filter(name => issuedNames.includes(normalizeName(name))).length;

  // Active medical
  const activeMed = medicalRecords.filter(m => m.status === 'Active');
  const activeAbs = absentRecords.filter(r => r.status === 'Active');

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <Eye size={11} /> },
    { key: 'docs', label: 'Documents', icon: <FileText size={11} />, count: `${docsDone}/${REQUIRED_DOCS.length}` },
    { key: 'kit', label: 'Kit Issue', icon: <Package size={11} />, count: `${kitIssued}/${kitTotal}` },
    { key: 'medical', label: 'Medical', icon: <HeartPulse size={11} />, count: activeMed.length > 0 ? String(activeMed.length) : null },
    { key: 'absent', label: 'Absence', icon: <Activity size={11} />, count: activeAbs.length > 0 ? String(activeAbs.length) : null },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-start justify-center p-4 pt-6 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white shadow-2xl max-w-3xl w-full rounded-2xl overflow-hidden animate-slideUp mb-6"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-r from-military-900 via-military-800 to-military-900 text-white px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-black uppercase tracking-wider">{trainee.rank || 'RCT'} {trainee.name}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-[10px] text-white/70 bg-white/10 px-2 py-0.5 rounded font-mono border border-white/20">Chest: {trainee.chestNo}</span>
                <span className="text-[10px] text-white/70 bg-white/10 px-2 py-0.5 rounded font-mono border border-white/20">Reg: {trainee.regNo || '—'}</span>
                <span className="text-[10px] text-white/70 bg-white/10 px-2 py-0.5 rounded border border-white/20">Platoon: {trainee.platoon || '—'}</span>
                {trainee.state && <span className="text-[10px] text-white/70 bg-white/10 px-2 py-0.5 rounded border border-white/20">📍 {trainee.state}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black px-3 py-1 rounded-full ${attnInfo.bg} ${attnInfo.cls}`}>
                {attnInfo.icon} {attnInfo.text}
              </span>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <X size={16} className="text-white" />
              </button>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-5 gap-2 mt-4">
            {[
              { label: 'FPT', value: trainee.fptResult || '—', color: trainee.fptResult === 'Pass' ? 'text-green-400' : trainee.fptResult === 'Fail' ? 'text-red-400' : 'text-white/50' },
              { label: 'Tests', value: trainee.weeklyExamResult || '—', color: trainee.weeklyExamResult === 'Pass' ? 'text-green-400' : trainee.weeklyExamResult === 'Fail' ? 'text-red-400' : 'text-white/50' },
              { label: 'Docs', value: `${docsDone}/${REQUIRED_DOCS.length}`, color: docsDone >= REQUIRED_DOCS.length ? 'text-green-400' : 'text-amber-400' },
              { label: 'Kit', value: `${kitIssued}/${kitTotal}`, color: kitIssued >= kitTotal ? 'text-green-400' : 'text-amber-400' },
              { label: 'Medical', value: activeMed.length > 0 ? `${activeMed.length} Active` : 'Clear', color: activeMed.length > 0 ? 'text-red-400' : 'text-green-400' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 rounded-lg px-2 py-1.5 text-center border border-white/10">
                <p className="text-[8px] font-bold text-white/50 uppercase">{s.label}</p>
                <p className={`text-[10px] font-black mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-[10px] font-black uppercase border-b-2 whitespace-nowrap transition-all ${
                activeTab === t.key ? 'border-military-700 text-military-900 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}>
              {t.icon} <span>{t.label}</span>
              {t.count && (
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-mono ${
                  activeTab === t.key ? 'bg-military-100 text-military-700' : 'bg-slate-100 text-slate-500'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5 max-h-[50vh] overflow-y-auto bg-slate-50/30">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Personal Details</h4>
                <div className="bg-white rounded-xl p-4 border border-slate-100 space-y-2.5">
                  {[
                    { l: 'Full Name', v: `${trainee.rank || 'RCT'} ${trainee.name}`, icon: '👤' },
                    { l: "Father's Name", v: trainee.fatherName || '—', icon: '👨' },
                    { l: 'Chest No', v: trainee.chestNo, icon: '#️⃣' },
                    { l: 'Registration', v: trainee.regNo || '—', icon: '📋' },
                    { l: 'Platoon', v: trainee.platoon || '—', icon: '🏷️' },
                    { l: 'Rifle No', v: trainee.rifleNo || '—', icon: '🔫' },
                    { l: 'State', v: trainee.state || '—', icon: '📍' },
                    { l: 'Blood Group', v: trainee.bloodGroup || '—', icon: '🩸' },
                    { l: 'Mobile', v: trainee.mobileNo || '—', icon: '📱' },
                  ].map(f => (
                    <div key={f.l} className="flex items-center justify-between text-[11px] border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
                      <span className="text-slate-500 font-semibold flex items-center gap-1.5"><span>{f.icon}</span> {f.l}</span>
                      <span className="font-bold text-slate-800">{f.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Status</h4>
                <div className="bg-white rounded-xl p-4 border border-slate-100 space-y-3">
                  <ProgressBar value={docsDone} max={REQUIRED_DOCS.length} label="Documents"
                    color={docsDone >= REQUIRED_DOCS.length ? 'bg-green-500' : 'bg-amber-500'} />
                  <ProgressBar value={kitIssued} max={kitTotal} label="Kit Items"
                    color={kitIssued >= kitTotal ? 'bg-green-500' : 'bg-blue-500'} />
                </div>
                {activeMed.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-red-700 uppercase mb-1.5">🏥 Active Medical</p>
                    {activeMed.map(m => <p key={m.id} className="text-[10px] text-red-600">• {m.category}: {m.diagnosis}</p>)}
                  </div>
                )}
                {isAway && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-amber-700 uppercase mb-1.5">{attnInfo.icon} Currently Away</p>
                    {activeAbs.map(r => (
                      <p key={r.id} className="text-[10px] text-amber-600">
                        {r.type === 'A' ? 'Absent' : r.type === 'L' ? 'Leave' : r.type === 'S' ? 'Sick' : r.type}: {r.reason || '—'} ({r.fromDate} → {r.toDate})
                      </p>
                    ))}
                  </div>
                )}
                {activeMed.length === 0 && !isAway && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <CheckCircle2 size={24} className="mx-auto text-green-400 mb-1.5" />
                    <p className="text-[11px] text-green-700 font-bold">All Clear! 🎉</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="space-y-1.5">
              <div className="mb-3">
                <ProgressBar value={docsDone} max={REQUIRED_DOCS.length} label="Document Progress"
                  color={docsDone >= REQUIRED_DOCS.length ? 'bg-green-500' : 'bg-blue-500'} height={8} />
              </div>
              {docStatuses.map(d => (
                <div key={d.key} className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
                  d.status === 'Verified' ? 'bg-green-50 border-green-200'
                  : d.status === 'Uploaded' ? 'bg-blue-50 border-blue-200'
                  : d.status === 'Rejected' ? 'bg-red-50 border-red-200'
                  : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center gap-3">
                    {d.status === 'Verified' ? <CheckCircle2 size={14} className="text-green-500" />
                    : d.status === 'Uploaded' ? <Eye size={14} className="text-blue-500" />
                    : d.status === 'Rejected' ? <XCircle size={14} className="text-red-500" />
                    : <AlertCircle size={14} className="text-slate-300" />}
                    <span className="text-[11px] font-bold text-slate-700">{d.label}</span>
                  </div>
                  <span className={`text-[9px] font-bold px-2.5 py-1 rounded-lg ${
                    d.status === 'Verified' ? 'bg-green-600 text-white'
                    : d.status === 'Uploaded' ? 'bg-blue-600 text-white'
                    : d.status === 'Rejected' ? 'bg-red-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                  }`}>{d.status}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'kit' && (
            <div className="space-y-1.5">
              <div className="mb-3">
                <ProgressBar value={kitIssued} max={kitTotal} label="Kit Issue Progress"
                  color={kitIssued >= kitTotal ? 'bg-green-500' : 'bg-indigo-500'} height={8} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {FIXED_TRAINING_ITEMS.map(name => {
                  const issued = issuedNames.includes(normalizeName(name));
                  return (
                    <div key={name} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${
                      issued ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        {issued ? <CheckCircle2 size={13} className="text-green-500" /> : <XCircle size={13} className="text-red-400" />}
                        <span className="text-[10px] font-bold text-slate-700">{name}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${
                        issued ? 'bg-green-600 text-white' : 'bg-red-100 text-red-600'
                      }`}>{issued ? '✓ Received' : 'Pending'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'medical' && (
            medicalRecords.length === 0 ? (
              <div className="text-center py-10">
                <HeartPulse size={32} className="mx-auto text-green-300 mb-2" />
                <p className="text-[11px] text-green-600 font-bold">Medically Fit! ✅</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {medicalRecords.map(r => (
                  <div key={r.id} className={`px-4 py-3 rounded-xl border ${
                    r.status === 'Active' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800">{r.category}: {r.diagnosis}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${
                        r.status === 'Active' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                      }`}>{r.status === 'Active' ? '● Active' : '✓ Fit'}</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-1">{r.date}</p>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'absent' && (
            absentRecords.length === 0 ? (
              <div className="text-center py-10">
                <Activity size={32} className="mx-auto text-green-300 mb-2" />
                <p className="text-[11px] text-green-600 font-bold">No absence records! ✅</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {absentRecords.map(r => {
                  const info = getAttnInfo(r.type);
                  return (
                    <div key={r.id} className={`px-4 py-3 rounded-xl border ${
                      r.status === 'Active' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${info.bg} ${info.cls}`}>{info.icon} {info.text}</span>
                          <span className="text-[10px] font-mono text-slate-500">{r.fromDate} → {r.toDate}</span>
                          <span className="text-[10px] font-bold text-slate-600">({r.totalDays}d)</span>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${
                          r.status === 'Active' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                        }`}>{r.status}</span>
                      </div>
                      {r.reason && <p className="text-[10px] text-slate-600 mt-1 ml-1">{r.reason}</p>}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => { onClose(); onNavigate('/profile'); }}
              className="text-[10px] font-bold text-military-600 bg-military-50 px-3 py-1.5 rounded-lg border border-military-200 hover:bg-military-100">
              Full Profile →
            </button>
            <button onClick={() => { onClose(); onNavigate('/documents'); }}
              className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100">
              Documents →
            </button>
          </div>
          <button onClick={onClose}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white px-4 py-1.5 rounded-lg border border-slate-200">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────
const ProgressBar: React.FC<{
  value: number; max: number; color?: string; height?: number; label: string;
}> = ({ value, max, color = 'bg-green-500', height = 6, label }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[9px] font-bold text-slate-500 uppercase">{label}</span>
        <span className="text-[9px] font-black text-slate-700">{value}/{max} ({Math.round(pct)}%)</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full overflow-hidden" style={{ height }}>
        <div className={`${color} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${pct}%`, height: '100%' }} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════
export const Trainee360Screen: React.FC = () => {
  const navigate = useNavigate();
  const go = useCallback((path: string) => navigate(path), [navigate]);
  const { currentBatch: activeBatch, allBatches } = useBatch();
  const { user } = useAuth();

  const [trainees, setTrainees] = useState<Trainee360[]>([]);
  const [absentRecords, setAbsentRecords] = useState<AbsentRecord[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [recoveryRecords, setRecoveryRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [platoonFilter, setPlatoonFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedTrainee, setSelectedTrainee] = useState<Trainee360 | null>(null);
  const [batchFilter, setBatchFilter] = useState<string>('');

  const canViewAllBatches = user?.role === 'Company Commander';
  const platoons = useMemo(() => ['ALL', ...PLATOON_OPTIONS], []);

  // Set default batch
  useEffect(() => {
    if (activeBatch && !batchFilter) setBatchFilter(activeBatch.id);
  }, [activeBatch, batchFilter]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const batchId = batchFilter || activeBatch?.id;
      const traineeQuery = batchId
        ? query(collection(db, 'trainees'), where('batchId', '==', batchId))
        : collection(db, 'trainees');

      const [traineesSnap, absentSnap, medicalSnap, recoverySnap] = await Promise.all([
        getDocs(traineeQuery),
        getDocs(collection(db, 'absentRecords')),
        getDocs(collection(db, 'medicalRecords')),
        getDocs(collection(db, 'training_fund_recoveries')),
      ]);

      const tList: Trainee360[] = [];
      traineesSnap.forEach(d => {
        const data = d.data();
        tList.push({
          id: d.id, name: data.name ?? '', chestNo: data.chestNo ?? '',
          regNo: data.regNo ?? '', platoon: normalizePlatoon(data.platoon),
          rank: data.rank ?? 'RCT', fatherName: data.fatherName ?? '',
          rifleNo: data.rifleNo ?? '', attn: data.attn ?? 'P',
          docsComplete: data.docsComplete ?? false,
          issuedKitItems: data.issuedKitItems ?? [], documents: data.documents ?? {},
          fptResult: data.fptResult ?? '', weeklyExamResult: data.weeklyExamResult ?? '',
          sickReports: data.sickReports ?? 0, batchId: data.batchId ?? '',
          state: data.state, bloodGroup: data.bloodGroup, mobileNo: data.mobileNo,
        });
      });
      tList.sort((a, b) => (a.chestNo || '').localeCompare(b.chestNo || ''));
      setTrainees(tList);

      const traineeIds = new Set(tList.map(t => t.id));

      const absList: AbsentRecord[] = [];
      absentSnap.forEach(d => {
        const data = d.data();
        if (traineeIds.has(data.traineeId)) {
          absList.push({
            id: d.id, traineeId: data.traineeId ?? '', type: data.type ?? 'A',
            reason: data.reason ?? '', fromDate: data.fromDate ?? '', toDate: data.toDate ?? '',
            totalDays: data.totalDays ?? 1, status: data.status ?? 'Active',
          });
        }
      });
      setAbsentRecords(absList);

      const medList: MedicalRecord[] = [];
      medicalSnap.forEach(d => {
        const data = d.data();
        if (traineeIds.has(data.traineeId)) {
          medList.push({
            id: d.id, traineeId: data.traineeId ?? '', category: data.category ?? '',
            diagnosis: data.diagnosis ?? '', status: data.status ?? '', date: data.date ?? '',
          });
        }
      });
      setMedicalRecords(medList);

      const recList: any[] = [];
      recoverySnap.forEach(d => {
        const data = d.data();
        if (traineeIds.has(data.traineeId)) recList.push({ id: d.id, ...data });
      });
      setRecoveryRecords(recList);

    } catch (err: any) {
      console.error('Trainee360 fetch error:', err);
      setError('Data load error. Refresh karein.');
    } finally {
      setLoading(false);
    }
  }, [batchFilter, activeBatch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Absent records by trainee
  const absentByTrainee = useMemo(() => {
    const map: Record<string, AbsentRecord[]> = {};
    absentRecords.forEach(r => { if (!map[r.traineeId]) map[r.traineeId] = []; map[r.traineeId].push(r); });
    return map;
  }, [absentRecords]);

  // Medical records by trainee
  const medicalByTrainee = useMemo(() => {
    const map: Record<string, MedicalRecord[]> = {};
    medicalRecords.forEach(r => { if (!map[r.traineeId]) map[r.traineeId] = []; map[r.traineeId].push(r); });
    return map;
  }, [medicalRecords]);

  // Stats
  const totalTrainees = trainees.length;
  const presentCount = trainees.filter(t => (t.attn || 'P') === 'P').length;
  const absentCount = trainees.filter(t => t.attn === 'A').length;
  const sickCount = trainees.filter(t => t.attn === 'S' || t.attn === 'H').length;
  const leaveCount = trainees.filter(t => t.attn === 'L').length;
  const restCount = trainees.filter(t => t.attn === 'R').length;
  const docsComplete = trainees.filter(t => t.docsComplete).length;
  const fptPassed = trainees.filter(t => t.fptResult === 'Pass').length;
  const fptFailed = trainees.filter(t => t.fptResult === 'Fail').length;
  const activeMedCount = trainees.filter(t => medicalRecords.some(m => m.traineeId === t.id && m.status === 'Active')).length;

  // Filtered trainees
  const filteredTrainees = useMemo(() => {
    return trainees.filter(t => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !t.chestNo.toLowerCase().includes(q) && !(t.regNo || '').toLowerCase().includes(q)) return false;
      }
      if (platoonFilter !== 'ALL' && t.platoon !== platoonFilter) return false;
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'PRESENT') return (t.attn || 'P') === 'P';
      if (statusFilter === 'ABSENT') return t.attn === 'A';
      if (statusFilter === 'SICK') return t.attn === 'S' || t.attn === 'H';
      if (statusFilter === 'LEAVE') return t.attn === 'L';
      if (statusFilter === 'REST') return t.attn === 'R';
      if (statusFilter === 'DOCS_PENDING') return !t.docsComplete;
      if (statusFilter === 'FPT_FAIL') return t.fptResult === 'Fail';
      if (statusFilter === 'MEDICAL') return medicalRecords.some(m => m.traineeId === t.id && m.status === 'Active');
      return true;
    });
  }, [trainees, searchQuery, platoonFilter, statusFilter, medicalRecords]);

  // Kit total
  const kitTotal = FIXED_TRAINING_ITEMS.length;

  // Export CSV
  const exportCSV = () => {
    const headers = ['Chest No', 'Name', 'Reg No', 'Platoon', 'Rank', 'Status', 'FPT', 'Tests', 'Docs', 'Kit', 'State'];
    const rows = filteredTrainees.map(t => {
      const issued = (t.issuedKitItems || []).map((i: any) => normalizeName(i.itemName));
      const kitCount = FIXED_TRAINING_ITEMS.filter(n => issued.includes(normalizeName(n))).length;
      return [t.chestNo, t.name, t.regNo, t.platoon, t.rank, t.attn || 'P', t.fptResult, t.weeklyExamResult, t.docsComplete ? 'Complete' : 'Pending', `${kitCount}/${kitTotal}`, t.state || ''];
    });
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Trainee360_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 pb-10">

      {/* Header */}
      <div className="bg-gradient-to-r from-military-900 via-military-800 to-military-900 rounded-2xl px-6 py-5 shadow-lg">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Users size={18} className="text-blue-400" />
              </div>
              Trainee 360°
            </h1>
            <p className="text-[10px] text-white/50 font-medium mt-1 ml-10">
              All trainees at a glance — search, filter, click for full profile
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Batch selector */}
            {canViewAllBatches && (
              <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)}
                className="text-[10px] font-bold bg-white/10 text-white border border-white/20 px-3 py-2 rounded-xl">
                {allBatches.map(b => <option key={b.id} value={b.id}>{b.batchNumber}</option>)}
              </select>
            )}
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-[10px] font-bold uppercase rounded-xl">
              <Download size={13} /> Export
            </button>
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-2 text-[10px] font-bold uppercase rounded-xl border border-white/20 disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-2xl flex items-center justify-between text-sm">
          <span className="font-semibold">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 font-bold">✕</button>
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { label: 'Total', value: totalTrainees, icon: '👥', color: 'bg-slate-700 text-white' },
          { label: 'Present', value: presentCount, icon: '✅', color: 'bg-green-50 border border-green-200 text-green-800' },
          { label: 'Absent', value: absentCount, icon: '🚫', color: absentCount > 0 ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-green-50 border border-green-200 text-green-700' },
          { label: 'Sick/Hosp', value: sickCount, icon: '🤒', color: sickCount > 0 ? 'bg-orange-50 border border-orange-200 text-orange-800' : 'bg-green-50 border border-green-200 text-green-700' },
          { label: 'Leave', value: leaveCount, icon: '✈️', color: leaveCount > 0 ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-green-50 border border-green-200 text-green-700' },
          { label: 'Rest', value: restCount, icon: '🛌', color: restCount > 0 ? 'bg-blue-50 border border-blue-200 text-blue-800' : 'bg-green-50 border border-green-200 text-green-700' },
          { label: 'Docs OK', value: docsComplete, icon: '📄', color: 'bg-cyan-50 border border-cyan-200 text-cyan-800' },
          { label: 'FPT Pass', value: fptPassed, icon: '🎯', color: 'bg-purple-50 border border-purple-200 text-purple-800' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
            <p className="text-lg mb-0.5">{s.icon}</p>
            <p className="text-xl font-black">{s.value}</p>
            <p className="text-[8px] font-bold uppercase opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <input type="text" placeholder="Search name, chest, reg..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs border border-slate-200 pl-8 pr-3 py-2 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-military-300" />
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Platoon:</span>
            {platoons.map(p => (
              <button key={p} onClick={() => setPlatoonFilter(p)}
                className={`px-2 py-1 text-[9px] font-bold rounded-lg transition-all ${platoonFilter === p ? 'bg-military-700 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1.5 mt-3 overflow-x-auto flex-wrap">
          {[
            { key: 'ALL', label: `All (${totalTrainees})`, color: 'bg-military-700' },
            { key: 'PRESENT', label: `Present (${presentCount})`, color: 'bg-green-600' },
            { key: 'ABSENT', label: `Absent (${absentCount})`, color: 'bg-red-600' },
            { key: 'SICK', label: `Sick/Hosp (${sickCount})`, color: 'bg-amber-600' },
            { key: 'LEAVE', label: `Leave (${leaveCount})`, color: 'bg-blue-600' },
            { key: 'REST', label: `Rest (${restCount})`, color: 'bg-purple-600' },
            { key: 'DOCS_PENDING', label: `Docs Pending (${totalTrainees - docsComplete})`, color: 'bg-cyan-600' },
            { key: 'FPT_FAIL', label: `FPT Fail (${fptFailed})`, color: 'bg-orange-600' },
            { key: 'MEDICAL', label: `Medical (${activeMedCount})`, color: 'bg-red-500' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              className={`px-2.5 py-1.5 text-[9px] font-black uppercase rounded-xl whitespace-nowrap transition-all ${statusFilter === tab.key ? `${tab.color} text-white shadow-md` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trainee Table */}
      {loading ? (
        <div className="text-center py-24">
          <Loader2 size={28} className="animate-spin text-military-600 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-500">Loading trainees...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-900 text-white">
                  {['#', 'Chest', 'Name', 'Reg No', 'Platoon', 'Status', 'FPT', 'Tests', 'Docs', 'Kit', 'Medical', 'State'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[9px] font-black uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTrainees.map((t, idx) => {
                  const attnCode = t.attn || 'P';
                  const attnInfo = getAttnInfo(attnCode);
                  const isAway = attnCode !== 'P';
                  const issued = (t.issuedKitItems || []).map((i: any) => normalizeName(i.itemName));
                  const kitCount = FIXED_TRAINING_ITEMS.filter(n => issued.includes(normalizeName(n))).length;
                  const hasActiveMed = medicalRecords.some(m => m.traineeId === t.id && m.status === 'Active');

                  const rowColor = isAway
                    ? attnCode === 'A' ? 'bg-red-50/60 border-l-4 border-l-red-500'
                    : attnCode === 'S' ? 'bg-orange-50/60 border-l-4 border-l-orange-500'
                    : attnCode === 'H' ? 'bg-purple-50/60 border-l-4 border-l-purple-500'
                    : attnCode === 'L' ? 'bg-blue-50/60 border-l-4 border-l-blue-500'
                    : attnCode === 'R' ? 'bg-indigo-50/60 border-l-4 border-l-indigo-500'
                    : 'bg-teal-50/60 border-l-4 border-l-teal-500'
                    : 'bg-green-50/30 border-l-4 border-l-green-400';

                  return (
                    <tr key={t.id}
                      className={`${rowColor} hover:brightness-95 cursor-pointer transition-colors`}
                      onClick={() => setSelectedTrainee(t)}>
                      <td className="px-3 py-2.5 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-mono font-black text-military-800 bg-military-50 border border-military-100 px-2 py-0.5 rounded-lg">{t.chestNo}</span>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800 max-w-[130px] truncate text-[11px]">{t.name}</td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-slate-500">{t.regNo || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500 text-[10px]">{t.platoon || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${attnInfo.bg} ${attnInfo.cls}`}>
                          {attnInfo.icon} {attnCode}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {t.fptResult === 'Pass' ? <span className="text-[9px] text-green-600">✅ Pass</span>
                        : t.fptResult === 'Fail' ? <span className="text-[9px] text-red-600">❌ Fail</span>
                        : <span className="text-slate-300 text-[9px]">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {t.weeklyExamResult === 'Pass' ? <span className="text-[9px] text-green-600">✅ Pass</span>
                        : t.weeklyExamResult === 'Fail' ? <span className="text-[9px] text-red-600">❌ Fail</span>
                        : <span className="text-slate-300 text-[9px]">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {t.docsComplete ? <CheckCircle2 size={13} className="text-green-500 mx-auto" /> : <AlertCircle size={13} className="text-amber-400 mx-auto" />}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-[9px] font-bold ${kitCount >= kitTotal ? 'text-green-600' : 'text-red-500'}`}>
                          {kitCount}/{kitTotal}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {hasActiveMed ? <span className="text-[9px] text-red-600">🏥</span> : <span className="text-green-500 text-[9px]">✓</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-slate-500">{t.state || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredTrainees.length === 0 && (
              <div className="p-8 text-center">
                <Users size={28} className="mx-auto text-slate-200 mb-2" />
                <p className="text-xs font-bold text-slate-400">No trainees match filters</p>
              </div>
            )}
          </div>
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <p className="text-[10px] text-slate-500 font-bold">
              Showing {filteredTrainees.length} of {totalTrainees} trainees
            </p>
            <p className="text-[9px] text-slate-400">Click any row for full details</p>
          </div>
        </div>
      )}

      {/* Trainee Detail Modal */}
      {selectedTrainee && (
        <TraineeDetailModal
          trainee={selectedTrainee}
          absentRecords={absentByTrainee[selectedTrainee.id] || []}
          medicalRecords={medicalByTrainee[selectedTrainee.id] || []}
          kitTotal={kitTotal}
          onClose={() => setSelectedTrainee(null)}
          onNavigate={go}
        />
      )}

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default Trainee360Screen;
