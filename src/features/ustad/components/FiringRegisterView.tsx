import React from 'react';
import {
  firingClassColor, firingConfigChips, firingMaxScore, firingPracticeLabel, firingScoringMode,
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
  const mode = firingScoringMode(config);
  const grading = details?.grading || details?.classification || '';
  const max = details?.maxScore || firingMaxScore(config);
  const score = details?.score ?? details?.actualScore;
  const gs = details?.groupSizeInches ?? details?.groupSize;
  const misfires = Number(details?.misfires || 0);

  return (
    <div className="space-y-2">
      <p className="text-[9px] font-black text-orange-700 uppercase">STC Firing Register — original record</p>

      {config && (
        <div className="flex flex-wrap gap-1">
          {firingConfigChips(config).map((chip, i) => (
            <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-800">
              {chip}
            </span>
          ))}
        </div>
      )}

      <div>
        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Format A — Ammunition Issue & Expense</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          <Cell label="Rounds issued" value={details?.roundsIssued ?? config?.totalRounds ?? '—'} />
          <Cell label="Rounds fired" value={details?.roundsFired ?? '—'} />
          <Cell label="Empty cases returned" value={details?.emptyCasesReturned ?? '—'} />
          <Cell label="Misfires" value={misfires} alert={misfires > 0} />
        </div>
      </div>

      <div>
        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Format B — Score & Classification</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          <Cell label="Practice type" value={firingPracticeLabel(config)} />
          <Cell label="Lane" value={details?.laneNo || '—'} />
          <Cell label="Hits on target" value={details?.hitsOnTarget ?? '—'} />
          {mode === 'grouping' ? (
            <Cell label="Group size (inches)" value={gs != null && Number(gs) > 0 ? `${gs} in` : '—'} />
          ) : (
            <Cell label="Score" value={score != null ? `${score}/${max}` : '—'} />
          )}
        </div>
      </div>

      {details?.ringValues && details.ringValues.some(v => Number(v) > 0) && (
        <div className="flex flex-wrap gap-1">
          {details.ringValues.map((ring, i) => (
            <span key={i} className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
              ring >= 8 ? 'bg-green-50 border-green-300 text-green-700' :
              ring >= 5 ? 'bg-amber-50 border-amber-300 text-amber-700' :
              'bg-red-50 border-red-300 text-red-700'
            }`}>R{i + 1}: {ring}</span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {grading && (
          <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded ${firingClassColor(String(grading))}`}>
            {grading}
            {mode === 'application' && score != null ? ` · ${score}/${max}` : ''}
            {mode === 'grouping' && gs ? ` · ${gs} in` : ''}
          </span>
        )}
        {details?.reFiringNeeded && (
          <span className="text-[9px] font-black px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
            Re-firing needed
          </span>
        )}
        {grading && grading !== 'Failed' && grading !== '' && (
          <span className="text-[9px] font-black px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">
            Qualified
          </span>
        )}
        {grading === 'Failed' && (
          <span className="text-[9px] font-black px-2 py-0.5 rounded bg-red-600 text-white">
            Not Qualified
          </span>
        )}
      </div>

      {details?.remarks && (
        <div className="rounded bg-amber-50 border border-amber-200 px-2 py-1.5">
          <p className="text-[8px] font-black text-amber-700 uppercase">Register remarks</p>
          <p className="text-[10px] font-medium text-amber-950 leading-snug">{details.remarks}</p>
        </div>
      )}
    </div>
  );
};

export default FiringRegisterView;
