// src/features/system/SeedStaffData.tsx
// Complete: Seed + Sync + Cleanup (All-in-One)

import React, { useState } from 'react';
import { Loader2, Plus, AlertTriangle, Layers, RefreshCw } from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useBatch } from '../../contexts/BatchContext';

// ═══════════════════════════════════════════════════════════
// DUMMY DATA
// ═══════════════════════════════════════════════════════════

const DUMMY_STAFF = [
  { forceNumber: 'BP-091234567', name: 'Rajesh Kumar Sharma', rank: 'Head Constable', company: 'F Coy', category: 'PT Instructor', battalion: 'STC Tekanpur', mobile: '9876543210', experienceYears: 12, qualification: 'Graduate, NIS Diploma', bloodGroup: 'B+' },
  { forceNumber: 'BP-091234568', name: 'Suresh Singh Yadav', rank: 'Head Constable', company: 'F Coy', category: 'Drill Instructor', battalion: 'STC Tekanpur', mobile: '9876543211', experienceYears: 15, qualification: '12th Pass, Drill Course', bloodGroup: 'O+' },
  { forceNumber: 'BP-091234569', name: 'Mahesh Chandra Verma', rank: 'ASI', company: 'A Coy', category: 'Weapon Instructor', battalion: 'STC Tekanpur', mobile: '9876543212', experienceYears: 18, qualification: 'Graduate, Weapon Course', bloodGroup: 'A+' },
  { forceNumber: 'BP-091234570', name: 'Dinesh Prasad Tiwari', rank: 'Sub Inspector', company: 'B Coy', category: 'Map Reading', battalion: 'STC Tekanpur', mobile: '9876543213', experienceYears: 20, qualification: 'Post Graduate', bloodGroup: 'AB+' },
  { forceNumber: 'BP-091234571', name: 'Anil Kumar Pandey', rank: 'Constable', company: 'F Coy', category: 'PT Instructor', battalion: 'STC Tekanpur', mobile: '9876543214', experienceYears: 8, qualification: '12th Pass, PT Course', bloodGroup: 'B-' },
  { forceNumber: 'BP-091234572', name: 'Ramesh Bahadur Thapa', rank: 'Head Constable', company: 'C Coy', category: 'FPT Instructor', battalion: 'STC Tekanpur', mobile: '9876543215', experienceYears: 14, qualification: 'Graduate', bloodGroup: 'O+' },
  { forceNumber: 'BP-091234573', name: 'Vijay Kumar Singh', rank: 'ASI', company: 'D Coy', category: 'Drill Instructor', battalion: 'STC Tekanpur', mobile: '9876543216', experienceYears: 16, qualification: '12th, Drill Master Course', bloodGroup: 'A-' },
  { forceNumber: 'BP-091234574', name: 'Prakash Chand Meena', rank: 'Constable', company: 'E Coy', category: 'Yoga Instructor', battalion: 'STC Tekanpur', mobile: '9876543217', experienceYears: 6, qualification: 'Yoga Certification', bloodGroup: 'B+' },
  { forceNumber: 'BP-091234575', name: 'Gopal Krishna Das', rank: 'Head Constable', company: 'F Coy', category: 'Weapon Instructor', battalion: 'STC Tekanpur', mobile: '9876543218', experienceYears: 13, qualification: 'Weapon Course Advanced', bloodGroup: 'O-' },
  { forceNumber: 'BP-091234576', name: 'Bharat Bhushan Gupta', rank: 'Inspector', company: 'G Coy', category: 'Field Craft', battalion: 'STC Tekanpur', mobile: '9876543219', experienceYears: 22, qualification: 'Post Graduate, FC Course', bloodGroup: 'A+' },
  { forceNumber: 'BP-091234577', name: 'Narender Singh Rathore', rank: 'Sub Inspector', company: 'H Coy', category: 'Battle Craft', battalion: 'STC Tekanpur', mobile: '9876543220', experienceYears: 19, qualification: 'Graduate, BC Specialist', bloodGroup: 'B+' },
  { forceNumber: 'BP-091234578', name: 'Sanjay Kumar Mishra', rank: 'Constable', company: 'A Coy', category: 'Communication', battalion: 'STC Tekanpur', mobile: '9876543221', experienceYears: 5, qualification: 'ITI, Signal Course', bloodGroup: 'AB-' },
  { forceNumber: 'BP-091234579', name: 'Ajay Pratap Chauhan', rank: 'Head Constable', company: 'B Coy', category: 'First Aid', battalion: 'STC Tekanpur', mobile: '9876543222', experienceYears: 11, qualification: 'First Aid Diploma', bloodGroup: 'O+' },
  { forceNumber: 'BP-091234580', name: 'Deepak Kumar Joshi', rank: 'ASI', company: 'C Coy', category: 'Law Instructor', battalion: 'STC Tekanpur', mobile: '9876543223', experienceYears: 17, qualification: 'LLB, Law Course', bloodGroup: 'A+' },
  { forceNumber: 'BP-091234581', name: 'Mohan Lal Kushwaha', rank: 'Constable', company: 'D Coy', category: 'Swimming', battalion: 'STC Tekanpur', mobile: '9876543224', experienceYears: 7, qualification: 'Swimming Certificate', bloodGroup: 'B+' },
  { forceNumber: 'BP-091234582', name: 'Pawan Kumar Dubey', rank: 'Head Constable', company: 'E Coy', category: 'PT Instructor', battalion: 'STC Tekanpur', mobile: '9876543225', experienceYears: 10, qualification: 'NIS Course, Graduate', bloodGroup: 'O+' },
  { forceNumber: 'BP-091234583', name: 'Rohit Singh Bhandari', rank: 'Constable', company: 'F Coy', category: 'Drill Instructor', battalion: 'STC Tekanpur', mobile: '9876543226', experienceYears: 4, qualification: '12th, Basic Drill', bloodGroup: 'A-' },
  { forceNumber: 'BP-091234584', name: 'Kailash Nath Tripathi', rank: 'Sub Inspector', company: 'G Coy', category: 'Weapon Instructor', battalion: 'STC Tekanpur', mobile: '9876543227', experienceYears: 21, qualification: 'Senior Weapon Course', bloodGroup: 'AB+' },
  { forceNumber: 'BP-091234585', name: 'Hari Om Sharma', rank: 'ASI', company: 'H Coy', category: 'Admin Staff', battalion: 'STC Tekanpur', mobile: '9876543228', experienceYears: 15, qualification: 'Graduate, Computer', bloodGroup: 'B-' },
  { forceNumber: 'BP-091234586', name: 'Yogendra Singh Rawat', rank: 'Head Constable', company: 'F Coy', category: 'FPT Instructor', battalion: 'STC Tekanpur', mobile: '9876543229', experienceYears: 9, qualification: 'Physical Training Cert', bloodGroup: 'O+' },
];

const LEAVE_TYPES = [
  { name: 'Casual Leave', code: 'CL', maxDaysPerYear: 15, isPaid: true, description: 'Short duration personal leave' },
  { name: 'Earned Leave', code: 'EL', maxDaysPerYear: 30, isPaid: true, description: 'Annual earned leave' },
  { name: 'Medical Leave', code: 'ML', maxDaysPerYear: 20, isPaid: true, description: 'For medical emergencies' },
  { name: 'Restricted Holiday', code: 'RH', maxDaysPerYear: 2, isPaid: true, description: 'Restricted holiday leave' },
  { name: 'Special Leave', code: 'SL', maxDaysPerYear: 10, isPaid: true, description: 'Special circumstances' },
  { name: 'Compensatory Off', code: 'COFF', maxDaysPerYear: 12, isPaid: true, description: 'Compensation for extra work' },
  { name: 'Course Leave', code: 'COURSE', maxDaysPerYear: 60, isPaid: true, description: 'For training courses' },
  { name: 'Temporary Duty', code: 'TD', maxDaysPerYear: 90, isPaid: true, description: 'Temporary duty leave' },
];

const DUTY_TYPES = [
  { name: 'Weapon Ustad', description: 'Weapon training duty' },
  { name: 'Drill Ustad', description: 'Drill training duty' },
  { name: 'PT Ustad', description: 'Physical training duty' },
  { name: 'FPT Ustad', description: 'Field physical training' },
  { name: 'Range Officer', description: 'Firing range in-charge' },
  { name: 'Parade Commander', description: 'Parade command duty' },
  { name: 'Guard Commander', description: 'Guard duty commander' },
  { name: 'Armoury Duty', description: 'Weapons store duty' },
  { name: 'Class Instructor', description: 'Classroom teaching' },
  { name: 'Camp Duty', description: 'Training camp duty' },
  { name: 'Quarter Guard', description: 'Quarter guard duty' },
  { name: 'Duty Officer', description: 'Daily duty officer' },
  { name: 'Mess Officer', description: 'Mess in-charge' },
  { name: 'Sports Officer', description: 'Games and sports' },
  { name: 'MI Room Duty', description: 'Medical inspection room' },
];

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════
const SeedStaffData: React.FC = () => {
  const { activeBatch } = useBatch();
  const [status, setStatus] = useState<'idle' | 'busy'>('idle');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev]);
  };

  // ═══════════════════════════════════════════
  // 1. DELETE STAFF (current batch)
  // ═══════════════════════════════════════════
  const deleteCurrentBatchStaff = async () => {
    if (!activeBatch) return;
    try {
      addLog(`🗑️ Deleting staff from batch ${activeBatch.batchNumber}...`);
      const q = query(collection(db, 'staff'), where('batchId', '==', activeBatch.id));
      const snap = await getDocs(q);
      let deleted = 0;
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'staff', d.id));
        deleted++;
        await new Promise(r => setTimeout(r, 100));
      }
      addLog(`✅ Deleted ${deleted} staff`);
    } catch (err) {
      addLog(`❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  // ═══════════════════════════════════════════
  // 2. SEED STAFF
  // ═══════════════════════════════════════════
  const seedStaff = async () => {
    if (!activeBatch) { addLog('❌ No active batch!'); return; }
    try {
      addLog(`📝 Seeding 20 staff...`);
      let added = 0;
      for (const staff of DUMMY_STAFF) {
        const now = new Date();
        await addDoc(collection(db, 'staff'), {
          ...staff, batchId: activeBatch.id, batchNumber: activeBatch.batchNumber,
          email: '', dateOfJoining: null, dateOfPosting: null,
          emergencyContact: { name: '', relation: '', mobile: '', address: '' },
          status: 'active', photoURL: '', remarks: `Seeded ${now.toLocaleDateString('en-IN')}`,
          createdAt: now, updatedAt: now, createdBy: 'seed_script',
        });
        added++;
        addLog(`✅ ${staff.rank} ${staff.name} (${staff.category})`);
        await new Promise(r => setTimeout(r, 200));
      }
      addLog(`🎉 Added ${added} staff!`);
    } catch (err) {
      addLog(`❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  // ═══════════════════════════════════════════
  // 3. SEED LEAVE TYPES
  // ═══════════════════════════════════════════
  const seedLeaveTypes = async () => {
    try {
      addLog('📝 Seeding leave types...');
      const existingSnap = await getDocs(collection(db, 'leave_types'));
      for (const d of existingSnap.docs) { await deleteDoc(doc(db, 'leave_types', d.id)); }
      addLog(`🗑️ Cleared ${existingSnap.size} old`);
      let added = 0;
      for (const lt of LEAVE_TYPES) {
        await addDoc(collection(db, 'leave_types'), { ...lt, isActive: true, createdAt: new Date() });
        added++;
        addLog(`✅ ${lt.name} (${lt.code})`);
        await new Promise(r => setTimeout(r, 150));
      }
      addLog(`🎉 Added ${added} leave types!`);
    } catch (err) {
      addLog(`❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  // ═══════════════════════════════════════════
  // 4. SEED DUTY TYPES
  // ═══════════════════════════════════════════
  const seedDutyTypes = async () => {
    try {
      addLog('📝 Seeding duty types...');
      const existingSnap = await getDocs(collection(db, 'duty_types'));
      for (const d of existingSnap.docs) { await deleteDoc(doc(db, 'duty_types', d.id)); }
      addLog(`🗑️ Cleared ${existingSnap.size} old`);
      let added = 0;
      for (const dt of DUTY_TYPES) {
        await addDoc(collection(db, 'duty_types'), { ...dt, isActive: true, createdAt: new Date() });
        added++;
        addLog(`✅ ${dt.name}`);
        await new Promise(r => setTimeout(r, 150));
      }
      addLog(`🎉 Added ${added} duty types!`);
    } catch (err) {
      addLog(`❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  // ═══════════════════════════════════════════
  // 5. SYNC LEAVE STATUS
  // ═══════════════════════════════════════════
  const syncLeaveStatus = async () => {
    setStatus('busy');
    try {
      addLog('🔄 Syncing leave status...');
      const leavesSnap = await getDocs(query(collection(db, 'staff_leave'), where('status', '==', 'approved')));
      const today = new Date(); today.setHours(12, 0, 0, 0);

      const activeLeaves = leavesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((l: any) => {
          const from = l.fromDate?.toDate?.() ?? new Date(l.fromDate);
          const to = l.toDate?.toDate?.() ?? new Date(l.toDate);
          return today >= from && today <= to && !l.returnDate;
        });

      addLog(`📋 Active leaves today: ${activeLeaves.length}`);
      const staffSnap = await getDocs(collection(db, 'staff'));
      let updated = 0, correct = 0, skipped = 0;

      for (const staffDoc of staffSnap.docs) {
        const data = staffDoc.data();
        const hasLeave = activeLeaves.some((l: any) => l.staffId === staffDoc.id);
        const current = data.status;
        const shouldBe = hasLeave ? 'leave' : 'active';

        if (current === shouldBe) { correct++; continue; }
        if (['hospital', 'course', 'attachment', 'deputed_out', 'on_deputation', 'td', 'inactive'].includes(current)) {
          skipped++; continue;
        }

        try {
          await updateDoc(doc(db, 'staff', staffDoc.id), { status: shouldBe, updatedAt: new Date() });
          updated++;
          addLog(`✅ ${data.name}: ${current} → ${shouldBe}`);
        } catch (err) {
          addLog(`❌ ${data.name}: Failed`);
        }
      }

      addLog(`🎉 Updated: ${updated} | Correct: ${correct} | Skipped: ${skipped}`);
    } catch (err) {
      addLog(`❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally { setStatus('idle'); }
  };
  
  // ═══════════════════════════════════════════
  // 6. CLEAN ORPHAN LEAVES
  // ═══════════════════════════════════════════
  const cleanOrphanLeaves = async () => {
    setStatus('busy');
    try {
      addLog('🧹 Cleaning orphan leaves...');
      const leavesSnap = await getDocs(collection(db, 'staff_leave'));
      const staffSnap = await getDocs(collection(db, 'staff'));
      const validIds = new Set(staffSnap.docs.map(d => d.id));
      addLog(`📋 Leaves: ${leavesSnap.size} | Valid staff: ${validIds.size}`);

      let deleted = 0;
      for (const leaveDoc of leavesSnap.docs) {
        if (!validIds.has(leaveDoc.data().staffId)) {
          await deleteDoc(doc(db, 'staff_leave', leaveDoc.id));
          deleted++;
          addLog(`🗑️ ${leaveDoc.data().staffName}`);
          await new Promise(r => setTimeout(r, 100));
        }
      }
      addLog(`✅ Deleted ${deleted} orphan leaves`);
    } catch (err) {
      addLog(`❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally { setStatus('idle'); }
  };

  // ═══════════════════════════════════════════
  const cleanOldTestRecords = async () => {
    if (!activeBatch) return;

    if (!window.confirm(
      `⚠️ Delete ALL old test data?\n\n` +
      `This will delete:\n` +
      `• All weeklyTestRecords for batch ${activeBatch.batchNumber}\n` +
      `• All fptRecords for batch ${activeBatch.batchNumber}\n\n` +
      `NEW test data (training_tests) will NOT be deleted.\n\n` +
      `Are you sure?`
    )) return;

    setStatus('busy');
    try {
      // Delete weeklyTestRecords
      addLog('🗑️ Deleting old weekly test records...');
      const weeklyQ = query(
        collection(db, 'weeklyTestRecords'),
        where('batchId', '==', activeBatch.id)
      );
      const weeklySnap = await getDocs(weeklyQ);
      let weeklyDeleted = 0;
      for (const d of weeklySnap.docs) {
        await deleteDoc(doc(db, 'weeklyTestRecords', d.id));
        weeklyDeleted++;
        await new Promise(r => setTimeout(r, 50));
      }
      addLog(`✅ Deleted ${weeklyDeleted} weekly test records`);

      // Delete fptRecords
      addLog('🗑️ Deleting old FPT records...');
      const fptQ = query(
        collection(db, 'fptRecords'),
        where('batchId', '==', activeBatch.id)
      );
      const fptSnap = await getDocs(fptQ);
      let fptDeleted = 0;
      for (const d of fptSnap.docs) {
        await deleteDoc(doc(db, 'fptRecords', d.id));
        fptDeleted++;
        await new Promise(r => setTimeout(r, 50));
      }
      addLog(`✅ Deleted ${fptDeleted} FPT records`);

      addLog(`🎉 Cleanup complete!`);
      addLog(`   • Weekly tests deleted: ${weeklyDeleted}`);
      addLog(`   • FPT records deleted: ${fptDeleted}`);
      addLog(`   • Total: ${weeklyDeleted + fptDeleted}`);
      addLog(`💡 Now save results again in new system → auto-publish will work`);
    } catch (err) {
      addLog(`❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setStatus('idle');
    }
  };
  void cleanOldTestRecords;

  // ═══════════════════════════════════════════
  // 7. CLEAN ORPHAN ATTENDANCE + DUTIES
  // ═══════════════════════════════════════════
  const cleanOrphanAttendance = async () => {
    setStatus('busy');
    try {
      addLog('🧹 Cleaning orphan attendance + duties...');
      const staffSnap = await getDocs(collection(db, 'staff'));
      const validIds = new Set(staffSnap.docs.map(d => d.id));

      // Clean attendance
      const attSnap = await getDocs(collection(db, 'staff_attendance'));
      let attDeleted = 0;
      for (const attDoc of attSnap.docs) {
        if (!validIds.has(attDoc.data().staffId)) {
          await deleteDoc(doc(db, 'staff_attendance', attDoc.id));
          attDeleted++;
          await new Promise(r => setTimeout(r, 50));
        }
      }
      addLog(`✅ Attendance cleaned: ${attDeleted}`);

      // Clean duties
      const dutySnap = await getDocs(collection(db, 'staff_duty'));
      let dutyDeleted = 0;
      for (const dutyDoc of dutySnap.docs) {
        if (!validIds.has(dutyDoc.data().staffId)) {
          await deleteDoc(doc(db, 'staff_duty', dutyDoc.id));
          dutyDeleted++;
          await new Promise(r => setTimeout(r, 50));
        }
      }
      addLog(`✅ Duties cleaned: ${dutyDeleted}`);
      addLog(`🎉 Total cleaned: ${attDeleted + dutyDeleted}`);
    } catch (err) {
      addLog(`❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally { setStatus('idle'); }
  };

  // ═══════════════════════════════════════════
  // 8. NUCLEAR RESET (Everything)
  // ═══════════════════════════════════════════
  const nuclearReset = async () => {
    if (!activeBatch) { addLog('❌ No batch!'); return; }
    if (!window.confirm('⚠️ NUCLEAR RESET!\n\nThis will:\n- Delete ALL staff\n- Delete ALL leaves\n- Delete ALL attendance\n- Delete ALL duties\n- Re-seed 20 staff + leave types + duty types\n\nAre you SURE?')) return;

    setStatus('busy');
    addLog('☢️ NUCLEAR RESET STARTED...');

    // Delete everything
    const collections = ['staff_leave', 'staff_attendance', 'staff_duty', 'staff_activity_logs'];
    for (const colName of collections) {
      try {
        const snap = await getDocs(collection(db, colName));
        let count = 0;
        for (const d of snap.docs) {
          await deleteDoc(doc(db, colName, d.id));
          count++;
          await new Promise(r => setTimeout(r, 50));
        }
        addLog(`🗑️ ${colName}: ${count} deleted`);
      } catch (err) {
        addLog(`⚠️ ${colName}: Skip (${err instanceof Error ? err.message : 'error'})`);
      }
    }

    // Delete and reseed
    await deleteCurrentBatchStaff();
    await seedStaff();
    await seedLeaveTypes();
    await seedDutyTypes();

    addLog('🎊 NUCLEAR RESET COMPLETE! Everything fresh.');
    setStatus('idle');
  };

  // ═══════════════════════════════════════════
  // 9. FULL SEED (Staff + Types only)
  // ═══════════════════════════════════════════
  const fullSeed = async () => {
    if (!activeBatch) { addLog('❌ No batch!'); return; }
    if (!window.confirm(`Reset staff of batch ${activeBatch.batchNumber} and seed fresh?`)) return;
    setStatus('busy');
    await deleteCurrentBatchStaff();
    await seedStaff();
    await seedLeaveTypes();
    await seedDutyTypes();
    addLog('🎊 Seed complete!');
    setStatus('idle');
  };

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-8">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
        <h1 className="text-xl font-black uppercase tracking-wider">
          🛠️ System Tools — Seed, Sync & Cleanup
        </h1>
        <p className="text-slate-300 text-xs mt-1">
          All-in-one page: Seed data, sync status, clean orphans, nuclear reset
        </p>
      </div>

      {/* BATCH */}
      {activeBatch ? (
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 flex items-center gap-3">
          <Layers size={24} className="text-green-700" />
          <div>
            <p className="text-sm font-bold text-green-900">Batch: {activeBatch.batchNumber}</p>
            <p className="text-xs text-green-700">{activeBatch.batchName}</p>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={24} className="text-amber-700" />
          <p className="text-sm font-bold text-amber-900">No Active Batch!</p>
        </div>
      )}

      {/* ════════════════════════════════════════
          SECTION 1: SEEDING
      ════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-blue-50 px-5 py-3 border-b border-blue-200">
          <h2 className="text-sm font-black text-blue-900 uppercase flex items-center gap-2">
            <Plus size={16} /> Seed Data
          </h2>
          <p className="text-[10px] text-blue-700 mt-0.5">Add dummy staff + leave types + duty types</p>
        </div>
        <div className="p-5 space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-black text-blue-700">20</p>
              <p className="text-[10px] font-bold text-blue-600">Staff</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-black text-yellow-700">8</p>
              <p className="text-[10px] font-bold text-yellow-600">Leave Types</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-black text-red-700">15</p>
              <p className="text-[10px] font-bold text-red-600">Duty Types</p>
            </div>
          </div>

          {/* Buttons */}
          <button onClick={fullSeed} disabled={!activeBatch || status === 'busy'}
            className="w-full py-3 bg-blue-600 text-white text-sm font-bold uppercase rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2">
            {status === 'busy' ? <><Loader2 size={16} className="animate-spin" /> Working...</> : <><Plus size={16} /> Seed All (Staff + Types)</>}
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button onClick={async () => { setStatus('busy'); await deleteCurrentBatchStaff(); await seedStaff(); setStatus('idle'); }}
              disabled={!activeBatch || status === 'busy'}
              className="py-2 bg-blue-100 text-blue-800 text-xs font-bold rounded-lg hover:bg-blue-200 disabled:opacity-40">
              Staff Only
            </button>
            <button onClick={async () => { setStatus('busy'); await seedLeaveTypes(); setStatus('idle'); }}
              disabled={status === 'busy'}
              className="py-2 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-lg hover:bg-yellow-200 disabled:opacity-40">
              Leave Types
            </button>
            <button onClick={async () => { setStatus('busy'); await seedDutyTypes(); setStatus('idle'); }}
              disabled={status === 'busy'}
              className="py-2 bg-red-100 text-red-800 text-xs font-bold rounded-lg hover:bg-red-200 disabled:opacity-40">
              Duty Types
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          SECTION 2: SYNC & FIX
      ════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-purple-50 px-5 py-3 border-b border-purple-200">
          <h2 className="text-sm font-black text-purple-900 uppercase flex items-center gap-2">
            <RefreshCw size={16} /> Sync & Fix
          </h2>
          <p className="text-[10px] text-purple-700 mt-0.5">Fix mismatched data between modules</p>
        </div>
        <div className="p-5 space-y-3">
          <button onClick={syncLeaveStatus} disabled={status === 'busy'}
            className="w-full py-3 bg-purple-600 text-white text-sm font-bold uppercase rounded-lg hover:bg-purple-700 disabled:opacity-40 flex items-center justify-center gap-2">
            {status === 'busy' ? <><Loader2 size={16} className="animate-spin" /> Syncing...</> : <><RefreshCw size={16} /> Sync Leave Status (Fix On Leave: 0)</>}
          </button>
          <p className="text-[10px] text-purple-600 text-center">
            Checks approved leaves and updates staff status to "On Leave"
          </p>
        </div>
      </div>

            {/* ════════════════════════════════════════
          SECTION 3: CLEANUP
      ════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-orange-50 px-5 py-3 border-b border-orange-200">
          <h2 className="text-sm font-black text-orange-900 uppercase flex items-center gap-2">
            🧹 Cleanup
          </h2>
          <p className="text-[10px] text-orange-700 mt-0.5">Remove orphan records + old test data</p>
        </div>
        <div className="p-5 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button onClick={cleanOrphanLeaves} disabled={status === 'busy'}
              className="py-3 bg-orange-600 text-white text-sm font-bold uppercase rounded-lg hover:bg-orange-700 disabled:opacity-40 flex items-center justify-center gap-2">
              {status === 'busy' ? <><Loader2 size={14} className="animate-spin" /> Cleaning...</> : <>🧹 Clean Orphan Leaves</>}
            </button>
            <button onClick={cleanOrphanAttendance} disabled={status === 'busy'}
              className="py-3 bg-amber-600 text-white text-sm font-bold uppercase rounded-lg hover:bg-amber-700 disabled:opacity-40 flex items-center justify-center gap-2">
              {status === 'busy' ? <><Loader2 size={14} className="animate-spin" /> Cleaning...</> : <>🧹 Clean Orphan Attendance + Duties</>}
            </button>
          </div>
          <p className="text-[10px] text-orange-600 text-center">
            💡 "Old Test Data" removes weeklyTestRecords + fptRecords (Dashboard will refresh)
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════
          SECTION 4: NUCLEAR RESET
      ════════════════════════════════════════ */}
      <div className="bg-white border-2 border-red-300 rounded-xl overflow-hidden">
        <div className="bg-red-50 px-5 py-3 border-b border-red-200">
          <h2 className="text-sm font-black text-red-900 uppercase flex items-center gap-2">
            ☢️ Nuclear Reset
          </h2>
          <p className="text-[10px] text-red-700 mt-0.5">DELETE everything and start completely fresh</p>
        </div>
        <div className="p-5">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <p className="text-xs text-red-800 font-bold">⚠️ This will delete:</p>
            <ul className="text-[10px] text-red-700 mt-1 space-y-0.5 ml-4 list-disc">
              <li>All staff in current batch</li>
              <li>All leave records</li>
              <li>All attendance records</li>
              <li>All duty records</li>
              <li>All activity logs</li>
              <li>Then re-seed 20 staff + types fresh</li>
            </ul>
          </div>
          <button onClick={nuclearReset} disabled={!activeBatch || status === 'busy'}
            className="w-full py-3 bg-red-600 text-white text-sm font-bold uppercase rounded-lg hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-2">
            {status === 'busy' ? <><Loader2 size={16} className="animate-spin" /> Resetting...</> : <>☢️ Nuclear Reset — Delete All & Re-Seed</>}
          </button>
        </div>
      </div>

      {/* LOGS */}
      {logs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-700 uppercase">Logs ({logs.length})</h3>
            <button onClick={() => setLogs([])} className="text-xs text-slate-400 hover:text-red-600 font-bold">Clear</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="px-4 py-1.5 text-xs border-b border-slate-50 font-mono text-slate-700 hover:bg-slate-50">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SeedStaffData;