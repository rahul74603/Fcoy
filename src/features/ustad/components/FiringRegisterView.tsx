import React from 'react';
import {
  firingClassColor, firingConfigChips, firingMaxScore, firingPracticeLabel, firingRegisterKind,
  FIRING_POSITIONS, FIRING_ZEROING, FIRING_GRADINGS, FIRING_REMARK_OPTIONS,
  type FiringConfig, type FiringDetails, type TraineeResult,
} from '../types/testRecord.types';

interface Props {
  config?: FiringConfig;
  details?: FiringDetails;
}

const Cell: React.FC<{ label: string; value: React.ReactNode; alert?: boolean }> = ({ label, value, alert }) => (
  <div className={`rounded border px-2 py-1.5 ${alert ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
    <p className="text-[8px] font-black text-slate-400 uppercase">{label}</p>
    <p className={`text-[11px] font-bold break-words ${alert ? 'text-red-700' : 'text-slate-800'}`}>{value as any}</p>
  </div>
);

export const FiringRegisterView: React.FC<Props> = ({ config, details }) => {
  if (!config && !details) return null;
  const kind = firingRegisterKind(config);
  const grading = details?.grading || details?.classification || '';
  const max = details?.maxScore || firingMaxScore(config);
  const score = details?.score ?? details?.actualScore;
  const gs = details?.groupSizeCm ?? details?.groupSizeInches ?? details?.groupSize;
  const misfires = Number(details?.misfires || 0);
  const qualified = grading === 'MM' || grading === 'FC' || grading === 'SS';

  return (
    <div className="space-y-2">
      <p className="text-[9px] font-black text-orange-700 uppercase">
        {kind === 'grouping' ? 'Grouping & Zeroing Register' : kind === 'tactical' ? 'Reflex / Tactical Register' : 'Classification & Annual Range Course'}
      </p>

      {config && (
        <div className="flex flex-wrap gap-1">
          {firingConfigChips(config).map((chip, i) => (
            <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-800">
              {chip}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
        <Cell label="Weapon / No" value={[config?.weaponType, details?.weaponNo].filter(Boolean).join(' / ') || '—'} />
        <Cell label="Practice" value={firingPracticeLabel(config)} />
        <Cell label="Distance" value={config?.distance || '—'} />
        <Cell label="Position" value={details?.firingPosition || config?.firingPosition || '—'} />
        <Cell label="Ammunition issued" value={details?.roundsIssued ?? config?.totalRounds ?? '—'} />
        <Cell label="Hits recorded" value={details?.hitsOnTarget ?? '—'} />
        {kind === 'grouping' ? (
          <>
            <Cell label="Group size" value={gs != null && Number(gs) > 0 ? `${gs} cm` : '—'} />
            <Cell label="Zeroing action" value={details?.zeroingAction || '—'} />
          </>
        ) : kind === 'tactical' ? (
          <>
            <Cell label="Time (sec)" value={details?.timeSeconds ?? '—'} />
            <Cell label="Penalties / misses" value={details?.penalties ?? '—'} />
          </>
        ) : (
          <>
            <Cell label="Total score" value={score != null ? `${score}/${max}` : '—'} />
            <Cell label="Misfires" value={misfires} alert={misfires > 0} />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {grading && (
          <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded ${firingClassColor(String(grading))}`}>
            {grading === 'MM' ? 'MM (Marksman)' : grading === 'FC' ? 'FC (First Class)' : grading === 'SS' ? 'SS (Sharpshooter)' : grading === 'FAIL' ? 'FAIL' : grading}
          </span>
        )}
        {qualified && <span className="text-[9px] font-black px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">Qualified</span>}
        {(grading === 'FAIL' || grading === 'Failed') && <span className="text-[9px] font-black px-2 py-0.5 rounded bg-red-600 text-white">Not Qualified</span>}
        {details?.reFiringNeeded && <span className="text-[9px] font-black px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">Re-firing needed</span>}
      </div>

      {details?.remarks && (
        <div className="rounded bg-amber-50 border border-amber-200 px-2 py-1.5">
          <p className="text-[8px] font-black text-amber-700 uppercase">Range Officer remarks</p>
          <p className="text-[10px] font-medium text-amber-950 leading-snug">{details.remarks}</p>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-[9px] font-black text-orange-800 uppercase mb-1">{label}</span>
    {children}
  </label>
);

const inputCls = 'w-full px-2 py-2 border-2 border-orange-300 rounded-lg text-sm font-bold bg-white';

export const FiringEntryCard: React.FC<{
  result: TraineeResult;
  config: FiringConfig;
  onChange: (patch: Partial<FiringDetails>) => void;
}> = ({ result, config, onChange }) => {
  const kind = firingRegisterKind(config);
  const d = result.firingDetails || {};
  const grading = d.grading || '';
  const qualified = grading === 'MM' || grading === 'FC' || grading === 'SS';

  return (
    <div className={`rounded-xl border-2 p-3 space-y-3 ${
      qualified ? 'border-green-300 bg-green-50/40' : grading === 'FAIL' ? 'border-red-300 bg-red-50/40' : 'border-orange-200 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-900">{result.traineeName}</p>
          <p className="text-[10px] font-bold text-slate-500">
            Chest {result.chestNo || '—'} · Regt {result.regNo || '—'} · {result.platoon || '—'}
          </p>
        </div>
        {grading ? (
          <span className={`text-[10px] font-black px-2 py-1 rounded ${firingClassColor(grading)}`}>
            {grading === 'MM' ? 'MM Qualified' : grading === 'FC' ? 'FC Qualified' : grading === 'SS' ? 'SS Qualified' : 'FAIL'}
          </span>
        ) : (
          <span className="text-[10px] font-black px-2 py-1 rounded bg-slate-200 text-slate-600">Fill below</span>
        )}
      </div>

      {kind === 'grouping' ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Weapon No">
            <input className={inputCls} value={d.weaponNo || ''} placeholder="INSAS-8941" onChange={e => onChange({ weaponNo: e.target.value })} />
          </Field>
          <Field label="Rounds">
            <input className={inputCls} type="number" min={0} value={d.roundsIssued ?? config.totalRounds}
              onChange={e => onChange({ roundsIssued: Number(e.target.value), roundsFired: Number(e.target.value) })} />
          </Field>
          <Field label="Group size (cm)">
            <input className={inputCls} type="number" min={0} step={0.1} value={d.groupSizeCm ?? ''} placeholder="2.5"
              onChange={e => onChange({ groupSizeCm: Number(e.target.value) })} />
          </Field>
          <Field label="Zeroing">
            <select className={inputCls} value={d.zeroingAction || ''} onChange={e => onChange({ zeroingAction: e.target.value })}>
              <option value="">— Select —</option>
              {FIRING_ZEROING.map(z => <option key={z}>{z}</option>)}
            </select>
          </Field>
        </div>
      ) : kind === 'tactical' ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Time (seconds)">
            <input className={inputCls} type="number" min={0} value={d.timeSeconds ?? ''} onChange={e => onChange({ timeSeconds: Number(e.target.value) })} />
          </Field>
          <Field label="Hits">
            <input className={inputCls} type="number" min={0} value={d.hitsOnTarget ?? ''} onChange={e => onChange({ hitsOnTarget: Number(e.target.value) })} />
          </Field>
          <Field label="Penalties / misses">
            <input className={inputCls} type="number" min={0} value={d.penalties ?? ''} onChange={e => onChange({ penalties: Number(e.target.value) })} />
          </Field>
          <Field label="Score">
            <input className={inputCls} type="number" min={0} value={d.score ?? ''} onChange={e => onChange({ score: Number(e.target.value) })} />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Weapon No">
            <input className={inputCls} value={d.weaponNo || ''} placeholder="W-34821" onChange={e => onChange({ weaponNo: e.target.value })} />
          </Field>
          <Field label="Position">
            <select className={inputCls} value={d.firingPosition || config.firingPosition || 'Lying'} onChange={e => onChange({ firingPosition: e.target.value })}>
              {FIRING_POSITIONS.map(pos => <option key={pos}>{pos}</option>)}
            </select>
          </Field>
          <Field label="Rounds issued">
            <input className={inputCls} type="number" min={0} value={d.roundsIssued ?? config.totalRounds}
              onChange={e => onChange({ roundsIssued: Number(e.target.value) })} />
          </Field>
          <Field label="Hits on target">
            <input className={inputCls} type="number" min={0} value={d.hitsOnTarget ?? ''} placeholder="9"
              onChange={e => onChange({ hitsOnTarget: Number(e.target.value) })} />
          </Field>
          <Field label={`Score / ${firingMaxScore(config)}`}>
            <input className={inputCls} type="number" min={0} max={firingMaxScore(config)} value={d.score ?? ''} placeholder="36"
              onChange={e => onChange({ score: Number(e.target.value) })} />
          </Field>
          <Field label="Grading">
            <select className={inputCls} value={grading} onChange={e => onChange({ grading: e.target.value as FiringDetails['grading'] })}>
              <option value="">Auto from score</option>
              {FIRING_GRADINGS.map(g => <option key={g} value={g}>{g === 'MM' ? 'MM Marksman' : g === 'FC' ? 'FC First Class' : g === 'SS' ? 'SS Sharpshooter' : 'FAIL'}</option>)}
            </select>
          </Field>
        </div>
      )}

      <Field label="Range Officer remarks">
        <select className={inputCls} value={d.remarksCode || ''} onChange={e => onChange({ remarksCode: e.target.value })}>
          {FIRING_REMARK_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
        </select>
      </Field>
      {d.remarks ? <p className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">{d.remarks}</p> : null}
    </div>
  );
};

export default FiringRegisterView;
