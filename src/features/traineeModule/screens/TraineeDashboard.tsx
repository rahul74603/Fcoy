// ═══════════════════════════════════════════════════════════
// TRAINEE DASHBOARD — BSF Platoon-wise Layout
// Shows: Platoon Commanders, Trainees, Present/Absent,
// Senior Reports, Notice Board, Punishment/Rewards
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  Shield, User, ClipboardList, Bell, LogOut, Loader2,
  ChevronDown, ChevronUp, KeyRound, AlertTriangle,
  CheckCircle2, XCircle, Award, Heart, Calendar,
  Users, MapPin, Clock, FileText,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useBatch } from '../../../contexts/BatchContext';
import { getTraineeUpdates, getNotices } from '../api/trainee.api';
import { ChangePasswordModal } from '../../../components/ChangePasswordModal';
import type { TraineeUpdate, TraineeNotice } from '../types/trainee.types';
import { UPDATE_CATEGORIES, NOTICE_CATEGORIES, PRIORITY_COLORS, STATUS_COLORS } from '../types/trainee.types';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';

// Platoon config
const PLATOONS = ['Platoon 1', 'Platoon 2', 'Platoon 3', 'Platoon 4'];
const PLATOON_COLORS = ['border-blue-500', 'border-green-500', 'border-purple-500', 'border-orange-500'];
const PLATOON_BG = ['bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-orange-50'];
const PLATOON_ICONS = ['🔵', '🟢', '🟣', '🟠'];

export const TraineeDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { activeBatch } = useBatch();
  const [trainees, setTrainees] = useState<any[]>([]);
  const [updates, setUpdates] = useState<TraineeUpdate[]>([]);
  const [notices, setNotices] = useState<TraineeNotice[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, { present: number; absent: number; total: number }>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'platoon' | 'updates' | 'notices' | 'myinfo'>('platoon');
  const [expandedPlatoon, setExpandedPlatoon] = useState<string | null>(null);
  const [expandedTrainee, setExpandedTrainee] = useState<string | null>(null);
  const [showChangePass, setShowChangePass] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!activeBatch || !user) return;
    loadData();
  }, [user, activeBatch, selectedDate]);

  const loadData = async () => {
    if (!activeBatch || !user) return;
    setLoading(true);
    try {
      // Load all trainees for this batch
      const traineeSnap = await getDocs(query(collection(db, 'trainees'), where('batchId', '==', activeBatch.id)));
      const tList: any[] = [];
      traineeSnap.forEach(d => tList.push({ id: d.id, ...d.data() }));
      tList.sort((a, b) => {
        const pA = (a.platoon || '').localeCompare(b.platoon || '');
        if (pA !== 0) return pA;
        return (a.chestNo || '').localeCompare(b.chestNo || '');
      });
      setTrainees(tList);

      // Load today's attendance
      try {
        const attSnap = await getDocs(query(
          collection(db, 'periodAttendance'),
          where('batchId', '==', activeBatch.id),
          where('date', '==', selectedDate)
        ));
        const attMap: Record<string, { present: number; absent: number; total: number }> = {};
        attSnap.forEach(d => {
          const data = d.data();
          const tid = data.traineeId;
          if (!attMap[tid]) attMap[tid] = { present: 0, absent: 0, total: 0 };
          attMap[tid].total++;
          if (data.status === 'P') attMap[tid].present++;
          else attMap[tid].absent++;
        });
        setAttendanceData(attMap);
      } catch {}

      // Load updates for this trainee (if trainee is logged in)
      if (user.role === 'Trainee') {
        const myTrainee = tList.find(t => t.name === user.name);
        if (myTrainee) {
          const upd = await getTraineeUpdates(myTrainee.id);
          setUpdates(upd);
        }
      } else {
        // Staff sees all updates
        const allUpdates: TraineeUpdate[] = [];
        for (const t of tList.slice(0, 20)) { // Limit to avoid too many calls
          try {
            const upd = await getTraineeUpdates(t.id);
            allUpdates.push(...upd);
          } catch {}
        }
        allUpdates.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setUpdates(allUpdates.slice(0, 50));
      }

      // Load notices
      const ntc = await getNotices(activeBatch.id);
      setNotices(ntc);
    } catch {}
    setLoading(false);
  };

  // Get platoon data
  const getPlatoonData = (platoon: string) => {
    const platoonTrainees = trainees.filter(t => t.platoon === platoon);
    const platoonAttendance = platoonTrainees.map(t => attendanceData[t.id] || { present: 0, absent: 0, total: 0 });
    const totalPresent = platoonAttendance.reduce((s, a) => s + a.present, 0);
    const totalAbsent = platoonAttendance.reduce((s, a) => s + a.absent, 0);
    const totalPeriods = platoonAttendance.reduce((s, a) => s + a.total, 0);
    return {
      trainees: platoonTrainees,
      commander: platoonTrainees.find(t => t.isCommander || t.isPlatoonCommander),
      totalPresent,
      totalAbsent,
      totalPeriods,
      attendanceRate: totalPeriods > 0 ? Math.round((totalPresent / totalPeriods) * 100) : 0,
    };
  };

  // Overall stats
  const overallStats = {
    total: trainees.length,
    totalPresent: Object.values(attendanceData).reduce((s, a) => s + a.present, 0),
    totalAbsent: Object.values(attendanceData).reduce((s, a) => s + a.absent, 0),
    totalPeriods: Object.values(attendanceData).reduce((s, a) => s + a.total, 0),
  };
  overallStats.totalPresent > 0 ? Math.round((overallStats.totalPresent / overallStats.totalPeriods) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-900 to-green-700 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white">TRAINEE DASHBOARD</h1>
              <p className="text-[10px] text-green-200">BSF Training Center — {activeBatch?.batchNumber || 'No Batch'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowChangePass(true)} className="flex items-center gap-1 text-green-200 hover:text-white text-xs">
              <KeyRound size={14} /> Change Password
            </button>
            <button onClick={logout} className="flex items-center gap-1 text-green-200 hover:text-white text-xs">
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </div>

      {/* Date Selector */}
      <div className="max-w-6xl mx-auto px-4 mt-3">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-slate-500" />
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold" />
          <span className="text-xs text-slate-500">Ka din ka data dekhna hai</span>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="max-w-6xl mx-auto px-4 mt-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Trainees', value: overallStats.total, icon: '👥', color: 'bg-blue-50 border-blue-200' },
            { label: 'Total Present', value: overallStats.totalPresent, icon: '✅', color: 'bg-green-50 border-green-200' },
            { label: 'Total Absent', value: overallStats.totalAbsent, icon: '❌', color: 'bg-red-50 border-red-200' },
            { label: 'Attendance %', value: overallStats.totalPeriods > 0 ? Math.round((overallStats.totalPresent / overallStats.totalPeriods) * 100) : 0, icon: '📊', color: 'bg-purple-50 border-purple-200', suffix: '%' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.color} border rounded-xl p-3 text-center`}>
              <p className="text-xl mb-1">{stat.icon}</p>
              <p className="text-2xl font-black">{stat.value}{stat.suffix || ''}</p>
              <p className="text-[8px] font-bold text-slate-500 uppercase">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 mt-4">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'platoon', label: '🏢 Platoon View', icon: <Users size={14} /> },
            { key: 'updates', label: '📋 Updates', icon: <ClipboardList size={14} />, badge: updates.filter(u => u.status === 'pending').length },
            { key: 'notices', label: '🔔 Notice Board', icon: <Bell size={14} />, badge: notices.filter(n => n.priority === 'urgent').length },
            { key: 'myinfo', label: '👤 My Info', icon: <User size={14} /> },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold ${
                activeTab === tab.key ? 'bg-green-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}>
              {tab.icon} {tab.label}
              {tab.badge ? <span className="bg-red-500 text-white text-[9px] px-1.5 rounded-full">{tab.badge}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 mt-4 pb-8">

        {/* PLATOON VIEW */}
        {activeTab === 'platoon' && (
          <div className="space-y-4">
            {PLATOONS.map((platoon, idx) => {
              const data = getPlatoonData(platoon);
              const isExpanded = expandedPlatoon === platoon;
              return (
                <div key={platoon} className={`bg-white rounded-xl shadow-lg border-l-4 ${PLATOON_COLORS[idx]} overflow-hidden`}>
                  {/* Platoon Header */}
                  <button onClick={() => setExpandedPlatoon(isExpanded ? null : platoon)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{PLATOON_ICONS[idx]}</span>
                      <div className="text-left">
                        <h3 className="text-sm font-black text-slate-800">{platoon}</h3>
                        <p className="text-[10px] text-slate-500">
                          {data.commander ? `Commander: ${data.commander.name}` : 'No Commander'} · {data.trainees.length} trainees
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex gap-3 text-xs font-bold">
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded">✅ {data.totalPresent}</span>
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded">❌ {data.totalAbsent}</span>
                        <span className={`${PLATOON_BG[idx]} px-2 py-1 rounded`}>📊 {data.attendanceRate}%</span>
                      </div>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  {/* Commander Card */}
                  {data.commander && (
                    <div className={`mx-4 mb-3 ${PLATOON_BG[idx]} rounded-lg p-3 flex items-center gap-3`}>
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                        <Shield size={20} className="text-green-700" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800">👑 {data.commander.name}</p>
                        <p className="text-[10px] text-slate-500">Platoon Commander · Chest: {data.commander.chestNo}</p>
                      </div>
                    </div>
                  )}

                  {/* Trainees List */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {data.trainees.map(t => {
                          const att = attendanceData[t.id] || { present: 0, absent: 0, total: 0 };
                          const isAbsent = att.absent > att.present;
                          return (
                            <div key={t.id} className={`rounded-lg border p-3 ${
                              isAbsent ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-bold text-slate-800">{t.chestNo} — {t.name}</p>
                                  <p className="text-[10px] text-slate-500">{t.rank || 'Trainee'}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-bold">
                                    <span className="text-green-600">{att.present}P</span> / <span className="text-red-600">{att.absent}A</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* UPDATES TAB */}
        {activeTab === 'updates' && (
          <div className="space-y-3">
            {updates.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center">
                <ClipboardList size={40} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-400">Koi update nahi abhi tak</p>
              </div>
            ) : updates.map(u => {
              const cat = UPDATE_CATEGORIES.find(c => c.value === u.category) || { icon: '📝', label: u.category };
              return (
                <div key={u.id} className={`bg-white rounded-xl shadow p-4 border-l-4 ${
                  u.status === 'pending' ? 'border-yellow-500' : u.status === 'approved' ? 'border-green-500' : 'border-red-500'
                }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span>{cat.icon}</span>
                        <h4 className="text-sm font-bold">{u.title}</h4>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[u.status]}`}>{u.status}</span>
                      </div>
                      <p className="text-xs text-slate-600">{u.description}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {u.chestNo} — {u.traineeName} · {u.submittedBy} ({u.submittedByRole}) · {new Date(u.submittedAt).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* NOTICES TAB */}
        {activeTab === 'notices' && (
          <div className="space-y-3">
            {notices.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center">
                <Bell size={40} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-400">Koi notice nahi abhi</p>
              </div>
            ) : notices.map(n => {
              const nc = NOTICE_CATEGORIES.find(c => c.value === n.category) || { icon: '📌', label: n.category };
              return (
                <div key={n.id} className={`bg-white rounded-xl shadow p-4 border-l-4 ${
                  n.priority === 'urgent' ? 'border-red-500 bg-red-50/30' :
                  n.priority === 'important' ? 'border-orange-500 bg-orange-50/30' :
                  'border-green-500'
                }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{nc.icon}</span>
                        <h4 className="text-sm font-black text-slate-800">{n.title}</h4>
                        {n.priority === 'urgent' && <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full animate-pulse">URGENT</span>}
                      </div>
                      <p className="text-xs text-slate-600">{n.content}</p>
                      <p className="text-[10px] text-slate-400 mt-2">
                        {n.publishedBy} · {new Date(n.publishedAt).toLocaleDateString('en-IN')}
                        {n.targetPlatoon !== 'all' && ` · ${n.targetPlatoon}`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MY INFO TAB */}
        {activeTab === 'myinfo' && (
          <div className="space-y-4">
            {(() => {
              const myTrainee = trainees.find(t => t.name === user?.name);
              if (!myTrainee) return (
                <div className="bg-white rounded-xl p-8 text-center">
                  <User size={40} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-400">Trainee profile nahi mila</p>
                </div>
              );
              const att = attendanceData[myTrainee.id] || { present: 0, absent: 0, total: 0 };
              const myUpdates = updates.filter(u => u.traineeId === myTrainee.id);
              return (
                <>
                  <div className="bg-white rounded-xl shadow p-4">
                    <h3 className="text-sm font-black text-slate-700 mb-3">👤 My Profile</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        ['Name', myTrainee.name], ['Chest No', myTrainee.chestNo],
                        ['Regt No', myTrainee.regNo || '—'], ['Platoon', myTrainee.platoon],
                        ['Rank', myTrainee.rank || '—'], ['Father Name', myTrainee.fatherName || '—'],
                        ['DOB', myTrainee.dob || '—'], ['Blood Group', myTrainee.bloodGroup || '—'],
                        ['Home State', myTrainee.homeState || '—'],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                          <p className="text-[8px] font-bold text-slate-400 uppercase">{label}</p>
                          <p className="text-xs font-bold text-slate-800">{String(value || '—')}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Present', value: att.present, icon: '✅', color: 'bg-green-50 border-green-200' },
                      { label: 'Absent', value: att.absent, icon: '❌', color: 'bg-red-50 border-red-200' },
                      { label: 'Updates', value: myUpdates.length, icon: '📋', color: 'bg-blue-50 border-blue-200' },
                      { label: 'Attendance %', value: att.total > 0 ? Math.round((att.present / att.total) * 100) : 0, icon: '📊', color: 'bg-purple-50 border-purple-200', suffix: '%' },
                    ].map(stat => (
                      <div key={stat.label} className={`${stat.color} border rounded-xl p-3 text-center`}>
                        <p className="text-xl mb-1">{stat.icon}</p>
                        <p className="text-2xl font-black">{stat.value}{stat.suffix || ''}</p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* My Updates */}
                  <div className="bg-white rounded-xl shadow p-4">
                    <h3 className="text-sm font-black text-slate-700 mb-3">📋 My Updates</h3>
                    {myUpdates.length === 0 ? (
                      <p className="text-xs text-slate-400">Koi update nahi</p>
                    ) : myUpdates.map(u => (
                      <div key={u.id} className="border-b py-2 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[u.status]}`}>{u.status}</span>
                          <span className="text-xs font-bold">{u.title}</span>
                        </div>
                        <p className="text-[10px] text-slate-500">{u.description}</p>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      <ChangePasswordModal isOpen={showChangePass} onClose={() => setShowChangePass(false)} />
    </div>
  );
};
