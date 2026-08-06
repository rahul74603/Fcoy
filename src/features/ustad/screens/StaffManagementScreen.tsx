// ============================================
// STAFF MANAGEMENT SCREEN - MAIN
// ============================================

import React, { useState } from 'react';
import { useStaff } from '../hooks/useStaff';
import { Staff, StaffStatus } from '../types/staff.types';
import { StaffFormData } from '../types/staff.types';
import StaffCard from '../components/shared/StaffCard';
import StaffForm from '../components/staff/StaffForm';
import StaffProfile from '../components/staff/StaffProfile';
import StaffStatusBadge from '../components/shared/StaffStatusBadge';
import FormModal from '../components/shared/FormModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { ReportButton } from '../../../components/common/ReportButton';

// ─── Status Filter Tabs ──────────────────────
const STATUS_TABS: { value: StaffStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'leave', label: 'On Leave' },
  { value: 'td', label: 'TD' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'course', label: 'Course' },
  { value: 'inactive', label: 'Inactive' },
];

const StaffManagementScreen: React.FC = () => {
    const {
    filteredStaff,
    summary,
    filter,
    loading,
    submitting,
    error,
    hasBatch,
    handleAddStaff,
    handleUpdateStaff,
    handleDeleteStaff,
    setFilter,
    resetFilter,
    clearError,
  } = useStaff();

  // ─── UI State ────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // ─── Handlers ────────────────────────────
  const handleView = (staff: Staff) => {
    setSelectedStaff(staff);
    setShowProfileModal(true);
  };

  const handleEdit = (staff: Staff) => {
    setSelectedStaff(staff);
    setShowEditModal(true);
  };

  const handleDeleteClick = (staff: Staff) => {
    setSelectedStaff(staff);
    setShowDeleteDialog(true);
  };

  const handleAddSubmit = async (formData: StaffFormData) => {
    const success = await handleAddStaff(formData);
    if (success) setShowAddModal(false);
    return success;
  };

  const handleEditSubmit = async (formData: StaffFormData) => {
    if (!selectedStaff) return false;
    const success = await handleUpdateStaff(selectedStaff.id, formData);
    if (success) setShowEditModal(false);
    return success;
  };

  const handleDeleteConfirm = async () => {
    if (!selectedStaff) return;
    const success = await handleDeleteStaff(selectedStaff.id);
    if (success) {
      setShowDeleteDialog(false);
      setSelectedStaff(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Page Header ── */}
              <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Staff Management
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Batch-wise instructor profiles — refreshed per batch cycle
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!hasBatch}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={!hasBatch ? 'Activate a batch first' : 'Add new staff'}
          >
            <span>+</span>
            Add Staff
          </button>
        </div>
      </div>

            <div className="p-6 space-y-6">

        {/* ── No Batch Warning ── */}
        {!hasBatch && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900">No Active Batch</p>
              <p className="text-xs text-amber-700 mt-1">
                Staff management is batch-wise. Please activate a batch from Batch Management to add or view staff.
              </p>
            </div>
          </div>
        )}

        {/* ── Error Banner ── */}
        {error && (

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <span className="text-red-500 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-sm text-red-700 font-medium">Error</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total', value: summary.total, color: 'bg-gray-100 text-gray-800', icon: '👥' },
            { label: 'Active', value: summary.active, color: 'bg-green-100 text-green-800', icon: '✅' },
            { label: 'On Leave', value: summary.onLeave, color: 'bg-yellow-100 text-yellow-800', icon: '🏖️' },
            { label: 'TD', value: summary.onTD, color: 'bg-blue-100 text-blue-800', icon: '🚗' },
            { label: 'Hospital', value: summary.inHospital, color: 'bg-red-100 text-red-800', icon: '🏥' },
            { label: 'Course', value: summary.onCourse, color: 'bg-purple-100 text-purple-800', icon: '📖' },
            { label: 'Inactive', value: summary.inactive, color: 'bg-gray-100 text-gray-500', icon: '⭕' },
          ].map((card) => (
            <div
              key={card.label}
              className={`rounded-xl p-3 text-center ${card.color}`}
            >
              <p className="text-lg">{card.icon}</p>
              <p className="text-xl font-bold mt-1">{card.value}</p>
              <p className="text-xs font-medium mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>

        {/* ── Search + Filter Bar ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search by name, force number, mobile..."
                value={filter.search}
                onChange={(e) => setFilter({ search: e.target.value })}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <ReportButton className="self-center" />

            {/* Reset Filter */}
            {(filter.search || filter.status !== 'all' || filter.rank !== 'all') && (
              <button
                onClick={resetFilter}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            )}

            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white shadow-sm text-blue-600'
                    : 'text-gray-500'
                }`}
              >
                ⊞ Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                  viewMode === 'list'
                    ? 'bg-white shadow-sm text-blue-600'
                    : 'text-gray-500'
                }`}
              >
                ☰ List
              </button>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter({ status: tab.value })}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-medium transition-all
                  ${filter.status === tab.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Staff List ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading staff data...</p>
            </div>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
            <p className="text-5xl mb-3">👥</p>
            <p className="text-gray-500 font-medium">No staff found</p>
            <p className="text-gray-400 text-sm mt-1">
              {filter.search
                ? 'Try different search terms'
                : 'Add staff members to get started'}
            </p>
            {!filter.search && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Add First Staff Member
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredStaff.map((staff) => (
              <StaffCard
                key={staff.id}
                staff={staff}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Force No', 'Name & Rank', 'Category', 'Company', 'Mobile', 'Status', 'Actions'].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">
                      {staff.forceNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {staff.name}
                        </p>
                        <p className="text-xs text-gray-500">{staff.rank}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {staff.category ? (
                        <span className="text-xs font-bold bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
                          {staff.category}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded">
                        {staff.company || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {staff.mobile}
                    </td>
                    <td className="px-4 py-3">
                      <StaffStatusBadge status={staff.status} size="sm" />
                    </td>
                    
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleView(staff)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleEdit(staff)}
                          className="text-xs text-green-600 hover:text-green-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(staff)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Table Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500">
                Showing {filteredStaff.length} of {summary.total} staff members
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          MODALS
      ════════════════════════════════════════ */}

      {/* Add Staff Modal */}
      <FormModal
        isOpen={showAddModal}
        title="Add New Staff Member"
        subtitle="Fill in the details to add a new instructor"
        onClose={() => setShowAddModal(false)}
        size="xl"
      >
        <StaffForm
          onSubmit={handleAddSubmit}
          onCancel={() => setShowAddModal(false)}
          submitting={submitting}
        />
      </FormModal>

      {/* Edit Staff Modal */}
      <FormModal
        isOpen={showEditModal}
        title="Edit Staff Member"
        subtitle={selectedStaff ? `Editing: ${selectedStaff.name}` : ''}
        onClose={() => {
          setShowEditModal(false);
          setSelectedStaff(null);
        }}
        size="xl"
      >
        <StaffForm
          initialData={selectedStaff}
          onSubmit={handleEditSubmit}
          onCancel={() => {
            setShowEditModal(false);
            setSelectedStaff(null);
          }}
          submitting={submitting}
        />
      </FormModal>

      {/* Profile View Modal */}
      <FormModal
        isOpen={showProfileModal}
        title="Staff Profile"
        onClose={() => {
          setShowProfileModal(false);
          setSelectedStaff(null);
        }}
        size="xl"
      >
        {selectedStaff && (
          <StaffProfile
            staff={selectedStaff}
            onEdit={() => {
              setShowProfileModal(false);
              setShowEditModal(true);
            }}
            onClose={() => {
              setShowProfileModal(false);
              setSelectedStaff(null);
            }}
          />
        )}
      </FormModal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Staff Member"
        message={`Are you sure you want to delete ${selectedStaff?.name}? This action cannot be undone.`}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        confirmColor="red"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setShowDeleteDialog(false);
          setSelectedStaff(null);
        }}
        loading={submitting}
      />
    </div>
  );
};

export default StaffManagementScreen;