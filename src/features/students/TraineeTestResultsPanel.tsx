// Tests / Results on Rangroot Profile — pulls every Test Records entry
// for this trainee (Drill, Weapon, Firing, PT, FPT, Map, Field Craft, …).

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { getTestsByBatch } from '../ustad/api/testRecord.api';
import {
  TEST_TYPE_INFO, GRADE_COLORS,
  type TestRecord, type TestType, type TraineeResult,
} from '../ustad/types/testRecord.types';

interface Props {
  traineeId: string;
  traineeName?: string;
  chestNo?: string;
  regNo?: string;
  batchId?: string;
}

type Row = {
  test: TestRecord;
  result: TraineeResult | null;
};

const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const matchesTrainee = (
  r: TraineeResult, traineeId: string, chestNo?: string, name?: string, regNo?: string,
) => {
  if (r.traineeId && traineeId && r.traineeId === traineeId) return true;
  if (chestNo && r.chestNo && String(r.chestNo) === String(chestNo)) return true;
  if (regNo && r.regNo && String(r.regNo) === String(regNo)) return true;
  if (name && r.traineeName && r.traineeName.trim().toUpperCase() === name.trim().toUpperCase()) return true;
  return false;
};

export const TraineeTestResultsPanel: React.FC<Props> = ({
  traineeId, traineeName, chestNo, regNo, batchId,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openType, setOpenType] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId || !traineeId) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    getTestsByBatch(batchId)
      .then((tests) => {
        if (cancelled) return;
        const mapped: Row[] = tests
          .filter(t => t.status !== 'cancelled')
          .map(test => ({
            test,
            result: (test.results || []).find(r =>
              matchesTrainee(r, traineeId, chestNo, traineeName, regNo)
            ) ?? null,
          }))
          .filter(row => row.result !== null || row.test.status === 'scheduled' || row.test.status === 'in_progress');
        setRows(mapped);
      })
      .catch((err) => {
        console.error('Trainee tests load error:', err);
        if (!cancelled) setError('Test records load nahi hue. Permissions / batch check karo.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [batchId, traineeId, chestNo, traineeName, regNo]);

  const attempted = rows.filter(r => r.result && r.result.status !== 'absent');
  const pass = attempted.filter(r => r.result?.status === 'pass');
  const fail = attempted.filter(r => r.result?.status === 'fail');
  const absent = rows.filter(r => r.result?.status === 'absent');
  const pending = rows.filter(r => !r.result);

  const byType = useMemo(() => {
    const map = new Map<TestType, Row[]>();
    rows.forEach(row => {
      const key = row.test.testType;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });
    return Array.from(map.entries());
  }, [rows]);

  if (!batchId) {
    return (
      <div className="p-4 text-center text-xs font-bold text-slate-500 uppercase">
        Batch assign nahi hai — tests nahi dikh sakte.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center text-slate-500">
        <Loader2 size={22} className="animate-spin mb-2" />
        <p className="text-[10px] font-bold uppercase">Loading test records…</p>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-xs font-bold text-red-600">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Tests given', value: attempted.length, cls: 'bg-slate-50 border-slate-200 text-slate-800' },
          { label: 'Pass', value: pass.length, cls: 'bg-green-50 border-green-200 text-green-800' },
          { label: 'Fail', value: fail.length, cls: 'bg-red-50 border-red-200 text-red-800' },
          { label: 'Pending / Absent', value: pending.length + absent.length, cls: 'bg-amber-50 border-amber-200 text-amber-800' },
        ].map(c => (
          <div key={c.label} className={`border rounded-lg p-3 text-center ${c.cls}`}>
            <p className="text-2xl font-black">{c.value}</p>
            <p className="text-[9px] font-black uppercase tracking-wider mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {pass.length > 0 && (
        <p className="text-[11px] text-green-800">
          <span className="font-black uppercase">Pass:</span>{' '}
          {pass.map(r => TEST_TYPE_INFO[r.test.testType]?.label || r.test.testName).join(', ')}
        </p>
      )}
      {fail.length > 0 && (
        <p className="text-[11px] text-red-800">
          <span className="font-black uppercase">Fail:</span>{' '}
          {fail.map(r => TEST_TYPE_INFO[r.test.testType]?.label || r.test.testName).join(', ')}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="border border-slate-200 bg-slate-50 p-6 text-center text-xs font-bold text-slate-500 uppercase">
          Is batch me abhi koi test record nahi / is trainee ke results enter nahi hue.
        </div>
      ) : (
        <div className="space-y-2">
          {byType.map(([type, typeRows]) => {
            const info = TEST_TYPE_INFO[type];
            const typePass = typeRows.filter(r => r.result?.status === 'pass').length;
            const typeFail = typeRows.filter(r => r.result?.status === 'fail').length;
            const typeOpen = openType === type;
            return (
              <div key={type} className={`border rounded-lg overflow-hidden ${info?.borderColor || 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setOpenType(typeOpen ? null : type)}
                  className={`w-full flex items-center justify-between px-3 py-2 ${info?.bgColor || 'bg-slate-50'}`}
                >
                  <span className={`text-xs font-black uppercase ${info?.color || 'text-slate-800'}`}>
                    {info?.icon} {info?.label || type} · {typeRows.length}
                  </span>
                  <span className="flex items-center gap-2 text-[10px] font-bold">
                    <span className="text-green-700">Pass {typePass}</span>
                    <span className="text-red-700">Fail {typeFail}</span>
                    {typeOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>
                {typeOpen && (
                  <div className="divide-y divide-slate-100 bg-white">
                    {typeRows.map(({ test, result }) => {
                      const open = openId === test.id;
                      const st = result?.status;
                      return (
                        <div key={test.id}>
                          <button
                            type="button"
                            onClick={() => setOpenId(open ? null : test.id)}
                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 text-left"
                          >
                            <div>
                              <p className="text-[12px] font-black text-slate-800">{test.testName || info?.label}</p>
                              <p className="text-[10px] text-slate-500">
                                {fmtDate(test.testDate)}
                                {test.weekNumber ? ` · Wk ${test.weekNumber}` : ''}
                                {test.subjectCode ? ` · ${test.subjectCode}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {st === 'pass' && <span className="text-[9px] font-black bg-green-600 text-white px-2 py-0.5 rounded">PASS</span>}
                              {st === 'fail' && <span className="text-[9px] font-black bg-red-600 text-white px-2 py-0.5 rounded">FAIL</span>}
                              {st === 'absent' && <span className="text-[9px] font-black bg-slate-500 text-white px-2 py-0.5 rounded">ABSENT</span>}
                              {!result && <span className="text-[9px] font-black bg-amber-500 text-white px-2 py-0.5 rounded">PENDING</span>}
                              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                          </button>
                          {open && (
                            <div className="px-3 pb-3 text-[11px] space-y-2">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <Detail label="Date" value={fmtDate(test.testDate)} />
                                <Detail label="Time" value={[test.startTime, test.endTime].filter(Boolean).join('–') || '—'} />
                                <Detail label="Venue" value={test.venue || '—'} />
                                <Detail label="Instructor" value={test.instructorName || '—'} />
                                <Detail label="Total marks" value={String(test.totalMarks)} />
                                <Detail label="Passing" value={`${test.passingMarks} (${test.passingPercent}%)`} />
                                <Detail
                                  label="Obtained"
                                  value={result ? `${result.marks} / ${test.totalMarks}` : '—'}
                                />
                                <Detail
                                  label="Grade"
                                  value={result?.grade || '—'}
                                  badge={result?.grade ? GRADE_COLORS[result.grade] : undefined}
                                />
                              </div>
                              {result?.events && result.events.length > 0 && (
                                <div className="border border-slate-200 rounded overflow-hidden">
                                  <p className="text-[9px] font-black uppercase bg-slate-50 px-2 py-1">FPT events</p>
                                  <table className="w-full text-[10px]">
                                    <thead>
                                      <tr className="text-slate-500">
                                        <th className="text-left px-2 py-1">Event</th>
                                        <th className="text-center px-2 py-1">Marks</th>
                                        <th className="text-center px-2 py-1">Result</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {result.events.map((ev, i) => (
                                        <tr key={i} className="border-t border-slate-100">
                                          <td className="px-2 py-1 font-bold">{ev.name}{ev.runningGrade ? ` (${ev.runningGrade})` : ''}</td>
                                          <td className="px-2 py-1 text-center font-mono">{ev.marks}/{ev.maxMarks}</td>
                                          <td className={`px-2 py-1 text-center font-black ${ev.passed ? 'text-green-700' : 'text-red-700'}`}>
                                            {ev.passed ? 'PASS' : 'FAIL'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {result?.remarks && (
                                <p className="text-slate-600"><span className="font-black">Remarks:</span> {result.remarks}</p>
                              )}
                              {result?.weakAreas && result.weakAreas.length > 0 && (
                                <p className="text-amber-800"><span className="font-black">Weak areas:</span> {result.weakAreas.join(', ')}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Detail: React.FC<{ label: string; value: string; badge?: string }> = ({ label, value, badge }) => (
  <div className="bg-slate-50 border border-slate-100 rounded px-2 py-1.5">
    <p className="text-[8px] font-black text-slate-400 uppercase">{label}</p>
    {badge
      ? <span className={`inline-block mt-0.5 text-[10px] font-black px-1.5 py-0.5 rounded ${badge}`}>{value}</span>
      : <p className="text-[11px] font-bold text-slate-800">{value}</p>}
  </div>
);
