// ============================================
// STAFF PROFILE VIEW
// ============================================

import React, { useEffect, useState } from 'react';
import { Staff } from '../../types/staff.types';
import { StaffSubjectAssignment } from '../../types/subject.types';
import { StaffDuty } from '../../types/duty.types';
import { StaffLeave } from '../../types/leave.types';
import StaffStatusBadge from '../shared/StaffStatusBadge';
import SubjectBadge from '../shared/SubjectBadge';
import { getAssignmentsByStaff } from '../../api/subject.api';
import { getDutiesByStaff } from '../../api/duty.api';
import { getLeaveByStaff } from '../../api/leave.api';

interface Props {
  staff: Staff;
  onEdit?: () => void;
  onClose?: () => void;
}

const StaffProfile: React.FC<Props> = ({ staff, onEdit, onClose }) => {
  const [subjects, setSubjects] = useState<StaffSubjectAssignment[]>([]);
  const [recentDuties, setRecentDuties] = useState<StaffDuty[]>([]);
  const [recentLeaves, setRecentLeaves] = useState<StaffLeave[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'subjects' | 'duties' | 'leaves'
  >('overview');

  // ─── Fetch Extra Data ────────────────────
  useEffect(() => {
    const fetchExtra = async () => {
      setLoadingExtra(true);
      try {
        const [subjs, duties, leaves] = await Promise.all([
          getAssignmentsByStaff(staff.id),
          getDutiesByStaff(staff.id),
          getLeaveByStaff(staff.id),
        ]);
        setSubjects(subjs);
        setRecentDuties(duties.slice(0, 5));
        setRecentLeaves(leaves.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingExtra(false);
      }
    };
    fetchExtra();
  }, [staff.id]);

  // ─── Helpers ─────────────────────────────
  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const formatDate = (date: Date | null) =>
    date ? date.toLocaleDateString('en-IN') : 'N/A';

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: '👤' },
    { key: 'subjects' as const, label: `Subjects (${subjects.length})`, icon: '📚' },
    { key: 'duties' as const, label: 'Duties', icon: '🎖️' },
    { key: 'leaves' as const, label: 'Leaves', icon: '🏖️' },
  ];

  return (
    <div className="space-y-0">
      {/* ── Profile Header ── */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 text-white mb-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {staff.photoURL ? (
              <img
                src={staff.photoURL}
                alt={staff.name}
                className="w-20 h-20 rounded-full object-cover border-3 border-white/50"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                {getInitials(staff.name)}
              </div>
            )}
          </div>

                     {/* Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {staff.rank} {staff.name}
                  </h2>
                  <p className="text-blue-200 text-sm mt-0.5">
                    Force No: {staff.forceNumber}
                  </p>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <StaffStatusBadge status={staff.status} />
                    {staff.category && (
                      <span className="text-xs font-bold bg-white/20 text-white px-2 py-1 rounded-full">
                        🎖️ {staff.category}
                      </span>
                    )}
                    {staff.company && (
                      <span className="text-xs font-bold bg-white/20 text-white px-2 py-1 rounded-full">
                        🏢 {staff.company}
                      </span>
                    )}
                  </div>
                </div>
                
              <div className="flex gap-2">
                {onEdit && (
                  <button
                    onClick={onEdit}
                    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    ✏️ Edit
                  </button>
                )}
                {onClose && (
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    ✕ Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{subjects.length}</p>
            <p className="text-xs text-blue-200">Subjects</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{staff.experienceYears}</p>
            <p className="text-xs text-blue-200">Yrs Exp</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{recentLeaves.length}</p>
            <p className="text-xs text-blue-200">Leave Records</p>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              flex-1 flex items-center justify-center gap-1.5
              py-2 px-2 rounded-lg text-xs font-medium transition-all
              ${activeTab === tab.key
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Loading ── */}
      {loadingExtra && (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      )}

      {/* ── TAB: Overview ── */}
      {activeTab === 'overview' && !loadingExtra && (
        <div className="space-y-4">
                   {/* Category & Role Info - PROMINENT */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-4 border-2 border-indigo-200">
            <h3 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
              <span>🎖️</span> Role & Specialization
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-indigo-600 font-bold uppercase">Category</p>
                <p className="text-base font-black text-indigo-900 mt-0.5">
                  {staff.category || 'Not Set'}
                </p>
              </div>
              <div>
                <p className="text-xs text-indigo-600 font-bold uppercase">Company</p>
                <p className="text-base font-black text-indigo-900 mt-0.5">
                  {staff.company || 'Not Set'}
                </p>
              </div>
              <div>
                <p className="text-xs text-indigo-600 font-bold uppercase">Rank</p>
                <p className="text-base font-black text-indigo-900 mt-0.5">
                  {staff.rank || 'Not Set'}
                </p>
              </div>
              <div>
                <p className="text-xs text-indigo-600 font-bold uppercase">Battalion</p>
                <p className="text-base font-black text-indigo-900 mt-0.5">
                  {staff.battalion || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Personal Info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>📋</span> Personal Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Mobile', value: staff.mobile },
                { label: 'Email', value: staff.email || 'N/A' },
                { label: 'Blood Group', value: staff.bloodGroup || 'N/A' },
                { label: 'Experience', value: `${staff.experienceYears} years` },
                { label: 'Qualification', value: staff.qualification || 'N/A' },
                { label: 'Force Number', value: staff.forceNumber },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Service Info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>🎖️</span> Service Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Date of Joining', value: formatDate(staff.dateOfJoining) },
                { label: 'Date of Posting', value: formatDate(staff.dateOfPosting) },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Emergency Contact */}
          {staff.emergencyContact?.name && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
                <span>🚨</span> Emergency Contact
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Name', value: staff.emergencyContact.name },
                  { label: 'Relation', value: staff.emergencyContact.relation },
                  { label: 'Mobile', value: staff.emergencyContact.mobile },
                  { label: 'Address', value: staff.emergencyContact.address },
                ].map((item) => (
                  <div key={item.label} className={item.label === 'Address' ? 'col-span-2' : ''}>
                    <p className="text-xs text-orange-600">{item.label}</p>
                    <p className="text-sm font-medium text-orange-900 mt-0.5">
                      {item.value || 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remarks */}
          {staff.remarks && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                📝 Remarks
              </h3>
              <p className="text-sm text-gray-600">{staff.remarks}</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Subjects ── */}
      {activeTab === 'subjects' && !loadingExtra && (
        <div>
          {subjects.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-4xl mb-2">📚</p>
              <p className="text-sm">No subjects assigned yet</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subjects.map((assignment) => (
                <SubjectBadge
                  key={assignment.id}
                  name={assignment.subjectName}
                  code={assignment.subjectCode}
                  color="blue"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Duties ── */}
      {activeTab === 'duties' && !loadingExtra && (
        <div className="space-y-2">
          {recentDuties.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-4xl mb-2">🎖️</p>
              <p className="text-sm">No duties assigned yet</p>
            </div>
          ) : (
            recentDuties.map((duty) => (
              <div
                key={duty.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {duty.dutyTypeName}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {duty.date ? duty.date.toLocaleDateString('en-IN') : 'N/A'}
                    {duty.startTime && ` • ${duty.startTime} - ${duty.endTime}`}
                  </p>
                </div>
                <span className={`
                  text-xs font-medium px-2 py-1 rounded-full
                  ${duty.status === 'completed' ? 'bg-green-100 text-green-700' : ''}
                  ${duty.status === 'assigned' ? 'bg-blue-100 text-blue-700' : ''}
                  ${duty.status === 'transferred' ? 'bg-yellow-100 text-yellow-700' : ''}
                  ${duty.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''}
                `}>
                  {duty.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB: Leaves ── */}
      {activeTab === 'leaves' && !loadingExtra && (
        <div className="space-y-2">
          {recentLeaves.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-4xl mb-2">🏖️</p>
              <p className="text-sm">No leave records found</p>
            </div>
          ) : (
            recentLeaves.map((leave) => (
              <div
                key={leave.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {leave.leaveTypeName} • {leave.numberOfDays} days
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(leave.fromDate)} → {formatDate(leave.toDate)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 italic">
                      {leave.leaveNumber}
                    </p>
                  </div>
                  <span className={`
                    text-xs font-medium px-2 py-1 rounded-full
                    ${leave.status === 'approved' ? 'bg-green-100 text-green-700' : ''}
                    ${leave.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                    ${leave.status === 'rejected' ? 'bg-red-100 text-red-700' : ''}
                    ${leave.status === 'cancelled' ? 'bg-gray-100 text-gray-700' : ''}
                  `}>
                    {leave.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default StaffProfile;