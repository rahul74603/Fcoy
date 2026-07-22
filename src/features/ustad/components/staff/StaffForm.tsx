// ============================================
// STAFF FORM - ADD / EDIT
// Complete profile with Category + Company
// ============================================

import React, { useState, useEffect } from 'react';
import {
  Staff,
  StaffFormData,
  StaffStatus,
  BloodGroup,
  DEFAULT_STAFF_FORM,
  COMPANIES,
  RANKS,
  INSTRUCTOR_CATEGORIES,
  CATEGORY_ICONS,
} from '../../types/staff.types';

interface Props {
  initialData?: Staff | null;
  onSubmit: (data: StaffFormData) => Promise<boolean>;
  onCancel: () => void;
  submitting: boolean;
}

const BLOOD_GROUPS: BloodGroup[] = [
  'A+', 'A-', 'B+', 'B-',
  'O+', 'O-', 'AB+', 'AB-',
];

const STATUSES: { value: StaffStatus; label: string }[] = [
  { value: 'active', label: '✅ Active' },
  { value: 'inactive', label: '⭕ Inactive' },
  { value: 'leave', label: '🏖️ On Leave' },
  { value: 'td', label: '🚗 Temporary Duty' },
  { value: 'hospital', label: '🏥 Hospital' },
  { value: 'course', label: '📖 On Course' },
  { value: 'attachment', label: '🔗 Attachment' },
  { value: 'deputed_out', label: '↗️ Deputed Out' },
  { value: 'on_deputation', label: '↙️ On Deputation' },
];

const StaffForm: React.FC<Props> = ({
  initialData,
  onSubmit,
  onCancel,
  submitting,
}) => {
  const [formData, setFormData] = useState<StaffFormData>(DEFAULT_STAFF_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof StaffFormData, string>>>({});
  const [activeTab, setActiveTab] = useState<'identity' | 'service' | 'personal' | 'emergency'>('identity');

  // Populate form on edit
   useEffect(() => {
    if (initialData) {
      setFormData({
        batchId: initialData.batchId,        // ⭐ ADD THIS LINE
        forceNumber: initialData.forceNumber,
        name: initialData.name,
        rank: initialData.rank,
        company: initialData.company,
        category: initialData.category,
        battalion: initialData.battalion,
        mobile: initialData.mobile,
        email: initialData.email,
        dateOfJoining: initialData.dateOfJoining
          ? initialData.dateOfJoining.toISOString().split('T')[0]
          : '',
        dateOfPosting: initialData.dateOfPosting
          ? initialData.dateOfPosting.toISOString().split('T')[0]
          : '',
        experienceYears: initialData.experienceYears,
        qualification: initialData.qualification,
        bloodGroup: initialData.bloodGroup,
        emergencyContact: initialData.emergencyContact,
        status: initialData.status,
        photoURL: initialData.photoURL,
        remarks: initialData.remarks,
      });
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof StaffFormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleEmergencyChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      emergencyContact: { ...prev.emergencyContact, [name]: value },
    }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof StaffFormData, string>> = {};

    if (!formData.forceNumber.trim()) {
      newErrors.forceNumber = 'Force No / IRLA is required';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.rank) {
      newErrors.rank = 'Rank is required';
    }
    if (!formData.company) {
      newErrors.company = 'Company is required';
    }
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }
    if (!formData.mobile.trim()) {
      newErrors.mobile = 'Mobile number is required';
    } else if (!/^\d{10}$/.test(formData.mobile)) {
      newErrors.mobile = 'Enter valid 10-digit number';
    }

    setErrors(newErrors);

    // Switch to tab with error
    if (newErrors.forceNumber || newErrors.name || newErrors.rank || newErrors.company || newErrors.category) {
      setActiveTab('identity');
    } else if (newErrors.mobile) {
      setActiveTab('personal');
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  const tabs = [
    { key: 'identity' as const, label: 'Identity & Role', icon: '🎖️' },
    { key: 'service' as const, label: 'Service Details', icon: '📋' },
    { key: 'personal' as const, label: 'Personal Info', icon: '👤' },
    { key: 'emergency' as const, label: 'Emergency Contact', icon: '🚨' },
  ];

  const inputCls = (field: keyof StaffFormData) => `
    w-full px-3 py-2 border rounded-lg text-sm
    focus:outline-none focus:ring-2 focus:ring-blue-500
    ${errors[field] ? 'border-red-500' : 'border-gray-300'}
  `;

  return (
    <form onSubmit={handleSubmit} className="space-y-0">

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`
              flex-1 flex items-center justify-center gap-2
              py-2 px-3 rounded-lg text-sm font-medium transition-all
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

      {/* ── TAB 1: Identity & Role ── */}
      {activeTab === 'identity' && (
        <div className="space-y-4">

          {/* Force Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Force No / IRLA / BP Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="forceNumber"
              value={formData.forceNumber}
              onChange={handleChange}
              disabled={!!initialData}
              placeholder="e.g., 990123456 or IRLA-84729"
              className={`${inputCls('forceNumber')} ${initialData ? 'bg-gray-50 text-gray-500' : ''}`}
            />
            {errors.forceNumber && <p className="text-red-500 text-xs mt-1">{errors.forceNumber}</p>}
            <p className="text-[10px] text-gray-400 mt-1">
              Identity Card ka main number — ye unique hai har personnel ke liye
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Rajesh Kumar Sharma"
              className={inputCls('name')}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Rank + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rank <span className="text-red-500">*</span>
              </label>
              <select name="rank" value={formData.rank} onChange={handleChange} className={inputCls('rank')}>
                <option value="">Select Rank</option>
                {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {errors.rank && <p className="text-red-500 text-xs mt-1">{errors.rank}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Status
              </label>
              <select name="status" value={formData.status} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Company + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company / Coy <span className="text-red-500">*</span>
              </label>
              <select name="company" value={formData.company} onChange={handleChange} className={inputCls('company')}>
                <option value="">Select Company</option>
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.company && <p className="text-red-500 text-xs mt-1">{errors.company}</p>}
              <p className="text-[10px] text-gray-400 mt-1">
                Parent Company / Home Coy
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instructor Category <span className="text-red-500">*</span>
              </label>
              <select name="category" value={formData.category} onChange={handleChange} className={inputCls('category')}>
                <option value="">Select Category</option>
                {INSTRUCTOR_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {CATEGORY_ICONS[c] || '📌'} {c}
                  </option>
                ))}
              </select>
              {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
            </div>
          </div>

          {/* Battalion */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Battalion / Unit
            </label>
            <input
              type="text"
              name="battalion"
              value={formData.battalion}
              onChange={handleChange}
              placeholder="e.g., 3rd Bn BSF, 5th Bn BSF, STC Tekanpur"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* ── TAB 2: Service Details ── */}
      {activeTab === 'service' && (
        <div className="space-y-4">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Joining (BSF)
              </label>
              <input type="date" name="dateOfJoining" value={formData.dateOfJoining} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Posting (This Unit)
              </label>
              <input type="date" name="dateOfPosting" value={formData.dateOfPosting} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Experience (Years)
              </label>
              <input type="number" name="experienceYears" value={formData.experienceYears} onChange={handleChange}
                min={0} max={40}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qualification
              </label>
              <input type="text" name="qualification" value={formData.qualification} onChange={handleChange}
                placeholder="e.g., 10th, 12th, Graduate, Judo Black Belt"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Photo URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Photo URL</label>
            <input type="url" name="photoURL" value={formData.photoURL} onChange={handleChange}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange}
              rows={3} placeholder="Any additional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
      )}

      {/* ── TAB 3: Personal Info ── */}
      {activeTab === 'personal' && (
        <div className="space-y-4">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mobile <span className="text-red-500">*</span>
              </label>
              <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange}
                placeholder="10-digit mobile number" maxLength={10}
                className={inputCls('mobile')} />
              {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange}
                placeholder="email@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Blood Group */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
            <div className="grid grid-cols-4 gap-2">
              {BLOOD_GROUPS.map(bg => (
                <button key={bg} type="button"
                  onClick={() => setFormData(prev => ({ ...prev, bloodGroup: bg }))}
                  className={`
                    py-2 rounded-lg text-sm font-medium border transition-all
                    ${formData.bloodGroup === bg
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-red-400'
                    }
                  `}
                >
                  {bg}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: Emergency Contact ── */}
      {activeTab === 'emergency' && (
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-orange-700">
              🚨 Emergency contact critical hai — accurately bharo
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input type="text" name="name" value={formData.emergencyContact.name} onChange={handleEmergencyChange}
                placeholder="Full name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Relation</label>
              <input type="text" name="relation" value={formData.emergencyContact.relation} onChange={handleEmergencyChange}
                placeholder="e.g., Wife, Father, Brother"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Mobile</label>
            <input type="tel" name="mobile" value={formData.emergencyContact.mobile} onChange={handleEmergencyChange}
              placeholder="10-digit number" maxLength={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Home Address</label>
            <textarea name="address" value={formData.emergencyContact.address} onChange={handleEmergencyChange}
              rows={3} placeholder="Complete home address..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
      )}

      {/* ── Form Footer ── */}
      <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-200">
        <div className="flex gap-2">
          {activeTab !== 'identity' && (
            <button type="button"
              onClick={() => setActiveTab(activeTab === 'emergency' ? 'personal' : activeTab === 'personal' ? 'service' : 'identity')}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
              ← Previous
            </button>
          )}
          {activeTab !== 'emergency' && (
            <button type="button"
              onClick={() => setActiveTab(activeTab === 'identity' ? 'service' : activeTab === 'service' ? 'personal' : 'emergency')}
              className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
              Next →
            </button>
          )}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
            {submitting ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Saving...
              </>
            ) : (
              <>{initialData ? '✓ Update Staff' : '+ Add Staff'}</>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

export default StaffForm;