// ============================================
// SUBJECT MASTER SCREEN
// ============================================

import React, { useState } from 'react';
import { useSubjects } from '../hooks/useSubjects';
import { Subject, SubjectFormData } from '../types/subject.types';
import SubjectForm from '../components/subject/SubjectForm';
import SubjectBadge from '../components/shared/SubjectBadge';
import FormModal from '../components/shared/FormModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

// ─── Category Colors ─────────────────────────
const CATEGORY_COLORS: Record<
  string,
  'blue' | 'green' | 'purple' | 'orange' | 'red'
> = {
  'Weapon Training': 'red',
  'Physical Training': 'green',
  'Field Craft': 'orange',
  'Battle Craft': 'purple',
  Academic: 'blue',
  Medical: 'red',
  Communication: 'blue',
  'Law & Order': 'purple',
  Leadership: 'orange',
  Other: 'blue',
};

const SubjectMasterScreen: React.FC = () => {
  const {
    subjects,
    loading,
    submitting,
    error,
    handleAddSubject,
    handleUpdateSubject,
    handleDeleteSubject,
    handleToggleStatus,
    clearError,
  } = useSubjects();

  // ─── UI State ────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // ─── Derived Data ─────────────────────────
  const categories = [
    'all',
    ...Array.from(new Set(subjects.map((s) => s.category))).filter(Boolean),
  ];

  const filteredSubjects = subjects.filter((subject) => {
    const matchSearch =
      !searchQuery ||
      subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      subject.code.toLowerCase().includes(searchQuery.toLowerCase());

    const matchCategory =
      categoryFilter === 'all' || subject.category === categoryFilter;

    return matchSearch && matchCategory;
  });

  // Group by category
  const groupedSubjects = filteredSubjects.reduce(
    (acc, subject) => {
      const cat = subject.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(subject);
      return acc;
    },
    {} as Record<string, Subject[]>
  );

  // ─── Handlers ────────────────────────────
  const handleAddSubmit = async (
    data: SubjectFormData
  ): Promise<boolean> => {
    const success = await handleAddSubject(data);
    if (success) setShowAddModal(false);
    return success;
  };

  const handleEditSubmit = async (
    data: SubjectFormData
  ): Promise<boolean> => {
    if (!selectedSubject) return false;
    const success = await handleUpdateSubject(selectedSubject.id, data);
    if (success) {
      setShowEditModal(false);
      setSelectedSubject(null);
    }
    return success;
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSubject) return;
    const success = await handleDeleteSubject(selectedSubject.id);
    if (success) {
      setShowDeleteDialog(false);
      setSelectedSubject(null);
    }
  };

  const handleToggle = async (subject: Subject) => {
    await handleToggleStatus(subject.id, !subject.isActive);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Subject Master
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage all training subjects dynamically
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add Subject
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ── Error ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-red-500">⚠️</span>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={clearError} className="text-red-400">✕</button>
          </div>
        )}

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: 'Total Subjects',
              value: subjects.length,
              icon: '📚',
              color: 'bg-blue-50 text-blue-700',
            },
            {
              label: 'Active',
              value: subjects.filter((s) => s.isActive).length,
              icon: '✅',
              color: 'bg-green-50 text-green-700',
            },
            {
              label: 'Inactive',
              value: subjects.filter((s) => !s.isActive).length,
              icon: '⭕',
              color: 'bg-gray-50 text-gray-600',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl p-4 ${stat.color} border border-current/10`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{stat.icon}</span>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs font-medium opacity-80">
                    {stat.label}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Search + Filter ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search subjects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-medium transition-all
                  ${
                    categoryFilter === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Subject List (Grouped by Category) ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
            <p className="text-5xl mb-3">📚</p>
            <p className="text-gray-500 font-medium">No subjects found</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              + Add First Subject
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSubjects).map(([category, items]) => (
              <div key={category}>
                {/* Category Header */}
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                    {category}
                  </h3>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {items.length} subjects
                  </span>
                </div>

                {/* Subject Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((subject) => (
                    <div
                      key={subject.id}
                      className={`
                        bg-white rounded-xl border p-4 transition-all
                        ${
                          subject.isActive
                            ? 'border-gray-200 hover:shadow-md'
                            : 'border-gray-100 opacity-60'
                        }
                      `}
                    >
                      {/* Top Row */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <SubjectBadge
                            name=""
                            code={subject.code}
                            color={
                              CATEGORY_COLORS[subject.category] ?? 'blue'
                            }
                          />
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {subject.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {subject.category}
                            </p>
                          </div>
                        </div>

                        {/* Toggle */}
                        <div
                          onClick={() => handleToggle(subject)}
                          className={`
                            relative w-9 h-5 rounded-full cursor-pointer
                            transition-colors flex-shrink-0
                            ${subject.isActive ? 'bg-green-500' : 'bg-gray-300'}
                          `}
                        >
                          <div
                            className={`
                              absolute top-0.5 w-4 h-4 bg-white rounded-full
                              shadow transition-transform
                              ${subject.isActive ? 'translate-x-4' : 'translate-x-0.5'}
                            `}
                          />
                        </div>
                      </div>

                      {/* Description */}
                      {subject.description && (
                        <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                          {subject.description}
                        </p>
                      )}

                      {/* Status Badge */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`
                            text-xs font-medium px-2 py-0.5 rounded-full
                            ${
                              subject.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }
                          `}
                        >
                          {subject.isActive ? '● Active' : '○ Inactive'}
                        </span>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedSubject(subject);
                              setShowEditModal(true);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSubject(subject);
                              setShowDeleteDialog(true);
                            }}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <FormModal
        isOpen={showAddModal}
        title="Add New Subject"
        subtitle="Create a new training subject"
        onClose={() => setShowAddModal(false)}
        size="md"
      >
        <SubjectForm
          onSubmit={handleAddSubmit}
          onCancel={() => setShowAddModal(false)}
          submitting={submitting}
        />
      </FormModal>

      <FormModal
        isOpen={showEditModal}
        title="Edit Subject"
        subtitle={selectedSubject?.name}
        onClose={() => {
          setShowEditModal(false);
          setSelectedSubject(null);
        }}
        size="md"
      >
        <SubjectForm
          initialData={selectedSubject}
          onSubmit={handleEditSubmit}
          onCancel={() => {
            setShowEditModal(false);
            setSelectedSubject(null);
          }}
          submitting={submitting}
        />
      </FormModal>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Subject"
        message={`Delete "${selectedSubject?.name}"? Make sure no staff is assigned this subject.`}
        confirmLabel="Yes, Delete"
        confirmColor="red"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setShowDeleteDialog(false);
          setSelectedSubject(null);
        }}
        loading={submitting}
      />
    </div>
  );
};

export default SubjectMasterScreen;