// ============================================
// NOTIFICATION CENTER SCREEN (Module 17 Audit ★ NEW)
// ============================================
// Full-page notification dashboard:
//   • Stats cards (total/unread/high-priority/broadcasts)
//   • Inbox tab  — merged feed (stored + computed) + filters
//   • Broadcast tab (CC only) — role-targeted message composer
//   • Sent History tab (CC only) — delivery/read tracking
// ============================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Send, Filter, CheckCheck, Loader2, RefreshCw,
  AlertTriangle, Radio, History, Users,
} from 'lucide-react';
import { useNotifications } from './useNotifications';
import {
  NOTIFICATION_CONFIG, NOTIFICATION_TARGET_ROLES,
  NotificationPriority, StoredNotification,
} from './notification.types';
import { sendNotification, fetchSentHistory } from './notification.api';
import { getNextNumber } from '../system/masters.api';
import { useAuth } from '../../contexts/AuthContext';

export const NotificationCenterScreen: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    notifications, unreadCount, loading,
    refreshNotifications, markAsRead, markAllAsRead,
  } = useNotifications();

  const isCommander = user?.role === 'Company Commander';

  const [tab, setTab] = useState<'inbox' | 'broadcast' | 'history'>('inbox');

  // ── INBOX FILTERS ──
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all');
  const [filterDate, setFilterDate] = useState('');

  // ── BROADCAST COMPOSER ──
  const [bcForm, setBcForm] = useState({ title: '', message: '', priority: 'medium' as NotificationPriority, targetRole: 'ALL' });
  const [bcEmergency, setBcEmergency] = useState(false);
  const [bcSending, setBcSending] = useState(false);
  const [bcMessage, setBcMessage] = useState('');

  // ── SENT HISTORY ──
  const [sentHistory, setSentHistory] = useState<StoredNotification[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setSentHistory(await fetchSentHistory(50));
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (tab === 'history' && isCommander) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const allTypes = useMemo(() => [...new Set(notifications.map(n => n.type))], [notifications]);

  const filtered = useMemo(() => notifications.filter(n => {
    if (filterType !== 'all' && n.type !== filterType) return false;
    if (filterPriority !== 'all' && n.priority !== filterPriority) return false;
    if (filterRead === 'unread' && n.read) return false;
    if (filterRead === 'read' && !n.read) return false;
    if (filterDate) {
      const d = n.timestamp.toISOString().split('T')[0];
      if (d !== filterDate) return false;
    }
    return true;
  }), [notifications, filterType, filterPriority, filterRead, filterDate]);

  // ── STATS ──
  const stats = [
    { label: 'Total', value: notifications.length, bg: 'bg-blue-50', color: 'text-blue-700' },
    { label: 'Unread', value: unreadCount, bg: unreadCount > 0 ? 'bg-red-50' : 'bg-green-50', color: unreadCount > 0 ? 'text-red-700' : 'text-green-700' },
    { label: 'High Priority', value: notifications.filter(n => n.priority === 'high' && !n.read).length, bg: 'bg-amber-50', color: 'text-amber-700' },
    { label: 'Broadcasts', value: notifications.filter(n => n.type === 'broadcast' || n.type === 'emergency').length, bg: 'bg-purple-50', color: 'text-purple-700' },
  ];

  const handleBroadcastSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setBcMessage('');
    if (!bcForm.title.trim() || !bcForm.message.trim()) {
      setBcMessage('ERROR: Title aur message dono zaroori hain.');
      return;
    }
    setBcSending(true);
    try {
      // ★ Module 18 numbering system — BC-0001 style broadcast IDs
      const bcId = await getNextNumber('broadcast', 'BC', 4);
      await sendNotification({
        type: bcEmergency ? 'emergency' : 'broadcast',
        priority: bcEmergency ? 'high' : bcForm.priority,
        title: `${bcEmergency ? '🚨 ' : '📢 '}${bcForm.title.trim()} [${bcId}]`,
        message: bcForm.message.trim(),
        targetRole: bcForm.targetRole,
        createdBy: user?.uid ?? '',
        createdByName: user?.name ?? user?.email ?? 'Commander',
      });
      setBcMessage(`SUCCESS: Broadcast ${bcId} bhej diya gaya — target: ${bcForm.targetRole}. Sabko bell mein dikhega.`);
      setBcForm({ title: '', message: '', priority: 'medium', targetRole: 'ALL' });
      setBcEmergency(false);
      refreshNotifications();
    } catch (err: any) {
      setBcMessage(`ERROR: ${err.message}`);
    } finally {
      setBcSending(false);
    }
  };

  const getTimeAgo = (date: Date): string => {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'abhi-abhi';
    if (mins < 60) return `${mins}m pehle`;
    if (hours < 24) return `${hours}h pehle`;
    return `${days}d pehle`;
  };

  const inputCls = 'w-full border border-slate-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-slate-700 bg-white';

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-slate-800 pb-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Bell size={22} className="text-slate-700" /> Notification Center
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Inbox · Broadcast · Sent History — event alerts + role-targeted messages
          </p>
        </div>
        <button onClick={refreshNotifications} disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 rounded">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {stats.map(s => (
          <div key={s.label} className={`${s.bg} border border-slate-200 rounded p-3 text-center`}>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-slate-300">
        {([
          { key: 'inbox', label: `📥 Inbox (${unreadCount} unread)`, show: true },
          { key: 'broadcast', label: '📢 Broadcast', show: isCommander },
          { key: 'history', label: '📜 Sent History', show: isCommander },
        ] as const).filter(t => t.show).map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 text-[11px] font-black uppercase border-b-2 -mb-px ${tab === t.key ? 'border-slate-800 text-slate-900 bg-white' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── INBOX TAB ── */}
      {tab === 'inbox' && (
        <>
          {/* FILTERS */}
          <div className="bg-white border border-slate-200 rounded p-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Filter size={11} /> Filters
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className={inputCls}>
                <option value="all">All Types</option>
                {allTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className={inputCls}>
                <option value="all">All Priorities</option>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
              <select value={filterRead} onChange={e => setFilterRead(e.target.value as any)} className={inputCls}>
                <option value="all">All Status</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className={inputCls} />
              <button onClick={markAllAsRead}
                className="flex items-center justify-center gap-1.5 bg-slate-700 text-white text-[10px] font-black uppercase rounded px-2 py-1.5 hover:bg-slate-800">
                <CheckCheck size={12} /> Mark All Read
              </button>
            </div>
          </div>

          {/* LIST */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="py-16 text-center"><Loader2 size={24} className="animate-spin text-slate-400 mx-auto mb-2" /><p className="text-xs text-slate-400 font-bold uppercase">Loading...</p></div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Bell size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold uppercase">Koi notification filter match nahi karta</p>
              </div>
            ) : (
              filtered.map(n => {
                const config = NOTIFICATION_CONFIG[n.type] ?? NOTIFICATION_CONFIG.system_alert;
                return (
                  <button key={n.id}
                    onClick={() => { markAsRead(n.id); if (n.link) navigate(n.link); }}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3 ${!n.read ? 'bg-blue-50/40' : ''}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${config.bgColor}`}>
                      <span className="text-base">{config.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-xs font-bold ${config.color}`}>{n.title}</p>
                        {n.priority === 'high' && <span className="text-[8px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">URGENT</span>}
                        {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{getTimeAgo(n.timestamp)} · {n.type.replace(/_/g, ' ')}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ── BROADCAST TAB (CC only) ── */}
      {tab === 'broadcast' && isCommander && (
        <form onSubmit={handleBroadcastSend} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-800 flex items-center border-b border-slate-200 pb-2">
            <Radio size={15} className="mr-2 text-blue-600" /> Compose Broadcast Message
          </h2>

          {bcMessage && (
            <div className={`p-2 text-[10px] font-bold uppercase border ${bcMessage.startsWith('ERROR') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-300 text-green-700'}`}>
              {bcMessage}
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Title *</label>
            <input type="text" value={bcForm.title} onChange={e => setBcForm({ ...bcForm, title: e.target.value })} className={inputCls} required maxLength={80} />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Message *</label>
            <textarea value={bcForm.message} onChange={e => setBcForm({ ...bcForm, message: e.target.value })} rows={3} className={inputCls} required maxLength={500} />
            <p className="text-[9px] text-slate-400 mt-1">{bcForm.message.length}/500</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1"><Users size={10} /> Target Role</label>
              <select value={bcForm.targetRole} onChange={e => setBcForm({ ...bcForm, targetRole: e.target.value })} className={inputCls}>
                {NOTIFICATION_TARGET_ROLES.map(r => <option key={r} value={r}>{r === 'ALL' ? '📢 ALL ROLES' : r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Priority</label>
              <select value={bcForm.priority} onChange={e => setBcForm({ ...bcForm, priority: e.target.value as NotificationPriority })} disabled={bcEmergency} className={inputCls}>
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>
          </div>

          {/* EMERGENCY TOGGLE */}
          <label className={`flex items-center gap-2 p-2.5 border rounded cursor-pointer ${bcEmergency ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
            <input type="checkbox" checked={bcEmergency} onChange={e => setBcEmergency(e.target.checked)} className="accent-red-600" />
            <AlertTriangle size={14} className={bcEmergency ? 'text-red-600' : 'text-slate-400'} />
            <span className={`text-[10px] font-black uppercase ${bcEmergency ? 'text-red-700' : 'text-slate-500'}`}>
              Emergency Alert Mode — sabko HIGH priority urgent message
            </span>
          </label>

          <button type="submit" disabled={bcSending}
            className={`w-full text-white font-bold uppercase tracking-wider py-2.5 text-xs rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${bcEmergency ? 'bg-red-700 hover:bg-red-800' : 'bg-military-800 hover:bg-military-900'}`}>
            {bcSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {bcSending ? 'Sending...' : bcEmergency ? '🚨 Send Emergency Alert' : 'Send Broadcast'}
          </button>
        </form>
      )}

      {/* ── SENT HISTORY TAB (CC only) ── */}
      {tab === 'history' && isCommander && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-purple-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <History size={14} className="text-purple-600" /> Sent History — Delivery & Read Tracking
            </h3>
            <button onClick={loadHistory} disabled={historyLoading} className="text-[10px] font-bold uppercase text-purple-700 hover:text-purple-900 flex items-center gap-1">
              <RefreshCw size={11} className={historyLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
            {historyLoading ? (
              <div className="py-12 text-center"><Loader2 size={22} className="animate-spin text-slate-400 mx-auto" /></div>
            ) : sentHistory.length === 0 ? (
              <p className="py-12 text-center text-xs text-slate-400 font-bold uppercase">Abhi tak koi stored notification nahi bheja gaya</p>
            ) : (
              sentHistory.map(n => {
                const config = NOTIFICATION_CONFIG[n.type] ?? NOTIFICATION_CONFIG.system_alert;
                return (
                  <div key={n.id} className="px-4 py-3 hover:bg-slate-50">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.bgColor}`}>
                        <span className="text-sm">{config.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-slate-800">{n.title}</p>
                          <span className="text-[8px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full uppercase">
                            → {n.targetUserId ? 'Individual' : n.targetRole}
                          </span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${n.readBy.length > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {n.readBy.length > 0 ? `✓ Read by ${n.readBy.length}` : 'Delivered · Unread'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {n.createdAt ? n.createdAt.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'} · by {n.createdByName}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenterScreen;
