import React from 'react';
import {
  firingClassColor, firingConfigChips, firingMaxScore, firingPracticeLabel, firingRegisterKind,
  type FiringConfig, type FiringDetails,
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

export default FiringRegisterView;
