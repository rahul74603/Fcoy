// ============================================
// SUBJECT FORM - ADD / EDIT
// ============================================

import React, { useState, useEffect } from 'react';
import {
  SubjectFormData,
  Subject,
  DEFAULT_SUBJECT_FORM,
} from '../../types/subject.types';

interface Props {
  initialData?: Subject | null;
  onSubmit: (data: SubjectFormData) => Promise<boolean>;
  onCancel: () => void;
  submitting: boolean;
}

// ─── Dynamic Categories ──────────────────────
// These can be fetched from Firestore too
const SUBJECT_CATEGORIES = [
  'Weapon Training',
  'Physical Training',
  'Field Craft',
  'Battle Craft',
  'Academic',
  'Medical',
  'Communication',
  'Law & Order',
  'Leadership',
  'Other',
];

const SubjectForm: React.FC<Props> = ({
  initialData,
  onSubmit,
  onCancel,
  submitting,
}) => {
  const [formData, setFormData] = useState<SubjectFormData>(
    DEFAULT_SUBJECT_FORM
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof SubjectFormData, string>>
  >({});

  // ─── Populate on Edit ────────────────────
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        code: initialData.code,
        category: initialData.category,
        description: initialData.description,
        isActive: initialData.isActive,
      });
    }
  }, [initialData]);

  // ─── Handlers ────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof SubjectFormData]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // ─── Validate ────────────────────────────
  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof SubjectFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Subject name is required';
    }
    if (!formData.code.trim()) {
      newErrors.code = 'Subject code is required';
    } else if (formData.code.length > 6) {
      newErrors.code = 'Code must be max 6 characters';
    }
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Submit ──────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name + Code */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Weapon Training"
            className={`
              w-full px-3 py-2 border rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500
              ${errors.name ? 'border-red-500' : 'border-gray-300'}
            `}
          />
          {errors.name && (
            <p className="text-red-500 text-xs mt-1">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="code"
            value={formData.code}
            onChange={handleChange}
            placeholder="e.g., WT, DRILL, PT"
            maxLength={6}
            className={`
              w-full px-3 py-2 border rounded-lg text-sm
              uppercase focus:outline-none focus:ring-2
              focus:ring-blue-500
              ${errors.code ? 'border-red-500' : 'border-gray-300'}
            `}
          />
          {errors.code && (
            <p className="text-red-500 text-xs mt-1">{errors.code}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Max 6 characters. Will be auto-uppercased.
          </p>
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category <span className="text-red-500">*</span>
        </label>
        <select
          name="category"
          value={formData.category}
          onChange={handleChange}
          className={`
            w-full px-3 py-2 border rounded-lg text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500
            ${errors.category ? 'border-red-500' : 'border-gray-300'}
          `}
        >
          <option value="">Select Category</option>
          {SUBJECT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className="text-red-500 text-xs mt-1">{errors.category}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          placeholder="Brief description of the subject..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Active Status */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <div
          onClick={() =>
            setFormData((prev) => ({
              ...prev,
              isActive: !prev.isActive,
            }))
          }
          className={`
            relative w-10 h-6 rounded-full cursor-pointer transition-colors
            ${formData.isActive ? 'bg-green-500' : 'bg-gray-300'}
          `}
        >
          <div
            className={`
              absolute top-1 w-4 h-4 bg-white rounded-full shadow
              transition-transform
              ${formData.isActive ? 'translate-x-5' : 'translate-x-1'}
            `}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">
            {formData.isActive ? 'Active' : 'Inactive'}
          </p>
          <p className="text-xs text-gray-500">
            {formData.isActive
              ? 'Subject is available for assignment'
              : 'Subject is disabled'}
          </p>
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {submitting ? (
            <>
              <svg
                className="animate-spin w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Saving...
            </>
          ) : (
            <>{initialData ? '✓ Update Subject' : '+ Add Subject'}</>
          )}
        </button>
      </div>
    </form>
  );
};

export default SubjectForm;