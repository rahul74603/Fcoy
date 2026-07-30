// D:\ALL PROJECTS\BSF COYs\frontend\src\features\weekly\WeeklyProgramScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  Calendar, Plus, Save, Trash2, Clock, MapPin, Target,
  ChevronDown, ChevronUp, AlertCircle, Layers,
  FileText, CheckCircle2, X, Loader2, Users, Shield, BookOpen,
  Printer, Edit3
} from 'lucide-react';
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  query, where, orderBy, updateDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useBatch } from '../../contexts/BatchContext';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface AssignedPerson {
  id: string;
  rank: string;
  name: string;
}

interface LectureDetails {
  topic: string;
  description: string;
  duration: string;
  materials: string;
}

interface ClassSession {
  id: string;
  time: string;
  pds: number;
  code: string;
  subject: string;
  customSubject: string;
  method: string;
  platoon: string;
  assignedPersons: AssignedPerson[];
  location: string;
  lectureDetails: LectureDetails;
}

interface DailySchedule {
  day: string;
  date: string;
  sessions: ClassSession[];
}

interface WeeklyProgram {
  id?: string;
  batchId: string;
  batchNumber: string;
  weekName: string;
  weekNumber: number;
  fromDate: string;
  toDate: string;
  displayDateRange: string;
  admNco: string;
  admSo: string;
  teaBreak: string;
  gameTime: string;
  rollCall: string;
  distribution: string;
  remarks: string;
  schedule: DailySchedule[];
  createdAt: string;
  createdBy: string;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

const PLATOONS = [
  'All Platoons', 'Platoon 1', 'Platoon 2', 'Platoon 3', 'Platoon 4'
];

const METHODS = [
  'PRAC', 'LEC', 'PRAC/LEC', 'LEC/PRAC', 'LEC/DEMO', 'DEMO', 'PRAC/DEMO'
];

const AREAS = [
  'TRG AREA', 'CLP', 'SQD POST', 'CLP/TRG AREA',
  'LIVING AREA', 'RANGE', 'PARADE GROUND'
];

const SUBJECTS = [
  'PT (Physical Training)',
  'Drill',
  'WT (Weapon Training)',
  'Map Reading',
  'BOC (Battle Obstacle Course)',
  'Theory Class',
  'Lecture',
  'Fatigue/Maintenance',
  'Sports',
  'Firing Practice',
  'First Aid',
  'Law & Order',
  'Field Craft',
  'Games/Recreation',
];

// ═══════════════════════════════════════════════════════════
// ★ INSTRUCTOR CONFLICT DETECTION ENGINE
//   Same din + overlapping time + same person = CONFLICT
//   (Weekly program mein persons free-text hain, isliye
//    name-normalization se match karte hain)
// ═══════════════════════════════════════════════════════════
interface TimeRange { start: number; end: number }  // minutes since midnight

interface InstructorConflict {
  sessionId: string;
  day: string;
  person: string;          // display name
  otherSubject: string;
  otherTime: string;
}

// "0530-0650", "05:30-06:50", "0530 TO 0650" sab parse karta hai
export const parseTimeRange = (timeStr: string): TimeRange | null => {
  if (!timeStr) return null;
  const norm = timeStr.replace(/\s*(to|TO|To|–|—)\s*/g, '-').trim();
  const parts = norm.split('-');
  if (parts.length !== 2) return null;

  const toMinutes = (raw: string): number | null => {
    const clean = raw.trim().replace(/[^\d:]/g, '');
    if (!clean) return null;
    if (clean.includes(':')) {
      const [h, m] = clean.split(':').map(Number);
      if (isNaN(h) || isNaN(m) || m >= 60) return null;
      return h * 60 + m;
    }
    if (clean.length < 3 || clean.length > 4) return null;
    const num = Number(clean);
    if (isNaN(num)) return null;
    const h = Math.floor(num / 100);
    const m = num % 100;
    if (h > 23 || m >= 60) return null;
    return h * 60 + m;
  };

  const start = toMinutes(parts[0]);
  const end = toMinutes(parts[1]);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
};

// Session → list of conflicts (empty agar sab clean)
export const findInstructorConflicts = (
  schedule: DailySchedule[]
): Record<string, InstructorConflict[]> => {
  const conflicts: Record<string, InstructorConflict[]> = {};
  const add = (id: string, c: InstructorConflict) => {
    conflicts[id] = [...(conflicts[id] ?? []), c];
  };

  schedule.forEach(dayData => {
    const sessions = dayData.sessions;
    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const a = sessions[i];
        const b = sessions[j];
        // NOTE: platoon alag ho tab bhi EK ustad do jagah nahi ho sakta —
        // isliye platoon-se-scope nahi karte, pure-day overlap check hota hai.

        const ta = parseTimeRange(a.time);
        const tb = parseTimeRange(b.time);
        if (!ta || !tb) continue;
        const overlap = ta.start < tb.end && tb.start < ta.end;
        if (!overlap) continue;

        const personsOf = (s: ClassSession) =>
          (s.assignedPersons ?? [])
            .filter(p => p.name.trim())
            .map(p => ({ norm: p.name.trim().toLowerCase(), display: `${p.rank ? p.rank + ' ' : ''}${p.name.trim()}` }));

        const pa = personsOf(a);
        const pb = personsOf(b);
        const common = pa.filter(x => pb.some(y => y.norm === x.norm));

        common.forEach(p => {
          add(a.id, {
            sessionId: a.id, day: dayData.day, person: p.display,
            otherSubject: b.customSubject && b.subject === 'Other (Manual)' ? b.customSubject : b.subject,
            otherTime: b.time,
          });
          add(b.id, {
            sessionId: b.id, day: dayData.day, person: p.display,
            otherSubject: a.customSubject && a.subject === 'Other (Manual)' ? a.customSubject : a.subject,
            otherTime: a.time,
          });
        });
      }
    }
  });
  return conflicts;
};

// ─────────────────────────────────────────────
// PRINT STYLES  (A4 Landscape)
// ─────────────────────────────────────────────
const PRINT_STYLES = `
  @media print {
    body * { visibility: hidden !important; }
    #wtp-print-area,
    #wtp-print-area * { visibility: visible !important; }
    #wtp-print-area {
      position: fixed !important;
      inset: 0;
      width: 100%;
      padding: 0;
      margin: 0;
      background: #fff;
    }
    @page {
      size: A4 landscape;
      margin: 10mm 8mm;
    }
  }
`;

// ═══════════════════════════════════════════════════════════
// PRINT COMPONENT  — exact PDF layout
// ═══════════════════════════════════════════════════════════
interface PrintProps {
  program: WeeklyProgram;
  batch: any;
}

const WeeklyProgramPrint: React.FC<PrintProps> = ({ program, batch }) => {

  const allRows: {
    day: string; date: string;
    isFirst: boolean; rowSpan: number;
    session: ClassSession;
  }[] = [];

  program.schedule.forEach(dayData => {
    if (!dayData.sessions.length) return;
    dayData.sessions.forEach((session, idx) => {
      allRows.push({
        day:     dayData.day.toUpperCase(),
        date:    dayData.date || '',
        isFirst: idx === 0,
        rowSpan: dayData.sessions.length,
        session,
      });
    });
  });

  const getResponsibility = (s: ClassSession): string => {
    if (!s.assignedPersons?.length) return '—';
    const filled = s.assignedPersons.filter(p => p.name.trim());
    if (!filled.length) return '—';
    return filled.map(p => p.rank ? `${p.rank} ${p.name}` : p.name).join(' & ');
  };

  const getSubject = (s: ClassSession): string =>
    s.subject === 'Other (Manual)' && s.customSubject
      ? s.customSubject
      : (s.subject || '—');

  const cell: React.CSSProperties = {
    border: '1px solid #000', padding: '3px 5px', fontSize: '9px',
  };
  const thCell: React.CSSProperties = {
    ...cell, background: '#d0d0d0', fontWeight: 'bold',
    textAlign: 'center', whiteSpace: 'nowrap', fontSize: '9.5px',
  };

  return (
    <div
      id="wtp-print-area"
      style={{
        fontFamily: 'Arial, sans-serif', fontSize: '9.5px',
        color: '#000', background: '#fff', padding: 0,
      }}
    >
      {/* TITLE */}
      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px' }}>
          WEEKLY TRAINING PROGRAMME
        </div>
        <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
          {batch?.unit || 'STC BSF TEKANPUR'} ({batch?.location || 'GWALIOR'}) MP
        </div>
        <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
          BRT BATCH NO. {batch?.batchNumber || program.batchNumber}
          {batch?.coyName ? ` '${batch.coyName}' COY` : ''}
          {batch?.startDate && batch?.endDate
            ? ` (${batch.startDate} TO ${batch.endDate})` : ''}
        </div>
        {(batch?.totalWeeks || batch?.phaseStartDate) && (
          <div style={{ fontSize: '10.5px', fontWeight: 'bold' }}>
            PHASE DURATION: {batch?.totalWeeks || '44'} WEEK
            {batch?.phaseStartDate && batch?.phaseEndDate
              ? ` (${batch.phaseStartDate} TO ${batch.phaseEndDate})` : ''}
          </div>
        )}
        <div style={{ borderBottom: '2px solid #000', marginTop: '5px' }} />
      </div>

      {/* META ROW */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginBottom: '5px', fontSize: '9.5px',
      }}>
        <div>
          <div><strong>Coy Comdr: {batch?.coyComdr || '—'}</strong></div>
          <div><strong>Coy 2 I/C: {batch?.coy2IC || '—'}</strong></div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div>
            <strong>DATE: {program.displayDateRange
              || `${program.fromDate} TO ${program.toDate}`}
            </strong>
          </div>
          <div><strong>WEEK NO: {program.weekNumber}</strong></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><strong>TOTAL WEEKS: {batch?.totalWeeks || '44'}</strong></div>
          <div><strong>TOTAL TRAINEES: {batch?.totalTrainees || '—'}</strong></div>
        </div>
      </div>

      {/* MAIN TABLE */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {[
              'DAY & DATE', 'TIME', 'PDS', 'CODE',
              'SUBJECT', 'METHOD', 'AREA', 'RESPONSIBILITY',
            ].map(h => <th key={h} style={thCell}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {allRows.map((row, i) => (
            <tr key={i}>
              {row.isFirst && (
                <td rowSpan={row.rowSpan} style={{
                  ...cell,
                  textAlign: 'center', fontWeight: 'bold',
                  verticalAlign: 'middle', whiteSpace: 'nowrap',
                  background: '#f5f5f5',
                }}>
                  <div style={{ fontWeight: 'bold' }}>{row.day}</div>
                  <div>{row.date}</div>
                </td>
              )}
              <td style={{ ...cell, textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                {row.session.time || '—'}
              </td>
              <td style={{ ...cell, textAlign: 'center' }}>
                {row.session.pds ?? 2}
              </td>
              <td style={{ ...cell, textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                {row.session.code || '—'}
              </td>
              <td style={cell}>{getSubject(row.session)}</td>
              <td style={{ ...cell, textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                {row.session.method || 'PRAC'}
              </td>
              <td style={{ ...cell, textAlign: 'center', whiteSpace: 'nowrap' }}>
                {row.session.location || '—'}
              </td>
              <td style={cell}>{getResponsibility(row.session)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* FOOTER */}
      <div style={{ marginTop: '10px', fontSize: '9.5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div><strong>ADM NCO - {program.admNco || '—'}</strong></div>
            <br />
            <div><strong>ADM SO - {program.admSo || '—'}</strong></div>
            <div style={{ marginTop: '6px', lineHeight: '1.8' }}>
              {program.teaBreak     && <div>(1) TEA BREAK - {program.teaBreak}</div>}
              {program.gameTime     && <div>(2) GAME {program.gameTime}</div>}
              {program.rollCall     && <div>(3) ROLL CALL - {program.rollCall}</div>}
              {program.distribution && (
                <div style={{ maxWidth: '500px' }}>
                  (4) DISTRIBUTION : {program.distribution}
                </div>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', marginTop: '40px' }}>
            <div><strong>FOR INSPECTOR GENERAL</strong></div>
            <div><strong>{batch?.unit || 'STC BSF TEKANPUR'}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// PERSON MULTI-SELECT
// ─────────────────────────────────────────────
interface PersonMultiSelectProps {
  sessionId: string;
  day: string;
  assignedPersons: AssignedPerson[];
  allUstads: any[];
  onUpdate: (day: string, sessionId: string, persons: AssignedPerson[]) => void;
}

const PersonMultiSelect: React.FC<PersonMultiSelectProps> = ({
  sessionId, day, assignedPersons, allUstads, onUpdate,
}) => {
  const createEmpty = (): AssignedPerson => ({
    id:   `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    rank: '',
    name: '',
  });

  const addPerson = () =>
    onUpdate(day, sessionId, [...assignedPersons, createEmpty()]);

  const handleField = (personId: string, field: 'rank' | 'name', value: string) => {
    onUpdate(
      day, sessionId,
      assignedPersons.map(p => p.id === personId ? { ...p, [field]: value } : p)
    );
  };

  const removePerson = (personId: string) => {
    const updated = assignedPersons.filter(p => p.id !== personId);
    onUpdate(day, sessionId, updated.length ? updated : [createEmpty()]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {assignedPersons.map((person, index) => (
        <div
          key={person.id}
          className="flex items-center gap-1.5 bg-white border border-slate-200 p-1.5"
        >
          {/* RANK */}
          <select
            value={person.rank}
            onChange={e => handleField(person.id, 'rank', e.target.value)}
            className={`text-[9px] border px-1.5 py-1 bg-white focus:outline-none
                        w-[110px] flex-shrink-0 font-bold
                        ${person.rank
                          ? 'border-military-400 text-military-800 bg-military-50'
                          : 'border-slate-300 text-slate-400'}`}
          >
            <option value="">-- Rank --</option>
            <optgroup label="── Officers ──">
              <option value="IG">IG</option>
              <option value="DIG">DIG</option>
              <option value="Comdt">Comdt</option>
              <option value="2IC">2IC</option>
              <option value="Dy Comdt">Dy Comdt</option>
              <option value="AC">AC</option>
            </optgroup>
            <optgroup label="── SOs ──">
              <option value="SM">SM</option>
              <option value="Sub">Sub</option>
              <option value="Insp">Insp</option>
              <option value="SI">SI</option>
            </optgroup>
            <optgroup label="── NCOs / ORs ──">
              <option value="ASI">ASI</option>
              <option value="HC">HC</option>
              <option value="CT">CT</option>
            </optgroup>
            <optgroup label="── Specialized ──">
              <option value="Drill Ustad">Drill Ustad</option>
              <option value="PT Ustad">PT Ustad</option>
              <option value="WT Ustad">WT Ustad</option>
              <option value="Other">Other</option>
            </optgroup>
          </select>

          {/* NAME */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Name ya IRLA..."
              value={person.name}
              onChange={e => handleField(person.id, 'name', e.target.value)}
              list={`pl-${day}-${sessionId}-${person.id}`}
              className={`w-full text-[10px] border px-2 py-1 focus:outline-none bg-white
                          ${person.name
                            ? 'border-blue-400 text-blue-900'
                            : 'border-slate-300'}`}
            />
            <datalist id={`pl-${day}-${sessionId}-${person.id}`}>
              {allUstads.map(u => (
                <option key={u.id} value={u.name}>
                  {u.rank} {u.name} {u.irla ? `(${u.irla})` : ''}
                </option>
              ))}
            </datalist>
          </div>

          {/* REMOVE */}
          {assignedPersons.length > 1 && (
            <button
              onClick={() => removePerson(person.id)}
              className="text-red-400 hover:text-red-600 p-1 flex-shrink-0"
              title="Hatao"
            >
              <X size={11} />
            </button>
          )}

          {/* ADD MORE — only on last */}
          {index === assignedPersons.length - 1 && (
            <button
              onClick={addPerson}
              className="bg-green-600 text-white hover:bg-green-700 p-1 flex-shrink-0"
              title="Aur add karo"
            >
              <Plus size={11} />
            </button>
          )}
        </div>
      ))}

      {assignedPersons.filter(p => p.name.trim()).length > 1 && (
        <span className="text-[8px] font-bold text-green-700 bg-green-50
                         border border-green-200 px-1.5 py-0.5 self-start
                         flex items-center gap-1">
          <Users size={8} />
          {assignedPersons.filter(p => p.name.trim()).length} Persons Assigned
        </span>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export const WeeklyProgramScreen = () => {
  const { activeBatch } = useBatch();
  const hasBatch = !!activeBatch;

  // ── State ──
  const [programs, setPrograms]         = useState<WeeklyProgram[]>([]);
  const [ustads, setUstads]             = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [message, setMessage]           = useState('');
  const [showForm, setShowForm]         = useState(false);
  const [isEditMode, setIsEditMode]     = useState(false);        // ✅ EDIT MODE FLAG
  const [editingId, setEditingId]       = useState<string | null>(null); // ✅ which doc
  const [expandedDay, setExpandedDay]   = useState<string>('Monday');
  const [viewProgram, setViewProgram]   = useState<WeeklyProgram | null>(null);
  const [printProgram, setPrintProgram] = useState<WeeklyProgram | null>(null);

  // ── Helpers ──
  const emptyLecture = (): LectureDetails =>
    ({ topic: '', description: '', duration: '', materials: '' });

  const emptySession = (): ClassSession => ({
    id:              `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    time:            '0530-0650',
    pds:             2,
    code:            '',
    subject:         'PT (Physical Training)',
    customSubject:   '',
    method:          'PRAC',
    platoon:         'All Platoons',
    assignedPersons: [{ id: `${Date.now()}_p1`, rank: '', name: '' }],
    location:        'TRG AREA',
    lectureDetails:  emptyLecture(),
  });

  const getEmptyForm =
    (): Omit<WeeklyProgram, 'id'|'createdAt'|'createdBy'|'batchId'|'batchNumber'> => ({
      weekName:         '',
      weekNumber:       1,
      fromDate:         '',
      toDate:           '',
      displayDateRange: '',
      admNco:           '',
      admSo:            '',
      teaBreak:         '1010 TO 1025 HRS',
      gameTime:         '1715 HRS TO 1805 HRS',
      rollCall:         '1845 HRS',
      distribution:
        'PA TO IG, COMDT(CI), 2IC(TRG), DC(TRG), ACY HQ, HOSPITAL, GD, MT, FILE, TRG TEAM.',
      remarks:  '',
      schedule: DAYS_OF_WEEK.map(day => ({ day, date: '', sessions: [] })),
    });

  const [formData, setFormData] = useState(getEmptyForm());

  // ★ Live instructor conflicts (form schedule se har render pe computed)
  const instructorConflicts = findInstructorConflicts(formData.schedule);
  const conflictSessionCount = Object.keys(instructorConflicts).length;

  // ── Auto displayDateRange ──
  useEffect(() => {
    if (formData.fromDate && formData.toDate) {
      const fmt = (d: string) => {
        const dt = new Date(d);
        return `${String(dt.getDate()).padStart(2,'0')}.`
          + `${String(dt.getMonth()+1).padStart(2,'0')}.`
          + `${dt.getFullYear()}`;
      };
      setFormData(prev => ({
        ...prev,
        displayDateRange: `${fmt(prev.fromDate)} TO ${fmt(prev.toDate)}`,
      }));
    }
  }, [formData.fromDate, formData.toDate]);

  // ── Auto-fill day dates from fromDate ──
  const autoFillDates = (from: string) => {
    if (!from) return;
    const base = new Date(from);
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.map((d, idx) => {
        const dt = new Date(base);
        dt.setDate(base.getDate() + idx);
        return {
          ...d,
          date: `${String(dt.getDate()).padStart(2,'0')}/`
              + `${String(dt.getMonth()+1).padStart(2,'0')}/`
              + `${dt.getFullYear()}`,
        };
      }),
    }));
  };

  // ── Fetch ──
  const fetchData = async () => {
    if (!activeBatch) { setLoading(false); return; }
    setLoading(true);
    try {
      const q = query(
        collection(db, 'weeklyPrograms'),
        where('batchId', '==', activeBatch.id),
        orderBy('fromDate', 'desc')
      );
      const snap = await getDocs(q);
      const list: WeeklyProgram[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as WeeklyProgram));
      setPrograms(list);

      const uq = query(
        collection(db, 'ustads'),
        where('batchId', '==', activeBatch.id)
      );
      const uSnap = await getDocs(uq);
      const uList: any[] = [];
      uSnap.forEach(d => uList.push({ id: d.id, ...d.data() }));
      setUstads(uList);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [activeBatch]);

  // ════════════════════════════════════════════════
  // ✅ EDIT — load existing program into form
  // ════════════════════════════════════════════════
  const handleEdit = (program: WeeklyProgram) => {
    setIsEditMode(true);
    setEditingId(program.id || null);
    setViewProgram(null);

    // Load all fields into formData
    setFormData({
      weekName:         program.weekName,
      weekNumber:       program.weekNumber,
      fromDate:         program.fromDate,
      toDate:           program.toDate,
      displayDateRange: program.displayDateRange,
      admNco:           program.admNco || '',
      admSo:            program.admSo || '',
      teaBreak:         program.teaBreak || '1010 TO 1025 HRS',
      gameTime:         program.gameTime || '1715 HRS TO 1805 HRS',
      rollCall:         program.rollCall || '1845 HRS',
      distribution:     program.distribution ||
        'PA TO IG, COMDT(CI), 2IC(TRG), DC(TRG), ACY HQ, HOSPITAL, GD, MT, FILE, TRG TEAM.',
      remarks:          program.remarks || '',
      // ── Ensure each session has all new fields (backward compat) ──
      schedule: program.schedule.map(dayData => ({
        ...dayData,
        date: dayData.date || '',
        sessions: dayData.sessions.map(s => ({
          ...s,
          pds:           s.pds ?? 2,
          code:          s.code || '',
          method:        s.method || 'PRAC',
          customSubject: s.customSubject || '',
          assignedPersons: s.assignedPersons?.length
            ? s.assignedPersons
            : [{ id: `${Date.now()}_p1`, rank: '', name: '' }],
          lectureDetails: s.lectureDetails || emptyLecture(),
        })),
      })),
    });

    setExpandedDay('Monday');
    setShowForm(true);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Session CRUD ──
  const addSession = (day: string) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.map(d =>
        d.day === day
          ? { ...d, sessions: [...d.sessions, emptySession()] }
          : d
      ),
    }));
    setExpandedDay(day);
  };

  const updateSession = (
    day: string, sessionId: string,
    field: string, value: string | number
  ) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.map(d =>
        d.day === day ? {
          ...d,
          sessions: d.sessions.map(s =>
            s.id === sessionId ? { ...s, [field]: value } : s
          ),
        } : d
      ),
    }));
  };

  const updateLectureDetails = (
    day: string, sessionId: string,
    field: keyof LectureDetails, value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.map(d =>
        d.day === day ? {
          ...d,
          sessions: d.sessions.map(s =>
            s.id === sessionId
              ? { ...s, lectureDetails: { ...s.lectureDetails, [field]: value } }
              : s
          ),
        } : d
      ),
    }));
  };

  const updateSessionPersons = (
    day: string, sessionId: string, persons: AssignedPerson[]
  ) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.map(d =>
        d.day === day ? {
          ...d,
          sessions: d.sessions.map(s =>
            s.id === sessionId ? { ...s, assignedPersons: persons } : s
          ),
        } : d
      ),
    }));
  };

  const removeSession = (day: string, sessionId: string) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.map(d =>
        d.day === day
          ? { ...d, sessions: d.sessions.filter(s => s.id !== sessionId) }
          : d
      ),
    }));
  };

  // ════════════════════════════════════════════════
  // ✅ SAVE — handles both ADD and UPDATE
  // ════════════════════════════════════════════════
  // ── handleSave mein payload sanitize karo ──

const handleSave = async () => {
  if (!activeBatch) return;
  if (!formData.weekName || !formData.fromDate || !formData.toDate) {
    setMessage('ERROR: Week Name, From Date aur To Date required hain!');
    return;
  }

  // ★ INSTRUCTOR CONFLICT GUARD — warn karo, user confirm kare to save
  const conflicts = findInstructorConflicts(formData.schedule);
  const conflictList = Object.values(conflicts).flat();
  if (conflictList.length > 0) {
    const seen = new Set<string>();
    const lines: string[] = [];
    conflictList.forEach(c => {
      const key = `${c.day}|${c.person}|${c.otherTime}`;
      if (seen.has(key)) return;
      seen.add(key);
      lines.push(`• ${c.day}: ${c.person} → "${c.otherSubject}" (${c.otherTime}) se bhi clash`);
    });
    const proceed = window.confirm(
      `⚠️ INSTRUCTOR CONFLICT DETECTED!\n\n` +
      `${lines.slice(0, 8).join('\n')}${lines.length > 8 ? `\n...aur ${lines.length - 8} clashes` : ''}\n\n` +
      `Ek ustad ek hi time pe do classes nahi le sakta.\n` +
      `OK = phir bhi save karo | Cancel = wapas jaake time/person theek karo`
    );
    if (!proceed) {
      setMessage('ERROR: Save roka gaya — instructor conflicts pehle resolve karein.');
      return;
    }
  }

  setSaving(true);
  setMessage('');
  try {

    // ✅ SANITIZE — koi bhi field undefined nahi honi chahiye
    const sanitizeSession = (s: ClassSession): ClassSession => ({
      id:              s.id || '',
      time:            s.time || '',
      pds:             s.pds ?? 2,
      code:            s.code || '',
      subject:         s.subject || 'PT (Physical Training)',
      customSubject:   s.customSubject || '',
      method:          s.method || 'PRAC',
      platoon:         s.platoon || 'All Platoons',
      location:        s.location || '',
      assignedPersons: (s.assignedPersons || []).map(p => ({
        id:   p.id   || '',
        rank: p.rank || '',
        name: p.name || '',
      })),
      lectureDetails: {
        topic:       s.lectureDetails?.topic       || '',
        description: s.lectureDetails?.description || '',
        duration:    s.lectureDetails?.duration    || '',
        materials:   s.lectureDetails?.materials   || '',
      },
    });

    const sanitizeSchedule = (schedule: DailySchedule[]): DailySchedule[] =>
      schedule.map(d => ({
        day:      d.day  || '',
        date:     d.date || '',
        sessions: (d.sessions || []).map(sanitizeSession),
      }));

    const payload = {
      batchId:          activeBatch.id                    || '',
      batchNumber:      activeBatch.batchNumber           || '',
      weekName:         formData.weekName                 || '',
      weekNumber:       formData.weekNumber               ?? 1,   // ✅ undefined safe
      fromDate:         formData.fromDate                 || '',
      toDate:           formData.toDate                   || '',
      displayDateRange: formData.displayDateRange         || '',
      admNco:           formData.admNco                   || '',
      admSo:            formData.admSo                    || '',
      teaBreak:         formData.teaBreak                 || '',
      gameTime:         formData.gameTime                 || '',
      rollCall:         formData.rollCall                 || '',
      distribution:     formData.distribution             || '',
      remarks:          formData.remarks                  || '',
      schedule:         sanitizeSchedule(formData.schedule),
      updatedAt:        new Date().toISOString(),
    };

    if (isEditMode && editingId) {
      await updateDoc(doc(db, 'weeklyPrograms', editingId), payload);
      setMessage('SUCCESS: Program update ho gaya!');
    } else {
      await addDoc(collection(db, 'weeklyPrograms'), {
        ...payload,
        createdAt: new Date().toISOString(),
        createdBy: 'Clerk',
      });
      setMessage('SUCCESS: Weekly Program save ho gaya!');
    }

    setTimeout(() => {
      setShowForm(false);
      setIsEditMode(false);
      setEditingId(null);
      setFormData(getEmptyForm());
      setMessage('');
      fetchData();
    }, 2000);

  } catch (err: any) {
    setMessage(`ERROR: ${err.message}`);
  } finally {
    setSaving(false);
  }
};

  // ── Cancel form — reset edit state too ──
  const handleCancelForm = () => {
    setShowForm(false);
    setIsEditMode(false);
    setEditingId(null);
    setFormData(getEmptyForm());
    setMessage('');
  };

  // ── Delete ──
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete karna hai? Ye action undo nahi ho sakta!')) return;
    try {
      await deleteDoc(doc(db, 'weeklyPrograms', id));
      setMessage('SUCCESS: Program delete ho gaya!');
      setTimeout(() => setMessage(''), 2000);
      fetchData();
    } catch { alert('Delete failed'); }
  };

  // ── Print ──
  const handlePrint = (prog: WeeklyProgram) => {
    setPrintProgram(prog);
    setTimeout(() => window.print(), 400);
  };

  // ── Styles ──
  const inputCls =
    'w-full text-xs px-2 py-1.5 border border-slate-300 ' +
    'focus:outline-none focus:border-military-700 bg-white';
  const labelCls =
    'text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1';

  const isLectureType = (subject: string) =>
    ['lecture','theory','class'].some(k => subject.toLowerCase().includes(k));

  const getDisplaySubject = (s: any): string =>
    s.subject === 'Other (Manual)' && s.customSubject
      ? s.customSubject
      : (s.subject || '—');

  const renderPersons = (session: any) => {
    if (session.ustadName && typeof session.ustadName === 'string') {
      return <span className="font-bold text-blue-800">{session.ustadName || '—'}</span>;
    }
    if (session.ustadNames && Array.isArray(session.ustadNames)) {
      const filled = (session.ustadNames as string[]).filter((u: string) => u.trim());
      if (!filled.length) return <span className="text-slate-400">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {filled.map((u: string, i: number) => (
            <span key={i} className="font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[9px]">
              {u}
            </span>
          ))}
        </div>
      );
    }
    if (session.assignedPersons && Array.isArray(session.assignedPersons)) {
      const filled = (session.assignedPersons as AssignedPerson[]).filter(p => p.name.trim());
      if (!filled.length) return <span className="text-slate-400">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {filled.map(p => (
            <span key={p.id}
              className="inline-flex items-center gap-1 font-bold text-[9px]
                         bg-blue-50 border border-blue-200 px-1.5 py-0.5">
              <Shield size={8} className="text-military-600" />
              {p.rank && <span className="text-military-700">{p.rank}</span>}
              <span className="text-blue-800">{p.name}</span>
            </span>
          ))}
        </div>
      );
    }
    return <span className="text-slate-400">—</span>;
  };

  const renderLectureDetails = (session: any) => {
    const ld = session.lectureDetails;
    if (!ld) return null;
    if (!ld.topic && !ld.description && !ld.duration && !ld.materials) return null;
    return (
      <div className="mt-1 bg-purple-50 border border-purple-200 p-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px]">
          {ld.topic     && <div><span className="font-bold text-purple-700 uppercase">Topic:</span> {ld.topic}</div>}
          {ld.duration  && <div><span className="font-bold text-purple-700 uppercase">Duration:</span> {ld.duration}</div>}
          {ld.materials && <div><span className="font-bold text-purple-700 uppercase">Materials:</span> {ld.materials}</div>}
          {ld.description && (
            <div className="w-full">
              <span className="font-bold text-purple-700 uppercase">Details:</span> {ld.description}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="w-full flex flex-col space-y-4 pb-8">

      {/* Print styles + hidden print area */}
      <style>{PRINT_STYLES}</style>
      {printProgram && (
        <WeeklyProgramPrint program={printProgram} batch={activeBatch} />
      )}

      {/* BATCH LOCK */}
      {!hasBatch && (
        <div className="bg-red-900 border border-red-600 px-4 py-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-300 flex-shrink-0 animate-pulse" />
          <span className="text-[11px] font-black text-red-200 uppercase tracking-wide">
            Koi Active Batch Nahi! Pehle batch activate karo.
          </span>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-military-900 px-4 py-3 flex justify-between items-center shadow-flat flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Calendar size={20} className="text-white" />
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-widest">
              Weekly Training Program
            </h1>
            <p className="text-[10px] text-military-300 uppercase tracking-wider">
              Create · Edit · Manage · Print (PDF Format)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {activeBatch && (
            <span className="bg-military-800 border border-military-700 text-white
                             text-[10px] font-black px-3 py-1 uppercase flex items-center gap-1.5">
              <Layers size={12} /> Batch: {activeBatch.batchNumber}
            </span>
          )}
          {!showForm && !viewProgram && hasBatch && (
            <button
              onClick={() => {
                setIsEditMode(false);
                setEditingId(null);
                setFormData(getEmptyForm());
                setShowForm(true);
              }}
              className="bg-green-600 text-white px-4 py-1.5 text-xs font-bold
                         uppercase hover:bg-green-700 flex items-center gap-1.5"
            >
              <Plus size={14} /> New Program
            </button>
          )}
        </div>
      </div>

      {/* MESSAGE */}
      {message && (
        <div className={`p-3 text-xs font-bold border flex items-center gap-2 ${
          message.startsWith('ERROR')
            ? 'bg-red-50 text-red-600 border-red-200'
            : 'bg-green-50 text-green-700 border-green-200'
        }`}>
          {message.startsWith('ERROR')
            ? <AlertCircle size={14} />
            : <CheckCircle2 size={14} />}
          {message}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CREATE / EDIT FORM
          ═══════════════════════════════════════════════════════ */}
      {showForm && hasBatch && (
        <div className="bg-white border border-slate-300 shadow-flat">

          {/* Form Header — shows EDIT or CREATE mode */}
          <div className={`border-b border-slate-200 px-4 py-3 flex justify-between items-center
                          ${isEditMode ? 'bg-amber-50' : 'bg-slate-100'}`}>
            <h2 className="text-xs font-black text-military-900 uppercase flex items-center gap-2">
              {isEditMode
                ? <><Edit3 size={14} className="text-amber-600" /> Edit Program — {formData.weekName}</>
                : <><FileText size={14} /> Build Weekly Schedule</>}
            </h2>
            <div className="flex items-center gap-2">
              {isEditMode && (
                <span className="text-[9px] font-bold text-amber-700 bg-amber-100
                                 border border-amber-300 px-2 py-0.5 flex items-center gap-1">
                  <Edit3 size={9} /> EDIT MODE
                </span>
              )}
              <button
                onClick={handleCancelForm}
                className="text-slate-500 hover:text-red-600 font-bold text-xs
                           uppercase flex items-center gap-1"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </div>

          <div className="p-4 space-y-5">

            {/* ── PROGRAMME DETAILS ── */}
            <div className="bg-blue-50 border border-blue-200 p-4">
              <h3 className="text-[10px] font-black text-blue-900 uppercase mb-3
                             flex items-center gap-1">
                <FileText size={11} /> Programme Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                <div className="md:col-span-2">
                  <label className={labelCls}>Week Name / Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Week 13: LMG + Drill + Field Craft"
                    value={formData.weekName}
                    onChange={e => setFormData({ ...formData, weekName: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Week Number</label>
                  <input
                    type="number" min={1}
                    value={formData.weekNumber}
                    onChange={e =>
                      setFormData({ ...formData, weekNumber: Number(e.target.value) })
                    }
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>From Date (Monday) *</label>
                  <input
                    type="date"
                    value={formData.fromDate}
                    onChange={e => {
                      setFormData({ ...formData, fromDate: e.target.value });
                      autoFillDates(e.target.value);
                    }}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>To Date (Saturday) *</label>
                  <input
                    type="date"
                    value={formData.toDate}
                    onChange={e => setFormData({ ...formData, toDate: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div className="md:col-span-3">
                  <label className={labelCls}>
                    Display Date Range
                    <span className="text-[9px] text-blue-500 font-normal ml-1 normal-case">
                      (auto-fill hoga — edit karo agar chahiye)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.displayDateRange}
                    onChange={e =>
                      setFormData({ ...formData, displayDateRange: e.target.value })
                    }
                    placeholder="22.06.2026 TO 27.06.2026"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* ── PRINT FOOTER FIELDS ── */}
            <div className="bg-slate-50 border border-slate-200 p-4">
              <h3 className="text-[10px] font-black text-slate-700 uppercase mb-3
                             flex items-center gap-1">
                <Printer size={11} /> Print Footer Info
                <span className="text-[9px] text-slate-400 font-normal ml-1 normal-case">
                  (PDF ke bottom mein print hoga)
                </span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                <div>
                  <label className={labelCls}>ADM NCO</label>
                  <input
                    type="text" placeholder="HC RAM MOHAN"
                    value={formData.admNco}
                    onChange={e => setFormData({ ...formData, admNco: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>ADM SO</label>
                  <input
                    type="text" placeholder="ASI BALWAN SINGH"
                    value={formData.admSo}
                    onChange={e => setFormData({ ...formData, admSo: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Tea Break</label>
                  <input
                    type="text"
                    value={formData.teaBreak}
                    onChange={e => setFormData({ ...formData, teaBreak: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Game Time</label>
                  <input
                    type="text"
                    value={formData.gameTime}
                    onChange={e => setFormData({ ...formData, gameTime: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Roll Call</label>
                  <input
                    type="text"
                    value={formData.rollCall}
                    onChange={e => setFormData({ ...formData, rollCall: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Remarks</label>
                  <input
                    type="text" placeholder="Koi special instruction..."
                    value={formData.remarks}
                    onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div className="md:col-span-3">
                  <label className={labelCls}>Distribution</label>
                  <input
                    type="text"
                    value={formData.distribution}
                    onChange={e =>
                      setFormData({ ...formData, distribution: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* ── DAILY SCHEDULE ── */}
            <div>
              <h3 className="text-xs font-black text-military-900 uppercase
                             border-b border-slate-200 pb-2 mb-3">
                Daily Class Distribution
              </h3>

              <div className="space-y-2">
                {formData.schedule.map(dayData => (
                  <div key={dayData.day} className="border border-slate-300">

                    {/* Day Header */}
                    <div
                      className="bg-slate-800 text-white px-4 py-2.5
                                 flex items-center justify-between cursor-pointer
                                 hover:bg-slate-700 transition-colors"
                      onClick={() =>
                        setExpandedDay(expandedDay === dayData.day ? '' : dayData.day)
                      }
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="w-24 text-xs font-black uppercase">
                          {dayData.day}
                        </span>

                        {/* Inline date edit */}
                        <input
                          type="text"
                          value={dayData.date}
                          onClick={e => e.stopPropagation()}
                          onChange={e =>
                            setFormData(prev => ({
                              ...prev,
                              schedule: prev.schedule.map(d =>
                                d.day === dayData.day
                                  ? { ...d, date: e.target.value }
                                  : d
                              ),
                            }))
                          }
                          placeholder="DD/MM/YYYY"
                          className="text-[10px] bg-slate-700 text-white
                                     border border-slate-600 px-2 py-0.5
                                     w-28 focus:outline-none"
                        />

                        <span className="text-[10px] font-bold text-slate-300
                                         bg-slate-700 px-2 py-0.5">
                          {dayData.sessions.length} Classes
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={e => { e.stopPropagation(); addSession(dayData.day); }}
                          className="bg-green-600 text-white px-2 py-1
                                     text-[9px] font-bold uppercase hover:bg-green-700
                                     flex items-center gap-1"
                        >
                          <Plus size={10} /> Add Class
                        </button>
                        {expandedDay === dayData.day
                          ? <ChevronUp size={14} className="text-slate-300" />
                          : <ChevronDown size={14} className="text-slate-300" />}
                      </div>
                    </div>

                    {/* Sessions */}
                    {expandedDay === dayData.day && (
                      <div className="p-3 bg-slate-100 border-t border-slate-200 space-y-3">
                        {dayData.sessions.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center italic py-3">
                            Koi class nahi — "Add Class" click karo
                          </p>
                        ) : (
                          dayData.sessions.map((session, sIdx) => (
                            <div
                              key={session.id}
                              className="bg-white border border-slate-200 p-3 space-y-3"
                            >
                              {/* Session number badge */}
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-slate-500
                                                 bg-slate-100 border border-slate-200
                                                 px-2 py-0.5">
                                  Period {sIdx + 1}
                                </span>
                                <button
                                  onClick={() => removeSession(dayData.day, session.id)}
                                  className="bg-red-100 text-red-600 px-3 py-1
                                             hover:bg-red-200 flex items-center gap-1
                                             text-[9px] font-bold"
                                >
                                  <Trash2 size={10} /> Remove
                                </button>
                              </div>

                              {/* ★ INLINE CONFLICT WARNING */}
                              {instructorConflicts[session.id] && (
                                <div className="bg-red-50 border-2 border-red-400 p-2 flex items-start gap-2">
                                  <AlertCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                                  <div className="text-[10px]">
                                    <p className="font-black text-red-700 uppercase">
                                      ⚠ Instructor Conflict ({dayData.day})
                                    </p>
                                    {instructorConflicts[session.id].map((c, ci) => (
                                      <p key={ci} className="text-red-600 font-bold mt-0.5">
                                        {c.person} → isi time "{c.otherSubject}" ({c.otherTime}) bhi assigned hai
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* ── ROW: Time · PDS · Code · Subject · Method · Area · Platoon ── */}
                              <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end">

                                {/* Time */}
                                <div className="col-span-2 md:col-span-2">
                                  <label className="text-[9px] font-bold text-slate-500
                                                    uppercase flex items-center gap-0.5">
                                    <Clock size={8} /> Time
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="0530-0650"
                                    value={session.time}
                                    onChange={e =>
                                      updateSession(dayData.day, session.id, 'time', e.target.value)
                                    }
                                    className="w-full text-[10px] border border-slate-300
                                               px-2 py-1 focus:outline-none font-mono font-bold"
                                  />
                                </div>

                                {/* PDS */}
                                <div className="md:col-span-1">
                                  <label className="text-[9px] font-bold text-slate-500 uppercase">
                                    PDS
                                  </label>
                                  <input
                                    type="number" min={1} max={3}
                                    value={session.pds}
                                    onChange={e =>
                                      updateSession(
                                        dayData.day, session.id, 'pds', Number(e.target.value)
                                      )
                                    }
                                    className="w-full text-[10px] border border-slate-300
                                               px-2 py-1 focus:outline-none text-center font-bold"
                                  />
                                </div>

                                {/* Code */}
                                <div className="md:col-span-1">
                                  <label className="text-[9px] font-bold text-slate-500 uppercase">
                                    Code
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="PT-3"
                                    value={session.code}
                                    onChange={e =>
                                      updateSession(
                                        dayData.day, session.id,
                                        'code', e.target.value.toUpperCase()
                                      )
                                    }
                                    className="w-full text-[10px] border border-slate-300
                                               px-2 py-1 focus:outline-none uppercase font-bold"
                                  />
                                </div>

                                {/* Subject */}
                                <div className="col-span-2 md:col-span-3">
                                  <label className="text-[9px] font-bold text-slate-500
                                                    uppercase flex items-center gap-0.5">
                                    <Target size={8} /> Subject
                                  </label>
                                  <select
                                    value={session.subject}
                                    onChange={e =>
                                      updateSession(dayData.day, session.id, 'subject', e.target.value)
                                    }
                                    className="w-full text-[10px] border border-slate-300
                                               px-2 py-1 focus:outline-none"
                                  >
                                    {SUBJECTS.map(s =>
                                      <option key={s} value={s}>{s}</option>
                                    )}
                                    <option value="Other (Manual)">✏️ Other (Manual)</option>
                                  </select>

                                  {session.subject === 'Other (Manual)' && (
                                    <input
                                      type="text"
                                      placeholder="Subject manually likho..."
                                      value={session.customSubject}
                                      onChange={e =>
                                        updateSession(
                                          dayData.day, session.id,
                                          'customSubject', e.target.value
                                        )
                                      }
                                      className="w-full text-[10px] border border-orange-300
                                                 bg-orange-50 px-2 py-1 mt-1
                                                 focus:outline-none uppercase"
                                    />
                                  )}
                                </div>

                                {/* Method */}
                                <div className="md:col-span-2">
                                  <label className="text-[9px] font-bold text-slate-500 uppercase">
                                    Method
                                  </label>
                                  <select
                                    value={session.method}
                                    onChange={e =>
                                      updateSession(dayData.day, session.id, 'method', e.target.value)
                                    }
                                    className="w-full text-[10px] border border-slate-300
                                               px-2 py-1 focus:outline-none font-bold"
                                  >
                                    {METHODS.map(m =>
                                      <option key={m} value={m}>{m}</option>
                                    )}
                                  </select>
                                </div>

                                {/* Area */}
                                <div className="md:col-span-2">
                                  <label className="text-[9px] font-bold text-slate-500
                                                    uppercase flex items-center gap-0.5">
                                    <MapPin size={8} /> Area
                                  </label>
                                  <input
                                    type="text"
                                    list={`area-${session.id}`}
                                    value={session.location}
                                    onChange={e =>
                                      updateSession(dayData.day, session.id, 'location', e.target.value)
                                    }
                                    className="w-full text-[10px] border border-slate-300
                                               px-2 py-1 focus:outline-none uppercase"
                                  />
                                  <datalist id={`area-${session.id}`}>
                                    {AREAS.map(a => <option key={a} value={a} />)}
                                  </datalist>
                                </div>

                                {/* Platoon */}
                                <div className="md:col-span-1">
                                  <label className="text-[9px] font-bold text-slate-500
                                                    uppercase flex items-center gap-0.5">
                                    <Users size={8} /> Platoon
                                  </label>
                                  <select
                                    value={session.platoon}
                                    onChange={e =>
                                      updateSession(dayData.day, session.id, 'platoon', e.target.value)
                                    }
                                    className="w-full text-[10px] border border-slate-300
                                               px-2 py-1 focus:outline-none"
                                  >
                                    {PLATOONS.map(p =>
                                      <option key={p} value={p}>{p}</option>
                                    )}
                                  </select>
                                </div>
                              </div>

                              {/* ── Assigned Persons ── */}
                              <div className="bg-green-50 border border-green-200 p-2">
                                <label className="text-[9px] font-bold text-green-800
                                                  uppercase flex items-center gap-1 mb-1.5">
                                  <Shield size={9} /> Responsibility / Assigned Persons
                                  <span className="text-[8px] text-green-600 font-normal
                                                   normal-case ml-1">
                                    (Print → RESPONSIBILITY column)
                                  </span>
                                </label>
                                <PersonMultiSelect
                                  sessionId={session.id}
                                  day={dayData.day}
                                  assignedPersons={session.assignedPersons}
                                  allUstads={ustads}
                                  onUpdate={updateSessionPersons}
                                />
                              </div>

                              {/* ── Lecture Details (conditional) ── */}
                              {isLectureType(session.subject) && (
                                <div className="bg-purple-50 border border-purple-200 p-2">
                                  <label className="text-[9px] font-bold text-purple-800
                                                    uppercase flex items-center gap-1 mb-2">
                                    <BookOpen size={9} /> Lecture / Theory Details
                                    <span className="text-[8px] text-purple-500 font-normal
                                                     normal-case ml-1">
                                      (Optional)
                                    </span>
                                  </label>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <div>
                                      <label className="text-[8px] font-bold text-purple-600 uppercase">
                                        Topic
                                      </label>
                                      <input
                                        type="text" placeholder="e.g. IPC Section 302..."
                                        value={session.lectureDetails.topic}
                                        onChange={e =>
                                          updateLectureDetails(
                                            dayData.day, session.id, 'topic', e.target.value
                                          )
                                        }
                                        className="w-full text-[10px] border border-purple-300
                                                   px-2 py-1 bg-white focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[8px] font-bold text-purple-600 uppercase">
                                        Duration
                                      </label>
                                      <input
                                        type="text" placeholder="45 min..."
                                        value={session.lectureDetails.duration}
                                        onChange={e =>
                                          updateLectureDetails(
                                            dayData.day, session.id, 'duration', e.target.value
                                          )
                                        }
                                        className="w-full text-[10px] border border-purple-300
                                                   px-2 py-1 bg-white focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[8px] font-bold text-purple-600 uppercase">
                                        Materials
                                      </label>
                                      <input
                                        type="text" placeholder="Projector, Chart..."
                                        value={session.lectureDetails.materials}
                                        onChange={e =>
                                          updateLectureDetails(
                                            dayData.day, session.id, 'materials', e.target.value
                                          )
                                        }
                                        className="w-full text-[10px] border border-purple-300
                                                   px-2 py-1 bg-white focus:outline-none"
                                      />
                                    </div>
                                    <div className="md:col-span-3">
                                      <label className="text-[8px] font-bold text-purple-600 uppercase">
                                        Description / Key Points
                                      </label>
                                      <textarea
                                        rows={2}
                                        placeholder="Key points..."
                                        value={session.lectureDetails.description}
                                        onChange={e =>
                                          updateLectureDetails(
                                            dayData.day, session.id, 'description', e.target.value
                                          )
                                        }
                                        className="w-full text-[10px] border border-purple-300
                                                   px-2 py-1 bg-white focus:outline-none resize-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ★ CONFLICT SUMMARY PANEL (Save ke pehle) */}
            {conflictSessionCount > 0 && (
              <div className="bg-red-600 text-white p-3 flex items-center gap-3 border-2 border-red-700">
                <AlertCircle size={18} className="flex-shrink-0 animate-pulse" />
                <div className="flex-1">
                  <p className="text-[11px] font-black uppercase tracking-wide">
                    {conflictSessionCount} session(s) mein Instructor Conflict!
                  </p>
                  <p className="text-[10px] text-red-100 mt-0.5">
                    Ek hi ustad same day + same time pe do alag classes mein hai.
                    Red-boxed sessions check karke time ya responsibility theek karein.
                  </p>
                </div>
              </div>
            )}

            {/* ── SAVE / UPDATE BUTTON ── */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={handleCancelForm}
                className="px-4 py-2 text-xs font-bold uppercase border border-slate-300
                           text-slate-600 hover:bg-slate-50 flex items-center gap-1"
              >
                <X size={12} /> Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className={`text-white px-6 py-2 text-xs font-bold uppercase
                            flex items-center gap-2 disabled:opacity-50 ${
                  isEditMode
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {saving
                  ? <Loader2 size={14} className="animate-spin" />
                  : isEditMode
                    ? <><Edit3 size={14} /> Update Program</>
                    : <><Save size={14} /> Save Program</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          VIEW PROGRAM
          ═══════════════════════════════════════════════════════ */}
      {viewProgram && (
        <div className="bg-white border border-slate-300 shadow-flat">

          <div className="bg-military-900 px-4 py-3 flex justify-between items-center flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-black text-white uppercase">
                {viewProgram.weekName}
              </h2>
              <p className="text-[10px] text-military-300 uppercase mt-0.5">
                {viewProgram.displayDateRange
                  || `${viewProgram.fromDate} to ${viewProgram.toDate}`}
                {viewProgram.weekNumber ? ` | Week ${viewProgram.weekNumber}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleEdit(viewProgram)}
                className="bg-amber-500 text-black px-3 py-1.5 text-[10px]
                           font-bold uppercase hover:bg-amber-600 flex items-center gap-1"
              >
                <Edit3 size={11} /> Edit
              </button>
              <button
                onClick={() => handlePrint(viewProgram)}
                className="bg-green-600 text-white px-3 py-1.5 text-[10px]
                           font-bold uppercase hover:bg-green-700 flex items-center gap-1"
              >
                <Printer size={11} /> Print / PDF
              </button>
              <button
                onClick={() => setViewProgram(null)}
                className="bg-slate-700 text-white px-3 py-1.5 text-[10px]
                           font-bold hover:bg-slate-600 flex items-center gap-1"
              >
                <X size={11} /> Close
              </button>
            </div>
          </div>

          {viewProgram.remarks && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
              <span className="text-[10px] font-bold text-amber-800 uppercase">Remarks: </span>
              <span className="text-xs text-amber-900">{viewProgram.remarks}</span>
            </div>
          )}

          {/* PDF-style preview table */}
          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200">
                  {[
                    'DAY & DATE','TIME','PDS','CODE',
                    'SUBJECT','METHOD','AREA','RESPONSIBILITY',
                  ].map(h => (
                    <th key={h}
                      className="border border-slate-400 px-3 py-2 text-left
                                 text-[10px] font-black text-slate-700 uppercase whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewProgram.schedule.map(dayData => {
                  if (!dayData.sessions.length) return null;
                  return dayData.sessions.map((session, idx) => (
                    <tr key={session.id} className="hover:bg-slate-50">

                      {idx === 0 && (
                        <td
                          rowSpan={dayData.sessions.length}
                          className="border border-slate-300 px-3 py-2 font-black
                                     text-center bg-slate-100 align-middle
                                     whitespace-nowrap text-[10px]"
                        >
                          <div className="font-black text-military-900 uppercase">
                            {dayData.day}
                          </div>
                          <div className="text-slate-600 font-bold mt-0.5">
                            {dayData.date}
                          </div>
                        </td>
                      )}

                      <td className="border border-slate-200 px-3 py-1.5
                                     font-mono font-bold text-[10px] whitespace-nowrap">
                        {session.time || '—'}
                      </td>
                      <td className="border border-slate-200 px-3 py-1.5
                                     text-center font-bold text-[10px]">
                        {session.pds ?? 2}
                      </td>
                      <td className="border border-slate-200 px-3 py-1.5
                                     text-center font-bold text-[10px]">
                        {session.code
                          ? <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[9px] font-black">
                              {session.code}
                            </span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="border border-slate-200 px-3 py-1.5 text-[10px]">
                        <span className="font-bold">{getDisplaySubject(session)}</span>
                        {renderLectureDetails(session)}
                      </td>
                      <td className="border border-slate-200 px-3 py-1.5
                                     text-center font-bold text-[10px]">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold ${
                          (session.method || '').includes('PRAC')
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {session.method || 'PRAC'}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-3 py-1.5
                                     text-[10px] whitespace-nowrap">
                        {session.location || '—'}
                      </td>
                      <td className="border border-slate-200 px-3 py-1.5 text-[10px]">
                        {renderPersons(session)}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>

            {/* Footer preview */}
            <div className="mt-4 bg-slate-50 border border-slate-200 p-3
                            flex justify-between items-start flex-wrap gap-2 text-[10px]">
              <div className="space-y-0.5 text-slate-600">
                {viewProgram.admNco       && <div><strong>ADM NCO:</strong> {viewProgram.admNco}</div>}
                {viewProgram.admSo        && <div><strong>ADM SO:</strong> {viewProgram.admSo}</div>}
                {viewProgram.teaBreak     && <div>(1) TEA BREAK: {viewProgram.teaBreak}</div>}
                {viewProgram.gameTime     && <div>(2) GAME: {viewProgram.gameTime}</div>}
                {viewProgram.rollCall     && <div>(3) ROLL CALL: {viewProgram.rollCall}</div>}
                {viewProgram.distribution && <div>(4) DISTRIBUTION: {viewProgram.distribution}</div>}
              </div>
              <div className="text-right font-bold text-slate-700">
                <div>FOR INSPECTOR GENERAL</div>
                <div>{(activeBatch as any)?.unit || 'STC BSF TEKANPUR'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          PROGRAMS LIST
          ═══════════════════════════════════════════════════════ */}
      {!showForm && !viewProgram && hasBatch && (
        <div className="bg-white border border-slate-300 shadow-flat">

          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50
                          flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-700 uppercase flex items-center gap-2">
              <Calendar size={13} /> Saved Programs
            </h3>
            <span className="text-[10px] font-bold text-slate-500
                             bg-white px-2 py-0.5 border border-slate-200">
              {programs.length} Records
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <Loader2 size={24} className="mx-auto animate-spin text-military-500" />
            </div>
          ) : programs.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-500 uppercase">Koi program nahi</p>
              <p className="text-[10px] text-slate-400 mt-1">
                'New Program' se schedule banayein.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-600 uppercase">
                      Week
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-600 uppercase">
                      Date Range
                    </th>
                    <th className="px-4 py-2 text-center text-[10px] font-bold text-slate-600 uppercase">
                      Classes
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-600 uppercase">
                      Remarks
                    </th>
                    <th className="px-4 py-2 text-center text-[10px] font-bold text-slate-600 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {programs.map(p => {
                    const total = p.schedule.reduce(
                      (a, c) => a + c.sessions.length, 0
                    );
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-military-900 uppercase">
                          {p.weekNumber && (
                            <span className="bg-amber-100 text-amber-800
                                             px-1.5 py-0.5 text-[9px] font-black mr-2">
                              W{p.weekNumber}
                            </span>
                          )}
                          {p.weekName}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600
                                       text-[10px] whitespace-nowrap">
                          {p.displayDateRange || `${p.fromDate} → ${p.toDate}`}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-blue-700">
                          {total}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-[10px]
                                       max-w-[160px] truncate">
                          {p.remarks || '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">

                            {/* VIEW */}
                            <button
                              onClick={() => setViewProgram(p)}
                              className="bg-military-100 text-military-700 px-2 py-1
                                         text-[9px] font-bold hover:bg-military-200"
                            >
                              VIEW
                            </button>

                            {/* ✅ EDIT */}
                            <button
                              onClick={() => handleEdit(p)}
                              className="bg-amber-100 text-amber-700 px-2 py-1
                                         text-[9px] font-bold hover:bg-amber-200
                                         flex items-center gap-0.5"
                            >
                              <Edit3 size={9} /> EDIT
                            </button>

                            {/* PRINT */}
                            <button
                              onClick={() => handlePrint(p)}
                              className="bg-green-100 text-green-700 px-2 py-1
                                         text-[9px] font-bold hover:bg-green-200
                                         flex items-center gap-0.5"
                            >
                              <Printer size={9} /> PRINT
                            </button>

                            {/* DELETE */}
                            <button
                              onClick={() => p.id && handleDelete(p.id)}
                              className="bg-red-50 text-red-600 px-2 py-1
                                         text-[9px] font-bold hover:bg-red-100"
                            >
                              DEL
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};