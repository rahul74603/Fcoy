// ═══════════════════════════════════════════════════════════════════════
// TODAY SPECIAL — "AAJ KYA HUA" DAILY NEWS
// ───────────────────────────────────────────────────────────────────────
// Ek hi page par poore din ka lekha-jokha, news feed ki tarah:
//   • Kaun kaha gaya  — chutti, absent, hospital, deputation
//   • Kisne kya kiya   — clerk, ustad, CC ki har action
//   • Kab hua          — har card par exact time
//   • Kyu hua          — record me likhi wajah
//
// Sabko dikhta hai (trainee bhi), isliye ye "notice board ka bada bhai"
// hai — roz subah kholo aur pata chal jaye kal/aaj kya hua.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import {
  Loader2, RefreshCw, Search, Calendar, Newspaper, AlertTriangle, Clock,
} from 'lucide-react';
import { useBatch } from '../../../contexts/BatchContext';
import {
  getActivityFeed, summarizeActivity, ACTIVITY_KINDS,
  type ActivityEvent, type ActivityKind,
} from '../api/activity.api';

const todayISO = () => new Date().toISOString().split('T')[0];

const shiftDay = (d: string, delta: number) => {
  const x = new Date(`${d}T00:00:00`);
  x.setDate(x.getDate() + delta);
  return x.toISOString().split('T')[0];
};

const timeOf = (iso: string) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};

const prettyDate = (d: string) => {
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString('en-IN',
      { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
};

interface Props {
  /** Trainee dashboard me embed karne ke liye — header chhota ho jata hai */
  embedded?: boolean;
}

export const TodaySpecialScreen: React.FC<Props> = ({ embedded = false }) => {
  const { activeBatch, loading: batchLoading } = useBatch();

  const [date, setDate] = useState(todayISO());
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<ActivityKind | 'all'>('all');

  const load = async () => {
    if (!activeBatch?.id) { setEvents([]); setLoading(false); return; }
    setLoading(true);
    try {
      setEvents(await getActivityFeed(activeBatch.id, date));
    } catch (err) {
      console.error('Today Special load failed', err);
      setEvents([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (batchLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBatch?.id, date, batchLoading]);

  const digest = useMemo(() => summarizeActivity(events), [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter(e => {
      if (kindFilter !== 'all' && e.kind !== kindFilter) return false;
      if (!q) return true;
      return [e.title, e.detail, e.reason, e.actor, e.subject]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [events, search, kindFilter]);

  const isToday = date === todayISO();

  return (
    <div className={embedded ? 'space-y-3' : 'w-full max-w-5xl mx-auto p-4 space-y-3 pb-10'}>

      {/* ══ HEADER ══ */}
      {!embedded && (
        <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Newspaper size={20} /> Today Special
            </h1>
            <p className="text-[10px] text-slate-300 mt-0.5">
              Aaj kya hua · kaun kaha gaya · kisne kya kiya — sab ek jagah
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-white/20 disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      )}

      {/* ══ DATE NAVIGATOR ══ */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setDate(d => shiftDay(d, -1))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
            ← Kal
          </button>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-slate-500" />
            <input type="date" value={date} max={todayISO()}
              onChange={e => setDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-bold" />
          </div>
          <button onClick={() => setDate(d => shiftDay(d, 1))} disabled={isToday}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
            Agla →
          </button>
          {!isToday && (
            <button onClick={() => setDate(todayISO())}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase text-white">
              Aaj par jao
            </button>
          )}
          <span className="ml-auto text-[11px] font-black text-slate-700">
            {prettyDate(date)}{isToday && <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[9px] text-green-700">AAJ</span>}
          </span>
        </div>
      </div>

      {/* ══ HEADLINES — din ka nichod ══ */}
      <div className="rounded-xl border-l-4 border-l-amber-500 border border-amber-200 bg-amber-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">
          📰 Aaj ki khabar
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {digest.headlines.map((h, i) => (
            <span key={i} className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 border border-amber-200">
              {h}
            </span>
          ))}
        </div>
        {digest.urgent > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-black text-red-700">
            <AlertTriangle size={13} /> {digest.urgent} cheez urgent hai — neeche laal cards dekho
          </p>
        )}
      </div>

      {/* ══ FILTER CHIPS ══ */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Naam / chest / wajah / kisne kiya — search karo…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setKindFilter('all')}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${
              kindFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
            Sab · {events.length}
          </button>
          {ACTIVITY_KINDS.filter(k => (digest.byKind[k.key] || 0) > 0).map(k => (
            <button key={k.key} onClick={() => setKindFilter(k.key)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${
                kindFilter === k.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {k.icon} {k.label} · {digest.byKind[k.key]}
            </button>
          ))}
        </div>
      </div>

      {/* ══ FEED ══ */}
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
          <Loader2 size={26} className="animate-spin text-slate-400" />
        </div>
      ) : !activeBatch ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-bold text-slate-400">Koi active batch nahi mila</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <Newspaper size={40} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-bold text-slate-400">
            {events.length === 0
              ? 'Is din koi activity record nahi hui'
              : 'Is filter me kuch nahi mila'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <article key={e.id}
              className={`rounded-xl border border-slate-200 border-l-4 p-3 ${e.color} ${
                e.importance === 'urgent' ? 'ring-2 ring-red-200' : ''}`}>
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none">{e.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black text-slate-800">{e.title}</h3>
                    {e.importance === 'urgent' && (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black text-white">URGENT</span>
                    )}
                  </div>
                  {e.detail && <p className="mt-0.5 text-[11px] font-bold text-slate-600">{e.detail}</p>}
                  {e.reason && (
                    <p className="mt-1 rounded-lg bg-white/70 px-2 py-1 text-[11px] text-slate-700">
                      <span className="font-black text-slate-500">Kyu: </span>{e.reason}
                    </p>
                  )}
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock size={10} /> {timeOf(e.at)}
                    </span>
                    <span>·</span>
                    <span className="font-bold text-slate-600">
                      {e.actor}{e.actorRole ? ` (${e.actorRole})` : ''}
                    </span>
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default TodaySpecialScreen;
